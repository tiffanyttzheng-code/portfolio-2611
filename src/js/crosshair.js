/* 十字线光标：鼠标在哪，哪里就拉出一横一竖两条贯穿全屏的品牌红线。
 * 线不是整段实线，而是随机长短的实线段、点线段和 ASCII 字符段拼起来的；线段从交点往外缓慢流动，一部分会闪，字符会跳。
 * 交点旁显示坐标；移到可点击的元素上时，四角框吸附过去包住整个元素，显示 LOCK · 标签；点击时放一圈命中框。
 * 画在一张铺满屏幕的 canvas 上。颜色取网站 --red，不加阴影或描边。触屏设备不启用。 */
(() => {
  'use strict';

  if (!matchMedia('(pointer: fine)').matches) return;
  const canvas = document.querySelector('.xhair');
  const ctx = canvas && canvas.getContext('2d');
  if (!ctx) return;
  document.documentElement.classList.add('has-xhair'); // 隐藏系统光标
  const cursorColor = getComputedStyle(document.documentElement).getPropertyValue('--red').trim() || '#FF0A3C';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GAP = 14;       // 交点周围留空
  const PERIOD = 720;   // 线段图案的重复周期（像素）
  const FLOW = 26;      // 往外流动的速度（像素/秒）
  const H_GLYPHS = '-=~+-:', V_GLYPHS = '|:!¦|';

  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (a, b) => a + rnd() * (b - a);

  // 预先生成一段随机图案：每一节是 实线 / 点线 / 字符 / 空白，长短随机
  function makePattern() {
    const parts = [];
    let p = 0;
    while (p < PERIOD) {
      const r = rnd();
      const kind = r < .42 ? 'solid' : r < .62 ? 'dots' : r < .84 ? 'glyph' : 'gap';
      const len = kind === 'gap' ? R(10, 46) : kind === 'glyph' ? R(28, 84) : R(10, 70);
      parts.push({ kind, from: p, to: Math.min(PERIOD, p + len), flick: rnd() < .3, ph: R(0, 6.3) });
      p += len + R(3, 16); // 节与节之间总有一点缝
    }
    return parts;
  }
  const PATTERNS = { h: [makePattern(), makePattern()], v: [makePattern(), makePattern()] }; // 交点两侧各一套，不对称更自然

  const mouse = { x: -100, y: -100, in: false }, pos = { x: -100, y: -100 };
  let hoverEl = null;
  addEventListener('pointermove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!mouse.in) { pos.x = mouse.x; pos.y = mouse.y; mouse.in = true; }
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.in = false; });
  addEventListener('blur', () => { mouse.in = false; });
  document.addEventListener('pointerover', e => { hoverEl = e.target.closest ? e.target.closest('a, button, [data-cursor]') : null; });
  // 锁定框：平时是交点上的小框；悬停可点的元素时，四角框“吸附”过去包住整个元素（游戏里的瞄准锁定）；点击时放一圈命中框
  const box = { x: -100, y: -100, w: 20, h: 20 };
  let hit = 0;
  addEventListener('pointerdown', () => { if (hoverEl) hit = 1; }, { passive: true });

  let t0 = performance.now(), alpha = 0, frame = 0;

  // 沿一侧画线：dir = 1 往右/下，-1 往左/上；len = 这一侧到屏幕边缘的长度
  function drawArm(horizontal, dir, len, t, parts, dpr) {
    const flow = reduce ? 0 : (t * FLOW) % PERIOD;
    const epoch = Math.floor(t * 9); // 字符和闪烁每秒刷新 9 次
    const glyphs = horizontal ? H_GLYPHS : V_GLYPHS;
    for (let tile = -PERIOD; tile < len + PERIOD; tile += PERIOD) {
      for (const part of parts) {
        let a = tile + part.from + flow, b = tile + part.to + flow;
        if (b < GAP || a > len) continue;
        a = Math.max(a, GAP); b = Math.min(b, len);
        if (b - a < 2 || part.kind === 'gap') continue;
        const fade = 1 - .45 * (a / Math.max(len, 1)); // 越远越淡
        let op = fade;
        if (part.flick && !reduce) op *= .25 + .75 * Math.abs(Math.sin(t * 7 + part.ph));
        ctx.globalAlpha = op * alpha;
        const at = d => horizontal ? [pos.x + dir * d, pos.y] : [pos.x, pos.y + dir * d];
        if (part.kind === 'solid') {
          const [x1, y1] = at(a), [x2, y2] = at(b);
          ctx.fillRect(Math.min(x1, x2) - (horizontal ? 0 : .5 * dpr), Math.min(y1, y2) - (horizontal ? .5 * dpr : 0),
            horizontal ? Math.abs(x2 - x1) : dpr, horizontal ? dpr : Math.abs(y2 - y1));
        } else if (part.kind === 'dots') {
          for (let d = a; d < b; d += 5 * dpr) { const [x, y] = at(d); ctx.fillRect(x - dpr * .75, y - dpr * .75, dpr * 1.5, dpr * 1.5); }
        } else {
          const step = 8 * dpr;
          let k = Math.floor(part.from);
          for (let d = a; d < b; d += step, k++) {
            const [x, y] = at(d);
            const ch = glyphs[(k * 7 + (part.flick ? epoch : 0)) % glyphs.length];
            ctx.fillText(ch, x, y);
          }
        }
      }
    }
  }

  function draw() {
    const now = performance.now(), t = (now - t0) / 1000;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);

    alpha += ((mouse.in ? 1 : 0) - alpha) * .15;
    if (alpha < .01) return;
    pos.x += (mouse.x - pos.x) * .35;
    pos.y += (mouse.y - pos.y) * .35;
    const cx = pos.x * dpr, cy = pos.y * dpr;
    const P = { x: cx, y: cy };

    ctx.save();
    ctx.fillStyle = cursorColor;
    ctx.strokeStyle = cursorColor;
    ctx.font = `600 ${11 * dpr}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // drawArm 用 pos，这里临时换成设备像素坐标
    const saved = { x: pos.x, y: pos.y };
    pos.x = P.x; pos.y = P.y;
    drawArm(true, 1, w - cx, t, PATTERNS.h[0], dpr);
    drawArm(true, -1, cx, t, PATTERNS.h[1], dpr);
    drawArm(false, 1, h - cy, t, PATTERNS.v[0], dpr);
    drawArm(false, -1, cy, t, PATTERNS.v[1], dpr);
    pos.x = saved.x; pos.y = saved.y;

    // 交点：一个小方点；锁定框跟着目标走
    ctx.globalAlpha = alpha;
    const label = hoverEl ? (hoverEl.dataset.cursor || '') : '';
    let tx = cx - 14 * dpr, ty = cy - 14 * dpr, tw = 28 * dpr, th = 28 * dpr, locked = false;
    if (hoverEl && hoverEl.isConnected) {
      const r = hoverEl.getBoundingClientRect(), pad = 8;
      // display:contents 的元素量不到尺寸；太大的元素（超过大半屏）也不框，免得框住整页
      if (r.width > 0 && r.height > 0 && r.width < innerWidth * .7 && r.height < innerHeight * .7) {
        tx = (r.left - pad) * dpr; ty = (r.top - pad) * dpr; tw = (r.width + pad * 2) * dpr; th = (r.height + pad * 2) * dpr; locked = true;
      }
    }
    const ease = reduce ? 1 : .22;
    box.x += (tx - box.x) * ease; box.y += (ty - box.y) * ease; box.w += (tw - box.w) * ease; box.h += (th - box.h) * ease;
    const corners = (x, y, w, h) => {
      const k = Math.min(14 * dpr, w / 3, h / 3);
      ctx.beginPath();
      ctx.moveTo(x, y + k); ctx.lineTo(x, y); ctx.lineTo(x + k, y);
      ctx.moveTo(x + w - k, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + k);
      ctx.moveTo(x + w, y + h - k); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - k, y + h);
      ctx.moveTo(x + k, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - k);
      ctx.stroke();
    };
    ctx.lineWidth = (locked ? 1.5 : 1) * dpr;
    if (locked || hoverEl) corners(box.x, box.y, box.w, box.h);
    else ctx.fillRect(cx - 5 * dpr, cy - 5 * dpr, 10 * dpr, 10 * dpr);
    // 命中：框往外放大一圈并淡掉
    if (hit > .02) {
      const g = (1 - hit) * 22 * dpr;
      ctx.globalAlpha = alpha * hit;
      corners(box.x - g, box.y - g, box.w + g * 2, box.h + g * 2);
      hit *= .86;
    }

    // 文字：锁定时在框左上角写 LOCK · 标签；否则交点右下角显示坐标或标签
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `600 ${10 * dpr}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
    if (locked) {
      ctx.globalAlpha = alpha;
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${hit > .3 ? 'HIT' : 'LOCK'} · ${label || 'TARGET'}`, box.x, box.y - 5 * dpr);
    } else {
      const text = label || `X ${String(Math.round(mouse.x)).padStart(4, '0')}  Y ${String(Math.round(mouse.y)).padStart(4, '0')}`;
      ctx.globalAlpha = alpha * (label ? 1 : .75);
      ctx.fillText(text, cx + 12 * dpr, cy + 10 * dpr);
    }
    ctx.restore();
    frame++;
  }

  (function loop() { draw(); requestAnimationFrame(loop); })();
})();
