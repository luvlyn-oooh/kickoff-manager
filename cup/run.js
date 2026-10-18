/* 언더독 컵 - 한 번의 도전(런) 상태와 진행 로직 */
(function (KM) {
  'use strict';
  const C = KM.Cup;
  const { rnd, irnd, clamp, pick } = KM;
  const RUN_KEY = 'underdog-cup-run-v1';
  const META_KEY = 'underdog-cup-meta-v1';

  const KEY_ATTRS = { GK: ['gk', 'phy'], DF: ['def', 'phy', 'pac'], MF: ['pas', 'dri', 'def'], FW: ['sho', 'dri', 'pac'] };
  const NODE_INFO = {
    match: { icon: '⚽', name: '경기' },
    elite: { icon: '💀', name: '강팀과의 경기' },
    shop: { icon: '🛒', name: '이적 시장' },
    camp: { icon: '🏕️', name: '훈련 캠프' },
    event: { icon: '❓', name: '이벤트' },
    boss: { icon: '🏆', name: '스테이지 결승' },
  };
  C.NODE_INFO = NODE_INFO;
  C.MATCH_LENGTH = 450;
  C.CUP_FINISH = 1.3; // 컵 경기는 짧고 화끈하게: 양 팀 기본 결정력 보정

  let uid = 1;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  C.shuffle = shuffle;

  class Run {
    constructor(data) { Object.assign(this, data); }

    static create(styleId) {
      const style = C.STYLES[styleId];
      const r = new Run({
        v: 1, style: styleId, club: { name: '동네 언더독스', short: 'UDG', kit: ['#a3e635', '#0f172a'], gk: ['#f97316', '#111827'] },
        stage: 0, step: 0, gold: 40, hearts: 3, maxHearts: 3,
        deck: [], relics: [style.relic], squad: [], formation: '4-4-2', lineup: [],
        stats: { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, shootouts: 0 },
        seenEvents: [], log: [], choices: null, node: null, over: false, victory: false,
      });
      // 스쿼드: 아마추어 수준
      const shape = [['GK', 2], ['DF', 5], ['MF', 5], ['FW', 4]];
      for (const [pos, n] of shape) {
        for (let i = 0; i < n; i++) {
          const boost = pos === style.boostPos && i < 2 ? 7 : 0;
          r.recruit(pos, 50 + boost + (i < Math.ceil(n / 2) ? 1 : -3), null, true);
        }
      }
      for (const id of ['shout_atk', 'shout_atk', 'shout_atk', 'shout_def', 'shout_def', 'shout_def', 'water', ...style.cards]) r.addCard(id);
      r.autoLineup();
      r.choices = r.genChoices();
      r.addLog(`${style.icon} ${style.name}으로 도전을 시작했습니다.`);
      return r;
    }

    // ---------- 기본 조작 ----------
    addLog(t) { this.log.unshift(t); if (this.log.length > 30) this.log.length = 30; }
    has(relic) { return this.relics.includes(relic); }
    addCard(id, up) { const c = { uid: `${Date.now().toString(36)}${uid++}`, id, up: !!up }; this.deck.push(c); return c; }
    upgradeRandom() {
      const cands = this.deck.filter((c) => !c.up && C.CARDS[c.id].rarity !== 'curse');
      if (!cands.length) return null;
      const c = pick(cands); c.up = true; return c;
    }
    stageTier() { return C.STAGES[Math.min(this.stage, C.STAGES.length - 1)].tier + this.step * 1; }
    usedNums() { return new Set(this.squad.map((p) => p.num)); }
    recruit(pos, tier, age, silent) {
      const p = KM.genPlayer(pos, tier, age == null ? irnd(19, 31) : age);
      const used = this.usedNums();
      const pref = { GK: [1, 21, 31], DF: [2, 3, 4, 5, 6, 12, 13, 15, 22], MF: [7, 8, 10, 14, 16, 17, 18, 23], FW: [9, 11, 19, 20, 27, 29] }[pos];
      p.num = pref.find((n) => !used.has(n)) || (() => { let n = 24; while (used.has(n)) n++; return n; })();
      this.squad.push(p);
      if (!silent) this.addLog(`🤝 ${p.name}(${pos}) 영입`);
      return p;
    }
    heal(n) { this.hearts = Math.min(this.maxHearts, this.hearts + n); }

    // ---------- 라인업 ----------
    autoLineup() {
      const form = KM.FORMATIONS[this.formation];
      const used = new Set();
      const lineup = new Array(form.length).fill(null);
      const score = (p, role) => KM.ovrAs(p, role) * (0.7 + 0.3 * p.cond / 100);
      for (let pass = 0; pass < 2; pass++) {
        form.forEach((slot, i) => {
          if (lineup[i] != null) return;
          let best = null, bs = -1;
          for (const p of this.squad) {
            if (used.has(p.id) || (pass === 0 && p.pos !== slot[0])) continue;
            const s = score(p, slot[0]);
            if (s > bs) { bs = s; best = p; }
          }
          if (best) { lineup[i] = best.id; used.add(best.id); }
        });
      }
      this.lineup = lineup;
    }
    validateLineup() {
      const form = KM.FORMATIONS[this.formation];
      if (this.lineup.length !== form.length || this.lineup.some((id) => !this.squad.find((p) => p.id === id))) this.autoLineup();
    }
    starters() { this.validateLineup(); return this.lineup.map((id) => this.squad.find((p) => p.id === id)); }
    bench() {
      const xi = new Set(this.lineup);
      const rest = this.squad.filter((p) => !xi.has(p.id)).sort((a, b) => KM.ovr(b) * (0.7 + 0.3 * b.cond / 100) - KM.ovr(a) * (0.7 + 0.3 * a.cond / 100));
      const gk = rest.find((p) => p.pos === 'GK');
      const out = gk ? [gk] : [];
      for (const p of rest) { if (out.length >= 6) break; if (p !== gk) out.push(p); }
      return out;
    }
    strength() {
      const form = KM.FORMATIONS[this.formation];
      const ps = this.starters();
      return ps.reduce((s, p, i) => s + KM.ovrAs(p, form[i][0]), 0) / ps.length;
    }

    // ---------- 행선지 ----------
    genChoices() {
      if (this.step >= C.STEPS_PER_STAGE) return [{ type: 'boss', opp: this.makeOpponent('boss') }];
      const n = this.step === 0 ? 2 : 3;
      const weights = [['match', 42], ['elite', this.stage === 0 && this.step < 2 ? 0 : 13], ['shop', 13], ['camp', 13], ['event', 19]];
      const out = [];
      const types = new Set();
      let guard = 0;
      while (out.length < n && guard++ < 50) {
        let roll = Math.random() * weights.reduce((s, w) => s + w[1], 0), type = 'match';
        for (const [t, w] of weights) { if ((roll -= w) < 0) { type = t; break; } }
        if (type !== 'match' && types.has(type)) continue;
        types.add(type);
        out.push({ type });
      }
      if (!out.some((c) => c.type === 'match' || c.type === 'elite')) out[0] = { type: 'match' };
      for (const c of out) if (c.type === 'match' || c.type === 'elite') c.opp = this.makeOpponent(c.type);
      return shuffle(out);
    }

    makeOpponent(kind) {
      let club, tier, traits = [], moves = 0;
      if (kind === 'boss') {
        const b = C.STAGES[this.stage].boss;
        club = { name: b.name, short: b.short, kit: b.kit, gk: ['#111827', b.kit[1]] };
        tier = b.tier; traits = b.traits.slice(); moves = b.moves;
      } else {
        club = C.randomClub();
        tier = this.stageTier() + (kind === 'elite' ? 6 : rnd(-3, 2));
        const tp = Object.keys(C.TRAITS);
        const nT = kind === 'elite' ? 2 : (this.stage > 0 || Math.random() < 0.4 ? 1 : 0);
        while (traits.length < nT) { const t = pick(tp); if (!traits.includes(t)) traits.push(t); }
        moves = kind === 'elite' ? 1 : (this.stage >= 1 && Math.random() < 0.4 ? 1 : 0);
      }
      const squad = KM.genSquad(Math.round(tier));
      const formation = pick(Object.keys(KM.FORMATIONS));
      const ovr = Math.round(lineupStrength(squad, formation));
      return { kind, ...club, tier: Math.round(tier), traits, moves, formation, squad, ovr };
    }

    // ---------- 보상 ----------
    rollRarity(bonus) {
      const r = Math.random();
      const rare = 0.05 + this.stage * 0.04 + bonus;
      const unc = 0.3 + this.stage * 0.06;
      return r < rare ? 'rare' : r < rare + unc ? 'uncommon' : 'common';
    }
    cardChoices(n, bonus = 0, forceRare = false) {
      const out = [];
      let guard = 0;
      while (out.length < n && guard++ < 50) {
        const rar = forceRare && out.length === 0 ? 'rare' : this.rollRarity(bonus);
        const id = pick(C.pool(rar));
        if (!out.includes(id)) out.push(id);
      }
      return out;
    }
    relicChoices(n, boss) {
      const all = Object.values(C.RELICS).filter((r) => !!r.boss === !!boss && !this.has(r.id)).map((r) => r.id);
      shuffle(all);
      if (!all.length && boss) return this.relicChoices(n, false);
      return all.slice(0, n);
    }
    gainRelic(id) {
      this.relics.push(id);
      this.addLog(`${C.RELICS[id].icon} 구단 자산 획득: ${C.RELICS[id].name}`);
      if (id === 'bus') { this.maxHearts++; this.hearts = this.maxHearts; }
      if (id === 'academy') { this.recruit(pick(['MF', 'FW']), this.stageTier() - 2, 18).pot += 8; this.recruit(pick(['DF', 'MF']), this.stageTier() - 2, 18).pot += 8; }
    }

    /** 경기 결과 반영. res: {gf, ga, shootout: null|{won}, players:[{id, energy, goals}] } */
    finishMatch(node, res) {
      const won = res.gf > res.ga || (res.gf === res.ga && res.shootout && res.shootout.won);
      const st = this.stats;
      st.played++; st.gf += res.gf; st.ga += res.ga;
      if (res.shootout) st.shootouts++;
      if (won) st.won++; else if (res.gf === res.ga) st.drawn++; else st.lost++;
      for (const row of res.players) {
        const p = this.squad.find((x) => x.id === row.id);
        if (!p) continue;
        p.cond = clamp(row.energy + (this.has('physio') ? 20 : 0), 25, 100);
        p.season.apps++; p.season.goals += row.goals; p.season.assists += row.assists || 0;
      }
      const opp = node.opp;
      const reward = { won, gold: 0, cards: [], relics: [], players: [], heartsLost: 0 };
      if (won) {
        const base = node.type === 'boss' ? 55 : node.type === 'elite' ? irnd(32, 42) : irnd(18, 28);
        reward.gold = base + (this.has('sponsor') ? 15 : 0);
        reward.cards = this.cardChoices(3, node.type === 'elite' ? 0.1 : node.type === 'boss' ? 0.25 : 0, node.type === 'boss');
        if (node.type === 'elite') reward.relics = this.relicChoices(1, false);
        if (node.type === 'boss') {
          reward.relics = this.relicChoices(2, true); this.heal(1);
          // 결승 승리 → 이적 제안 (선수 2명 중 1명)
          reward.players = [0, 1].map(() => KM.genPlayer(pick(['DF', 'MF', 'FW', 'FW']), Math.round(C.STAGES[Math.min(this.stage + 1, 2)].tier + 4), irnd(21, 28)));
        }
        this.addLog(`✅ ${opp.name}전 ${res.gf}-${res.ga}${res.shootout ? ' (승부차기 승)' : ''} 승리`);
      } else {
        reward.gold = 8;
        reward.heartsLost = node.type === 'boss' ? 2 : 1;
        this.hearts -= reward.heartsLost;
        this.addLog(`❌ ${opp.name}전 ${res.gf}-${res.ga}${res.shootout ? ' (승부차기 패)' : ''} 패배 — ❤️ -${reward.heartsLost}`);
        if (this.hearts <= 0) { this.hearts = 0; this.over = true; }
      }
      this.gold += reward.gold;
      return reward;
    }

    // 다음 행선지로 이동
    advance() {
      if (this.over) return;
      this.node = null;
      for (const p of this.squad) p.cond = Math.min(100, p.cond + 14);
      if (this.has('piggy')) this.gold += 6;
      if (this.step >= C.STEPS_PER_STAGE) {
        this.stage++; this.step = 0;
        if (this.stage >= C.STAGES.length) { this.over = true; this.victory = true; this.addLog('🏆 언더독 컵 우승!'); return; }
        this.addLog(`📍 ${C.STAGES[this.stage].name} 진출!`);
      } else this.step++;
      this.choices = this.genChoices();
    }

    // ---------- 상점 / 캠프 ----------
    price(base) { return Math.round(base * (this.has('scout') ? 0.8 : 1)); }
    genShop() {
      const cards = [];
      const want = ['common', 'common', 'uncommon', 'uncommon', 'rare'];
      for (const rar of want) {
        let id, g = 0;
        do { id = pick(C.pool(rar)); } while (cards.some((c) => c.id === id) && g++ < 20);
        cards.push({ id, price: this.price({ common: 45, uncommon: 70, rare: 110 }[rar] + irnd(-5, 5)), sold: false });
      }
      const players = [];
      for (let i = 0; i < 2; i++) {
        const pos = pick(['DF', 'MF', 'FW', 'FW', 'MF', 'GK']);
        const p = KM.genPlayer(pos, Math.round(this.stageTier() + rnd(3, 9)), irnd(20, 30));
        const o = KM.ovr(p);
        players.push({ p, price: this.price(clamp(60 + (o - this.stageTier()) * 9, 55, 170)), sold: false });
      }
      const relicId = this.relicChoices(1, false)[0];
      return {
        cards, players,
        relic: relicId ? { id: relicId, price: this.price(140), sold: false } : null,
        removePrice: this.price(60), removed: false,
        healPrice: this.price(80), healed: false,
      };
    }
    trainPlayer(p) {
      const n = this.has('academy') ? 6 : 3;
      for (const k of KEY_ATTRS[p.pos].slice(0, 2)) p.a[k] = Math.min(99, p.a[k] + n);
      return n;
    }

    // ---------- 저장 ----------
    save() { try { localStorage.setItem(RUN_KEY, JSON.stringify(this)); } catch (e) { /* 무시 */ } }
    static load() {
      try {
        const raw = localStorage.getItem(RUN_KEY);
        if (!raw) return null;
        const r = new Run(JSON.parse(raw));
        let maxId = 0;
        for (const p of r.squad) maxId = Math.max(maxId, p.id);
        KM.setNextId(maxId + 1000);
        KM.registerNames(r.squad.map((p) => p.name));
        return r;
      } catch (e) { return null; }
    }
    static clear() { try { localStorage.removeItem(RUN_KEY); } catch (e) { /* 무시 */ } }
  }
  C.Run = Run;

  function lineupStrength(squad, formation) {
    const form = KM.FORMATIONS[formation];
    const used = new Set();
    let s = 0;
    for (const slot of form) {
      let best = null, bs = -1;
      for (const p of squad) { if (used.has(p)) continue; const v = KM.ovrAs(p, slot[0]); if (v > bs) { bs = v; best = p; } }
      used.add(best); s += bs;
    }
    return s / form.length;
  }
  C.lineupStrength = lineupStrength;

  // 상대 팀 경기 셋업 (AI)
  C.oppSetup = function (opp, analyst) {
    const form = KM.FORMATIONS[opp.formation];
    const used = new Set();
    const players = form.map((slot) => {
      let best = null, bs = -1;
      for (const p of opp.squad) { if (used.has(p)) continue; const v = KM.ovrAs(p, slot[0]) * (p.pos === slot[0] ? 1.05 : 1); if (v > bs) { bs = v; best = p; } }
      used.add(best);
      return Object.assign({}, best, { cond: 100, ovr: KM.ovr(best) });
    });
    const bench = opp.squad.filter((p) => !used.has(p)).slice(0, 5).map((p) => Object.assign({}, p, { cond: 100, ovr: KM.ovr(p) }));
    const mods = { finish: C.CUP_FINISH };
    for (const t of opp.traits) mergeInto(mods, C.TRAITS[t].mods, analyst ? 0.5 : 1);
    return { name: opp.name, short: opp.short, kit: opp.kit, gkKit: opp.gk, tactic: { formation: opp.formation, mentality: 0, press: 1 }, players, bench, aiSubs: true, mods };
  };

  // 모디파이어 누적(scale<1 이면 효과 축소)
  function mergeInto(m, add, scale) {
    for (const k in add) {
      const v = add[k];
      if (k === 'press') { m.press = Math.max(m.press == null ? -1 : m.press, scale < 1 ? Math.min(v, 2) : v); continue; }
      const isMul = ['all', 'sho', 'pas', 'dri', 'def', 'gk', 'spd', 'finish', 'concede', 'passErr', 'foul', 'drain'].includes(k);
      if (isMul) m[k] = (m[k] == null ? 1 : m[k]) * (1 + (v - 1) * scale);
      else m[k] = (m[k] || 0) + v * scale;
    }
  }

  // ---------- 기록(메타) ----------
  C.Meta = {
    get() { try { return JSON.parse(localStorage.getItem(META_KEY)) || { runs: 0, wins: 0, best: 0 }; } catch (e) { return { runs: 0, wins: 0, best: 0 }; } },
    record(run) {
      const m = C.Meta.get();
      m.runs++;
      if (run.victory) m.wins++;
      const prog = run.stage * (C.STEPS_PER_STAGE + 1) + run.step + (run.victory ? 1 : 0);
      m.best = Math.max(m.best || 0, prog);
      try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch (e) { /* 무시 */ }
      return m;
    },
  };
})(window.KM = window.KM || {});
