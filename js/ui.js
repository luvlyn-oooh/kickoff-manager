/* 킥오프 매니저 - 화면/입력 처리 */
(function (KM) {
  'use strict';
  const G = KM.Game;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');

  const UI = { screen: 'title', tab: 'home', selSlot: null, demo: null };
  KM.UI = UI;

  // ---------- 헬퍼 ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const crest = (t, size = '', kit) => { const k = kit || t.kit; return `<span class="crest ${size}" style="background:${k[0]};color:${k[1]}">${esc(t.short)}</span>`; };
  const aCls = (v) => (v >= 80 ? 'a-hi' : v >= 70 ? 'a-good' : v >= 60 ? 'a-mid' : v >= 50 ? 'a-low' : 'a-bad');
  const rCls = (r) => (r >= 8 ? 'r-hi' : r >= 7 ? 'r-good' : r >= 6 ? 'r-mid' : 'r-low');
  const condColor = (c) => (c >= 80 ? '#4ade80' : c >= 60 ? '#facc15' : c >= 40 ? '#fb923c' : '#f87171');
  const condBar = (c) => `<div class="bar"><span style="width:${Math.max(3, c)}%;background:${condColor(c)}"></span></div>`;
  const formHtml = (f) => `<span class="form">${f.map((x) => `<i class="${x}">${x === 'W' ? '승' : x === 'D' ? '무' : '패'}</i>`).join('')}</span>`;
  const st = () => G.state;
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const isPortrait = () => window.innerHeight >= window.innerWidth;
  const userTeam = () => st().teams[st().userTeam];
  const teamById = (id) => st().teams[id];

  function toast(text) {
    const el = document.createElement('div');
    el.textContent = text;
    document.getElementById('toast').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  function openModal(html, cls = '') {
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal ${cls}">${html}</div></div>`;
    return modalRoot.firstElementChild;
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  // ---------- 라우팅 ----------
  function go(screen) {
    UI.screen = screen;
    if (screen !== 'title') stopDemo();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (UI.screen === 'title') renderTitle();
    else if (UI.screen === 'pick') renderPick();
    else if (UI.screen === 'hub') renderHub();
  }

  // ---------- 앱 설치 ----------
  let installEvt = null;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvt = e;
    if (UI.screen === 'title') { stopDemo(); renderTitle(); }
  });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('홈 화면에 설치되었습니다!'); });
  function installHtml() {
    if (standalone()) return '';
    if (installEvt) return '<button class="btn big" data-act="install">📲 앱으로 설치</button>';
    if (isIOS()) return '<p class="hint" style="margin-top:6px">📲 Safari의 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>로 앱처럼 설치할 수 있어요.</p>';
    return '';
  }

  // ---------- 타이틀 ----------
  function renderTitle() {
    app.innerHTML = `
      <div class="title-screen">
        <div class="title-bg"><canvas id="demo-cv"></canvas></div>
        <div class="title-card">
          <div class="logo">⚽</div>
          <h1>킥오프 <span>매니저</span></h1>
          <p class="tag">8개 구단 · 14라운드 리그.<br>선수를 고르고 전술을 짠 뒤, 실시간으로 펼쳐지는 경기를 지휘하세요.</p>
          <div class="btns">
            ${G.hasSave() ? '<button class="btn primary big" data-act="continue">이어하기</button>' : ''}
            <button class="btn ${G.hasSave() ? '' : 'primary'} big" data-act="new">새 게임</button>
            ${installHtml()}
          </div>
          <a class="cup-link" href="cup/index.html">🃏 신작 <b>언더독 컵</b> — 카드로 지휘하는 로그라이크 축구 ▶</a>
        </div>
      </div>`;
    startDemo();
  }

  function demoSetup(d) {
    const sq = KM.genSquad(d.tier);
    const f = KM.FORMATIONS['4-3-3'];
    const used = new Set();
    const players = f.map((s) => { const p = sq.filter((x) => x.pos === s[0] && !used.has(x)).sort((a, b) => KM.ovr(b) - KM.ovr(a))[0]; used.add(p); return p; });
    return { name: d.name, short: d.short, kit: d.kit, gkKit: d.gk, tactic: { formation: '4-3-3', mentality: 1, press: 1 }, players, bench: [], aiSubs: false };
  }
  function startDemo() {
    stopDemo();
    const defs = KM.TEAM_DEFS.slice().sort(() => Math.random() - 0.5);
    const away = demoSetup(defs[1]);
    if (KM.colorDist(defs[0].kit[0], defs[1].kit[0]) < 140) away.kit = defs[1].away;
    const m = new KM.Match(demoSetup(defs[0]), away);
    const cv = document.getElementById('demo-cv');
    const r = new KM.Renderer(cv);
    const fit = () => { r.forceW = Math.max(window.innerWidth * 1.05, window.innerHeight * 1.6); r.resize(r.forceW); };
    fit();
    window.onresize = () => { if (UI.screen === 'title') fit(); };
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      m.advance(dt * 3);
      if (m.finished) { startDemo(); return; }
      r.draw(m);
      UI.demo = requestAnimationFrame(loop);
    };
    UI.demo = requestAnimationFrame(loop);
  }
  function stopDemo() { if (UI.demo) cancelAnimationFrame(UI.demo); UI.demo = null; }

  // ---------- 팀 선택 ----------
  function renderPick() {
    const previews = KM.TEAM_DEFS.map((d, i) => {
      const stars = Math.max(1, Math.min(5, Math.round((d.tier - 56) / 4)));
      return `
        <button class="team-card" data-act="pick" data-i="${i}">
          <div class="stripe" style="background:linear-gradient(90deg,${d.kit[0]},${d.kit[1]})"></div>
          <div class="row">${crest(d, 'lg')}<div><div class="nm">${esc(d.name)}</div><div class="stars">${'★'.repeat(stars)}<span class="muted">${'★'.repeat(5 - stars)}</span></div></div></div>
          <dl>
            <dt>전력</dt><dd>${d.tier >= 74 ? '우승 후보' : d.tier >= 69 ? '상위권' : d.tier >= 65 ? '중위권' : '언더독'}</dd>
            <dt>난이도</dt><dd>${d.tier >= 74 ? '쉬움' : d.tier >= 67 ? '보통' : '어려움'}</dd>
          </dl>
        </button>`;
    }).join('');
    app.innerHTML = `
      <div class="pick">
        <button class="btn small" data-act="title">← 돌아가기</button>
        <h2 style="margin-top:16px">구단 선택</h2>
        <p>감독으로 부임할 구단을 고르세요. 약팀일수록 이사회 목표가 낮지만 우승은 어렵습니다.</p>
        <div class="pick-grid">${previews}</div>
      </div>`;
  }

  // ---------- 허브 ----------
  const TABS = [['home', '홈'], ['squad', '선수단·전술'], ['training', '훈련'], ['table', '순위'], ['schedule', '일정'], ['stats', '기록']];
  const TAB_ICONS = { home: ['🏠', '홈'], squad: ['👥', '선수단'], training: ['🏋️', '훈련'], table: ['🏆', '순위'], schedule: ['📅', '일정'], stats: ['📊', '기록'] };

  function playBar() {
    const s = st();
    if (s.seasonOver) return `<div class="play-bar mob-only"><span><b>시즌 종료</b><small>모든 경기가 끝났습니다</small></span><button class="btn primary" data-act="season-end">결산 보기</button></div>`;
    const fx = G.userFixture();
    const home = fx.h === s.userTeam;
    const opp = teamById(home ? fx.a : fx.h);
    return `<div class="play-bar mob-only">${crest(opp, 'sm')}<span><b>vs ${esc(opp.name)}</b><small>${s.round + 1}라운드 · ${home ? '홈' : '원정'}</small></span><button class="btn primary" data-act="play">경기 시작 ▶</button></div>`;
  }

  function renderHub() {
    const s = st(), u = userTeam();
    const pos = G.position(u.id);
    const roundTxt = s.seasonOver ? '시즌 종료' : `${s.round + 1} / ${s.fixtures.length} 라운드`;
    app.innerHTML = `
      <div class="hub tab-${UI.tab}">
        <header class="topbar">
          <div class="club">${crest(u)}<div><div class="club-name">${esc(u.name)}</div><div class="sub">${s.year} 시즌 · ${roundTxt} · ${s.round === 0 ? '개막 전' : `현재 ${pos}위`}</div></div></div>
          <nav class="tabs">${TABS.map(([k, n]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</nav>
          <button class="btn small" data-act="menu" aria-label="메뉴">☰</button>
        </header>
        <main class="hub-main">
          <section class="content">${tabContent()}</section>
          <aside class="side">${nextMatchCard()}</aside>
        </main>
        ${UI.tab !== 'home' ? playBar() : ''}
        <nav class="bottom-nav mob-only">${TABS.map(([k]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${TAB_ICONS[k][0]}</span><small>${TAB_ICONS[k][1]}</small></button>`).join('')}</nav>
      </div>`;
  }

  function tabContent() {
    switch (UI.tab) {
      case 'squad': return squadTab();
      case 'training': return trainingTab();
      case 'table': return `<div class="card"><h3>리그 순위</h3>${tableHtml(false)}</div>`;
      case 'schedule': return scheduleTab();
      case 'stats': return statsTab();
      default: return homeTab();
    }
  }

  function nextMatchCard() {
    const s = st();
    if (s.seasonOver) {
      return `<div class="card next-match"><div class="label">시즌 종료</div>
        <p class="muted" style="margin:12px 0 16px">${s.year} 시즌의 모든 경기가 끝났습니다.</p>
        <button class="btn primary big" data-act="season-end">시즌 결산 보기</button></div>`;
    }
    const fx = G.userFixture();
    const h = teamById(fx.h), a = teamById(fx.a);
    const sh = G.teamStrength(h), sa = G.teamStrength(a);
    const tbl = G.table();
    const rh = tbl.find((r) => r.id === h.id), ra = tbl.find((r) => r.id === a.id);
    const isHome = fx.h === s.userTeam;
    const cmp = (lbl, x, y, fmt = (v) => v) => {
      const tot = x + y || 1;
      return `<div class="cmp-row"><div class="lbl">${lbl}</div><span>${fmt(x)}</span>
        <div class="cmp-bar"><span style="width:${x / tot * 100}%;background:${h.kit[0]}"></span><span style="width:${y / tot * 100}%;background:${KM.colorDist(h.kit[0], a.kit[0]) < 140 ? a.away[0] : a.kit[0]}"></span></div>
        <span class="r">${fmt(y)}</span></div>`;
    };
    return `
      <div class="card next-match">
        <div class="label">다음 경기 · ${s.round + 1}라운드 · ${isHome ? '홈' : '원정'}</div>
        <div class="vs-row">
          <div class="tm">${crest(h, 'lg')}<span>${esc(h.name)}</span><small class="muted">${rh.Pts}점 · ${tbl.indexOf(rh) + 1}위</small></div>
          <div class="vs">VS</div>
          <div class="tm">${crest(a, 'lg')}<span>${esc(a.name)}</span><small class="muted">${ra.Pts}점 · ${tbl.indexOf(ra) + 1}위</small></div>
        </div>
        <div class="cmp">
          ${cmp('평균 전력', sh, sa, (v) => v.toFixed(1))}
          ${cmp('시즌 득점', rh.GF, ra.GF)}
          ${cmp('시즌 실점', rh.GA, ra.GA)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;font-size:12px">
          <span>${formHtml(rh.form)}</span><span class="muted">최근 5경기</span><span>${formHtml(ra.form)}</span>
        </div>
        <button class="btn primary big" data-act="play">경기 시작 ▶</button>
      </div>
      <div class="card">
        <h3>이번 주 훈련 <span class="muted">${G.TRAININGS[s.training].icon} ${G.TRAININGS[s.training].name}</span></h3>
        <button class="btn small" data-act="tab" data-tab="training">훈련 변경</button>
      </div>`;
  }

  function homeTab() {
    const s = st(), u = userTeam();
    const pos = G.position(u.id);
    const ok = pos <= s.objective;
    const results = [];
    for (const round of s.fixtures) for (const fx of round) {
      if (fx.res && (fx.h === u.id || fx.a === u.id)) results.push(fx);
    }
    const recent = results.slice(-5).reverse().map((fx) => fxLine(fx, true)).join('') || '<p class="muted">아직 치른 경기가 없습니다.</p>';
    return `
      <div class="grid2">
        <div class="card">
          <h3>이사회 목표</h3>
          <div class="objective">
            <div class="big ${s.round === 0 ? '' : ok ? 'ok' : 'no'}">${s.round === 0 ? '—' : pos + '위'}</div>
            <div><div style="font-weight:700">목표: ${G.objectiveText()}</div>
            <div class="muted" style="font-size:12px;margin-top:4px">${s.round === 0 ? '시즌이 곧 시작됩니다.' : ok ? '이사회가 만족하고 있습니다. 👍' : '목표 달성을 위해 분발이 필요합니다.'}</div></div>
          </div>
        </div>
        <div class="card"><h3>최근 결과</h3>${recent}</div>
      </div>
      <div class="grid2">
        <div class="card"><h3>리그 순위 <span class="muted">${s.round}/${s.fixtures.length} 라운드 진행</span></h3>${tableHtml(true)}</div>
        <div class="card"><h3>구단 소식</h3><ul class="news">${s.news.slice(0, 20).map((n) => `<li class="${n.kind}"><small>${n.season}시즌 ${n.round + (n.round < s.fixtures.length ? 1 : 0)}R</small>${esc(n.text)}</li>`).join('')}</ul></div>
      </div>`;
  }

  function fxLine(fx, clickable) {
    const h = teamById(fx.h), a = teamById(fx.a);
    const me = fx.h === st().userTeam || fx.a === st().userTeam;
    const idx = clickable && fx.res ? findFxIndex(fx) : null;
    return `<div class="fx ${me ? 'me' : ''} ${idx ? 'click' : ''}" ${idx ? `data-act="fx" data-r="${idx[0]}" data-m="${idx[1]}"` : ''}>
      <span class="h">${esc(h.name)} ${crest(h, 'sm')}</span>
      <span class="sc">${fx.res ? `${fx.res.hg} - ${fx.res.ag}` : 'vs'}</span>
      <span>${crest(a, 'sm')} ${esc(a.name)}</span></div>`;
  }
  function findFxIndex(fx) {
    const s = st();
    for (let r = 0; r < s.fixtures.length; r++) { const m = s.fixtures[r].indexOf(fx); if (m >= 0) return [r, m]; }
    return null;
  }

  function tableHtml(compact) {
    const tbl = G.table();
    return `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th class="num">#</th><th>구단</th><th class="num">경기</th>${compact ? '' : '<th class="num">승</th><th class="num">무</th><th class="num">패</th><th class="num">득</th><th class="num">실</th>'}<th class="num">득실</th><th class="num">승점</th>${compact ? '' : '<th>최근</th>'}</tr></thead>
      <tbody>${tbl.map((r, i) => `<tr class="${r.id === st().userTeam ? 'me' : ''}">
        <td class="num">${i + 1}</td><td>${crest(r, 'sm')} ${esc(r.name)}</td><td class="num">${r.P}</td>
        ${compact ? '' : `<td class="num">${r.W}</td><td class="num">${r.D}</td><td class="num">${r.L}</td><td class="num">${r.GF}</td><td class="num">${r.GA}</td>`}
        <td class="num">${r.GD > 0 ? '+' : ''}${r.GD}</td><td class="num"><b>${r.Pts}</b></td>${compact ? '' : `<td>${formHtml(r.form)}</td>`}</tr>`).join('')}
      </tbody></table></div>`;
  }

  // ---------- 선수단 ----------
  function squadTab() {
    const u = userTeam();
    G.validateLineup(u);
    const form = KM.FORMATIONS[u.tactic.formation];
    const xi = new Map(u.lineup.map((id, i) => [id, i]));
    const bench = new Set(G.benchOf(u).map((p) => p.id));
    const slots = form.map((slot, i) => {
      const p = u.players.find((x) => x.id === u.lineup[i]);
      if (!p) return '';
      const eff = Math.round(KM.ovrAs(p, slot[0]));
      const left = slot[2] / 68 * 100, top = 100 - (slot[1] / 62 * 86 + 4);
      return `<button class="slot ${UI.selSlot === i ? 'on' : ''} ${p.pos !== slot[0] ? 'mis' : ''}" style="left:${left}%;top:${top}%" data-act="slot" data-i="${i}" title="${esc(p.name)} (${p.pos})">
        <span class="rl">${slot[0]}${p.pos !== slot[0] ? ` ← ${p.pos}` : ''}</span>
        <span class="nm">${esc(p.name)}</span>
        <span class="ovr ${aCls(eff)}">${eff}</span>
        ${condBar(p.cond)}
      </button>`;
    }).join('');
    const players = u.players.slice().sort((a, b) => KM.POS_ORDER[a.pos] - KM.POS_ORDER[b.pos] || KM.ovr(b) - KM.ovr(a));
    const rows = players.map((p) => {
      const o = KM.ovr(p);
      const inXi = xi.has(p.id);
      const chip = inXi ? `<span class="xi-chip">${form[xi.get(p.id)][0]}</span>` : bench.has(p.id) ? '<span class="xi-chip bench">교체</span>' : '';
      const status = p.injury > 0 ? `<span class="status inj">부상 ${p.injury}경기</span>` : p.ban > 0 ? '<span class="status ban">징계</span>' : '';
      const avg = p.season.apps ? (p.season.ratingSum / p.season.apps).toFixed(2) : '-';
      const ac = (k) => `<td class="num"><span class="ovr ${aCls(p.a[k])}" style="min-width:26px;height:20px">${p.a[k]}</span></td>`;
      return `<tr class="click ${inXi && UI.selSlot === xi.get(p.id) ? 'sel' : ''}" data-act="player" data-id="${p.id}">
        <td>${chip}</td><td class="num muted">${p.num}</td><td><b>${esc(p.name)}</b> ${status}</td><td>${p.pos}</td><td class="num">${p.age}</td>
        <td class="num"><span class="ovr ${aCls(o)}">${o}</span></td>
        ${p.pos === 'GK' ? ac('gk') + ac('pas') + ac('phy') + '<td></td><td></td><td></td>' : ac('pac') + ac('sho') + ac('pas') + ac('dri') + ac('def') + ac('phy')}
        <td style="min-width:70px">${condBar(p.cond)}</td>
        <td class="num">${p.season.apps}</td><td class="num">${p.season.goals}</td><td class="num">${p.season.assists}</td><td class="num">${avg}</td></tr>`;
    }).join('');
    const mrows = players.map((p) => {
      const o = KM.ovr(p);
      const inXi = xi.has(p.id);
      const chip = inXi ? `<span class="xi-chip">${form[xi.get(p.id)][0]}</span>` : bench.has(p.id) ? '<span class="xi-chip bench">교체</span>' : '<span class="xi-chip none">—</span>';
      const status = p.injury > 0 ? ` · <span class="status inj">부상 ${p.injury}</span>` : p.ban > 0 ? ' · <span class="status ban">징계</span>' : '';
      return `<button class="mrow" data-act="player" data-id="${p.id}">${chip}
        <span class="info"><b>${esc(p.name)}</b><small>${p.pos} · ${p.age}세 · #${p.num}${status}</small></span>
        <span class="cond">${condBar(p.cond)}<small>${p.season.apps}경기 ${p.season.goals}골</small></span>
        <span class="ovr ${aCls(o)}">${o}</span></button>`;
    }).join('');
    const seg = (key, opts) => `<div class="seg">${opts.map(([v, n]) => `<button class="${u.tactic[key] === v ? 'on' : ''}" data-act="tactic" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
    return `
      <div class="squad">
        <div class="card">
          <h3>전술</h3>
          <div class="tactic-row"><span class="lab">포메이션</span>
            <select data-act="formation">${Object.keys(KM.FORMATIONS).map((f) => `<option ${f === u.tactic.formation ? 'selected' : ''}>${f}</option>`).join('')}</select>
            <button class="btn small" data-act="auto">자동 선발</button>
          </div>
          <div class="fpitch">${slots}</div>
          <div class="tactic-row"><span class="lab">경기 성향</span>${seg('mentality', [[-1, '수비적'], [0, '균형'], [1, '공격적']])}</div>
          <div class="tactic-row"><span class="lab">압박 강도</span>${seg('press', [[0, '낮음'], [1, '보통'], [2, '높음']])}</div>
          <p class="hint">${UI.selSlot != null ? '<b style="color:var(--accent)">포지션 선택됨</b> — 오른쪽 목록에서 투입할 선수를 누르세요.' : '경기장의 포지션을 누른 뒤 <span class="desk-only">오른쪽 목록에서 </span>선수를 고르면 교체됩니다. 선수 이름을 누르면 상세 정보를 볼 수 있습니다.'}<br>주황 테두리는 본래 포지션이 아닌 선수입니다(능력치 감소). 압박이 높을수록 체력 소모가 큽니다.</p>
        </div>
        <div class="card">
          <h3>선수 명단 <span class="muted">${u.players.length}명</span></h3>
          <div class="mlist mob-only">${mrows}</div>
          <div class="tbl-wrap desk-only"><table class="tbl">
            <thead><tr><th></th><th class="num">#</th><th>이름</th><th>포지션</th><th class="num">나이</th><th class="num">OVR</th>
            <th class="num" title="속도">속</th><th class="num" title="슈팅 (GK: 골키핑)">슛</th><th class="num" title="패스">패</th><th class="num" title="드리블">드</th><th class="num" title="수비">수</th><th class="num" title="체력">체</th>
            <th>컨디션</th><th class="num">경기</th><th class="num">골</th><th class="num">도움</th><th class="num">평점</th></tr></thead>
            <tbody>${rows}</tbody></table></div>
          <p class="hint desk-only" style="margin-top:8px">골키퍼는 [골키핑 · 패스 · 체력] 순으로 표시됩니다.</p>
        </div>
      </div>`;
  }

  function assignSlot(u, i, p) {
    const j = u.lineup.indexOf(p.id);
    if (j >= 0) { const tmp = u.lineup[i]; u.lineup[i] = p.id; u.lineup[j] = tmp; }
    else u.lineup[i] = p.id;
  }

  function slotPicker(i) {
    const u = userTeam(), form = KM.FORMATIONS[u.tactic.formation], role = form[i][0];
    const cur = u.players.find((p) => p.id === u.lineup[i]);
    const xi = new Map(u.lineup.map((id, k) => [id, k]));
    const list = u.players.filter((p) => p !== cur)
      .map((p) => ({ p, eff: Math.round(KM.ovrAs(p, role)) }))
      .sort((a, b) => G.available(b.p) - G.available(a.p) || b.eff - a.eff);
    openModal(`<h2>${role} 자리에 투입할 선수</h2>
      <p class="muted" style="margin:-6px 0 12px;font-size:13px">현재 <b style="color:var(--text)">${esc(cur.name)}</b> (${cur.pos}) · 이 자리 능력치 ${Math.round(KM.ovrAs(cur, role))}</p>
      <div class="mlist">${list.map(({ p, eff }) => {
        const where = xi.has(p.id) ? `${form[xi.get(p.id)][0]} 출전 중 ↔ 자리 교환` : '벤치';
        const status = p.injury > 0 ? ` · <span class="status inj">부상</span>` : p.ban > 0 ? ' · <span class="status ban">징계</span>' : '';
        return `<button class="mrow" data-act="slot-pick" data-i="${i}" data-id="${p.id}" ${G.available(p) ? '' : 'disabled'}>
          <span class="ovr ${aCls(eff)}">${eff}</span>
          <span class="info"><b>${esc(p.name)}</b><small>${p.pos}${p.pos !== role ? ' (포지션 외)' : ''} · ${where}${status}</small></span>
          <span class="cond">${condBar(p.cond)}<small>컨디션 ${Math.round(p.cond)}%</small></span></button>`;
      }).join('')}</div>
      <div class="foot"><button class="btn" data-act="close">닫기</button></div>`, 'sm');
  }

  function playerModal(p) {
    const t = st().teams.find((x) => x.players.includes(p));
    const o = KM.ovr(p);
    const potTxt = p.pot - o >= 10 ? '★★★ 대형 유망주' : p.pot - o >= 5 ? '★★ 성장 가능성 높음' : p.pot - o >= 2 ? '★ 약간의 성장 여지' : '완성형';
    const attrs = (p.pos === 'GK' ? ['gk', 'pas', 'phy', 'pac'] : ['pac', 'sho', 'pas', 'dri', 'def', 'phy'])
      .map((k) => `<div class="attr"><div class="top"><span>${KM.ATTR_KO[k]}</span><span>${p.a[k]}</span></div><div class="bar"><span style="width:${p.a[k]}%;background:${condColor(p.a[k] + 15)}"></span></div></div>`).join('');
    const avg = p.season.apps ? (p.season.ratingSum / p.season.apps).toFixed(2) : '-';
    openModal(`
      <div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
        <span class="ovr ${aCls(o)}" style="font-size:22px;height:52px;min-width:56px;border-radius:12px">${o}</span>
        <div><h2 style="margin:0">${esc(p.name)} <span class="muted" style="font-size:14px">#${p.num}</span></h2>
        <div class="muted" style="font-size:13px">${KM.POS_KO[p.pos]} · ${p.age}세 · ${esc(t.name)} · ${potTxt}</div></div>
      </div>
      <div class="attr-grid">${attrs}</div>
      <div class="grid2" style="margin-top:16px">
        <div class="card" style="padding:12px"><h3>이번 시즌</h3>경기 <b>${p.season.apps}</b> · 골 <b>${p.season.goals}</b> · 도움 <b>${p.season.assists}</b> · 평점 <b>${avg}</b> · MOM <b>${p.season.mom}</b></div>
        <div class="card" style="padding:12px"><h3>통산</h3>경기 <b>${p.career.apps}</b> · 골 <b>${p.career.goals}</b> · 도움 <b>${p.career.assists}</b></div>
      </div>
      <div style="margin-top:12px;font-size:13px">컨디션 ${condBar(p.cond)}
        ${p.injury > 0 ? `<p class="status inj">부상 — ${p.injury}경기 결장 예정</p>` : ''}${p.ban > 0 ? '<p class="status ban">출전 정지 — 다음 경기 결장</p>' : ''}</div>
      <div class="foot"><button class="btn" data-act="close">닫기</button></div>`, 'sm');
  }

  // ---------- 훈련 ----------
  function trainingTab() {
    const s = st(), u = userTeam();
    const cards = Object.entries(G.TRAININGS).map(([k, t]) => `
      <button class="train ${s.training === k ? 'on' : ''}" data-act="train" data-k="${k}">
        <div class="ic">${t.icon}</div><div class="nm">${t.name}</div><p>${t.desc}</p>
        <p style="margin-top:8px">회복 <b style="color:var(--text)">+${t.rec}</b> · 성장 <b style="color:var(--text)">${t.growth === 0 ? '없음' : t.growth > 1 ? '집중' : '보통'}</b></p>
      </button>`).join('');
    const avgCond = Math.round(u.players.reduce((a, p) => a + p.cond, 0) / u.players.length);
    const tired = u.players.filter((p) => p.cond < 70).sort((a, b) => a.cond - b.cond);
    const young = u.players.filter((p) => p.age <= 23).sort((a, b) => (b.pot - KM.ovr(b)) - (a.pot - KM.ovr(a))).slice(0, 6);
    return `
      <div class="card"><h3>주간 훈련 계획 <span class="muted">경기 후 적용됩니다</span></h3><div class="train-grid">${cards}</div></div>
      <div class="grid2">
        <div class="card"><h3>컨디션 관리 <span class="muted">팀 평균 ${avgCond}%</span></h3>
          ${tired.length ? tired.map((p) => `<div class="pl" style="grid-template-columns:1fr 90px;margin-bottom:6px"><span class="nm">${esc(p.name)} <small>${p.pos}</small></span>${condBar(p.cond)}</div>`).join('') : '<p class="muted">모든 선수의 컨디션이 좋습니다.</p>'}
          <p class="hint" style="margin-top:8px">컨디션이 낮으면 경기 중 속도와 능력치가 떨어지고 부상 위험이 커집니다.</p></div>
        <div class="card"><h3>유망주 <span class="muted">23세 이하</span></h3>
          ${young.length ? young.map((p) => `<div class="pl" style="grid-template-columns:1fr auto auto;margin-bottom:6px"><span class="nm">${esc(p.name)} <small>${p.pos} · ${p.age}세</small></span><span class="ovr ${aCls(KM.ovr(p))}">${KM.ovr(p)}</span><span class="muted" style="font-size:11px">${p.pot - KM.ovr(p) >= 8 ? '🔥 고성장' : p.pot - KM.ovr(p) >= 4 ? '📈 성장중' : '—'}</span></div>`).join('') : '<p class="muted">유망주가 없습니다.</p>'}
          <p class="hint" style="margin-top:8px">어린 선수일수록 훈련 효과가 큽니다. 시즌이 끝나면 한 번 더 성장합니다.</p></div>
      </div>`;
  }

  // ---------- 일정 ----------
  function scheduleTab() {
    const s = st();
    return `<div class="card"><h3>시즌 일정 <span class="muted">경기를 누르면 상세 결과</span></h3><div class="rounds">
      ${s.fixtures.map((round, r) => `<div class="round ${r === s.round && !s.seasonOver ? 'cur' : ''}"><h4><span>${r + 1}라운드</span>${r === s.round && !s.seasonOver ? '<span style="color:var(--accent)">다음</span>' : ''}</h4>
        ${round.map((fx) => fxLine(fx, true)).join('')}</div>`).join('')}
    </div></div>`;
  }

  function fxModal(fx) {
    const s = st();
    const h = teamById(fx.h), a = teamById(fx.a), res = fx.res;
    const goals = (side) => res.goals.filter((g) => g.team === side).map((g) => `${g.min}' ${esc(g.scorer)}${g.pen ? ' (PK)' : ''}`).join('<br>') || '-';
    const rows = (side) => res.ratings[side].slice().sort((x, y) => y.rating - x.rating).map((r) => `<tr><td>${esc(r.name)} <span class="muted">${r.role}</span></td><td class="num">${r.mins}'</td><td class="num">${r.goals || ''}</td><td class="num">${r.assists || ''}</td><td class="num"><b class="${rCls(r.rating)}">${r.rating.toFixed(1)}</b></td></tr>`).join('');
    openModal(`
      <div class="result-head">
        <div class="tm">${crest(h, 'lg')}${esc(h.name)}</div><div class="sc">${res.hg} - ${res.ag}</div><div class="tm">${crest(a, 'lg')}${esc(a.name)}</div>
      </div>
      <div class="scorers"><div class="r">${goals(0)}</div><div>${goals(1)}</div></div>
      ${statBars(res.stats, h, a)}
      ${res.mom ? `<p style="text-align:center;margin:14px 0">⭐ 경기 최우수 선수: <b>${esc(res.mom.name)}</b> (${res.mom.rating.toFixed(1)})</p>` : ''}
      <div class="sub-cols">
        <div><h3 style="font-size:13px">${esc(h.name)}</h3><table class="tbl"><thead><tr><th>선수</th><th class="num">출전</th><th class="num">골</th><th class="num">도움</th><th class="num">평점</th></tr></thead><tbody>${rows(0)}</tbody></table></div>
        <div><h3 style="font-size:13px">${esc(a.name)}</h3><table class="tbl"><thead><tr><th>선수</th><th class="num">출전</th><th class="num">골</th><th class="num">도움</th><th class="num">평점</th></tr></thead><tbody>${rows(1)}</tbody></table></div>
      </div>
      <div class="foot"><button class="btn" data-act="close">닫기</button></div>`);
    void s;
  }

  function statBars(stats, h, a) {
    const ak = KM.colorDist(h.kit[0], a.kit[0]) < 140 ? a.away : a.kit;
    const row = (lbl, x, y, suf = '') => {
      const tot = x + y || 1;
      return `<div class="stat-row"><div class="top"><span>${x}${suf}</span><span>${lbl}</span><span>${y}${suf}</span></div>
        <div class="cmp-bar"><span style="width:${x / tot * 100}%;background:${h.kit[0]}"></span><span style="width:${y / tot * 100}%;background:${ak[0]}"></span></div></div>`;
    };
    const [s0, s1] = stats;
    const pct = (s) => (s.passes ? Math.round(s.passOk / s.passes * 100) : 0);
    return `<div class="stat-rows">
      ${row('점유율', s0.poss ?? s0.possPct, s1.poss ?? s1.possPct, '%')}
      ${row('슈팅', s0.shots, s1.shots)}
      ${row('유효 슈팅', s0.onT, s1.onT)}
      ${row('패스 성공률', pct(s0), pct(s1), '%')}
      ${row('코너킥', s0.corners, s1.corners)}
      ${row('파울', s0.fouls, s1.fouls)}
    </div>`;
  }

  // ---------- 기록 ----------
  function statsTab() {
    const s = st();
    const board = (title, key, fmt, minApps = 0) => {
      const rows = G.leaders(key, 10, minApps);
      return `<div class="card"><h3>${title}</h3>${rows.length ? `<table class="tbl"><tbody>${rows.map((r, i) => `<tr class="${r.t.id === s.userTeam ? 'me' : ''}"><td class="num">${i + 1}</td><td><b>${esc(r.p.name)}</b> <span class="muted">${r.p.pos}</span></td><td>${crest(r.t, 'sm')} <span class="muted">${esc(r.t.short)}</span></td><td class="num"><b>${fmt(r.val)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="muted">기록이 없습니다.</p>'}</div>`;
    };
    const hist = s.history.length
      ? `<table class="tbl"><thead><tr><th>시즌</th><th>순위</th><th>승점</th><th>목표</th><th>우승팀</th></tr></thead><tbody>${s.history.slice().reverse().map((h) => `<tr><td>${h.year}</td><td><b>${h.pos}위</b></td><td>${h.pts}</td><td>${h.met ? '✅ 달성' : '❌ 실패'}</td><td>${esc(h.champion)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">첫 시즌을 치르는 중입니다.</p>';
    return `
      <div class="grid2">
        ${board('득점 순위', 'goals', (v) => v + '골')}
        ${board('도움 순위', 'assists', (v) => v + '도움')}
      </div>
      <div class="grid2">
        ${board('평균 평점', 'rating', (v) => v.toFixed(2), Math.max(1, Math.floor(s.round / 2)))}
        <div class="card"><h3>구단 역사</h3>${hist}</div>
      </div>`;
  }

  // ---------- 메뉴 / 시즌 종료 ----------
  function menuModal() {
    openModal(`<h2>메뉴</h2>
      <p class="muted" style="margin-top:0">게임은 매 라운드 종료 시 이 브라우저에 자동 저장됩니다.</p>
      <div style="display:grid;gap:8px">
        <button class="btn" data-act="save">지금 저장</button>
        <button class="btn" data-act="title">타이틀 화면으로</button>
        <button class="btn danger" data-act="reset">저장 삭제 후 새 게임</button>
      </div>
      <div class="foot"><button class="btn" data-act="close">닫기</button></div>`, 'sm');
  }

  function seasonEndModal() {
    const s = st();
    const sum = G.seasonSummary();
    const u = userTeam();
    const champ = sum.champion.id === u.id;
    const verdict = champ ? '🏆 리그 우승! 구단 역사에 이름을 새겼습니다!'
      : sum.met ? '이사회가 목표 달성에 만족합니다. 재계약 확정!'
        : sum.pos - s.objective >= 3 ? '이사회가 크게 실망했습니다. 다음 시즌이 마지막 기회입니다.'
          : '목표에 조금 못 미쳤습니다. 다음 시즌 분발이 필요합니다.';
    const award = (lbl, x, f) => (x ? `<div class="pl" style="grid-template-columns:90px 1fr auto"><span class="muted">${lbl}</span><span class="nm">${esc(x.p.name)} <small>${esc(x.t.name)}</small></span><b>${f(x.val)}</b></div>` : '');
    openModal(`
      <h2>${s.year} 시즌 결산</h2>
      <div class="objective" style="margin-bottom:12px">
        <div class="big ${sum.met ? 'ok' : 'no'}">${sum.pos}위</div>
        <div><div style="font-weight:700">${verdict}</div><div class="muted" style="font-size:12px;margin-top:4px">목표: ${G.objectiveText()} · 우승: ${esc(sum.champion.name)}</div></div>
      </div>
      <div class="pl-list" style="margin-bottom:14px">
        ${award('득점왕', sum.scorer, (v) => v + '골')}
        ${award('도움왕', sum.assister, (v) => v + '도움')}
        ${award('MVP', sum.best, (v) => '평점 ' + v.toFixed(2))}
      </div>
      ${tableHtml(false)}
      <p class="hint" style="margin-top:12px">다음 시즌이 시작되면 선수들의 나이가 한 살 늘고, 젊은 선수는 성장하며 노장 선수는 은퇴할 수 있습니다.</p>
      <div class="foot"><button class="btn" data-act="close">닫기</button><button class="btn primary" data-act="next-season">다음 시즌 시작 ▶</button></div>`);
  }

  // ---------- 이벤트 ----------
  app.addEventListener('click', onClick);
  modalRoot.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-bg') && !modalRoot.querySelector('[data-lock]')) { closeModal(); return; }
    onClick(e);
  });
  app.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="formation"]');
    if (!el) return;
    const u = userTeam();
    u.tactic.formation = el.value;
    G.autoLineup(u);
    UI.selSlot = null;
    G.save();
    render();
    toast(`포메이션 ${el.value} 적용 — 선발 명단이 자동 재구성되었습니다.`);
  });

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const u = G.state ? userTeam() : null;
    switch (act) {
      case 'new':
        if (G.hasSave() && !confirm('기존 저장 데이터를 덮어쓰고 새 게임을 시작할까요?')) return;
        go('pick'); break;
      case 'continue':
        if (G.load()) { UI.tab = 'home'; go('hub'); } else toast('저장 데이터를 불러오지 못했습니다.');
        break;
      case 'title': closeModal(); go('title'); break;
      case 'install':
        if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; if (UI.screen === 'title') { stopDemo(); renderTitle(); } }); }
        break;
      case 'pick': G.newGame(+el.dataset.i); UI.tab = 'home'; UI.selSlot = null; go('hub'); break;
      case 'tab': UI.tab = el.dataset.tab; UI.selSlot = null; render(); window.scrollTo(0, 0); break;
      case 'menu': menuModal(); break;
      case 'close': closeModal(); break;
      case 'save': toast(G.save() ? '저장되었습니다.' : '저장에 실패했습니다.'); closeModal(); break;
      case 'reset':
        if (confirm('저장 데이터를 삭제할까요? 되돌릴 수 없습니다.')) { G.deleteSave(); G.state = null; closeModal(); go('pick'); }
        break;
      case 'tactic':
        u.tactic[el.dataset.k] = +el.dataset.v; G.save(); render(); break;
      case 'auto': G.autoLineup(u); UI.selSlot = null; G.save(); render(); toast('최적의 선발 명단을 구성했습니다.'); break;
      case 'slot-pick': {
        const p = u.players.find((x) => x.id === +el.dataset.id);
        assignSlot(u, +el.dataset.i, p);
        closeModal(); UI.selSlot = null; G.save(); render();
        toast(`${p.name} 선수를 배치했습니다.`);
        break;
      }
      case 'slot': {
        const i = +el.dataset.i;
        if (isMobile()) { slotPicker(i); break; }
        UI.selSlot = UI.selSlot === i ? null : i;
        render(); break;
      }
      case 'player': {
        const p = u.players.find((x) => x.id === +el.dataset.id);
        if (UI.selSlot == null) { playerModal(p); break; }
        if (!G.available(p)) { toast(`${p.name} 선수는 출전할 수 없습니다.`); break; }
        assignSlot(u, UI.selSlot, p);
        UI.selSlot = null; G.save(); render(); break;
      }
      case 'train': st().training = el.dataset.k; G.save(); render(); toast(`${G.TRAININGS[el.dataset.k].name}으로 설정했습니다.`); break;
      case 'fx': fxModal(st().fixtures[+el.dataset.r][+el.dataset.m]); break;
      case 'play': startMatch(); break;
      case 'season-end': seasonEndModal(); break;
      case 'next-season': {
        G.startNextSeason(); closeModal(); UI.tab = 'home'; render();
        toast(`${st().year} 시즌이 시작되었습니다!`);
        break;
      }
      default:
        if (MatchUI.handle(act, el)) return;
    }
  }

  // =====================================================================
  //  경기 화면
  // =====================================================================
  const SPEEDS = [[2, '×1'], [4, '×2'], [8, '×4'], [16, '×8']];
  const MatchUI = {
    m: null, raf: 0, paused: false, speed: 1, sideTab: 'feed', lastSide: 0, skipping: false,

    start(fx) {
      const self = this;
      this.fx = fx;
      this.paused = false;
      this.skipping = false;
      this.sideTab = 'feed';
      this.m = G.makeMatch(fx, { onEvent: (ev) => self.onEvent(ev) });
      this.side = this.m.userSide;
      this.build();
      const layout = () => ({
        fit: window.matchMedia('(min-width: 1001px), (max-height: 500px) and (orientation: landscape)').matches || isMobile(),
        vertical: isMobile() && isPortrait(),
      });
      const l0 = layout();
      this.renderer = new KM.Renderer(this.cv, l0.fit, l0.vertical);
      this.ro = new ResizeObserver(() => {
        const l = layout();
        this.renderer.fitHeight = l.fit;
        this.renderer.vertical = l.vertical;
        this.renderer.resize(); this.renderer.draw(this.m);
      });
      this.lockScreen();
      this.ro.observe(this.cv.parentElement);
      this.m.events.forEach((ev) => this.addFeed(ev));
      this.last = performance.now();
      this.acc = 0;
      this.raf = requestAnimationFrame((t) => this.frame(t));
      document.addEventListener('keydown', this.onKey);
    },

    onKey(e) {
      if (UI.screen !== 'match') return;
      if (e.code === 'Space' && !modalRoot.innerHTML) { e.preventDefault(); MatchUI.togglePause(); }
    },

    build() {
      const m = this.m, [h, a] = m.teams;
      UI.screen = 'match';
      const my = m.teams[this.side];
      const seg = (key, opts) => `<div class="seg" data-seg="${key}">${opts.map(([v, n]) => `<button class="${my.tactic[key] === v ? 'on' : ''}" data-act="m-tactic" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
      app.innerHTML = `
        <div class="match">
          <div class="scorebar">
            <div class="sb-team">${crest(h, '', h.kit)}<span class="nm full">${esc(h.name)}</span><span class="nm short">${esc(h.name.split(' ')[0])}</span></div>
            <div class="sb-mid"><div class="sb-score"><span id="sc0">0</span><span class="d">:</span><span id="sc1">0</span></div><div class="sb-clock" id="clock">00:00</div></div>
            <div class="sb-team away"><span class="nm full">${esc(a.name)}</span><span class="nm short">${esc(a.name.split(' ')[0])}</span>${crest(a, '', a.kit)}</div>
          </div>
          <div class="match-body">
            <div class="pitch-wrap"><canvas id="pitch"></canvas><div class="pitch-overlay hidden" id="overlay"></div></div>
            <aside class="match-side">
              <div class="side-tabs">
                <button class="on" data-act="m-side" data-t="feed">중계</button>
                <button data-act="m-side" data-t="stats">기록</button>
                <button data-act="m-side" data-t="players">우리 선수</button>
              </div>
              <div class="side-body" id="side-body"><ul class="feed" id="feed"></ul><div id="side-alt" class="hidden"></div></div>
            </aside>
          </div>
          <div class="match-controls">
            <button class="btn icon-btn ctl" data-act="m-pause" id="pause-btn" title="일시정지 (Space)">⏸</button>
            <div class="seg desk-only" id="speed-seg">${SPEEDS.map(([, n], i) => `<button class="${i === this.speed ? 'on' : ''}" data-act="m-speed" data-i="${i}">${n}</button>`).join('')}</div>
            <button class="btn mob-only ctl" data-act="m-speed-cycle" id="speed-cycle"><b>${SPEEDS[this.speed][1]}</b><small>배속</small></button>
            <div class="grp desk-only"><span class="lab">성향</span>${seg('mentality', [[-1, '수비'], [0, '균형'], [1, '공격']])}</div>
            <div class="grp desk-only"><span class="lab">압박</span>${seg('press', [[0, '낮음'], [1, '보통'], [2, '높음']])}</div>
            <span class="sp desk-only"></span>
            <button class="btn small desk-only" data-act="m-names">이름 표시</button>
            <button class="btn mob-only ctl" data-act="m-tactics"><b>📋</b><small>전술</small></button>
            <button class="btn ctl" data-act="m-subs" id="subs-btn"><b class="mob-only">🔁</b><small class="mob-only">교체 <span class="subs-n">${my.subsLeft}</span></small><span class="desk-only">교체 (<span class="subs-n">${my.subsLeft}</span>)</span></button>
            <button class="btn ctl" data-act="m-skip" title="경기 끝까지 바로 진행"><b class="mob-only">⏭</b><small class="mob-only">결과로</small><span class="desk-only">⏭ 결과로</span></button>
          </div>
        </div>`;
      this.cv = document.getElementById('pitch');
      this.feed = document.getElementById('feed');
    },

    frame(now) {
      const m = this.m;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !m.finished) {
        this.acc += dt * SPEEDS[this.speed][0];
        let n = 0;
        while (this.acc >= KM.PITCH.DT && n < 600 && !this.paused && !m.finished) { m.step(); this.acc -= KM.PITCH.DT; n++; }
      }
      this.renderer.draw(m);
      document.getElementById('clock').textContent = m.half === 1 && m.mode === 'halftime' ? '하프타임' : m.finished ? '경기 종료' : m.clock();
      if (now - this.lastSide > 500) { this.lastSide = now; this.updateSide(); }
      this.raf = requestAnimationFrame((t) => this.frame(t));
    },

    onEvent(ev) {
      if (!this.feed) return;
      this.addFeed(ev);
      const m = this.m;
      if (ev.type === 'goal') {
        const tm = m.teams[ev.team];
        const el = document.getElementById('sc' + ev.team);
        el.textContent = tm.score;
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        if (!this.skipping && ev.team === this.side && navigator.vibrate) { try { navigator.vibrate([120, 60, 220]); } catch (e) { /* 무시 */ } }
        if (!this.skipping) this.renderer.flash = { text: 'GOAL!', sub: `${ev.scorer} · ${ev.min}'`, color: tm.kit[0] === '#f8fafc' || tm.kit[0] === '#ffffff' ? '#a3e635' : tm.kit[0], until: performance.now() + 2600 };
      }
      if (ev.type === 'sub') this.refreshSubsBtn();
      if (ev.type === 'half' && !this.skipping) { this.paused = true; this.showOverlay('half'); }
      if (ev.type === 'full') { this.paused = true; this.showOverlay('full'); }
    },

    addFeed(ev) {
      const li = document.createElement('li');
      li.className = ev.type;
      const tm = ev.team >= 0 ? this.m.teams[ev.team] : null;
      li.innerHTML = `<span class="mn">${ev.min}'</span><span>${tm ? `<i class="dot" style="background:${tm.kit[0]}"></i>` : ''}${esc(ev.text)}</span>`;
      this.feed.prepend(li);
    },

    updateSide() {
      if (this.sideTab === 'feed') return;
      const alt = document.getElementById('side-alt');
      const m = this.m, [h, a] = m.teams;
      if (this.sideTab === 'stats') {
        const r = m.result();
        alt.innerHTML = statBars(r.stats.map((s) => Object.assign({}, s, { poss: s.possPct })), h, a);
      } else {
        const my = m.teams[this.side];
        alt.innerHTML = `<div class="pl-list">${my.onPitch.map((p) => `
          <div class="pl"><span class="n">${p.num}</span><span class="nm">${esc(p.name)}<small>${p.role}${p.s.goals ? ' ⚽'.repeat(p.s.goals) : ''}${p.s.yellow ? ' 🟨' : ''}</small></span>${condBar(Math.round(p.energy))}</div>`).join('')}</div>
          <p class="hint" style="margin-top:10px">체력이 낮은 선수는 느려지고 실수가 늘어납니다. 교체 버튼으로 바꿔주세요. (남은 교체 ${my.subsLeft}회)</p>`;
      }
    },

    refreshSubsBtn() {
      const b = document.getElementById('subs-btn');
      if (b) { const n = this.m.teams[this.side].subsLeft; b.querySelectorAll('.subs-n').forEach((x) => { x.textContent = n; }); b.disabled = n <= 0; }
    },

    showOverlay(kind) {
      const ov = document.getElementById('overlay');
      const m = this.m, [h, a] = m.teams;
      ov.classList.remove('hidden');
      if (kind === 'half') {
        const r = m.result();
        ov.innerHTML = `<div class="overlay-card"><h2>하프타임</h2><p class="muted" style="margin:0 0 14px">${esc(h.name)} ${h.score} : ${a.score} ${esc(a.name)}</p>
          ${statBars(r.stats.map((s) => Object.assign({}, s, { poss: s.possPct })), h, a)}
          <div class="btns"><button class="btn" data-act="m-subs">선수 교체</button><button class="btn primary" data-act="m-resume">후반전 시작 ▶</button></div></div>`;
      } else {
        const my = m.teams[this.side], op = m.teams[1 - this.side];
        const w = my.score > op.score ? '승리!' : my.score === op.score ? '무승부' : '패배';
        ov.innerHTML = `<div class="overlay-card"><h2>경기 종료</h2><p style="font-size:22px;font-weight:900;margin:4px 0">${esc(h.short)} ${h.score} : ${a.score} ${esc(a.short)}</p>
          <p class="muted" style="margin:0">${w}</p>
          <div class="btns"><button class="btn primary big" data-act="m-finish" data-lock>결과 확인 ▶</button></div></div>`;
      }
    },

    togglePause() {
      if (this.m.finished) return;
      if (!document.getElementById('overlay').classList.contains('hidden')) return;
      this.paused = !this.paused;
      document.getElementById('pause-btn').textContent = this.paused ? '▶' : '⏸';
    },

    subsModal() {
      const m = this.m, my = m.teams[this.side];
      if (my.subsLeft <= 0) { toast('남은 교체 카드가 없습니다.'); return; }
      const wasPaused = this.paused;
      this.paused = true;
      let outId = null, inId = null;
      const draw = () => {
        const bg = openModal(`<h2>선수 교체 <span class="muted" style="font-size:13px">남은 교체 ${my.subsLeft}회</span></h2>
          <div class="sub-cols">
            <div><h3 style="font-size:13px">나갈 선수</h3><div class="sub-list">${my.onPitch.map((p) => `
              <button class="sub-item ${outId === p.id ? 'on' : ''}" data-act="m-out" data-id="${p.id}"><b>${p.role}</b><span>${esc(p.name)} <span class="muted">${p.pos !== p.role ? '(' + p.pos + ')' : ''}${p.s.yellow ? ' 🟨' : ''}</span></span><span class="muted">${Math.round(p.energy)}%</span>${condBar(Math.round(p.energy))}</button>`).join('')}</div></div>
            <div><h3 style="font-size:13px">들어갈 선수</h3><div class="sub-list">${my.bench.length ? my.bench.map((p) => `
              <button class="sub-item ${inId === p.id ? 'on' : ''}" data-act="m-in" data-id="${p.id}"><b>${p.pos}</b><span>${esc(p.name)}</span><span class="ovr ${aCls(KM.ovr(p))}">${KM.ovr(p)}</span>${condBar(p.cond)}</button>`).join('') : '<p class="muted">교체 가능한 선수가 없습니다.</p>'}</div></div>
          </div>
          <div class="foot"><button class="btn" data-act="m-sub-cancel">취소</button><button class="btn primary" data-act="m-sub-ok" ${outId && inId ? '' : 'disabled'}>교체 실행</button></div>`);
        bg.querySelector('.modal').setAttribute('data-lock', '');
      };
      this.subState = {
        draw, wasPaused,
        setOut: (id) => { outId = id; draw(); },
        setIn: (id) => { inId = id; draw(); },
        ok: () => {
          if (m.substitute(this.side, outId, inId)) toast('교체 완료');
          closeModal();
          this.paused = this.isOverlayOpen() ? true : wasPaused;
          this.updateSide();
        },
      };
      draw();
    },

    tacticsSheet() {
      const my = this.m.teams[this.side];
      this.sheetPaused = this.paused;
      this.paused = true;
      const seg = (key, opts) => `<div class="seg wide">${opts.map(([v, n]) => `<button class="${my.tactic[key] === v ? 'on' : ''}" data-act="m-tactic" data-k="${key}" data-v="${v}">${n}</button>`).join('')}</div>`;
      const bg = openModal(`<h2>전술 지시</h2>
        <div class="tactic-row"><span class="lab">경기 성향</span>${seg('mentality', [[-1, '수비적'], [0, '균형'], [1, '공격적']])}</div>
        <div class="tactic-row"><span class="lab">압박 강도</span>${seg('press', [[0, '낮음'], [1, '보통'], [2, '높음']])}</div>
        <p class="hint">공격적일수록 라인을 올리고 과감하게 슈팅합니다. 압박이 높을수록 공을 빨리 되찾지만 체력 소모가 큽니다.</p>
        <div class="foot"><button class="btn ${this.renderer.showNames ? 'primary' : ''}" data-act="m-names">선수 이름 표시</button><button class="btn primary" data-act="m-sheet-close">확인</button></div>`, 'sm');
      bg.querySelector('.modal').setAttribute('data-lock', '');
    },

    async lockScreen() {
      try { if (navigator.wakeLock) this.wake = await navigator.wakeLock.request('screen'); } catch (e) { this.wake = null; }
    },

    isOverlayOpen() { const o = document.getElementById('overlay'); return o && !o.classList.contains('hidden'); },

    handle(act, el) {
      if (!act.startsWith('m-')) return false;
      const m = this.m;
      switch (act) {
        case 'm-pause': this.togglePause(); break;
        case 'm-speed':
        case 'm-speed-cycle':
          this.speed = act === 'm-speed' ? +el.dataset.i : (this.speed + 1) % SPEEDS.length;
          document.querySelectorAll('#speed-seg button').forEach((b, i) => b.classList.toggle('on', i === this.speed));
          document.querySelector('#speed-cycle b').textContent = SPEEDS[this.speed][1];
          break;
        case 'm-tactics': this.tacticsSheet(); break;
        case 'm-tactic': {
          const k = el.dataset.k, v = +el.dataset.v;
          m.setTactic(this.side, { [k]: v });
          document.querySelectorAll(`[data-act="m-tactic"][data-k="${k}"]`).forEach((b) => b.classList.toggle('on', +b.dataset.v === v));
          this.addFeed({ type: 'info', text: `📋 전술 변경: ${k === 'mentality' ? ['수비적', '균형', '공격적'][v + 1] + ' 운영' : '압박 ' + ['낮음', '보통', '높음'][v]}`, team: this.side, min: m.minute() });
          break;
        }
        case 'm-side': {
          this.sideTab = el.dataset.t;
          el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
          document.getElementById('feed').classList.toggle('hidden', this.sideTab !== 'feed');
          document.getElementById('side-alt').classList.toggle('hidden', this.sideTab === 'feed');
          this.updateSide();
          break;
        }
        case 'm-names':
          this.renderer.showNames = !this.renderer.showNames;
          document.querySelectorAll('[data-act="m-names"]').forEach((b) => b.classList.toggle('primary', this.renderer.showNames));
          break;
        case 'm-sheet-close': closeModal(); this.paused = this.isOverlayOpen() ? true : this.sheetPaused; break;
        case 'm-subs': this.subsModal(); break;
        case 'm-out': this.subState.setOut(+el.dataset.id); break;
        case 'm-in': this.subState.setIn(+el.dataset.id); break;
        case 'm-sub-ok': this.subState.ok(); break;
        case 'm-sub-cancel': closeModal(); this.paused = this.isOverlayOpen() ? true : this.subState.wasPaused; break;
        case 'm-resume':
          document.getElementById('overlay').classList.add('hidden');
          this.paused = false;
          document.getElementById('pause-btn').textContent = '⏸';
          break;
        case 'm-skip':
          if (m.finished) break;
          this.skipping = true;
          document.getElementById('overlay').classList.add('hidden');
          m.runToEnd();
          break;
        case 'm-finish': this.finish(); break;
        default: return false;
      }
      return true;
    },

    stop() {
      cancelAnimationFrame(this.raf);
      if (this.ro) this.ro.disconnect();
      document.removeEventListener('keydown', this.onKey);
      if (this.wake) { this.wake.release().catch(() => {}); this.wake = null; }
      this.feed = null;
    },

    finish() {
      const m = this.m;
      this.stop();
      const sum = G.finishRound(m);
      UI.screen = 'hub';
      UI.tab = 'home';
      render();
      roundSummaryModal(sum);
    },
  };
  KM.MatchUI = MatchUI;

  function startMatch() {
    const u = userTeam();
    const changed = G.validateLineup(u);
    for (const [o, n] of changed) toast(`${o.name} 출전 불가 → ${n.name} 투입`);
    const fx = G.userFixture();
    closeModal();
    MatchUI.start(fx);
  }

  function roundSummaryModal(sum) {
    const s = st();
    const fx = sum.user.fx, res = fx.res;
    const h = teamById(fx.h), a = teamById(fx.a);
    const side = fx.h === s.userTeam ? 0 : 1;
    const my = side === 0 ? res.hg : res.ag, op = side === 0 ? res.ag : res.hg;
    const w = my > op ? 'W' : my === op ? 'D' : 'L';
    const goals = (sd) => res.goals.filter((g) => g.team === sd).map((g) => `${g.min}' ${esc(g.scorer)}${g.pen ? ' (PK)' : ''}${g.assist ? ` <span style="opacity:.7">(${esc(g.assist)})</span>` : ''}`).join('<br>') || '-';
    const ratings = res.ratings[side].slice().sort((x, y) => y.rating - x.rating);
    const momId = res.mom && res.mom.team === side ? ratings[0].id : null;
    const others = sum.others.map((f) => fxLine(f, false)).join('');
    const moved = sum.posBefore - sum.posAfter;
    const growth = sum.growth.filter((g) => g.ovr1 > g.ovr0);
    const injuries = sum.injuries.filter(([t]) => t.id === s.userTeam);
    openModal(`
      <div class="result-head">
        <div class="tm">${crest(h, 'lg')}${esc(h.name)}</div><div class="sc">${res.hg} - ${res.ag}</div><div class="tm">${crest(a, 'lg')}${esc(a.name)}</div>
      </div>
      <div class="result-word ${w}">${w === 'W' ? '승 리' : w === 'D' ? '무 승 부' : '패 배'}</div>
      <div class="scorers"><div class="r">${goals(0)}</div><div>${goals(1)}</div></div>
      ${statBars(res.stats, h, a)}
      <div class="grid2" style="margin-top:16px">
        <div><h3 style="font-size:13px;margin:0 0 6px">우리 팀 평점</h3>
          <table class="tbl"><tbody>${ratings.map((r) => `<tr><td>${r.id === momId ? '⭐ ' : ''}<b>${esc(r.name)}</b> <span class="muted">${r.role} · ${r.mins}'</span></td><td class="num">${r.goals ? '⚽'.repeat(r.goals) : ''}${r.assists ? '🅰️'.repeat(r.assists) : ''}${r.red ? '🟥' : r.yellow ? '🟨' : ''}</td><td class="num"><b class="${rCls(r.rating)}">${r.rating.toFixed(1)}</b></td></tr>`).join('')}</tbody></table></div>
        <div>
          <h3 style="font-size:13px;margin:0 0 6px">${sum.round}라운드 다른 경기</h3>${others}
          <h3 style="font-size:13px;margin:16px 0 6px">리그 순위</h3>
          <p style="margin:0;font-size:15px"><b>${sum.posAfter}위</b> ${moved > 0 ? `<span style="color:var(--win)">▲${moved}</span>` : moved < 0 ? `<span style="color:var(--loss)">▼${-moved}</span>` : '<span class="muted">-</span>'}</p>
          ${growth.length ? `<h3 style="font-size:13px;margin:16px 0 6px">훈련 성과</h3>${growth.map((g) => `<div style="font-size:12px">📈 ${esc(g.p.name)} ${g.ovr0} → <b>${g.ovr1}</b></div>`).join('')}` : ''}
          ${injuries.length ? `<h3 style="font-size:13px;margin:16px 0 6px">부상자</h3>${injuries.map(([, p]) => `<div style="font-size:12px;color:#fca5a5">🚑 ${esc(p.name)} — ${p.injury}경기 결장</div>`).join('')}` : ''}
        </div>
      </div>
      <div class="foot"><button class="btn primary" data-act="${s.seasonOver ? 'season-end' : 'close'}">${s.seasonOver ? '시즌 결산 보기 ▶' : '계속'}</button></div>`);
  }

  // ---------- 시작 ----------
  go('title');
})(window.KM);
