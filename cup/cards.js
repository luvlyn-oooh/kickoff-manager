/* 언더독 컵 - 카드 · 구단 자산(유물) · 상대 특성 · 이벤트 데이터 */
(function (KM) {
  'use strict';
  const C = (KM.Cup = KM.Cup || {});

  // 지속형 카드 효과 헬퍼: min(분), mods, 강화 시 시간 1.5배 + 수치 강화
  function buff(ctx, card, min, mods, label) {
    return ctx.m.addEffect(ctx.side, { label: label || card.name, icon: card.icon, min, mods, tag: card.id });
  }

  // rarity: basic / common / uncommon / rare / curse
  // play(ctx, up) → false 를 반환하면 사용 실패(에너지 환불)
  C.CARDS = {
    // ---------- 기본 ----------
    shout_atk: {
      name: '공격 지시', icon: '⚔️', cost: 1, rarity: 'basic', kind: 'atk',
      text: (u) => `${u ? 15 : 10}분간 슈팅 의욕↑, 결정력 +${u ? 50 : 35}%, 라인 전진.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { desire: 0.1, finish: u ? 1.5 : 1.35, line: 3 }),
    },
    shout_def: {
      name: '수비 지시', icon: '🛡️', cost: 1, rarity: 'basic', kind: 'def',
      text: (u) => `${u ? 15 : 10}분간 태클 성공률↑, 실점 확률 -${u ? 40 : 30}%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { tackle: 0.1, concede: u ? 0.6 : 0.7, line: -4 }),
    },
    water: {
      name: '물 마시는 시간', icon: '💧', cost: 1, rarity: 'basic', kind: 'skill',
      text: (u) => `우리 선수 전원 체력 +${u ? 25 : 15}.`,
      play: (ctx, u) => ctx.m.restoreEnergy(ctx.side, u ? 25 : 15),
    },

    // ---------- 일반 ----------
    press: {
      name: '전방 압박', icon: '🔥', cost: 1, rarity: 'common', kind: 'def',
      text: (u) => `${u ? 15 : 10}분간 최고 강도 압박, 태클 +${u ? 12 : 8}%p. 체력 소모 증가.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { press: 3, tackle: u ? 0.12 : 0.08, drain: 1.3 }),
    },
    longball: {
      name: '롱볼 전술', icon: '🚀', cost: 1, rarity: 'common', kind: 'atk',
      text: (u) => `${u ? 15 : 10}분간 전진 패스와 박스 투입을 크게 선호, 결정력 +10%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { prog: u ? 0.06 : 0.05, box: u ? 0.6 : 0.4, finish: 1.1 }),
    },
    tiki: {
      name: '패스 앤 무브', icon: '🔁', cost: 1, rarity: 'common', kind: 'tac',
      text: (u) => `${u ? 15 : 10}분간 패스 정확도 +${u ? 60 : 50}%, 모든 능력 +5%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { passErr: u ? 0.4 : 0.5, pas: 1.15, all: 1.05 }),
    },
    longshot: {
      name: '중거리 슛', icon: '🎯', cost: 1, rarity: 'common', kind: 'atk',
      text: (u) => `${u ? 15 : 10}분간 슈팅 사거리 +8m, 슈팅 +${u ? 30 : 20}%, 결정력 +15%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { range: 8, desire: 0.07, sho: u ? 1.3 : 1.2, finish: 1.15 }),
    },
    wing: {
      name: '측면 크로스', icon: '↗️', cost: 1, rarity: 'common', kind: 'atk',
      text: (u) => `${u ? 15 : 10}분간 박스 안 연결 ↑↑, 결정력 +${u ? 30 : 20}%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 15 : 10, { box: 0.7, finish: u ? 1.3 : 1.2 }),
    },
    low_block: {
      name: '두 줄 수비', icon: '🧱', cost: 1, rarity: 'common', kind: 'def',
      text: (u) => `${u ? 18 : 12}분간 라인을 내리고 실점 확률 -${u ? 50 : 40}%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 18 : 12, { line: -10, concede: u ? 0.5 : 0.6, def: 1.15 }),
    },
    rough: {
      name: '거친 플레이', icon: '🪓', cost: 0, rarity: 'common', kind: 'def',
      text: (u) => `${u ? 12 : 10}분간 태클 +18%p. 대신 파울이 크게 늘어납니다.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 12 : 10, { tackle: 0.18, foul: u ? 1.8 : 2.5 }),
    },
    tempo: {
      name: '템포 조절', icon: '⏳', cost: 1, rarity: 'common', kind: 'tac',
      text: (u) => `12분간 안정적인 점유, 체력 소모 -40%, 능력 +5%.${u ? ' 즉시 체력 +12.' : ''}`,
      play: (ctx, u) => { if (u) ctx.m.restoreEnergy(ctx.side, 12); return buff(ctx, ctx.card, 12, { passErr: 0.7, prog: -0.015, drain: 0.6, all: 1.05 }); },
    },

    // ---------- 고급 ----------
    counter: {
      name: '역습', icon: '⚡', cost: 2, rarity: 'uncommon', kind: 'atk',
      text: (u) => `${u ? 22 : 15}분간 공을 뺏는 순간 공격진 일제히 질주. 속도 +6%, 결정력 +15%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 22 : 15, { counter: 1, spd: 1.06, finish: 1.15 }),
    },
    offside: {
      name: '오프사이드 트랩', icon: '🚩', cost: 2, rarity: 'uncommon', kind: 'def',
      text: (u) => `${u ? 18 : 12}분간 패스 차단 확률 +${u ? 25 : 20}%p, 실점 확률 -20%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 18 : 12, { intercept: u ? 0.25 : 0.2, line: 5, concede: 0.8 }),
    },
    setpiece: {
      name: '세트피스 찬스', icon: '🧩', cost: 2, upCost: 1, rarity: 'uncommon', kind: 'atk',
      text: () => '즉시 골문 앞 위험 지역에서 직접 프리킥을 얻습니다.',
      play: (ctx) => ctx.m.awardSetPiece(ctx.side, 'free'),
    },
    wall: {
      name: '슈퍼 세이브', icon: '🧤', cost: 2, rarity: 'uncommon', kind: 'def',
      text: (u) => `다음 실점 위기 ${u ? 2 : 1}회를 골키퍼가 반드시 막아냅니다.`,
      play: (ctx, u) => { ctx.m.teams[ctx.side].autoSaves += u ? 2 : 1; },
    },
    ace: {
      name: '에이스에게 공을', icon: '⭐', cost: 2, rarity: 'uncommon', kind: 'atk',
      text: (u) => `${u ? 18 : 12}분간 팀 최고 공격수의 능력 +${u ? 55 : 40}%.`,
      play: (ctx, u) => {
        const ace = ctx.m.bestBy(ctx.side, 'sho');
        if (!ace) return false;
        return buff(ctx, ctx.card, u ? 18 : 12, { boost: { [ace.id]: u ? 1.55 : 1.4 }, box: 0.25 }, `에이스 ${ace.name}`);
      },
    },
    halfspace: {
      name: '2선 침투', icon: '🏃', cost: 2, rarity: 'uncommon', kind: 'atk',
      text: (u) => `${u ? 18 : 12}분간 미드필더가 박스로 침투, 결정력 +${u ? 45 : 30}%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 18 : 12, { mfRun: 9, finish: u ? 1.45 : 1.3 }),
    },
    supersub: {
      name: '슈퍼 서브', icon: '🔄', cost: 1, rarity: 'uncommon', kind: 'skill',
      text: (u) => `가장 지친 선수를 벤치 최고 선수로 교체. 들어온 선수 ${u ? 25 : 15}분간 능력 +30%.`,
      play: (ctx, u) => {
        const m = ctx.m, tm = m.teams[ctx.side];
        const tired = tm.onPitch.filter((p) => p.role !== 'GK').sort((a, b) => a.energy - b.energy)[0];
        const cands = tm.bench.filter((p) => p.pos !== 'GK');
        if (!tired || !cands.length || tm.subsLeft <= 0) return false;
        cands.sort((a, b) => KM.ovrAs(b, tired.role) - KM.ovrAs(a, tired.role));
        const inId = cands[0].id;
        if (!m.substitute(ctx.side, tired.id, inId)) return false;
        return buff(ctx, ctx.card, u ? 25 : 15, { boost: { [inId]: 1.3 } }, `슈퍼 서브 ${cands[0].name}`);
      },
    },
    crowd: {
      name: '관중의 함성', icon: '📣', cost: 2, rarity: 'uncommon', kind: 'tac',
      text: (u) => `${u ? 18 : 12}분간 전원 속도 +7%, 모든 능력 +${u ? 15 : 10}%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 18 : 12, { spd: 1.07, all: u ? 1.15 : 1.1 }),
    },
    timeout: {
      name: '작전 타임', icon: '📋', cost: 0, rarity: 'uncommon', kind: 'skill', exhaust: true,
      text: (u) => `에너지 +${u ? 3 : 2}. (이번 경기에서 1회만 사용)`,
      play: (ctx, u) => { ctx.gainEnergy(u ? 3 : 2); },
    },

    // ---------- 희귀 ----------
    total: {
      name: '토탈 풋볼', icon: '🌪️', cost: 3, rarity: 'rare', kind: 'tac',
      text: (u) => `${u ? 22 : 15}분간 모든 능력 +20%, 속도 +6%, 패스 정확도 상승.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 22 : 15, { all: 1.2, spd: 1.06, passErr: 0.75 }),
    },
    miracle: {
      name: '기적의 5분', icon: '✨', cost: 3, upCost: 2, rarity: 'rare', kind: 'atk',
      text: () => '6분간 결정력 2.5배, 슈팅 의욕 대폭 상승.',
      play: (ctx) => buff(ctx, ctx.card, 6, { finish: 2.5, desire: 0.18, range: 4 }),
    },
    fortress: {
      name: '철벽', icon: '🏰', cost: 3, rarity: 'rare', kind: 'def',
      text: (u) => `${u ? 22 : 15}분간 실점 확률 -70%.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 22 : 15, { concede: 0.3, def: 1.15 }),
    },
    pk: {
      name: '페널티 유도', icon: '🎭', cost: 3, upCost: 2, rarity: 'rare', kind: 'atk', exhaust: true,
      text: () => '즉시 페널티킥을 얻습니다. (이번 경기에서 1회만 사용)',
      play: (ctx) => ctx.m.awardSetPiece(ctx.side, 'penalty'),
    },
    gegen: {
      name: '게겐프레싱', icon: '🐺', cost: 2, rarity: 'rare', kind: 'def',
      text: (u) => `${u ? 22 : 15}분간 최고 강도 압박 + 탈취 즉시 역습, 태클 +12%p. 체력 소모 큼.`,
      play: (ctx, u) => buff(ctx, ctx.card, u ? 22 : 15, { press: 3, counter: 1, tackle: 0.12, drain: 1.4, finish: 1.1 }),
    },
    captain: {
      name: '주장의 리더십', icon: '🦁', cost: 2, rarity: 'rare', kind: 'tac', exhaust: true,
      text: (u) => `남은 경기 동안 모든 능력 +${u ? 12 : 8}%. (1회만 사용)`,
      play: (ctx, u) => buff(ctx, ctx.card, 95, { all: u ? 1.12 : 1.08 }),
    },

    // ---------- 저주 ----------
    fatigue: {
      name: '피로 누적', icon: '😵', cost: 1, rarity: 'curse', kind: 'curse', exhaust: true,
      text: () => '아무 효과 없음. 사용하면 이번 경기에서 사라집니다.',
      play: () => {},
    },
  };
  for (const id in C.CARDS) C.CARDS[id].id = id;

  C.RARITY_KO = { basic: '기본', common: '일반', uncommon: '고급', rare: '희귀', curse: '저주' };
  C.cardCost = (c) => { const d = C.CARDS[c.id]; return c.up && d.upCost != null ? d.upCost : d.cost; };
  C.cardName = (c) => C.CARDS[c.id].name + (c.up ? '+' : '');
  C.cardText = (c) => C.CARDS[c.id].text(!!c.up);
  C.pool = (rarity) => Object.values(C.CARDS).filter((d) => d.rarity === rarity).map((d) => d.id);

  // ---------- 구단 자산(유물) ----------
  C.RELICS = {
    spikes: { name: '새 축구화', icon: '👟', text: '매 경기 시작 에너지 +1.' },
    notebook: { name: '전술 노트', icon: '📓', text: '손에 드는 카드 +1장 (5장).' },
    drink: { name: '에너지 드링크', icon: '🥤', text: '경기 중 에너지 충전 속도 +30%.' },
    physio: { name: '물리치료사', icon: '🩺', text: '경기 후 선수 체력이 20 더 회복됩니다.' },
    charm: { name: '행운의 부적', icon: '🍀', text: '승부차기 성공률 +12%p.' },
    sponsor: { name: '유니폼 스폰서', icon: '💼', text: '경기에서 이기면 💰 +15.' },
    armband: { name: '주장 완장', icon: '🎗️', text: '지고 있을 때 모든 능력 +8%.' },
    analyst: { name: '비디오 분석관', icon: '📹', text: '상대 팀 특성 효과가 절반으로 줄어듭니다.' },
    scout: { name: '스카우트 수첩', icon: '🔭', text: '상점 가격 20% 할인.' },
    megaphone: { name: '메가폰', icon: '📢', text: '매 경기 처음 쓰는 카드는 비용 0.' },
    gloves: { name: '골키퍼 장갑', icon: '🥅', text: '매 경기 실점 위기 1회 자동 선방.' },
    piggy: { name: '돼지 저금통', icon: '🐷', text: '새 행선지에 도착할 때마다 💰 +6.' },
    // 보스 보상 전용
    golden: { name: '황금 축구화', icon: '🥇', text: '팀 최고 공격수의 능력이 항상 +15%.', boss: true },
    bus: { name: '구단 버스', icon: '🚌', text: '최대 ❤️ +1, ❤️ 모두 회복.', boss: true },
    stadium: { name: '새 홈구장', icon: '🏟️', text: '모든 경기에서 우리 팀 능력 +5%.', boss: true },
    academy: { name: '유스 아카데미', icon: '🎓', text: '즉시 유망주 2명 합류, 이후 캠프 훈련 효과 2배.', boss: true },
  };
  for (const id in C.RELICS) C.RELICS[id].id = id;

  // ---------- 상대 특성 ----------
  C.TRAITS = {
    wall: { name: '철벽 수비', icon: '🧱', mods: { def: 1.12, concede: 0.85 } },
    sniper: { name: '골잡이 보유', icon: '🎯', mods: { finish: 1.15 } },
    press: { name: '고강도 압박', icon: '🔥', mods: { press: 3, tackle: 0.05 } },
    wings: { name: '빠른 측면', icon: '💨', mods: { spd: 1.05, box: 0.3 } },
    tiki: { name: '점유율 축구', icon: '🔁', mods: { passErr: 0.7, pas: 1.08 } },
    counter: { name: '역습의 달인', icon: '⚡', mods: { counter: 1, spd: 1.03 } },
    rough: { name: '거친 팀', icon: '🪓', mods: { tackle: 0.1, foul: 2 } },
    iron: { name: '강철 체력', icon: '🔋', mods: { drain: 0.7 } },
    longshot: { name: '중거리 슈터', icon: '🚀', mods: { range: 6, desire: 0.05 } },
  };

  // 보스/정예가 경기 중 쓰는 작전
  C.BOSS_MOVES = [
    { name: '총공세', icon: '📯', min: 8, mods: { desire: 0.08, line: 6, finish: 1.12 } },
    { name: '잠그기', icon: '🔒', min: 12, mods: { line: -10, concede: 0.7 } },
    { name: '압박 스위치', icon: '🔥', min: 8, mods: { press: 3, tackle: 0.06 } },
    { name: '에이스 각성', icon: '😤', min: 8, mods: { sho: 1.12, dri: 1.1 } },
    { name: '전술 변화', icon: '🧠', min: 12, mods: { passErr: 0.7, all: 1.06 } },
  ];

  // ---------- 대회 구성 ----------
  C.STAGES = [
    { name: '지역 예선', tier: 50, boss: { name: '읍내 FC 레전드', short: 'LEG', tier: 55, kit: ['#a16207', '#fef3c7'], traits: ['iron', 'rough'], moves: 1 } },
    { name: '본선 토너먼트', tier: 54, boss: { name: '항구도시 스틸러스', short: 'STL', tier: 58, kit: ['#334155', '#f59e0b'], traits: ['wall', 'counter'], moves: 2 } },
    { name: '결선 라운드', tier: 58, boss: { name: '수도 로열스', short: 'ROY', tier: 62, kit: ['#7f1d1d', '#fde68a'], traits: ['tiki', 'sniper', 'press'], moves: 3 } },
  ];
  C.STEPS_PER_STAGE = 5;

  const TOWNS = ['청솔', '바닷가', '느티나무', '은하', '백두', '한빛', '달빛', '푸른들', '새벽', '갈매기', '단풍', '별빛', '무궁', '하늘', '버드나무', '모래알', '강변', '참나무'];
  const SUFFIX = ['FC', '유나이티드', '시티', '레인저스', '로버스', '스타즈', '워리어스', '이글스', '타이거스', '드래곤즈'];
  const KITS = [['#dc2626', '#ffffff'], ['#2563eb', '#ffffff'], ['#16a34a', '#ffffff'], ['#9333ea', '#ffffff'], ['#ea580c', '#111827'], ['#0891b2', '#ffffff'], ['#facc15', '#111827'], ['#db2777', '#ffffff'], ['#475569', '#ffffff'], ['#65a30d', '#ffffff']];
  C.randomClub = function () {
    const town = KM.pick(TOWNS), suf = KM.pick(SUFFIX);
    const kit = KM.pick(KITS);
    return { name: `${town} ${suf}`, short: (town[0] + suf[0] + 'C').slice(0, 3), kit, gk: kit[0] === '#111827' ? ['#f97316', '#111111'] : ['#111827', kit[0]] };
  };

  // ---------- 이벤트 ----------
  // 각 선택지: label, desc, can(run) (선택), apply(run) → 결과 문자열
  C.EVENTS = [
    {
      id: 'interview', icon: '📰', title: '지역 신문 인터뷰',
      text: '“동네 팀의 기적”이라며 기자가 찾아왔습니다. 무슨 말을 할까요?',
      choices: [
        { label: '겸손하게', desc: '💰 +25', apply: (r) => { r.gold += 25; return '스폰서들이 관심을 보입니다. 💰 +25'; } },
        { label: '우승을 선언한다', desc: '‘관중의 함성’ 카드 획득, 단 ‘피로 누적’ 저주 추가', apply: (r) => { r.addCard('crowd'); r.addCard('fatigue'); return '선수들이 불타오르지만 부담도 커졌습니다.'; } },
      ],
    },
    {
      id: 'prospect', icon: '🌱', title: '공원에서 만난 유망주',
      text: '공원에서 공을 차던 고등학생이 엄청난 재능을 보입니다.',
      choices: [
        { label: '입단 테스트', desc: '17세 유망주 영입 (성장 잠재력 높음)', can: (r) => r.squad.length < 20, apply: (r) => { const p = r.recruit(KM.pick(['MF', 'FW', 'DF']), r.stageTier() - 4, 17); p.pot += 10; return `${p.name}(17세, ${p.pos})이 합류했습니다!`; } },
        { label: '그냥 지나간다', desc: '아무 일도 없음', apply: () => '언젠가 다시 만날지도 모릅니다.' },
      ],
    },
    {
      id: 'rain', icon: '🌧️', title: '폭우 속 훈련',
      text: '훈련장에 장대비가 쏟아집니다.',
      choices: [
        { label: '강행한다', desc: '무작위 카드 1장 강화, 전원 체력 -15', apply: (r) => { const c = r.upgradeRandom(); r.squad.forEach((p) => { p.cond = Math.max(30, p.cond - 15); }); return c ? `‘${KM.Cup.cardName(c)}’ 카드가 강화되었습니다.` : '강화할 카드가 없었습니다.'; } },
        { label: '실내 휴식', desc: '전원 체력 +25', apply: (r) => { r.squad.forEach((p) => { p.cond = Math.min(100, p.cond + 25); }); return '선수들이 푹 쉬었습니다.'; } },
      ],
    },
    {
      id: 'sponsor', icon: '🤝', title: '수상한 스폰서',
      text: '정체불명의 업체가 두툼한 봉투를 내밉니다. 조건은 “빡빡한 홍보 일정”.',
      choices: [
        { label: '받는다', desc: '💰 +70, ‘피로 누적’ 저주 2장 추가', apply: (r) => { r.gold += 70; r.addCard('fatigue'); r.addCard('fatigue'); return '💰 +70. 선수들이 지쳐 보입니다.'; } },
        { label: '거절한다', desc: '아무 일도 없음', apply: () => '깨끗한 구단으로 남았습니다.' },
      ],
    },
    {
      id: 'veteran', icon: '🧓', title: '은퇴한 레전드의 방문',
      text: '왕년의 국가대표가 훈련장을 찾아와 조언을 건넵니다.',
      choices: [
        { label: '전술 강의', desc: '무작위 고급 카드 획득', apply: (r) => { const id = KM.pick(KM.Cup.pool('uncommon')); r.addCard(id); return `‘${KM.Cup.CARDS[id].name}’ 카드를 얻었습니다.`; } },
        { label: '개인 지도', desc: '공격수 1명 슈팅 +6', apply: (r) => { const fw = r.squad.filter((p) => p.pos === 'FW').sort((a, b) => b.a.sho - a.a.sho)[0]; if (!fw) return '공격수가 없습니다.'; fw.a.sho = Math.min(99, fw.a.sho + 6); return `${fw.name}의 슈팅이 ${fw.a.sho}이 되었습니다!`; } },
      ],
    },
    {
      id: 'injury', icon: '🚑', title: '훈련 중 부상',
      text: '주전 선수가 훈련 중 발목을 접질렸습니다.',
      choices: [
        { label: '전문 병원', desc: '💰 -30, 부상 없음', can: (r) => r.gold >= 30, apply: (r) => { r.gold -= 30; return '빠른 치료로 문제없습니다.'; } },
        { label: '참고 뛴다', desc: '무작위 주전 1명 능력 -3', apply: (r) => { const p = KM.pick(r.squad.filter((x) => x.pos !== 'GK')); for (const k of ['pac', 'sho', 'pas', 'dri', 'def', 'phy']) p.a[k] = Math.max(15, p.a[k] - 3); return `${p.name}의 능력이 조금 떨어졌습니다.`; } },
      ],
    },
    {
      id: 'fans', icon: '🎉', title: '팬 미팅',
      text: '작은 팬클럽이 생겼습니다! 팬들과 시간을 보낼까요?',
      choices: [
        { label: '팬 사인회', desc: '❤️ +1', can: (r) => r.hearts < r.maxHearts, apply: (r) => { r.hearts++; return '팬들의 응원에 힘이 납니다. ❤️ +1'; } },
        { label: '굿즈 판매', desc: '💰 +35', apply: (r) => { r.gold += 35; return '굿즈가 완판되었습니다! 💰 +35'; } },
      ],
    },
    {
      id: 'gamble', icon: '🎲', title: '내기 축구',
      text: '옆 동네 감독이 상금을 건 승부차기 내기를 제안합니다.',
      choices: [
        { label: '💰 40 건다', desc: '50% 확률로 💰 +80', can: (r) => r.gold >= 40, apply: (r) => { r.gold -= 40; if (Math.random() < 0.5) { r.gold += 80; return '이겼습니다! 💰 +80'; } return '아깝게 졌습니다… 💰 -40'; } },
        { label: '사양한다', desc: '아무 일도 없음', apply: () => '현명한 선택일지도요.' },
      ],
    },
    {
      id: 'library', icon: '📚', title: '전술 서적',
      text: '헌책방에서 오래된 전술책을 발견했습니다.',
      choices: [
        { label: '정독한다', desc: '덱에서 카드 1장 제거 (가장 약한 기본 카드)', apply: (r) => { const i = r.deck.findIndex((c) => KM.Cup.CARDS[c.id].rarity === 'curse'); const j = i >= 0 ? i : r.deck.findIndex((c) => KM.Cup.CARDS[c.id].rarity === 'basic'); if (j < 0) return '버릴 카드가 없습니다.'; const [c] = r.deck.splice(j, 1); return `‘${KM.Cup.cardName(c)}’ 카드를 덱에서 제거했습니다.`; } },
        { label: '팔아버린다', desc: '💰 +20', apply: (r) => { r.gold += 20; return '💰 +20'; } },
      ],
    },
  ];

  // 감독 스타일(시작 덱)
  C.STYLES = {
    attack: { name: '닥공 감독', icon: '⚔️', desc: '“골은 많이 넣으면 그만.” 공격 카드 위주, 공격수가 강합니다.', cards: ['longball', 'longshot', 'wing'], boostPos: 'FW', relic: 'spikes' },
    defense: { name: '실리 감독', icon: '🛡️', desc: '“지지 않는 축구.” 수비와 역습 카드, 골키퍼가 든든합니다.', cards: ['low_block', 'counter', 'rough'], boostPos: 'GK', relic: 'gloves' },
    possession: { name: '점유 감독', icon: '🔁', desc: '“공은 우리 발밑에.” 패스 카드와 체력 관리, 미드필더가 좋습니다.', cards: ['tiki', 'tiki', 'tempo'], boostPos: 'MF', relic: 'drink' },
  };

})(window.KM = window.KM || {});
