/* ---------- Крок 1: тренування й іспит на реальних питаннях з анатомії ---------- */
'use strict';
(() => {
const K = window.KROK1 || { questions: [] };
const QS = K.questions; const STAT_KEY = 'anat.krok';
let stat = LS.get(STAT_KEY, {});
const saveStat = () => LS.set(STAT_KEY, stat);
const byTopic = t => QS.filter(q => q.topic === t);
const moduleOf = q => q.topic ? q.topic.split(':')[1] : (q.tag === 'angio' ? 'angio' : 'other');
const MOD_NAMES = { m1: 'Опорно-руховий апарат і нутрощі', m2: 'Нервова система та органи чуття', angio: 'Серце і судини (2 курс)', other: 'Інше' };
const topicTitle = tid => { const c = window.Course && Course.CUR.courses.find(x => tid.startsWith(x.id + ':')); if (!c) return tid; const [, mid, n] = tid.split(':'); const m = c.modules.find(x => x.id === mid); const t = m && m.topics.find(x => x.n === +n); return t ? `${t.n}. ${t.title.split('.')[0]}` : tid; };
function pool(sel) {
  if (!sel || sel === 'all') return QS.slice();
  if (sel === 'wrong') return QS.filter(q => (stat[q.id] || {}).bad > (stat[q.id] || {}).ok);
  if (sel === 'new') return QS.filter(q => !stat[q.id]);
  if (sel.startsWith('mod:')) return QS.filter(q => moduleOf(q) === sel.slice(4));
  return byTopic(sel);
}
function renderStart(params) {
  const done = QS.filter(q => stat[q.id]).length, okN = Object.values(stat).reduce((a, s) => a + (s.ok || 0), 0), badN = Object.values(stat).reduce((a, s) => a + (s.bad || 0), 0);
  const mods = ['m1', 'm2', 'angio', 'other'].map(m => ({ m, n: QS.filter(q => moduleOf(q) === m).length })).filter(x => x.n);
  const topics = [...new Set(QS.map(q => q.topic).filter(Boolean))].sort((a, b) => { const [, ma, na] = a.split(':'), [, mb, nb] = b.split(':'); return ma.localeCompare(mb) || (+na - +nb); });
  const wrong = pool('wrong').length;
  const preset = params && params.topic ? params.topic : 'all';
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Крок 1 · анатомія</h1><p>${QS.length} реальних питань з анатомії з офіційних буклетів Крок 1 «Медицина» 2007–2024. Тренування показує правильну відповідь одразу, іспит — 150 питань за 150 хвилин, як на справжньому Кроці. Питання додаються до статистики, помилки можна прогнати окремо.</p></section>
    <div class="tiles"><div class="tile"><b>${QS.length}</b><span>питань</span></div><div class="tile"><b>${done}</b><span>пройдено</span></div><div class="tile"><b>${okN + badN ? Math.round(okN / (okN + badN) * 100) : 0}%</b><span>точність</span></div><div class="tile"><b>${wrong}</b><span>з помилками</span></div></div>
    <div class="blitzstart"><div class="opts-row">
      <label>Що тренуємо<select id="kkSel"><option value="all">Усі питання</option><option value="new">Тільки нові</option><option value="wrong">Тільки помилки${wrong ? ` (${wrong})` : ''}</option>${mods.map(x => `<option value="mod:${x.m}">${MOD_NAMES[x.m]} (${x.n})</option>`).join('')}<optgroup label="За темою курсу">${topics.map(t => `<option value="${t}">${esc(topicTitle(t))} (${byTopic(t).length})</option>`).join('')}</optgroup></select></label>
      <label>Скільки<select id="kkN"><option value="10">10</option><option value="20" selected>20</option><option value="50">50</option><option value="0">усі підряд</option></select></label></div>
      <div class="actions"><button class="primary big" id="kkGo">Тренування →</button><button id="kkExam" title="150 випадкових питань, 150 хвилин, результат у кінці">Іспит 150 / 150 хв</button></div></div>
    <p class="muted" style="font-size:13px;margin-top:18px">Джерело: ${esc(K.source || '')}. Питання відібрано автоматично за формулюванням; кнопка «не анатомія» на питанні прибирає його зі списку.</p>
  </div>`;
  $('#kkSel').value = preset; if ($('#kkSel').value !== preset) $('#kkSel').value = 'all';
  $('#kkGo').onclick = () => Quiz.begin(pool($('#kkSel').value), +$('#kkN').value, false);
  $('#kkExam').onclick = () => Quiz.begin(QS.slice(), 150, true);
  window.scrollTo(0, 0);
}
const hidden = () => LS.get('anat.krokHidden', []);
const Quiz = {
  active: false, list: [], i: 0, exam: false, answers: [], timer: null, endAt: 0, locked: false,
  begin(src, n, exam) {
    const hid = new Set(hidden()); let list = shuffle(src.filter(q => !hid.has(q.id)));
    if (!list.length) { alertDlg('У цьому наборі немає питань.'); return; }
    if (n) list = list.slice(0, n);
    this.list = list; this.i = 0; this.exam = exam; this.answers = []; this.active = true; this.locked = false;
    location.hash = '#/krok/session';
  },
  render() {
    if (!this.active) { renderStart(); return; }
    if (this.i >= this.list.length) return this.finish();
    const q = this.list[this.i]; this.locked = false;
    const keys = shuffle(Object.keys(q.options).filter(k => q.options[k] && q.options[k] !== '-'));
    this.cur = { q, keys };
    app.innerHTML = `<div class="wrap krokwrap">
      <div class="sethead"><a class="back" href="#/krok" id="kkQuit">← Крок</a><span class="muted">${this.i + 1} з ${this.list.length}</span><span class="spacer"></span>${this.exam ? `<span class="muted" id="kkTime"></span>` : `<span class="muted">${esc(q.topic ? topicTitle(q.topic) : (MOD_NAMES[moduleOf(q)] || ''))}</span>`}</div>
      <div class="kq"><div class="kstem">${esc(q.q)}</div>
        <div class="kopts">${keys.map((k, idx) => `<button class="kopt" data-k="${k}"><kbd>${idx + 1}</kbd><span>${esc(q.options[k])}</span></button>`).join('')}</div>
        <div class="kfoot" id="kfoot"><span class="muted" style="font-size:12px">${q.years && q.years.length ? 'Крок ' + q.years.join(', ') : ''}</span><span class="spacer"></span><button class="small ghost" id="kkHide" title="Прибрати питання зі списку як не з анатомії">не анатомія</button></div></div>
    </div>`;
    $$('.kopt').forEach(b => b.onclick = () => this.answer(b.dataset.k));
    $('#kkHide').onclick = async () => { if (!await confirmDlg('Прибрати питання?', 'Воно більше не показуватиметься.')) return; const h = hidden(); h.push(q.id); LS.set('anat.krokHidden', h); this.i++; this.render(); };
    if (this.exam) this.tick();
    window.scrollTo(0, 0);
  },
  answer(k) {
    if (this.locked) return; this.locked = true;
    const { q } = this.cur, ok = k === q.answer;
    this.answers.push({ q, k, ok });
    const s = stat[q.id] = stat[q.id] || { ok: 0, bad: 0 }; ok ? s.ok++ : s.bad++; s.last = Date.now(); saveStat();
    if (this.exam) { this.i++; setTimeout(() => this.render(), 120); return; }
    $$('.kopt').forEach(b => { if (b.dataset.k === q.answer) b.classList.add('ok'); else if (b.dataset.k === k) b.classList.add('bad'); b.disabled = true; });
    const f = $('#kfoot'); f.insertAdjacentHTML('afterbegin', `<span class="${ok ? 'result good' : 'result bad'}">${ok ? 'Правильно' : 'Неправильно'}</span><button class="primary" id="kkNext">Далі →</button>`);
    $('#kkNext').onclick = () => { this.i++; this.render(); }; $('#kkNext').focus();
    if (!ok && navigator.vibrate) navigator.vibrate(60);
  },
  tick() {
    clearInterval(this.timer);
    if (!this.endAt) this.endAt = Date.now() + 150 * 60 * 1000;
    const upd = () => { const left = Math.max(0, this.endAt - Date.now()); const el = $('#kkTime'); if (el) el.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; if (left <= 0) { clearInterval(this.timer); this.finish(); } };
    upd(); this.timer = setInterval(upd, 1000);
  },
  finish() {
    this.active = false; clearInterval(this.timer); this.endAt = 0;
    const ok = this.answers.filter(a => a.ok).length, n = this.answers.length, pct = n ? Math.round(ok / n * 100) : 0;
    app.innerHTML = `<div class="wrap"><section class="page-hero"><h1>${this.exam ? 'Іспит завершено' : 'Сесію завершено'}</h1><p>${n ? `${ok} з ${n} правильно (${pct}%).${this.exam ? (pct >= 64 ? ' Поріг Крок 1 у 64 % пройдено.' : ' Поріг Крок 1 — 64 %, ще є над чим працювати.') : ''}` : 'Ви не відповіли на жодне питання.'}</p></section>
      <div class="actions"><a href="#/krok"><button class="primary">До Крок</button></a>${this.answers.some(a => !a.ok) ? `<button id="kkRedo">Прогнати помилки (${n - ok})</button>` : ''}</div>
      ${this.answers.length ? `<h2 class="section-title">Розбір</h2><div class="kreview">${this.answers.map((a, i) => `<div class="krow ${a.ok ? 'ok' : 'bad'}"><div class="kn">${i + 1}</div><div><div class="kstem small">${esc(a.q.q)}</div><div class="kans">${a.ok ? '' : `<span class="bad">Ваша: ${esc(a.q.options[a.k] || '—')}</span> · `}<span class="good">Правильно: ${esc(a.q.options[a.q.answer])}</span></div></div></div>`).join('')}</div>` : ''}
    </div>`;
    const r = $('#kkRedo'); if (r) r.onclick = () => this.begin(this.answers.filter(a => !a.ok).map(a => a.q), 0, false);
    window.scrollTo(0, 0);
  },
  teardown() { this.active = false; clearInterval(this.timer); this.endAt = 0; }
};
document.addEventListener('keydown', e => {
  if (!Quiz.active || !location.hash.startsWith('#/krok/session') || $('dialog[open]')) return;
  const idx = ['1', '2', '3', '4', '5'].indexOf(e.key); const btns = $$('.kopt');
  if (idx >= 0 && btns[idx] && !Quiz.locked) btns[idx].click();
  else if (e.key === 'Enter' && Quiz.locked) { const nx = $('#kkNext'); nx && nx.click(); }
});
ROUTES.krok = parts => {
  if (parts[0] === 'session') return Quiz.render();
  Quiz.teardown();
  const p = {}; (location.hash.split('?')[1] || '').split('&').forEach(kv => { const [k, v] = kv.split('='); if (k) p[k] = decodeURIComponent(v || ''); });
  renderStart(p);
};
window.Krok = { QS, byTopic, Quiz };
})();
