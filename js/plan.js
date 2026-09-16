/* План до модуля (#/plan): дата контролю → теми, що ще не готові, розкладаються по днях; перерозподіл щодня автоматично.
   «Як вчити» (#/guide): коротка інструкція з методів, що доведено працюють; підказка на «Сьогодні» до першого прочитання. */
'use strict';
(() => {
const KEY = 'anat.plan', GUIDE_KEY = 'anat.guideSeen';
const plan = () => LS.get(KEY, null);
const savePlan = p => LS.set(KEY, p);
const DAYN = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const parseDay = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmt = d => `${DAYN[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const daysLeft = p => Math.round((parseDay(p.date) - today0()) / DAY);

function moduleOf(p) { const c = window.Course && Course.course(); return c && c.modules.find(m => m.id === p.mid) || null; }
const tidOf = (m, t) => `${Course.id}:${m.id}:${t.n}`;
function topicList(m) {
  return m.topics.filter(t => !t.control).map(t => {
    const id = tidOf(m, t), st = Course.topicStats(t), facts = window.Facts ? Facts.byTopic(id) : [];
    const fs = facts.length ? Facts.stat(facts) : null;
    const w = st.total + (facts.length * 3);
    const ready = (!st.total || st.pct >= 100) && (!facts.length || fs.mastered === fs.total);
    return { t, id, st, facts: facts.length, fs, w, ready, has: st.total > 0 || facts.length > 0 };
  }).filter(x => x.has);
}
// розклад: невивчені теми по днях до контролю; останній день перед контролем — повторення й Контроль
function schedule(p) {
  const m = moduleOf(p); if (!m) return null;
  const all = topicList(m), done = p.done || {};
  const left = all.filter(x => !x.ready && !done[x.id]);
  const D = daysLeft(p); const studyDays = Math.max(1, D >= 3 ? D - 1 : D);
  const total = left.reduce((a, x) => a + x.w, 0) || 1;
  const days = Array.from({ length: studyDays }, (_, i) => ({ date: addDays(today0(), i), topics: [], w: 0 }));
  let cum = 0;
  for (const x of left) { const di = Math.min(studyDays - 1, Math.floor((cum + x.w / 2) / total * studyDays)); cum += x.w; days[di].topics.push(x); days[di].w += x.w; }
  return { m, all, left, days, D, review: D >= 3 ? addDays(today0(), D - 1) : null, perDay: Math.round(total / studyDays) };
}

function renderForm(p) {
  const c = window.Course && Course.course();
  if (!c) { app.innerHTML = `<div class="wrap"><section class="page-hero"><h1>План до модуля</h1><p>Спершу оберіть курс — план будується за темами програми.</p></section><div class="actions"><a href="#/choose"><button class="primary">Обрати курс →</button></a></div></div>`; return; }
  const min = addDays(today0(), 1), def = p ? p.date : dayKey(addDays(today0(), 14));
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>План до модуля</h1><p>Вкажіть дату підсумкового контролю — тренажер розкладе теми, які ще не вивчені, по днях, а на «Сьогодні» показуватиме, що робити саме сьогодні. Пропустили день — план перерозподілиться сам. Останній день перед контролем — тільки повторення й «Контроль».</p></section>
    <div class="blitzstart"><div class="opts-row">
      <label>Модуль<select id="plMod">${c.modules.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join('')}</select></label>
      <label>Дата контролю<input type="date" id="plDate" min="${dayKey(min)}" value="${def}"></label></div>
      <div class="actions"><button class="primary big" id="plGo">Скласти план →</button>${p ? `<a href="#/plan"><button>Назад</button></a>` : ''}</div></div>
  </div>`;
  if (p) $('#plMod').value = p.mid;
  $('#plGo').onclick = () => { const date = $('#plDate').value; if (!date || parseDay(date) <= today0()) return alertDlg('Оберіть дату пізніше за сьогодні.'); savePlan({ mid: $('#plMod').value, date, done: (p && p.mid === $('#plMod').value ? p.done : {}) || {}, created: dayKey() }); if (location.hash === '#/plan') renderPlan(); else location.hash = '#/plan'; };
  window.scrollTo(0, 0);
}
function renderPlan() {
  const p = plan(); if (!p) return renderForm(null);
  const s = schedule(p); if (!s) return renderForm(p);
  const { m, all, left, days, D } = s;
  if (D <= 0) { app.innerHTML = `<div class="wrap"><section class="page-hero"><h1>${D === 0 ? 'Сьогодні контроль' : 'Контроль уже минув'}</h1><p>${esc(m.title)}. ${left.length ? `Невивчених тем: ${left.length}.` : 'Усі теми вивчені.'} Складіть новий план для наступного модуля або пройдіть «Контроль» по всьому модулю.</p></section><div class="actions"><a href="#/exam"><button class="primary">Контроль модуля →</button></a><button id="plNew">Новий план</button></div></div>`; $('#plNew').onclick = () => renderForm(p); return; }
  const ready = all.length - left.length;
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><h1 style="font-size:clamp(20px,3vw,28px)">План: ${esc(m.short)}</h1><span class="spacer"></span><button class="small" id="plEdit">Змінити</button><button class="small ghost" id="plDel">Скасувати</button></div>
    <div class="tiles"><div class="tile"><b>${D}</b><span>${plural(D, 'день', 'дні', 'днів')} до контролю (${fmt(parseDay(p.date))})</span></div><div class="tile"><b>${left.length}<small class="muted" style="font-size:16px"> / ${all.length}</small></b><span>тем лишилось</span></div><div class="tile"><b>${ready}</b><span>тем готово</span></div><div class="tile"><b>≈${s.perDay}</b><span>структур на день</span></div></div>
    ${s.perDay > 80 ? `<div class="explain bad" style="margin-bottom:14px">На день припадає багато матеріалу. Вчіть спершу схеми теми в прямому режимі, а картки теорії й зворотний режим — у повторенні. Якщо є змога, почніть із найважчих тем сьогодні.</div>` : ''}
    ${days.map((d, i) => `<h2 class="section-title" style="margin-top:${i ? 22 : 14}px;font-size:20px">${i === 0 ? 'Сьогодні' : i === 1 ? 'Завтра' : ''} <span class="muted" style="font-size:15px;font-family:var(--sans)">${fmt(d.date)}</span></h2>
      ${d.topics.length ? `<div class="queue">${d.topics.map(x => `<a href="#/course/${m.id}/${x.t.n}"><span class="tnum">${x.t.n}</span><span class="t">${esc(x.t.title.split('.')[0])}<small class="muted"> · ${x.st.total ? `${x.st.known}/${x.st.total} структур` : ''}${x.facts ? `${x.st.total ? ', ' : ''}${x.fs.mastered}/${x.facts} карток` : ''}</small></span><span class="c">${x.st.total ? `<span class="plbar"><span class="fill" style="width:${x.st.pct}%"></span></span>${x.st.pct}%` : ''}<button class="small ghost" data-done="${esc(x.id)}" title="Позначити вивченою">✓</button></span></a>`).join('')}</div>` : `<p class="muted" style="margin:0">Повторення на «Сьогодні» і бліц.</p>`}`).join('')}
    ${s.review ? `<h2 class="section-title" style="margin-top:22px;font-size:20px">Перед контролем <span class="muted" style="font-size:15px;font-family:var(--sans)">${fmt(s.review)}</span></h2><p class="muted" style="margin:0">Нових тем немає: повторення, «Контроль» по всьому модулю і розбір помилок.</p><div class="actions" style="margin-top:8px"><a href="#/exam"><button>Контроль →</button></a></div>` : ''}
    ${ready ? `<details style="margin-top:22px"><summary class="muted" style="cursor:pointer">Готові теми (${ready})</summary><div class="queue" style="margin-top:8px">${all.filter(x => x.ready || (p.done || {})[x.id]).map(x => `<a href="#/course/${m.id}/${x.t.n}"><span class="tnum">${x.t.n}</span><span class="t">${esc(x.t.title.split('.')[0])}</span><span class="c">${x.ready ? 'вивчено' : `<button class="small ghost" data-undone="${esc(x.id)}">повернути в план</button>`}</span></a>`).join('')}</div></details>` : ''}
  </div>`;
  $('#plEdit').onclick = () => renderForm(p);
  $('#plDel').onclick = async () => { if (await confirmDlg('Скасувати план?', 'Прогрес тем збережеться, зникне лише розклад.')) { LS.set(KEY, null); localStorage.removeItem(KEY); renderPlan(); } };
  $$('button[data-done]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); p.done = p.done || {}; p.done[b.dataset.done] = true; savePlan(p); renderPlan(); });
  $$('button[data-undone]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); delete p.done[b.dataset.undone]; savePlan(p); renderPlan(); });
  window.scrollTo(0, 0);
}

/* ---- «Як вчити» ---- */
function renderGuide() {
  LS.set(GUIDE_KEY, true);
  app.innerHTML = `<div class="wrap"><div class="prose" style="max-width:760px">
    <h1 style="font-family:var(--serif);font-weight:500">Як вчити, щоб запам’ятати</h1>
    <p class="muted">Це не поради «з голови»: так показують дослідження навчання анатомії й досвід студентів, які складають практичні з першого разу.</p>
    <h2>1. Спершу — вся схема, потім — деталі</h2><p>Відкрийте тему в <a href="#/course">Курсі</a>, пройдіть схему в режимі «Огляд»: подивіться, де що лежить, послухайте вимову, прочитайте розбір терміна (корені підказують значення: <i>supra-</i> — над, <i>-oideus</i> — подібний). Без загальної картини деталі не тримаються.</p>
    <h2>2. Пригадуйте, а не перечитуйте</h2><p>Одразу після огляду — «Прямий», потім «Зворотний» режим. Помилятись тут нормально: кожна помилка з поясненням запам’ятовується краще за десять перечитувань. Два чисті проходи — тема вивчена.</p>
    <h2>3. Повертайтесь тоді, коли каже «Сьогодні»</h2><p>Тренажер рахує, коли ви ось-ось забудете структуру, і ставить її в чергу. 10–15 хвилин повторення щодня дають більше, ніж три години раз на тиждень. Черга видна в меню поруч зі «Сьогодні».</p>
    <h2>4. Перевіряйте себе так, як питатимуть</h2><p>Перед практичним — <a href="#/exam">«Контроль»</a>: одна структура без підписів, на час, 3D-моделі з випадкового боку. «На іспиті все вилетіло з голови» трапляється з тими, хто впізнавав картинку, а не структуру.</p>
    <h2>5. М’язи вчіть групами й закономірностями</h2><p>Не «початок–прикріплення» списком, а за компартментами: одна група — один нерв, одна функція, плюс кілька винятків. Функцію можна вивести з прикріплень. Див. <a href="#/rules">Закономірності</a> і «З’єднай пари» в теорії.</p>
    <h2>6. Плануйте від дати контролю</h2><p>Обсяг лякає, поки він не розкладений по днях. <a href="#/plan">План до модуля</a> робить це за вас і перебудовується, якщо ви пропустили день.</p>
    <h2>7. Біологія: цикли й родоводи — розв’язуйте, а не читайте</h2><p>Послідовності «розстав по порядку», задачі з решіткою Пеннета і родоводи з розбором через спростування типів — у розділі <a href="#/bio">Біологія</a>.</p>
    <div class="actions" style="margin-top:18px"><a href="#/today"><button class="primary">До «Сьогодні» →</button></a></div>
  </div></div>`;
  window.scrollTo(0, 0);
}

EXT.today.unshift(() => {
  const p = plan(); const guideHtml = LS.get(GUIDE_KEY, false) ? '' : `<div class="blitzcta guidecta"><a href="#/guide"><div class="goal"><div class="tnum">?</div><div style="min-width:0"><b>Як вчити, щоб запам’ятати</b><span class="muted tclip">7 коротких правил: з чого починати тему, як повторювати, як готуватись до практичного</span></div><span class="spacer"></span><button class="primary">Читати →</button></div></a></div>`;
  if (!p) return guideHtml;
  const s = schedule(p); if (!s) return guideHtml;
  const { m, D, days, left } = s;
  if (D <= 0) return guideHtml + `<div class="blitzcta"><a href="#/exam"><div class="goal"><div class="tnum">!</div><div style="min-width:0"><b>${D === 0 ? 'Сьогодні контроль' : 'Контроль минув'}: ${esc(m.short)}</b><span class="muted tclip">Пройдіть «Контроль» по модулю або складіть новий план</span></div><span class="spacer"></span><button class="primary">Контроль →</button></div></a></div>`;
  const td = days[0];
  return guideHtml + `<h2 class="section-title">За планом сьогодні <span class="muted" style="font-size:14px;font-family:var(--sans)">· ${D} ${plural(D, 'день', 'дні', 'днів')} до контролю · <a href="#/plan" style="text-decoration:underline">увесь план</a></span></h2>
    ${td.topics.length ? `<div class="queue">${td.topics.map(x => `<a href="#/course/${m.id}/${x.t.n}"><span class="tnum">${x.t.n}</span><span class="t">${esc(x.t.title.split('.')[0])}</span><span class="c">${x.st.total ? `${x.st.pct}%` : `${x.fs.mastered}/${x.facts} карток`}</span></a>`).join('')}</div>` : `<p class="muted" style="margin:0">${left.length ? 'Сьогодні нових тем немає — повторення і «Контроль».' : 'Усі теми модуля вивчені — лишається повторювати.'}</p>`}`;
});

ROUTES.plan = parts => parts[0] === 'edit' ? renderForm(plan()) : renderPlan();
ROUTES.guide = () => renderGuide();
window.Plan = { plan, schedule };
})();
