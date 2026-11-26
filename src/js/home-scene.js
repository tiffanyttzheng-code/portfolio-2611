/* 主页的两块动态画布（按 Figma「Frame 12」）：
 * - 首屏：爆炸球四周的彩色碎屑，慢慢往外飘、自转、闪烁，飘远了再从球边重新出发
 * - 雨幕：斜着落下的白色雨丝，落到水面激起细腻的衰减水波
 * 坐标沿用 1920 宽设计稿，按区块实际宽度缩放（u = 宽 / 1920）。只在区块进入视口时才画。
 * 用法：HomeScene.start()（主页出现时调用）。 */
(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let seed = 23;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (a, b) => a + rnd() * (b - a);
  const COLORS = ['#FF0A3C', '#FF0A3C', '#FF4B86', '#FF4B86', '#2EDCF7', '#FFFFFF'];

  function fit(canvas) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    return { w, h, dpr };
  }
  const inView = el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; };

  /* ---------- 首屏碎屑 ---------- */
  const confettiCanvas = document.querySelector('[data-confetti]');
  const CENTER = { x: 637.5, y: 556 }; // 爆炸球在设计稿里的中心
  const bits = Array.from({ length: 90 }, () => ({
    ang: R(0, Math.PI * 2), r0: R(300, 380), span: R(220, 520), speed: R(.025, .07), ph: rnd(),
    rect: rnd() < .45, size: R(4, 12), rot: R(0, 6.3), spin: R(-2, 2), color: COLORS[Math.floor(rnd() * COLORS.length)], f: R(2, 6),
  }));
  function drawConfetti(t) {
    const { w, h, dpr } = fit(confettiCanvas);
    const ctx = confettiCanvas.getContext('2d'), u = w / 1920;
    ctx.clearRect(0, 0, w, h);
    for (const b of bits) {
      const life = (t * b.speed + b.ph) % 1;                // 0 → 1：从球边飘到最远
      const r = (b.r0 + life * b.span) * u;
      const a = b.ang + life * .25;
      const x = CENTER.x * u + Math.cos(a) * r, y = CENTER.y * u + Math.sin(a) * r * .92;
      ctx.globalAlpha = Math.sin(life * Math.PI) * (.55 + .45 * Math.sin(t * b.f + b.ph * 9));
      ctx.fillStyle = b.color;
      // 像素风：位置吸附到格子上，形状由整格方块拼成
      const g = Math.max(2, Math.round(4 * u * dpr)), cx = Math.round(x / g) * g, cy = Math.round(y / g) * g;
      const n = Math.max(1, Math.round(b.size / 4));          // 这颗碎屑有几格
      const px = (i, j) => ctx.fillRect(cx + i * g, cy + j * g, g - (g > 3 ? 1 : 0), g - (g > 3 ? 1 : 0));
      if (b.rect) {
        // 长条：按旋转角取 横 / 竖 / 斜（台阶状）三种，跟着慢慢换方向
        const dir = ((Math.round((b.rot + t * b.spin) / (Math.PI / 4)) % 4) + 4) % 4;
        for (let i = -n; i <= n; i++) dir === 0 ? px(i, 0) : dir === 2 ? px(0, i) : px(i, dir === 1 ? i : -i);
      } else if (n >= 2) {
        px(0, 0); px(-1, 0); px(1, 0); px(0, -1); px(0, 1);     // 大的圆点 → 像素十字
      } else {
        px(0, 0);                                              // 小的 → 单格
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- 雨幕：透视落点、连续波前和阻尼衰减 ---------- */
  const rainCanvas = document.querySelector('[data-rain]');
  const ripples = [];
  function newDrop(scatter, lane = 0) {
    // 错落的落点分区避免随机聚团，每次仅在分区内轻微变化。
    const depths = [.25, .65, .4, .82, .2, .58, .9, .42];
    const depth = Math.max(0, Math.min(1, depths[lane] + R(-.06, .06))), land = 660 + depth * 300; // 落点对齐设计稿里雨幕的水面（区块内 y 656–968）
    const speed = 1100 + depth * 750;
    return { lane, target: 900 + lane * 130 + R(-28, 28), y: scatter ? R(180, land) : R(100, 300),
      land, depth, speed, len: R(45, 80) * (.8 + depth), drift: R(.08, .14) };
  }
  const drops = Array.from({ length: 8 }, (_, lane) => newDrop(true, lane));
  let lastRain = null, rainTime = 0;
  function drawRain(t) {
    const { w, h, dpr } = fit(rainCanvas);
    const ctx = rainCanvas.getContext('2d'), u = w / 1920;
    const dt = lastRain === null ? 0 : Math.min(.04, Math.max(0, t - lastRain));
    lastRain = t;
    rainTime += reduce ? 0 : dt;
    ctx.clearRect(0, 0, w, h);
    if (reduce) return;
    ctx.save();
    ctx.scale(u, u);
    ctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.speed * dt;
      if (d.y >= d.land) {
        ripples.push({ x: d.target, y: d.land, born: rainTime, depth: d.depth,
          life: R(1.8, 2.4), size: R(1.35, 1.65), phase: R(0, Math.PI * 2) });
        Object.assign(d, newDrop(false, d.lane));
        continue;
      }
      const x = d.target - (d.land - d.y) * d.drift;
      const fade = Math.min(1, Math.max(0, (d.y - 150) / 250));
      const g = ctx.createLinearGradient(x - d.len * d.drift, d.y - d.len, x, d.y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,255,255,${fade * (.8 + d.depth * .18)})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6 + d.depth * 1.1;
      ctx.beginPath(); ctx.moveTo(x - d.len * d.drift, d.y - d.len); ctx.lineTo(x, d.y); ctx.stroke();
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i], age = rainTime - r.born;
      if (age > r.life) { ripples.splice(i, 1); continue; }
      const perspective = .19 + r.depth * .15;
      for (let ring = 0; ring < 2; ring++) {
        const a = age - ring * .23;
        if (a <= 0) continue;
        const p = a / r.life;
        const radius = (3 + (65 + r.depth * 45) * Math.pow(p, .78)) * r.size;
        const opacity = Math.min(1, a / .07) * Math.pow(1 - p, 1.3) * (.9 + r.depth * .08) * Math.pow(.58, ring);
        // 白色连续波前，保留轻微不规则起伏与自然衰减。
        {
          ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
          ctx.lineWidth = (1.8 + r.depth * 1.1) * (1 - p * .35);
          ctx.beginPath();
          for (let j = 0; j <= 72; j++) {
            const angle = j / 72 * Math.PI * 2;
            const wobble = 1 + .018 * Math.sin(angle * 3 + r.phase + age) + .012 * Math.cos(angle * 5 - r.phase);
            const x = r.x + Math.cos(angle) * radius * wobble;
            const y = r.y + Math.sin(angle) * radius * perspective * wobble;
            if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath(); ctx.stroke();
        }
      }
      // 短暂的微小水珠，按抛物线落回原处。
      if (age < .28 && r.depth > .35) {
        const p = age / .28;
        ctx.fillStyle = `rgba(255,255,255,${.75 * (1 - p)})`;
        for (let j = 0; j < 3; j++) {
          const angle = r.phase + j * 2.094;
          const x = r.x + Math.cos(angle) * p * 10;
          const y = r.y + Math.sin(angle) * p * 3 - Math.sin(p * Math.PI) * (4 + r.depth * 5);
          ctx.beginPath(); ctx.ellipse(x, y, .7, 1.1, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  let started = false;
  const t0 = performance.now();
  function loop(now) {
    const t = (now - t0) / 1000;
    const page = document.querySelector('.page--home');
    if (page && page.classList.contains('is-active')) {
      if (confettiCanvas && inView(confettiCanvas)) drawConfetti(reduce ? 0 : t);
      if (rainCanvas && inView(rainCanvas)) drawRain(t); else lastRain = t;
    }
    requestAnimationFrame(loop);
  }

  window.HomeScene = {
    start() {
      if (started) return;
      started = true;
      requestAnimationFrame(loop);
    },
  };
})();
