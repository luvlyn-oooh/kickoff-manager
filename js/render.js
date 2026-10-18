/* 킥오프 매니저 - 경기장 캔버스 렌더러
 * vertical=true 이면 세로 모드(모바일 세로 화면): 경기장을 90° 돌려 그린다. */
(function (KM) {
  'use strict';
  const { L, W, CY, GH } = KM.PITCH;
  const M = 4; // 경기장 바깥 여백(m)
  const FL = L + M * 2, FW = W + M * 2; // 여백 포함 크기

  const RESTART_LABEL = { throw: '스로인', corner: '코너킥', goalkick: '골킥', free: '프리킥', penalty: '페널티킥' };

  class Renderer {
    constructor(canvas, fitHeight, vertical) {
      this.cv = canvas;
      this.fitHeight = !!fitHeight;
      this.vertical = !!vertical;
      this.ctx = canvas.getContext('2d');
      this.trail = [];
      this.showNames = false;
      this.flash = null; // {text, sub, color, until}
      this.resize();
    }

    resize(forceW) {
      const par = this.cv.parentElement;
      const rect = par.getBoundingClientRect();
      const cs = window.getComputedStyle(par);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const availW = rect.width - padX, availH = rect.height - padY;
      const dpr = window.devicePixelRatio || 1;
      const lw = this.vertical ? FW : FL, lh = this.vertical ? FL : FW; // 화면상 가로/세로(m)
      let w = forceW || availW, h = w * lh / lw;
      if (this.fitHeight && availH > 50 && h > availH) { h = availH; w = h * lw / lh; }
      this.cssW = w; this.cssH = h;
      this.cv.style.width = w + 'px';
      this.cv.style.height = h + 'px';
      this.cv.width = Math.round(w * dpr);
      this.cv.height = Math.round(h * dpr);
      this.s = (w * dpr) / lw;
      this.dpr = dpr;
      this._pitchCache = null;
    }

    // 월드 좌표 → 화면 좌표
    P(x, y) {
      return this.vertical ? [(y + M) * this.s, (L - x + M) * this.s] : [(x + M) * this.s, (y + M) * this.s];
    }

    _drawPitch() {
      if (this._pitchCache) { this.ctx.drawImage(this._pitchCache, 0, 0); return; }
      const off = document.createElement('canvas');
      off.width = this.cv.width; off.height = this.cv.height;
      const c = off.getContext('2d'), s = this.s;
      // 가로 기준으로 그리고, 세로 모드면 좌표계를 회전
      if (this.vertical) c.setTransform(0, -1, 1, 0, 0, FL * s);
      const X = (x) => (x + M) * s, Y = (y) => (y + M) * s;
      c.fillStyle = '#2f6b33';
      c.fillRect(0, 0, FL * s, FW * s);
      const stripes = 14;
      for (let i = 0; i < stripes; i++) {
        c.fillStyle = i % 2 ? '#3d8a3f' : '#46974a';
        c.fillRect(X(i * L / stripes), Y(0), L / stripes * s + 1, W * s);
      }
      c.strokeStyle = 'rgba(255,255,255,0.88)';
      c.lineWidth = Math.max(1.4, s * 0.13);
      c.strokeRect(X(0), Y(0), L * s, W * s);
      c.beginPath(); c.moveTo(X(L / 2), Y(0)); c.lineTo(X(L / 2), Y(W)); c.stroke();
      c.beginPath(); c.arc(X(L / 2), Y(CY), 9.15 * s, 0, Math.PI * 2); c.stroke();
      const dot = (x, y) => { c.beginPath(); c.arc(X(x), Y(y), Math.max(1.5, s * 0.25), 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.9)'; c.fill(); };
      dot(L / 2, CY);
      for (const side of [0, 1]) {
        const x0 = side ? L : 0, sg = side ? -1 : 1;
        c.strokeRect(X(side ? L - 16.5 : 0), Y(CY - 20.16), 16.5 * s, 40.32 * s);
        c.strokeRect(X(side ? L - 5.5 : 0), Y(CY - 9.16), 5.5 * s, 18.32 * s);
        dot(x0 + sg * 11, CY);
        c.beginPath();
        const a = Math.acos(5.5 / 9.15);
        if (side) c.arc(X(L - 11), Y(CY), 9.15 * s, Math.PI - a, Math.PI + a);
        else c.arc(X(11), Y(CY), 9.15 * s, -a, a);
        c.stroke();
        // 골대
        c.fillStyle = 'rgba(255,255,255,0.18)';
        const gx = side ? X(L) : X(-2);
        c.fillRect(gx, Y(CY - GH), 2 * s, 2 * GH * s);
        c.save();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1;
        for (let k = 0; k <= 8; k++) { c.beginPath(); c.moveTo(gx, Y(CY - GH + k * GH / 4)); c.lineTo(gx + 2 * s, Y(CY - GH + k * GH / 4)); c.stroke(); }
        c.restore();
        c.strokeStyle = '#fff'; c.lineWidth = Math.max(2, s * 0.22);
        c.strokeRect(gx, Y(CY - GH), 2 * s, 2 * GH * s);
        c.strokeStyle = 'rgba(255,255,255,0.88)'; c.lineWidth = Math.max(1.4, s * 0.13);
        // 코너 아크
        for (const y0 of [0, W]) {
          const a0 = side ? (y0 ? Math.PI : Math.PI / 2) : (y0 ? -Math.PI / 2 : 0);
          c.beginPath();
          c.arc(X(x0), Y(y0), 1 * s, a0, a0 + Math.PI / 2);
          c.stroke();
        }
      }
      this._pitchCache = off;
      this.ctx.drawImage(off, 0, 0);
    }

    draw(m) {
      if (!this.cv.width || !this.cv.height) { this.resize(this.forceW); if (!this.cv.width || !this.cv.height) return; }
      const c = this.ctx, s = this.s;
      c.setTransform(1, 0, 0, 1, 0, 0);
      this._drawPitch();
      const b = m.ball;

      // 공 궤적
      const bs = Math.hypot(b.vx, b.vy);
      if (!b.owner && bs > 12) this.trail.push([b.x, b.y]); else this.trail.length = 0;
      if (this.trail.length > 9) this.trail.shift();
      if (this.trail.length > 1) {
        c.lineCap = 'round';
        for (let i = 1; i < this.trail.length; i++) {
          const [x0, y0] = this.P(this.trail[i - 1][0], this.trail[i - 1][1]);
          const [x1, y1] = this.P(this.trail[i][0], this.trail[i][1]);
          c.strokeStyle = `rgba(255,255,255,${(i / this.trail.length) * 0.45})`;
          c.lineWidth = Math.max(1.5, s * 0.35) * (i / this.trail.length);
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
        }
      }

      const r = Math.max((this.vertical ? 7.5 : 6) * this.dpr, 1.3 * s);
      const players = m.all.slice().map((p) => ({ p, xy: this.P(p.x, p.y) })).sort((a, q) => a.xy[1] - q.xy[1]);
      // 그림자
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (const { xy } of players) { c.beginPath(); c.ellipse(xy[0] + r * 0.25, xy[1] + r * 0.45, r * 0.95, r * 0.55, 0, 0, Math.PI * 2); c.fill(); }
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const { p, xy } of players) {
        const tm = m.teams[p.team];
        const kit = p.role === 'GK' ? tm.gkKit : tm.kit;
        const [x, y] = xy;
        if (b.owner === p) {
          c.beginPath(); c.arc(x, y, r * 1.55, 0, Math.PI * 2);
          c.strokeStyle = 'rgba(253,224,71,0.95)'; c.lineWidth = Math.max(2, r * 0.22); c.stroke();
        }
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
        c.fillStyle = kit[0]; c.fill();
        c.lineWidth = Math.max(1.5, r * 0.18); c.strokeStyle = kit[1]; c.stroke();
        c.fillStyle = kit[1];
        c.font = `700 ${Math.round(r * 1.05)}px "Noto Sans KR", system-ui, sans-serif`;
        c.fillText(String(p.num), x, y + r * 0.05);
        if (p.energy < 40 && m.userSide === p.team) {
          c.fillStyle = '#f87171'; c.beginPath(); c.arc(x + r * 0.85, y - r * 0.85, r * 0.28, 0, Math.PI * 2); c.fill();
        }
      }
      // 이름표
      const fs = Math.round(Math.max(10 * this.dpr, r * 0.95));
      c.font = `600 ${fs}px "Noto Sans KR", system-ui, sans-serif`;
      for (const { p, xy } of players) {
        if (!(this.showNames || b.owner === p)) continue;
        const x = xy[0], y = xy[1] - r * 2.1;
        const tw = c.measureText(p.name).width + fs * 0.8;
        c.fillStyle = b.owner === p ? 'rgba(15,23,42,0.85)' : 'rgba(15,23,42,0.55)';
        roundRect(c, x - tw / 2, y - fs * 0.7, tw, fs * 1.4, fs * 0.5); c.fill();
        c.fillStyle = '#fff'; c.fillText(p.name, x, y + fs * 0.03);
      }
      // 공
      const br = Math.max((this.vertical ? 4.2 : 3.5) * this.dpr, 0.6 * s);
      const [bx, by] = this.P(b.x, b.y);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath(); c.ellipse(bx + br * 0.5, by + br * 0.6, br, br * 0.6, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2);
      c.fillStyle = '#fff'; c.fill(); c.lineWidth = Math.max(1, br * 0.3); c.strokeStyle = '#111'; c.stroke();

      // 상태 라벨
      let label = null;
      if (m.mode === 'restart' && m.restart) label = RESTART_LABEL[m.restart.type] + ' · ' + m.teams[m.restart.team].name;
      else if (m.mode === 'kickoff') label = '킥오프';
      if (label) {
        const f2 = Math.round(Math.max(12 * this.dpr, s * 1.6));
        c.font = `700 ${f2}px "Noto Sans KR", system-ui, sans-serif`;
        const tw = c.measureText(label).width + f2 * 1.2;
        const ly = this.vertical ? this.cv.height / 2 - f2 * 3.2 : f2 * 0.5;
        c.fillStyle = 'rgba(15,23,42,0.75)';
        roundRect(c, this.cv.width / 2 - tw / 2, ly, tw, f2 * 1.7, f2 * 0.85); c.fill();
        c.fillStyle = '#fff'; c.fillText(label, this.cv.width / 2, ly + f2 * 0.85);
      }
      // 골 연출
      if (this.flash && performance.now() < this.flash.until) {
        const k = 1 - (this.flash.until - performance.now()) / 2600;
        const f3 = Math.round(Math.min(this.cv.width / 4.2, this.cv.height / 5) * (1 + Math.max(0, 0.25 - k)));
        c.save();
        c.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
        c.fillStyle = 'rgba(2,6,23,0.45)'; c.fillRect(0, 0, this.cv.width, this.cv.height);
        c.font = `900 ${f3}px "Black Han Sans", "Noto Sans KR", sans-serif`;
        c.lineWidth = f3 * 0.08; c.strokeStyle = '#020617';
        c.strokeText(this.flash.text, this.cv.width / 2, this.cv.height * 0.45);
        c.fillStyle = this.flash.color; c.fillText(this.flash.text, this.cv.width / 2, this.cv.height * 0.45);
        if (this.flash.sub) {
          c.font = `700 ${Math.round(f3 * 0.28)}px "Noto Sans KR", sans-serif`;
          c.fillStyle = '#fff'; c.fillText(this.flash.sub, this.cv.width / 2, this.cv.height * 0.45 + f3 * 0.7);
        }
        c.restore();
      }
    }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  KM.Renderer = Renderer;
})(window.KM = window.KM || {});
