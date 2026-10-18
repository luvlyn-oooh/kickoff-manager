/* 킥오프 매니저 - 기본 데이터 & 선수 생성 */
(function (KM) {
  'use strict';

  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  Object.assign(KM, { rnd, irnd, clamp, pick, gauss });

  // 한국어 조사 (이/가, 을/를, 은/는)
  KM.josa = function (word, withJong, without) {
    const c = word.charCodeAt(word.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return word + without;
    return word + ((c - 0xac00) % 28 ? withJong : without);
  };

  const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '전', '고', '문', '양', '손', '배', '백', '허', '남', '심', '노', '하', '곽', '성', '차', '주', '우', '구', '민', '진'];
  const GIVEN = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '준우', '현우', '도현', '건우', '우진', '선우', '서진', '민재', '현준', '연우', '유준', '정우', '승우', '승현', '시윤', '준혁', '은우', '지환', '승민', '지우', '유찬', '윤우', '민성', '준영', '시후', '진우', '지원', '수호', '재윤', '태윤', '동현', '재원', '민우', '한결', '성민', '태민', '상우', '재민', '영훈', '기현', '태양', '호진', '대현', '용준', '성훈', '규민', '동욱', '찬희', '정민', '세진', '보검', '경민', '인호', '창민', '형준', '범수', '광희', '대호', '일권', '석진'];

  const usedNames = new Set();
  KM.genName = function () {
    for (let i = 0; i < 50; i++) {
      const n = pick(SURNAMES) + pick(GIVEN);
      if (!usedNames.has(n)) { usedNames.add(n); return n; }
    }
    return pick(SURNAMES) + pick(GIVEN);
  };
  KM.registerNames = function (names) { names.forEach((n) => usedNames.add(n)); };

  KM.ATTRS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'gk'];
  KM.ATTR_KO = { pac: '속도', sho: '슈팅', pas: '패스', dri: '드리블', def: '수비', phy: '체력', gk: '골키핑' };
  KM.POS_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };
  KM.POS_KO = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };

  KM.roleFit = function (nat, role) {
    if (nat === role) return 1;
    if (nat === 'GK' || role === 'GK') return 0.45;
    if ((nat === 'DF' && role === 'FW') || (nat === 'FW' && role === 'DF')) return 0.72;
    return 0.87;
  };

  KM.ovrFor = function (a, role) {
    switch (role) {
      case 'GK': return a.gk * 0.88 + a.pas * 0.04 + a.phy * 0.08;
      case 'DF': return a.def * 0.5 + a.phy * 0.2 + a.pac * 0.15 + a.pas * 0.15;
      case 'MF': return a.pas * 0.35 + a.dri * 0.2 + a.def * 0.15 + a.sho * 0.12 + a.phy * 0.1 + a.pac * 0.08;
      default: return a.sho * 0.42 + a.dri * 0.25 + a.pac * 0.2 + a.pas * 0.08 + a.phy * 0.05;
    }
  };
  KM.ovr = (p) => Math.round(KM.ovrFor(p.a, p.pos));
  KM.ovrAs = (p, role) => KM.ovrFor(p.a, role) * KM.roleFit(p.pos, role);

  const PROFILE = {
    GK: { pac: 0.55, sho: 0.3, pas: 0.7, dri: 0.4, def: 0.5, phy: 0.85, gk: 1.08 },
    DF: { pac: 0.92, sho: 0.55, pas: 0.82, dri: 0.72, def: 1.08, phy: 1.02 },
    MF: { pac: 0.9, sho: 0.8, pas: 1.06, dri: 1.0, def: 0.8, phy: 0.95 },
    FW: { pac: 1.04, sho: 1.08, pas: 0.85, dri: 1.02, def: 0.45, phy: 0.92 },
  };

  let nextId = 1;
  KM.setNextId = (n) => { nextId = Math.max(nextId, n); };
  KM.newId = () => nextId++;

  KM.genPlayer = function (pos, tier, age) {
    if (age == null) age = irnd(18, 33);
    let base = tier + gauss() * 4.5;
    if (age < 24) base -= (24 - age) * 1.3;
    if (age > 31) base -= (age - 31) * 1.2;
    const prof = PROFILE[pos];
    const a = {};
    for (const k of KM.ATTRS) {
      if (k === 'gk' && pos !== 'GK') { a.gk = irnd(8, 22); continue; }
      let v = base * prof[k] + gauss() * 5;
      if (k === 'pac' && age > 29) v -= (age - 29) * 1.5;
      a[k] = Math.round(clamp(v, 15, 96));
    }
    const p = { id: KM.newId(), name: KM.genName(), age, pos, a, num: 0, cond: 100, injury: 0, pot: 0, season: null, career: { apps: 0, goals: 0, assists: 0 } };
    const o = KM.ovr(p);
    p.pot = Math.round(clamp(o + (age <= 21 ? rnd(6, 18) : age <= 24 ? rnd(2, 10) : rnd(0, 3)), o, 95));
    KM.resetSeasonStats(p);
    return p;
  };

  KM.resetSeasonStats = function (p) {
    p.season = { apps: 0, goals: 0, assists: 0, ratingSum: 0, mom: 0 };
  };

  const SQUAD_SHAPE = [['GK', 2], ['DF', 6], ['MF', 6], ['FW', 4]];
  const NUMBERS = { GK: [1, 21], DF: [2, 3, 4, 5, 6, 15], MF: [7, 8, 10, 14, 16, 17], FW: [9, 11, 19, 20] };

  KM.genSquad = function (tier) {
    const players = [];
    for (const [pos, n] of SQUAD_SHAPE) {
      for (let i = 0; i < n; i++) {
        // 주전급(앞쪽)은 조금 더 강하게
        const t = tier + (i < n / 2 ? 2 : -3);
        const p = KM.genPlayer(pos, t);
        p.num = NUMBERS[pos][i];
        players.push(p);
      }
    }
    return players;
  };

  KM.TEAM_DEFS = [
    { name: '한강 유나이티드', short: 'HAN', tier: 76, kit: ['#e11d48', '#ffffff'], away: ['#f8fafc', '#e11d48'], gk: ['#facc15', '#111827'] },
    { name: '부산 마린스', short: 'BSM', tier: 74, kit: ['#1d4ed8', '#facc15'], away: ['#fde047', '#1e3a8a'], gk: ['#22c55e', '#052e16'] },
    { name: '인천 스톰', short: 'ICS', tier: 72, kit: ['#38bdf8', '#0f172a'], away: ['#0f172a', '#38bdf8'], gk: ['#f97316', '#111827'] },
    { name: '대구 피닉스', short: 'DGP', tier: 70, kit: ['#f97316', '#1f2937'], away: ['#1f2937', '#f97316'], gk: ['#a3e635', '#111827'] },
    { name: '광주 타이거스', short: 'GJT', tier: 69, kit: ['#facc15', '#111827'], away: ['#111827', '#facc15'], gk: ['#ec4899', '#ffffff'] },
    { name: '울산 웨일스', short: 'USW', tier: 67, kit: ['#0d9488', '#ffffff'], away: ['#ffffff', '#0d9488'], gk: ['#eab308', '#111827'] },
    { name: '대전 로켓츠', short: 'DJR', tier: 66, kit: ['#7c3aed', '#ffffff'], away: ['#e5e7eb', '#7c3aed'], gk: ['#10b981', '#052e16'] },
    { name: '제주 오션스', short: 'JJO', tier: 64, kit: ['#16a34a', '#ffffff'], away: ['#fef08a', '#14532d'], gk: ['#6366f1', '#ffffff'] },
  ];

  KM.colorDist = function (a, b) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
    const x = p(a), y = p(b);
    return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
  };

  KM.FORMATIONS = {
    '4-4-2': [['GK', 5, 34], ['DF', 19, 9], ['DF', 16, 25], ['DF', 16, 43], ['DF', 19, 59], ['MF', 38, 9], ['MF', 35, 26], ['MF', 35, 42], ['MF', 38, 59], ['FW', 55, 27], ['FW', 55, 41]],
    '4-3-3': [['GK', 5, 34], ['DF', 19, 9], ['DF', 16, 25], ['DF', 16, 43], ['DF', 19, 59], ['MF', 34, 20], ['MF', 31, 34], ['MF', 34, 48], ['FW', 53, 10], ['FW', 57, 34], ['FW', 53, 58]],
    '4-2-3-1': [['GK', 5, 34], ['DF', 19, 9], ['DF', 16, 25], ['DF', 16, 43], ['DF', 19, 59], ['MF', 29, 26], ['MF', 29, 42], ['MF', 43, 11], ['MF', 45, 34], ['MF', 43, 57], ['FW', 58, 34]],
    '3-5-2': [['GK', 5, 34], ['DF', 16, 18], ['DF', 14, 34], ['DF', 16, 50], ['MF', 38, 5], ['MF', 32, 22], ['MF', 30, 34], ['MF', 32, 46], ['MF', 38, 63], ['FW', 55, 27], ['FW', 55, 41]],
    '5-3-2': [['GK', 5, 34], ['DF', 22, 5], ['DF', 16, 19], ['DF', 14, 34], ['DF', 16, 49], ['DF', 22, 63], ['MF', 33, 20], ['MF', 31, 34], ['MF', 33, 48], ['FW', 53, 27], ['FW', 53, 41]],
  };
})(typeof window !== 'undefined' ? (window.KM = window.KM || {}) : (globalThis.KM = globalThis.KM || {}));
