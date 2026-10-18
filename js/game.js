/* 킥오프 매니저 - 시즌/리그/선수 관리 */
(function (KM) {
  'use strict';

  const SAVE_KEY = 'kickoff-manager-save-v1';
  const { rnd, irnd, clamp, pick } = KM;
  const G = (KM.Game = {});
  G.state = null;

  G.TRAININGS = {
    balanced: { name: '균형 훈련', icon: '⚖️', desc: '모든 능력을 고르게 향상합니다. 컨디션 회복 보통.', rec: 24, attrs: null, growth: 1 },
    attack: { name: '공격 훈련', icon: '🎯', desc: '슈팅 · 드리블 · 패스 위주로 성장. 회복이 조금 느립니다.', rec: 18, attrs: ['sho', 'dri', 'pas'], growth: 1.3 },
    defense: { name: '수비 훈련', icon: '🛡️', desc: '수비 · 체력 · 골키핑 위주로 성장. 회복이 조금 느립니다.', rec: 18, attrs: ['def', 'phy', 'gk'], growth: 1.3 },
    fitness: { name: '피지컬 훈련', icon: '🏃', desc: '속도 · 체력 강화. 회복이 가장 느립니다.', rec: 14, attrs: ['pac', 'phy'], growth: 1.3 },
    rest: { name: '휴식', icon: '🛌', desc: '성장은 없지만 컨디션이 크게 회복되고 부상 회복이 빨라집니다.', rec: 42, attrs: null, growth: 0 },
  };

  const KEY_ATTRS = { GK: ['gk', 'phy', 'pas'], DF: ['def', 'phy', 'pac', 'pas'], MF: ['pas', 'dri', 'def', 'sho', 'phy'], FW: ['sho', 'dri', 'pac'] };

  G.available = (p) => p.injury <= 0 && !(p.ban > 0);

  // ---------- 새 게임 ----------
  G.newGame = function (userIdx) {
    const forms = Object.keys(KM.FORMATIONS);
    const teams = KM.TEAM_DEFS.map((d, i) => ({
      id: i, name: d.name, short: d.short, tier: d.tier, kit: d.kit, away: d.away, gk: d.gk,
      players: KM.genSquad(d.tier),
      tactic: { formation: i === userIdx ? '4-4-2' : pick(forms), mentality: 0, press: 1 },
      lineup: [],
    }));
    teams.forEach((t) => G.autoLineup(t));
    G.state = {
      v: 1, season: 1, year: 2026, round: 0, userTeam: userIdx, teams,
      fixtures: G.makeFixtures(teams.length),
      training: 'balanced', news: [], history: [], seasonOver: false,
    };
    G.state.objective = G.computeObjective();
    G.addNews(`${teams[userIdx].name} 감독으로 부임했습니다. 이사회 목표: ${G.objectiveText()}`, 'info');
    G.save();
    return G.state;
  };

  G.makeFixtures = function (n) {
    const ids = [...Array(n).keys()].sort(() => Math.random() - 0.5);
    const rounds = [];
    const arr = ids.slice();
    for (let r = 0; r < n - 1; r++) {
      const ms = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        ms.push((r + i) % 2 === 0 ? { h: a, a: b } : { h: b, a: a });
      }
      rounds.push(ms);
      arr.splice(1, 0, arr.pop());
    }
    const second = rounds.map((ms) => ms.map((m) => ({ h: m.a, a: m.h })));
    return rounds.concat(second).map((ms) => ms.map((m) => ({ h: m.h, a: m.a, res: null })));
  };

  G.teamStrength = function (t) {
    const ps = t.lineup.map((id) => t.players.find((p) => p.id === id)).filter(Boolean);
    const form = KM.FORMATIONS[t.tactic.formation];
    let s = 0;
    ps.forEach((p, i) => { s += KM.ovrAs(p, form[i][0]); });
    return ps.length ? s / ps.length : 0;
  };

  G.computeObjective = function () {
    const st = G.state;
    const ranked = st.teams.map((t) => ({ id: t.id, s: G.teamStrength(t) })).sort((a, b) => b.s - a.s);
    const r = ranked.findIndex((x) => x.id === st.userTeam) + 1;
    return Math.min(st.teams.length, r === 1 ? 1 : r + 1);
  };
  G.objectiveText = function () {
    const o = G.state.objective;
    return o === 1 ? '리그 우승' : `${o}위 이내`;
  };

  // ---------- 라인업 ----------
  G.autoLineup = function (t) {
    const form = KM.FORMATIONS[t.tactic.formation];
    const avail = t.players.filter(G.available);
    const used = new Set();
    const lineup = new Array(form.length).fill(null);
    const score = (p, role) => KM.ovrAs(p, role) * (0.7 + 0.3 * p.cond / 100);
    for (let pass = 0; pass < 2; pass++) {
      form.forEach((slot, i) => {
        if (lineup[i] != null) return;
        let best = null, bs = -1;
        for (const p of avail) {
          if (used.has(p.id)) continue;
          if (pass === 0 && p.pos !== slot[0]) continue;
          const s = score(p, slot[0]);
          if (s > bs) { bs = s; best = p; }
        }
        if (best) { lineup[i] = best.id; used.add(best.id); }
      });
    }
    t.lineup = lineup;
  };

  // 출전 불가 선수를 대체. 바뀐 선수 목록 반환
  G.validateLineup = function (t) {
    const form = KM.FORMATIONS[t.tactic.formation];
    const changed = [];
    if (!t.lineup || t.lineup.length !== form.length) { G.autoLineup(t); return changed; }
    const inXI = new Set(t.lineup);
    form.forEach((slot, i) => {
      const p = t.players.find((x) => x.id === t.lineup[i]);
      if (p && G.available(p)) return;
      let best = null, bs = -1;
      for (const c of t.players) {
        if (inXI.has(c.id) || !G.available(c)) continue;
        const s = KM.ovrAs(c, slot[0]) * (0.7 + 0.3 * c.cond / 100);
        if (s > bs) { bs = s; best = c; }
      }
      if (best) {
        if (p) changed.push([p, best]);
        inXI.delete(t.lineup[i]);
        t.lineup[i] = best.id;
        inXI.add(best.id);
      }
    });
    return changed;
  };

  G.benchOf = function (t) {
    const xi = new Set(t.lineup);
    const rest = t.players.filter((p) => !xi.has(p.id) && G.available(p));
    rest.sort((a, b) => KM.ovr(b) * (0.7 + 0.3 * b.cond / 100) - KM.ovr(a) * (0.7 + 0.3 * a.cond / 100));
    const bench = [];
    const gk = rest.find((p) => p.pos === 'GK');
    if (gk) bench.push(gk);
    for (const p of rest) { if (bench.length >= 7) break; if (p !== gk) bench.push(p); }
    return bench;
  };

  G.buildSetup = function (t, aiSubs) {
    G.validateLineup(t);
    const byId = (id) => t.players.find((p) => p.id === id);
    const prep = (p) => { p.ovr = KM.ovr(p); return p; };
    return {
      name: t.name, short: t.short, kit: t.kit, gkKit: t.gk, teamId: t.id,
      tactic: Object.assign({}, t.tactic),
      players: t.lineup.map(byId).filter(Boolean).map(prep),
      bench: G.benchOf(t).map(prep),
      aiSubs,
    };
  };

  G.makeMatch = function (fx, opts = {}) {
    const st = G.state;
    const h = st.teams[fx.h], a = st.teams[fx.a];
    const userIn = fx.h === st.userTeam || fx.a === st.userTeam;
    const hs = G.buildSetup(h, fx.h !== st.userTeam);
    const as = G.buildSetup(a, fx.a !== st.userTeam);
    if (KM.colorDist(h.kit[0], a.kit[0]) < 140) as.kit = a.away;
    // AI 팀은 상대 전력에 따라 성향 조정
    const sh = G.teamStrength(h), sa = G.teamStrength(a);
    if (fx.h !== st.userTeam) hs.tactic.mentality = sh - sa > 3 ? 1 : sa - sh > 5 ? -1 : 0;
    if (fx.a !== st.userTeam) as.tactic.mentality = sa - sh > 5 ? 1 : sh - sa > 3 ? -1 : 0;
    const m = new KM.Match(hs, as, opts);
    m.userSide = userIn ? (fx.h === st.userTeam ? 0 : 1) : -1;
    return m;
  };

  G.userFixture = function () {
    const st = G.state;
    const fxs = st.fixtures[st.round];
    return fxs ? fxs.find((f) => f.h === st.userTeam || f.a === st.userTeam) : null;
  };

  // ---------- 결과 반영 ----------
  G.applyResult = function (fx, m) {
    const st = G.state;
    const r = m.result();
    fx.res = {
      hg: r.hg, ag: r.ag, goals: r.goals,
      mom: r.mom ? { name: r.mom.name, team: r.mom.team, rating: r.mom.rating } : null,
      stats: r.stats.map((s) => ({ poss: s.possPct, shots: s.shots, onT: s.onT, passes: s.passes, passOk: s.passOk, fouls: s.fouls, corners: s.corners, yellows: s.yellows, reds: s.reds })),
      ratings: r.players.map((list) => list.map((x) => ({ id: x.id, name: x.name, num: x.num, pos: x.pos, role: x.role, rating: x.rating, mins: x.mins, goals: x.goals, assists: x.assists, energy: x.energy, yellow: x.yellow, red: x.red }))),
    };
    const injuries = [];
    [fx.h, fx.a].forEach((tid, side) => {
      const t = st.teams[tid];
      for (const row of r.players[side]) {
        const p = t.players.find((x) => x.id === row.id);
        if (!p) continue;
        p.season.apps++; p.season.goals += row.goals; p.season.assists += row.assists; p.season.ratingSum += row.rating;
        p.career.apps++; p.career.goals += row.goals; p.career.assists += row.assists;
        p.cond = clamp(row.energy, 25, 100);
        if (row.red) p.ban = 2;
        if (r.mom && r.mom.id === row.id) p.season.mom++;
        const injP = 0.01 + (row.energy < 45 ? 0.025 : 0) + (row.mins > 80 ? 0.005 : 0);
        if (Math.random() < injP) { p.injury = irnd(1, 4) + 1; injuries.push([t, p]); }
      }
    });
    return { r, injuries };
  };

  // 사용자 경기가 끝난 뒤 라운드 처리
  G.finishRound = function (userMatch) {
    const st = G.state;
    const fxs = st.fixtures[st.round];
    const userFx = G.userFixture();
    const summary = { round: st.round + 1, user: null, others: [], injuries: [], growth: [], posBefore: G.position(st.userTeam) };
    const ur = G.applyResult(userFx, userMatch);
    summary.user = { fx: userFx, result: ur.r };
    summary.injuries.push(...ur.injuries);
    for (const fx of fxs) {
      if (fx === userFx) continue;
      const m = G.makeMatch(fx);
      m.runToEnd();
      const r = G.applyResult(fx, m);
      summary.others.push(fx);
      summary.injuries.push(...r.injuries);
    }
    // 뉴스
    const u = st.teams[st.userTeam];
    const res = userFx.res;
    const myG = userFx.h === st.userTeam ? res.hg : res.ag, opG = userFx.h === st.userTeam ? res.ag : res.hg;
    const opp = st.teams[userFx.h === st.userTeam ? userFx.a : userFx.h];
    const word = myG > opG ? '승리' : myG === opG ? '무승부' : '패배';
    G.addNews(`${summary.round}라운드: ${opp.name}전 ${myG}-${opG} ${word}`, myG > opG ? 'win' : myG === opG ? 'draw' : 'loss');
    for (const [t, p] of summary.injuries) {
      if (t.id === st.userTeam) G.addNews(`🚑 ${p.name} 부상 — ${p.injury - 1}경기 결장 예상`, 'bad');
    }
    for (const fx of fxs) for (const side of [0, 1]) {
      const list = fx.res.ratings[side];
      const tid = side === 0 ? fx.h : fx.a;
      if (tid === st.userTeam) for (const x of list) if (x.red) G.addNews(`🟥 ${x.name} 퇴장 — 다음 경기 출전 정지`, 'bad');
    }
    // 주간 처리: 징계/부상 감소, 훈련, 회복
    summary.growth = G.weeklyTraining();
    st.round++;
    if (st.round >= st.fixtures.length) st.seasonOver = true;
    summary.posAfter = G.position(st.userTeam);
    // AI 라인업 갱신
    st.teams.forEach((t) => { if (t.id !== st.userTeam) G.autoLineup(t); });
    const changed = G.validateLineup(u);
    for (const [o, n] of changed) G.addNews(`${o.name} 출전 불가 → ${n.name}(으)로 자동 교체`, 'info');
    G.save();
    return summary;
  };

  G.weeklyTraining = function () {
    const st = G.state;
    const grown = [];
    for (const t of st.teams) {
      const isUser = t.id === st.userTeam;
      const tr = G.TRAININGS[isUser ? st.training : 'balanced'];
      for (const p of t.players) {
        if (p.ban > 0) p.ban--;
        if (p.injury > 0) {
          p.injury--;
          if (tr === G.TRAININGS.rest && p.injury > 0 && Math.random() < 0.4) p.injury--;
        }
        p.cond = Math.min(100, p.cond + tr.rec + p.a.phy / 20);
        if (p.injury > 0 || tr.growth === 0) continue;
        const ovr0 = KM.ovr(p);
        const ageF = p.age <= 21 ? 0.35 : p.age <= 24 ? 0.22 : p.age <= 28 ? 0.1 : p.age <= 31 ? 0.03 : 0;
        const gap = clamp((p.pot - ovr0) / 8, 0, 1);
        const chance = tr.growth * ageF * (0.15 + gap);
        if (Math.random() < chance) {
          let pool = tr.attrs ? tr.attrs.filter((k) => KEY_ATTRS[p.pos].includes(k)) : KEY_ATTRS[p.pos];
          if (!pool.length) pool = KEY_ATTRS[p.pos];
          const k = pick(pool);
          p.a[k] = Math.min(99, p.a[k] + 1);
          const ovr1 = KM.ovr(p);
          if (isUser) grown.push({ p, k, ovr0, ovr1 });
        }
      }
    }
    for (const g of grown) {
      if (g.ovr1 > g.ovr0) G.addNews(`📈 ${g.p.name} 성장! OVR ${g.ovr0} → ${g.ovr1}`, 'good');
    }
    return grown;
  };

  // ---------- 순위/기록 ----------
  G.table = function () {
    const st = G.state;
    const rows = st.teams.map((t) => ({ id: t.id, name: t.name, short: t.short, kit: t.kit, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0, form: [] }));
    for (const round of st.fixtures) for (const fx of round) {
      if (!fx.res) continue;
      const h = rows[fx.h], a = rows[fx.a], hg = fx.res.hg, ag = fx.res.ag;
      h.P++; a.P++; h.GF += hg; h.GA += ag; a.GF += ag; a.GA += hg;
      if (hg > ag) { h.W++; a.L++; h.Pts += 3; h.form.push('W'); a.form.push('L'); }
      else if (hg < ag) { a.W++; h.L++; a.Pts += 3; h.form.push('L'); a.form.push('W'); }
      else { h.D++; a.D++; h.Pts++; a.Pts++; h.form.push('D'); a.form.push('D'); }
    }
    rows.forEach((r) => { r.GD = r.GF - r.GA; r.form = r.form.slice(-5); });
    rows.sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF || x.name.localeCompare(y.name));
    return rows;
  };
  G.position = (tid) => G.table().findIndex((r) => r.id === tid) + 1;

  G.leaders = function (key, n = 10, minApps = 0) {
    const out = [];
    for (const t of G.state.teams) for (const p of t.players) {
      if (p.season.apps < minApps) continue;
      const val = key === 'rating' ? (p.season.apps ? p.season.ratingSum / p.season.apps : 0) : p.season[key];
      if (val > 0) out.push({ p, t, val });
    }
    out.sort((a, b) => b.val - a.val || a.p.season.apps - b.p.season.apps);
    return out.slice(0, n);
  };

  // ---------- 시즌 종료 ----------
  G.seasonSummary = function () {
    const st = G.state;
    const tbl = G.table();
    const pos = tbl.findIndex((r) => r.id === st.userTeam) + 1;
    return {
      table: tbl, pos, champion: tbl[0], objective: st.objective, met: pos <= st.objective,
      scorer: G.leaders('goals', 1)[0], assister: G.leaders('assists', 1)[0], best: G.leaders('rating', 1, 7)[0],
    };
  };

  G.startNextSeason = function () {
    const st = G.state;
    const sum = G.seasonSummary();
    st.history.push({ season: st.season, year: st.year, champion: sum.champion.name, pos: sum.pos, objective: st.objective, met: sum.met, pts: sum.table[sum.pos - 1].Pts });
    const retired = [];
    for (const t of st.teams) {
      t.players = t.players.map((p) => {
        p.age++;
        if (p.age >= 36 || (p.age >= 34 && Math.random() < 0.45)) {
          const np = KM.genPlayer(p.pos, t.tier - 4, irnd(17, 19));
          np.num = p.num;
          if (t.id === st.userTeam) retired.push([p, np]);
          return np;
        }
        // 시즌 사이 성장/노쇠
        const ovr = KM.ovr(p);
        if (p.age <= 24 && p.pot > ovr) {
          const n = irnd(1, Math.min(6, p.pot - ovr + 1));
          for (let i = 0; i < n; i++) { const k = pick(KEY_ATTRS[p.pos]); p.a[k] = Math.min(99, p.a[k] + 1); }
        } else if (p.age >= 30) {
          const n = irnd(1, p.age - 28);
          for (let i = 0; i < n; i++) { const k = pick(['pac', 'phy', pick(KEY_ATTRS[p.pos])]); p.a[k] = Math.max(15, p.a[k] - 1); }
        }
        p.cond = 100; p.injury = 0; p.ban = 0;
        KM.resetSeasonStats(p);
        return p;
      });
      G.autoLineup(t);
    }
    st.season++; st.year++; st.round = 0; st.seasonOver = false;
    st.fixtures = G.makeFixtures(st.teams.length);
    st.objective = G.computeObjective();
    G.addNews(`${st.year} 시즌 개막! 이사회 목표: ${G.objectiveText()}`, 'info');
    for (const [o, n] of retired) G.addNews(`👋 ${o.name}(${o.age}) 은퇴 — 유스 출신 ${n.name}(${n.age}) 1군 합류`, 'info');
    G.save();
    return retired;
  };

  // ---------- 뉴스 / 저장 ----------
  G.addNews = function (text, kind) {
    const st = G.state;
    st.news.unshift({ text, kind: kind || 'info', season: st.season, round: st.round });
    if (st.news.length > 60) st.news.length = 60;
  };

  G.save = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(G.state)); return true; } catch (e) { return false; }
  };
  G.hasSave = function () {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  };
  G.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const st = JSON.parse(raw);
      let maxId = 0;
      const names = [];
      for (const t of st.teams) for (const p of t.players) { maxId = Math.max(maxId, p.id); names.push(p.name); }
      KM.setNextId(maxId + 1);
      KM.registerNames(names);
      G.state = st;
      return st;
    } catch (e) { return null; }
  };
  G.deleteSave = function () { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } };
})(typeof window !== 'undefined' ? (window.KM = window.KM || {}) : (globalThis.KM = globalThis.KM || {}));
