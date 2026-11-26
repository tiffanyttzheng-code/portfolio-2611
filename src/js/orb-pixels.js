/* 首页红球：ASCII 字符像素风（参考 React Bits · Gradient ASCII）
 * - 球体切成 13 设计稿像素一格，每格画一个等宽字符：颜色是原图那一格的真实颜色，越亮的地方字符越“重”（: - = + * # % @）；
 * - 字符下面是原图本身的颜色（不压暗、不加黑灰），字符是同色系稍浅的红，整体仍是原来的正红；
 * - 一道很慢的光波从左上扫向右下，经过的字符变重一级；极少数字符偶尔泛起浅粉；
 * - 鼠标靠近时，附近的字符会乱跳（scramble），离开后慢慢恢复；
 * - 球外的圆点、虚线外环画成像素方块；两圈细环画成一格一格的像素环。
 * 每格颜色由离线脚本预先算好（orb-data.js），底图是 bomb-base.webp：网页里不读图片像素，直接双击打开 html 也能正常显示。
 * 只在红球出现在屏幕里时才逐帧重画（约 30 帧）。坐标：画布对应设计稿里 bomb.webp 的位置（197, 129，925.4 × 945.4）。 */
(() => {
  'use strict';

  const canvas = document.querySelector('[data-orb-pixels]');
  const D = window.ORB_DATA;
  if (!canvas || !D) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SRC = './assets/home/bomb-base.webp?v=4';
  const RAMP = ':-=+*#%@';                 // 由轻到重
  const NOISE = '@#%&$*+=?!/<>';           // 鼠标附近乱跳用的字符
  const RINGS = [                          // 两圈细环：半径（设计稿像素）、颜色、每隔几格画一格、透明度
    { r: 263, color: '#FF0A3C', every: 1, alpha: .9 },
    { r: 271.7, color: '#FF0A3C', every: 2, alpha: .45 },
  ];
  const { k, cx, cy, r, cell } = D;

  let ctx, base, raf = 0, visible = true;
  const cells = [], ringDots = [];
  const mouse = { x: -1e4, y: -1e4 };

  const img = new Image();
  img.onload = setup;
  img.src = SRC;

  function setup() {
    canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
    ctx = canvas.getContext('2d');

    // 底图：柔光 + 原色球体 + 球外的像素方块（静态，只画一次）
    base = document.createElement('canvas');
    base.width = canvas.width; base.height = canvas.height;
    const b = base.getContext('2d');
    b.drawImage(img, 0, 0);
    const sz = Math.round(D.oc * .86);
    for (let i = 0; i < D.dots.length; i += 5) {
      const [x, y, R, G, B] = D.dots.slice(i, i + 5);
      b.fillStyle = `rgb(${R},${G},${B})`;
      b.fillRect(Math.round(x - sz / 2), Math.round(y - sz / 2), sz, sz);
    }

    // 字符格：亮度归一到球体自己的明暗范围，再映射到字符轻重
    const lum = (R, G, B) => .3 * R + .55 * G + .15 * B;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < D.cells.length; i += 5) { const l = lum(D.cells[i + 2], D.cells[i + 3], D.cells[i + 4]); lo = Math.min(lo, l); hi = Math.max(hi, l); }
    const up = (v, t) => Math.round(v + (255 - v) * t);
    for (let i = 0; i < D.cells.length; i += 5) {
      const [gx, gy, R, G, B] = D.cells.slice(i, i + 5);
      const x = cx + gx * cell, y = cy + gy * cell, edge = Math.hypot(x - cx, y - cy) / r;
      if (edge > .88 && Math.random() < (edge - .88) / .12 * .55) continue; // 边缘随机缺几格，轮廓像网点一样化开
      const t = (lum(R, G, B) - lo) / Math.max(1, hi - lo);
      // 字符颜色：原色稍微提一点亮（字符笔画细，不提亮会显得比原图暗）
      cells.push({ x, y, lvl: Math.round(.35 + t * (RAMP.length - 1.35)), col: `rgb(${up(R, .3)},${up(G, .2)},${up(B, .2)})`, hot: `rgb(${up(R, .3)},${up(G, .3)},${up(B, .3)})`, spark: -1, mess: 0, ch: '' });
    }

    // 像素细环
    const rc = 5 * k;
    for (const ring of RINGS) {
      const rr = ring.r * k, steps = Math.round(Math.PI * 2 * rr / rc);
      for (let i = 0; i < steps; i += ring.every) {
        const a = i / steps * Math.PI * 2;
        ringDots.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, s: rc * .7, col: ring.color, alpha: ring.alpha, a });
      }
    }

    if (reduce) { render(0); return; }
    addEventListener('pointermove', e => {
      const bx = canvas.getBoundingClientRect();
      if (!bx.width) return;
      mouse.x = (e.clientX - bx.left) / bx.width * canvas.width;
      mouse.y = (e.clientY - bx.top) / bx.height * canvas.height;
    }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }).observe(canvas);
    loop();
  }

  function render(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.font = `700 ${(cell * 1.2).toFixed(1)}px "Courier New", Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const wave = t * .00045, R2 = (70 * k) ** 2;
    for (const p of cells) {
      // 光波经过时字符变重一级
      const glow = Math.max(0, Math.sin((p.x + p.y) / k * .009 - wave * 6.28 * 1.2)) ** 6;
      let ch = RAMP[Math.min(RAMP.length - 1, p.lvl + (glow > .5 ? 1 : 0))], col = glow > .5 ? p.hot : p.col;
      // 鼠标附近：字符乱跳，离开后慢慢恢复
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      if (dx * dx + dy * dy < R2) p.mess = 1;
      if (p.mess > 0) {
        if (!p.ch || Math.random() < .35) p.ch = NOISE[(Math.random() * NOISE.length) | 0];
        ch = p.ch; col = p.hot;
        p.mess -= .025;
        if (p.mess <= 0) p.ch = '';
      }
      // 零星闪亮：很少，浅粉色
      if (p.spark < 0 && Math.random() < .00015) p.spark = 0;
      if (p.spark >= 0) {
        p.spark += .05;
        if (Math.sin(Math.min(1, p.spark) * Math.PI) > .4) { col = '#FFC2D0'; ch = '*'; }
        if (p.spark >= 1) p.spark = -1;
      }
      ctx.fillStyle = col;
      ctx.fillText(ch, p.x, p.y);
    }
    // 像素细环：一格一格，透明度沿着圆周慢慢流动
    for (const d of ringDots) {
      ctx.globalAlpha = d.alpha * (.6 + .4 * Math.sin(d.a * 3 - t * .0012));
      ctx.fillStyle = d.col;
      ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s);
    }
    ctx.globalAlpha = 1;
  }

  let lastT = 0;
  function loop() {
    if (raf) return;
    const step = t => {
      raf = 0;
      if (!visible) return;
      if (t - lastT > 33) { lastT = t; render(t); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
})();
