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
const details = document.querySelector('#details');
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => {
 document.querySelectorAll('[data-section]').forEach(item => item.setAttribute('aria-current', String(item === button))); placeInd();
 details.querySelector('h1').textContent = button.querySelector('.nav__label').textContent;
 const overview = button.dataset.section === 'overview';
 details.querySelectorAll('p')[0].textContent = overview ? '自负 · 2.5D叙事向RPG游戏' : '该部分内容待补充。';
 details.querySelectorAll('p')[1].textContent = overview ? '叙事 / 探索 / 收集' : '';
 details.scrollIntoView(); details.focus({preventScroll:true});
}));
document.querySelector('.back').addEventListener('click', event => {
 event.preventDefault();
 if (window.parent !== window) {
   window.parent.postMessage('arrogism:close', '*');
   return;
 }
 if (history.length > 1) history.back();
 else location.replace('./index.html?return=portfolio#/home');
});
