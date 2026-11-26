/* 「2 个人经历」左栏的四个马赛克图标：用代码一颗颗画出来，才能让每个像素单独动。
 * - 入场拼装：图标滑进屏幕时，像素从下方和两侧散落飞来、各自错开一点时间，落位拼成图标（每个图标只拼一次）
 * - 分层视差：深灰、浅灰、白、红四层像素跟着鼠标错开不同距离，越“靠前”（红、白）移动越多，图标显得有厚度
 * - 白色流光：悬停时一条稍粗的白线从下往上流过图标（游戏策划沿着地图上的路线流）
 * - 悬停小动画：每个图标讲一个小故事
 *     游戏策划：路线从起点一颗颗点亮到红色 ×，× 跳两下，小旗飘动
 *     游戏开发：十字键朝鼠标方向那一支亮起，两颗红键依次被按下
 *     交互设计：红色光标移到按钮上点一下，按钮闪白、涟漪散开
 *     小工具开发：齿轮转过一个齿，扳手拧一下，火花跳动
 * 像素数据从 Figma 图标还原（每格 6px：颜色 + 形状），坐标是设计稿像素。
 * 用法：ExpIcons.mount({ canvas, scroller })。画布对应整页设计稿的 (40, 3930) 起、680 × 1870 的区域。 */
(() => {
  'use strict';

  const ORIGIN = { x: 40, y: 3930 }, W = 680, H = 1870;
  const COLORS = { d: '#6F7C88', l: '#A9B4BF', w: '#FFFFFF', r: '#FF0A3C' };
  // 四个图标：网格左上角（整页设计稿坐标）、字母对照表（颜色 + 形状）、每行的字母
  const ICONS = {
    planning: { origin: [240.5, 4006.2],
      table: { a: 'ls2.4', b: 'wp', c: 'ws5.2', d: 'rs5.2', e: 'dx', f: 'rs3.6', g: 'ws3.8', h: 'rp', i: 'ls5.2', j: 'ds5.2', k: 'ls4.2', l: 'ds4.6', m: 'dv', n: 'ds3.2' },
      rows: '.............a........a...............a..........|b................................................|.................................................|.......b..............................a..........|.................................................|.................................................|....................................cdd..........|.........eb.........................cddddf.......|...........................b........cddddddf.....|.................g.........h........cdddf........|..............ggicggg...............cdf..ggg.....|...........ggiiiigiiiggg............cgggjklg.....|.......gggiiiiiiigiiiiiiigg.......ggcjljmllg.....|.....ggiiiiiiiiiigiiiiiiiijkgg.gggjkcllklllg.b...|....giiiiiiiiiiiigiiiiiiijijkjgjkjkjcjklkjlg.....|....giiiiiiiiiiiigiiiijiiijkikgkjkjkcklmjlmg.....|....giiiiiiiiiiiigiiiiijiikjkjgjkjljcjlllllg.....|....giiiiiiiiiiiigiiiiiijiikjkgklljlcllllllg.....|....giiiiiiiiiiiigiiijgckcgjkjgjklkmclmllmlg.....|....giiiiiiiiiiiigiiigccgcccjkcklljlcllllllg.....|....giiiiiiiiiiiigiiigcgkjgckccjllklclllllng.....|....giiiiiiiiiiiigigcijijkjkjccglkjllmllnlng.e...|....giiiiiiiiiiiigigcckjkjkjkjcgkllllllllllg.....|....giiiiiiiiiiiigjiccjkjkjklkgkdfllfdlllllg.....|....giiiiiiiiiiikgijggkjkjkjllgcddffddlmllng.e...|....giiiiiiiiijiigjkicckjkjklkggcddddlllnlng.....|..b.giiiiiiiiikikgkjkccjkjllljglcfddfllnnlng.....|....giiiiiiiiiikjgjkjccgjkmklkglfddddfmlnnng.....|....giiiiiiiiiiikgkggggjkjkjllglddllddlnnnng..h..|....giiiiiikikjijggcckjkjklkllgllnnlnnlnnnng.....|....giiiiikikjkjkgccglmjlmkjklgmllmlnmnnnnng.....|....giiiiiiiikicccjkjkjkjkjlllglllllllnnnnng.....|....giiiijijcjgccckjkjllkjllllglllllnnnnnnng.....|....giiiikiccgjgjgjkjmlkmllmllgllnnlmnnnnnng.....|....giiikjiccjkjkgljllklklllllglnlllnnnnnnng.....|..b.gijijkigjkjkjglklkllllllllglllnnnnnnnnng.....|....giiigccgkjkjkgklklkmllmlnmgnnnnnnnnnnnng.....|....gkigccccjkjkjgjljlllllllllglnnnnnnnnnnng.....|....gikcccccgjkllgkjljllllllnlgnnnnnnnnnnnng...a.|....gijcccccjkjkmglmllmllmnlmlgmnnnnnnnnnnng.....|....gikjcccgkjkjlgllllllllnllngnnnnnnnnnnnng.....|....gijkjgjkjllgggglllllnllllngnnnnnnnnnnngg.....|....gjijkjkjggg.....ggnlmllnllgnnnnnnnnggg.......|....gkjkjggg...........ggllnlngnnnnnggg..........|....gjgg..................ggnngnnggg.............|.............................ggg.................|................................................e|...........................a..................a..|.................................................|......................................a....a.....' },
    dev: { origin: [240.2, 4447.2],
      table: { a: 'ls2.4', b: 'wp', c: 'rp', d: 'dx', e: 'ws3.8', f: 'ls5.2', g: 'ds5.2', h: 'ls4.2', i: 'ws5.2', j: 'ds4.6', k: 'rs5.2', l: 'dv', m: 'rs3.6', n: 'ds3.2' },
      rows: '........................a........................|.a...............................................|.................................................|.................................................|.....................b...........................|.................................a...............|.................b......................c........|.d..................................a............|......................d..........................|.................................................|.................................................|.......................b...b.....................|....c........d...................................|.................................................|...b.............................................|..........eeeffffffffffgfffghfhghghgheeee........|........iefffffffffffffhghghghghghghghjjei.......|.......ifffffffffffffffgfghghghghgjjhjhjjji......|......iffffffffffffffffhghgfghghghkkkjjljjli.....|.....effffffffffffffhghgkkhghghgjkkkkmjjjjjje....|.....efffffeeeeffffffhfhkkghghgjgkkkkmjjjjnje....|.....efffffiiiiffffgfghghghghghglmkkkjljjljjl....|....effffffiiiifffffffghfhghgheejjjjjjjeejjnne...|....effffffiiiiefffgfghghghghiiiegjjjjiiiinjje...|....efffiiiiiiiiiieffhghghgheiiiijljjliiiienne...|....efffiiiiiiiiiiefhiiihgiiiiiiijjjjjiiiinnje...|.....fffiiiiiiiiiiehgiiighiiiiiijjjjjneiiennne...|....efffiiiiiiiiiifghghghghgjghjjlkkmjnnnjnnne...|....effffffiiiihffghghghghghgjjjjkkkkmjjnnnnne...|....effffffiiiigfghghghghgjjhjjjjkkkkmjnnnnnne...|....effffffiiiihghghghghghgjjljjlmkkknnnnnnnne...|a...ffffffffffffhghghghghjhjjjjjjnmmjnjnnnnnnn...|....ffffffghffghghghghghjjjjjjjjnjjjjjnnnnnnnn...|....effffffghghfhghghe.......ejljjnjjnjnnnnnnn...|....effffhfffhfhghgje........ejjjjnnnnnnnnnnne...|....effffghffghghghge........ejjjnnnjnnnnnnnne...|....ehfffhghghghghlhe........eljnljnnnnnnnnnne...|....egfffghfhghghghje........ennnnjnnnnnnnnnne...|.....efhghghghghghge..........ejjnnnnnnnnnnne....|.....ehghghghghgjghe..........ejnnnnnnnnnnnne....|......ihfhghghgjghi............innnnnnnnnnni.....|.......ehghghghgje..............ennnnnnnnne......|........ihghglghe................innnnnnne.......|.........eeeheee..................eeeneee........|.................................................|.................................................|..........................................a.....d|.....................a.....................d.....|......................d..........................|a...........................................d....' },
    ux: { origin: [234.5, 4931.5],
      table: { a: 'wp', b: 'ls2.4', c: 'ws3.8', d: 'ws5.2', e: 'rp', f: 'rs5.2', g: 'ls5.2', h: 'rs3.6', i: 'ls4.2', j: 'ds5.2', k: 'ds4.6', l: 'dv', m: 'dx', n: 'ds3.2' },
      rows: 'a..............................b..................|..................................................|...............................a....a............b|...................b.....b........................|......b.........................b.................|..................................................|..................................................|......cddddddddddddddddddddddddddddddddc..........|.e...dddddddddddddddddddddddddddddddddddd.........|....cdddfddccdcgdddddddddddddddddddddddddd........|....ddddfhdggdcgdddddddddddddddddddddddddd........|....dddddddddddddddddddddddddddddddddddddd........|....cddddddddddddddddddddddddddddddddddddc.......b|....cgggggggggggggggggggggggigijijijijijkc........|....cggggggggggggggggggggigijijijijijikkjc........|....cgggggggggggggggggggggijgjijijijijkklc........|....cgggcdddddddddddgggcccccccccccccccckkc........|....cgggcggggggggggdggiddddddddddddddddkkc........|m...cgggcggggggggggdggjggigijijijikklkklkc......b.|....cgggcggggggggggdgjijigijijijijkjkkkkkc........|....cgggcggggggggggdjgjddddddddddddkkkkkkc........|....cgggcgggddggggddgjgjgjicdcijljclkklkkc........|....cgggcggcggdggdgdjgjijiccjikkjkkkkkkknc........|....cgggcgccgggddggdigiddddddddddddddckkkc........|....cgggcccgggggjggdjijccdccdcccccccclkklc........|....cgggcdgggggggjidigijcjijcjkkkkkkkkkkkc........|.m..cgggcdddddddddddjijicijcjkkkjkkkkkkkkc...b....|....cggggggggggggjgjijijijkciklkklkklkklkc........|....cggggggggggijijijijijijijijkkkkkkknnnc........|....cggggggggjijijijijijikkkijkkdkkkknnnkc......b.|....cgggghhhhhhhhhhhhhhijkjiklkkddcnkknnnc........|....cggghffffffffffffffjikikikkkdhdcnnknnc........|....cggghffffffffffffffikkjkkkkkdfhdcknnnc........|....cggghffffffffffffffjklkklkkldffhdcknnc........|....cgggghhhhhhhhhhhhhhkjkkkkkkkdffffddnnc........|....cgggggggijijijijkkkkkkkkkkkndfffffddnc........|....cggigigijijijijijikklkklkklkdffffffddc........|.....ccgggijijijijijkjkkkkkkkkncdfffffffdd........|...............................cdffffhddddd.......|................................dffdhhdddddc......|................................dfdddfdc..........|....................m...........dddcdhhd..........|..............a...........b.....dd..cdfdc.........|................................d....dhhd.........|...........................m.........cdhd.........|......................................dddd........|......m...............................ddc.........|..................................................|.............................................e....' },
    tools: { origin: [240.5, 5388.2],
      table: { a: 'ls2.4', b: 'dx', c: 'rs3.6', d: 'ws3.8', e: 'rs5.2', f: 'ls5.2', g: 'ds5.2', h: 'ls4.2', i: 'ds2.2', j: 'ws5.2', k: 'ds4.6', l: 'dv', m: 'wp', n: 'rp' },
      rows: '................................a................|....................................a............|.................................................|................................b................|.....................................c...........|.................dd.....dd..........eec..........|..............ddffd....dfffd..a.....cc...........|..............dffffdddddffffd...........cc.......|..............dffffffffffffd............cc.......|.............ddffffffffffffgd.........ceeeec.....|.........dd.dffffffffffffffhfdd.dd......cc.......|........dffdfffffffffffffffffgfdhgd.....cc.......|.......dffffffffffffffffffffgfghghd..............|.......dffffffffffffffffffhfhfhghghd.............|...a....dfffffffffffffffffghghghghd.........cc...|........dfffffffffffffffhgfghghghg.........ceec..|........dfffffffffffdddffhfhfhghghd.........cc..a|........ffffffffffd....dighghghghgd..............|.......dfffffffffd.....dddd.ihghghg..............|.....ddffffffffff......jjjjjd.hghghddd....a......|.....dffffffffffd.......jjjjjj.kkhkhgd...........|.....dffffffffffd........jjjjjjilgklhd...........|.....dffffffffffd.........jjjjj.gkkkkd...........|.....dddfffffffffddj.....djjjjjdhgkdd............|.......dfffffffffidjj...djjjjjjdghl......a.......|........ffffffffffdjjj.djjjjjjjjkkd.....m.m......|........dfffffghfhdjjjjjjjjjjjjdkkd..............|........dffffffghg.jjjjjjjjjjjj.kd...............|.......dffffffghfhidjjjjjjjjjjjj.kdd.............|.......dffffffhfhfh.jjjjjjjjjjjjj.kd.............|........fffffhfhghgh.jjjjjjjjjjjjj...............|........dfddfgffhghghi.ddjd.jjjjjjj..............|.........d..ddfhghghkhkkghkk.jjjjjjj.............|..............dghghghghgklkkd.jjjjjjj............|..............dhghghghgkkkkk...jjjjjjj...........|..............dghkkdddddhgkkd...jjjjjjj..........|...............ddhd.....lkdd.....jjjjjjj.........|........................d.........jjjjjjj........|............a......................jjjjjjj.......|....................................jjjjjjj......|n.....................b..............jjjjjjj.....|...............................a......jjjjjjjd...|.......................................jjjjdjj...|........................................jjdecjd..|..................................a......jjcdjd..|.....b...................................djjjj...|.............a.............................dd....|......ab...............n.........................|.......a...................a.....................' },
  };

  const ease = {
    outBack: t => { const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    inOut: t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: t => 1 - Math.pow(1 - t, 3),
  };
  const clamp01 = t => Math.max(0, Math.min(1, t));
  // 一个尖峰：在 at 附近 0→1→0，宽度 w
  const bump = (t, at, w) => Math.max(0, 1 - Math.abs(t - at) / w);

  function mount({ canvas, scroller }) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    const icons = [];

    // ---------- 把字母网格还原成像素 ----------
    for (const [name, def] of Object.entries(ICONS)) {
      const px = [], grid = new Map();
      def.rows.split('|').forEach((row, cy) => [...row].forEach((ch, cx) => {
        if (ch === '.') return;
        const code = def.table[ch], col = code[0], kind = code.slice(1);
        const p = {
          col, kind, size: kind[0] === 's' ? +kind.slice(1) : 0, cx, cy,
          hx: def.origin[0] - ORIGIN.x + cx * 6 + 3, hy: def.origin[1] - ORIGIN.y + cy * 6 + 3, // 格子中心（画布坐标）
          sx: 0, sy: 0, delay: 0, dur: 1, // 入场：从哪里飞来
          deco: kind === 'x' || kind === 'p' || kind === 's2.4' || kind === 's2.2', // 四周的零星点缀
        };
        px.push(p); grid.set(cx + ',' + cy, p);
      }));
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of px) if (!p.deco) { x0 = Math.min(x0, p.hx); y0 = Math.min(y0, p.hy); x1 = Math.max(x1, p.hx); y1 = Math.max(y1, p.hy); }
      const ic = { name, px, grid, box: { x0, y0, x1, y1 }, entered: reduce, enterT: 0, anim: null, animEnd: -9, hover: false, groups: {}, par: { x: 0, y: 0, tx: 0, ty: 0 } };
      for (const p of px) {
        // 入场起点：大多从下方飞上来，也有一些从左右两侧；底部的像素先到
        const side = Math.random();
        p.sx = side < .7 ? (Math.random() - .5) * 260 : (side < .85 ? -1 : 1) * (140 + Math.random() * 160);
        p.sy = side < .7 ? 160 + Math.random() * 300 : (Math.random() - .3) * 220;
        p.delay = Math.random() * .35 + (1 - (p.hy - y0) / Math.max(1, y1 - y0)) * .35;
        p.dur = .65 + Math.random() * .45;
      }
      classify(ic);
      if (name !== 'planning') {
        for (const q of px) if (!q.deco) q.order = (y1 - q.hy) / Math.max(1, y1 - y0) * .85 + (q.hx - x0) / Math.max(1, x1 - x0) * .15;
      }
      // 会移动的部件（交互设计的光标、小工具的扳手）挪到最后画，动起来时压在其它像素上面
      const top = new Set(ic.groups.cursor || ic.groups.wrench || []);
      if (top.size) ic.px = [...px.filter(q => !top.has(q)), ...px.filter(q => top.has(q))];
      icons.push(ic);
    }

    // ---------- 每个图标里各部分是哪些像素（给悬停小动画用） ----------
    function classify(ic) {
      const { px, grid, box } = ic, g = ic.groups;
      const filled = (cx, cy) => { const q = grid.get(cx + ',' + cy); return q && !q.deco; };
      const inner = p => filled(p.cx - 1, p.cy) && filled(p.cx + 1, p.cy) && filled(p.cx, p.cy - 1) && filled(p.cx, p.cy + 1);
      const midY = (box.y0 + box.y1) / 2, midX = (box.x0 + box.x1) / 2;
      if (ic.name === 'planning') {
        // 路线：地图里面的白点（不在轮廓上），按从左下起点到右上终点的方向排序
        g.route = px.filter(p => p.col === 'w' && !p.deco && inner(p)).sort((a, b) => (a.hx * .88 - a.hy * .48) - (b.hx * .88 - b.hy * .48));
        g.route.forEach((p, i) => { p.order = i / Math.max(1, g.route.length - 1); });
        const reds = px.filter(p => p.col === 'r' && !p.deco);
        g.flag = reds.filter(p => p.hy < box.y0 + (box.y1 - box.y0) * .25);
        g.cross = reds.filter(p => !g.flag.includes(p));
      } else if (ic.name === 'dev') {
        // 十字键：左半边机身里的白色实心块；两颗红键按上下分开
        g.pad = px.filter(p => p.col === 'w' && p.size === 5.2 && p.hx < midX);
        g.padC = centroid(g.pad);
        const reds = px.filter(p => p.col === 'r' && !p.deco && p.hx > midX - 10);
        const ry = centroid(reds).y;
        g.btnA = reds.filter(p => p.hy < ry); g.btnB = reds.filter(p => p.hy >= ry);
        g.btnAC = centroid(g.btnA); g.btnBC = centroid(g.btnB);
      } else if (ic.name === 'ux') {
        // 光标：右下角伸出窗口的那一块（红芯 + 白边）；按钮：左下的红色长条
        // 光标：按箭头的实际轮廓圈（图标生成时的形状，300×300 图标坐标，格子中心 = 列 × 6 + 3），
        // 轮廓内的、以及紧贴轮廓白边（4px 以内）的像素都算箭头，整体一起移动
        const ARROW = [[190, 168], [190, 268], [214, 246], [232, 284], [252, 276], [234, 238], [266, 238]];
        g.cursor = px.filter(p => !p.deco && (p.col === 'r' || p.col === 'w') && nearPolygon(p.cx * 6 + 3, p.cy * 6 + 3, ARROW, 4.5));
        g.button = px.filter(p => p.col === 'r' && !p.deco && !g.cursor.includes(p));
        g.btnC = centroid(g.button);
        g.tip = g.cursor.reduce((a, p) => (p.hx + p.hy < a.hx + a.hy ? p : a), g.cursor[0]); // 光标尖端（最左上）
      } else if (ic.name === 'tools') {
        // 扳手：白色实心块；火花：右上的红色；齿轮：其余的灰色和白色轮廓
        g.wrench = px.filter(p => p.col === 'w' && p.size === 5.2);
        g.sparks = px.filter(p => p.col === 'r' && !p.deco && p.hy < midY);
        g.bolt = px.filter(p => p.col === 'r' && !p.deco && p.hy >= midY);
        g.gear = px.filter(p => !p.deco && !g.wrench.includes(p) && p.col !== 'r');
        g.gearC = centroid(g.gear);
        g.wrenchPivot = g.wrench.reduce((a, p) => (p.hx + p.hy > a.hx + a.hy ? p : a), g.wrench[0]); // 扳手柄尾（最右下）
      }
    }
    // 点是否在多边形里，或离多边形的边不超过 pad
    function nearPolygon(x, y, poly, pad) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        const dx = xj - xi, dy = yj - yi, t = Math.max(0, Math.min(1, ((x - xi) * dx + (y - yi) * dy) / (dx * dx + dy * dy)));
        if (Math.hypot(x - (xi + dx * t), y - (yi + dy * t)) <= pad) return true;
      }
      return inside;
    }
    function centroid(list) {
      let x = 0, y = 0;
      for (const p of list) { x += p.hx; y += p.hy; }
      return { x: x / Math.max(1, list.length), y: y / Math.max(1, list.length) };
    }

    // ---------- 画布尺寸 ----------
    let scale = 1, dpr = 1;
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      scale = canvas.width / W;
      dirty = true; wake();
    }

    // ---------- 鼠标 ----------
    const mouse = { x: -1e4, y: -1e4, on: false };
    addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return; // 这一栏不在屏幕上时不用管
      mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; mouse.on = true;
      wake();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.on = false; mouse.x = mouse.y = -1e4; wake(); });

    // ---------- 主循环（没事做时停下，不耗电） ----------
    let raf = 0, dirty = true, last = performance.now(), now = 0;
    function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    function tick(t) {
      raf = 0;
      // 页面刚打开时网站还是隐藏的，量不到尺寸；每帧检查一下画布尺寸对不对
      const cw = Math.round(canvas.getBoundingClientRect().width * Math.min(2, devicePixelRatio || 1));
      if (cw && Math.abs(cw - canvas.width) > 1) resize();
      const dt = Math.min(.05, (t - last) / 1000); last = t; now = t / 1000;
      let busy = false;
      // 入场：图标顶边进入屏幕 85% 高度时开始拼装
      const vr = scroller.getBoundingClientRect(), cr = canvas.getBoundingClientRect(), k = cr.height / H;
      for (const ic of icons) {
        if (!ic.entered && cr.top + ic.box.y0 * k < vr.top + vr.height * .85 && cr.top + ic.box.y1 * k > vr.top) { ic.entered = true; ic.enterT = now; }
        if (ic.entered && now - ic.enterT < 1.6) busy = true;
      }
      for (const ic of icons) {
        const b = ic.box;
        // 悬停：进入图标范围就播一次小动画（播完 1 秒内不重复）
        const inside = mouse.on && mouse.x > b.x0 - 6 && mouse.x < b.x1 + 6 && mouse.y > b.y0 - 6 && mouse.y < b.y1 + 6;
        if (inside && !ic.hover && !ic.anim && now - ic.animEnd > 1 && ic.entered && now - ic.enterT > 1.2 && !reduce) ic.anim = { t0: now, dir: dirFrom(ic) };
        ic.hover = inside;
        if (ic.anim) { busy = true; if (now - ic.anim.t0 > ANIM_LEN[ic.name]) { ic.anim = null; ic.animEnd = now; } }
        // 分层视差：鼠标相对图标中心的位置（-1 ~ 1），离得越远影响越小
        const c = ic.par, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2;
        if (mouse.on && !reduce) {
          const nx = (mouse.x - cx) / hw, ny = (mouse.y - cy) / hh, far = Math.max(0, Math.hypot(nx, ny) - 1.6);
          const fade = 1 / (1 + far * far);
          c.tx = Math.max(-1, Math.min(1, nx)) * fade; c.ty = Math.max(-1, Math.min(1, ny)) * fade;
        } else { c.tx = 0; c.ty = 0; }
        c.x += (c.tx - c.x) * Math.min(1, dt * 6); c.y += (c.ty - c.y) * Math.min(1, dt * 6);
        if (Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) > .002) busy = true;
      }
      draw();
      if (busy || dirty) { dirty = false; raf = requestAnimationFrame(tick); }
    }
    // 十字键亮哪一支：鼠标进入时相对十字键中心的方向
    function dirFrom(ic) {
      if (ic.name !== 'dev') return null;
      const c = ic.groups.padC, dx = mouse.x - c.x, dy = mouse.y - c.y;
      return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy) || 1];
    }
    const ANIM_LEN = { planning: 1.9, dev: 1.5, ux: 1.6, tools: 1.5 };

    // ---------- 悬停小动画：返回某颗像素这一帧的位移、缩放、颜色 ----------
    function animOf(ic, p, t) {
      const g = ic.groups;
      let ax = 0, ay = 0, s = 1, col = null;
      // 白色流光：一条稍粗的白线按 order（0 底部 → 1 顶部）往上流过去，经过的像素变白、放大
      const flow = () => { if (p.order !== undefined) { const b = bump(t / 1.2, p.order, .1); s += b * .9; if (b > .3) col = '#FFFFFF'; } };
      if (ic.name === 'planning') {
        if (p.order !== undefined) { const b = bump(t / 1.2, p.order, .12); s += b * .9; if (b > .3) col = '#FFFFFF'; }
        if (g.cross.includes(p)) s += bump(t, 1.3, .12) * .45 + bump(t, 1.6, .12) * .45;
        if (g.flag.includes(p)) ay = Math.sin(t * 11 - p.hx * .12) * 3.2 * clamp01((1.9 - t) * 2);
      } else if (ic.name === 'dev') {
        const [dx, dy] = ic.anim.dir;
        flow();
        if (g.pad.includes(p)) {
          const rx = p.hx - g.padC.x, ry = p.hy - g.padC.y, along = rx * dx + ry * dy, across = Math.abs(rx * dy + ry * dx);
          if (along > 8 && across < 14) { const on = clamp01(t / .15) * clamp01((1.3 - t) / .3); ax = dx * 4 * on; ay = dy * 4 * on; s += .25 * on; }
        }
        const press = (at, list) => { if (list.includes(p)) s *= 1 - .45 * bump(t, at, .14); };
        press(.35, g.btnA); press(.75, g.btnB);
      } else if (ic.name === 'ux') {
        flow();
        // 光标：0~0.5s 滑向按钮，0.55s 点击，之后滑回
        if (g.cursor.includes(p)) {
          const go = ease.inOut(clamp01(t / .5)) * (1 - ease.inOut(clamp01((t - 1) / .5)));
          ax = (g.btnC.x + 24 - g.tip.hx) * go; ay = (g.btnC.y - 4 - g.tip.hy) * go;
          s *= 1 - .12 * bump(t, .6, .08);
        }
        if (g.button.includes(p)) { const fl = bump(t, .64, .1); if (fl > .3) col = '#FFFFFF'; s += fl * .2; }
      } else if (ic.name === 'tools') {
        flow();
        if (g.gear.includes(p)) {
          const a = ease.inOut(clamp01(t / 1.1)) * (Math.PI * 2 / 10); // 转过一个齿（10 个齿）
          const rx = p.hx - g.gearC.x, ry = p.hy - g.gearC.y, c = Math.cos(a), sn = Math.sin(a);
          ax = rx * c - ry * sn - rx; ay = rx * sn + ry * c - ry;
        }
        if (g.wrench.includes(p)) {
          const a = (-.16 * bump(t, .35, .35) + .09 * bump(t, .8, .3));
          const pv = g.wrenchPivot, rx = p.hx - pv.hx, ry = p.hy - pv.hy, c = Math.cos(a), sn = Math.sin(a);
          ax = rx * c - ry * sn - rx; ay = rx * sn + ry * c - ry;
        }
        if (g.sparks.includes(p)) { ay = -Math.abs(Math.sin(t * 9 + p.hx)) * 6; s *= .6 + .6 * Math.abs(Math.sin(t * 14 + p.hy)); }
      }
      return [ax, ay, s, col];
    }

    // ---------- 画 ----------
    const DEPTH = { d: .3, l: .65, w: 1.05, r: 1.5 }, PAR_MAX = 9; // 各颜色层的视差系数；最大位移（设计稿像素）
    const rect = (x, y, w, h) => ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)));
    function glyph(p, x, y, s) {
      // x, y 是格子中心
      if (p.kind === 'v') return rect(x - .8 * s, y - 2.6 * s, 1.6 * s, 5.2 * s);
      if (p.kind === 'p') { rect(x - .6 * s, y - 2.5 * s, 1.2 * s, 5 * s); return rect(x - 2.5 * s, y - .6 * s, 5 * s, 1.2 * s); }
      if (p.kind === 'x') { for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [0, 0], [-1.6, 1.6], [1.6, 1.6]]) rect(x + a * s - .6, y + b * s - .6, 1.2, 1.2); return; }
      const z = p.size * s; rect(x - z / 2, y - z / 2, z, z);
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const ic of icons) {
        if (!ic.entered) continue;
        const te = now - ic.enterT, ta = ic.anim ? now - ic.anim.t0 : 0;
        const parX = ic.par.x * PAR_MAX, parY = ic.par.y * PAR_MAX;
        for (const p of ic.px) {
          const depth = p.deco ? .2 : DEPTH[p.col];
          let x = p.hx + parX * depth, y = p.hy + parY * depth, s = 1, alpha = 1, col = COLORS[p.col];
          if (!reduce && te < p.delay + p.dur) {
            const k = clamp01((te - p.delay) / p.dur);
            if (k <= 0) continue;
            const e = ease.outBack(k);
            x += p.sx * (1 - e); y += p.sy * (1 - e);
            alpha = clamp01(k * 3); s = .5 + .5 * clamp01(k * 1.4);
          }
          if (ic.anim) { const [ax, ay, as, ac] = animOf(ic, p, ta); x += ax; y += ay; s *= as; if (ac) col = ac; }
          ctx.globalAlpha = alpha;
          ctx.fillStyle = col;
          glyph(p, x, y, s);
        }
      }
      ctx.globalAlpha = 1;
    }

    canvas.expIcons = icons; // 方便在控制台里查看每个图标的状态
    scroller.addEventListener('scroll', wake, { passive: true });
    new ResizeObserver(resize).observe(canvas);
    resize();
  }

  window.ExpIcons = { mount };
})();
