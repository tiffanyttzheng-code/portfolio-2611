/* 红蓝版 loading：空白 → 天空一下子出现 → 红色爆炸物随加载进度胀缩 → 临界 → 爆炸 → 纯白 → 首页（天空里的窗台）
 * 接入真实加载：调用 LoadingPop.setProgress(0~1)，加载完成后调用 LoadingPop.finish()。
 * 不带 ?manual 打开时，会用随机进度模拟一次加载。 */
(() => {
  'use strict';

  if (new URLSearchParams(location.search).get('return') === 'portfolio' && window.Site) {
    gsap.set(['.bg', '.bomb', '.hazard', '.hud', '.label', '.burst', '.starburst', '.grain', '.layer--trails', '.wipe--red'], { autoAlpha: 0 });
    Site.restorePortfolio();
    const cleanURL = new URL(location.href);
    cleanURL.searchParams.delete('return');
    history.replaceState(null, '', cleanURL.href);
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const C = {
    sky: '#56CFF0', cyan: '#2EDCF7', red: '#FF0A3C', pink: '#FF4B86', white: '#FFFFFF', deep: '#1E7FC8',
    cloudShade: '#BFE9F7',
  };

  // 固定种子：每次打开的随机细节一致
  let seed = 20261030;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const R = (a, b) => a + rnd() * (b - a);

  // 爆炸物尺寸曲线：at 是加载进度，s 是尺寸（1 = 80vmin），两点之间按进度连续插值
  const STEPS = [
    { at: 0, s: .10 }, { at: .15, s: .20 }, { at: .30, s: .30 }, { at: .45, s: .25 },
    { at: .60, s: .50 }, { at: .75, s: .60 }, { at: .88, s: .55 }, { at: 1, s: .64 },
  ];
  const MIN_LOAD = 1200; // 加载再快，从 0% 到 100% 也至少走 1.2 秒
  const sizeAt = p => {
    let i = 1;
    while (i < STEPS.length - 1 && p > STEPS[i].at) i++;
    const a = STEPS[i - 1], b = STEPS[i];
    return a.s + (b.s - a.s) * Math.min(1, Math.max(0, (p - a.at) / (b.at - a.at)));
  };
  const CX = 800, CY = 500; // 爆炸物在背景 viewBox 里的位置
  const SCENE_Y = 50;       // Figma 画面是 1600×900，放进 1600×1000 的背景时下移 50

  const stage = $('#stage'), bg = $('#bg'), bomb = $('#bomb');
  const shakeEl = $('.bomb__shake'), squashEl = $('.bomb__squash');
  const pressureEl = $('[data-pressure]'), stateEl = $('[data-state]'), barEl = $('[data-bar]'), pctEl = $('[data-pct]');
  // appear：出现时的弹出系数；kick：越过节点时的一下冲击
  const st = { s: 0, appear: 0, kick: 0, shake: 0, base: 0 };
  const cam = { shake: 0, punch: 0 }; // 爆炸时整个画面的震动和镜头冲击
  const boil = { scale: 14 };

  /* ---------- 背景：天空 ---------- */

  function svg(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // 三层结构：外层定位，.bit-push 负责被冲击推开和爆炸飞散，.bit 负责漂浮
  function place(layer, x, y, cls) {
    const outer = svg('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, layer);
    const push = svg('g', { class: 'bit-push' }, outer);
    push.dataset.x = x;
    push.dataset.y = y;
    return svg('g', { class: `bit ${cls}` }, push);
  }

  // 云：几团圆叠成积云，底部压平，下面垫一层浅蓝阴影
  const CLOUD = [[-95, 6, 38], [-45, -22, 55], [25, -42, 70], [95, -18, 52], [145, 8, 36]];
  // 右下角留给百分比，不放云
  const CLOUDS = [
    { x: 150, y: 185, s: 1.7 },
    { x: 800, y: 100, s: .6, flip: true },
    { x: 1030, y: 985, s: 1.45 },
    { x: 70, y: 690, s: .7, flip: true },
  ];
  function cloud(layer, { x, y, s, flip }) {
    const g = place(layer, x, y, 'cloud');
    g.setAttribute('filter', `url(#${s > 1.2 ? 'px6' : 'px5'})`);
    const inner = svg('g', { transform: `scale(${flip ? -s : s} ${s})` }, g);
    [[C.cloudShade, 12], [C.white, 0]].forEach(([fill, dy]) => {
      const part = svg('g', { fill }, inner);
      CLOUD.forEach(([cx, cy, r]) => svg('circle', { cx, cy: cy + dy, r }, part));
      svg('rect', { x: -133, y: dy - 10, width: 316, height: 48, rx: 24 }, part);
    });
  }

  // 墨点按 Figma「01 入场完成」里精简后的位置（画面坐标）：[x, y, 直径]
  const DOTS = [
    [1246, 845, 5], [1349, 807, 5], [1317, 828, 4], [1235, 867, 24], [1243, 908, 10], [1279, 890, 9], [1245, 879, 10],
    [104, 516, 19], [120, 480, 5], [1383, 583, 10], [1350, 582, 6], [1384, 892, 25], [1323, 877, 5], [1352, 897, 7],
    [1346, 316, 29], [1411, 327, 6], [1376, 291, 5], [1341, 315, 8], [1290, 299, 7], [468, 506, 32], [450, 477, 6],
    [525, 476, 4], [465, 524, 4], [420, 503, 7], [94, 553, 27], [150, 547, 4], [62, 561, 5], [781, 222, 4],
    [1014, 155, 6], [1357, 66, 3], [1202, 668, 6], [249, 913, 5], [246, 431, 4], [1042, 804, 6], [180, 783, 3],
    [1522, 512, 5], [1470, 862, 6], [1162, 51, 5], [533, 85, 5], [529, 93, 4], [109, 167, 5], [1187, 816, 5],
    [705, 130, 5], [538, 687, 6], [1507, 590, 4], [1195, 548, 3], [1452, 27, 7], [891, 53, 3], [1490, 373, 4],
    [590, 121, 3], [1526, 574, 5], [404, 733, 4], [480, 621, 4], [1017, 277, 6], [1089, -14, 4], [1447, 344, 5],
    [479, 320, 4], [961, 861, 6], [1086, 739, 5], [1025, 581, 6], [505, 236, 5], [1458, 807, 4], [862, 777, 4],
    [159, 92, 3], [912, 745, 6], [1227, 874, 4], [173, 303, 5],
  ];
  // 字符化（参考 React Bits · Gradient ASCII）：点都换成字符，越密越亮的位置用越“重”的字符
  const INK = ['.', ':', '+', 'x', 'X', '0', '8', '#', '@']; // 墨点按直径选字符
  const FLOW = '@#x+:.  ';                                  // 能量点列里流动的字符序列
  // 会随机跳字的字符：每个节点在 dataset.set 里存它可以变成的几个字符
  const glyphs = [], trailCells = [];

  // 两条能量点列从角落流向爆炸物
  const TRAILS = [
    { d: 'M30 990 Q 330 780 600 620', w: 8, c: '#fff' },
    { d: 'M150 1000 Q 420 800 640 660', w: 4, c: C.pink },
    { d: 'M1580 20 Q 1280 250 1000 385', w: 8, c: '#fff' },
    { d: 'M1600 120 Q 1300 300 1020 420', w: 4, c: C.red },
  ];

  // 星星、圆点、碎片、虚线、速度线、箭头：直接用 Figma 导出的 SVG，放在 index.html 的 <template id="scene-elements"> 里
  // （不用 fetch 单独文件，双击 index.html 用 file:// 打开也能正常显示）
  function loadElements(layer) {
    const source = $('#scene-elements').content.querySelector('svg');
    const shift = svg('g', { transform: `translate(0 ${SCENE_Y})`, fill: 'none' }, layer); // 导出文件根节点的 fill="none" 要保留
    for (const node of [...source.children]) {
      const push = svg('g', { class: 'bit-push' }, shift);
      const d = node.getAttribute('d') || '';
      const spark = node.getAttribute('fill') === 'white' && (d.match(/L/g) || []).length > 30;
      const bit = svg('g', { class: spark ? 'bit el spark' : 'bit el' }, push);
      const shape = bit.appendChild(document.importNode(node, true));
      const b = bit.getBBox();
      // 圆点（只有曲线、宽高相等）换成同色的 @ 字符
      if (node.tagName === 'path' && !/L/.test(d) && /C/.test(d) && Math.abs(b.width - b.height) < 3 && b.width < 45) {
        const t = svg('text', { class: 'glyph', x: b.x + b.width / 2, y: b.y + b.height / 2, fill: node.getAttribute('fill'), 'font-size': (b.width * 1.3).toFixed(1) });
        t.textContent = '@';
        t.dataset.set = '@@#0';
        glyphs.push(t);
        shape.replaceWith(t);
      }
      const filled = (node.getAttribute('fill') || 'none') !== 'none', long = Math.max(b.width, b.height) / Math.max(1, Math.min(b.width, b.height));
      if (filled && bit.firstChild.tagName !== 'text' && Math.min(b.width, b.height) >= 10 && long < 5) {
        // 像素滤镜的取样网格从坐标原点铺开：包两层，把原点挪到元素自己的左上角，网格才能铺到它身上
        const bx = Math.floor(b.x), by = Math.floor(b.y);
        const wrap = svg('g', { filter: `url(#${pxFor(Math.max(b.width, b.height))})`, transform: `translate(${bx} ${by})` }, bit);
        const back = svg('g', { transform: `translate(${-bx} ${-by})` }, wrap);
        back.appendChild(bit.firstChild);
      }
      push.dataset.x = b.x + b.width / 2;
      push.dataset.y = b.y + b.height / 2 + SCENE_Y;
    }
  }

  // 背景网点滤镜：每 n 个单位取一个样点，膨胀成比格子略小的方块（中间留缝），再随机缺掉一些格子，像印刷网点。
  // 格子有 4 / 5 / 6 / 7 几种：大的云用粗一点的格子，小星星、小碎片用细格子，远近有层次
  const PX_SIZES = [4, 5, 6, 7];
  function pixelFilter() {
    const defs = bg.querySelector('defs') || svg('defs', {}, bg);
    for (const n of PX_SIZES) {
      const f = svg('filter', { id: `px${n}`, x: '-10%', y: '-10%', width: '120%', height: '120%', 'color-interpolation-filters': 'sRGB' }, defs);
      // 取样网格：每 n 个单位一个 1×1 的点（单点取样，缺格才判得准）
      svg('feFlood', { x: Math.floor(n / 2), y: Math.floor(n / 2), width: 1, height: 1 }, f);
      svg('feComposite', { width: n, height: n }, f);
      svg('feTile', { result: 'grid' }, f);
      // 随机缺格：噪声取阈值（fractalNoise 的值集中在 .5 附近，切在 .4），少量格子不出现，像印刷网点
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: .9, numOctaves: 1, seed: n * 7, result: 'noise' }, f);
      svg('feColorMatrix', { in: 'noise', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0', result: 'na' }, f);
      const ct = svg('feComponentTransfer', { in: 'na', result: 'keep' }, f);
      svg('feFuncA', { type: 'discrete', tableValues: '0 0 0 0 1 1 1 1 1 1' }, ct);
      svg('feComposite', { in: 'grid', in2: 'keep', operator: 'in', result: 'dots' }, f);
      svg('feComposite', { in: 'SourceGraphic', in2: 'dots', operator: 'in' }, f);
      // 膨胀成比格子小一圈的方块（4/5px 格 → 3px 方块，6/7px 格 → 5px 方块），方块之间露出缝
      svg('feMorphology', { operator: 'dilate', radius: Math.floor((n - 2) / 2) }, f);
    }
  }
  // 按元素大小挑格子：越小越细
  const pxFor = size => (size < 24 ? 'px4' : size < 60 ? 'px5' : size < 140 ? 'px6' : 'px7');

  function buildBackground() {
    pixelFilter();
    const layer = name => svg('g', { class: `layer layer--${name}` }, bg);
    const clouds = layer('clouds'), trails = layer('trails');
    const dots = layer('dots'), els = layer('els');

    CLOUDS.forEach(c => cloud(clouds, c));

    // 能量点列 → 沿路径排开的字符，一串 @#x+:. 往爆炸物方向流
    TRAILS.forEach(t => {
      const path = svg('path', { d: t.d }, trails);
      const L = path.getTotalLength(), pts = [];
      for (let d = 0; d < L; d += 22) pts.push(path.getPointAtLength(d));
      path.remove();
      const g = svg('g', { class: 'glyph', fill: t.c, 'font-size': (t.w * 2).toFixed(0) }, trails);
      pts.forEach((q, i) => {
        const node = svg('text', { x: q.x.toFixed(1), y: q.y.toFixed(1) }, g);
        trailCells.push({ node, i });
      });
    });

    // 白色墨点 → 字符，直径越大字符越重
    DOTS.forEach(([x, y, d]) => {
      const g = place(dots, x, y + SCENE_Y, 'ink');
      const node = svg('text', { class: 'glyph', fill: '#fff', 'font-size': Math.max(9, d * 1.25).toFixed(1) }, g);
      const k = Math.min(INK.length - 1, Math.floor(d / 4));
      node.textContent = INK[k];
      node.dataset.set = INK.slice(Math.max(0, k - 1), k + 2).join(''); // 只在相邻轻重的字符之间跳
      glyphs.push(node);
    });

    loadElements(els);
    pixelDeco(layer('pxdeco'));
  }

  // 像素装饰：少量、手排位置（对齐 8 的网格），只放在画面留白处，避开爆炸物和左下角百分比；
  // 放进 place()，爆炸时会和其它元素一起被冲散
  const DECO_STARS = [[312, 336, 'w', '+'], [560, 248, 'w', 'x'], [1176, 176, 'r', '+'], [1464, 456, 'w', '+'],
    [1264, 624, 'w', 'x'], [424, 784, 'r', 'x'], [1520, 760, 'w', '+'], [696, 880, 'w', '+']];
  const DECO_CLUSTERS = [[1416, 128, 'w'], [240, 560, 'w'], [1136, 720, 'r']];
  const DECO_LINES = [[1096, 256, 9], [312, 424, 7]];
  function pixelDeco(layer) {
    const sq = (g, x, y, w, fill) => svg('rect', { x, y, width: w, height: w, fill }, g);
    const col = c => (c === 'r' ? C.red : '#fff');
    // 像素星：+ 或 ×，5 个小方块，各自不规则地闪
    DECO_STARS.forEach(([x, y, c, shape], i) => {
      const g = place(layer, x, y, 'pxstar'), u = 4;
      const pts = shape === '+' ? [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]] : [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];
      pts.forEach(([a, b]) => sq(g, a * u - u / 2, b * u - u / 2, u - 1, col(c)));
      g.style.animationDelay = `${(-i * .7).toFixed(2)}s`;
      g.style.animationDuration = `${(2.2 + (i % 3) * .5).toFixed(2)}s`;
    });
    // 像素方块簇：一个大方块，右下跟着几颗小像素（和「个人经历」图标同款）
    const CLUSTER = [[24, 12], [28, 4], [32, 12], [24, 20], [32, 20]];
    DECO_CLUSTERS.forEach(([x, y, c]) => {
      const g = place(layer, x, y, 'pxcluster');
      sq(g, 0, 0, 18, col(c));
      CLUSTER.forEach(([dx, dy]) => sq(g, dx, dy, 3, col(c)));
    });
    // 短像素点线：横向、等距
    DECO_LINES.forEach(([x, y, n]) => {
      const g = place(layer, x, y, 'pxline');
      for (let j = 0; j < n; j++) sq(g, j * 8, 0, 3, '#fff');
    });
  }

  // 警示带条纹：细线、宽色块、成排的等距细线交替出现，全部贯穿带子上下边，节奏不规则（参考 Figma「03 临界」）
  function buildHazard() {
    $$('.hazard i').forEach((bar, idx) => {
      // 白底那条（第二条）的右下端压在百分比后面，留一段纯白不放条纹，让红色数字看得清
      const end = idx === 1 ? 2100 : 3200;
      let x = R(0, 200);
      while (x < end) {
        const kind = rnd();
        if (kind < .3) {               // 一排等距细线（贯穿整条带子）
          const n = Math.floor(R(6, 12)), gap = R(36, 60);
          for (let k = 0; k < n && x + k * gap < end; k++) bar.insertAdjacentHTML('beforeend', `<b class="tick" style="left:${(x + k * gap).toFixed(0)}px;width:${R(10, 14).toFixed(0)}px"></b>`);
          x += n * gap + R(40, 120);
        } else if (kind < .7) {        // 细线
          bar.insertAdjacentHTML('beforeend', `<b style="left:${x.toFixed(0)}px;width:${R(3, 14).toFixed(0)}px"></b>`);
          x += R(30, 110);
        } else {                       // 宽色块
          const w = Math.min(R(40, 380), end - x); // 不越过留白的那一段
          bar.insertAdjacentHTML('beforeend', `<b style="left:${x.toFixed(0)}px;width:${w.toFixed(0)}px"></b>`);
          x += w + R(30, 140);
        }
      }
    });
  }

  function buildStarburst() {
    const g = $('#spikes');
    for (let i = 0; i < 16; i++) {
      const len = i % 2 ? R(260, 420) : R(440, 600), w = i % 2 ? R(6, 10) : R(12, 22);
      svg('polygon', { points: `0,${-w} ${len},0 0,${w}`, fill: i % 2 ? C.pink : '#fff', transform: `rotate(${(i * 22.5 + R(-6, 6)).toFixed(1)})` }, g);
    }
    svg('circle', { r: 70, fill: '#fff' }, g);
  }

  /* ---------- 小工具 ---------- */

  const GLYPHS = '#@08XS*+=-';
  function scramble(node, text, dur = .25) {
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / (dur * 1000));
      const n = Math.floor(p * text.length);
      node.textContent = text.slice(0, n) + Array.from(text.slice(n), ch => (ch === ' ' ? ' ' : GLYPHS[Math.random() * GLYPHS.length | 0])).join('');
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  function hud(s, state) {
    scramble(pressureEl, String(Math.round(s * 100)).padStart(3, '0'));
    if (stateEl.dataset.value !== state) {
      stateEl.dataset.value = state;
      scramble(stateEl, state);
    }
  }

  function ring(s, { color = '#fff', grow = 1.9, dur = .45, width = 3 } = {}) {
    const d = document.createElement('i');
    d.className = 'shock';
    d.style.cssText = `width:${46.4 * s}vmin;height:${46.4 * s}vmin;color:${color};border-color:${color};border-width:${width}px`;
    bomb.after(d);
    // 展开时间不变；展开到位后再缓缓多扩一点、线条变细，淡出拖得比展开长，结尾不再戛然而止
    gsap.timeline({ onComplete: () => d.remove() })
      .fromTo(d, { scale: .9 }, { scale: grow, duration: dur, ease: 'power2.out' })
      .to(d, { scale: grow * 1.08, borderWidth: Math.max(1, width * .35), duration: dur * 1.4, ease: 'sine.out' })
      .fromTo(d, { opacity: 1 }, { opacity: 0, duration: dur * 1.5, ease: 'sine.inOut' }, dur * .4);
  }

  const burstEl = $('#burst');
  function particles(n, { dist = [20, 60], size = [6, 22], dur = [.8, 1.6], colors = [C.red, C.pink, C.white, C.cyan] } = {}) {
    const vmin = Math.min(innerWidth, innerHeight) / 100;
    const rand = gsap.utils.random;
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const sz = rand(size[0], size[1]), round = Math.random() < .6;
      p.style.cssText = `width:${sz}px;height:${round ? sz : sz * rand(.3, .6)}px;background:${rand(colors)};border-radius:${round ? '50%' : '1px'}`;
      burstEl.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = rand(dist[0], dist[1]) * vmin, t = rand(dur[0], dur[1]);
      gsap.fromTo(p,
        { x: 0, y: 0, xPercent: -50, yPercent: -50 },
        { x: Math.cos(a) * d * 1.25, y: Math.sin(a) * d, rotation: rand(-360, 360), scale: rand(.2, .8), duration: t, ease: 'expo.out', onComplete: () => p.remove() });
      gsap.to(p, { opacity: 0, duration: t, ease: 'power2.in' }); // 飞得快、淡得慢
    }
  }

  // 尺寸跳变时，周围元素被气压推一下再弹回
  function push(power) {
    $$('.bit-push').forEach(p => {
      const dx = p.dataset.x - CX, dy = p.dataset.y - CY, d = Math.hypot(dx, dy) || 1;
      const f = power * Math.max(0, 1 - d / 1100) * 30;
      gsap.fromTo(p, { x: 0, y: 0 }, { x: dx / d * f, y: dy / d * f, duration: .1, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: 'auto' });
    });
  }

  /* ---------- 开场炸弹像素化：球体、高光、虚线圆环、周围小点都换成像素方块；模糊光晕（.bomb__halo）保持原样 ----------
   * 颜色按原来的渐变和叠层逐格算出来（细格、真实颜色），越亮的格子方块越大；原来的平滑球体留作 35% 的底层。坐标是 SVG 的 -100~100。 */
  function pixelBomb() {
    const svgEl = $('#bomb svg'), g = svgEl && svgEl.querySelector('g[filter="url(#boil)"]');
    if (!g) return;
    const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const STOPS = [[0, hex('#FF6A8E')], [.5, hex('#FF0A3C')], [1, hex('#D60032')]];
    const colorAt = (x, y) => {
      // 底色：偏左上的径向渐变
      const t = Math.min(1, Math.hypot(x + 13.9, y + 16.2) / 83.5);
      let c = t < .5 ? mix(STOPS[0][1], STOPS[1][1], t / .5) : mix(STOPS[1][1], STOPS[2][1], (t - .5) / .5);
      if (Math.hypot(x + 18, y - 16) < 34) c = mix(c, hex('#FF4B86'), .55); // 左下的粉色圆
      if (Math.hypot(x - 22, y + 6) < 22) c = mix(c, hex('#FF0A3C'), .7);   // 右上的红色圆
      // 左上的白色高光（旋转了 -35° 的椭圆）
      const a = 35 * Math.PI / 180, dx = x + 22, dy = y + 27, ex = dx * Math.cos(a) - dy * Math.sin(a), ey = dx * Math.sin(a) + dy * Math.cos(a);
      if ((ex / 14) ** 2 + (ey / 7) ** 2 < 1) c = mix(c, [255, 255, 255], .85);
      return c;
    };
    const paths = {};
    const sq = (x, y, s, col) => { (paths[col] = paths[col] || []).push(`M${(x - s / 2).toFixed(2)} ${(y - s / 2).toFixed(2)}h${s}v${s}h-${s}z`); };
    const CELL = 4; // 明显的像素格：方块占 8 成，缝里是深一点的红
    for (let y = -58 + CELL / 2; y < 58; y += CELL) {
      for (let x = -58 + CELL / 2; x < 58; x += CELL) {
        if (Math.hypot(x, y) > 57) continue;
        const c = colorAt(x, y);
        const q = v => Math.min(255, Math.round(Math.min(255, v * 1.08 + 6) / 12) * 12);
        sq(x, y, +(CELL * .8).toFixed(2), `rgb(${q(c[0])},${q(c[1])},${q(c[2])})`);
      }
    }
    // 周围的几颗小点
    for (const [x, y, s, col] of [[68, -30, 7, '#FF0A3C'], [-62, 46, 6, '#FF4B86'], [54, 54, 5, '#FF0A3C'], [-50, -58, 5, '#FF4B86']]) sq(Math.round(x / CELL) * CELL, Math.round(y / CELL) * CELL, s, col);
    // 换掉原来的圆（保留白闪用的 #bombFlash），像素方块放在它前面
    // 原来的圆保持原色，上面压一层暗红当作格缝的颜色，再铺像素方块
    const flash = g.querySelector('#bombFlash');
    const seam = document.createElementNS(NS, 'circle');
    seam.setAttribute('r', '57.5'); seam.setAttribute('fill', 'rgba(110,0,22,.4)');
    g.insertBefore(seam, flash);
    for (const [col, list] of Object.entries(paths)) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('fill', col); p.setAttribute('d', list.join(''));
      g.insertBefore(p, flash);
    }
    // 原来的白色高光椭圆已经画进像素里了
    const hl = svgEl.querySelector(':scope > ellipse'); if (hl) hl.style.opacity = '0';
    // 虚线圆环 → 像素虚线（18 实 10 空 4 实 10 空，沿圆周每 3.4 个单位一格）
    const ring = svgEl.querySelector('.bomb__ring');
    if (ring) {
      const R0 = 84, step = 3.4, n = Math.round(Math.PI * 2 * R0 / step), d = [];
      for (let i = 0; i < n; i++) {
        const pos = (i * step) % 42;
        if (!(pos < 18 || (pos >= 28 && pos < 32))) continue;
        const a = i / n * Math.PI * 2, x = Math.cos(a) * R0, y = Math.sin(a) * R0;
        d.push(`M${(x - 1.3).toFixed(2)} ${(y - 1.3).toFixed(2)}h2.6v2.6h-2.6z`);
      }
      ring.innerHTML = `<path fill="#fff" d="${d.join('')}"/>`;
    }
  }
  pixelBomb();

  /* ---------- 像素特效层（和首页「个人经历」的像素图标同一套配色和字形） ----------
   * 蓄力：四周的像素方块被吸向爆炸物；爆炸：像素冲击环 + 方块碎片（一格一格缩小后闪灭）+ 零星的 + × 像素星。
   * 所有东西都对齐到一张像素网格上画，所以看起来是“格子”而不是平滑的圆。 */
  const pxfx = (() => {
    const cv = document.createElement('canvas');
    cv.className = 'pxfx';
    cv.setAttribute('aria-hidden', 'true');
    $('.flash').before(cv);
    const ctx = cv.getContext('2d');
    const COLS = [C.white, C.white, '#A9B4BF', '#6F7C88', C.red, C.red];
    const items = [];
    let dpr = 1, cell = 8, raf = 0, last = 0, frame = 0;

    function resize() {
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
      cell = Math.max(6, Math.round(Math.min(innerWidth, innerHeight) / 110)); // 网格大小随屏幕变
    }
    const center = () => { const r = bomb.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const vmin = () => Math.min(innerWidth, innerHeight) / 100;
    const pick = a => a[Math.floor(Math.random() * a.length)];
    // 对齐网格画一个方块（size 以格为单位，1 = 一整格，略小一点留出格缝）
    function block(x, y, size, col) {
      const g = cell, gx = Math.round(x / g) * g, gy = Math.round(y / g) * g, s = g * size * .82;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round((gx - s / 2) * dpr), Math.round((gy - s / 2) * dpr), Math.ceil(s * dpr), Math.ceil(s * dpr));
    }
    function glyph(x, y, kind, col) {
      // 像素星：+ 或 ×，各由 5 个小方块组成
      const pts = kind === '+' ? [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]] : [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]];
      for (const [a, b] of pts) block(x + a * cell * .5, y + b * cell * .5, .45, col);
    }

    function tick(t) {
      raf = 0;
      const dt = Math.min(.05, (t - last) / 1000); last = t; frame++;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.age += dt;
        if (it.age < 0) continue;
        if (it.age > it.life) { items.splice(i, 1); continue; }
        const k = it.age / it.life;
        if (it.type === 'in') {
          // 被吸进去：越靠近越快，最后几格时开始闪
          const e = k * k * k, x = it.x0 + (it.cx - it.x0) * e, y = it.y0 + (it.cy - it.y0) * e;
          if (k < .85 || frame % 2) block(x, y, it.size, it.col);
          if (k > .3) block(it.x0 + (it.cx - it.x0) * e * .9, it.y0 + (it.cy - it.y0) * e * .9, it.size * .5, it.col); // 一格拖尾
        } else if (it.type === 'out') {
          // 碎片：飞出去减速；后半段一级一级缩小（整格 → 2/3 → 1/3），最后闪几下没了
          it.vx *= Math.pow(.06, dt); it.vy *= Math.pow(.06, dt);
          it.x += it.vx * dt; it.y += it.vy * dt + 30 * k * dt;
          const size = k < .45 ? it.size : k < .7 ? it.size * .66 : it.size * .34;
          if (k > .82 && (frame + it.seed) % 3 === 0) continue;
          block(it.x, it.y, size, it.col);
        } else if (it.type === 'ring') {
          // 像素冲击环：沿着圆一格一格点出来；越往外越稀，像老屏幕掉帧
          const r = it.r0 + (it.r1 - it.r0) * (1 - Math.pow(1 - k, 3));
          const step = cell / Math.max(1, r), keep = 1 - k * .85;
          for (let a = 0, n = 0; a < Math.PI * 2; a += step, n++) {
            const h = Math.abs(Math.sin(n * 12.9898 + frame * .37 + it.seed) * 43758.5453) % 1; // 每格每帧不同的伪随机，用来稀疏和闪烁
            if (h > keep) continue;
            for (let w = 0; w < it.th; w++) block(it.cx + Math.cos(a) * (r + w * cell), it.cy + Math.sin(a) * (r + w * cell), 1, it.col);
          }
        } else if (it.type === 'star') {
          // 像素星：闪两三下
          if (Math.floor(it.age / .09) % 2 === 0) glyph(it.x, it.y, it.kind, it.col);
        }
      }
      if (items.length) raf = requestAnimationFrame(tick);
    }
    function run() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

    addEventListener('resize', resize);
    resize();
    return {
      // 蓄力：n 个像素方块从四周被吸向中心
      implode(n, dur = .65) {
        if (reduce) return;
        const [cx, cy] = center(), v = vmin();
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, r = (32 + Math.random() * 30) * v;
          items.push({ type: 'in', x0: cx + Math.cos(a) * r * 1.3, y0: cy + Math.sin(a) * r, cx, cy, size: Math.random() < .3 ? .6 : 1, col: pick(COLS), age: -Math.random() * dur * .5, life: dur * (.5 + Math.random() * .5) });
        }
        run();
      },
      // 冲击环：r 是起始半径（vmin），grow 是放大到几倍，th 是几格粗
      ring({ r = 20, grow = 3, dur = .5, th = 2, col = C.white, delay = 0 } = {}) {
        if (reduce) return;
        const [cx, cy] = center(), v = vmin();
        items.push({ type: 'ring', cx, cy, r0: r * v, r1: r * v * grow, th, col, life: dur, age: -delay, seed: Math.random() * 100 });
        run();
      },
      // 爆炸碎片
      burst(n) {
        if (reduce) return;
        const [cx, cy] = center(), v = vmin();
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = (60 + Math.random() * 260) * v;
          items.push({ type: 'out', x: cx + Math.cos(a) * 8 * v, y: cy + Math.sin(a) * 8 * v, vx: Math.cos(a) * sp * 1.25, vy: Math.sin(a) * sp, size: Math.random() < .35 ? 1.6 : Math.random() < .5 ? 1 : .6, col: pick(COLS), age: -Math.random() * .06, life: .55 + Math.random() * .8, seed: i });
        }
        run();
      },
      // 零星的 + × 像素星
      stars(n, delay = 0) {
        if (reduce) return;
        const [cx, cy] = center(), v = vmin();
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, r = (25 + Math.random() * 45) * v;
          items.push({ type: 'star', x: cx + Math.cos(a) * r * 1.4, y: cy + Math.sin(a) * r, kind: Math.random() < .5 ? '+' : 'x', col: Math.random() < .25 ? C.red : C.white, age: -delay - Math.random() * .35, life: .32 + Math.random() * .25 });
        }
        run();
      },
      clear() { items.length = 0; ctx.clearRect(0, 0, cv.width, cv.height); },
    };
  })();

  /* ---------- 每帧：爆炸物尺寸、抖动、沸腾、画面震动 ---------- */

  const noiseEl = $('#boilNoise'), mapEl = $('#boilMap');
  let boilClock = 0, boilSeed = 1, flowClock = 0, flowStep = 0, flickerClock = 0;
  gsap.ticker.add((time, dt) => {
    // 能量点列：字符序列往前挪一格；速度跟 --flow 走（越接近爆炸越快）
    flowClock += dt;
    if (flowClock >= (parseFloat(stage.style.getPropertyValue('--flow')) || 1.1) * 500) {
      flowClock = 0;
      flowStep++;
      for (const c of trailCells) c.node.textContent = FLOW[((c.i - flowStep) % FLOW.length + FLOW.length) % FLOW.length];
    }
    // 字符随机跳字，像 Gradient ASCII 那样“活着”
    flickerClock += dt;
    if (!reduce && flickerClock > 110) {
      flickerClock = 0;
      for (let n = 0; n < glyphs.length * .1; n++) {
        const node = glyphs[Math.random() * glyphs.length | 0], set = node.dataset.set;
        node.textContent = set[Math.random() * set.length | 0];
      }
    }
    if (phase === 'load') followProgress(dt);
    bomb.style.transform = `scale(${st.s})`;
    stage.style.setProperty('--bs', st.s.toFixed(4));
    const a = reduce ? 0 : Math.max(st.base, st.shake);
    const k = a * 18 / Math.max(st.s, .35);
    shakeEl.style.transform = a
      ? `translate(${((Math.random() - .5) * k).toFixed(2)}px, ${((Math.random() - .5) * k).toFixed(2)}px) rotate(${((Math.random() - .5) * a * 5).toFixed(2)}deg)`
      : '';
    const c = reduce ? 0 : cam.shake * 26;
    stage.style.transform = c || cam.punch
      ? `translate(${((Math.random() - .5) * c).toFixed(1)}px, ${((Math.random() - .5) * c).toFixed(1)}px) scale(${(1 + cam.punch).toFixed(4)})`
      : '';
    boilClock += dt;
    if (!reduce && boilClock > 85) {
      boilClock = 0;
      boilSeed = boilSeed % 9 + 1;
      noiseEl.setAttribute('seed', boilSeed);
    }
    mapEl.setAttribute('scale', (boil.scale * .45).toFixed(1)); // 像素化之后扭曲减弱，格子不被扭糊
  });

  /* ---------- 时间线 ---------- */

  /* 入场：掠过式转场。整幅场景先在下面摆好（爆炸物 10%、HUD、百分比都在位），上面盖着一整片天蓝；
   * 一条比屏幕对角线还宽的红带从左下斜着扫到右上：前沿推走天蓝，中间有一拍整屏都是红色，后沿露出场景。
   * 斜边用 k 描述：屏幕上满足 x + (100 - y) = k 的那条斜线（百分比），k 从 0 到 200 正好扫过整屏。 */
  const BAND = 320; // 红带宽度，大于 200 才能在某一刻铺满整屏
  const band = (a, b) => `polygon(0% ${100 - b}%, ${b}% 100%, ${a}% 100%, 0% ${100 - a}%)`;
  function intro() {
    gsap.set([bg, '.label', '.hud'], { opacity: 1 }); // 背景图自带噪点，不再叠 loading 的颗粒层
    st.appear = 1;
    const cover = $('.sweep__cover'), red = $('.sweep__band'), [line1, line2] = $$('.sweep__line');
    const sw = { k: 0 };
    const draw = () => {
      const k = sw.k;
      cover.style.clipPath = k < 200 ? band(k, 400) : 'polygon(0 0, 0 0, 0 0)';
      red.style.clipPath = band(k - BAND, k);
      line1.style.clipPath = band(k - 30, k - 22); // 前沿后面一道天蓝细线
      line2.style.clipPath = band(k - BAND + 12, k - BAND + 26); // 后沿前面一道粗一点的
    };
    draw();
    gsap.timeline({ delay: .1, onComplete: () => gsap.set('.sweep', { display: 'none' }) })
      .to(sw, { k: 215, duration: .32, ease: 'power3.in', onUpdate: draw })   // 加速扫进，红色铺满
      .to(sw, { k: 300, duration: .16, ease: 'none', onUpdate: draw })         // 整屏红色停一拍
      .add(() => { ambient(); startLoad(); })
      .to(sw, { k: 200 + BAND + 40, duration: .34, ease: 'power3.out', onUpdate: draw }); // 甩出去，露出场景
  }

  // 背景没有静止的元素：每个都各自往左或往右飘（方向随机、速度不同），再加上下浮动；
  // 一部分会闪烁，字符还会跳字（在 ticker 里）
  const dir = () => (rnd() < .5 ? -1 : 1);
  function ambient() {
    if (reduce) return;
    $$('.el, .ink').forEach(b => {
      gsap.to(b, { x: `+=${(dir() * R(60, 180)).toFixed(1)}`, duration: R(8, 14), ease: 'none' });
      gsap.to(b, {
        y: `+=${R(-12, 12).toFixed(1)}`, rotation: R(-12, 12),
        transformOrigin: '50% 50%', duration: R(1.6, 3.5), ease: 'sine.inOut', yoyo: true, repeat: -1,
      });
      // 约三分之一的元素闪烁：一下暗下去再亮回来，间隔各不相同
      if (rnd() < .35) {
        gsap.to(b, { opacity: R(.1, .45), duration: R(.06, .16), ease: 'steps(1)', yoyo: true, repeat: -1, repeatDelay: R(.4, 1.8), delay: R(0, 1.2) });
      }
    });
    $$('.spark').forEach(b => gsap.to(b, { scale: R(.3, .6), transformOrigin: '50% 50%', duration: R(.5, 1.2), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: R(0, 1) }));
    $$('.cloud').forEach(b => gsap.to(b, { x: `+=${(dir() * R(40, 100)).toFixed(1)}`, duration: R(10, 14), ease: 'none' }));
  }

  /* 加载阶段：尺寸实时跟随进度，不排队、不停顿。
   * 显示进度 = min(真实进度, 已过时间 / 1.2 秒)，再做一点平滑，所以慢加载跟真实速度走，快加载至少走满 1.2 秒。 */
  let phase = 'intro', loadStart = 0, shown = 0, crossed = 0;

  function startLoad() {
    phase = 'load';
    loadStart = performance.now();
    pressureEl.textContent = String(Math.round(STEPS[0].s * 100)).padStart(3, '0');
    stateEl.textContent = stateEl.dataset.value = 'STABLE';
  }

  function followProgress(dt) {
    const target = Math.min(progress, (performance.now() - loadStart) / MIN_LOAD);
    shown += (target - shown) * (1 - Math.exp(-dt / 40));
    // 到 100% 时直接到位，不再慢慢追最后一截
    if (target - shown < .001 || (target >= 1 && shown > .97)) shown = target;

    st.s = sizeAt(shown) * st.appear * (1 + st.kick);
    st.base = shown * .25;
    boil.scale = 14 + shown * 8;

    const pct = Math.floor(shown * 100);
    if (pctEl.dataset.value !== String(pct)) {
      pctEl.dataset.value = pct;
      pctEl.textContent = String(pct).padStart(3, '0');
      const n = Math.round(shown * 10);
      barEl.textContent = '■'.repeat(n) + '□'.repeat(10 - n);
      pressureEl.textContent = String(Math.round(sizeAt(shown) * 100)).padStart(3, '0');
    }

    while (crossed + 1 < STEPS.length - 1 && shown >= STEPS[crossed + 1].at) cross(++crossed);
    if (done && shown >= .999) {
      phase = 'charge';
      charge();
    }
  }

  // 越过曲线上的节点：放一下冲击，不打断尺寸变化
  function cross(i) {
    const s = STEPS[i].s, next = STEPS[i + 1].s;
    stage.style.setProperty('--flow', `${(1.1 - i * .12).toFixed(2)}s`);
    ring(s);
    if (next >= s) {
      push(s);
      particles(6, { dist: [s * 30, s * 44], size: [3, 8], dur: [.4, .7], colors: [C.red, C.pink] });
      hud(s, s >= .5 ? 'UNSTABLE' : 'STABLE');
      gsap.fromTo(st, { kick: .14 }, { kick: 0, duration: .3, ease: 'elastic.out(1, .45)', overwrite: 'auto' });
      gsap.to(st, { shake: .35, duration: .06, yoyo: true, repeat: 1 });
    } else {
      // 接下来要回缩：压扁、闪白、剧烈抖动，像在憋着
      hud(s, 'COMPRESS');
      gsap.timeline()
        .to(squashEl, { scaleX: 1.14, scaleY: .86, duration: .07, ease: 'power3.in' })
        .to(squashEl, { scaleX: 1, scaleY: 1, duration: .3, ease: 'elastic.out(1, .3)' });
      gsap.fromTo('#bombFlash', { opacity: .85 }, { opacity: 0, duration: .18, delay: .05 });
      gsap.to(st, { shake: .7, duration: .05, yoyo: true, repeat: 3 });
    }
  }

  function charge() {
    const T = 1;
    hud(1.3, 'CRITICAL');
    stateEl.parentElement.classList.add('is-critical');
    stage.style.setProperty('--pulse', '.22s');
    stage.style.setProperty('--flow', '.25s');
    const [h1, h2] = $$('.hazard i');
    gsap.set(h1, { rotation: -28 });
    gsap.set(h2, { rotation: 28 });

    const tl = gsap.timeline({ onComplete: explode });
    pxfx.implode(90, .7);
    tl.to(st, { s: 1.3, duration: T, ease: 'power2.in' }, 0)
      .to(st, { shake: 1, duration: T, ease: 'power2.in' }, 0)
      .to(boil, { scale: 34, duration: T, ease: 'power2.in' }, 0)
      .to('.hazard', { opacity: 1, duration: .08 }, .06)
      // 警示带细细地冲进来，然后一胀一缩、整体越来越粗；两条错开节奏
      .fromTo(h1, { x: '-110vw', y: '58vw', scaleY: .25 }, { x: 0, y: 0, scaleY: .7, duration: .3, ease: 'power4.out' }, .06)
      .fromTo(h2, { x: '110vw', y: '58vw', scaleY: .2 }, { x: 0, y: 0, scaleY: .55, duration: .3, ease: 'power4.out' }, .14)
      .to(h1, { keyframes: [
        { scaleY: 1.2, duration: .09, ease: 'power3.out' }, { scaleY: .8, duration: .1 },
        { scaleY: 1.45, duration: .08, ease: 'power3.out' }, { scaleY: 1.05, duration: .09 },
        { scaleY: 1.8, duration: .07, ease: 'power3.out' },
      ] }, .38)
      .to(h2, { keyframes: [
        { scaleY: .5, duration: .08 }, { scaleY: 1.3, duration: .09, ease: 'power3.out' },
        { scaleY: .85, duration: .1 }, { scaleY: 1.6, duration: .08, ease: 'power3.out' },
        { scaleY: 1.2, duration: .08 },
      ] }, .46)
      // 周围的元素被吸向中心
      .to('.bit-push', { x: (i, el) => (CX - el.dataset.x) * .06, y: (i, el) => (CY - el.dataset.y) * .06, duration: T, ease: 'power2.in', overwrite: 'auto' }, 0);
    // 一圈一圈越来越密的波纹，红白交替
    [.12, .3, .46, .6, .71, .8, .87, .92, .96].forEach((t, i) => tl.add(() => {
      ring(st.s, { color: i % 2 ? C.white : C.red, grow: 1.7, dur: .28, width: 6 });
      if (i % 2 === 0) pxfx.ring({ r: 23.2 * st.s, grow: 1.6, dur: .3, th: 1, col: i % 4 ? C.white : C.red });
    }, t));
    tl.timeScale(1.5); // 整段蓄力加速：1 秒 → 约 0.67 秒
  }

  // 爆炸是重点：镜头冲击 + 画面震动 + 双冲击环 + 大量粒子，ASCII 转场稍后才盖上来
  function explode() {
    st.shake = 0;
    st.base = 0;
    // 白闪只闪一下，不把爆炸本身洗白
    gsap.timeline()
      .to('.flash', { opacity: .6, duration: .02 })
      .to('.flash', { opacity: 0, duration: .15, ease: 'power2.out' });
    gsap.fromTo(cam, { shake: 1, punch: .07 }, { shake: 0, punch: 0, duration: .3, ease: 'power3.out' });
    gsap.to(st, { s: 2.8, duration: .13, ease: 'power3.out' });
    gsap.to(bomb, { opacity: 0, duration: .08 });
    gsap.to(['.hud', '.label'], { opacity: 0, duration: .08 });
    // 警示带被冲击波撑爆：瞬间变得很粗，然后消失
    gsap.to('.hazard i', { scaleY: '*=2.4', duration: .14, ease: 'power3.out', overwrite: 'auto' });
    gsap.to('.hazard', { opacity: 0, duration: .1, delay: .08 });
    gsap.fromTo('.starburst', { scale: .25, rotation: -12 }, { scale: 1.6, rotation: 10, duration: .26, ease: 'expo.out' });
    gsap.fromTo('.starburst', { opacity: 1 }, { opacity: 0, duration: .26, ease: 'power2.in' });
    // 一圈一圈接连绽放的冲击波纹：越往后越大、越细
    const RINGS = [[C.white, 14, 3.4], [C.red, 12, 3], [C.pink, 10, 2.7], [C.white, 8, 2.4], [C.cyan, 7, 2.1], [C.red, 5, 1.9]];
    RINGS.forEach(([color, width, grow], i) => gsap.delayedCall(i * .03, () => ring(1.2 - i * .08, { color, grow, dur: .3, width })));
    particles(40, { dist: [25, 95], size: [5, 22], dur: [.3, .55] });
    pxfx.burst(170);
    pxfx.ring({ r: 26, grow: 3.4, dur: .55, th: 3, col: C.white });
    pxfx.ring({ r: 22, grow: 2.6, dur: .6, th: 2, col: C.red, delay: .05 });
    pxfx.ring({ r: 18, grow: 4.2, dur: .8, th: 1, col: C.white, delay: .12 });
    pxfx.stars(28, .18);

    gsap.killTweensOf('.bit');
    gsap.to('.bit-push', {
      x: (i, el) => (el.dataset.x - CX) * R(.6, 1.6), y: (i, el) => (el.dataset.y - CY) * R(.6, 1.6),
      rotation: () => R(-120, 120), opacity: 0, duration: .32, ease: 'expo.out', overwrite: true,
    });
    gsap.to('.layer--trails', { opacity: 0, duration: .1 });
    // 爆炸散完后 loading 的内容淡掉，天空背景不动，首页直接在天空上淡入——不白闪、不跳画面
    gsap.delayedCall(.35, clearLoading);
    gsap.delayedCall(.45, home);
  }

  // 收起 loading 场景里剩下的东西（背景图案、颗粒、HUD 等），天空底色 .wipe--sky 保留
  function clearLoading() {
    gsap.to([bg, '.bomb', '.hazard', '.hud', '.label', '.burst', '.starburst', '.grain', '.layer--trails'], {
      autoAlpha: 0, duration: .3, ease: 'power2.out', overwrite: 'auto',
    });
    $$('.shock').forEach(s => gsap.to(s, { opacity: 0, duration: .3, onComplete: () => s.remove() }));
  }

  function home() {
    gsap.set('.wipe--red', { autoAlpha: 0 });
    gsap.set('.hero', { autoAlpha: 1 }); // 内页后面的天空，和 loading 的天空是同一张图，切过去看不出来
    const site = document.getElementById('site');
    if (!window.Site || !site) return;
    // 打开网站本体（首页的爆炸球、雨幕等由 site.js 管），整体从透明淡入，盖住下面的天空
    // will-change 保留到最后：淡入结束时不撤掉图层，避免画面重绘闪一下
    gsap.set(site, { opacity: 0, willChange: 'opacity' });
    Site.enter();
    gsap.to(site, { opacity: 1, duration: .5, ease: 'power2.inOut' });
  }

  /* ---------- 进度驱动 ---------- */

  let progress = 0, done = false;

  const api = {
    setProgress(v) {
      progress = Math.max(progress, Math.min(1, +v || 0));
    },
    finish() {
      done = true;
      // 资源加载完了，趁空闲先让首页排版、解码图片，爆炸后直接淡入
      const prep = () => window.Site && Site.prepare();
      if (window.requestIdleCallback) requestIdleCallback(prep, { timeout: 800 }); else setTimeout(prep, 0);
      api.setProgress(1);
    },
  };
  window.LoadingPop = api;

  /* ---------- 启动 ---------- */

  gsap.set(bg, { opacity: 0 });
  buildStarburst();
  buildHazard();
  // 背景哪里出错也照样进入画面，不会卡在白屏
  try { buildBackground(); } catch (err) { console.error('背景构建失败', err); }
  intro();

  const params = new URLSearchParams(location.search);
  // 仅调试用：?manual 不自动加载（在控制台用 LoadingPop.setProgress / finish 驱动），?fast 模拟秒加载
  if (params.has('manual')) {
    // 不自动推进
  } else if (params.has('fast')) {
    // 模拟缓存命中：不到 1 秒就加载完，用来检查“至少 2 秒”
    setTimeout(() => api.finish(), 600);
  } else {
    // 真实加载：进度先按时间走到 90%，页面资源加载完（load 事件）再走到 100%；
    // 最多等 6 秒，个别资源卡住也不会一直停在 90%
    api.setProgress(.9);
    if (document.readyState === 'complete') api.finish();
    else {
      addEventListener('load', () => api.finish(), { once: true });
      setTimeout(() => api.finish(), 6000);
    }
  }
})();
