/* 窗台字符珠帘：窗台上一片红色字符花丛，下面垂着十几根白色字符藤蔓。
 * 鼠标划过会把藤蔓拨开，藤蔓带着惯性来回荡、慢慢停下；按住能揪住一把，甩开手会被甩出去；平时随风轻轻摆。
 *
 * 为了不卡：
 *   - 字符是固定的一小组（花：0 @ * % o；藤蔓：: ; & % ' |），总共几百颗；
 *   - 每种「字符 + 颜色」只用 fillText 画一次，缓存成小图，之后每帧只 drawImage；
 *   - 画布不在屏幕里时停掉动画；系统开了「减少动态效果」时只画一帧静态图。
 * 物理：每根藤蔓是一条 verlet 绳（顶端钉在窗台下沿，只受重力、惯性、空气阻力和微风），花丛里每颗字是一个弹簧粒子。
 *
 * 坐标用场景的设计单位（默认 340 × 700，和 text-curtain.html 里的窗户 SVG 一致），按画布宽度等比缩放。
 * 用法：const c = TextCurtain.mount(canvasEl, { ...可选参数 }); c.destroy(); */
(() => {
  'use strict';

  const DEFAULTS = {
    sceneW: 340, sceneH: 700,
    band: { x0: 12, x1: 328, y0: 258, y1: 360 }, // 花丛范围（盖住窗户下沿和窗台，两边比窗户宽一点）
    sill: 352,                                   // 藤蔓挂在这条线上
    vines: 24,                                   // 藤蔓根数
    vineLen: [150, 330],                         // 藤蔓长度范围
    cell: 11,                                    // 字符间距
    size: 13,                                    // 字号
    font: '700 {s}px "JetBrains Mono", Consolas, monospace',
    red: '#FF0A3C', pink: '#FF4B86', white: '#FFFFFF',
    flowerChars: '@0O*%o:',                      // 从“重”到“轻”：花心用 @ 0，边缘用 * % :
    vineChars: ":;&%'|:&",
    hand: 16,          // 鼠标当作一只“手”：碰撞半径（设计单位）
    carry: .3,         // 手划过时带走字的速度比例
    grab: 26,          // 按住时揪住的范围
    gravity: 1800,     // 重力加速度（设计单位 / 秒²），决定藤蔓荡回来的快慢
    drag: .997,        // 每个小步保留的速度（越接近 1 惯性越大、荡得越久）
    substeps: 3, iterations: 6,
    wind: 70,          // 微风的最大加速度
    flowerK: 260, flowerDamp: .93,               // 花丛弹簧的硬度和阻尼
    seed: 11,
  };

  function mount(canvas, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const ctx = canvas.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seed = o.seed;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const R = (a, b) => a + rnd() * (b - a);

    /* ---------- 固定的字符布局（同一个 seed 每次生成一样） ---------- */

    // 花丛：几团圆形的“花”叠在一起，按格子取样；越靠花心字越重
    const flowers = [];
    {
      const { x0, x1, y0, y1 } = o.band, blobs = [];
      for (let i = 0; i < 40; i++) blobs.push({ x: R(x0 + 8, x1 - 8), y: R(y0 + 14, y1 - 4), r: R(18, 34), c: rnd() < .65 ? o.red : o.pink });
      for (let y = y0; y <= y1; y += o.cell) {
        for (let x = x0; x <= x1; x += o.cell * .78) {
          let best = 0, c = o.red;
          for (const b of blobs) { const v = 1 - Math.hypot(x - b.x, y - b.y) / b.r; if (v > best) { best = v; c = b.c; } }
          if (best <= 0) continue;
          const ch = o.flowerChars[Math.min(o.flowerChars.length - 1, Math.floor((1 - best) * o.flowerChars.length))];
          flowers.push({ x, y, px: x, py: y, hx: x, hy: y, ch, c, heat: 0 });
        }
      }
    }

    // 藤蔓：从窗台下沿垂下，长短不一；大部分是白色字符，偶尔串一颗红色小花
    const vines = [];
    for (let i = 0; i < o.vines; i++) {
      const x = o.band.x0 + 10 + (o.band.x1 - o.band.x0 - 20) * (i + R(-.25, .25)) / (o.vines - 1);
      const n = Math.round(R(...o.vineLen) / o.cell), phase = R(0, Math.PI * 2);
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const y = o.sill + k * o.cell, bead = k > 2 && rnd() < .1;
        pts.push({ x, y, px: x, py: y, hx: x, hy: y, heat: 0,
          ch: bead ? (rnd() < .5 ? '@' : '0') : o.vineChars[(k + i) % o.vineChars.length],
          c: bead ? (rnd() < .6 ? o.red : o.pink) : o.white });
      }
      pts.phase = phase;
      vines.push(pts);
    }

    /* ---------- 画布与字符缓存 ---------- */

    let W = 1, H = 1, dpr = 1, scale = 1;
    const sprites = new Map();
    function sprite(ch, c) {
      const key = ch + c;
      let s = sprites.get(key);
      if (!s) {
        const px = o.size * scale * dpr, side = Math.ceil(px * 1.5);
        s = document.createElement('canvas');
        s.width = s.height = side;
        const g = s.getContext('2d');
        g.font = o.font.replace('{s}', px.toFixed(2));
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c;
        g.fillText(ch, side / 2, side / 2);
        sprites.set(key, s);
      }
      return s;
    }
    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      dpr = Math.min(2, devicePixelRatio || 1);
      scale = W / o.sceneW;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      sprites.clear();
    }

    /* ---------- 物理 ---------- */
    // 藤蔓是真正“挂着”的绳子：只有重力、惯性（verlet：速度 = 这一步位置 − 上一步位置）和固定字距，
    // 不再有把字拉回原位的弹簧——垂直全靠重力，被拨开后会像钟摆一样来回荡、慢慢停下。
    // 每帧分几个小步算，鼠标位置在小步之间插值，快速划过也不会穿过去。
    const DT = 1 / 60 / o.substeps, DT2 = DT * DT;
    const mouse = { x: 0, y: 0, lx: 0, ly: 0, inside: false, down: false, grabbed: [] };
    let t = 0;

    // 手（鼠标）是一个小圆：碰到的字被推到圆外，并带走一部分手的速度
    function hit(p, hx, hy, hvx, hvy) {
      const dx = p.x - hx, dy = p.y - hy, d2 = dx * dx + dy * dy, r = o.hand;
      if (d2 >= r * r) return;
      const d = Math.sqrt(d2) || .001;
      p.x = hx + dx / d * r; p.y = hy + dy / d * r;
      p.px -= hvx * o.carry; p.py -= hvy * o.carry;
      p.heat = 1;
    }
    const wind = (phase, u) => o.wind * u * (Math.sin(t * .8 + phase * .3) * .6 + Math.sin(t * 2.1 + phase) * .4);

    function substep(hx, hy, hvx, hvy) {
      t += DT;
      const handOn = mouse.inside;
      // 藤蔓：惯性 + 空气阻力 + 重力 + 微风
      for (const v of vines) {
        for (let k = 1; k < v.length; k++) {
          const p = v[k];
          if (p.held) continue;
          const vx = (p.x - p.px) * o.drag, vy = (p.y - p.py) * o.drag;
          p.px = p.x; p.py = p.y;
          p.x += vx + wind(v.phase, k / v.length) * DT2;
          p.y += vy + o.gravity * DT2;
          if (handOn) hit(p, hx, hy, hvx, hvy);
        }
      }
      // 揪住的字直接跟着手走；它的上一步位置保留着，松手时就带着这一下的速度被甩出去
      for (const g of mouse.grabbed) { g.p.px = g.p.x; g.p.py = g.p.y; g.p.x = hx + g.ox; g.p.y = hy + g.oy; g.p.heat = 1; }
      // 固定字距：顶端钉死、揪住的字不动，其余两头各让一半；每遍换方向扫，绳子不容易被拉长
      for (let n = 0; n < o.iterations; n++) {
        for (const v of vines) {
          const fwd = n % 2 === 0;
          for (let j = 1; j < v.length; j++) {
            const k = fwd ? j : v.length - j, a = v[k - 1], b = v[k];
            const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || .001, diff = (d - o.cell) / d;
            const wa = k === 1 || a.held ? 0 : b.held ? 1 : .5, wb = b.held ? 0 : 1 - wa;
            a.x += dx * diff * wa; a.y += dy * diff * wa;
            b.x -= dx * diff * wb; b.y -= dy * diff * wb;
          }
        }
      }
      // 花丛：种在窗台上的弹簧粒子，被碰到会晃几下再停
      for (const p of flowers) {
        const vx = (p.x - p.px) * o.flowerDamp, vy = (p.y - p.py) * o.flowerDamp;
        p.px = p.x; p.py = p.y;
        p.x += vx + (p.hx - p.x) * o.flowerK * DT2;
        p.y += vy + (p.hy - p.y) * o.flowerK * DT2;
        if (handOn) hit(p, hx, hy, hvx * .5, hvy * .5);
        p.heat *= .96;
      }
      for (const v of vines) for (const p of v) p.heat *= .97;
    }

    function step() {
      const n = o.substeps, dx = (mouse.x - mouse.lx) / n, dy = (mouse.y - mouse.ly) / n;
      for (let s = 1; s <= n; s++) substep(mouse.lx + dx * s, mouse.ly + dy * s, dx, dy);
      mouse.lx = mouse.x; mouse.ly = mouse.y;
    }

    /* ---------- 绘制 ---------- */

    function put(p, ang) {
      const s = sprite(p.ch, p.heat > .3 && p.c === o.white ? o.pink : p.c), h = s.width / 2;
      const x = p.x * scale * dpr, y = p.y * scale * dpr;
      if (ang) { const c = Math.cos(ang), sn = Math.sin(ang); ctx.setTransform(c, sn, -sn, c, x, y); ctx.drawImage(s, -h, -h); }
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(s, x - h, y - h); }
    }
    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const v of vines) {
        for (let k = 1; k < v.length; k++) {
          const a = v[k - 1], b = v[k + 1] || v[k];
          put(v[k], Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2);
        }
      }
      for (const p of flowers) put(p, 0);
    }

    /* ---------- 循环、指针、可见性 ---------- */

    let raf = 0, visible = true, alive = true;
    function frame() {
      raf = 0;
      if (!alive || !visible) return;
      step(); draw();
      raf = requestAnimationFrame(frame);
    }
    const play = () => { if (!raf && alive && visible && !reduce) raf = requestAnimationFrame(frame); };

    const local = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
    function onMove(e) {
      const [x, y] = local(e);
      // 刚进入画布时把“上一次位置”也设成这里，免得手从很远的地方一路扫过来
      if (!mouse.inside) { mouse.lx = x; mouse.ly = y; mouse.inside = true; }
      mouse.x = x; mouse.y = y;
    }
    function onDown(e) {
      onMove(e);
      mouse.down = true; mouse.grabbed = [];
      for (const v of vines) for (let k = 1; k < v.length; k++) {
        const p = v[k], ox = p.x - mouse.x, oy = p.y - mouse.y;
        if (ox * ox + oy * oy < o.grab * o.grab) { p.held = true; mouse.grabbed.push({ p, ox: ox * .4, oy: oy * .4 }); }
      }
      canvas.setPointerCapture?.(e.pointerId);
    }
    function onUp() { mouse.down = false; for (const g of mouse.grabbed) g.p.held = false; mouse.grabbed = []; }
    function onLeave() { if (!mouse.down) mouse.inside = false; }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.style.touchAction = 'pan-y';

    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; play(); });
    io.observe(canvas);

    resize(); draw(); play();

    return {
      debug: { vines, flowers }, // 只读：调试时看节点位置
      destroy() {
        alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        canvas.removeEventListener('pointerleave', onLeave);
      },
    };
  }

  window.TextCurtain = { mount };
})();
