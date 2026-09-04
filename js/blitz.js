/* ---------- Бліц: сесія на час у дусі Drops — швидкі вправи, комбо, очки, денна ціль ---------- */
'use strict';
(() => {
const XP_KEY = 'anat.xp', GOAL = 100, SOUND_KEY = 'anat.sound';
const xpToday = () => { const v = LS.get(XP_KEY, {}); return v[dayKey()] || 0; };
const addXp = n => { const v = LS.get(XP_KEY, {}); v[dayKey()] = (v[dayKey()] || 0) + n; LS.set(XP_KEY, v); };
let soundOn = LS.get(SOUND_KEY, true);

/* звук: короткі сигнали через WebAudio, без файлів */
let actx = null;
function beep(kind) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    if (kind === 'ok') { o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(990, t + 0.07); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.start(t); o.stop(t + 0.18); }
    else if (kind === 'combo') { [523, 659, 784].forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.06)); g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.start(t); o.stop(t + 0.3); }
    else { o.type = 'square'; o.frequency.setValueAtTime(180, t); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.start(t); o.stop(t + 0.2); }
  } catch (e) {}
}
const ring = (val, max, size = 64) => { const r = (size - 8) / 2, c = 2 * Math.PI * r, p = Math.min(1, val / max); return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/><text x="50%" y="50%" dy=".35em" text-anchor="middle">${val}</text></svg>`; };

/* джерела структур */
function poolFor(src) {
  let sets;
  if (src === 'smart') {
    const started = new Set(Object.keys(srs).filter(k => !k.startsWith('card|')).map(k => k.split('|')[0]));
    sets = ATLAS.sets.filter(s => started.has(s.id));
    if (!sets.length) sets = ATLAS.sets.filter(s => s.cat === 'Скелет');
  } else if (src.startsWith('cat:')) sets = ATLAS.sets.filter(s => s.cat === src.slice(4));
  else if (src.startsWith('sets:')) { const ids = src.slice(5).split(','); sets = ATLAS.sets.filter(s => ids.includes(s.id)); }
  else sets = ATLAS.sets.filter(s => s.id === src);
  return sets.flatMap(s => s.items.map(it => ({ set: s, it })));
}
const norm = s => s.toLowerCase().replace(/[^\p{L}]/gu, '');
const chunks = word => { const out = []; let i = 0; while (i < word.length) { const n = word.length - i <= 4 ? word.length - i : (Math.random() < 0.5 ? 2 : 3); out.push(word.slice(i, i + n)); i += n; } return out; };

const Blitz = {
  active: false, timer: null, endAt: 0, dur: 300, pool: [], score: 0, combo: 0, best: 0, ok: 0, bad: 0, cur: null, locked: false, lastSet: null, block: 0, src: 'smart',
  renderStart() {
    const cs = window.Course && Course.course();
    const topicOpts = cs ? cs.modules.map(m => `<optgroup label="${esc(m.short)}">${m.topics.filter(t => t.sets.length && !t.control).map(t => `<option value="sets:${t.sets.join(',')}">Тема ${t.n}. ${esc(t.title.split('.')[0])}</option>`).join('')}</optgroup>`).join('') : '';
    const opts = topicOpts + ATLAS.categories.filter(c => ATLAS.sets.some(s => s.cat === c)).map(c => `<optgroup label="${esc(c)}"><option value="cat:${esc(c)}">Увесь розділ: ${esc(c)}</option>${ATLAS.sets.filter(s => s.cat === c).map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup>`).join('');
    const xp = xpToday();
    app.innerHTML = `<div class="wrap">
      <section class="page-hero"><h1>Бліц</h1><p>П’ять хвилин швидких вправ упереміш: вибери назву, знайди на схемі, склади слово, з’єднай пари, правда чи ні. Комбо множить очки, помилки не забирають. Усе, що відповіли, іде в повторення.</p></section>
      <div class="blitzstart">
        <div class="goal">${ring(xp, GOAL, 88)}<div><b>Денна ціль</b><span class="muted">${xp >= GOAL ? 'Виконано 🎉' : `${xp} з ${GOAL} очок`}</span></div></div>
        <div class="opts-row"><label>Що тренуємо<select id="bzSrc"><option value="smart">Розумно: схеми, які вже тренували</option>${opts}</select></label>
          <label>Тривалість<select id="bzDur"><option value="120">2 хвилини</option><option value="300" selected>5 хвилин</option><option value="600">10 хвилин</option></select></label>
          <label class="chk"><input type="checkbox" id="bzSound" ${soundOn ? 'checked' : ''}> Звук</label></div>
        <div class="actions"><button class="primary big" id="bzGo">Почати →</button></div>
      </div>
      ${(() => { const v = LS.get(XP_KEY, {}); const days = Object.keys(v).sort().slice(-7); return days.length ? `<h2 class="section-title">Останні дні</h2><div class="xpdays">${days.map(d => `<div><b>${v[d]}</b><span>${d.slice(5)}</span></div>`).join('')}</div>` : ''; })()}
    </div>`;
    $('#bzSrc').value = this.src; if ($('#bzSrc').value !== this.src) { $('#bzSrc').value = 'smart'; this.src = 'smart'; } $('#bzDur').value = String(this.dur);
    $('#bzSound').onchange = e => { soundOn = e.target.checked; LS.set(SOUND_KEY, soundOn); };
    $('#bzGo').onclick = () => { this.src = $('#bzSrc').value; this.dur = +$('#bzDur').value; location.hash = '#/blitz/go'; };
    window.scrollTo(0, 0);
  },
  begin() {
    this.pool = poolFor(this.src);
    if (this.pool.length < 4) { location.hash = '#/blitz'; return; }
    this.active = true; this.score = 0; this.combo = 0; this.best = 0; this.ok = 0; this.bad = 0; this.lastSet = null; this.block = 0; this.log = [];
    this.endAt = Date.now() + this.dur * 1000;
    app.innerHTML = `<div class="wrap blitz">
      <div class="bztop"><a class="back" href="#/blitz" id="bzQuit">✕</a><div class="tbar"><div class="tfill" id="tfill"></div></div><div class="bzscore"><span id="bzCombo" class="combo" hidden></span><b id="bzScore">0</b></div></div>
      <div class="trainwrap bzwrap"><div class="viewcol"><div id="viewer"></div><div class="bzcard" id="bzcard" hidden></div><div id="bzExplain" hidden></div></div>
        <aside class="panel" id="panel"><h4 id="panelTitle"></h4><div id="bank"></div></aside></div>
    </div>`;
    Viewer.mount($('#viewer'), { mode: 'train', onPinClick: id => this.pinClick(id) });
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 200);
    this.next();
  },
  teardown() { this.active = false; clearInterval(this.timer); this.timer = null; },
  tick() {
    if (!this.active) return;
    const left = this.endAt - Date.now(), f = $('#tfill'); if (f) { f.style.width = Math.max(0, left / (this.dur * 1000) * 100) + '%'; f.classList.toggle('low', left < 15000); }
    if (left <= 0) this.finish();
  },
  pick(n, not) { const c = shuffle(this.pool.filter(x => !not || x.it !== not.it)); return c.slice(0, n); },
  async next() {
    if (!this.active) return;
    this.locked = false;
    // блоками по 3 вправи на одну схему, щоб не перевантажувати картинку
    if (!this.curSet || this.block >= 3) { const sets = [...new Set(this.pool.map(x => x.set))]; this.curSet = sets.length > 1 ? shuffle(sets.filter(s => s !== this.curSet))[0] : sets[0]; this.block = 0; }
    this.block++;
    const setPool = this.pool.filter(x => x.set === this.curSet);
    const target = setPool[Math.floor(Math.random() * setPool.length)];
    const types = ['pick', 'find', 'spell', 'tf'];
    if (setPool.filter(x => x.it.uk).length >= 4) types.push('pairs');
    if (!target.it.uk) { const i = types.indexOf('tf'); types.splice(i, 1); }
    const type = types[Math.floor(Math.random() * types.length)];
    this.cur = { type, target, set: this.curSet };
    { const eb = $('#bzExplain'); if (eb) { eb.hidden = true; eb.innerHTML = ''; } }
    const needImg = type === 'pick' || type === 'find';
    $('#viewer').hidden = !needImg; $('#bzcard').hidden = needImg;
    if (needImg && this.loadedSet !== this.curSet.id) { const ok = await Viewer.load(this.curSet.file, this.curSet.w, this.curSet.h); if (!this.active) return; if (!ok) { this.block = 3; return this.next(); } this.loadedSet = this.curSet.id; $('#viewer').classList.toggle('dense', this.curSet.items.length > 20); }
    this['ex_' + type]();
    if (this.cur.type === 'pick') Viewer.centerOn(target.it.pts[0][0], target.it.pts[0][1]);
    Trainer.syncPanelHeight();
  },
  pins(mode) {
    const { target, set } = this.cur, list = [];
    set.items.forEach((it, idx) => it.pts.forEach((p, i) => { let cls = ''; if (mode === 'pick') cls = it.n === target.it.n ? 'sel' : 'dim'; if (this.locked) { if (it.n === target.it.n) cls = 'ok'; else if (this.picked === it.n) cls = 'bad'; else if (mode === 'pick') cls = 'dim'; } list.push({ id: it.n + ':' + i, x: p[0], y: p[1], label: this.locked && it.n === target.it.n ? '✓' : (mode === 'pick' && it.n === target.it.n ? '?' : idx + 1), cls }); }));
    Viewer.renderPins(list);
  },
  // 1) вибери назву
  ex_pick() {
    const { target } = this.cur; this.picked = null; this.pins('pick');
    const opts = shuffle([target, ...this.pick(3, target.it)]);
    $('#panelTitle').textContent = 'Що це за структура?';
    $('#bank').innerHTML = `<div class="rvbank"><div class="opts">${opts.map(o => `<button class="name" data-n="${o.it.n}"><i>${esc(o.it.la)}</i></button>`).join('')}</div></div>`;
    $$('#bank .name').forEach(b => b.onclick = () => { if (this.locked) return; this.picked = +b.dataset.n; const ok = this.picked === target.it.n; b.classList.add(ok ? 'ok' : 'bad'); if (!ok) $(`#bank .name[data-n="${target.it.n}"]`).classList.add('ok'); this.answer(ok, 'direct'); this.pins('pick'); });
  },
  // 2) знайди на схемі
  ex_find() {
    const { target } = this.cur; this.picked = null; this.pins('find');
    $('#panelTitle').textContent = 'Знайдіть на схемі';
    $('#bank').innerHTML = `<div class="rvbank"><div class="question"><div class="q">${esc(target.it.la)}</div>${target.it.uk ? `<div class="p">${esc(target.it.uk)}</div>` : ''}</div></div>`;
  },
  pinClick(id) { if (!this.cur || this.locked || this.cur.type !== 'find') return; const n = +id.split(':')[0]; this.picked = n; const ok = n === this.cur.target.it.n; this.answer(ok, 'reverse'); this.pins('find'); },
  // 3) склади слово
  ex_spell() {
    const { target } = this.cur; const words = target.it.la.split(/\s+/); const word = words.reduce((a, b) => a.length >= b.length ? a : b);   // найдовше слово терміна
    const parts = chunks(word), tiles = shuffle(parts.map((t, i) => ({ t, i })));
    let pos = 0, typed = '';
    $('#panelTitle').textContent = 'Складіть слово';
    $('#bzcard').innerHTML = `<div class="cardface bz"><div class="cdeck muted">${esc(target.set.title)}</div><div class="cfront">${esc(target.it.uk || '')}</div><div class="p muted" style="margin-top:4px">${words.length > 1 ? esc(target.it.la.replace(word, '…')) : 'латинська назва'}</div>
      <div class="spelled" id="spelled">${parts.map(() => '<span class="slot"></span>').join('')}</div></div>`;
    $('#bank').innerHTML = `<div class="rvbank"><div class="tiles">${tiles.map(x => `<button class="tile" data-i="${x.i}">${esc(x.t)}</button>`).join('')}</div></div>`;
    $$('#bank .tile').forEach(b => b.onclick = () => {
      if (this.locked) return;
      if (+b.dataset.i === pos) { b.disabled = true; b.classList.add('used'); $$('#spelled .slot')[pos].textContent = parts[pos]; $$('#spelled .slot')[pos].classList.add('f'); pos++; typed += parts[pos - 1]; if (pos === parts.length) this.answer(!this.spellMiss, 'direct'); }
      else { this.spellMiss = true; b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); beep('bad'); if (navigator.vibrate) navigator.vibrate(30); }
    });
    this.spellMiss = false;
  },
  // 4) правда чи ні
  ex_tf() {
    const { target } = this.cur; const lie = Math.random() < 0.5; const other = lie ? this.pick(1, target.it).find(x => x.it.uk && x.it.uk !== target.it.uk) : null; const shownUk = other ? other.it.uk : target.it.uk; const truth = !other;
    $('#panelTitle').textContent = 'Правда чи ні?';
    $('#bzcard').innerHTML = `<div class="cardface bz"><div class="cdeck muted">${esc(target.set.title)}</div><div class="cfront">${esc(target.it.la)}</div><div class="tfeq">=</div><div class="cfront" style="font-family:var(--sans);font-size:22px">${esc(shownUk)}</div></div>`;
    $('#bank').innerHTML = `<div class="rvbank"><div class="opts"><button class="name tfbtn" data-v="1">Так</button><button class="name tfbtn" data-v="0">Ні</button></div></div>`;
    $$('#bank .tfbtn').forEach(b => b.onclick = () => { if (this.locked) return; const ok = (b.dataset.v === '1') === truth; b.classList.add(ok ? 'ok' : 'bad'); if (!ok) $(`#bank .tfbtn[data-v="${truth ? 1 : 0}"]`).classList.add('ok'); if (!truth) $('#bzcard .cfront:last-child').innerHTML = `<s class="muted">${esc(shownUk)}</s> ${esc(target.it.uk)}`; this.answer(ok, 'direct'); });
  },
  // 5) з'єднай пари
  ex_pairs() {
    const { target } = this.cur; const items = [target, ...this.pick(3, target.it).filter(x => x.it.uk)].slice(0, 4);
    const L = shuffle(items), R = shuffle(items); let selL = null, done = 0, miss = false;
    $('#panelTitle').textContent = 'З’єднайте пари';
    $('#bzcard').innerHTML = `<div class="cardface bz pairs"><div class="col">${L.map(x => `<button class="name pr" data-side="l" data-n="${x.it.n}"><i>${esc(x.it.la)}</i></button>`).join('')}</div><div class="col">${R.map(x => `<button class="name pr" data-side="r" data-n="${x.it.n}">${esc(x.it.uk)}</button>`).join('')}</div></div>`;
    $('#bank').innerHTML = `<div class="rvbank"><div class="question"><div class="p">Натисніть латину, потім її переклад</div></div></div>`;
    $$('#bzcard .pr').forEach(b => b.onclick = () => {
      if (this.locked || b.disabled) return;
      if (b.dataset.side === 'l') { $$('#bzcard .pr[data-side=l]').forEach(x => x.classList.remove('sel')); selL = b; b.classList.add('sel'); return; }
      if (!selL) return;
      if (selL.dataset.n === b.dataset.n) { [selL, b].forEach(x => { x.disabled = true; x.classList.remove('sel'); x.classList.add('ok'); }); selL = null; done++; beep('ok'); if (done === items.length) this.answer(!miss, 'direct'); }
      else { miss = true; b.classList.add('bad'); selL.classList.add('bad'); setTimeout(() => { b.classList.remove('bad'); selL && selL.classList.remove('bad'); }, 400); beep('bad'); this.recordOnly(target, false); }
    });
  },
  recordOnly(x, ok) { srsReview(x.set.id, structKey(x.it), 'direct', ok); },
  answer(ok, mode) {
    if (this.locked) return; this.locked = true;
    const { target } = this.cur;
    srsReview(target.set.id, structKey(target.it), mode, ok);
    if (ok) { this.ok++; this.combo++; this.best = Math.max(this.best, this.combo); const mult = this.combo >= 6 ? 3 : this.combo >= 3 ? 2 : 1; this.score += 10 * mult; addXp(10 * mult); beep(this.combo && this.combo % 3 === 0 ? 'combo' : 'ok'); }
    else { this.bad++; this.combo = 0; beep('bad'); if (navigator.vibrate) navigator.vibrate(60); this.log.push(target); if (this.picked != null && (this.cur.type === 'pick' || this.cur.type === 'find')) { const p = target.set.items.find(x => x.n === this.picked); if (p) noteConfusion(target.set.id, structKey(target.it), structKey(p)); } }
    if (!ok) { const eb = $('#bzExplain'); if (eb) { eb.hidden = false; eb.innerHTML = explainHtml(target.set, target.it, { cls: 'bad', mode }); } }
    $('#bzScore').textContent = this.score; const c = $('#bzCombo'); c.hidden = this.combo < 3; c.textContent = `×${this.combo >= 6 ? 3 : 2} · ${this.combo}`;
    $('#bzScore').classList.add('pop'); setTimeout(() => $('#bzScore') && $('#bzScore').classList.remove('pop'), 300);
    setTimeout(() => this.next(), ok ? 650 : 2600);
  },
  finish() {
    this.teardown(); clearInterval(this.timer);
    const xp = xpToday(), acc = this.ok + this.bad ? Math.round(this.ok / (this.ok + this.bad) * 100) : 0;
    app.innerHTML = `<div class="wrap"><section class="page-hero"><h1>Час вийшов</h1><p>${this.score ? `Ви набрали ${this.score} очок.` : 'Спробуйте ще раз — з часом стане швидше.'}</p></section>
      <div class="tiles"><div class="tile"><b>${this.score}</b><span>очок</span></div><div class="tile"><b>${this.ok}<small class="muted" style="font-size:16px"> / ${this.ok + this.bad}</small></b><span>правильно · ${acc}%</span></div><div class="tile"><b>${this.best}</b><span>найдовше комбо</span></div><div class="tile goal">${ring(xp, GOAL, 56)}<span>${xp >= GOAL ? 'денна ціль виконана 🎉' : `до цілі ${GOAL - xp}`}</span></div></div>
      <div class="actions"><a href="#/blitz/go"><button class="primary">Ще раз</button></a><a href="#/blitz"><button>Налаштування</button></a><a href="#/today"><button class="ghost">Сьогодні</button></a></div>
      ${this.log.length ? `<h2 class="section-title">Помилки</h2><div class="legend weak">${[...new Map(this.log.map(x => [x.it.la + x.set.id, x])).values()].map(x => `<div class="row"><span class="num bad">!</span><span class="txt"><i>${esc(x.it.la)}</i>${x.it.uk ? `<span>${esc(x.it.uk)}</span>` : ''}<small>${esc(x.set.title)}</small></span><a href="#/set/${x.set.id}/study/${x.it.n}"><button class="small">На схемі</button></a></div>`).join('')}</div>` : ''}
    </div>`;
    window.scrollTo(0, 0);
  }
};
ROUTES.blitz = parts => { Blitz.teardown(); return parts[0] === 'go' ? Blitz.begin() : Blitz.renderStart(); };
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/blitz/go')) Blitz.teardown(); });
EXT.today.unshift(() => { const xp = xpToday(); return `<div class="blitzcta"><a href="#/blitz"><div class="goal">${ring(xp, GOAL, 56)}<div><b>Бліц на 5 хвилин</b><span class="muted">${xp >= GOAL ? 'Денна ціль виконана 🎉' : `Денна ціль: ${xp} з ${GOAL} очок`}</span></div><span class="spacer"></span><button class="primary">Грати →</button></div></a></div>`; });
window.Blitz = Blitz;
})();
