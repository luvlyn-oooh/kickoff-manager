/* 언더독 컵 - 화면/입력 */
(function (KM) {
  'use strict';
  const C = KM.Cup;
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const S = { screen: 'title', tab: 'journey', run: null, sel: null, reward: null, msg: null };
  KM.CupUI = S;

  // ---------- 헬퍼 ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const crest = (t, size = '') => `<span class="crest ${size}" style="background:${t.kit[0]};color:${t.kit[1]}">${esc(t.short)}</span>`;
  const aCls = (v) => (v >= 80 ? 'a-hi' : v >= 70 ? 'a-good' : v >= 60 ? 'a-mid' : v >= 50 ? 'a-low' : 'a-bad');
  const condColor = (c) => (c >= 80 ? '#4ade80' : c >= 60 ? '#facc15' : c >= 40 ? '#fb923c' : '#f87171');
  const condBar = (c) => `<div class="bar"><span style="width:${Math.max(3, c)}%;background:${condColor(c)}"></span></div>`;
  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const hearts = (r) => '❤️'.repeat(r.hearts) + '<span style="opacity:.25">' + '❤️'.repeat(Math.max(0, r.maxHearts - r.hearts)) + '</span>';
  function toast(text) {
    const el = document.createElement('div');
    el.textContent = text;
    document.getElementById('toast').appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }
  function openModal(html, cls = '') {
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal ${cls}">${html}</div></div>`;
    return modalRoot.firstElementChild;
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  function cardHtml(c, extra = '', attrs = '') {
    const d = C.CARDS[c.id];
    return `<button class="cardui r-${d.rarity} ${c.up ? 'up' : ''} ${extra}" ${attrs}>
      <span class="cc">${C.cardCost(c)}</span><span class="ci">${d.icon}</span>
      <span class="cn">${esc(C.cardName(c))}</span><span class="ct">${esc(C.cardText(c))}</span>
      <span class="cr">${C.RARITY_KO[d.rarity]}${d.exhaust ? ' · 1회용' : ''}</span></button>`;
  }
  const relicRow = (id, attrs = '', tag = 'div') => {
    const r = C.RELICS[id];
    return `<${tag} class="relic-row ${r.boss ? 'boss' : ''}" ${attrs}><span class="ri">${r.icon}</span><span><b>${esc(r.name)}</b><small>${esc(r.text)}</small></span></${tag}>`;
  };
  const traitChips = (opp) => opp.traits.map((t) => `<span class="chip bad">${C.TRAITS[t].icon} ${C.TRAITS[t].name}</span>`).join('')
    + (opp.moves ? `<span class="chip bad">🧠 경기 중 작전 ${opp.moves}회</span>` : '');

  // ---------- 라우팅 ----------
  function go(screen) { S.screen = screen; render(); window.scrollTo(0, 0); }
  function render() {
    const r = S.run;
    switch (S.screen) {
      case 'title': return renderTitle();
      case 'style': return renderStyle();
      case 'hub': return renderHub();
      case 'prematch': return renderPrematch();
      case 'shop': return renderShop();
      case 'camp': return renderCamp();
      case 'event': return renderEvent();
      case 'reward': return renderReward();
      case 'end': return renderEnd();
      default: void r;
    }
  }
  function topBar() {
    const r = S.run;
    const st = C.STAGES[Math.min(r.stage, C.STAGES.length - 1)];
    return `<header class="ctop">${crest(r.club, 'sm')}
      <div class="club"><b>${st.name} · ${r.step >= C.STEPS_PER_STAGE ? '결승' : `${r.step + 1}단계`}</b><small>${esc(r.club.name)}</small></div>
      <div class="res"><span class="hearts">${hearts(r)}</span><span class="gold">💰${r.gold}</span></div>
      <button class="btn small" data-act="menu" aria-label="메뉴">☰</button></header>`;
  }

  // ---------- 타이틀 ----------
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (S.screen === 'title') render(); });
  function renderTitle() {
    const saved = C.Run.load();
    const meta = C.Meta.get();
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    app.innerHTML = `<div class="ctitle"><div>
      <div class="logo-cards">🃏⚽🃏</div>
      <h1>언더독 <span>컵</span></h1>
      <p class="tag">동네 아마추어 팀으로 전국 컵 우승에 도전하세요.<br>경기 중 <b style="color:var(--text)">전술 카드</b>를 실시간으로 꺼내 흐름을 바꾸고,<br>이길수록 강해지는 덱을 만드는 로그라이크 감독 게임.</p>
      <div class="btns">
        ${saved && !saved.over ? `<button class="btn primary big" data-act="continue">이어하기 <small style="opacity:.7">(${C.STAGES[Math.min(saved.stage, 2)].name})</small></button>` : ''}
        <button class="btn ${saved && !saved.over ? '' : 'primary'} big" data-act="new">새 도전</button>
        ${installEvt && !standalone ? '<button class="btn" data-act="install">📲 앱으로 설치</button>' : ''}
        <button class="btn small" data-act="howto">게임 방법</button>
      </div>
      <div class="meta">도전 ${meta.runs}회 · 우승 ${meta.wins}회${meta.best ? ` · 최고 기록 ${bestText(meta.best)}` : ''}</div>
      <div class="meta"><a href="../index.html">⚽ 킥오프 매니저(시즌제 감독 게임) 하러 가기</a></div>
    </div></div>`;
  }
  function bestText(prog) {
    const per = C.STEPS_PER_STAGE + 1;
    if (prog >= per * C.STAGES.length + 1) return '🏆 우승';
    const st = Math.min(Math.floor(prog / per), C.STAGES.length - 1);
    return `${C.STAGES[st].name} ${prog % per + 1}단계`;
  }
  function howto() {
    openModal(`<h2>게임 방법</h2>
      <div style="display:grid;gap:10px;font-size:13px;line-height:1.6">
        <p style="margin:0">🗺️ <b>여정</b> — 매 단계마다 다음 행선지를 고릅니다. 경기 ⚽, 강팀 💀, 이적 시장 🛒, 훈련 캠프 🏕️, 이벤트 ❓. 각 스테이지 마지막엔 결승 🏆이 기다립니다.</p>
        <p style="margin:0">🃏 <b>경기</b> — 경기는 실시간으로 흘러갑니다. 에너지 ⚡는 경기 시간이 흐르면 차오르고, 손에 든 카드를 눌러 즉시 사용합니다. 압박, 역습, 세트피스, 슈퍼 세이브… 타이밍이 승부를 가릅니다. 일시정지 중에도 카드를 쓸 수 있어요.</p>
        <p style="margin:0">⚖️ <b>무승부</b>면 승부차기로 결판냅니다.</p>
        <p style="margin:0">❤️ <b>생명</b> — 지면 ❤️이 줄고(결승은 2개), 모두 잃으면 도전 끝. 3개 스테이지 결승을 모두 이기면 우승!</p>
        <p style="margin:0">🎁 이기면 💰와 새 카드를, 강팀·결승을 이기면 <b>구단 자산</b>(영구 효과)을 얻습니다.</p>
      </div>
      <div class="foot"><button class="btn primary" data-act="close">알겠어요</button></div>`, 'sm');
  }

  function renderStyle() {
    app.innerHTML = `<div class="cup nonav"><div class="sec">
      <button class="btn small" data-act="title" style="justify-self:start">← 돌아가기</button>
      <h2>감독 스타일 선택 <small>시작 덱과 강점이 달라집니다</small></h2>
      ${Object.entries(C.STYLES).map(([k, s]) => `
        <button class="style-card" data-act="style" data-k="${k}">
          <div class="hd"><span>${s.icon}</span>${s.name}</div>
          <p>${s.desc}</p>
          <div class="chips">${s.cards.map((id) => `<span class="chip">${C.CARDS[id].icon} ${C.CARDS[id].name}</span>`).join('')}<span class="chip gold">${C.RELICS[s.relic].icon} ${C.RELICS[s.relic].name}</span></div>
        </button>`).join('')}
    </div></div>`;
  }

  // ---------- 허브 ----------
  const NAV = [['journey', '🗺️', '여정'], ['deck', '🃏', '덱'], ['squad', '👥', '스쿼드'], ['assets', '🏛️', '자산']];
  function renderHub() {
    const r = S.run;
    let body = '';
    if (S.tab === 'deck') body = deckTab();
    else if (S.tab === 'squad') body = squadTab();
    else if (S.tab === 'assets') body = assetsTab();
    else body = journeyTab();
    app.innerHTML = `<div class="cup">${topBar()}${body}</div>
      <nav class="cnav"><div>${NAV.map(([k, i, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}"><span>${i}</span><small>${n}${k === 'deck' ? ` ${r.deck.length}` : ''}</small></button>`).join('')}</div></nav>`;
  }

  function journeyTab() {
    const r = S.run;
    const our = Math.round(r.strength());
    const track = C.STAGES.map((st, si) => {
      const dots = [];
      for (let k = 0; k <= C.STEPS_PER_STAGE; k++) {
        const done = si < r.stage || (si === r.stage && k < r.step);
        const now = si === r.stage && k === r.step;
        const boss = k === C.STEPS_PER_STAGE;
        dots.push(`<i class="${done ? 'done' : ''} ${now ? 'now' : ''} ${boss ? 'boss' : ''}">${boss ? '🏆' : ''}</i>`);
      }
      return `<div class="track-row ${si === r.stage ? 'cur' : ''}"><span>${st.name}</span><span class="dots">${dots.join('')}</span></div>`;
    }).join('');
    const choices = r.choices.map((c, i) => {
      const info = C.NODE_INFO[c.type];
      let detail = '', chips = '';
      if (c.opp) {
        const o = c.opp;
        const diff = o.ovr - our;
        detail = `${crest(o, 'sm')} <b>${esc(o.name)}</b> · <span class="vs-ovr">전력 <span class="${diff > 2 ? 'hi' : diff < -2 ? 'lo' : ''}">${o.ovr}</span> vs ${our}</span>`;
        chips = traitChips(o) + `<span class="chip gold">${c.type === 'boss' ? '🎁 희귀 카드 + 보스 자산 + ❤️1' : c.type === 'elite' ? '🎁 💰 + 카드 + 자산' : '🎁 💰 + 카드'}</span>`;
      } else {
        detail = { shop: '카드 · 선수 · 자산을 💰로 구매합니다.', camp: '휴식, 카드 강화, 선수 훈련 중 하나.', event: '무슨 일이 일어날까요?' }[c.type];
      }
      return `<button class="choice t-${c.type}" data-act="choose" data-i="${i}">
        <span class="ni">${info.icon}</span>
        <span><span class="nt">${info.name}</span><div class="nd">${detail}</div>${chips ? `<div class="chips">${chips}</div>` : ''}</span></button>`;
    }).join('');
    const pending = r.node && r.node.opp && !r.pendingReward
      ? `<button class="choice t-${r.node.type}" data-act="back-prematch"><span class="ni">${C.NODE_INFO[r.node.type].icon}</span><span><span class="nt">경기 준비 중</span><div class="nd">${crest(r.node.opp, 'sm')} <b>${esc(r.node.opp.name)}</b>전 — 눌러서 경기 준비 화면으로</div></span></button>` : '';
    if (pending) return `<div class="sec"><div class="card"><div class="track">${track}</div></div><h2>진행 중</h2>${pending}</div>`;
    return `<div class="sec">
      <div class="card"><div class="track">${track}</div></div>
      <h2>다음 행선지 <small>${r.choices.length > 1 ? '하나를 고르세요' : '피할 수 없는 결승'}</small></h2>
      <div class="choices">${choices}</div>
      <h2>기록</h2><ul class="loglist">${r.log.slice(0, 8).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    </div>`;
  }

  function deckTab() {
    const r = S.run;
    const sorted = r.deck.slice().sort((a, b) => ['basic', 'common', 'uncommon', 'rare', 'curse'].indexOf(C.CARDS[a.id].rarity) - ['basic', 'common', 'uncommon', 'rare', 'curse'].indexOf(C.CARDS[b.id].rarity) || C.cardCost(a) - C.cardCost(b));
    return `<div class="sec"><h2>내 덱 <small>${r.deck.length}장 · 경기마다 섞어서 뽑습니다</small></h2>
      <div class="card-grid">${sorted.map((c) => cardHtml(c, '', 'disabled style="cursor:default"')).join('')}</div></div>`;
  }

  function squadTab() {
    const r = S.run;
    r.validateLineup();
    const form = KM.FORMATIONS[r.formation];
    const xi = r.starters();
    const xiSet = new Set(r.lineup);
    const rest = r.squad.filter((p) => !xiSet.has(p.id)).sort((a, b) => KM.POS_ORDER[a.pos] - KM.POS_ORDER[b.pos] || KM.ovr(b) - KM.ovr(a));
    const row = (p, role) => {
      const eff = role ? Math.round(KM.ovrAs(p, role)) : KM.ovr(p);
      return `<button class="sq-row ${S.sel === p.id ? 'sel' : ''}" data-act="sq" data-id="${p.id}">
        <span class="role ${role ? '' : 'bn'}">${role || p.pos}</span>
        <span class="info"><b>${esc(p.name)} <span class="muted" style="font-weight:500">#${p.num}</span></b><small>${p.pos} · ${p.age}세 · ${p.season.apps}경기 ${p.season.goals}골${role && p.pos !== role ? ' · <span style="color:#fb923c">포지션 외</span>' : ''}</small></span>
        <span>${condBar(p.cond)}</span><span class="ovr ${aCls(eff)}">${eff}</span></button>`;
    };
    return `<div class="sec">
      <div class="tactic-row"><span class="lab">포메이션</span>
        <select data-act="formation">${Object.keys(KM.FORMATIONS).map((f) => `<option ${f === r.formation ? 'selected' : ''}>${f}</option>`).join('')}</select>
        <button class="btn small" data-act="auto">자동 선발</button></div>
      <p class="hint">선수 둘을 차례로 누르면 자리가 바뀝니다. 팀 전력 <b style="color:var(--text)">${Math.round(r.strength())}</b></p>
      <h2>선발 11명</h2><div style="display:grid;gap:6px">${xi.map((p, i) => row(p, form[i][0])).join('')}</div>
      <h2>후보 <small>${rest.length}명 · 체력이 높은 상위 6명이 벤치에 앉습니다</small></h2><div style="display:grid;gap:6px">${rest.map((p) => row(p, null)).join('')}</div>
    </div>`;
  }

  function assetsTab() {
    const r = S.run;
    const st = r.stats;
    return `<div class="sec">
      <h2>구단 자산 <small>${r.relics.length}개 · 항상 적용</small></h2>
      <div style="display:grid;gap:8px">${r.relics.map((id) => relicRow(id)).join('') || '<p class="muted">아직 없습니다.</p>'}</div>
      <h2>이번 도전 기록</h2>
      <div class="card" style="font-size:13px;line-height:1.8">${st.played}경기 ${st.won}승 ${st.drawn}무 ${st.lost}패 · 득점 ${st.gf} · 실점 ${st.ga} · 승부차기 ${st.shootouts}회<br>감독 스타일: ${C.STYLES[r.style].icon} ${C.STYLES[r.style].name}</div>
    </div>`;
  }

  // ---------- 행선지 진입 ----------
  function choose(i) {
    const r = S.run;
    const c = r.choices[i];
    r.node = c;
    if (c.type === 'shop') c.shop = r.genShop();
    if (c.type === 'event') {
      const pool = C.EVENTS.filter((e) => !r.seenEvents.includes(e.id));
      const ev = KM.pick(pool.length ? pool : C.EVENTS);
      r.seenEvents.push(ev.id);
      c.event = ev.id;
      c.result = null;
    }
    r.save();
    go({ match: 'prematch', elite: 'prematch', boss: 'prematch', shop: 'shop', camp: 'camp', event: 'event' }[c.type]);
  }
  function leaveNode() {
    const r = S.run;
    r.pendingReward = null;
    r.advance();
    r.save();
    if (r.over) return endRun();
    S.tab = 'journey';
    go('hub');
  }
  function endRun() {
    C.Meta.record(S.run);
    C.Run.clear();
    go('end');
  }

  // ---------- 경기 전 ----------
  function renderPrematch() {
    const r = S.run, c = r.node, o = c.opp;
    const our = Math.round(r.strength());
    const lowCond = r.starters().filter((p) => p.cond < 60).length;
    app.innerHTML = `<div class="cup nonav">${topBar()}<div class="sec">
      <div class="card center">
        <div class="muted" style="font-size:12px;font-weight:700">${C.NODE_INFO[c.type].icon} ${C.NODE_INFO[c.type].name}</div>
        <div class="vs-row">
          <div class="tm">${crest(r.club, 'lg')}<span>${esc(r.club.name)}</span><small class="muted">전력 ${our}</small></div>
          <div class="vs">VS</div>
          <div class="tm">${crest(o, 'lg')}<span>${esc(o.name)}</span><small class="muted">전력 ${o.ovr}</small></div>
        </div>
        <div class="chips" style="justify-content:center">${traitChips(o) || '<span class="chip">특별한 특성 없음</span>'}</div>
        ${o.traits.length ? `<p class="hint mt8">${o.traits.map((t) => `${C.TRAITS[t].icon} ${C.TRAITS[t].name}`).join(' · ')}${r.has('analyst') ? ' — 📹 분석관 덕분에 효과 절반' : ''}</p>` : ''}
      </div>
      <div class="card" style="font-size:13px;line-height:1.7">
        🃏 덱 ${r.deck.length}장 · ✋ 손패 ${r.has('notebook') ? 5 : 4}장 · ⚡ 시작 에너지 ${2 + (r.has('spikes') ? 1 : 0)}<br>
        ${lowCond ? `<span style="color:#fb923c">⚠️ 체력이 낮은 선발 선수 ${lowCond}명 — 스쿼드에서 바꿀 수 있어요.</span>` : '선수단 컨디션 양호 👍'}
      </div>
      <button class="btn primary big block" data-act="kickoff">킥오프! ▶</button>
      <button class="btn block" data-act="tab-squad">스쿼드 확인</button>
    </div></div>`;
  }

  // ---------- 상점 ----------
  function renderShop() {
    const r = S.run, sh = r.node.shop;
    const cards = sh.cards.map((it, i) => `<div class="shop-item ${it.sold ? 'sold' : ''}">${cardHtml({ id: it.id }, '', 'disabled style="cursor:default"')}
      <button class="btn small price-btn" data-act="buy-card" data-i="${i}" ${r.gold < it.price ? 'disabled' : ''}><span class="price">💰${it.price}</span></button></div>`).join('');
    const players = sh.players.map((it, i) => {
      const p = it.p, o = KM.ovr(p);
      const keys = p.pos === 'GK' ? ['gk', 'pas', 'phy'] : ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
      return `<div class="card ${it.sold ? 'sold' : ''}" style="padding:12px">
        <div style="display:flex;gap:10px;align-items:center"><span class="ovr ${aCls(o)}" style="height:34px;min-width:38px;font-size:15px">${o}</span>
        <div style="flex:1"><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${KM.POS_KO[p.pos]} · ${p.age}세</div></div>
        <button class="btn small" data-act="buy-player" data-i="${i}" ${r.gold < it.price || r.squad.length >= 22 ? 'disabled' : ''}><span class="price">💰${it.price}</span></button></div>
        <div class="chips">${keys.map((k) => `<span class="chip">${KM.ATTR_KO[k]} ${p.a[k]}</span>`).join('')}</div></div>`;
    }).join('');
    app.innerHTML = `<div class="cup nonav">${topBar()}<div class="sec">
      <h2>🛒 이적 시장 <small>💰 ${r.gold} 보유</small></h2>
      <div class="card-grid">${cards}</div>
      <h2>선수 영입</h2>${players}
      ${sh.relic ? `<h2>구단 자산</h2><div class="${sh.relic.sold ? 'sold' : ''}" style="display:grid;gap:6px">${relicRow(sh.relic.id)}<button class="btn" data-act="buy-relic" ${r.gold < sh.relic.price ? 'disabled' : ''}><span class="price">💰${sh.relic.price}</span> 구매</button></div>` : ''}
      <h2>서비스</h2>
      <button class="btn block ${sh.removed ? 'sold' : ''}" data-act="shop-remove" ${r.gold < sh.removePrice ? 'disabled' : ''}>🗑️ 카드 1장 제거 — <span class="price">💰${sh.removePrice}</span></button>
      <button class="btn block ${sh.healed || r.hearts >= r.maxHearts ? 'sold' : ''}" data-act="shop-heal" ${r.gold < sh.healPrice ? 'disabled' : ''}>❤️ 생명 1 회복 — <span class="price">💰${sh.healPrice}</span></button>
      <button class="btn primary big block mt8" data-act="leave">떠나기 ▶</button>
    </div></div>`;
  }

  // ---------- 캠프 ----------
  function renderCamp() {
    app.innerHTML = `<div class="cup nonav">${topBar()}<div class="sec">
      <h2>🏕️ 훈련 캠프 <small>하나를 선택하세요</small></h2>
      <button class="choice" data-act="camp-rest"><span class="ni">🛌</span><span><span class="nt">휴식</span><div class="nd">선수 전원 체력 +45</div></span></button>
      <button class="choice" data-act="camp-upgrade"><span class="ni">⬆️</span><span><span class="nt">카드 강화</span><div class="nd">카드 1장을 더 강력하게 (지속시간·수치 상승)</div></span></button>
      <button class="choice" data-act="camp-train"><span class="ni">🏋️</span><span><span class="nt">특별 훈련</span><div class="nd">선수 1명의 핵심 능력 +${S.run.has('academy') ? 6 : 3} (2개 능력)</div></span></button>
    </div></div>`;
  }

  // ---------- 이벤트 ----------
  function renderEvent() {
    const r = S.run, c = r.node;
    const ev = C.EVENTS.find((e) => e.id === c.event);
    const body = c.result
      ? `<div class="card center" style="font-size:15px;line-height:1.6">${esc(c.result)}</div><button class="btn primary big block" data-act="leave">계속 ▶</button>`
      : ev.choices.map((ch, i) => {
        const ok = !ch.can || ch.can(r);
        return `<button class="choice" data-act="event-pick" data-i="${i}" ${ok ? '' : 'disabled style="opacity:.45"'}><span class="ni">${i === 0 ? '🅰️' : '🅱️'}</span><span><span class="nt">${esc(ch.label)}</span><div class="nd">${esc(ch.desc)}${ok ? '' : ' (조건 부족)'}</div></span></button>`;
      }).join('');
    app.innerHTML = `<div class="cup nonav">${topBar()}<div class="sec">
      <div class="center" style="font-size:52px;margin-top:10px">${ev.icon}</div>
      <h2 class="center" style="font-size:20px">${esc(ev.title)}</h2>
      <p class="center muted" style="margin:0 0 6px;line-height:1.6">${esc(ev.text)}</p>
      ${body}
    </div></div>`;
  }

  // ---------- 보상 ----------
  function renderReward() {
    const r = S.run, rw = S.reward;
    const res = rw.res;
    const w = rw.won ? 'W' : 'L';
    const cards = rw.cards.length && !rw.cardTaken
      ? `<h2>카드 선택 <small>1장을 덱에 추가</small></h2><div class="card-grid">${rw.cards.map((id, i) => cardHtml({ id }, '', `data-act="take-card" data-i="${i}"`)).join('')}</div><button class="btn block" data-act="skip-card">건너뛰기</button>` : '';
    const relics = rw.relics.length && !rw.relicTaken
      ? `<h2>구단 자산 <small>${rw.relics.length > 1 ? '하나를 선택' : '획득'}</small></h2><div style="display:grid;gap:8px">${rw.relics.map((id) => relicRow(id, `data-act="take-relic" data-id="${id}"`, 'button')).join('')}</div>` : '';
    const players = rw.players && rw.players.length && !rw.playerTaken
      ? `<h2>이적 제안 <small>1명 영입 (선택)</small></h2><div style="display:grid;gap:6px">${rw.players.map((p, i) => `<button class="sq-row" data-act="take-player" data-i="${i}"><span class="role bn">${p.pos}</span><span class="info"><b>${esc(p.name)}</b><small>${p.age}세 · ${(p.pos === 'GK' ? ['gk', 'phy'] : ['pac', 'sho', 'pas', 'dri', 'def']).map((k) => `${KM.ATTR_KO[k]} ${p.a[k]}`).join(' · ')}</small></span><span></span><span class="ovr ${aCls(KM.ovr(p))}">${KM.ovr(p)}</span></button>`).join('')}</div><button class="btn block" data-act="skip-player">영입하지 않음</button>` : '';
    const done = (!rw.cards.length || rw.cardTaken) && (!rw.relics.length || rw.relicTaken) && (!rw.players || !rw.players.length || rw.playerTaken);
    app.innerHTML = `<div class="cup nonav">${topBar()}<div class="sec">
      <div class="big-result">
        <div class="muted" style="font-weight:700">${esc(r.club.short)} vs ${esc(res.opp)}</div>
        <div class="sc">${res.gf} - ${res.ga}</div>
        ${res.shootout ? `<div class="muted">승부차기 ${res.shootout.us} - ${res.shootout.them}</div>` : ''}
        <div class="w ${w}">${rw.won ? '승 리' : '패 배'}</div>
      </div>
      <div class="chips" style="justify-content:center">
        ${rw.gold ? `<span class="chip gold">💰 +${rw.gold}</span>` : ''}
        ${rw.heartsLost ? `<span class="chip bad">❤️ -${rw.heartsLost}</span>` : ''}
        ${res.scorers.length ? `<span class="chip good">⚽ ${esc(res.scorers.join(', '))}</span>` : ''}
      </div>
      ${relics}${players}${cards}
      ${done || r.over ? `<button class="btn primary big block mt8" data-act="leave">${r.over ? '결과 보기' : '여정 계속 ▶'}</button>` : ''}
    </div></div>`;
  }

  // ---------- 종료 ----------
  function renderEnd() {
    const r = S.run, st = r.stats;
    const meta = C.Meta.get();
    app.innerHTML = `<div class="cup nonav"><div class="sec center" style="padding-top:40px">
      <div style="font-size:70px">${r.victory ? '🏆' : '🥀'}</div>
      <h2 style="font-size:28px;font-family:var(--display);font-weight:400">${r.victory ? '언더독 컵 우승!' : '도전 종료'}</h2>
      <p class="muted" style="margin:0;line-height:1.6">${r.victory ? '동네 팀이 전국을 제패했습니다. 전설이 되었어요!' : `${C.STAGES[Math.min(r.stage, 2)].name}에서 여정이 멈췄습니다.`}</p>
      <div class="card" style="text-align:left;font-size:13px;line-height:1.9">
        ${st.played}경기 ${st.won}승 ${st.drawn}무 ${st.lost}패 · 득점 ${st.gf} · 실점 ${st.ga}<br>
        덱 ${r.deck.length}장 · 구단 자산 ${r.relics.map((id) => C.RELICS[id].icon).join(' ')}<br>
        득점왕: ${(() => { const p = r.squad.slice().sort((a, b) => b.season.goals - a.season.goals)[0]; return p && p.season.goals ? `${esc(p.name)} ${p.season.goals}골` : '-'; })()}
      </div>
      <p class="muted" style="font-size:12px">통산 도전 ${meta.runs}회 · 우승 ${meta.wins}회</p>
      <button class="btn primary big block" data-act="new">새 도전</button>
      <button class="btn block" data-act="title">타이틀로</button>
    </div></div>`;
  }

  // ---------- 모달: 카드/선수 고르기 ----------
  function pickCardModal(title, filter, onPick, preview) {
    const r = S.run;
    const list = r.deck.filter(filter);
    if (!list.length) { toast('고를 수 있는 카드가 없습니다.'); return; }
    S.pickCb = onPick;
    openModal(`<h2>${title}</h2><div class="card-grid">${list.map((c) => cardHtml(preview ? Object.assign({}, c, { up: true }) : c, '', `data-act="pick-card" data-uid="${c.uid}"`)).join('')}</div>
      <div class="foot"><button class="btn" data-act="close">취소</button></div>`);
  }
  function pickPlayerModal(title, onPick) {
    const r = S.run;
    S.pickCb = onPick;
    const list = r.squad.slice().sort((a, b) => KM.POS_ORDER[a.pos] - KM.POS_ORDER[b.pos] || KM.ovr(b) - KM.ovr(a));
    openModal(`<h2>${title}</h2><div style="display:grid;gap:6px">${list.map((p) => `<button class="sq-row" data-act="pick-player" data-id="${p.id}"><span class="role bn">${p.pos}</span><span class="info"><b>${esc(p.name)}</b><small>${p.age}세</small></span><span>${condBar(p.cond)}</span><span class="ovr ${aCls(KM.ovr(p))}">${KM.ovr(p)}</span></button>`).join('')}</div>
      <div class="foot"><button class="btn" data-act="close">취소</button></div>`, 'sm');
  }

  // ---------- 클릭 처리 ----------
  app.addEventListener('click', onClick);
  modalRoot.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-bg') && !modalRoot.querySelector('[data-lock]')) { closeModal(); if (Match.m && Match.sheetPaused != null) Match.resumeFromSheet(); return; }
    onClick(e);
  });
  app.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act="formation"]');
    if (!el) return;
    S.run.formation = el.value; S.run.autoLineup(); S.run.save(); render();
  });

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    const r = S.run;
    if (Match.handle(act, el)) return;
    switch (act) {
      case 'new':
        if (C.Run.load() && !(C.Run.load().over) && S.screen === 'title' && !confirm('진행 중인 도전을 포기하고 새로 시작할까요?')) return;
        go('style'); break;
      case 'continue': S.run = C.Run.load(); S.tab = 'journey'; resumeNode(); break;
      case 'title': closeModal(); go('title'); break;
      case 'howto': howto(); break;
      case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } break;
      case 'close': closeModal(); break;
      case 'style': S.run = C.Run.create(el.dataset.k); S.run.save(); S.tab = 'journey'; go('hub'); break;
      case 'tab': S.tab = el.dataset.tab; S.sel = null; render(); window.scrollTo(0, 0); break;
      case 'tab-squad': S.tab = 'squad'; S.sel = null; go('hub'); break;
      case 'back-prematch': go('prematch'); break;
      case 'menu':
        openModal(`<h2>메뉴</h2><p class="muted" style="margin-top:0;font-size:13px">진행 상황은 자동 저장됩니다.</p>
          <div style="display:grid;gap:8px">
            <button class="btn" data-act="howto">게임 방법</button>
            <button class="btn" data-act="title">타이틀로 (저장됨)</button>
            <button class="btn danger" data-act="abandon">도전 포기</button>
          </div><div class="foot"><button class="btn" data-act="close">닫기</button></div>`, 'sm');
        break;
      case 'abandon':
        if (!confirm('이번 도전을 포기할까요? 되돌릴 수 없습니다.')) return;
        closeModal(); r.over = true; endRun(); break;
      case 'choose': choose(+el.dataset.i); break;
      case 'kickoff': Match.start(); break;
      case 'leave': leaveNode(); break;
      // 스쿼드
      case 'auto': r.autoLineup(); S.sel = null; r.save(); render(); toast('최적의 선발 명단을 구성했습니다.'); break;
      case 'sq': {
        const id = +el.dataset.id;
        if (S.sel == null) { S.sel = id; render(); break; }
        if (S.sel === id) { S.sel = null; render(); break; }
        const a = r.lineup.indexOf(S.sel), b = r.lineup.indexOf(id);
        if (a >= 0 && b >= 0) { r.lineup[a] = id; r.lineup[b] = S.sel; }
        else if (a >= 0) r.lineup[a] = id;
        else if (b >= 0) r.lineup[b] = S.sel;
        S.sel = null; r.save(); render();
        break;
      }
      // 상점
      case 'buy-card': {
        const it = r.node.shop.cards[+el.dataset.i];
        if (it.sold || r.gold < it.price) break;
        r.gold -= it.price; it.sold = true; r.addCard(it.id); r.save(); render(); toast(`‘${C.CARDS[it.id].name}’ 카드를 샀습니다.`);
        break;
      }
      case 'buy-player': {
        const it = r.node.shop.players[+el.dataset.i];
        if (it.sold || r.gold < it.price) break;
        r.gold -= it.price; it.sold = true;
        const used = r.usedNums(); let n = 24; while (used.has(n)) n++;
        it.p.num = n; r.squad.push(it.p); r.addLog(`🤝 ${it.p.name}(${it.p.pos}) 영입`);
        r.autoLineup(); r.save(); render(); toast(`${it.p.name} 선수를 영입했습니다!`);
        break;
      }
      case 'buy-relic': {
        const it = r.node.shop.relic;
        if (it.sold || r.gold < it.price) break;
        r.gold -= it.price; it.sold = true; r.gainRelic(it.id); r.save(); render();
        break;
      }
      case 'shop-remove':
        pickCardModal('덱에서 제거할 카드', () => true, (c) => {
          const sh = r.node.shop;
          r.deck = r.deck.filter((x) => x.uid !== c.uid); r.gold -= sh.removePrice; sh.removed = true; r.save(); render();
          toast(`‘${C.cardName(c)}’ 카드를 제거했습니다.`);
        });
        break;
      case 'shop-heal': { const sh = r.node.shop; if (r.hearts >= r.maxHearts) break; r.gold -= sh.healPrice; sh.healed = true; r.heal(1); r.save(); render(); break; }
      // 캠프
      case 'camp-rest': r.squad.forEach((p) => { p.cond = Math.min(100, p.cond + 45); }); toast('선수들이 푹 쉬었습니다.'); leaveNode(); break;
      case 'camp-upgrade':
        pickCardModal('강화할 카드 (강화 후 모습)', (c) => !c.up && C.CARDS[c.id].rarity !== 'curse', (c) => {
          c.up = true; toast(`‘${C.cardName(c)}’(으)로 강화!`); leaveNode();
        }, true);
        break;
      case 'camp-train':
        pickPlayerModal('특별 훈련할 선수', (p) => { const n = r.trainPlayer(p); toast(`${p.name} 핵심 능력 +${n}!`); leaveNode(); });
        break;
      case 'pick-card': { const c = r.deck.find((x) => x.uid === el.dataset.uid); closeModal(); if (c && S.pickCb) S.pickCb(c); break; }
      case 'pick-player': { const p = r.squad.find((x) => x.id === +el.dataset.id); closeModal(); if (p && S.pickCb) S.pickCb(p); break; }
      // 이벤트
      case 'event-pick': {
        const ev = C.EVENTS.find((x) => x.id === r.node.event);
        const ch = ev.choices[+el.dataset.i];
        if (ch.can && !ch.can(r)) break;
        r.node.result = ch.apply(r); r.autoLineup(); r.save(); render();
        break;
      }
      // 보상
      case 'take-card': { const rw = S.reward; r.addCard(rw.cards[+el.dataset.i]); rw.cardTaken = true; r.save(); render(); toast('덱에 추가했습니다.'); break; }
      case 'skip-card': S.reward.cardTaken = true; r.save(); render(); break;
      case 'take-player': {
        const p = S.reward.players[+el.dataset.i];
        const used = r.usedNums(); let n = 24; while (used.has(n)) n++;
        p.num = n; r.squad.push(p); r.addLog(`🤝 ${p.name}(${p.pos}) 영입`); r.autoLineup();
        S.reward.playerTaken = true; r.save(); render(); toast(`${p.name} 선수가 합류했습니다!`);
        break;
      }
      case 'skip-player': S.reward.playerTaken = true; r.save(); render(); break;
      case 'take-relic': { r.gainRelic(el.dataset.id); S.reward.relicTaken = true; r.save(); render(); break; }
      default:
    }
  }

  function resumeNode() {
    const r = S.run;
    if (r.pendingReward) { S.reward = r.pendingReward; return go('reward'); }
    if (!r.node) return go('hub');
    const t = r.node.type;
    if (t === 'shop') return go('shop');
    if (t === 'event') return go('event');
    if (t === 'camp') return go('camp');
    return go('prematch');
  }

  // =====================================================================
  //  경기
  // =====================================================================
  const SPEEDS = [[3, '×1'], [6, '×2'], [12, '×4']];
  const Match = {
    m: null, speed: 1, paused: false, raf: 0,

    start() {
      const r = S.run, node = r.node, opp = node.opp;
      const home = this.userSetup(r);
      const away = C.oppSetup(opp, r.has('analyst'));
      if (KM.colorDist(home.kit[0], away.kit[0]) < 140) away.kit = [away.kit[1], away.kit[0]];
      this.m = new KM.Match(home, away, { length: C.MATCH_LENGTH, onEvent: (ev) => this.onEvent(ev) });
      const m = this.m;
      this.side = 0;
      if (r.has('gloves')) m.teams[0].autoSaves = 1;
      // 덱
      this.draw = C.shuffle(r.deck.map((c) => Object.assign({}, c)));
      this.discard = []; this.exhausted = [];
      this.handSize = r.has('notebook') ? 5 : 4;
      this.hand = [];
      for (let i = 0; i < this.handSize; i++) this.drawOne();
      this.energy = 2 + (r.has('spikes') ? 1 : 0);
      this.maxEnergy = 6;
      this.interval = r.has('drink') ? 7 : 9;
      this.nextEnergy = this.interval;
      this.firstFree = r.has('megaphone');
      this.cardsPlayed = 0;
      // 상대 작전 예약
      const moves = C.shuffle(C.BOSS_MOVES.slice()).slice(0, opp.moves);
      this.oppMoves = moves.map((mv, i) => Object.assign({}, mv, { at: Math.round(18 + (i + 1) * (70 / (moves.length + 1)) + KM.rnd(-6, 6)), done: false }));
      this.paused = false; this.over = false; this.lastSide = 0; this.acc = 0;
      this.build();
      const layout = () => ({ fit: true, vertical: isMobile() && window.innerHeight >= window.innerWidth });
      const l0 = layout();
      this.renderer = new KM.Renderer(this.cv, l0.fit, l0.vertical);
      this.ro = new ResizeObserver(() => { const l = layout(); this.renderer.vertical = l.vertical; this.renderer.resize(); this.renderer.draw(m); });
      this.ro.observe(this.cv.parentElement);
      m.events.forEach((ev) => this.addFeed(ev));
      this.renderHand();
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
      try { if (navigator.wakeLock) navigator.wakeLock.request('screen').then((w) => { this.wake = w; }).catch(() => {}); } catch (e) { /* 무시 */ }
    },

    userSetup(r) {
      const prep = (p) => Object.assign({}, p, { ovr: KM.ovr(p) });
      const starters = r.starters();
      const mods = { finish: C.CUP_FINISH };
      if (r.has('stadium')) mods.all = 1.05;
      if (r.has('golden')) { const fw = starters.filter((p) => p.pos !== 'GK').sort((a, b) => b.a.sho - a.a.sho)[0]; if (fw) mods.boost = { [fw.id]: 1.15 }; }
      return { name: r.club.name, short: r.club.short, kit: r.club.kit, gkKit: r.club.gk, tactic: { formation: r.formation, mentality: 0, press: 1 }, players: starters.map(prep), bench: r.bench().map(prep), aiSubs: true, mods };
    },

    build() {
      const m = this.m, [h, a] = m.teams;
      S.screen = 'match';
      app.innerHTML = `<div class="cmatch">
        <div class="scorebar">
          <div class="sb-team">${crest(h)}<span class="nm">${esc(h.short === 'UDG' ? '언더독스' : h.name)}</span></div>
          <div class="sb-mid"><div class="sb-score"><span id="sc0">0</span><span class="d">:</span><span id="sc1">0</span></div><div class="sb-clock" id="clock">00:00</div></div>
          <div class="sb-team away"><span class="nm">${esc(a.name)}</span>${crest(a)}</div>
        </div>
        <div class="ticker" id="ticker"></div>
        <div class="cm-body">
          <div class="pitch-wrap"><canvas id="pitch"></canvas><div class="pitch-overlay hidden" id="overlay"></div><div id="banner-box"></div></div>
          <aside class="cm-side"><div class="fx-list" id="fx-side"></div><div class="side-body"><ul class="feed" id="feed"></ul></div></aside>
        </div>
        <div class="fx-strip" id="fx-strip"></div>
        <div class="hand-area">
          <div class="energy"><span>⚡</span><span class="pips" id="pips"></span><span class="piles" id="piles"></span><span class="next" id="enext"></span></div>
          <div class="hand" id="hand"></div>
        </div>
        <div class="cm-controls">
          <button class="btn icon" data-act="m-pause" id="pause-btn">⏸</button>
          <button class="btn" data-act="m-speed" id="speed-btn">${SPEEDS[this.speed][1]} 배속</button>
          <button class="btn" data-act="m-feed">📻 중계</button>
          <button class="btn" data-act="m-skip">⏭ 결과로</button>
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
        this.tick();
      }
      this.renderer.draw(m);
      document.getElementById('clock').textContent = m.mode === 'halftime' ? '하프타임' : m.finished ? '종료' : m.clock();
      if (now - this.lastSide > 300) { this.lastSide = now; this.renderStatus(); }
      if (this.m) this.raf = requestAnimationFrame((t) => this.frame(t));
    },

    // 경기 시간 기반 처리: 에너지, 상대 작전, 주장 완장
    tick() {
      const m = this.m, r = S.run;
      const gm = m.gameSec() / 60;
      let changed = false;
      while (gm >= this.nextEnergy) {
        this.nextEnergy += this.interval;
        if (this.energy < this.maxEnergy) { this.energy++; changed = true; }
      }
      for (const mv of this.oppMoves) {
        if (!mv.done && gm >= mv.at && m.canAct()) {
          mv.done = true;
          m.addEffect(1, { label: mv.name, icon: mv.icon, min: mv.min, mods: mv.mods, tag: 'opp-' + mv.name });
          this.addFeed({ type: 'card', text: `${mv.icon} 상대 감독의 작전: ${mv.name}!`, team: 1, min: m.minute() });
          this.banner(`${mv.icon} 상대 작전: ${mv.name}`, `${mv.min}분간`, true);
        }
      }
      if (r.has('armband')) {
        const behind = m.teams[0].score < m.teams[1].score;
        const has = m.effects.some((e) => e.tag === 'armband');
        if (behind && !has) m.addEffect(0, { label: '주장 완장', icon: '🎗️', min: 200, mods: { all: 1.08 }, tag: 'armband' });
        if (!behind && has) { m.effects = m.effects.filter((e) => e.tag !== 'armband'); m._recomputeMods(); }
      }
      if (changed) this.renderHand();
    },

    drawOne() {
      if (!this.draw.length) { this.draw = C.shuffle(this.discard); this.discard = []; }
      if (this.draw.length) this.hand.push(this.draw.pop());
    },

    costOf(c) { return this.firstFree ? 0 : C.cardCost(c); },

    renderHand() {
      const h = document.getElementById('hand');
      if (!h) return;
      h.style.setProperty('--n', this.handSize);
      const usable = !this.m.finished && this.m.mode !== 'halftime';
      h.innerHTML = this.hand.map((c, i) => cardHtml(Object.assign({}, c), `${this.costOf(c) > this.energy || !usable ? 'off' : ''} ${this.firstFree ? 'free' : ''}`, `data-act="m-play" data-i="${i}"`)
        .replace(`<span class="cc">${C.cardCost(c)}</span>`, `<span class="cc">${this.costOf(c)}</span>`)).join('');
      document.getElementById('pips').innerHTML = Array.from({ length: this.maxEnergy }, (_, i) => `<i class="${i < this.energy ? 'on' : ''}"></i>`).join('');
      document.getElementById('piles').textContent = `덱 ${this.draw.length} · 버림 ${this.discard.length}`;
    },

    renderStatus() {
      const m = this.m;
      const gm = m.gameSec() / 60;
      const left = Math.max(0, Math.ceil(this.nextEnergy - gm));
      const en = document.getElementById('enext');
      if (en) en.textContent = this.energy >= this.maxEnergy ? '가득 참' : `다음 ⚡ ${left}분 후`;
      const chips = m.effects.filter((e) => e.until > m.t).map((e) => {
        const mins = Math.max(0, Math.ceil((e.until - m.t) / m.T * 90));
        return `<span class="fxc ${e.team === 1 ? 'opp' : ''}">${e.icon || '✨'} ${esc(e.label)} <small>${mins > 90 ? '∞' : mins + '′'}</small></span>`;
      });
      const saves = m.teams[0].autoSaves;
      if (saves) chips.push(`<span class="fxc">🧤 자동 선방 <small>×${saves}</small></span>`);
      const html = chips.join('') || '<span class="muted" style="font-size:11px">진행 중인 효과 없음</span>';
      const strip = document.getElementById('fx-strip'); if (strip) strip.innerHTML = html;
      const side = document.getElementById('fx-side'); if (side) side.innerHTML = `<div class="muted" style="font-size:11px;font-weight:700">진행 중인 효과</div><div class="chips">${html}</div>`;
    },

    play(i) {
      const m = this.m;
      const c = this.hand[i];
      if (!c || m.finished || m.mode === 'halftime') return;
      const cost = this.costOf(c);
      if (cost > this.energy) { toast(`에너지가 부족합니다 (⚡${cost} 필요)`); return; }
      const def = C.CARDS[c.id];
      const ctx = { m, side: 0, card: def, gainEnergy: (n) => { this.energy = Math.min(this.maxEnergy + 3, this.energy + n); } };
      const res = def.play(ctx, !!c.up);
      if (res === false) { toast('지금은 사용할 수 없습니다. 잠시 후 다시 시도하세요.'); return; }
      this.energy -= cost;
      this.firstFree = false;
      this.cardsPlayed++;
      this.hand.splice(i, 1);
      (def.exhaust ? this.exhausted : this.discard).push(c);
      this.drawOne();
      this.addFeed({ type: 'card', text: `🃏 ${C.cardName(c)} 사용!`, team: 0, min: m.minute() });
      this.banner(`${def.icon} ${C.cardName(c)}`, C.cardText(c), false);
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) { /* 무시 */ } }
      this.renderHand();
      this.renderStatus();
    },

    banner(text, sub, opp) {
      const box = document.getElementById('banner-box');
      if (!box) return;
      box.innerHTML = `<div class="banner ${opp ? 'opp' : ''}">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
    },

    onEvent(ev) {
      if (!this.feed) return;
      this.addFeed(ev);
      const m = this.m;
      if (ev.type === 'goal') {
        const el = document.getElementById('sc' + ev.team);
        el.textContent = m.teams[ev.team].score;
        el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        if (!this.skipping) this.renderer.flash = { text: 'GOAL!', sub: `${ev.scorer} · ${ev.min}'`, color: ev.team === 0 ? '#a3e635' : '#f43f5e', until: performance.now() + 2400 };
        if (!this.skipping && ev.team === 0 && navigator.vibrate) { try { navigator.vibrate([120, 60, 220]); } catch (e) { /* 무시 */ } }
      }
      if (ev.type === 'half' && !this.skipping) { this.paused = true; this.overlayHalf(); }
      if (ev.type === 'full') { this.paused = true; setTimeout(() => this.afterFull(), this.skipping ? 0 : 900); }
    },

    addFeed(ev) {
      const li = document.createElement('li');
      li.className = ev.type;
      const color = ev.team === 0 ? '#a3e635' : ev.team === 1 ? '#f43f5e' : null;
      li.innerHTML = `<span class="mn">${ev.min}'</span><span>${color ? `<i class="dot" style="background:${color}"></i>` : ''}${esc(ev.text)}</span>`;
      if (this.feed) this.feed.prepend(li);
      const t = document.getElementById('ticker');
      if (t && ev.type !== 'whistle') { t.textContent = `${ev.min}' ${ev.text}`; t.className = 'ticker' + (ev.type === 'goal' ? ' goal' : ''); }
      (this.feedLog = this.feedLog || []).unshift(ev);
    },

    overlayHalf() {
      const m = this.m, [h, a] = m.teams;
      const ov = document.getElementById('overlay');
      ov.classList.remove('hidden');
      ov.innerHTML = `<div class="overlay-card"><h2>하프타임</h2>
        <p style="font-size:22px;font-weight:900;margin:6px 0">${esc(h.short)} ${h.score} : ${a.score} ${esc(a.short)}</p>
        <p class="muted" style="margin:0 0 6px;font-size:13px">라커룸에서 숨을 고릅니다. ⚡ +1</p>
        <div class="btns"><button class="btn primary big" data-act="m-resume">후반전 시작 ▶</button></div></div>`;
      this.energy = Math.min(this.maxEnergy, this.energy + 1);
      this.renderHand();
    },

    afterFull() {
      const m = this.m;
      if (m.teams[0].score === m.teams[1].score) this.shootout();
      else this.finish(null);
    },

    // ---------- 승부차기 ----------
    shootout() {
      const m = this.m, r = S.run;
      const takers = (tm) => tm.onPitch.filter((p) => p.role !== 'GK').sort((a, b) => b.a.sho - a.a.sho).concat(tm.onPitch.filter((p) => p.role === 'GK'));
      const T = [takers(m.teams[0]), takers(m.teams[1])];
      const G = [m.gkOf(m.teams[1]), m.gkOf(m.teams[0])];
      const prob = (side, p) => {
        const gk = G[side];
        const v = 0.73 + (m.eff(p, 'sho') - 65) / 260 - ((gk ? m.eff(gk, 'gk') : 30) - 65) / 380 + (side === 0 && r.has('charm') ? 0.12 : 0);
        return KM.clamp(v, 0.45, 0.94);
      };
      const kicks = [[], []];
      const sc = [0, 0];
      rounds: for (let i = 0; i < 30; i++) {
        for (const side of [0, 1]) {
          const p = T[side][i % T[side].length];
          const ok = Math.random() < prob(side, p);
          kicks[side].push({ name: p.name, ok });
          if (ok) sc[side]++;
          // 5번째 키커 전에 승부가 확정되면 종료
          if (i < 5 && (sc[0] + (5 - kicks[0].length) < sc[1] || sc[1] + (5 - kicks[1].length) < sc[0])) break rounds;
        }
        if (i >= 4 && sc[0] !== sc[1]) break;
      }
      this.so = { kicks, sc, won: sc[0] > sc[1], shown: 0, total: kicks[0].length + kicks[1].length };
      const ov = document.getElementById('overlay');
      ov.classList.remove('hidden');
      this.drawShootout();
      this.soTimer = setInterval(() => {
        this.so.shown++;
        this.drawShootout();
        if (this.so.shown >= this.so.total) { clearInterval(this.soTimer); this.soTimer = null; }
      }, 850);
    },

    drawShootout() {
      const so = this.so, m = this.m;
      const seq = [];
      for (let k = 0; k < Math.max(so.kicks[0].length, so.kicks[1].length); k++) { if (so.kicks[0][k]) seq.push([0, k]); if (so.kicks[1][k]) seq.push([1, k]); }
      const visible = seq.slice(0, so.shown);
      const cnt = [0, 0];
      const marks = [[], []];
      for (const [s, k] of visible) { const kk = so.kicks[s][k]; marks[s].push(kk.ok ? 'g' : 'm'); if (kk.ok) cnt[s]++; }
      const last = visible[visible.length - 1];
      const msg = last ? `${so.kicks[last[0]][last[1]].name} ${so.kicks[last[0]][last[1]].ok ? '⭕ 성공!' : '❌ 실축!'}` : '키커가 공을 내려놓습니다…';
      const done = so.shown >= so.total;
      const row = (s) => {
        const n = Math.max(5, marks[s].length);
        return `<div class="so-row"><span>${esc(m.teams[s].short)}</span><span class="kicks">${Array.from({ length: n }, (_, k) => `<i class="${marks[s][k] || ''}">${marks[s][k] === 'g' ? '✓' : marks[s][k] === 'm' ? '✕' : ''}</i>`).join('')}</span><span class="n">${cnt[s]}</span></div>`;
      };
      document.getElementById('overlay').innerHTML = `<div class="overlay-card"><h2>승부차기</h2>
        <div class="so-rows">${row(0)}${row(1)}</div>
        <div class="so-msg">${done ? (so.won ? '🎉 승부차기 승리!' : '😭 승부차기 패배…') : esc(msg)}</div>
        <div class="btns">${done ? '<button class="btn primary big" data-act="m-finish">결과 확인 ▶</button>' : '<button class="btn small" data-act="m-so-skip">건너뛰기</button>'}</div></div>`;
    },

    finish(so) {
      const m = this.m, r = S.run;
      const shoot = so || (this.so ? { won: this.so.won, us: this.so.sc[0], them: this.so.sc[1] } : null);
      const res = m.result();
      const players = res.players[0].map((p) => ({ id: p.id, energy: p.energy, goals: p.goals, assists: p.assists }));
      const reward = r.finishMatch(r.node, { gf: m.teams[0].score, ga: m.teams[1].score, shootout: shoot, players });
      reward.res = {
        gf: m.teams[0].score, ga: m.teams[1].score, opp: m.teams[1].short, shootout: shoot,
        scorers: res.goals.filter((g) => g.team === 0).map((g) => `${g.scorer} ${g.min}'`),
      };
      this.stop();
      r.pendingReward = reward;
      r.save();
      S.reward = reward;
      go('reward');
    },

    stop() {
      cancelAnimationFrame(this.raf);
      if (this.soTimer) clearInterval(this.soTimer);
      if (this.ro) this.ro.disconnect();
      if (this.wake) { this.wake.release().catch(() => {}); this.wake = null; }
      this.feed = null; this.m = null; this.so = null; this.feedLog = null; this.skipping = false;
    },

    resumeFromSheet() { this.paused = this.sheetPaused; this.sheetPaused = null; this.syncPause(); },
    syncPause() { const b = document.getElementById('pause-btn'); if (b) b.textContent = this.paused ? '▶' : '⏸'; },

    handle(act, el) {
      if (!act.startsWith('m-') || !this.m) return false;
      const m = this.m;
      switch (act) {
        case 'm-play': this.play(+el.dataset.i); break;
        case 'm-pause':
          if (m.finished || !document.getElementById('overlay').classList.contains('hidden')) break;
          this.paused = !this.paused; this.syncPause(); break;
        case 'm-speed': this.speed = (this.speed + 1) % SPEEDS.length; el.textContent = `${SPEEDS[this.speed][1]} 배속`; break;
        case 'm-feed': {
          this.sheetPaused = this.paused; this.paused = true; this.syncPause();
          const evs = (this.feedLog || []).slice(0, 60);
          openModal(`<h2>경기 중계</h2><ul class="feed">${evs.map((ev) => `<li class="${ev.type}"><span class="mn">${ev.min}'</span><span>${ev.team === 0 ? '<i class="dot" style="background:#a3e635"></i>' : ev.team === 1 ? '<i class="dot" style="background:#f43f5e"></i>' : ''}${esc(ev.text)}</span></li>`).join('')}</ul>
            <div class="foot"><button class="btn primary" data-act="m-sheet-close">닫기</button></div>`, 'sm');
          break;
        }
        case 'm-sheet-close': closeModal(); this.resumeFromSheet(); break;
        case 'm-resume': document.getElementById('overlay').classList.add('hidden'); this.paused = false; this.syncPause(); this.renderHand(); break;
        case 'm-skip':
          if (m.finished) break;
          if (!confirm('남은 시간을 카드 없이 바로 진행할까요?')) break;
          this.skipping = true;
          document.getElementById('overlay').classList.add('hidden');
          m.runToEnd();
          break;
        case 'm-so-skip': if (this.soTimer) { clearInterval(this.soTimer); this.soTimer = null; } this.so.shown = this.so.total; this.drawShootout(); break;
        case 'm-finish': this.finish(null); break;
        default: return false;
      }
      return true;
    },
  };
  KM.CupMatch = Match;

  document.addEventListener('keydown', (e) => {
    if (S.screen !== 'match' || !Match.m) return;
    if (e.code === 'Space') { e.preventDefault(); Match.handle('m-pause', document.getElementById('pause-btn')); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 5) Match.play(n - 1);
  });

  // 시작
  go('title');
})(window.KM);
