/* Контроль: іспит-спотер, як на практичному занятті — станції на час, без підказок, упереміш зі схем теми чи модуля.
   3D-моделі показуються з випадкового ракурсу (щоб упізнавати структуру, а не картинку). Помилки йдуть у повторення.
   Маршрути: #/exam — налаштування та історія; #/exam/go — сесія. Історія в localStorage anat.exam. */
'use strict';
(() => {
const HIST_KEY = 'anat.exam';
const hist = () => LS.get(HIST_KEY, []);
const TIMES = { 10: '10 с', 15: '15 с', 20: '20 с', 30: '30 с', 0: 'без таймера' };

function poolFor(src) {
  let sets;
  if (src === 'smart') { const started = new Set(Object.keys(srs).filter(k => !k.startsWith('card|') && !k.startsWith('fact:') && !k.startsWith('bio:')).map(k => k.split('|')[0])); sets = ATLAS.sets.filter(s => started.has(s.id)); if (!sets.length) sets = ATLAS.sets.filter(s => s.cat === 'Скелет'); }
  else if (src === 'all') sets = ATLAS.sets.slice();
  else if (src === '3d') sets = ATLAS.sets.filter(s => s.model);
  else if (src.startsWith('cat:')) sets = ATLAS.sets.filter(s => s.cat === src.slice(4));
  else if (src.startsWith('sets:')) { const ids = src.slice(5).split(','); sets = ATLAS.sets.filter(s => ids.includes(s.id)); }
  else sets = ATLAS.sets.filter(s => s.id === src);
  return sets.flatMap(s => s.items.map(it => ({ set: s, it })));
}
function srcLabel(src) {
  if (src === 'smart') return 'Схеми, які вже тренували'; if (src === 'all') return 'Увесь атлас'; if (src === '3d') return 'Усі 3D-моделі';
  if (src.startsWith('cat:')) return src.slice(4);
  const s = ATLAS.sets.find(x => x.id === src); if (s) return s.title;
  const sel = document.getElementById('exSrc'); if (sel) { const o = [...sel.options].find(o => o.value === src); if (o) return o.textContent.trim(); }
  return src;
}

const Exam = {
  src: 'smart', n: 20, t: 15, mode: 'opts', active: false, stations: [], i: 0, cur: null, results: [], locked: false, timer: null, tickTimer: null, startedAt: 0, loadedSet: null, label: '',
  teardown() { this.active = false; this.stopTimer(); },
  live() { return this.active && location.hash === '#/exam/go'; },   // пішли на інший маршрут — таймер і автоперехід зупиняються
  renderStart() {
    const cs = window.Course && Course.course();
    const topicOpts = cs ? cs.modules.map(m => { const all = [...new Set(m.topics.flatMap(t => t.sets))]; return `<optgroup label="${esc(m.short)}">${all.length ? `<option value="sets:${all.join(',')}">Увесь модуль: ${esc(m.short)}</option>` : ''}${m.topics.filter(t => t.sets.length && !t.control).map(t => `<option value="sets:${t.sets.join(',')}">Тема ${t.n}. ${esc(t.title.split('.')[0])}</option>`).join('')}</optgroup>`; }).join('') : '';
    const opts = topicOpts + ATLAS.categories.filter(c => ATLAS.sets.some(s => s.cat === c)).map(c => `<optgroup label="${esc(c)}"><option value="cat:${esc(c)}">Увесь розділ: ${esc(c)}</option>${ATLAS.sets.filter(s => s.cat === c).map(s => `<option value="${s.id}">${esc(s.title)}${s.model ? ' (3D)' : ''}</option>`).join('')}</optgroup>`).join('');
    const h = hist().slice(-10).reverse();
    app.innerHTML = `<div class="wrap">
      <section class="page-hero"><h1>Контроль</h1><p>Як на практичному занятті: показуємо одну структуру — без підписів, без підказок, на час. 3D-моделі повертаються випадковим боком, щоб ви впізнавали структуру, а не картинку. Помилки одразу йдуть у повторення, а в кінці — розбір кожної.</p></section>
      <div class="blitzstart">
        <div class="opts-row"><label>Що перевіряємо<select id="exSrc"><option value="smart">Розумно: схеми, які вже тренували</option><option value="3d">Усі 3D-моделі</option><option value="all">Увесь атлас</option>${opts}</select></label>
          <label>Станцій<select id="exN"><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option></select></label>
          <label>Час на станцію<select id="exT">${Object.entries(TIMES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
          <label>Відповідь<select id="exMode"><option value="opts">Вибрати з 6 назв</option><option value="write">Написати латиною</option></select></label></div>
        <div class="actions"><button class="primary big" id="exGo">Почати контроль →</button></div>
      </div>
      <div class="prose" style="padding:0;max-width:720px"><h2 class="section-title" style="margin-top:26px">Чому саме так</h2><ul style="margin:0">
        <li>На практичному іспиті показують препарат з будь-якого боку і дають секунди — тренуватись треба так само (дриль станціями на час, а не перечитування).</li>
        <li>Без підписів сусідніх точок: на іспиті їх теж немає.</li>
        <li>Правильна відповідь з першої спроби вважається «знаю», помилка чи тайм-аут повертає структуру у повторення вже завтра.</li></ul></div>
      ${h.length ? `<h2 class="section-title">Останні контролі</h2><div class="queue">${h.map(x => `<span style="cursor:default"><span class="t">${esc(x.label)}<small class="muted"> · ${x.date} · ${x.n} ${plural(x.n, 'станція', 'станції', 'станцій')} · ${x.t ? x.t + ' с' : 'без таймера'}</small></span><span class="c"><b class="${x.pct >= 90 ? 'okc' : x.pct < 60 ? 'badc' : ''}">${x.pct}%</b>${x.avg ? ` · ${x.avg} с/станцію` : ''}</span></span>`).join('')}</div>` : ''}
    </div>`;
    $('#exSrc').value = this.src; if ($('#exSrc').value !== this.src) { this.src = 'smart'; $('#exSrc').value = 'smart'; }
    $('#exN').value = String(this.n); $('#exT').value = String(this.t); $('#exMode').value = this.mode;
    $('#exGo').onclick = () => { this.src = $('#exSrc').value; this.n = +$('#exN').value; this.t = +$('#exT').value; this.mode = $('#exMode').value; this.label = srcLabel(this.src); location.hash = '#/exam/go'; };
    window.scrollTo(0, 0);
  },
  begin(stations) {
    const pool = stations || poolFor(this.src);
    if (pool.length < 4) { app.innerHTML = `<div class="wrap"><div class="sethead"><a class="back" href="#/exam">← Контроль</a></div><div class="empty">Для цього вибору замало структур. Оберіть тему, розділ або «Увесь атлас».</div></div>`; return; }
    if (!this.label) this.label = srcLabel(this.src);
    // станції: різні структури, по можливості з різних схем упереміш; сусідні станції з однієї схеми — щоб не перевантажувати картинку
    const picked = stations ? pool.slice() : shuffle(pool).slice(0, this.n);
    const bySet = new Map(); picked.forEach(x => { const a = bySet.get(x.set.id) || []; a.push(x); bySet.set(x.set.id, a); });
    this.stations = shuffle([...bySet.values()]).flatMap(a => shuffle(a));
    this.i = 0; this.results = []; this.active = true; this.loadedSet = null; this.cur = null; this.locked = false;
    app.innerHTML = `<div class="wrap">
      <div class="sethead"><a class="back" href="#/exam">← Контроль</a><h1 id="exTitle" style="font-size:20px"></h1><span class="chip" id="exCat"></span><span class="spacer"></span><span class="extimer" id="exTimer"></span><span class="muted" id="exCount"></span></div>
      <div class="trainwrap">
        <div class="viewcol"><div class="statbar" id="statbar"></div><div id="viewer"></div><div id="exExplain" hidden></div></div>
        <div class="legendwrap"><div class="legend" id="legend"></div></div>
        <aside class="panel" id="panel"><h4 id="panelTitle">Станція</h4><div id="bank"></div></aside>
      </div></div>`;
    Viewer.mount($('#viewer'), { mode: 'train', onPinClick: () => {} });
    this.next();
  },
  async next() {
    if (!this.live()) return;
    this.stopTimer();
    if (this.i >= this.stations.length) return this.finish();
    const cur = this.cur = this.stations[this.i]; this.locked = false; this.picked = null;
    const eb = $('#exExplain'); if (eb) { eb.hidden = true; eb.innerHTML = ''; }
    if (this.loadedSet !== cur.set.id) {
      const ok = await Viewer.load(imgUrl(cur.set.file), cur.set.w, cur.set.h);
      if (!this.active) return;
      if (!ok) { this.i++; return this.next(); }
      this.loadedSet = cur.set.id;
      $('#viewer').classList.toggle('dense', cur.set.items.length > 20);
    } else Viewer.fit();
    $('#exTitle').textContent = cur.set.model ? cur.set.title : 'Що позначено?'; $('#exCat').textContent = cur.set.model ? '3D · випадковий ракурс' : cur.set.cat;
    $('#exCount').textContent = `${this.i + 1} з ${this.stations.length}`;
    if (this.mode === 'opts') {
      const same = cur.set.items.filter(x => x.n !== cur.it.n), other = ATLAS.sets.filter(s => s.cat === cur.set.cat && s.id !== cur.set.id).flatMap(s => s.items);
      const seen = new Set([cur.it.la]); const opts = [];
      for (const x of shuffle(same).concat(shuffle(other))) { if (seen.has(x.la)) continue; seen.add(x.la); opts.push(x); if (opts.length === 5) break; }
      this.opts = shuffle([cur.it, ...opts]);
    }
    this.renderPins(); this.renderBank(); this.renderStat();
    const p = cur.it.pts[0]; if (p) Viewer.centerOn(p[0], p[1], cur.set.model ? 1 : 1.5, cur.set.model ? 0.9 : 0);
    if (this.t) this.startTimer();
    focusViewerMobile();
  },
  startTimer() {
    this.startedAt = Date.now(); const end = this.startedAt + this.t * 1000; const el = $('#exTimer');
    const tick = () => { if (!this.live() || this.locked) return; const left = Math.max(0, end - Date.now()); if (el) { el.textContent = Math.ceil(left / 1000) + ' с'; el.classList.toggle('low', left < 5000); } if (left <= 0) { this.answer(false, null, true); return; } this.tickTimer = setTimeout(tick, 200); };
    tick();
  },
  stopTimer() { clearTimeout(this.tickTimer); this.tickTimer = null; },
  renderPins() {
    const cur = this.cur, list = [];
    // тільки одна точка — як указка на препараті; після відповіді — підпис
    cur.it.pts.forEach((p, i) => list.push({ id: cur.it.n + ':' + i, x: p[0], y: p[1], label: this.locked ? (this.results[this.results.length - 1].ok ? '✓' : '✕') : '?', cls: this.locked ? (this.results[this.results.length - 1].ok ? 'ok' : 'bad') : 'sel', title: this.locked ? cur.it.la : '' }));
    Viewer.renderPins(list);
  },
  answer(ok, picked, timeout) {
    if (this.locked) return;
    const cur = this.cur; this.locked = true; this.stopTimer();
    const ms = this.startedAt ? Date.now() - this.startedAt : 0;
    srsReview(cur.set.id, structKey(cur.it), 'direct', ok, ok ? 'good' : 'again');
    if (!ok && picked && picked.n != null && cur.set.items.includes(picked)) noteConfusion(cur.set.id, structKey(cur.it), structKey(picked));
    this.results.push({ x: cur, ok, ms, timeout: !!timeout, picked });
    const eb = $('#exExplain'); if (eb) { eb.hidden = false; eb.innerHTML = explainHtml(cur.set, cur.it, { cls: ok ? 'ok' : 'bad', mode: 'direct' }); }
    if (!ok && navigator.vibrate) navigator.vibrate(60);
    this.i++;
    this.renderPins(); this.renderBank(); this.renderStat();
    if (ok) setTimeout(() => { if (this.live() && this.locked) this.next(); }, 700);
  },
  renderBank() {
    const cur = this.cur, b = $('#bank'), title = $('#panelTitle'); const last = this.results[this.results.length - 1];
    if (this.mode === 'opts') {
      title.textContent = 'Що це за структура?';
      b.innerHTML = `<div class="rvbank"><div class="opts">${this.opts.map((it, i) => { let cls = ''; if (this.locked) { if (it === cur.it) cls = 'ok'; else if (this.picked === it) cls = 'bad'; } return `<button class="name ${cls}" data-i="${i}"><kbd>${i + 1}</kbd> <i>${esc(it.la)}</i></button>`; }).join('')}</div>
        ${this.locked && !last.ok ? `<div class="question" style="display:flex;align-items:center;gap:10px;justify-content:space-between;text-align:left"><div class="p">${last.timeout ? 'Час вийшов. ' : ''}${esc(cur.it.uk || '')}</div><button class="primary" id="exNext">Далі →</button></div>` : ''}</div>`;
      $$('#bank .name').forEach(el => el.onclick = () => { if (this.locked) return; const it = this.opts[+el.dataset.i]; this.picked = it; this.answer(it === cur.it, it); });
    } else {
      title.textContent = 'Напишіть латиною';
      if (this.locked) b.innerHTML = `<div class="rvbank"><div class="question"><div class="q" style="font-size:19px">${last.ok ? 'Правильно ✔' : (last.timeout ? 'Час вийшов. ' : 'Неправильно. ') + 'Правильно: '}${last.ok ? '' : `<i>${esc(cur.it.la)}</i>`}</div>${!last.ok && last.picked ? `<div class="p">Ви написали: ${esc(last.picked)}</div>` : ''}${!last.ok ? `<div style="margin-top:8px"><button class="primary" id="exNext">Далі →</button></div>` : ''}</div></div>`;
      else { b.innerHTML = `<div class="rvbank"><div class="question"><div class="p">Точка зі знаком «?»</div><form id="exForm" class="typedrow"><input type="text" id="exInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Латинська назва" enterkeyhint="done"><button class="primary" type="submit">Відповісти</button></form></div></div>`;
        $('#exForm').onsubmit = e => { e.preventDefault(); const v = $('#exInput').value; this.picked = v; this.answer(Trainer.checkTyped(v, cur.it), v); };
        if (!matchMedia('(max-width:900px)').matches) setTimeout(() => { const i = $('#exInput'); i && i.focus(); }, 50); }
    }
    const nx = $('#exNext'); if (nx) { nx.onclick = () => this.next(); setTimeout(() => nx.focus(), 30); }
    Trainer.syncPanelHeight();
  },
  renderStat() {
    const ok = this.results.filter(r => r.ok).length, bad = this.results.length - ok;
    $('#statbar').innerHTML = `<span>Правильно: <b>${ok}</b></span><span>Помилки: <b>${bad}</b></span><span class="muted">${esc(this.label)}</span>`;
    const bad2 = this.results.filter(r => !r.ok), L = $('#legend');
    L.innerHTML = bad2.length ? `<h4>Помилки · ${bad2.length}</h4><div class="log">` + bad2.map(r => `<div class="row"><span class="num bad">✕</span><span class="txt"><i>${esc(r.x.it.la)}</i>${r.x.it.uk ? `<span>${esc(r.x.it.uk)}</span>` : ''}<span>· ${esc(r.x.set.title)}</span></span></div>`).join('') + '</div>' : `<div class="muted" style="font-size:14px">Одна точка на схемі — назвіть її. Сусідні структури не підписані, як на іспиті.</div>`;
  },
  finish() {
    const n = this.results.length, ok = this.results.filter(r => r.ok).length, pct = n ? Math.round(ok / n * 100) : 0;
    const timed = this.results.filter(r => r.ms); const avg = timed.length ? Math.round(timed.reduce((a, r) => a + r.ms, 0) / timed.length / 100) / 10 : 0;
    const bad = this.results.filter(r => !r.ok);
    this.active = false; this.stopTimer();
    const h = hist(); h.push({ date: dayKey(), label: this.label, n, pct, avg, t: this.t }); LS.set(HIST_KEY, h.slice(-50));
    const bySet = new Map(); bad.forEach(r => { const a = bySet.get(r.x.set.id) || { set: r.x.set, items: [] }; a.items.push(r.x.it); bySet.set(r.x.set.id, a); });
    app.innerHTML = `<div class="wrap">
      <div class="sethead"><a class="back" href="#/exam">← Контроль</a></div>
      <section class="page-hero" style="padding-top:6px"><h1>${pct >= 90 ? 'Відмінно' : pct >= 75 ? 'Добре' : pct >= 60 ? 'Задовільно' : 'Треба доопрацювати'}: ${pct}%</h1><p>${ok} з ${n} станцій правильно${avg ? `, у середньому ${avg} с на відповідь` : ''}. ${bad.length ? 'Помилки вже стоять у черзі на повторення — розберіть їх нижче, а завтра вони з’являться на «Сьогодні».' : 'Без жодної помилки — ця тема готова до практичного.'}</p></section>
      <div class="tiles"><div class="tile"><b>${pct}%</b><span>результат</span></div><div class="tile"><b>${ok}</b><span>правильно</span></div><div class="tile"><b>${bad.length}</b><span>${plural(bad.length, 'помилка', 'помилки', 'помилок')}</span></div>${avg ? `<div class="tile"><b>${avg}<small class="muted" style="font-size:16px"> с</small></b><span>на станцію</span></div>` : ''}</div>
      <div class="actions">${bad.length ? `<button class="primary" id="exRetry">Ще раз тільки помилки (${bad.length})</button>` : ''}<a href="#/exam"><button class="${bad.length ? '' : 'primary'}">Новий контроль</button></a><a href="#/today"><button>Сьогодні</button></a></div>
      ${bad.length ? `<h2 class="section-title">Розбір помилок</h2>${[...bySet.values()].map(g => `<h3 style="margin:16px 0 8px;font-size:16px">${esc(g.set.title)} <a href="#/set/${g.set.id}/direct" class="muted" style="font-weight:400;font-size:14px;text-decoration:underline">тренувати схему →</a></h3>${g.items.map(it => explainHtml(g.set, it, { cls: 'bad', mode: 'direct' })).join('')}`).join('')}` : ''}
    </div>`;
    const rb = $('#exRetry'); if (rb) rb.onclick = () => this.begin(bad.map(r => r.x));
    window.scrollTo(0, 0);
  },
  key(e) {
    if (!this.active || $('dialog[open]')) return;
    if (this.mode === 'opts' && !this.locked && /^[1-6]$/.test(e.key)) { const el = $$('#bank .name')[+e.key - 1]; if (el) { e.preventDefault(); el.click(); } }
    else if (this.locked && e.key === 'Enter' && $('#exNext')) { e.preventDefault(); this.next(); }
  }
};
document.addEventListener('keydown', e => Exam.key(e));

EXT.today.push(() => {
  const h = hist(); const trained = Object.keys(srs).some(k => !k.startsWith('card|') && !k.startsWith('fact:') && !k.startsWith('bio:'));
  if (!trained) return '';
  const last = h[h.length - 1];
  return `<div class="blitzcta"><a href="#/exam"><div class="goal"><div class="tnum">✓</div><div style="min-width:0"><b>Контроль</b><span class="muted tclip">${last ? `Останній: ${esc(last.label)} — ${last.pct}% (${last.date})` : 'Перевірте себе як на практичному: станції на час, без підказок'}</span></div><span class="spacer"></span><button>Пройти →</button></div></a></div>`;
});

ROUTES.exam = parts => { Exam.teardown(); if (parts[0] === 'go') return Exam.begin(); Exam.renderStart(); };
window.Exam = Exam;
})();
