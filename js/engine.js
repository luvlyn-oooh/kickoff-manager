/* 킥오프 매니저 - 실시간 경기 엔진
 * 좌표: x 0..105 (골라인), y 0..68 (터치라인), 단위 m
 * 공격 좌표(u,v): 각 팀 기준 자기 골문 u=0, 상대 골문 u=105. dir=-1 이면 좌우/상하 반전(자기역함수).
 */
(function (KM) {
  'use strict';

  const L = 105, W = 68, CY = W / 2, GH = 3.66;
  const DT = 0.05;
  const MATCH_T = 540; // 실제 플레이 시뮬레이션 시간(초) — 시계는 90분으로 환산
  const HALF_T = MATCH_T / 2;
  const FRIC = 0.75;
  const SHOT_FRIC = 0.25;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const hyp = (x, y) => Math.sqrt(x * x + y * y);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  const J = (w, a, b) => KM.josa(w, a, b);

  // 카드/특성 효과용 모디파이어. 기본값은 모두 '효과 없음'
  const MUL_KEYS = ['all', 'sho', 'pas', 'dri', 'def', 'gk', 'spd', 'finish', 'concede', 'passErr', 'foul', 'drain'];
  const ADD_KEYS = ['desire', 'range', 'prog', 'box', 'tackle', 'line', 'intercept', 'counter', 'mfRun'];
  function neutralMods() {
    const m = { press: -1, boost: {} };
    for (const k of MUL_KEYS) m[k] = 1;
    for (const k of ADD_KEYS) m[k] = 0;
    return m;
  }
  function mergeMods(m, add) {
    if (!add) return m;
    for (const k of MUL_KEYS) if (add[k] != null) m[k] *= add[k];
    for (const k of ADD_KEYS) if (add[k] != null) m[k] += add[k];
    if (add.press != null) m.press = Math.max(m.press, add.press);
    if (add.boost) for (const id in add.boost) m.boost[id] = (m.boost[id] || 1) * add.boost[id];
    return m;
  }
  KM.neutralMods = neutralMods;

  const CORNER_ATK = [[95, 30], [97, 37], [93, 39], [99, 33], [91, 27], [88, 44]];
  const CORNER_DEF = [[3, 31], [4, 38], [7, 33], [8, 27], [6, 41], [10, 36], [12, 30], [12, 42], [16, 34]];

  class Match {
    /**
     * setup: { name, short, kit:[fill,text], gkKit, tactic:{formation, mentality(-1..1), press(0..2)},
     *          players:[11 선수(포메이션 슬롯 순)], bench:[...], aiSubs:boolean }
     */
    constructor(home, away, opts = {}) {
      this.onEvent = opts.onEvent || null;
      this.T = opts.length || MATCH_T;
      this.HT = this.T / 2;
      this.effects = [];
      this._nextExpiry = Infinity;
      this.t = 0;
      this.half = 1;
      this.finished = false;
      this.events = [];
      this.goals = [];
      this.teams = [this._mkTeam(home, 0), this._mkTeam(away, 1)];
      this._rebuild();
      this.ball = { x: L / 2, y: CY, vx: 0, vy: 0, owner: null, lastTeam: 0, lastTouch: null, passFrom: null, intended: null, shot: null, tried: new Set() };
      this.restart = null;
      this.firstKick = Math.random() < 0.5 ? 0 : 1;
      this.subTimer = 0;
      this._setupKickoff(this.firstKick, true);
      this._emit('whistle', '주심의 휘슬과 함께 경기가 시작됩니다!', -1);
    }

    // ---------- 설정 ----------
    _mkTeam(s, idx) {
      const tm = {
        idx, name: s.name, short: s.short, kit: s.kit, gkKit: s.gkKit,
        dir: idx === 0 ? 1 : -1,
        tactic: Object.assign({ formation: '4-4-2', mentality: 0, press: 1 }, s.tactic || {}),
        score: 0, subsLeft: 5, aiSubs: !!s.aiSubs, aiSubsDone: 0,
        onPitch: [], bench: (s.bench || []).slice(), used: [], sentOff: [], lastPasser: null,
        st: { poss: 0, shots: 0, onT: 0, passes: 0, passOk: 0, fouls: 0, corners: 0, yellows: 0, reds: 0, tackles: 0, saves: 0 },
        traits: s.mods || null, mods: mergeMods(neutralMods(), s.mods), autoSaves: 0, counterUntil: -1,
      };
      const form = KM.FORMATIONS[tm.tactic.formation] || KM.FORMATIONS['4-4-2'];
      s.players.forEach((pd, i) => tm.onPitch.push(this._mkPlayer(pd, tm, form[i])));
      return tm;
    }

    _mkPlayer(pd, tm, slot) {
      return {
        id: pd.id, name: pd.name, num: pd.num, pos: pd.pos, a: pd.a, ovr: pd.ovr || 60, team: tm.idx,
        role: slot[0], baseU: slot[1], baseV: slot[2], fit: KM.roleFit(pd.pos, slot[0]),
        energy: pd.cond != null ? pd.cond : 100,
        x: L / 2, y: CY, vx: 0, vy: 0, tx: L / 2, ty: CY, urg: 0, hx: 0, hy: 0,
        decideCd: 0, tackleCd: 0, kickCd: 0, drX: 1, drY: 0, forcePass: null, runOff: rnd(-6, 4),
        t0: this.t, t1: null,
        s: { goals: 0, assists: 0, shots: 0, onT: 0, passes: 0, passOk: 0, tackles: 0, ints: 0, saves: 0, fouls: 0, yellow: 0, red: 0, conceded: 0 },
      };
    }

    _rebuild() { this.all = this.teams[0].onPitch.concat(this.teams[1].onPitch); }

    // ---------- 유틸 ----------
    U(tm, x) { return tm.dir === 1 ? x : L - x; }
    V(tm, y) { return tm.dir === 1 ? y : W - y; }
    eff(p, k) {
      const m = this.teams[p.team].mods;
      return p.a[k] * p.fit * (0.72 + 0.28 * p.energy / 100) * m.all * (m[k] || 1) * (m.boost[p.id] || 1);
    }
    maxSpd(p) {
      const m = this.teams[p.team].mods;
      return (5.4 + p.a.pac * 0.03) * (0.7 + 0.3 * p.energy / 100) * m.spd * (m.boost[p.id] ? Math.min(1.12, m.boost[p.id]) : 1);
    }
    pressOf(tm) { return Math.max(tm.tactic.press, tm.mods.press); }
    gkOf(tm) { return tm.onPitch.find((p) => p.role === 'GK') || null; }
    nearestOpp(p) {
      const opp = this.teams[1 - p.team].onPitch;
      let best = null, bd = 1e9;
      for (const o of opp) { const d = hyp(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
      return [bd, best];
    }
    gameSec() { return this.t / this.T * 5400; }
    minute() {
      const m = Math.floor(this.gameSec() / 60) + 1;
      return this.half === 1 ? Math.min(m, 45) : Math.min(Math.max(m, 46), 90);
    }
    clock() {
      let gs = this.gameSec();
      let extra = false;
      if (this.half === 1 && gs >= 2700) { gs = 2700; extra = true; }
      if (this.half === 2 && gs >= 5400) { gs = 5400; extra = true; }
      if (this.finished) { gs = 5400; extra = false; }
      const mm = Math.floor(gs / 60), ss = Math.floor(gs % 60);
      return String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0') + (extra ? '+' : '');
    }
    _emit(type, text, team, extra) {
      const ev = Object.assign({ type, text, team, min: this.minute(), t: this.t }, extra || {});
      this.events.push(ev);
      if (this.onEvent) this.onEvent(ev, this);
    }

    // ---------- 외부 API ----------
    setTactic(teamIdx, obj) {
      const tm = this.teams[teamIdx];
      if (obj.mentality != null) tm.tactic.mentality = obj.mentality;
      if (obj.press != null) tm.tactic.press = obj.press;
    }

    substitute(teamIdx, outId, inId) {
      const tm = this.teams[teamIdx];
      if (tm.subsLeft <= 0 || this.finished) return false;
      const i = tm.onPitch.findIndex((p) => p.id === outId);
      const j = tm.bench.findIndex((p) => p.id === inId);
      if (i < 0 || j < 0) return false;
      const out = tm.onPitch[i];
      const np = this._mkPlayer(tm.bench[j], tm, [out.role, out.baseU, out.baseV]);
      Object.assign(np, { x: out.x, y: out.y, tx: out.tx, ty: out.ty, hx: out.hx, hy: out.hy });
      out.t1 = this.t;
      tm.used.push(out);
      tm.onPitch[i] = np;
      tm.bench.splice(j, 1);
      tm.subsLeft--;
      const b = this.ball;
      if (b.owner === out) b.owner = np;
      if (b.intended === out) b.intended = np;
      if (b.passFrom === out) b.passFrom = null;
      if (tm.lastPasser && tm.lastPasser.p === out) tm.lastPasser = null;
      if (this.restart && this.restart.taker === out) this.restart.taker = np;
      if (this.kicker === out) this.kicker = np;
      this._rebuild();
      this._emit('sub', `🔁 ${tm.name} 교체: ${out.name} ➜ ${np.name}`, teamIdx);
      return true;
    }

    /** 카드 효과 추가. eff = { label, icon, mods, min(지속 경기 시간, 분) } */
    addEffect(teamIdx, eff) {
      const e = Object.assign({ team: teamIdx, until: this.t + (eff.min || 10) / 90 * this.T }, eff);
      this.effects.push(e);
      this._recomputeMods();
      return e;
    }
    _recomputeMods() {
      this._nextExpiry = Infinity;
      this.effects = this.effects.filter((e) => e.until > this.t);
      for (const tm of this.teams) tm.mods = mergeMods(neutralMods(), tm.traits);
      for (const e of this.effects) {
        mergeMods(this.teams[e.team].mods, e.mods);
        if (e.until < this._nextExpiry) this._nextExpiry = e.until;
      }
    }
    canAct() { return !this.finished && (this.mode === 'play' || this.mode === 'restart') && !this.ball.shot; }
    bestBy(teamIdx, k) {
      let best = null;
      for (const p of this.teams[teamIdx].onPitch) if (p.role !== 'GK' && (!best || p.a[k] > best.a[k])) best = p;
      return best;
    }
    awardSetPiece(teamIdx, type) {
      if (!this.canAct()) return false;
      const tm = this.teams[teamIdx];
      const taker = this.bestBy(teamIdx, 'sho');
      if (type === 'penalty') {
        this._restart('penalty', teamIdx, this.U(tm, L - 11), this.V(tm, CY), taker);
      } else {
        const u = rnd(80, 85), v = CY + rnd(-9, 9);
        this._restart('free', teamIdx, this.U(tm, u), this.V(tm, v), taker);
        this.restart.direct = true;
      }
      return true;
    }
    restoreEnergy(teamIdx, amount) {
      for (const p of this.teams[teamIdx].onPitch) p.energy = Math.min(100, p.energy + amount);
    }

    advance(simSec) {
      const n = Math.round(simSec / DT);
      for (let i = 0; i < n && !this.finished; i++) this.step();
    }

    runToEnd() {
      let guard = 0;
      while (!this.finished && guard++ < 40000) this.step();
    }

    // ---------- 메인 루프 ----------
    step() {
      if (this.finished) return;
      if (this.mode !== 'halftime') this.t += DT;
      if (this.t >= this._nextExpiry) this._recomputeMods();
      for (const p of this.all) {
        if (p.kickCd > 0) p.kickCd -= DT;
        if (p.tackleCd > 0) p.tackleCd -= DT;
      }
      switch (this.mode) {
        case 'kickoff': this._modeKickoff(); break;
        case 'goal': this._modeGoal(); break;
        case 'halftime': this._modeHalftime(); break;
        case 'restart': this._modeRestart(); break;
        default: this._modePlay();
      }
      this._aiSubs();
      const penPending = this.mode === 'restart' && this.restart && this.restart.type === 'penalty';
      if ((this.mode === 'play' || this.mode === 'restart') && !this.ball.shot && !penPending) {
        if (this.half === 1 && this.t >= this.HT) this._startHalftime();
        else if (this.half === 2 && this.t >= this.T) this._finish();
      }
    }

    _modePlay() {
      const b = this.ball;
      const possTeam = b.owner ? b.owner.team : b.lastTeam;
      this.teams[possTeam].st.poss += DT;
      this._computeTargets(possTeam);
      if (b.owner) this._carrier(b.owner);
      this._move();
      this._updateBall();
      if (this.mode === 'play' && b.owner) this._tackles();
    }

    // ---------- 킥오프 / 골 / 하프타임 ----------
    _setupKickoff(teamIdx, teleport) {
      this.mode = 'kickoff';
      this.timer = teleport ? 1.2 : 2.0;
      this.kickTeam = teamIdx;
      this.restart = null;
      const b = this.ball;
      Object.assign(b, { x: L / 2, y: CY, vx: 0, vy: 0, owner: null, shot: null, passFrom: null, intended: null, lastTeam: teamIdx });
      this._setHold(teamIdx, teleport);
    }

    _setHold(kickTeam, teleport) {
      for (const tm of this.teams) {
        let kicker = null;
        if (tm.idx === kickTeam) {
          const cands = tm.onPitch.filter((p) => p.role !== 'GK');
          cands.sort((a, b) => (b.baseU - a.baseU) || (Math.abs(a.baseV - CY) - Math.abs(b.baseV - CY)));
          kicker = cands[0] || tm.onPitch[0];
          this.kicker = kicker;
        }
        for (const p of tm.onPitch) {
          let u = Math.min(p.baseU * 0.85, 47), v = p.baseV;
          if (tm.idx !== kickTeam) u = Math.min(u, 42);
          if (p.role === 'GK') u = 3;
          if (p === kicker) { u = 51.8; v = CY; }
          p.hx = this.U(tm, u); p.hy = this.V(tm, v);
          if (teleport) { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; }
        }
      }
    }

    _holdTargets() {
      for (const p of this.all) { p.tx = p.hx; p.ty = p.hy; p.urg = 0.6; }
    }

    _modeKickoff() {
      this.timer -= DT;
      this._holdTargets();
      this._move();
      if (this.timer <= 0) {
        const p = this.kicker;
        if (!p || !this.teams[this.kickTeam].onPitch.includes(p)) { this._setHold(this.kickTeam, false); }
        const k = this.kicker;
        const tm = this.teams[k.team];
        k.x = L / 2 - 0.8 * tm.dir; k.y = CY; k.vx = k.vy = 0;
        this.mode = 'play';
        this._take(k);
        k.decideCd = 0.25;
      }
    }

    _modeGoal() {
      this.timer -= DT;
      const b = this.ball;
      const f = Math.exp(-2.5 * DT);
      b.x += b.vx * DT; b.y += b.vy * DT; b.vx *= f; b.vy *= f;
      b.x = clamp(b.x, -1.8, L + 1.8); b.y = clamp(b.y, CY - GH + 0.2, CY + GH - 0.2);
      this._holdTargets();
      this._move();
      if (this.timer <= 0) this._setupKickoff(this.concedeTeam, false);
    }

    _startHalftime() {
      this.mode = 'halftime';
      this.timer = 1.5;
      const [h, a] = this.teams;
      this._emit('half', `전반전 종료 — ${h.name} ${h.score} : ${a.score} ${a.name}`, -1);
    }

    _modeHalftime() {
      this.timer -= DT;
      if (this.timer <= 0) {
        this.half = 2;
        this.t = Math.max(this.t, this.HT);
        for (const tm of this.teams) {
          tm.dir = -tm.dir;
          for (const p of tm.onPitch) p.energy = Math.min(100, p.energy + 6);
        }
        this._setupKickoff(1 - this.firstKick, true);
        this._emit('whistle', '후반전이 시작됩니다!', -1);
      }
    }

    _finish() {
      this.finished = true;
      this.mode = 'full';
      for (const tm of this.teams) for (const p of tm.onPitch) p.t1 = this.t;
      const [h, a] = this.teams;
      this._emit('full', `경기 종료! ${h.name} ${h.score} : ${a.score} ${a.name}`, -1);
    }

    // ---------- 포지셔닝 ----------
    _computeTargets(possTeam, shapeOnly) {
      const b = this.ball;
      for (const tm of this.teams) {
        const inPoss = tm.idx === possTeam;
        const bu = this.U(tm, b.x), bv = this.V(tm, b.y);
        const opp = this.teams[1 - tm.idx];
        // 오프사이드 라인(상대 뒤에서 두 번째 선수)
        let m1 = 0, m2 = 0;
        const oppUV = [];
        for (const o of opp.onPitch) {
          const ou = this.U(tm, o.x), ov = this.V(tm, o.y);
          oppUV.push([ou, ov]);
          if (ou > m1) { m2 = m1; m1 = ou; } else if (ou > m2) m2 = ou;
        }
        const line = Math.max(52.5, m2, bu);
        const ment = tm.tactic.mentality;
        const counter = inPoss && this.t < tm.counterUntil;
        for (const p of tm.onPitch) {
          if (p === b.owner) continue;
          let u, v;
          p.urg = 0.6;
          if (p.role === 'GK') {
            u = clamp(2.5 + (bu - 20) * 0.1, 1.5, 15);
            v = CY + (bv - CY) * (bu < 30 ? 0.35 : 0.18);
          } else {
            const sh = (bu - 52.5) * 0.48;
            u = p.baseU + sh + (inPoss ? 6 : -4) + ment * 4 + tm.mods.line;
            const lo = p.role === 'DF' ? 6 : p.role === 'MF' ? 14 : 28;
            u = Math.max(u, lo);
            if (inPoss) {
              v = CY + (p.baseV - CY) * 1.12 + (bv - CY) * 0.22;
              u = Math.min(u, line - 0.7);
              if (p.role === 'FW' && bu > 60) u = Math.min(Math.max(u, bu - 4), line - 0.7);
              // 미드필더 2선 침투
              if (p.role === 'MF' && bu > 60) u = Math.min(Math.max(u, bu - 9 - Math.abs(p.baseV - CY) * 0.15 + p.runOff + tm.mods.mfRun), line - 0.7);
              if (counter && p.role !== 'DF') { u = Math.min(u + 12, line - 0.7); p.urg = 1; }
            } else {
              v = p.baseV + (bv - CY) * 0.38;
              if (p.role === 'DF') u = Math.min(u, Math.max(bu - 3, 6));
              if (p.role !== 'FW') {
                // 가까운 공격수 마크
                let md = 9, mk = null;
                for (const o of oppUV) { const d = hyp(o[0] - u, o[1] - v); if (d < md) { md = d; mk = o; } }
                if (mk) { u = u * 0.45 + (mk[0] - 2) * 0.55; v = v * 0.45 + mk[1] * 0.55; }
              }
            }
          }
          p.tx = this.U(tm, clamp(u, 1, L - 1));
          p.ty = this.V(tm, clamp(v, 1.5, W - 1.5));
        }
      }

      if (shapeOnly) return;
      if (b.shot) {
        const dtm = this.teams[1 - b.shot.team];
        const g = this.gkOf(dtm);
        if (g) { const ip = this._intercept(g); g.tx = ip[0]; g.ty = ip[1]; g.urg = 1; }
        return;
      }

      if (b.owner) {
        const c = b.owner;
        const dtm = this.teams[1 - c.team];
        const du = this.U(dtm, c.x);
        const press = this.pressOf(dtm);
        const field = dtm.onPitch.filter((p) => p.role !== 'GK');
        field.sort((a, b2) => hyp(a.x - c.x, a.y - c.y) - hyp(b2.x - c.x, b2.y - c.y));
        const reach = press === 0 ? 55 : press === 1 ? 72 : press === 2 ? 110 : 140;
        const gs = this.U(dtm, 0) === 0 ? -1 : 1; // 자기 골 방향(월드 x)
        for (let i = 0; i < field.length && i < 2; i++) {
          const p = field[i];
          const d = hyp(p.x - c.x, p.y - c.y);
          const go = i === 0 ? (du < reach || d < 10) : (press >= 1 && d < (press >= 3 ? 24 : press === 2 ? 16 : 9));
          if (!go) continue;
          p.tx = c.x + gs * 0.8 + c.vx * 0.25;
          p.ty = c.y + c.vy * 0.25;
          p.urg = 1;
        }
        // 골키퍼 각 좁히기
        const g = this.gkOf(dtm);
        if (g && du < 17 && Math.abs(this.V(dtm, c.y) - CY) < 20) {
          const gu = clamp(du * 0.4, 1, 8), gv = CY + (this.V(dtm, c.y) - CY) * 0.5;
          g.tx = this.U(dtm, gu); g.ty = this.V(dtm, gv); g.urg = 1;
        }
      } else {
        // 루즈볼: 각 팀에서 가장 빨리 닿는 선수 + 패스 받는 선수
        for (const tm of this.teams) {
          let best = null, bt = 1e9, bp = null;
          for (const p of tm.onPitch) {
            if (p.kickCd > 0) continue;
            if (p.role === 'GK' && this.U(tm, b.x) > 18) continue;
            const ip = this._intercept(p);
            if (ip[2] < bt) { bt = ip[2]; best = p; bp = ip; }
          }
          if (best) { best.tx = bp[0]; best.ty = bp[1]; best.urg = 1; }
        }
        if (b.intended) {
          const ip = this._intercept(b.intended);
          b.intended.tx = ip[0]; b.intended.ty = ip[1]; b.intended.urg = 1;
        }
      }
    }

    _intercept(p) {
      const b = this.ball;
      const k = b.shot ? SHOT_FRIC : FRIC;
      const sp = this.maxSpd(p);
      for (let t = 0.1; t <= 3.01; t += 0.1) {
        const f = (1 - Math.exp(-k * t)) / k;
        const bx = b.x + b.vx * f, by = b.y + b.vy * f;
        if (hyp(bx - p.x, by - p.y) <= sp * t + 0.7) return [bx, by, t];
      }
      const f = (1 - Math.exp(-k * 3)) / k;
      const bx = b.x + b.vx * f, by = b.y + b.vy * f;
      return [bx, by, 3 + hyp(bx - p.x, by - p.y) / sp];
    }

    _move() {
      const owner = this.ball.owner;
      for (const tm of this.teams) {
        const ps = tm.onPitch;
        const pressCost = (1 + this.pressOf(tm) * 0.1) * tm.mods.drain;
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          const dx = p.tx - p.x, dy = p.ty - p.y, d = hyp(dx, dy);
          let ms = this.maxSpd(p);
          if (p === owner) ms *= 0.74 + this.eff(p, 'dri') / 100 * 0.16;
          let want = p.urg >= 1 ? ms : Math.min(ms * (d > 12 ? 0.9 : 0.72), d * 1.1);
          if (d < 0.25) want = 0;
          let dvx = d > 0 ? dx / d * want : 0, dvy = d > 0 ? dy / d * want : 0;
          if (p !== owner) {
            for (let j = 0; j < ps.length; j++) {
              if (i === j) continue;
              const q = ps[j];
              const sx = p.x - q.x, sy = p.y - q.y, sd = hyp(sx, sy);
              if (sd < 2.4 && sd > 0.001) { const f = (2.4 - sd) * 1.6 / sd; dvx += sx * f; dvy += sy * f; }
            }
          }
          let ax = dvx - p.vx, ay = dvy - p.vy;
          const am = hyp(ax, ay), lim = 9 * DT;
          if (am > lim) { ax *= lim / am; ay *= lim / am; }
          p.vx += ax; p.vy += ay;
          p.x = clamp(p.x + p.vx * DT, -3, L + 3);
          p.y = clamp(p.y + p.vy * DT, -2, W + 2);
          const s2 = p.vx * p.vx + p.vy * p.vy;
          p.energy = Math.max(5, p.energy - DT * (0.006 + s2 * 0.0024) * (1.3 - p.a.phy / 100 * 0.6) * pressCost);
        }
      }
    }

    // ---------- 공 가진 선수 ----------
    _carrier(p) {
      p.decideCd -= DT;
      if (p.decideCd <= 0) {
        this._decide(p);
        if (this.ball.owner !== p) return;
      }
      if (p.role === 'GK') { p.tx = p.x; p.ty = p.y; p.urg = 0; return; }
      p.tx = p.x + p.drX * 6;
      p.ty = p.y + p.drY * 6;
      p.urg = 1;
    }

    _decide(p) {
      const tm = this.teams[p.team], opp = this.teams[1 - p.team];
      const u = this.U(tm, p.x), v = this.V(tm, p.y);
      const [press] = this.nearestOpp(p);
      const ment = tm.tactic.mentality;
      const forced = p.forcePass;
      p.forcePass = null;
      p.decideCd = rnd(0.3, 0.7) * (1.15 - this.eff(p, 'pas') / 300);
      const dG = hyp(L - u, CY - v);
      const mods = tm.mods;
      const reachG = 32 + mods.range;

      if (!forced && p.role !== 'GK' && u > 72 - mods.range && dG < reachG) {
        const ang = Math.abs(v - CY) / Math.max(dG, 1);
        let desire = Math.pow(clamp((reachG - dG) / 24, 0, 1), 1.7) * (0.5 + this.eff(p, 'sho') / 160) * clamp(1 - ang * 0.7, 0.2, 1);
        desire += ment * 0.05 + mods.desire;
        if (dG < 11) desire += 0.3;
        if (Math.random() < desire * 0.65) { this._shoot(p, u, v, dG, press); return; }
      }

      // 위험 지역 걷어내기
      if (!forced && p.role !== 'GK' && u < 18 && press < 1.8 && Math.random() < 0.55) { this._clear(p, u, v); return; }

      const maxD = forced === 'throw' ? 24 : p.role === 'GK' ? 55 : 26 + this.eff(p, 'pas') * 0.22;
      let best = null, bestS = -99, nearest = null, nd = 1e9;
      const progW = 0.055 + mods.prog + (this.t < tm.counterUntil ? 0.035 : 0);
      for (const q of tm.onPitch) {
        if (q === p) continue;
        const d = hyp(q.x - p.x, q.y - p.y);
        if (d < nd) { nd = d; nearest = q; }
        if (d < 4 || d > maxD) continue;
        const qu = this.U(tm, q.x), qv = this.V(tm, q.y);
        const lane = this._laneSafety(p, q, opp);
        const open = clamp(this.nearestOpp(q)[0] / 7, 0, 1);
        const prog = qu - u;
        let s = (prog > 0 ? prog * progW : prog * 0.09) * (1 + ment * 0.25) + lane * 1.0 + open * 0.7 - d * 0.01;
        if (qu > 87 && Math.abs(qv - CY) < 19) s += 0.35 + ment * 0.1 + mods.box;
        if (q.role === 'GK') s -= 0.8;
        if (forced === 'corner') s += (qu > 86 && Math.abs(qv - CY) < 19) ? 2 : -2;
        s += rnd(-0.18, 0.18);
        if (s > bestS) { bestS = s; best = q; }
      }

      let drib = 0.9 + (this.eff(p, 'dri') - 60) / 80 + clamp((press - 2) / 4, 0, 1.0) - (u < 30 ? 0.35 : 0) + ment * 0.1 + (this._spaceAhead(p, tm) > 8 ? 0.4 : 0);
      if (p.role === 'GK' || forced) drib = -50;
      if (best && (bestS > drib || (press < 1.6 && bestS > drib - 0.5))) { this._pass(p, best); return; }
      if (forced && nearest) { this._pass(p, nearest); return; }
      if (p.role === 'GK') { this._clear(p, u, v); return; }
      this._setDribble(p, u, v);
    }

    _spaceAhead(p, tm) {
      let m = 99;
      for (const o of this.teams[1 - p.team].onPitch) {
        const du = (o.x - p.x) * tm.dir, dv = Math.abs(o.y - p.y);
        if (du > 0 && dv < du * 0.9 + 2) { const d = hyp(o.x - p.x, o.y - p.y); if (d < m) m = d; }
      }
      return m;
    }

    _laneSafety(p, q, opp) {
      const ax = p.x, ay = p.y, bx = q.x - ax, by = q.y - ay;
      const ll = bx * bx + by * by || 1;
      let m = 99;
      for (const o of opp.onPitch) {
        const t = ((o.x - ax) * bx + (o.y - ay) * by) / ll;
        if (t < 0.05 || t > 1.08) continue;
        const px = ax + bx * t, py = ay + by * t;
        const d = hyp(o.x - px, o.y - py) - t * 1.2; // 멀리 있는 선수는 더 쉽게 차단
        if (d < m) m = d;
      }
      return clamp((m + 0.5) / 4, 0, 1);
    }

    _setDribble(p, u, v) {
      const tm = this.teams[p.team];
      let gu = L - u, gv = CY - v;
      if (u > 94) { gu = (L - 8) - u; gv = CY - v; }
      let n = hyp(gu, gv) || 1; gu /= n; gv /= n;
      const [d, o] = this.nearestOpp(p);
      if (o && d < 7) {
        const ou = this.U(tm, o.x) - u, ov = this.V(tm, o.y) - v;
        if (ou * gu + ov * gv > 0) {
          let px = -gv, py = gu;
          if (px * ou + py * ov > 0) { px = -px; py = -py; }
          const w = (7 - d) / 7 * 1.3;
          gu += px * w; gv += py * w;
          n = hyp(gu, gv) || 1; gu /= n; gv /= n;
        }
      }
      if (v < 4 && gv < 0) gv = 0.4;
      if (v > W - 4 && gv > 0) gv = -0.4;
      if (u > L - 3 && gu > 0) gu = -0.2;
      n = hyp(gu, gv) || 1;
      p.drX = gu / n * tm.dir;
      p.drY = gv / n * tm.dir;
    }

    _kick(p, vx, vy) {
      const b = this.ball;
      b.owner = null;
      b.vx = vx; b.vy = vy;
      b.lastTeam = p.team; b.lastTouch = p;
      b.tried = new Set([p]);
      b.shot = null; b.passFrom = null; b.intended = null;
      p.kickCd = 0.4;
    }

    _pass(p, q) {
      const tm = this.teams[p.team];
      const d0 = hyp(q.x - p.x, q.y - p.y);
      const lead = clamp(d0 / 18, 0.2, 1.2);
      const tx = q.x + q.vx * lead, ty = q.y + q.vy * lead;
      const [press] = this.nearestOpp(p);
      const err = ((1 - this.eff(p, 'pas') / 110) * 0.16 + (press < 2 ? 0.05 : 0)) * tm.mods.passErr;
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy);
      const ang = Math.atan2(dy, dx) + gauss() * err;
      const spd = clamp(d * FRIC + 7, 9, 31) * rnd(0.93, 1.07);
      this._kick(p, Math.cos(ang) * spd, Math.sin(ang) * spd);
      this.ball.passFrom = p;
      this.ball.intended = q;
      p.s.passes++; tm.st.passes++;
    }

    _clear(p, u, v) {
      const tm = this.teams[p.team];
      const tu = clamp(u + rnd(35, 50), 30, 95), tv = clamp(v + rnd(-18, 18), 4, W - 4);
      const tx = this.U(tm, tu), ty = this.V(tm, tv);
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy) || 1;
      const spd = clamp(d * FRIC + 6, 18, 33);
      this._kick(p, dx / d * spd, dy / d * spd);
      this.ball.passFrom = p;
      p.s.passes++; tm.st.passes++;
    }

    _shoot(p, u, v, dG, press, pen) {
      const tm = this.teams[p.team], opp = this.teams[1 - p.team];
      const g = this.gkOf(opp);
      let pGoal, pOn;
      if (pen) {
        pGoal = clamp(0.64 + this.eff(p, 'sho') / 100 * 0.2 - (g ? this.eff(g, 'gk') / 100 * 0.14 : 0), 0.5, 0.9);
        pOn = 0.93;
      } else {
        const ang = Math.abs(v - CY) / Math.max(dG, 1);
        const xg = 1.35 * Math.exp(-dG / 7.6) * clamp(1 - ang * 0.9, 0.25, 1);
        const sf = 0.7 + this.eff(p, 'sho') / 100 * 0.6;
        const gf = g ? 1.35 - this.eff(g, 'gk') / 100 * 0.65 : 1.8;
        const pf = press < 1.5 ? 0.7 : press < 3 ? 0.88 : 1;
        pGoal = clamp(xg * sf * gf * pf, 0.01, 0.85);
        pOn = clamp(0.3 + this.eff(p, 'sho') / 100 * 0.4 - dG * 0.007, 0.18, 0.8);
      }
      pGoal = clamp(pGoal * tm.mods.finish * opp.mods.concede, 0.01, pen ? 0.97 : 0.9);
      pOn = Math.max(pOn, pGoal + 0.04);
      const r = Math.random();
      let outcome = r < pGoal ? 'goal' : r < pOn ? 'saved' : 'miss';
      if (outcome === 'saved' && !g) outcome = 'goal';
      if (outcome === 'goal' && g && opp.autoSaves > 0) {
        opp.autoSaves--;
        outcome = 'saved';
        this._emit('card', `🧤 ${g.name}, 카드 효과로 결정적인 슈팅을 막아냅니다!`, opp.idx);
      }
      if (!pen && outcome !== 'goal' && Math.random() < (press < 2.5 ? 0.45 : 0.15)) {
        const [, blk] = this.nearestOpp(p);
        if (blk && blk.role !== 'GK') { this._block(p, blk, tm); return; }
      }
      let tv;
      if (outcome === 'goal') tv = CY + (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, GH - 0.35);
      else if (outcome === 'saved') tv = clamp(this.V(tm, g.y) + rnd(-1.4, 1.4), CY - GH + 0.3, CY + GH - 0.3);
      else tv = CY + (Math.random() < 0.5 ? -1 : 1) * rnd(GH + 0.8, GH + 7);
      const tx = this.U(tm, L + 1), ty = this.V(tm, tv);
      const dx = tx - p.x, dy = ty - p.y, d = hyp(dx, dy) || 1;
      const spd = 22 + this.eff(p, 'sho') / 12;
      this._kick(p, dx / d * spd, dy / d * spd);
      this.ball.shot = { outcome, p, team: p.team, gk: g, pen: !!pen };
      p.s.shots++; tm.st.shots++;
      if (outcome !== 'miss') { p.s.onT++; tm.st.onT++; }
    }

    _block(p, blk, tm) {
      p.s.shots++; tm.st.shots++;
      // 수비 몸에 맞고 굴절 → 대개 골라인/측면으로
      const vx = tm.dir * rnd(8, 15), vy = (Math.random() < 0.5 ? -1 : 1) * rnd(3, 10);
      this._kick(blk, vx, vy);
      blk.kickCd = 0.3;
      this.ball.tried.add(p);
      p.kickCd = 0.3;
      blk.s.tackles++;
      this._emit('block', pick([
        `${p.name}의 슈팅! ${J(blk.name, '이', '가')} 몸을 날려 막아냅니다.`,
        `${p.name}의 슈팅이 ${blk.name}의 몸에 맞고 굴절됩니다!`,
      ]), blk.team);
    }

    // ---------- 공 ----------
    _updateBall() {
      const b = this.ball;
      if (b.owner) {
        const o = b.owner, s = hyp(o.vx, o.vy);
        let fx, fy;
        if (s > 0.4) { fx = o.vx / s; fy = o.vy / s; } else { fx = this.teams[o.team].dir; fy = 0; }
        b.x = o.x + fx * 0.65; b.y = o.y + fy * 0.65; b.vx = o.vx; b.vy = o.vy;
      } else {
        const f = Math.exp(-(b.shot ? SHOT_FRIC : FRIC) * DT);
        b.x += b.vx * DT; b.y += b.vy * DT; b.vx *= f; b.vy *= f;
        if (b.shot) this._shotFlight(); else this._pickups();
      }
      if (this.mode === 'play') this._bounds();
    }

    _pickups() {
      const b = this.ball, bs = hyp(b.vx, b.vy);
      for (const p of this.all) {
        if (p.kickCd > 0) continue;
        if (hyp(p.x - b.x, p.y - b.y) > 1.15) continue;
        if (bs >= 3.5 && b.tried.has(p)) continue;
        b.tried.add(p);
        const tm = this.teams[p.team];
        let pr;
        if (bs < 3.5) pr = 1;
        else if (p === b.intended) pr = clamp(0.82 + this.eff(p, 'dri') / 600 - (bs > 22 ? 0.12 : 0), 0.5, 0.98);
        else if (p.team === b.lastTeam) pr = 0.75;
        else pr = clamp(0.3 + this.eff(p, 'def') / 100 * 0.5 - (bs > 20 ? 0.12 : 0) + tm.mods.intercept, 0.1, 0.9);
        if (p.role === 'GK' && this.U(tm, b.x) < 16.5 && Math.abs(this.V(tm, b.y) - CY) < 20) pr = Math.max(pr, 0.85);
        if (Math.random() < pr) { this._take(p); return; }
      }
    }

    _take(p) {
      const b = this.ball, tm = this.teams[p.team];
      if (b.lastTeam !== p.team) {
        this.teams[0].lastPasser = null; this.teams[1].lastPasser = null;
        if (tm.mods.counter > 0 && this.mode === 'play') tm.counterUntil = this.t + 6 * tm.mods.counter;
      }
      if (b.passFrom) {
        if (b.passFrom.team === p.team) {
          b.passFrom.s.passOk++; tm.st.passOk++;
          tm.lastPasser = { p: b.passFrom, t: this.t };
        } else p.s.ints++;
      }
      b.owner = p; b.lastTeam = p.team; b.lastTouch = p;
      b.passFrom = null; b.intended = null; b.shot = null;
      p.decideCd = rnd(0.12, 0.35);
      this._setDribble(p, this.U(tm, p.x), this.V(tm, p.y));
    }

    _shotFlight() {
      const b = this.ball, sh = b.shot;
      if (sh.outcome !== 'saved' || !sh.gk) return;
      const g = sh.gk;
      const atk = this.teams[sh.team];
      if (hyp(g.x - b.x, g.y - b.y) < 1.8 || this.U(atk, b.x) >= L - 0.4) {
        const gtm = this.teams[g.team];
        g.s.saves++; gtm.st.saves++;
        if (Math.random() < 0.45 + this.eff(g, 'gk') / 300) {
          this._emit('save', pick([
            `${J(g.name, '이', '가')} ${sh.p.name}의 슈팅을 잡아냅니다!`,
            `${g.name}의 안정적인 캐칭! ${sh.p.name}의 슈팅은 막힙니다.`,
            `${sh.p.name}의 슈팅! 하지만 ${J(g.name, '이', '가')} 침착하게 막아냅니다.`,
          ]), g.team);
          b.shot = null;
          this._take(g);
          g.decideCd = rnd(1.0, 2.0);
        } else {
          this._emit('save', pick([
            `${g.name}의 슈퍼 세이브! ${sh.p.name}의 슈팅을 쳐냅니다!`,
            `${sh.p.name}의 강슛! ${J(g.name, '이', '가')} 몸을 날려 쳐냅니다!`,
          ]), g.team);
          const behind = Math.random() < 0.55;
          b.vx = behind ? -gtm.dir * rnd(5, 9) : gtm.dir * rnd(4, 9);
          b.vy = (Math.random() < 0.5 ? -1 : 1) * rnd(6, 12);
          b.x = g.x + Math.sign(b.vx || gtm.dir) * 0.8;
          b.shot = null; b.owner = null; b.passFrom = null; b.intended = null;
          b.lastTeam = g.team; b.lastTouch = g;
          b.tried = new Set([g]);
          g.kickCd = 0.5;
        }
      }
    }

    _bounds() {
      const b = this.ball;
      if (b.x >= 0 && b.x <= L && (b.y < 0 || b.y > W)) {
        const team = 1 - b.lastTeam;
        this._restart('throw', team, clamp(b.x, 1, L - 1), b.y < 0 ? 0 : W);
        return;
      }
      if (b.x > L || b.x < 0) {
        const atk = this.teams.find((t) => (b.x > L ? t.dir === 1 : t.dir === -1));
        const def = this.teams[1 - atk.idx];
        const sh = b.shot;
        if (sh && sh.team === atk.idx && sh.outcome === 'goal' && Math.abs(b.y - CY) < GH) { this._goal(atk, sh); return; }
        if (sh && sh.outcome === 'miss') {
          this._emit('miss', pick([
            `${sh.p.name}의 슈팅이 골문을 벗어납니다.`,
            `${J(sh.p.name, '이', '가')} 때린 슈팅, 크게 빗나갑니다.`,
            `아깝습니다! ${sh.p.name}의 슈팅이 골대 옆으로 흘러나갑니다.`,
            `${sh.p.name}, 과감한 슈팅! 하지만 골대를 외면합니다.`,
          ]), atk.idx);
        }
        b.owner = null;
        if (b.lastTeam === atk.idx) {
          const gv = b.y < CY ? CY - 9 : CY + 9;
          this._restart('goalkick', def.idx, this.U(def, 5.5), this.V(def, gv), this.gkOf(def));
        } else {
          this._restart('corner', atk.idx, b.x > L ? L - 0.3 : 0.3, b.y < CY ? 0.3 : W - 0.3);
        }
      }
    }

    _goal(atk, sh) {
      const def = this.teams[1 - atk.idx];
      const scorer = sh.p;
      atk.score++;
      scorer.s.goals++;
      let assist = null;
      const lp = atk.lastPasser;
      if (!sh.pen && lp && lp.p !== scorer && this.t - lp.t < 12 && atk.onPitch.includes(lp.p)) { assist = lp.p; assist.s.assists++; }
      for (const p of def.onPitch) p.s.conceded++;
      const min = this.minute();
      this.goals.push({ team: atk.idx, min, scorer: scorer.name, scorerId: scorer.id, assist: assist ? assist.name : null, assistId: assist ? assist.id : null, pen: sh.pen });
      const txt = sh.pen
        ? `⚽ 골!! ${J(scorer.name, '이', '가')} 페널티킥을 성공시킵니다!`
        : pick([`⚽ 골!!! ${scorer.name}의 득점!`, `⚽ ${scorer.name}, 골망을 흔듭니다!`, `⚽ 들어갑니다! ${scorer.name}!`, `⚽ 원더골! ${J(scorer.name, '이', '가')} 해냅니다!`]) + (assist ? ` (도움: ${assist.name})` : '');
      this._emit('goal', txt, atk.idx, { scorer: scorer.name });
      const b = this.ball;
      b.shot = null; b.owner = null;
      this.mode = 'goal';
      this.timer = 3.2;
      this.concedeTeam = def.idx;
      this._setHold(def.idx, false);
    }

    // ---------- 세트피스 ----------
    _restart(type, teamIdx, x, y, taker) {
      const b = this.ball, tm = this.teams[teamIdx];
      Object.assign(b, { owner: null, vx: 0, vy: 0, x, y, shot: null, passFrom: null, intended: null });
      if (!taker) {
        let bd = 1e9;
        for (const p of tm.onPitch) {
          if (p.role === 'GK' && type !== 'goalkick') continue;
          const d = hyp(p.x - x, p.y - y);
          if (d < bd) { bd = d; taker = p; }
        }
      }
      this.restart = { type, team: teamIdx, x, y, taker };
      this.mode = 'restart';
      this.timer = { throw: 1.3, corner: 2.6, goalkick: 2.0, free: 1.8, penalty: 2.8 }[type];
      if (type === 'corner') {
        tm.st.corners++;
        this._emit('corner', `${tm.name}의 코너킥.`, teamIdx);
      }
    }

    _modeRestart() {
      const r = this.restart, b = this.ball;
      this.timer -= DT;
      const tm = this.teams[r.team], opp = this.teams[1 - r.team];
      this._computeTargets(r.team, true);
      if (r.type === 'corner' || r.type === 'penalty') this._setPieceTargets(r, tm, opp);
      // 상대는 9m 거리 유지
      for (const o of opp.onPitch) {
        const dx = o.tx - r.x, dy = o.ty - r.y, d = hyp(dx, dy);
        if (d < 9.15 && r.type !== 'throw') {
          if (d < 0.01) { o.tx += 9.15; continue; }
          o.tx = r.x + dx / d * 9.15; o.ty = r.y + dy / d * 9.15;
        }
      }
      const tk = r.taker;
      if (tk) {
        const bx = r.x - tm.dir * 0.8;
        tk.tx = bx; tk.ty = r.y; tk.urg = 1;
      }
      this._move();
      if (this.timer <= 0 && tk) {
        tk.x = clamp(r.x - tm.dir * 0.7, -1, L + 1); tk.y = clamp(r.y, -1, W + 1); tk.vx = tk.vy = 0;
        this.mode = 'play';
        this.restart = null;
        b.x = r.x; b.y = r.y;
        b.owner = tk; b.lastTeam = tk.team; b.lastTouch = tk; b.passFrom = null; b.intended = null;
        if (r.type === 'penalty') { this._shoot(tk, L - 11, CY, 11, 9, true); return; }
        const u = this.U(tm, tk.x), v = this.V(tm, tk.y);
        if (r.type === 'free') {
          const dG = hyp(L - u, CY - v);
          if (dG < 28 && Math.abs(v - CY) < 16 && (r.direct || Math.random() < 0.45)) {
            this._emit('fk', `${tm.name}, 위협적인 위치의 프리킥! ${J(tk.name, '이', '가')} 직접 노립니다.`, tm.idx);
            this._shoot(tk, u, v, dG + 4, 9);
            return;
          }
        }
        tk.forcePass = r.type === 'throw' ? 'throw' : r.type === 'corner' ? 'corner' : null;
        this._decide(tk);
      } else if (this.timer <= 0) {
        this.mode = 'play'; this.restart = null;
      }
    }

    _setPieceTargets(r, tm, opp) {
      if (r.type === 'corner') {
        const atk = tm.onPitch.filter((p) => p.role !== 'GK' && p !== r.taker)
          .sort((a, b) => b.baseU - a.baseU);
        atk.forEach((p, i) => {
          if (i < CORNER_ATK.length) { const s = CORNER_ATK[i]; p.tx = this.U(tm, s[0]); p.ty = this.V(tm, s[1]); }
          else { p.tx = this.U(tm, 62); p.ty = this.V(tm, 20 + i * 6); }
        });
        const dfs = opp.onPitch.filter((p) => p.role !== 'GK').sort((a, b) => a.baseU - b.baseU);
        dfs.forEach((p, i) => {
          if (i < CORNER_DEF.length) { const s = CORNER_DEF[i]; p.tx = this.U(opp, s[0]); p.ty = this.V(opp, s[1]); }
          else { p.tx = this.U(opp, 35); p.ty = this.V(opp, CY); }
        });
        const g = this.gkOf(opp);
        if (g) { g.tx = this.U(opp, 1); g.ty = this.V(opp, CY); }
      } else {
        let k = 0;
        for (const p of this.all) {
          if (p === r.taker) continue;
          if (p.role === 'GK' && p.team !== r.team) { const t = this.teams[p.team]; p.tx = this.U(t, 0.4); p.ty = this.V(t, CY); continue; }
          if (p.role === 'GK') continue;
          p.tx = this.U(tm, 86 - (k % 3) * 2); p.ty = this.V(tm, 12 + (k * 47) % 44); k++;
        }
      }
    }

    _tackles() {
      const c = this.ball.owner;
      const dtm = this.teams[1 - c.team];
      if (c.role === 'GK' && this.U(this.teams[c.team], c.x) < 16.5) return;
      for (const d of dtm.onPitch) {
        if (d.tackleCd > 0) continue;
        if (hyp(d.x - c.x, d.y - c.y) > 1.5) continue;
        d.tackleCd = rnd(0.9, 1.5);
        const atk = this.eff(c, 'dri'), df = this.eff(d, 'def');
        const pWin = clamp(0.3 + (df - atk) / 150 + dtm.mods.tackle, 0.1, 0.75);
        const ctm = this.teams[c.team];
        const inBox = this.U(ctm, c.x) > L - 16.5 && Math.abs(this.V(ctm, c.y) - CY) < 20.16;
        // 박스 안에서는 수비가 신중해진다(페널티킥 남발 방지)
        const pFoul = (0.065 + (atk > df ? 0.035 : 0) + this.pressOf(dtm) * 0.012) * (inBox ? 0.15 : 1) * dtm.mods.foul;
        const r = Math.random();
        if (r < pFoul) { this._foul(d, c); return; }
        if (r < pFoul + pWin) {
          d.s.tackles++; dtm.st.tackles++;
          c.kickCd = 0.6;
          if (Math.random() < 0.6) this._take(d);
          else this._kick(d, c.vx * 0.4 + rnd(-6, 6), c.vy * 0.4 + rnd(-6, 6));
          return;
        }
      }
    }

    _foul(d, c) {
      const dtm = this.teams[d.team], ctm = this.teams[c.team];
      d.s.fouls++; dtm.st.fouls++;
      const u = this.U(ctm, c.x), v = this.V(ctm, c.y);
      const inBox = u > L - 16.5 && Math.abs(v - CY) < 20.16;
      const r = Math.random();
      let sentOff = false;
      const yc = d.s.yellow > 0 ? 0.05 : (inBox ? 0.25 : 0.12);
      if (r < 0.004) { sentOff = true; d.s.red++; dtm.st.reds++; this._emit('red', `🟥 ${d.name} 다이렉트 퇴장! 위험한 태클입니다.`, d.team); }
      else if (r < 0.004 + yc) {
        d.s.yellow++; dtm.st.yellows++;
        if (d.s.yellow >= 2) { sentOff = true; d.s.red++; dtm.st.reds++; this._emit('red', `🟥 ${d.name} 경고 누적 퇴장!`, d.team); }
        else this._emit('yellow', `🟨 ${d.name} 경고. ${c.name}에게 거친 파울.`, d.team);
      } else if (inBox || u > 70) {
        this._emit('foul', `${J(d.name, '이', '가')} ${c.name}에게 파울을 범합니다.`, d.team);
      }
      if (sentOff) this._sendOff(d);
      if (inBox) {
        this._emit('penalty', `❗ 페널티킥! ${J(c.name, '이', '가')} 박스 안에서 넘어집니다!`, c.team);
        let taker = c, best = -1;
        for (const p of ctm.onPitch) { if (p.role !== 'GK' && p.a.sho > best) { best = p.a.sho; taker = p; } }
        this._restart('penalty', c.team, this.U(ctm, L - 11), this.V(ctm, CY), taker);
      } else {
        this._restart('free', c.team, clamp(c.x, 1, L - 1), clamp(c.y, 1, W - 1), c);
      }
    }

    _sendOff(p) {
      const tm = this.teams[p.team];
      const i = tm.onPitch.indexOf(p);
      if (i < 0) return;
      tm.onPitch.splice(i, 1);
      p.t1 = this.t;
      tm.sentOff.push(p);
      if (this.ball.owner === p) this.ball.owner = null;
      if (tm.lastPasser && tm.lastPasser.p === p) tm.lastPasser = null;
      this._rebuild();
    }

    _aiSubs() {
      this.subTimer -= DT;
      if (this.subTimer > 0) return;
      this.subTimer = 5;
      if (this.t < this.T * 0.58 || this.mode !== 'restart') return;
      for (const tm of this.teams) {
        if (!tm.aiSubs || tm.aiSubsDone >= 3 || tm.subsLeft <= 0) continue;
        let worst = null;
        for (const p of tm.onPitch) {
          if (p.role === 'GK') continue;
          if (p.energy < 55 && (!worst || p.energy < worst.energy)) worst = p;
        }
        if (!worst) continue;
        let cand = null;
        for (const b of tm.bench) {
          if (b.pos === 'GK') continue;
          const sc = (b.ovr || 60) * KM.roleFit(b.pos, worst.role) * (0.6 + 0.4 * (b.cond != null ? b.cond : 100) / 100);
          if (!cand || sc > cand.sc) cand = { b, sc };
        }
        if (cand && this.substitute(tm.idx, worst.id, cand.b.id)) tm.aiSubsDone++;
      }
    }

    // ---------- 결과 ----------
    result() {
      const out = { hg: this.teams[0].score, ag: this.teams[1].score, goals: this.goals.slice(), stats: [], players: [[], []], mom: null };
      let mom = null;
      for (const tm of this.teams) {
        const st = Object.assign({}, tm.st);
        st.possPct = 0;
        out.stats.push(st);
        const res = Math.sign(tm.score - this.teams[1 - tm.idx].score);
        for (const p of tm.onPitch.concat(tm.used, tm.sentOff)) {
          const s = p.s;
          const t1 = p.t1 == null ? this.t : p.t1;
          const mins = Math.max(1, Math.round((t1 - p.t0) / this.T * 90));
          let r = 6.0 + s.goals * 1.0 + s.assists * 0.6 + s.onT * 0.12 - (s.shots - s.onT) * 0.04
            + s.passOk * 0.03 - (s.passes - s.passOk) * 0.06 + s.tackles * 0.12 + s.ints * 0.1
            + s.saves * 0.3 - s.fouls * 0.05 - s.yellow * 0.3 - s.red * 1.5;
          if (p.role === 'GK') r -= s.conceded * 0.35;
          if (p.role === 'DF') r -= s.conceded * 0.2;
          if ((p.role === 'GK' || p.role === 'DF') && s.conceded === 0 && mins >= 60) r += 0.5;
          r += res * 0.25;
          r += (Math.random() - 0.5) * 0.4;
          if (mins < 25) r = 6 + (r - 6) * 0.6;
          r = Math.round(clamp(r, 3, 10) * 10) / 10;
          const row = { id: p.id, name: p.name, num: p.num, pos: p.pos, role: p.role, rating: r, mins, energy: Math.round(p.energy), goals: s.goals, assists: s.assists, shots: s.shots, passes: s.passes, passOk: s.passOk, tackles: s.tackles, saves: s.saves, yellow: s.yellow, red: s.red, team: tm.idx };
          out.players[tm.idx].push(row);
          if (!mom || r > mom.rating) mom = row;
        }
      }
      const tp = this.teams[0].st.poss + this.teams[1].st.poss || 1;
      out.stats[0].possPct = Math.round(this.teams[0].st.poss / tp * 100);
      out.stats[1].possPct = 100 - out.stats[0].possPct;
      out.mom = mom;
      return out;
    }
  }

  KM.Match = Match;
  KM.PITCH = { L, W, CY, GH, DT, MATCH_T };
})(typeof window !== 'undefined' ? (window.KM = window.KM || {}) : (globalThis.KM = globalThis.KM || {}));
