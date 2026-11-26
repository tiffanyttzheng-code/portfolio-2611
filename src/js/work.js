// 作品详情页通用脚本：目录跳转、滚动时高亮当前段落、返回按钮
const navButtons = [...document.querySelectorAll('[data-target]')];
const anchors = navButtons.map(b => document.getElementById(b.dataset.target));
// 当前项的红底指示条：跟着当前按钮的位置和尺寸滑动
const navEl = document.querySelector('nav');
const ind = document.createElement('i');
ind.className = 'nav__ind is-instant';
ind.setAttribute('aria-hidden', 'true');
navEl.appendChild(ind);
const placeInd = () => {
  const b = navEl.querySelector('[aria-current=true]');
  if (!b) return;
  ind.style.width = b.offsetWidth + 'px';
  ind.style.height = b.offsetHeight + 'px';
  ind.style.transform = `translate(${b.offsetLeft}px,${b.offsetTop}px)`;
};
placeInd();
requestAnimationFrame(() => requestAnimationFrame(() => ind.classList.remove('is-instant')));
addEventListener('resize', () => { ind.classList.add('is-instant'); placeInd(); requestAnimationFrame(() => ind.classList.remove('is-instant')); });
const setCurrent = button => { navButtons.forEach(b => b.setAttribute('aria-current', String(b === button))); placeInd(); };
// 点击目录：指示条直接滑到目标项；平滑滚动的过程中不让滚动高亮插手，避免一路闪过中间的项
let lockUntil = 0, unlockTimer = 0;
const unlock = () => { lockUntil = 0; clearTimeout(unlockTimer); };
addEventListener('scrollend', unlock);
navButtons.forEach(button => button.addEventListener('click', () => {
  setCurrent(button);
  lockUntil = Infinity;
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(unlock, 1600);
  document.getElementById(button.dataset.target).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}));
// 用户自己滚动（滚轮、触摸、键盘）时立刻解锁
['wheel', 'touchstart', 'keydown'].forEach(t => addEventListener(t, unlock, { passive: true }));
// 滚动高亮：取顶部已经越过视口 35% 的最后一个锚点页；还没到第一个锚点时高亮第一个
let ticking = false;
addEventListener('scroll', () => {
  if (ticking || lockUntil) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (lockUntil) return;
    const line = innerHeight * .35;
    let idx = 0;
    anchors.forEach((el, i) => { if (el.getBoundingClientRect().top <= line) idx = i; });
    if (navButtons[idx] && navButtons[idx].getAttribute('aria-current') !== 'true') setCurrent(navButtons[idx]);
  });
}, { passive: true });
document.querySelector('.back').addEventListener('click', event => {
  event.preventDefault();
  if (window.parent !== window) { window.parent.postMessage('work:close', '*'); return; }
  if (history.length > 1) history.back();
  else location.replace('./index.html?return=portfolio#/home');
});

// 演示视频：点击封面后，在原位置加载对应分P的 B 站播放器并自动播放
document.querySelectorAll('.vs-frame').forEach(frame => {
  const cover = frame.querySelector('.vs-cover');
  if (!cover) return;
  cover.addEventListener('click', () => {
    const iframe = document.createElement('iframe');
    iframe.src = 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(frame.dataset.bvid) + '&p=' + encodeURIComponent(frame.dataset.page || '1') + '&autoplay=1&high_quality=1&danmaku=0';
    iframe.title = cover.getAttribute('aria-label');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    frame.replaceChildren(iframe);
  });
});

// 底图切换：上一张留在下面（is-prev）直到新图渐显完成，避免整页闪一下
const swapBase = (list, isOn) => {
  const prev = list.find(i => i.classList.contains('is-on'));
  const next = list.find(isOn);
  if (!next || prev === next) return;
  list.forEach(i => { clearTimeout(i._prevT); i.classList.remove('is-prev'); });
  if (prev) { prev.classList.add('is-prev'); prev._prevT = setTimeout(() => prev.classList.remove('is-prev'), 560); }
  list.forEach(i => i.classList.toggle('is-on', i === next));
};

// 剧情系统 tab：点 AVG 树里的四项切换整张状态图；方向键在 tab 之间移动；入口页可切演示1/2；前景/背景页右下 › 进入下一项
document.querySelectorAll('.story').forEach(story => {
  const tabs = [...story.querySelectorAll('[data-st-tab]')];
  const imgs = [...story.querySelectorAll('[data-st-img]')];
  const shots = [...story.querySelectorAll('[data-st-shot]')];
  // 第一次切到某个 tab 之前先把四张图都请求下来，切换时不会出现空白
  const warm = () => [...imgs, ...shots].forEach(i => { i.loading = 'eager'; });
  story.addEventListener('pointerenter', warm, { once: true });
  story.addEventListener('focusin', warm, { once: true });
  const select = (key, focus) => {
    story.dataset.tab = key;
    tabs.forEach(t => { const on = t.dataset.stTab === key; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    swapBase(imgs, i => i.dataset.stImg === key);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.stTab));
    t.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); select(tabs[e.key === 'Home' ? 0 : tabs.length - 1].dataset.stTab, true); return; }
      if (!d) return;
      e.preventDefault();
      select(tabs[(i + d + tabs.length) % tabs.length].dataset.stTab, true);
    });
  });
  story.querySelector('.st-next').addEventListener('click', () => {
    const i = tabs.findIndex(t => t.dataset.stTab === story.dataset.tab);
    select(tabs[(i + 1) % tabs.length].dataset.stTab);
  });
  // 演示切换：每个 tab 自己的一组按钮和截图（data-st-for 对应 tab），互不影响
  story.querySelectorAll('[data-st-demo]').forEach(p => p.addEventListener('click', () => {
    const g = p.dataset.stFor;
    story.querySelectorAll(`[data-st-shot][data-st-for="${g}"]`).forEach(i => i.classList.toggle('is-on', i.dataset.stShot === p.dataset.stDemo));
    story.querySelectorAll(`[data-st-demo][data-st-for="${g}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === p)));
  }));
  select(tabs[0].dataset.stTab);
});

// 图鉴系统：左侧三个分区按钮切换底图（按钮位置随之移动）；下方胶囊切换该分区的画面，各分区记住自己的选择
document.querySelectorAll('.zukan').forEach(z => {
  const secs = [...z.querySelectorAll('[data-zk-sec]')];
  const warm = () => z.querySelectorAll('img').forEach(i => { i.loading = 'eager'; });
  z.addEventListener('pointerenter', warm, { once: true });
  z.addEventListener('focusin', warm, { once: true });
  const pick = (k, focus) => {
    z.dataset.sec = k;
    secs.forEach(b => { const on = b.dataset.zkSec === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    swapBase([...z.querySelectorAll('[data-zk-base]')], i => i.dataset.zkBase === k);
  };
  secs.forEach((b, i) => {
    b.addEventListener('click', () => pick(b.dataset.zkSec));
    b.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      pick(secs[(i + d + secs.length) % secs.length].dataset.zkSec, true);
    });
  });
  z.querySelectorAll('[data-zk-view]').forEach(p => p.addEventListener('click', () => {
    const g = p.dataset.zkFor;
    z.querySelectorAll(`[data-zk-shot][data-zk-for="${g}"]`).forEach(i => i.classList.toggle('is-on', i.dataset.zkShot === p.dataset.zkView));
    z.querySelectorAll(`[data-zk-view][data-zk-for="${g}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === p)));
  }));
  pick('a');
});

// 原型图放大：点击画面热区，图片从原位置放大到屏幕中央，背景压黑模糊，下方白字显示画面说明；
// 左右箭头（或 ← →）切换到同组上一个 / 下一个演示画面，并同步页面上的胶囊按钮；点背景 / 图片 / Esc 收回原位
(() => {
  const hits = document.querySelectorAll('.zoom-hit');
  if (!hits.length) return;
  const BLOCKS = '.story,.zukan,.ed-stage,.map-stage,.fx-car,.fx-one,.cte-screenshot';
  const z = document.createElement('div');
  z.className = 'zoom';
  z.tabIndex = -1;
  z.setAttribute('role', 'dialog');
  z.setAttribute('aria-modal', 'true');
  z.setAttribute('aria-label', '原型图预览');
  z.innerHTML = '<div class="zoom__bg"></div><img class="zoom__img" alt=""><p class="zoom__cap"></p>'
    + '<button class="zoom__nav zoom__nav--prev" type="button" aria-label="上一张"></button>'
    + '<button class="zoom__nav zoom__nav--next" type="button" aria-label="下一张"></button>';
  document.body.appendChild(z);
  const img = z.querySelector('.zoom__img'), cap = z.querySelector('.zoom__cap'), bg = z.querySelector('.zoom__bg');
  const prev = z.querySelector('.zoom__nav--prev'), next = z.querySelector('.zoom__nav--next');
  let src = null, opener = null, block = null, busy = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 目标尺寸：宽最多 82vw，高最多 80vh（给说明留位置），按图片比例
  const target = (w, h) => {
    const s = Math.min(innerWidth * .819 / w, (innerHeight * .798 - 52) / h);
    const W = w * s, H = h * s;
    return { x: (innerWidth - W) / 2, y: (innerHeight - H - 40) / 2, W, H };
  };
  const fromRect = (r, t) => `translate(${r.left}px,${r.top}px) scale(${r.width / t.W},${r.height / t.H})`;
  const current = el => el.classList.contains('story')
    ? el.querySelector(`.st-demo.is-on[data-st-for="${el.dataset.tab}"]`)
    : el.classList.contains('zukan')
      ? el.querySelector(`.zk-shot.is-on[data-zk-for="${el.dataset.sec}"]`)
      : el.classList.contains('map-stage')
        ? el.querySelector('.map-shot:not([hidden])')
        : el.classList.contains('fx-car')
          ? el.querySelector('.fx-slide.is-on')
          : el.querySelector('.zoom-src');
  // 同组的胶囊按钮（决定上一张 / 下一张）
  const pills = el => [...(el.classList.contains('story')
    ? el.querySelectorAll(`.st-pill[data-st-for="${el.dataset.tab}"]`)
    : el.classList.contains('zukan')
      ? el.querySelectorAll(`.zk-pill[data-zk-for="${el.dataset.sec}"]`)
      : el.querySelectorAll('[data-map-pick],[data-fx-pick]'))];
  const place = t => {
    Object.assign(cap.style, { left: t.x + 'px', top: t.y + t.H + 14 + 'px', width: t.W + 'px' });
    const mid = t.y + t.H / 2 + 'px';
    Object.assign(prev.style, { left: Math.max(8, t.x - 74) + 'px', top: mid });
    Object.assign(next.style, { left: Math.min(innerWidth - 60, t.x + t.W + 22) + 'px', top: mid });
  };
  const navOn = () => { const n = pills(block).length > 1; prev.hidden = next.hidden = !n; };
  const open = (el, btn) => {
    if (busy || !el) return;
    src = el; opener = btn; block = btn.closest(BLOCKS);
    const r = el.getBoundingClientRect(), t = target(r.width, r.height);
    img.src = el.currentSrc || el.src;
    img.alt = el.alt;
    Object.assign(img.style, { width: t.W + 'px', height: t.H + 'px', transition: 'none', transform: fromRect(r, t) });
    place(t);
    navOn();
    cap.textContent = el.dataset.cap || el.alt;
    el.style.visibility = 'hidden';
    document.documentElement.classList.add('is-zoomed');
    z.classList.add('is-open');
    img.getBoundingClientRect();
    img.style.transition = '';
    img.style.transform = `translate(${t.x}px,${t.y}px)`;
    z.classList.add('is-shown');
    z.focus({ preventScroll: true });
  };
  const step = d => {
    if (busy || !z.classList.contains('is-open')) return;
    const list = pills(block);
    if (list.length < 2) return;
    const i = Math.max(0, list.findIndex(p => p.getAttribute('aria-pressed') === 'true'));
    list[(i + d + list.length) % list.length].click();
    const el = current(block);
    if (!el || el === src) return;
    src.style.visibility = '';
    src = el;
    el.style.visibility = 'hidden';
    el.loading = 'eager';
    const r = el.getBoundingClientRect(), t = target(r.width, r.height);
    img.style.transition = 'none';
    img.src = el.currentSrc || el.src;
    img.alt = el.alt;
    Object.assign(img.style, { width: t.W + 'px', height: t.H + 'px', transform: `translate(${t.x}px,${t.y}px)` });
    place(t);
    cap.textContent = el.dataset.cap || el.alt;
    img.animate?.([{ opacity: .35 }, { opacity: 1 }], { duration: reduce ? 0 : 220, easing: 'ease-out' });
  };
  const shut = () => {
    if (!z.classList.contains('is-open') || busy) return;
    busy = true;
    const r = src.getBoundingClientRect(), t = { W: parseFloat(img.style.width), H: parseFloat(img.style.height) };
    z.classList.remove('is-shown');
    img.style.transition = '';
    img.style.transform = fromRect(r, t);
    bg.style.opacity = '0';
    const done = () => {
      src.style.visibility = '';
      z.classList.remove('is-open');
      bg.style.opacity = '';
      document.documentElement.classList.remove('is-zoomed');
      if (opener) opener.focus({ preventScroll: true });
      busy = false;
    };
    reduce ? done() : setTimeout(done, 480);
  };
  hits.forEach(b => b.addEventListener('click', () => open(current(b.closest(BLOCKS)), b)));
  bg.addEventListener('click', shut);
  img.addEventListener('click', shut);
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  addEventListener('keydown', e => {
    if (!z.classList.contains('is-open')) return;
    if (e.key === 'Escape') shut();
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'Tab') {
      const f = [prev, next].filter(x => !x.hidden);
      e.preventDefault();
      if (f.length) (f[(f.indexOf(document.activeElement) + 1) % f.length]).focus();
    }
  });
  addEventListener('resize', () => {
    if (!z.classList.contains('is-open') || busy) return;
    const r = src.getBoundingClientRect(), t = target(r.width, r.height);
    Object.assign(img.style, { width: t.W + 'px', height: t.H + 'px', transition: 'none', transform: `translate(${t.x}px,${t.y}px)` });
    place(t);
  });
})();

// 回忆：底部胶囊切换右侧画面；旧画面留在下面直到新画面渐显完成
document.querySelectorAll('.sw').forEach(sw => {
  const shots = [...sw.querySelectorAll('[data-sw-shot]')];
  const warm = () => shots.forEach(i => { i.loading = 'eager'; });
  sw.addEventListener('pointerenter', warm, { once: true });
  sw.addEventListener('focusin', warm, { once: true });
  sw.querySelectorAll('[data-sw-view]').forEach(p => p.addEventListener('click', () => {
    swapBase(shots, i => i.dataset.swShot === p.dataset.swView);
    sw.querySelectorAll('[data-sw-view]').forEach(x => x.setAttribute('aria-pressed', String(x === p)));
  }));
});


/* 自负 系统概述：「游戏系统概述 / 设计思考」切换。两个 tab 位置顺序不变，只切换选中形态；选「设计思考」时卡片从左侧滑出 */
document.querySelectorAll('[data-sx]').forEach(stage => {
  const tabs = [...stage.querySelectorAll('[data-sx-tab]')];
  const panels = [...stage.querySelectorAll('[data-sx-panel]')];
  const dot = stage.querySelector('.sx-tab__dot');
  const SEEN = 'arr-portfolio-thinking-seen' + (stage.dataset.sx ? '-' + stage.dataset.sx : '');
  let seen = false;
  try { seen = !!localStorage.getItem(SEEN); } catch (e) {}
  if (seen && dot) dot.classList.add('is-seen');
  const select = (tab, focus) => {
    const key = tab.dataset.sxTab;
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(p => { const on = p.dataset.sxPanel === key; p.classList.toggle('is-on', on); p.setAttribute('aria-hidden', String(!on)); });
    if (focus) tab.focus();
    if (key === 'thinking' && dot) { dot.classList.add('is-seen'); try { localStorage.setItem(SEEN, '1'); } catch (e) {} }
  };
  // 设计思考卡片右上角「<」：收回卡片，tab 切回「游戏系统概述」
  stage.querySelectorAll('[data-sx-back]').forEach(b => b.addEventListener('click', () => select(tabs[0], true)));
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      select(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length], true);
    });
  });
});

document.querySelectorAll('[data-map-pick]').forEach(button => {
  button.addEventListener('click', () => {
    const stage = button.closest('.map-stage');
    stage.querySelectorAll('[data-map-shot]').forEach(image => { image.hidden = image.dataset.mapShot !== button.dataset.mapPick; });
    stage.querySelectorAll('[data-map-pick]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  });
});


// 效果演示：截图轮播
document.querySelectorAll('.fx-car').forEach(car => {
  const slides = [...car.querySelectorAll('.fx-slide')], dots = [...car.querySelectorAll('[data-fx-pick]')];
  let at = 0;
  const go = i => {
    at = (i + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-on', k === at));
    dots.forEach((d, k) => d.setAttribute('aria-pressed', k === at));
    const nx = slides[(at + 1) % slides.length]; if (nx) nx.loading = 'eager';
  };
  dots.forEach((d, k) => d.addEventListener('click', () => go(k)));
  car.querySelectorAll('[data-fx-step]').forEach(b => b.addEventListener('click', () => go(at + +b.dataset.fxStep)));
});
