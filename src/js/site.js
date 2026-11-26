/* 网站本体：loading 结束后由 Site.enter() 打开。
 * - 路由：#/home、#/works、#/resume（#/resume/contact 直接到联系层），页面之间用开场那条红带掠过转场
 * - 首页：长滚动；火箭随滚动飞出屏幕；点飞鸟打开对应的个人信息框，点空白处关闭
 * - 简历：分层面板，滚动吸附，进入时标题乱码解码、分隔线画出、内容依次浮现；项目可展开、技能字符条、复制邮箱
 * - 作品集：分类筛选、卡片 3D 倾斜、字符封面乱跳
 * - 全站：自定义光标、导航文字乱码解码、按钮磁吸
 * 文字内容都在 content.js 里。 */
(() => {
  'use strict';

  const C = window.SITE_CONTENT;
  const site = document.getElementById('site');
  if (!C || !site) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLYPHS = '#@08XS*+=-:.';

  /* ---------- 小工具 ---------- */

  // 文字从乱码一位位解码成目标文字
  function scramble(el, text = el.dataset.text || el.textContent, dur = .45) {
    if (reduce) { el.textContent = text; return; }
    el.dataset.text = text;
    const t0 = performance.now();
    cancelAnimationFrame(el._scr);
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / (dur * 1000));
      const n = Math.floor(p * text.length);
      el.textContent = text.slice(0, n) + [...text.slice(n)].map(ch => (/\s/.test(ch) ? ch : GLYPHS[Math.random() * GLYPHS.length | 0])).join('');
      if (p < 1) el._scr = requestAnimationFrame(tick);
    };
    tick();
  }

  // 把一段文字画成 ASCII 字符画（字符越重的地方越“实”）
  function asciiArt(text, cols) {
    const RAMP = ' .:-=+*#%@';
    const c = document.createElement('canvas'), x = c.getContext('2d');
    const fs = 120, font = `900 ${fs}px "Arial Black", "Noto Sans SC", sans-serif`;
    x.font = font;
    c.width = Math.ceil(x.measureText(text).width) + 24;
    c.height = Math.ceil(fs * 1.2);
    x.font = font;
    x.textBaseline = 'middle';
    x.fillText(text, 12, c.height / 2);
    const data = x.getImageData(0, 0, c.width, c.height).data;
    const cw = c.width / cols, rows = Math.max(3, Math.round(c.height / (cw * 1.75))), chh = c.height / rows;
    const lines = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let q = 0; q < cols; q++) {
        let sum = 0, n = 0;
        for (let y = Math.floor(r * chh); y < (r + 1) * chh; y += 2) {
          for (let xx = Math.floor(q * cw); xx < (q + 1) * cw; xx += 2) { sum += data[(y * c.width + xx) * 4 + 3]; n++; }
        }
        line += RAMP[Math.round((sum / n / 255) * (RAMP.length - 1))];
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    return lines.join('\n');
  }

  // 字符画乱跳一下再恢复
  function jitterAscii(pre) {
    if (reduce || pre._jit) return;
    const orig = pre.dataset.art;
    let n = 0;
    pre._jit = setInterval(() => {
      pre.textContent = [...orig].map(ch => (ch !== ' ' && ch !== '\n' && Math.random() < .35 ? GLYPHS[Math.random() * GLYPHS.length | 0] : ch)).join('');
      if (++n > 7) { clearInterval(pre._jit); pre._jit = 0; pre.textContent = orig; }
    }, 55);
  }

  const toastEl = $('.toast', site);
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 1900);
  }

  function copyEmail() {
    const done = () => toast(`邮箱已复制：${C.profile.email}`);
    if (navigator.clipboard) navigator.clipboard.writeText(C.profile.email).then(done, () => toast(C.profile.email));
    else toast(C.profile.email);
  }

  /* ---------- 渲染：首页「1 个人信息」的四个信息框（坐标是设计稿像素，相对框的左上角） ---------- */

  const P = C.profile;
  // p(x, y, 内容, 字号, 额外 class / 标签)：在框里按设计稿坐标摆一段文字
  const p = (x, y, html, fs = 16, cls = '', tag = 'p') => `<${tag} class="p ${cls}" style="--x:${x};--y:${y};--fs:${fs}">${html}</${tag}>`;
  const box = (x, y, cls, size) => `<i class="p ${cls}" style="--x:${x};--y:${y};${size}"></i>`;
  const img = (x, y, w, src) => `<img class="p" style="--x:${x};--y:${y};--w:${w}" src="./assets/home/${src}" alt="">`;

  const rows = [['昵称 NICKNAME', esc(P.nickname)], ['驻地 LOCATION', esc(P.location)], ['出生年月 D.O.B', esc(P.birth)],
    ['通讯 PHONE / VX', esc(P.phone)], ['电邮 E-MAIL', `<button type="button" data-copy data-cursor="COPY">${esc(P.email)}</button>`]];
  $('[data-pane="basic"]', site).innerHTML = [
    img(63, 81, 282.4, 'photo.webp'),
    box(417, 55, 'p--tag', 'width:calc(123 * var(--u));height:calc(21 * var(--u))'),
    p(425, 30, esc(P.fullName), 34),
    p(547, 55, esc(P.nameEn), 15, 'p--tag p--en'),
    box(426, 86, 'p--line', '--w:45'), box(477, 86, 'p--line', '--w:7'), box(490, 86, 'p--line', '--w:186'),
    ...rows.map(([k, v], i) => p(425, 106 + i * 42.5, k, 14, 'p--muted') + p(585, 100 + i * 42.5, v, 20)),
    img(425, 328, 387, 'mbti.webp'),
  ].join('');

  // Education：按 Figma 795:797 排版，坐标相对信息框左上角。
  const educationRows = [
    { degreeY: 51, titleY: 46, timeY: 88, size: 24, pointsY: [126, 151] },
    { degreeY: 193, titleY: 199, timeY: 232, size: 20, pointsY: [276, 306, 336, 362, 387, 416] },
  ];
  $('[data-pane="edu"]', site).innerHTML = [
    p(30, 52, '教育经历', 36, 'p--ipix'),
    img(29, 101, 204, 'edu-en.webp'),
    box(251, 184, 'p--line', '--w:590'),
    img(304, 164, 32, 'edustar.webp'),
    img(728, 169, 24, 'edustar.webp'),
    ...C.education.map((e, i) => {
      const row = educationRows[i];
      return p(266, row.degreeY, esc(e.degree), 20, 'p--plain')
        + p(348, row.titleY, esc(`${e.school} | ${e.major}`), row.size, 'p--plain')
        + p(348, row.timeY, esc(e.time.replace(/\s*[—–-]\s*/, ' - ')), 16, 'p--plain')
        + e.points.map((point, j) => box(350, row.pointsY[j] + 8, 'p--dot', '')
          + p(366, row.pointsY[j], esc(point), 14, 'p--plain')).join('');
    }),
  ].join('');
  // 技能：按设计稿逐行摆放（坐标相对卡片左上角）；文字在 content.js 的 skillLines
  const SKILL_POS = [[101, 65], [101, 100], [101, 135], [254, 135], [220, 162], [264, 191], [254, 218], [219, 244], [101, 273]];
  $('[data-pane="skills"]', site).innerHTML = C.skillLines.map((t, i) => p(...SKILL_POS[i], esc(t), 16, 'p--reg')).join('');

  // 首页联系方式：微信面板显示二维码；邮箱点击打开发邮件页面；GitHub 跳到主页
  function copyText(text, label) {
    const done = () => toast(`${label}已复制：${text}`);
    // 剪贴板 API 不可用时（比如直接双击打开 html），退回到隐藏输入框 + execCommand
    const fallback = () => {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? `${label}已复制：${text}` : `${label}：${text}`);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }
  $$('[data-mail-list]', site).forEach(panel => {
    panel.innerHTML = [['常用邮箱', P.email], ['备用邮箱', P.email2]].filter(([, m]) => m)
      .map(([k, m]) => `<span>${k}</span><a href="mailto:${esc(m)}" data-cursor="MAIL">${esc(m)}</a>`).join('');
  });
  const gh = P.links.find(l => /github/i.test(l.label));
  $$('[data-github]', site).forEach(a => {
    if (gh && gh.url !== '#') a.href = gh.url;
    else a.addEventListener('click', e => { e.preventDefault(); toast('GitHub 主页地址还没填：在 content.js 的 links 里填写'); });
  });

  // 三个图标各管一个面板：点图标打开，再点一次或点页面别处收起；同一时间只开一个。打开微信面板时顺便复制微信号
  const socials = $$('.sc', site);
  function openSocial(sc) {
    socials.forEach(s => {
      s.classList.toggle('is-open', s === sc);
      $('[data-sc]', s).setAttribute('aria-expanded', String(s === sc));
    });
  }
  socials.forEach(sc => $('[data-sc]', sc).addEventListener('click', () => {
    const open = !sc.classList.contains('is-open');
    openSocial(open ? sc : null);
    if (open && $('.sc-pop--qr', sc) && P.wechat) copyText(P.wechat, '微信号');
  }));
  document.addEventListener('click', e => { if (!e.target.closest('.sc')) openSocial(null); });
  addEventListener('keydown', e => { if (e.key === 'Escape') openSocial(null); });

  /* ---------- 渲染：简历 ---------- */

  const reveal = (i, html, tag = 'div', cls = '') => `<${tag} class="reveal ${cls}" style="--i:${i}">${html}</${tag}>`;
  const dash = pts => `<ul class="dash">${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
  const timeline = list => `<ol class="tl">${list.map((it, i) => reveal(i, `
      <div class="tl__row"><span class="tl__org">${esc(it.org)}</span><span class="tl__role">${esc(it.role)}</span><span class="tl__time">${esc(it.time)}</span></div>
      ${dash(it.points)}`, 'li')).join('')}</ol>`;

  const LAYERS = [
    { id: 'profile', title: '基础信息', en: 'PROFILE', body: `
      <div class="profile">
        <div>
          <pre class="ascii-art reveal" style="--i:0" data-ascii="${esc(P.name.toUpperCase())}" data-cols="64"></pre>
          ${reveal(1, esc(P.fullName), 'div', 'profile__name')}
          ${reveal(2, esc(P.roleEn), 'div', 'profile__role')}
          ${reveal(3, esc(P.intro), 'p', 'profile__intro')}
          ${reveal(4, esc(P.status), 'div', 'status')}
        </div>
        <div>
          <dl class="info">
            ${reveal(2, `<dt>ROLE</dt><dd>${esc(P.role)}</dd>`)}
            ${reveal(3, `<dt>BASE</dt><dd>${esc(P.location)}</dd>`)}
            ${reveal(4, `<dt>MAIL</dt><dd><button type="button" data-copy data-cursor="COPY">${esc(P.email)}</button></dd>`)}
            ${reveal(5, `<dt>TEL</dt><dd>${esc(P.phone)}</dd>`)}
          </dl>
          ${reveal(6, P.links.map(l => `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener" data-cursor="OPEN">${esc(l.label)} ↗</a>`).join(''), 'div', 'pills')}
        </div>
      </div>` },
    { id: 'education', title: '教育背景', en: 'EDUCATION',
      body: timeline(C.education.map(e => ({ org: e.school, role: `${e.major} · ${e.degree}`, time: e.time, points: e.points }))) },
    { id: 'internship', title: '实习经历', en: 'INTERNSHIP',
      body: timeline(C.internships.map(e => ({ org: e.company, role: e.role, time: e.time, points: e.points }))) },
    { id: 'projects', title: '项目经历', en: 'PROJECTS', body: `
      <ol class="projs">${C.projects.map((p, i) => reveal(i, `
        <button class="proj__head" type="button" aria-expanded="${i === 0}" data-cursor="${i === 0 ? 'CLOSE' : 'OPEN'}">
          <span class="proj__no">P.${String(i + 1).padStart(2, '0')}</span>
          <span class="proj__name">${esc(p.name)}</span>
          <span class="proj__meta">${esc(p.role)} · ${esc(p.time)}</span>
          <span class="proj__toggle" aria-hidden="true"></span>
        </button>
        <div class="proj__body"><div class="proj__inner"><div>
          <p class="proj__summary">${esc(p.summary)}</p>
          ${dash(p.points)}
          <div class="proj__tags">${p.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}</div>
        </div></div></div>`, 'li', `proj${i === 0 ? ' is-open' : ''}`)).join('')}</ol>` },
    { id: 'skills', title: '专业技能', en: 'SKILLS', body: `
      <div class="skills">${C.skills.map((g, gi) => `<div>
        ${reveal(gi, `<h4>${esc(g.group.toUpperCase ? g.group : g.group)}</h4>`)}
        ${g.items.map(([name, lv], i) => reveal(gi + i + 1, `<span class="skill__name">${esc(name)}</span><span class="skill__bar" data-level="${lv}"></span>`, 'div', 'skill')).join('')}
      </div>`).join('')}</div>` },
    { id: 'contact', title: '荣誉 · 联系', en: 'HONORS & CONTACT', body: `
      <div class="contact">
        <ul class="honors">${C.honors.map((h, i) => reveal(i, `<b>${esc(h.time)}</b><span>${esc(h.text)}</span>`, 'li')).join('')}</ul>
        <div>
          ${reveal(1, 'GET IN TOUCH', 'div', 'kicker')}
          ${reveal(2, `<button type="button" class="contact__mail" data-copy data-cursor="COPY">${esc(P.email)}</button>`)}
          ${reveal(3, `<a class="btn btn--ink" href="#/works" data-magnet>看看作品 <span class="btn__arrow">→</span></a>`)}
        </div>
      </div>` },
  ];

  const rzScroll = $('[data-rz-scroll]', site), rzNav = $('[data-rz-nav]', site);
  rzScroll.innerHTML = LAYERS.map((L, i) => `
    <section class="rz-layer" id="rz-${L.id}" data-layer="${i}">
      <div class="panel">
        <div class="panel__head">
          <span class="panel__no">${String(i + 1).padStart(2, '0')}</span>
          <h2 class="panel__title" data-text="${esc(L.title)}">${esc(L.title)}</h2>
          <span class="panel__en">${esc(L.en)}</span>
        </div>
        <div class="panel__rule"></div>
        ${L.body}
      </div>
    </section>`).join('');
  rzNav.innerHTML = LAYERS.map((L, i) => `
    <li><a href="#/resume/${L.id}" data-goto="${i}" data-cursor="GO"><i></i><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(L.title)}<em>${esc(L.en)}</em></span></a></li>`).join('');

  $$('pre[data-ascii]', site).forEach(pre => {
    pre.dataset.art = asciiArt(pre.dataset.ascii, +pre.dataset.cols || 50);
    pre.textContent = pre.dataset.art;
    pre.addEventListener('mouseenter', () => jitterAscii(pre));
  });

  // 技能条：■ 填到等级，□ 补满 12 格；层进入时逐格打出来
  const BAR = 12;
  function fillBars(layer) {
    $$('.skill__bar', layer).forEach((bar, i) => {
      const lv = Math.round(+bar.dataset.level / 10 * BAR);
      let n = 0;
      clearInterval(bar._t);
      const draw = () => { bar.innerHTML = '■'.repeat(n) + `<em>${'□'.repeat(BAR - n)}</em>`; };
      draw();
      setTimeout(() => {
        bar._t = setInterval(() => { draw(); if (++n > lv) clearInterval(bar._t); }, 40);
      }, 200 + i * 60);
    });
  }

  // 项目展开 / 收起
  $$('.proj__head', site).forEach(head => head.addEventListener('click', () => {
    const li = head.parentElement, open = !li.classList.contains('is-open');
    li.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', open);
    head.dataset.cursor = open ? 'CLOSE' : 'OPEN';
  }));

  $$('[data-copy]', site).forEach(b => b.addEventListener('click', copyEmail));
  $('[data-pdf]', site).addEventListener('click', e => {
    if (P.resumePdf) { e.currentTarget.href = P.resumePdf; return; }
    e.preventDefault();
    toast('PDF 简历还没上传：在 content.js 里填 profile.resumePdf');
  });

  // 当前在哪一层：圆点、进度条、计数跟着变；第一次进入时标题解码、技能条打字
  const rzCount = $('[data-rz-count]', site), rzBar = $('[data-rz-bar]', site);
  function setLayer(i) {
    $$('a', rzNav).forEach((a, k) => a.classList.toggle('is-active', k === i));
    rzCount.textContent = `${String(i + 1).padStart(2, '0')} / ${String(LAYERS.length).padStart(2, '0')}`;
    rzBar.style.width = `${((i + 1) / LAYERS.length) * 100}%`;
  }
  function activate(i) {
    const layer = $$('.rz-layer', site)[i];
    setLayer(i);
    if (!layer.classList.contains('is-in')) {
      layer.classList.add('is-in');
      scramble($('.panel__title', layer));
      if (LAYERS[i].id === 'skills') fillBars(layer);
    }
  }
  const io = new IntersectionObserver(entries => {
    for (const en of entries) if (en.isIntersecting) activate(+en.target.dataset.layer);
  }, { root: rzScroll, threshold: .5 });
  $$('.rz-layer', site).forEach(l => io.observe(l));
  // 保底：滚动时按位置算当前层（有的环境里 IntersectionObserver 回调不及时）
  rzScroll.addEventListener('scroll', () => {
    const i = Math.round(rzScroll.scrollTop / rzScroll.clientHeight);
    activate(Math.max(0, Math.min(LAYERS.length - 1, i)));
  }, { passive: true });
  // 只滚动简历自己的滚动区。不用 scrollIntoView：它会把外层 overflow:hidden 的舞台也一起滚上去，整页被顶起一截
  function goLayer(i) {
    const layer = $$('.rz-layer', site)[i];
    if (layer) rzScroll.scrollTo({ top: layer.offsetTop, behavior: reduce ? 'auto' : 'smooth' });
  }
  rzNav.addEventListener('click', e => {
    const a = e.target.closest('[data-goto]');
    if (!a) return;
    e.preventDefault();
    goLayer(+a.dataset.goto);
  });

  /* ---------- 渲染：作品集 ---------- */

  const grid = $('[data-works]', site), filter = $('[data-filter]', site);
  const types = ['全部', ...new Set(C.works.map(w => w.type))];
  filter.innerHTML = types.map((t, i) => `<button type="button" class="${i ? '' : 'is-active'}" data-type="${esc(t)}" data-cursor="FILTER">${esc(t)}</button>`).join('');
  const workCard = (w, i) => `
    <button type="button" class="work" data-type="${esc(w.type)}" data-index="${i}" data-cursor="${w.url ? 'VIEW' : 'SOON'}" style="--i:${i % 3 + 1}">
      <div class="work__cover">
        <pre class="work__ascii" data-ascii="${String(i + 1).padStart(2, '0')}" data-cols="34"></pre>
        ${w.url ? '' : '<span class="work__badge">COMING SOON</span>'}
      </div>
      <div class="work__meta">
        <span class="work__no">${String(i + 1).padStart(2, '0')}</span>
        <span class="work__title">${esc(w.title)}</span>
        <span class="work__year">${esc(w.type)} · ${esc(w.year)}</span>
        <span class="work__desc">${esc(w.desc)}</span>
      </div>
    </button>`;
  grid.innerHTML = C.works.map(workCard).join('');
  $('[data-works-count]', site).textContent = `${String(C.works.length).padStart(2, '0')} PROJECTS`;
  $$('.work__ascii', site).forEach(pre => { pre.dataset.art = asciiArt(pre.dataset.ascii, +pre.dataset.cols); pre.textContent = pre.dataset.art; });

  filter.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', filter).forEach(x => x.classList.toggle('is-active', x === b));
    const t = b.dataset.type;
    const cards = $$('.work', grid);
    cards.forEach(c => c.classList.toggle('is-hidden', t !== '全部' && c.dataset.type !== t));
    gsap.fromTo(cards.filter(c => !c.classList.contains('is-hidden')), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'power3.out', stagger: .05 });
  });

  $$('.work', site).forEach(card => {
    const pre = $('.work__ascii', card);
    card.addEventListener('mouseenter', () => jitterAscii(pre));
    card.addEventListener('mousemove', e => {
      if (reduce) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      card.style.transform = `rotateY(${(px * 10).toFixed(2)}deg) rotateX(${(-py * 10).toFixed(2)}deg) translateZ(10px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
    card.addEventListener('click', () => {
      const w = C.works[+card.dataset.index];
      if (w.url) window.open(w.url, '_blank', 'noopener');
      else toast(`「${w.title}」详情页建设中`);
    });
  });

  /* ---------- 磁吸、乱码悬停（光标是 crosshair.js 的十字线，读元素的 data-cursor 当标签） ---------- */

  $$('[data-scramble]', site).forEach(el => {
    el.dataset.text = el.textContent;
    (el.closest('a') || el).addEventListener('mouseenter', () => scramble(el, el.dataset.text, .35));
  });

  function magnet(el) {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .25).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * .35).toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  }
  $$('[data-magnet]', site).forEach(magnet);

  /* ---------- 首页：进场、鼠标视差、滚动联动、火箭、个人信息框 ---------- */

  const homeScroll = $('[data-home-scroll]', site), heroEl = $('[data-hero]', site), infoEl = $('[data-info]', site);
  const orbEl = $('[data-orb]', site), titleEl = $('[data-hero-title]', site);
  const rocketEl = $('[data-rocket]', site), infoHeader = $('[data-info-header]', site);
  const rocketSheen = $('[data-rocket-sheen]', site);

  // 标题保留轻微视差（GSAP 的 x/y）；其余金属物件按“远近”分层，用 CSS translate 属性跟着鼠标移动，
  // 和它们自己的旋转 / 入场动画互不干扰：越近（data-depth 越大）移动越多。
  const par = [
    [gsap.quickTo(titleEl, 'x', { duration: 1, ease: 'power3' }), gsap.quickTo(titleEl, 'y', { duration: 1, ease: 'power3' }), 12, 8],
  ];
  const orbShine = $('.orb-shine', site), orbHit = $('[data-orb-hit]', site), orbBomb = $('.hero-orb__bomb', site), orbSpikes = $('.hero-orb__spikes', site);
  const depthEls = [...$$('[data-depth]', heroEl).map(el => ({ el, d: +el.dataset.depth })), { el: orbEl, d: .25 }];
  const look = { x: 0, y: 0, cx: 0, cy: 0, lx: 38, ly: 32, clx: 38, cly: 32 }; // 鼠标目标 / 当前（-0.5 ~ 0.5）；红球高光位置（%）
  let lookRaf = 0;
  function lookTick() {
    lookRaf = 0;
    const k = .08, u = innerWidth / 1920, K = 34 * u;
    look.cx += (look.x - look.cx) * k; look.cy += (look.y - look.cy) * k;
    look.clx += (look.lx - look.clx) * k; look.cly += (look.ly - look.cly) * k;
    for (const e of depthEls) {
      const t = `${(look.cx * K * e.d * 2).toFixed(2)}px ${(look.cy * K * e.d * 1.4).toFixed(2)}px`;
      e.el.style.translate = t;
      if (e.sheen) e.sheen.style.translate = t;
    }
    orbShine.style.setProperty('--lx', `${look.clx.toFixed(1)}%`);
    orbShine.style.setProperty('--ly', `${look.cly.toFixed(1)}%`);
    const moving = Math.abs(look.x - look.cx) + Math.abs(look.y - look.cy) + Math.abs(look.lx - look.clx) / 100 + Math.abs(look.ly - look.cly) / 100 > .0008;
    if (moving) lookRaf = requestAnimationFrame(lookTick);
  }

  // 金属反光：用物体自己的轮廓做遮罩，一道白光从左扫到右；鼠标碰到时扫一次（1.4 秒内不重复），不会自己循环闪
  function shine(sheen, delay = 0) {
    if (!sheen || reduce) return;
    const now = performance.now();
    if (sheen._at && now - sheen._at < 1400) return;
    sheen._at = now + delay * 1000;
    gsap.fromTo(sheen, { backgroundPosition: '150% 0' }, { backgroundPosition: '-50% 0', duration: 1, ease: 'power2.inOut', delay });
  }
  // 遮罩地址写成绝对地址：CSS 变量里的相对 url 会按 site.css 所在目录解析，导致找不到图
  const abs = src => new URL(src, location.href).href;
  function fillSheen(host, src) {
    const s = document.createElement('i');
    s.className = 'sheen sheen--fill';
    s.style.setProperty('--m', `url("${abs(src)}")`);
    host.append(s);
    return s;
  }
  const titleSheen = fillSheen(titleEl, $('img', titleEl).getAttribute('src'));
  const headerSheen = fillSheen(infoHeader, $('img', infoHeader).getAttribute('src'));
  // 钢球、星球：在旁边放一张同位置、同大小的反光层，跟着视差一起移动
  const sheenTargets = [{ host: titleEl, sheen: titleSheen }, { host: infoHeader, sheen: headerSheen }];
  for (const img of $$('[data-sheen]', heroEl)) {
    const s = document.createElement('i');
    s.className = 'fx sheen';
    s.setAttribute('style', img.getAttribute('style').replace(/animation[^;]*;?/g, ''));
    s.style.setProperty('--m', `url("${abs(img.getAttribute('src'))}")`);
    const ratio = () => { if (img.naturalWidth) s.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`; };
    ratio(); img.addEventListener('load', ratio);
    img.after(s);
    const entry = depthEls.find(e => e.el === img);
    if (entry) entry.sheen = s;
    sheenTargets.push({ host: img, sheen: s });
  }

  addEventListener('pointermove', e => {
    if (reduce || route !== 'home') return;
    const mx = e.clientX / innerWidth - .5, my = e.clientY / innerHeight - .5;
    for (const [qx, qy, ax, ay] of par) { qx(mx * ax * 2); qy(my * ay * 2); }
    look.x = mx; look.y = my;
    // 红球高光朝着鼠标那一侧偏
    const r = orbHit.getBoundingClientRect();
    const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width));
    const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height));
    look.lx = 50 + dx * 26; look.ly = 46 + dy * 26;
    if (!lookRaf) lookRaf = requestAnimationFrame(lookTick);
    // 鼠标碰到金属物件时扫一道反光
    for (const t of sheenTargets) {
      const b = t.host.getBoundingClientRect();
      if (e.clientX > b.left && e.clientX < b.right && e.clientY > b.top && e.clientY < b.bottom) shine(t.sheen);
    }
  }, { passive: true });

  // 戳红球：每戳一下球被压扁再弹回、喷出一圈彩纸；连续戳到第 3 下开始发抖，2.5 秒内戳满 5 下“过载”
  const BALL = { x: 621, y: 555, r: 245 }; // 红球在设计稿里的圆心和半径
  const BIT_COLORS = ['#FF0A3C', '#FF0A3C', '#FF4B86', '#FFFFFF', '#56CFF0'];
  gsap.set(orbBomb, { transformOrigin: '45.8% 45.1%' });
  let pokes = [], overloading = false;
  function squash(k) {
    gsap.timeline()
      .to([orbBomb, orbShine], { scaleX: 1 + .07 * k, scaleY: 1 - .07 * k, duration: .08, ease: 'power2.out', overwrite: 'auto' })
      .to([orbBomb, orbShine], { scaleX: 1, scaleY: 1, duration: 1, ease: 'elastic.out(1.1, .3)' });
  }
  function burst(n, power = 1) {
    const u = innerWidth / 1920, cx = BALL.x * u, cy = BALL.y * u;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i'), size = (6 + Math.random() * 12) * u * (power > 1 ? 1.3 : 1);
      el.className = 'orb-bit';
      el.style.cssText = `width:${size}px;height:${Math.random() < .5 ? size : size * .45}px;background:${BIT_COLORS[i % BIT_COLORS.length]};border-radius:${Math.random() < .4 ? '50%' : '1px'}`;
      heroEl.append(el);
      const a = Math.random() * Math.PI * 2, r0 = BALL.r * .9 * u, r1 = (BALL.r + 60 + Math.random() * 220 * power) * u;
      gsap.fromTo(el, { x: cx + Math.cos(a) * r0 - size / 2, y: cy + Math.sin(a) * r0 - size / 2, rotation: 0, opacity: 1 },
        { x: cx + Math.cos(a) * r1 - size / 2, y: cy + Math.sin(a) * r1 - size / 2, rotation: (Math.random() - .5) * 540, opacity: 0,
          duration: .7 + Math.random() * .7, ease: 'expo.out', onComplete: () => el.remove() });
    }
  }
  function wave(delay, color) {
    const u = innerWidth / 1920, d = BALL.r * 2 * u, el = document.createElement('i');
    el.className = 'orb-wave';
    el.style.cssText = `width:${d}px;height:${d}px;border-color:${color}`;
    heroEl.append(el);
    gsap.fromTo(el, { x: BALL.x * u - d / 2, y: BALL.y * u - d / 2, scale: 1, opacity: 1 },
      { scale: 2.6, opacity: 0, duration: .9, delay, ease: 'power2.out', onComplete: () => el.remove() });
  }
  function shake(target, amp, dur = .35) {
    gsap.fromTo(target, { x: 0 }, { keyframes: { x: [0, -amp, amp, -amp * .6, amp * .6, -amp * .3, 0] }, duration: dur, ease: 'none', overwrite: 'auto' });
  }
  function overload() {
    overloading = true;
    const u = innerWidth / 1920, tag = document.createElement('span');
    tag.className = 'orb-tag';
    tag.textContent = 'OVERLOAD ×5';
    heroEl.append(tag);
    gsap.fromTo(tag, { x: (BALL.x + BALL.r * .55) * u, y: (BALL.y - BALL.r - 30) * u, opacity: 0 },
      { y: (BALL.y - BALL.r - 70) * u, opacity: 1, duration: .35, ease: 'back.out(2)' });
    gsap.to(tag, { opacity: 0, duration: .4, delay: 1.4, onComplete: () => tag.remove() });
    shake(orbEl, 14 * u, .6);
    squash(4);
    gsap.timeline().to(orbSpikes, { scale: 1.3, duration: .12, ease: 'power3.out' }).to(orbSpikes, { scale: 1, duration: 1.2, ease: 'elastic.out(1, .35)' });
    burst(40, 2.2);
    gsap.delayedCall(.12, () => burst(30, 1.6));
    gsap.delayedCall(.26, () => burst(24, 2.6));
    wave(0, '#FFFFFF'); wave(.1, '#FF0A3C'); wave(.22, '#FFFFFF');
    gsap.delayedCall(1.4, () => { overloading = false; });
  }
  orbHit.addEventListener('click', () => {
    if (reduce || overloading) return;
    const now = performance.now();
    pokes = pokes.filter(t => now - t < 2500);
    pokes.push(now);
    const n = pokes.length;
    if (n >= 5) { pokes = []; overload(); return; }
    squash(1 + (n - 1) * .5);
    burst(10 + n * 6, 1 + n * .15);
    if (n >= 3) shake(orbBomb, (n - 2) * 5 * innerWidth / 1920);
  });

  // 云层：首屏和「1 个人信息」交界处一远一近两层云。交界滚到屏幕中间时云在设计位置；
  // 远云（在火箭后面）跟得慢，近云（盖在最前面、带虚化）跑得快，滚过时像镜头穿过云层
  const CLOUDS = [ // x, y（设计稿像素）, 宽, 近/远, 视差系数
    [-140, 1040, 820, 'far', .3], [1180, 1110, 900, 'far', .3], [560, 1230, 700, 'far', .22],
    [-260, 1320, 1100, 'near', -.6], [980, 1400, 1150, 'near', -.7], [1560, 1210, 760, 'near', -.5],
  ];
  const PUFFS = [[0, .38, .42], [.16, .16, .52], [.38, .02, .6], [.6, .14, .5], [.76, .34, .4], [.28, .34, .5]]; // 每朵云里的几团：x, y, 直径（相对云宽）
  const cloudEls = CLOUDS.map(([x, y, w, layer, f]) => {
    const el = document.createElement('div');
    el.className = `cloud cloud--${layer}`;
    el.style.cssText = `left:calc(${x} * var(--u));top:calc(${y} * var(--u));width:calc(${w} * var(--u));height:calc(${w * .5} * var(--u))`;
    el.innerHTML = PUFFS.map(([px, py, d]) => `<i style="left:${px * 100}%;top:${py * 100}%;width:${d * 100}%;aspect-ratio:1"></i>`).join('');
    $('[data-clouds]', site).append(el);
    return { el, f };
  });
  function moveClouds(st) {
    if (reduce) return;
    const u = innerWidth / 1920, anchor = 1239 * u - homeScroll.clientHeight / 2;
    // 交界滚过屏幕中间之后，云很快淡掉，不会一直盖在「个人信息」标题上
    const fade = Math.max(0, Math.min(1, 1 - (st - anchor) / homeScroll.clientHeight * 2.2));
    for (const c of cloudEls) {
      c.el.style.transform = `translate3d(0, ${((st - anchor) * c.f).toFixed(1)}px, 0)`;
      c.el.style.setProperty('--fade', fade.toFixed(3));
      c.el.style.visibility = fade > 0 ? '' : 'hidden';
    }
  }

  // 火箭：固定在视口里。首屏时藏在左下角屏幕外；往下滚时沿一条直线（设计稿里三只火箭的连线方向）
  // 匀速飞向右上，同时逐渐变大，最后飞出屏幕。只改 transform（位移 + 缩放），用一个 rAF 缓动跟随滚动，不会抖。
  // 坐标单位都是设计稿像素（1920 宽）。
  const ROCKET = {
    start: { x: -260, below: 420 }, // 起点中心：屏幕左边外 260、视口底部下方 420，首屏看不到；整条飞行线比原来低 200
    dir: { x: .8115, y: -.584 },    // 飞行方向（单位向量）
    w0: 217,                        // 起飞时宽度 = 小火箭 1
    grow: .4,                       // 每飞 1 个单位，宽度增加多少
    distance: 4000,                 // 全程长度，足够飞出右上角
    scroll: 1.3,                    // 滚过多少个首屏高度飞完
    imgW: 1027, ratio: 957 / 1027,  // 图片按小火箭 3 的尺寸摆放，再整体缩放
  };
  const rocket = { p: 0, target: 0, raf: 0 };
  function drawRocket() {
    const u = innerWidth / 1920, vh = homeScroll.clientHeight / u;
    const d = ROCKET.distance * rocket.p;
    const s = (ROCKET.w0 + ROCKET.grow * d) / ROCKET.imgW;
    const cx = ROCKET.start.x + ROCKET.dir.x * d, cy = vh + ROCKET.start.below + ROCKET.dir.y * d;
    const w = ROCKET.imgW * u, h = w * ROCKET.ratio;
    rocketEl.style.width = `${w}px`;
    rocketEl.style.transform = `translate3d(${cx * u - w / 2}px, ${cy * u - h / 2}px, 0) scale(${s})`;
    rocketEl.style.visibility = rocket.p <= 0 || rocket.p >= 1 ? 'hidden' : 'visible';
    // 火箭反光：和火箭同位置同大小，光带随飞行进度从机头扫到机尾
    rocketSheen.style.width = `${w}px`; rocketSheen.style.height = `${h}px`;
    rocketSheen.style.transform = rocketEl.style.transform;
    rocketSheen.style.visibility = rocketEl.style.visibility;
    rocketSheen.style.backgroundPosition = `${(150 - rocket.p * 260).toFixed(1)}% 0`;
  }
  function followRocket() {
    const diff = rocket.target - rocket.p;
    rocket.p = Math.abs(diff) < .0005 || reduce ? rocket.target : rocket.p + diff * .14;
    drawRocket();
    rocket.raf = rocket.p === rocket.target ? 0 : requestAnimationFrame(followRocket);
  }
  function flyRocket(p) {
    rocket.target = p;
    if (!rocket.raf) rocket.raf = requestAnimationFrame(followRocket);
  }

  // 金属气球：先停在初始位置（「1 个人信息」标题上方那一带），滚到标题顶边到达屏幕约 60% 高度时一起放飞；
  // 各自随机延迟、随机速度（匀速上升，像真的气球），一边左右飘一边轻轻摆，升出屏幕上沿后隐藏；
  // 只放一次，刷新或重新进入首页才会再来。
  const BALLOON_AT = .62;
  const balloonEls = $$('[data-balloon]', site);
  function launchBalloon(b) {
    if (b.dataset.flying) return;
    b.dataset.flying = '1';
    if (reduce) { b.style.visibility = 'hidden'; return; }
    const top = homeScroll.getBoundingClientRect().top, u = innerWidth / 1920;
    const rise = b.getBoundingClientRect().bottom - top + 120 * u; // 升到整只（连绳子）都出了屏幕上沿
    const delay = Math.random() * 1.2, dur = Math.max(2.2, rise / (u * (320 + Math.random() * 220)));
    const sway = gsap.to(b, { x: (Math.random() < .5 ? -1 : 1) * (20 + Math.random() * 40) * u, rotation: (Math.random() - .5) * 12,
      duration: 1.4 + Math.random(), ease: 'sine.inOut', yoyo: true, repeat: -1, delay });
    gsap.to(b, { y: -rise, duration: dur, delay, ease: 'power1.in',
      onComplete: () => { sway.kill(); b.style.visibility = 'hidden'; } });
  }
  function checkBalloons() {
    if (balloonEls[0]?.dataset.flying) return;
    if (infoEl.offsetTop + infoHeader.offsetTop < homeScroll.scrollTop + homeScroll.clientHeight * BALLOON_AT) balloonEls.forEach(launchBalloon);
  }
  // 进入首页时把气球放回原位，等下一次放飞
  function resetBalloons() {
    gsap.killTweensOf(balloonEls);
    balloonEls.forEach(b => { delete b.dataset.flying; });
    gsap.set(balloonEls, { clearProps: 'transform,visibility' });
  }

  // 「点击任意模块查看信息」：滚到这一带时开始打字。节奏模仿真人：每个字间隔不一样，
  // 词与词之间（点击 / 任意 / 模块 / 查看 / 信息）停顿长一点，偶尔连打两个字很快；打完光标一直闪
  const hintEl = $('[data-info-hint]', site), hintText = hintEl.getAttribute('aria-label');
  let hintStarted = false;
  function typeHint() {
    hintStarted = true;
    const out = $('[data-type]', hintEl);
    if (reduce) { out.textContent = hintText; hintEl.classList.add('is-done'); return; }
    hintEl.classList.add('is-waiting'); // 先闪两下光标，像是准备开始输入
    let i = 0;
    const next = () => {
      out.textContent = hintText.slice(0, ++i);
      if (i >= hintText.length) { hintEl.classList.remove('is-typing'); hintEl.classList.add('is-done'); return; }
      const wordEnd = i % 2 === 0;                 // 这句话每两个字是一个词
      let wait = 70 + Math.random() * 130;         // 字与字之间 70~200ms
      if (wordEnd) wait += 120 + Math.random() * 260; // 词尾多停一下
      if (!wordEnd && Math.random() < .3) wait = 45 + Math.random() * 35; // 偶尔连着很快打出一个词
      if (i === 4 && Math.random() < .6) wait += 350; // 打到一半偶尔犹豫一下
      setTimeout(next, wait);
    };
    setTimeout(() => { hintEl.classList.replace('is-waiting', 'is-typing'); next(); }, 1150);
  }

  // 滚动：标题渐隐；火箭按进度飞；左侧进度条；「1 个人信息」标题滚到眼前时擦出
  let infoShown = false;
  function onHomeScroll() {
    const st = homeScroll.scrollTop, heroH = heroEl.offsetHeight;
    if (!heroH) return; // 网站还没显示时（比如 loading 期间改了窗口大小）量不到高度，跳过，免得火箭进度变成 NaN
    titleEl.style.translate = `0 ${(st * .18).toFixed(1)}px`;
    titleEl.style.opacity = Math.max(0, 1 - st / heroH * 1.3).toFixed(3);
    flyRocket(Math.min(1, st / (heroH * ROCKET.scroll)));
    moveClouds(st);
    checkBalloons();
    revealExp(st);
    revealWorks(st);
    const max = Math.max(1, homeScroll.scrollHeight - homeScroll.clientHeight);
    updateHsIndex(st);
    if (!hintStarted && infoEl.offsetTop + hintEl.offsetTop < st + homeScroll.clientHeight * .82) typeHint();
    if (!infoShown && infoEl.offsetTop + infoHeader.offsetTop < st + homeScroll.clientHeight * .8) {
      infoShown = true;
      if (reduce) infoHeader.style.clipPath = 'none';
      else { gsap.to(infoHeader, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power3.inOut' }); shine(headerSheen, .9); }
    }
  }
  homeScroll.addEventListener('scroll', onHomeScroll, { passive: true });
  addEventListener('resize', () => { onHomeScroll(); drawRocket(); });
  $$('[data-scroll-next]', site).forEach(button => button.addEventListener('click', () => homeScroll.scrollTo({ top: heroEl.offsetHeight, behavior: reduce ? 'auto' : 'smooth' })));

  // 左侧索引栏：点击滚到对应区块；onHomeScroll 里按当前滚动位置高亮
  const hsIndexBtns = $$('[data-hs-target]', site);
  const hsSections = { info: infoEl, exp: $('[data-exp]', site), works: $('[data-home-works]', site), about: $('[data-about]', site) };
  hsIndexBtns.forEach(b => b.addEventListener('click', () => {
    const el = hsSections[b.dataset.hsTarget];
    if (!el) return;
    if (reduce) { homeScroll.scrollTop = el.offsetTop; return; }
    gsap.to(homeScroll, { scrollTop: el.offsetTop, duration: 1.1, ease: 'power2.inOut', overwrite: 'auto' });
  }));
  function updateHsIndex(st) {
    const progress = Math.max(0, Math.min(1, st / Math.max(1, heroEl.offsetHeight * .45)));
    const index = $('.hs-index', site);
    index.style.opacity = progress;
    index.style.visibility = progress > 0 ? 'visible' : 'hidden';
    index.style.pointerEvents = progress > .15 ? 'auto' : 'none';
    let cur = '';
    for (const k in hsSections) {
      const el = hsSections[k];
      if (el && el.offsetTop <= st + homeScroll.clientHeight * .45) cur = k;
    }
    hsIndexBtns.forEach(b => b.classList.toggle('is-active', b.dataset.hsTarget === cur));
  }

  // 像素格子：设计稿里每一颗方块的位置（设计稿像素，区块内坐标 = 设计稿 y − 1239）。
  // start = 连接线起点（红色英文标签旁的大方块 + 8 颗小像素）；end = 卡片上的方块；deco = 马赛克图钉、像素台阶
  const cluster = (x, y) => [[x, y, 34, 34], ...[[44, 24, 5, 4], [50, 17], [57, 23], [38, 5], [50, 29], [38, 29], [44, 12], [38, 17]]
    .map(([dx, dy, w = 5, h = 5]) => [x + dx, y + dy, w, h])];
  const pxGrid = (pts, w) => pts.map(([x, y]) => [x, y, w, w]);
  const PIXELS = {
    basic: { start: cluster(356, 977), end: [[878, 831, 34, 34]] },
    edu: {
      start: cluster(734, 1408), end: [[1290, 1387, 34, 34]],
      deco: pxGrid([[1725, 910], [1740, 951], [1695, 988], [1681, 897], [1651, 949], [1625, 897], [1668, 882], [1725, 936], [1740, 977], [1695, 1014],
        [1681, 923], [1725, 884], [1625, 923], [1754, 910], [1695, 1042], [1724, 988], [1710, 897], [1680, 949], [1695, 962], [1710, 949],
        [1654, 897], [1696, 882], [1754, 936], [1695, 1068], [1724, 1014], [1710, 923], [1754, 884], [1654, 923], [1739, 923], [1754, 964],
        [1709, 1001], [1695, 910], [1665, 962], [1639, 910]], 13),
    },
    skills: {
      start: cluster(935, 1016), end: [[484, 1151, 34, 34]],
      deco: pxGrid([[101, 1526], [101, 1514], [101, 1502], [101, 1490], [113, 1526], [113, 1514], [113, 1502], [125, 1526], [125, 1514], [125, 1502],
        [137, 1526], [149, 1526], [161, 1526], [137, 1514], [137, 1506], [952, 1526], [952, 1514], [952, 1502], [952, 1490], [940, 1526], [940, 1514],
        [916, 1526], [940, 1502], [928, 1526], [928, 1514], [928, 1502], [940, 1490], [952, 1478], [940, 1478], [940, 1466]], 9),
    },
  };
  // 「1 个人信息」标题旁的小像素箭头（坐标相对标题左上角 906, 309）
  const HEADER_PX = [[277.3, 218.8, 9.2, 9.1], [266.5, 228.7, 9.2, 9.1], [298.8, 199.3, 9.2, 9.1], [288, 209.2, 9.2, 9.1],
    [266.5, 208.8, 9, 9], [288, 189.3, 9, 9], [287.5, 228.8, 9, 9], [309, 209.3, 9, 9]];
  const pxHTML = (list, role) => list.map(([x, y, w, h]) => `<i class="fx px" data-role="${role}" style="--x:${x};--y:${y};--w:${w};--h:${h}"></i>`).join('');
  for (const [id, g] of Object.entries(PIXELS)) {
    $(`[data-ip="${id}"] .ip-px`, site).innerHTML = pxHTML(g.start, 'start') + pxHTML(g.end, 'end') + pxHTML(g.deco || [], 'deco');
  }
  $$('[data-header-px]', site).forEach(el => { el.innerHTML = pxHTML(HEADER_PX, 'deco'); });

  // 单颗像素的不规则闪烁：每一颗自己定时，随机间隔、随机暗下去一到三下，彼此从不同步
  function flickerPixels(list, timers) {
    for (const px of list) {
      const tick = () => {
        let n = 1 + (Math.random() * 3 | 0), t = 0;
        while (n--) {
          const low = (Math.random() * .35).toFixed(2), on = 35 + Math.random() * 70;
          timers.push(setTimeout(() => { px.style.opacity = low; }, t));
          timers.push(setTimeout(() => { px.style.opacity = ''; }, t + on));
          t += on + 30 + Math.random() * 60;
        }
        timers.push(setTimeout(tick, t + 250 + Math.random() * 2600));
      };
      timers.push(setTimeout(tick, Math.random() * 1500));
    }
  }
  if (!reduce) flickerPixels($$('[data-header-px] .px', site), []);

  // 个人信息框：点飞鸟（或旁边的标签）打开对应的框，点空白处关掉。打开过程：
  // 横线擦出 → 连接线从标签旁的像素方块出发，沿折线画到卡片 → 卡片上的方块亮起 →
  // 框展开并高频闪烁（只有框和外框装饰闪，正文还没出现）→ 闪完正文再淡入 → 之后像素格子一颗一颗不规则闪，一直持续
  const infoPages = Object.fromEntries($$('[data-ip]', site).map(el => [el.dataset.ip, el]));
  let openId = null, openTl = null;
  const parts = el => ({
    lines: $('.ip-lines', el), path: $('.ip-link polyline', el), box: $('.ip-box', el), frame: $('.ip-frame', el), deco: $('.ip-deco', el),
    start: $$('.px[data-role="start"]', el), end: $$('.px[data-role="end"]', el), decoPx: $$('.px[data-role="deco"]', el),
    items: [...$('.info-pane', el).children],
  });
  const flickerTimers = new Map();
  function startFlicker(el) {
    if (reduce) return;
    const timers = [];
    flickerTimers.set(el, timers);
    flickerPixels($$('.px', el), timers);
  }
  function stopFlicker(el) {
    (flickerTimers.get(el) || []).forEach(clearTimeout);
    flickerTimers.delete(el);
    $$('.px', el).forEach(px => { px.style.opacity = ''; });
  }
  function markInfo(id) {
    $$('[data-tab]', site).forEach(t => t.setAttribute('aria-pressed', String(t.dataset.tab === id)));
    $$('[data-bird]', site).forEach(b => b.classList.toggle('is-active', b.dataset.bird === id));
  }
  const drawLink = (path, k) => { path.style.strokeDashoffset = String(1 - k); };
  function showInfo(el) {
    el.hidden = false;
    if (reduce) { el.classList.add('is-on'); return; }
    const q = parts(el), shell = [q.box, q.frame, q.deco].filter(Boolean), px = [...q.start, ...q.end, ...q.decoPx];
    const BOOT = .5; // 框高频闪烁的时长，闪完正文才出现
    const link = { k: 0 }; // 连接线画到了哪里（0 ~ 1）；GSAP 会把 px 值取整，所以自己写 dashoffset
    openTl = gsap.timeline({ onComplete: () => {
      el.classList.add('is-on');
      gsap.set([q.lines, ...shell, ...px, ...q.items], { clearProps: 'opacity,clipPath,transform' });
      startFlicker(el);
    } })
      .set([...shell, ...px, ...q.items], { opacity: 0 })
      .add(() => drawLink(q.path, 0))
      // 排线：所有横线一起从左侧飞快地延伸到各自的长度
      .fromTo(q.lines, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .2, ease: 'power3.out' }, 0)
      // 起点的像素方块先闪亮，连接线再从这里出发
      .to(q.start, { keyframes: { opacity: [0, 1, .2, 1] }, duration: .14, stagger: { each: .012, from: 'random' } }, .04)
      .to(link, { k: 1, duration: .34, ease: 'power2.inOut', onUpdate: () => drawLink(q.path, link.k) }, .12)
      .to(q.end, { keyframes: { opacity: [0, 1, .2, 1] }, duration: .12 }, .44)
      // 框从一条线展开，同时进入高频闪烁
      .add(() => el.classList.add('is-booting'), .5)
      .fromTo(q.box, { opacity: 1, scaleX: .4, scaleY: .01 }, { scaleX: 1, duration: .1, ease: 'power2.out' }, .5)
      .to(q.box, { scaleY: 1, duration: .16, ease: 'power4.out' }, .6)
      .set([q.frame, q.deco].filter(Boolean), { opacity: 1 }, .6)
      .to(q.decoPx, { opacity: 1, duration: .01, stagger: { each: .008, from: 'random' } }, .62)
      .add(() => el.classList.remove('is-booting'), .5 + BOOT)
      // 闪完：正文平稳淡入，不闪
      .fromTo(q.items, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .32, ease: 'power2.out', stagger: .018 }, .5 + BOOT + .04);
  }
  function hideInfo(el, done) {
    stopFlicker(el);
    el.classList.remove('is-booting', 'is-on');
    const finish = () => {
      el.hidden = true;
      gsap.set([el, ...el.querySelectorAll('*')], { clearProps: 'opacity,clipPath,transform' });
      $$('.ip-link polyline', el).forEach(l => { l.style.strokeDashoffset = ''; });
      if (done) done();
    };
    if (reduce) return finish();
    gsap.to(el, { keyframes: { opacity: [1, .25, .8, 0] }, duration: .2, onComplete: finish });
  }
  function openInfo(id) {
    if (openId === id || !infoPages[id]) return;
    if (openTl) openTl.kill();
    const prev = openId && infoPages[openId];
    openId = id;
    markInfo(id);
    if (prev) hideInfo(prev, () => { if (openId === id) showInfo(infoPages[id]); });
    else showInfo(infoPages[id]);
  }
  function closeInfo() {
    if (!openId) return;
    if (openTl) openTl.kill();
    const prev = infoPages[openId];
    openId = null;
    markInfo(null);
    hideInfo(prev);
  }
  $$('[data-bird], [data-tab]', site).forEach(b => b.addEventListener('click', () => {
    if (flightOn) return; // 飞鸟正在飞时，别的飞鸟和标签先不响应
    if ((b.dataset.bird || b.dataset.tab) === 'exp') flyExpBird();
    else openInfo(b.dataset.bird || b.dataset.tab);
  }));

  /* ---------- 2 个人经历：工作经历 + 项目经历卡片（文字在 content.js 的 experience） ---------- */
  const expEl = $('[data-exp]', site), expHeader = $('[data-exp-header]', site);
  const XP = C.experience;
  // 小标签四角的红色像素（相对标签左上角，设计稿 Figma「工作经历标题」）
  const tagPx = [[0, 67], [10, 67], [196, 0], [206, 0]].map(([x, y]) => `<i class="px" style="--x:${x};--y:${y}"></i>`).join('');
  const xpTag = text => `<div class="xp-tag"><b>${esc(text)}</b>${tagPx}</div>`;
  // 要点列表：第一条（工作经历是每一条）前面的序号压一个红色小块
  const xpList = (points, keyAll) => `<ol class="xp-list">${points.map((t, i) => `<li data-n="${i + 1}"${keyAll || i === 0 ? ' class="is-key"' : ''}>${esc(t)}</li>`).join('')}</ol>`;
  // 最新项目卡片高度；内容超出时由正常文档流撑高。
  const XP_H = { work: 498, projects: [609, 447, 487] };
  const XP_GAP = [36, 23, 17];
  $('[data-xp-work]', site).innerHTML = xpTag('工作经历') + `<article class="xp-card" style="min-height:calc(${XP_H.work} * var(--u))" data-xp-reveal>
      <p class="xp-time">${esc(XP.work.time)}</p>
      <h3 class="xp-title"><span>${esc(XP.work.role)}</span><span>${esc(XP.work.company)}</span></h3>
      <p class="xp-desc">${esc(XP.work.desc)}</p>
      ${xpList(XP.work.points, true)}
    </article>`;
  $('[data-xp-projects]', site).innerHTML = xpTag('项目经历') + XP.projects.map((pj, i) => `<article class="xp-card xp-card--project" style="min-height:calc(${XP_H.projects[i] || 402} * var(--u));margin-top:calc(${XP_GAP[i] ?? 55} * var(--u))" data-xp-reveal>
      <span class="xp-no" aria-hidden="true">${i + 1}</span>
      <p class="xp-time">${esc(pj.time)}</p>
      <h3 class="xp-title"><span>${esc(pj.role)}</span><span>${esc(pj.name)}</span>${pj.type ? `<small>${esc(pj.type)}</small>` : ''}</h3>
      <p class="xp-desc">${esc(pj.desc)}</p>
      ${xpList(pj.points, true)}
    </article>`).join('');
  // 标签的红色像素也和其它像素格子一样各自不规则闪
  if (!reduce) flickerPixels($$('.xp-tag .px', expEl), []);

  // 滚到时：标题从左往右擦出并扫一道反光；左栏和卡片依次浮上来
  const expHeaderSheen = fillSheen(expHeader, $('img', expHeader).getAttribute('src'));
  sheenTargets.push({ host: expHeader, sheen: expHeaderSheen });
  let expHeaderShown = false;
  // 左右速度差：左栏（图标、标签、时间轴）跟着背景正常滚；右侧卡片（底边 2653）比左栏（底边 2019）长 634，
  // 滚动时右侧按进度多往上走这 634，于是右侧滑得快一点，滑到最下面时两边底边正好对齐（单位：设计稿像素，区块内坐标）
  const XP_LEFT_GAP = 2653 - 2019;
  const xpRight = $$('[data-xp-work], [data-xp-projects]', site);
  if (window.ExpIcons) ExpIcons.mount({ canvas: $('[data-xp-icons]', site), scroller: homeScroll });
  function revealExp(st) {
    const vh = homeScroll.clientHeight;
    if (!reduce) {
      const u = innerWidth / 1920, start = expEl.offsetTop, end = Math.max(start + 1, expEl.offsetTop + (2019 + 120) * u - vh);
      const k = Math.max(0, Math.min(1, (st - start) / (end - start)));
      const lift = `translate3d(0, ${(-k * XP_LEFT_GAP * u).toFixed(1)}px, 0)`;
      for (const el of xpRight) el.style.transform = lift;
    }
    if (!expHeaderShown && expEl.offsetTop + expHeader.offsetTop < st + vh * .8) {
      expHeaderShown = true;
      if (reduce) expHeader.style.clipPath = 'none';
      else { gsap.to(expHeader, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power3.inOut' }); shine(expHeaderSheen, .9); }
    }
    for (const el of $$('[data-xp-reveal]:not(.is-in)', expEl)) {
      const top = el.getBoundingClientRect().top - homeScroll.getBoundingClientRect().top;
      if (top < vh * .88) el.classList.add('is-in');
    }
  }


  /* ---------- 3 作品集：电脑屏幕上的分类按钮切换窗口里的四张卡片（内容在 content.js 的 showcase） ---------- */
  const worksEl = $('[data-home-works]', site), worksHeader = $('[data-works-header]', site);
  const SC = C.showcase;
  // 四个卡片位置和日期标签位置（设计稿像素，区块内坐标）：左上、右上、左下、右下
  const WK_SLOTS = [
    { card: [637, 241, 468, 311], tag: [983, 537] },
    { card: [1204, 271, 519, 313], tag: [1497, 566] },
    { card: [767, 628, 407, 304], tag: [731, 917] },
    { card: [1264, 625, 438, 328], tag: [1604, 934] },
  ];
  const wkCards = $('[data-wk-cards]', site), wkMenu = $('[data-wk-menu]', site), wkLines = $$('.wk-line', worksEl);
  let wkCat = SC.cats[0].id, wkBusy = false;
  wkMenu.innerHTML = SC.cats.map((c, i) => `<button type="button" class="wk-btn${i ? ' is-unread' : ''}" role="tab" aria-selected="${i === 0}" data-wk-cat="${c.id}" data-cursor="OPEN">${esc(c.label)}</button>`).join('');
  const wkCardHTML = (item, i) => {
    const [x, y, w, h] = WK_SLOTS[i].card, [tx, ty] = WK_SLOTS[i].tag;
    const pos = `--x:${x};--y:${y};--w:${w};--h:${h}`;
    if (!item) return `<div class="wk-card is-empty" style="${pos}" data-wk-card><span class="wk-card__soon">敬请期待</span></div>`;
    if (['arrogism', 'horizon', 'cover'].includes(item.layout)) {
      return `<button type="button" class="wk-card wk-card--${item.layout}" style="${pos}" data-wk-card data-index="${i}" data-cursor="OPEN" aria-label="${esc(item.title)}">`
        + `<span class="wk-card__cover"><img src="${esc(item.img)}" alt="" loading="lazy" decoding="async"></span>`
        + (item.logo ? `<span class="wk-card__logo"><img src="${esc(item.logo)}" alt="" loading="lazy" decoding="async"></span>` : '')
        + (item.tags ? `<span class="wk-card__keywords">${item.tags.map(tag => `<span>&lt;${esc(tag)}&gt;</span>`).join('')}</span>` : '')
        + (item.layout === 'cover' ? '' : `<span class="wk-card__subtitle">${esc(item.subtitle)}</span>`) + `</button>`
        + (item.date ? `<span class="wk-tag" style="--x:${tx};--y:${ty}" data-wk-card>${esc(item.date)}</span>` : '');
    }
    return `<button type="button" class="wk-card" style="${pos}" data-wk-card data-index="${i}" data-cursor="OPEN" aria-label="${esc(item.title || '作品 ' + (i + 1))}">`
      + (item.img ? `<img src="${esc(item.img)}" alt="" loading="lazy">` : '')
      + (item.title ? `<span class="wk-card__title">${esc(item.title)}</span>` : '')
      + `</button>` + (item.date ? `<span class="wk-tag" style="--x:${tx};--y:${ty}" data-wk-card>${esc(item.date)}</span>` : '');
  };
  const wkRender = () => {
    const list = SC.items[wkCat] || [];
    wkCards.innerHTML = WK_SLOTS.map((_, i) => wkCardHTML(list[i], i)).join('');
  };
  wkRender();
  wkCards.addEventListener('click', e => {
    const card = e.target.closest('.wk-card[data-index]');
    if (!card) return;
    const item = (SC.items[wkCat] || [])[+card.dataset.index];
    if (item && item.url) {
      if (['arrogism', 'horizon', 'cover'].includes(item.layout)) {
        const frame = document.createElement('iframe');
        frame.title = item.title + ' 作品详情';
        frame.src = item.url + '?embedded=1&v=instant-back-3';
        frame.allow = 'autoplay; fullscreen';
        frame.allowFullscreen = true;
        frame.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:0;background:#000;z-index:2147483647';
        const wasInert = site.inert;
        site.inert = true;
        const closeDetail = event => {
          if (event.source !== frame.contentWindow || (event.data !== 'arrogism:close' && event.data !== 'work:close')) return;
          window.removeEventListener('message', closeDetail);
          frame.remove();
          site.inert = wasInert;
          card.focus({ preventScroll: true });
        };
        window.addEventListener('message', closeDetail);
        document.body.appendChild(frame);
        frame.focus({ preventScroll: true });
      } else window.open(item.url, '_blank', 'noopener');
    }
    else toast('作品整理中，敬请期待');
  });
  // 连线：从起点画到终点（pathLength=1，改 dashoffset）
  const drawLines = (delay = 0) => gsap.fromTo(wkLines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .5, ease: 'power2.out', stagger: .08, delay });
  // 切换分类：旧卡片一格一格闪掉（steps），换内容，新卡片依次闪出来，连线重画
  wkMenu.addEventListener('click', e => {
    const b = e.target.closest('[data-wk-cat]');
    if (!b || b.dataset.wkCat === wkCat || wkBusy) return;
    b.classList.remove('is-unread');
    wkCat = b.dataset.wkCat;
    $$('[data-wk-cat]', wkMenu).forEach(x => x.setAttribute('aria-selected', String(x === b)));
    if (reduce) { wkRender(); return; }
    wkBusy = true;
    gsap.timeline({ onComplete: () => { wkBusy = false; } })
      .to($$('[data-wk-card]', wkCards), { opacity: 0, duration: .18, ease: 'steps(3)', stagger: .04 })
      .set(wkLines, { strokeDashoffset: 1 })
      .add(() => {
        wkRender();
        gsap.fromTo($$('[data-wk-card]', wkCards), { opacity: 0 }, { opacity: 1, duration: .24, ease: 'steps(4)', stagger: .06 });
        drawLines(.15);
      });
  });
  // 底部联系方式复用首页的二维码、邮箱面板与开关逻辑。
  // 星星环：整圈原地慢慢转（SVG 里的 animateTransform），每颗星各自按随机间隔闪：
  // 暗下去或者亮一下，一次一到三下，彼此不同步；系统设置了减少动态时停住不转、不闪
  const wkRing = $('[data-wk-ring]', site);
  if (reduce) { const sp = $('[data-wk-spin]', wkRing); if (sp) sp.parentNode.removeChild(sp); }
  else for (const star of $$('.wk-star', wkRing)) {
    const base = +star.dataset.o;
    const tick = () => {
      let n = 1 + (Math.random() * 3 | 0), t = 0;
      while (n--) {
        const level = Math.random() < .45 ? Math.min(.95, base * 2.6 + .15) : base * Math.random() * .3, on = 50 + Math.random() * 120;
        setTimeout(() => { star.setAttribute('fill-opacity', level.toFixed(2)); }, t);
        setTimeout(() => { star.setAttribute('fill-opacity', base); }, t + on);
        t += on + 40 + Math.random() * 90;
      }
      setTimeout(tick, t + 300 + Math.random() * 2400);
    };
    setTimeout(tick, Math.random() * 2000);
  }
  // 滚到时：标题从左往右擦出并扫一道反光；电脑从左边滑进来，窗口弹出，卡片依次闪出，连线画出来
  const worksHeaderSheen = fillSheen(worksHeader, $('img', worksHeader).getAttribute('src'));
  sheenTargets.push({ host: worksHeader, sheen: worksHeaderSheen });
  let worksShown = false, worksHeaderShown = false;
  function revealWorks(st) {
    const vh = homeScroll.clientHeight;
    if (!worksHeaderShown && worksEl.offsetTop + worksHeader.offsetTop < st + vh * .8) {
      worksHeaderShown = true;
      if (reduce) worksHeader.style.clipPath = 'none';
      else { gsap.to(worksHeader, { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power3.inOut' }); shine(worksHeaderSheen, .9); }
      gsap.to(wkRing, reduce ? { opacity: 1, duration: 0 } : { opacity: 1, duration: .6, ease: 'steps(6)', delay: .2 });
    }
    const u = innerWidth / 1920;
    if (!worksShown && worksEl.offsetTop + 167 * u < st + vh * .85) {
      worksShown = true;
      worksEl.classList.add('is-in');
      if (reduce) { gsap.set(wkLines, { strokeDashoffset: 0 }); return; }
      const pc = $('[data-wk-in="left"]', worksEl), win = $('[data-wk-in="pop"]', worksEl);
      gsap.timeline()
        .fromTo(pc, { x: -80 * u, opacity: 0 }, { x: 0, opacity: 1, duration: .7, ease: 'power3.out' })
        .fromTo(win, { opacity: 0, scale: .96, transformOrigin: '60% 60%' }, { opacity: 1, scale: 1, duration: .45, ease: 'steps(5)' }, .15)
        .fromTo($$('[data-wk-card]', wkCards), { opacity: 0 }, { opacity: 1, duration: .24, ease: 'steps(4)', stagger: .08 }, .5)
        .add(() => drawLines(), .75)
        .fromTo($$('.wk-btn', wkMenu), { opacity: 0 }, { opacity: 1, duration: .2, ease: 'steps(3)', stagger: .12 }, .45);
    }
  }

  /* ---------- 4 关于我：游玩经历窗口 ----------
   * 左侧游戏偏好纯展示；右上角平台按钮只切换选中状态，不筛选卡片；「时长较长 / 游戏库」两个 tab 各一组卡片。
   * 卡片内容在 games-data.js。标题栏右上角的 × 是编辑模式入口（games-data.js 里 editable 为 true、并且在本机预览时才有效）：
   * 可以增删卡片、调整顺序、上传图片并裁成 16:9、填游戏标题和一段文字；「保存到项目」直接写回 games-data.js 和 assets/home/about/games/。 */
  const GD = window.GAMES_DATA || { long: [], lib: [] }, amGames = $('[data-am-games]', site);
  GD.long = GD.long || []; GD.lib = GD.lib || [];
  const amPlats = $('[data-am-plats]', amGames), amCards = $('[data-am-cards]', amGames);
  const PLATS = ['二游', 'Switch', 'Steam', 'Other'];
  let amTab = 'long', amEditing = false, amDirty = false;
  // 游戏偏好：十格红条（纯展示，不响应点击）
  $('[data-am-pref-list]', amGames).innerHTML = C.games.prefs.map(([label, v]) =>
    `<li><b>${esc(label)}</b><span class="am-pref__bars">${Array.from({ length: 10 }, (_, i) => `<i class="${i < v ? 'is-on' : ''}"></i>`).join('')}</span></li>`).join('');
  // 平台按钮：只切换选中状态
  amPlats.innerHTML = PLATS.map((p, i) =>
    `<button type="button" aria-pressed="${i === 0}" class="${i ? '' : 'is-active'}" data-plat="${esc(p)}" data-cursor="SELECT">${esc(p)}</button>`).join('');
  amPlats.addEventListener('click', e => {
    const b = e.target.closest('[data-plat]');
    if (!b) return;
    $$('[data-plat]', amPlats).forEach(x => {
      x.classList.toggle('is-active', x === b);
      x.setAttribute('aria-pressed', String(x === b));
    });
  });
  const amSrc = it => it._url || it.img || '';
  const amView = it => `<article class="am-card"><div class="am-card__cover">${amSrc(it) ? `<img src="${esc(amSrc(it))}" alt="" loading="lazy">` : ''}`
    + `<b class="am-card__title">${esc(it.title || '')}</b></div>${it.desc ? `<p class="am-card__desc">${esc(it.desc)}</p>` : ''}</article>`;
  const amEdit = (it, i, n) => `<article class="am-card is-edit" data-i="${i}"><div class="am-card__cover">`
    + (amSrc(it) ? `<img src="${esc(amSrc(it))}" alt="">` : '')
    + `<button type="button" class="am-card__pick${amSrc(it) ? ' has-img' : ''}" data-act="pick" data-cursor="UPLOAD">${amSrc(it) ? '更换图片' : '+ 上传图片<small>上传后裁成 16:9</small>'}</button>`
    + `<span class="am-card__tools"><button type="button" data-act="left" aria-label="往前移"${i ? '' : ' disabled'}>←</button>`
    + `<button type="button" data-act="right" aria-label="往后移"${i < n - 1 ? '' : ' disabled'}>→</button>`
    + `<button type="button" class="is-del" data-act="del">删除</button></span>`
    + `<input class="am-card__title" data-f="title" value="${esc(it.title || '')}" placeholder="游戏标题" maxlength="20" aria-label="游戏标题"></div>`
    + `<textarea class="am-card__desc" data-f="desc" rows="2" maxlength="60" placeholder="一段文字" aria-label="一段文字">${esc(it.desc || '')}</textarea></article>`;
  const amRender = () => {
    const list = GD[amTab];
    amCards.innerHTML = amEditing
      ? list.map((it, i) => amEdit(it, i, list.length)).join('') + '<button type="button" class="am-card-add" data-act="add" data-cursor="ADD">+ 添加卡片</button>'
      : list.length ? list.map(amView).join('') : '<p class="am-cards__empty">还没有卡片</p>';
  };
  const amRenderKeep = () => { const t = amCards.scrollTop; amRender(); amCards.scrollTop = t; };
  $('[data-am-tabs]', amGames).addEventListener('click', e => {
    const b = e.target.closest('[data-am-tab]');
    if (!b || b.dataset.amTab === amTab) return;
    amTab = b.dataset.amTab;
    $$('[data-am-tab]', amGames).forEach(x => {
      x.classList.toggle('is-active', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    amRender();
    amCards.scrollTop = 0;
  });
  amRender();
  /* 编辑模式：只在 games-data.js 的 editable 为 true、并且在本机打开网页时启用 */
  const amEditable = GD.editable === true && /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
  const amClose = $('.am-games__close', amGames), amBar = $('[data-am-edit]', amGames), amState = $('[data-am-state]', amGames);
  const amStrip = ({ title = '', desc = '', img = '' }) => ({ title, desc, img });
  const amPlain = () => JSON.stringify({ long: GD.long.map(amStrip), lib: GD.lib.map(amStrip) });
  let amSnap = '';
  const amMark = (d = true) => { amDirty = d; amState.textContent = d ? '有未保存的修改' : '已保存'; amBar.classList.toggle('is-dirty', d); };
  function amSetEdit(on) {
    if (on === amEditing) return;
    if (!on && amDirty) {
      if (!confirm('还有没保存的修改，退出后会丢失。确定退出编辑模式吗？')) return;
      [...GD.long, ...GD.lib].forEach(it => it._url && URL.revokeObjectURL(it._url));
      const s = JSON.parse(amSnap); GD.long = s.long; GD.lib = s.lib;
    }
    if (on) amSnap = amPlain();
    amEditing = on;
    amGames.classList.toggle('is-editing', on);
    amClose.setAttribute('aria-pressed', String(on));
    amClose.setAttribute('aria-label', on ? '退出编辑模式' : '进入编辑模式');
    amBar.hidden = !on;
    amMark(false);
    amRender();
  }
  amCards.addEventListener('click', e => {
    const b = amEditing && e.target.closest('[data-act]');
    if (!b) return;
    const list = GD[amTab], card = b.closest('[data-i]'), i = card ? +card.dataset.i : -1, act = b.dataset.act;
    if (act === 'pick') { amPick(i); return; }
    if (act === 'add') {
      list.push({ title: '', desc: '', img: '' });
      amMark(); amRender();
      amCards.scrollTop = amCards.scrollHeight;
      $$('.am-card', amCards).at(-1).querySelector('input').focus({ preventScroll: true });
      return;
    }
    if (act === 'del') {
      if (!confirm(`删除「${list[i].title || '未命名'}」这张卡片？`)) return;
      const [x] = list.splice(i, 1);
      if (x._url) URL.revokeObjectURL(x._url);
    } else {
      const j = i + (act === 'left' ? -1 : 1);
      [list[i], list[j]] = [list[j], list[i]];
    }
    amMark(); amRenderKeep();
  });
  amCards.addEventListener('input', e => {
    const f = e.target.dataset.f, card = e.target.closest('[data-i]');
    if (!f || !card) return;
    GD[amTab][+card.dataset.i][f] = e.target.value;
    amMark();
  });
  // 上传图片 → 裁成 16:9（1280×720 webp）→ 先显示在卡片上，点「保存到项目」才写进文件夹
  const amFile = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
  let amPickI = -1;
  const amPick = i => { amPickI = i; amFile.value = ''; amFile.click(); };
  amFile.addEventListener('change', async () => {
    const f = amFile.files[0];
    if (!f) return;
    const blob = await amCrop(f), it = GD[amTab][amPickI];
    if (!blob || !it) return;
    if (it._url) URL.revokeObjectURL(it._url);
    it._blob = blob;
    it._url = URL.createObjectURL(blob);
    it._name = `game-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
    amMark(); amRenderKeep();
  });
  // 裁切窗口：拖动图片调整位置，滚轮或滑块缩放；确定后输出 1280×720 的 webp
  const amCropDlg = document.createElement('dialog');
  amCropDlg.className = 'am-crop';
  amCropDlg.innerHTML = `<form method="dialog" class="am-crop__card">
    <b class="am-crop__title">裁切图片 · 16:9</b>
    <div class="am-crop__stage" data-crop-stage><img alt="" draggable="false" data-crop-img></div>
    <label class="am-crop__zoom">缩放<input type="range" min="1" max="4" step=".01" value="1" data-crop-zoom></label>
    <p class="am-crop__hint">框内就是卡片上显示的范围。拖动图片调整位置，滚轮或滑块缩放。</p>
    <div class="am-crop__btns"><button value="cancel">取消</button><button value="ok" class="is-main">确定</button></div></form>`;
  document.body.append(amCropDlg);
  const cStage = $('[data-crop-stage]', amCropDlg), cImg = $('[data-crop-img]', amCropDlg), cZoom = $('[data-crop-zoom]', amCropDlg);
  const cs = { w: 0, h: 0, base: 1, z: 1, x: 0, y: 0, W: 0, H: 0 };
  function cApply() {
    const r = cStage.getBoundingClientRect(), s = cs.base * cs.z, iw = cs.w * s, ih = cs.h * s;
    cs.W = r.width; cs.H = r.height;
    cs.x = Math.min(0, Math.max(cs.W - iw, cs.x));
    cs.y = Math.min(0, Math.max(cs.H - ih, cs.y));
    Object.assign(cImg.style, { width: iw + 'px', height: ih + 'px', transform: `translate(${cs.x}px, ${cs.y}px)` });
  }
  function cZoomTo(z, px = cs.W / 2, py = cs.H / 2) {
    const old = cs.base * cs.z;
    cs.z = Math.min(4, Math.max(1, z));
    const k = cs.base * cs.z / old;
    cs.x = px - (px - cs.x) * k;
    cs.y = py - (py - cs.y) * k;
    cZoom.value = cs.z;
    cApply();
  }
  cZoom.addEventListener('input', () => cZoomTo(+cZoom.value));
  cStage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cStage.getBoundingClientRect();
    cZoomTo(cs.z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  let cDrag = null;
  cStage.addEventListener('pointerdown', e => { cDrag = { px: e.clientX, py: e.clientY, x: cs.x, y: cs.y }; cStage.setPointerCapture(e.pointerId); });
  cStage.addEventListener('pointermove', e => {
    if (!cDrag) return;
    cs.x = cDrag.x + e.clientX - cDrag.px;
    cs.y = cDrag.y + e.clientY - cDrag.py;
    cApply();
  });
  ['pointerup', 'pointercancel'].forEach(t => cStage.addEventListener(t, () => { cDrag = null; }));
  function amCrop(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      cImg.onerror = () => { URL.revokeObjectURL(url); toast('这张图片读不出来，换一张试试'); resolve(null); };
      cImg.onload = () => {
        amCropDlg.returnValue = '';
        amCropDlg.showModal();
        const r = cStage.getBoundingClientRect();
        cs.w = cImg.naturalWidth; cs.h = cImg.naturalHeight;
        cs.base = Math.max(r.width / cs.w, r.height / cs.h); cs.z = 1; cZoom.value = 1;
        cs.x = (r.width - cs.w * cs.base) / 2; cs.y = (r.height - cs.h * cs.base) / 2;
        cApply();
      };
      amCropDlg.onclose = () => {
        if (amCropDlg.returnValue !== 'ok') { URL.revokeObjectURL(url); resolve(null); return; }
        const s = cs.base * cs.z, cv = document.createElement('canvas');
        cv.width = 1280; cv.height = 720;
        const ctx = cv.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cImg, -cs.x / s, -cs.y / s, cs.W / s, cs.H / s, 0, 0, 1280, 720);
        URL.revokeObjectURL(url);
        cv.toBlob(b => resolve(b), 'image/webp', .9);
      };
      cImg.src = url;
    });
  }
  // 保存到项目：用浏览器的文件夹写入功能（Chrome / Edge），第一次保存时选一次网站根文件夹（有 index.html 的那个）。
  // 图片写进 assets/home/about/games/，卡片内容写回 src/js/games-data.js。浏览器不支持时改为下载这些文件，手动放进对应文件夹。
  let amDir = null;
  const amDl = (name, blob) => {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  async function amWrite(dir, name, data) {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(data); await w.close();
  }
  async function amSave() {
    const files = [];
    for (const k of ['long', 'lib']) for (const it of GD[k]) if (it._blob) files.push([it._name, it._blob, it]);
    const data = { editable: GD.editable, long: [], lib: [] };
    for (const k of ['long', 'lib']) for (const it of GD[k]) {
      const out = amStrip(it);
      if (it._blob) out.img = `./assets/home/about/games/${it._name}`;
      data[k].push(out);
    }
    const js = '/* 首页「4 关于我 → 游玩经历」的卡片：由网页上的编辑模式自动生成，也可以直接手改。\n'
      + ' * long「时长较长」、lib「游戏库」，每张卡片：title 游戏标题；desc 一段文字（两行以内）；img 16:9 图片路径，留空显示灰色占位。\n'
      + ' * editable：为 true 时，在本机打开网页、点游玩经历窗口右上角的 × 进入编辑模式；内容定稿后改成 false 关掉入口。 */\n'
      + `window.GAMES_DATA = ${JSON.stringify(data, null, 2)};\n`;
    const done = () => {
      for (const [, , it] of files) { it.img = `./assets/home/about/games/${it._name}`; delete it._blob; }
      amSnap = amPlain();
      amMark(false);
    };
    if (!window.showDirectoryPicker) {
      files.forEach(([n, b]) => amDl(n, b));
      amDl('games-data.js', new Blob([js], { type: 'text/javascript' }));
      done();
      toast('已下载：games-data.js 放进 src/js/，图片放进 assets/home/about/games/');
      return;
    }
    try {
      if (!amDir) {
        const d = await showDirectoryPicker({ id: 'portfolio-root', mode: 'readwrite' });
        try { await d.getFileHandle('index.html'); await (await d.getDirectoryHandle('src')).getDirectoryHandle('js'); }
        catch { toast('请选网站的根文件夹：里面有 index.html 和 src 的那个'); return; }
        amDir = d;
      }
      if (await amDir.requestPermission({ mode: 'readwrite' }) !== 'granted') { toast('没有拿到写入权限，没有保存'); return; }
      amSaveBtn.disabled = true;
      amState.textContent = '保存中…';
      let g = amDir;
      for (const p of ['assets', 'home', 'about', 'games']) g = await g.getDirectoryHandle(p, { create: true });
      for (const [n, b] of files) await amWrite(g, n, b);
      await amWrite(await (await amDir.getDirectoryHandle('src')).getDirectoryHandle('js'), 'games-data.js', js);
      done();
      toast(`已保存到项目${files.length ? `（新图片 ${files.length} 张）` : ''}`);
    } catch (err) {
      if (err.name !== 'AbortError') { console.error(err); toast(`保存失败：${err.message}`); }
      amMark(amDirty);
    } finally { amSaveBtn.disabled = false; }
  }
  const amSaveBtn = $('[data-am-save]', amGames);
  amSaveBtn.addEventListener('click', amSave);
  $('[data-am-exit]', amGames).addEventListener('click', () => amSetEdit(false));
  if (amEditable) {
    amClose.addEventListener('click', () => amSetEdit(!amEditing));
    amGames.classList.add('is-editable');
  } else {
    amClose.disabled = true;
    amClose.tabIndex = -1;
    amClose.setAttribute('aria-hidden', 'true');
  }
  addEventListener('beforeunload', e => { if (amEditing && amDirty) e.preventDefault(); });


  /* ---------- Experiences 飞鸟：点一下，标签先变清晰，飞鸟沿设计稿里画的路径飞走，镜头跟着往下，飞出画面后停在「个人经历」 ---------- */
  // 路径：Figma Vector 22 + Vector 23（设计稿整页坐标，起点在飞鸟脚下）
  const FLIGHT_PATH = 'M 1544.9 2640.8 C 1527.9 2645.9 1511.4 2653.7 1476.8 2673.3 C 1405.1 2714.1 1350.5 2740.6 1332.5 2752.1 C 1280.1 2785.9 1233.7 2806.7 1204.2 2821.9 C 1186.2 2831.2 1166.4 2843.0 1143.2 2856.3 C 1123.9 2867.3 1099.3 2881.6 1073.5 2894.1 C 1026.5 2916.9 989.2 2936.7 953.5 2954.4 C 944.3 2958.9 935.0 2965.1 897.8 2981.3 C 860.6 2997.6 795.9 3024.0 751.9 3043.2 C 707.9 3062.3 686.6 3073.4 632.6 3095.7 C 578.6 3118.0 492.6 3151.2 446.1 3169.6 C 385.1 3193.8 368.7 3206.1 362.2 3221.1 C 354.9 3237.9 384.9 3255.9 400.4 3268.5 C 414.0 3279.4 434.8 3294.7 455.5 3305.0 C 474.5 3314.6 499.3 3328.2 530.8 3342.4 C 550.6 3351.4 565.6 3360.9 588.8 3374.3 C 610.6 3386.8 636.9 3405.6 666.2 3429.7 C 716.8 3471.4 747.1 3486.5 765.3 3504.2 C 777.2 3515.8 791.9 3527.0 817.2 3549.2 C 867.4 3593.5 912.4 3628.5 934.2 3647.4 C 974.9 3682.5 996.7 3699.9 1075.8 3763.2 C 1125.6 3803.1 1217.0 3868.2 1267.3 3904.1 C 1324.4 3944.8 1351.1 3959.7 1399.9 3990.2 C 1526.8 4055.4 1552.5 4065.7 1570.6 4071.3 C 1575.0 4072.6 1579.2 4074.3 1586.2 4076.0 C 1588.5 4084 1588.4 4096 1585.8 4101.4 C 1585.4 4106.1 1582 4110.4 1560.7 4112.6 C 1539.4 4114.8 1500.2 4114.8 1459.8 4114.8';
  const BIRD = { x: 1422, y: 2454, w: 263 }; // Experiences 飞鸟在整页里的位置（设计稿像素）
  const flightLayer = $('[data-flight-layer]', site), expBird = $('[data-bird="exp"]', site);
  let flightOn = false;
  const flightSamples = (() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('d', FLIGHT_PATH);
    const L = svg.getTotalLength(), N = 700, pts = [];
    for (let i = 0; i <= N; i++) { const p = svg.getPointAtLength(L * i / N); pts.push([p.x, p.y]); }
    return { L, N, pts };
  })();
  function pathAt(s) {
    const { L, N, pts } = flightSamples;
    const f = Math.max(0, Math.min(1, s / L)) * N, i = Math.min(N - 1, Math.floor(f)), k = f - i;
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
    return { x: x0 + dx * k, y: y0 + dy * k, tx: dx / d, ty: dy / d };
  }

  function flyExpBird() {
    if (flightOn) return;
    // 鸟已经飞走过：再点 Experiences 标签就直接滚到「个人经历」
    if (expBird.style.visibility === 'hidden') { gsap.to(homeScroll, { scrollTop: expEl.offsetTop, duration: reduce ? 0 : 1.2, ease: 'power2.inOut' }); return; }
    if (reduce) { homeScroll.scrollTop = expEl.offsetTop; return; }
    flightOn = true;
    closeInfo();
    // 1. 模糊消失：Experiences 标签变清晰
    $('[data-tab="exp"]', site).setAttribute('aria-pressed', 'true');
    const u0 = innerWidth / 1920;
    const bird = document.createElement('i');
    bird.className = 'bird-fly';
    flightLayer.append(bird);

    const st = { t: 0, s: 0, v: 0, ang: 0, sx: 1, frame: 0, flapT: 0, glide: false, modeT: 0, phase: 'wait', exitV: null, ex: 0, ey: 0, cam: homeScroll.scrollTop, follow: true };
    const stopFollow = () => { st.follow = false; };
    addEventListener('wheel', stopFollow, { once: true, passive: true });
    addEventListener('touchstart', stopFollow, { once: true, passive: true });

    const center = { x: BIRD.x + BIRD.w / 2, y: BIRD.y + BIRD.w / 2 };
    let last = performance.now();
    function draw(px, py, ang, sx, sy) {
      const u = innerWidth / 1920, w = BIRD.w * u;
      bird.style.width = bird.style.height = `${w}px`;
      bird.style.backgroundPosition = `${(st.frame / 7) * 100}% 0`;
      bird.style.transform = `translate3d(${px * u - w / 2}px, ${py * u - homeScroll.scrollTop - w / 2}px, 0) rotate(${ang}rad) scale(${sx}, ${sy})`;
    }
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000); last = now; st.t += dt;
      const u = innerWidth / 1920;
      let px, py, sy = 1;
      if (st.phase === 'wait') {
        // 标签变清晰的那 0.3 秒，飞鸟还在原地扑翅
        st.frame = Math.floor(st.t * 12) % 8;
        px = center.x; py = center.y;
        if (st.t > .32) { st.phase = 'crouch'; st.t = 0; expBird.style.visibility = 'hidden'; }
      } else if (st.phase === 'crouch') {
        // 2. 起飞前往下一蹲，翅膀收起
        st.frame = 6;
        px = center.x; py = center.y + Math.sin(Math.min(1, st.t / .18) * Math.PI) * 10;
        sy = 1 - Math.sin(Math.min(1, st.t / .18) * Math.PI) * .08;
        if (st.t > .18) { st.phase = 'fly'; st.t = 0; st.v = 380; }
      } else if (st.phase === 'fly') {
        // 3. 沿路径飞：下坡时滑翔加速，平飞/爬升时扑翅，速度忽快忽慢；身体随扑翅上下起伏
        const p = pathAt(st.s);
        st.modeT -= dt;
        if (st.modeT <= 0) { st.glide = p.ty > .25 && Math.random() < .6; st.modeT = st.glide ? .35 + Math.random() * .45 : .5 + Math.random() * .6; }
        const target = (st.glide ? 820 : 900) + 260 * Math.max(0, p.ty) - 200 * Math.max(0, -p.ty) + 120 * Math.sin(st.t * 2.3);
        st.v += (target - st.v) * Math.min(1, dt * (st.t < .6 ? 3 : 1.6));
        st.s += st.v * dt;
        if (st.glide) st.frame = 7;
        else { st.flapT += dt * 15; st.frame = Math.floor(st.flapT) % 8; }
        const bob = st.glide ? 0 : Math.sin(st.flapT / 8 * Math.PI * 2) * 5;
        px = p.x - p.ty * bob; py = p.y + p.tx * bob;
        // 起飞后的前 0.45 秒从原位平滑并入路径
        const k = Math.min(1, st.t / .45), e = k * k * (3 - 2 * k);
        px = center.x + (px - center.x) * e; py = center.y + (py - center.y) * e;
        steer(p.tx, p.ty, dt);
        if (st.s >= flightSamples.L) { st.phase = 'exit'; st.t = 0; st.ex = p.x; st.ey = p.y; st.exitV = [p.tx, p.ty]; }
      } else {
        // 4. 路径走完：顺着最后的方向扑翅加速，直到整只飞出画面
        st.v *= 1 + dt * 1.2;
        st.ex += st.exitV[0] * st.v * dt; st.ey += st.exitV[1] * st.v * dt;
        st.flapT += dt * 17; st.frame = Math.floor(st.flapT) % 8;
        px = st.ex; py = st.ey;
        steer(st.exitV[0], st.exitV[1], dt);
        const sx = px * u, sy2 = py * u - homeScroll.scrollTop, m = BIRD.w * u;
        if (sx < -m || sx > innerWidth + m || sy2 < -m || sy2 > homeScroll.clientHeight + m) return land();
      }
      // 镜头：慢慢跟着往下，尽量让飞鸟在屏幕垂直方向的中间（自己滚动鼠标就不再跟）
      if (st.follow && st.phase !== 'wait') {
        const max = homeScroll.scrollHeight - homeScroll.clientHeight;
        const want = Math.max(0, Math.min(max, py * u - homeScroll.clientHeight / 2));
        st.cam += (want - st.cam) * Math.min(1, dt * 1.8);
        homeScroll.scrollTop = st.cam;
      }
      const speedK = 1 + Math.min(.08, Math.max(0, (st.v - 800) / 4000));
      draw(px, py, st.ang, st.sx * speedK, sy);
      requestAnimationFrame(frame);
    }
    // 朝向：贴图里的鸟头朝左。往右飞时水平翻转（经过 0 时像侧身转弯），机头跟着路径方向，转得平滑
    function steer(tx, ty, dt) {
      const wantSx = tx > .05 ? -1 : tx < -.05 ? 1 : st.sx;
      st.sx += (wantSx - st.sx) * Math.min(1, dt * 7);
      let a = wantSx > 0 ? Math.atan2(-ty, -tx) : Math.atan2(ty, tx);
      a = Math.max(-.75, Math.min(.75, a)) * (wantSx > 0 ? -1 : 1);
      st.ang += (a - st.ang) * Math.min(1, dt * 5);
    }
    // 5. 飞走后：镜头就停在下面的「个人经历」，不回到上面；原位的飞鸟这次就不在了（重新进入首页才回来）
    function land() {
      bird.remove();
      removeEventListener('wheel', stopFollow); removeEventListener('touchstart', stopFollow);
      flightOn = false;
    }
    draw(center.x, center.y, 0, 1, 1);
    requestAnimationFrame(frame);
  }


  infoEl.addEventListener('click', e => { if (!e.target.closest('.ip-box, [data-bird], [data-tab]')) closeInfo(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && route === 'home') closeInfo(); });

  // 进场：接着爆炸——球从小逐渐长大，标题从左往右擦出，竖线画下来，信息和图标依次出现
  function enterHome() {
    if (window.HomeScene) HomeScene.start();
    resetBalloons();
    expBird.style.visibility = '';
    onHomeScroll();
    drawRocket();
    if (reduce) return;
    gsap.fromTo(orbEl, { scale: .15, opacity: 0 }, { scale: 1, opacity: 1, duration: 2.2, delay: .75, ease: 'power2.out', overwrite: 'auto' });
    gsap.fromTo(titleEl, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.1, ease: 'power3.inOut', delay: .35 });
    shine(titleSheen, 1.5);
    gsap.fromTo($$('.hero-line', site), { scaleY: 0 }, { scaleY: 1, duration: .9, ease: 'power3.out', stagger: .1, delay: .6 });
    gsap.fromTo($$('.hero-info, .hero-social > *', site), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power3.out', stagger: .08, delay: .8 });
    // 「滑动以查看更多内容」黑条从左往右展开
    gsap.fromTo($('.scroll-hint', site), { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .8, ease: 'power3.inOut', delay: 1.1 });
  }

  /* ---------- 路由与转场 ---------- */

  let route = '', busy = false, pending = null;
  const parse = () => {
    const [r, layer] = location.hash.replace(/^#\/?/, '').split('/');
    return [['home', 'works', 'resume'].includes(r) ? r : 'home', layer || ''];
  };

  // 红带从左下扫到右上，正好铺满整屏的那一刻切换页面
  const BAND = 320;
  const band = (a, b) => `polygon(0% ${100 - b}%, ${b}% 100%, ${a}% 100%, 0% ${100 - a}%)`;
  function sweep(onCovered) {
    const wrap = $('.sweep'), red = $('.sweep__band'), [l1, l2] = $$('.sweep__line');
    $('.sweep__cover').style.clipPath = 'polygon(0 0, 0 0, 0 0)';
    wrap.style.display = 'block';
    const s = { k: 0 };
    const draw = () => {
      red.style.clipPath = band(s.k - BAND, s.k);
      l1.style.clipPath = band(s.k - 30, s.k - 22);
      l2.style.clipPath = band(s.k - BAND + 12, s.k - BAND + 26);
    };
    busy = true;
    gsap.timeline({ onComplete: () => {
      wrap.style.display = 'none';
      busy = false;
      if (pending) { const p = pending; pending = null; navigate(...p); }
    } })
      .to(s, { k: 215, duration: .34, ease: 'power3.in', onUpdate: draw })
      .add(onCovered)
      .to(s, { k: 200 + BAND + 40, duration: .42, ease: 'power3.out', onUpdate: draw });
  }

  function show(r, layer) {
    route = r;
    site.dataset.route = r;
    $$('.page', site).forEach(p => p.classList.toggle('is-active', p.dataset.page === r));
    $$('[data-route]', site).forEach(a => a.classList.toggle('is-active', a.dataset.route === (r === 'resume' && layer === 'contact' ? 'contact' : r)));
    if (r !== 'home') {
      for (const [qx, qy] of par) { qx(0); qy(0); }
    }

    if (r === 'home') enterHome();
    if (r === 'works') {
      scramble($('.works__title b', site), '作品集', .5);
      gsap.fromTo($$('.work:not(.is-hidden)', site), { y: 50, opacity: 0, rotateX: -14 }, { y: 0, opacity: 1, rotateX: 0, duration: .9, ease: 'power3.out', stagger: .07, delay: .1 });
    }
    if (r === 'resume') {
      scramble($('.rz-title b', site), '简历', .5);
      gsap.fromTo($$('.rz-nav li', site), { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: .7, ease: 'power3.out', stagger: .06 });
      const idx = Math.max(0, LAYERS.findIndex(L => L.id === layer));
      const target = $$('.rz-layer', site)[idx];
      rzScroll.style.scrollBehavior = 'auto';
      rzScroll.scrollTop = target.offsetTop;
      rzScroll.style.scrollBehavior = '';
      activate(idx);
    }
  }

  function navigate(r, layer, instant) {
    if (busy) { pending = [r, layer]; return; }
    if (r === route) {
      if (r === 'resume' && layer) goLayer(LAYERS.findIndex(L => L.id === layer));
      return;
    }
    if (instant || reduce) show(r, layer);
    else sweep(() => show(r, layer));
  }
  addEventListener('hashchange', () => navigate(...parse()));

  // 提前把网站本体排好版、把图片解码好（还看不见），这样爆炸结束切到首页的那一刻不会卡一下
  let prepared = false;
  function prepare() {
    if (prepared) return;
    prepared = true;
    site.style.visibility = 'hidden';
    site.dataset.route = parse()[0]; // 先标好路由，免得显示时导航上的过渡（比如首页隐藏左上角标志）再播一遍
    site.hidden = false;
    void site.offsetHeight;
    $$('img', site).forEach(img => img.decode && img.decode().catch(() => {}));
  }

  window.Site = {
    prepare,
    restorePortfolio() {
      let saved = null;
      try { saved = JSON.parse(sessionStorage.getItem('portfolioReturn')); sessionStorage.removeItem('portfolioReturn'); } catch (_) {}
      prepare();
      site.style.visibility = '';
      if (saved && SC.items[saved.category]) {
        wkCat = saved.category;
        wkRender();
        $$('[data-wk-cat]', wkMenu).forEach(b => b.setAttribute('aria-selected', String(b.dataset.wkCat === wkCat)));
      }
      navigate('home', undefined, true);
      gsap.set(site, { opacity: 1 });
      homeScroll.scrollTop = saved && Number.isFinite(saved.top) ? saved.top : worksEl.offsetTop;
      onHomeScroll();
    },
    enter() {
      prepare();
      site.style.visibility = '';
      navigate(...parse(), true);
      gsap.from($$('.nav > *', site), { y: -20, opacity: 0, duration: .8, ease: 'power3.out', stagger: .1, delay: .4 });
    },
  };
})();
