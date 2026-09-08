'use strict';
const ATLAS_IMG_V = '19'; // кеш-бастер для atlas/*.png|jpg — підняти після заміни картинок
function imgUrl(f) { return f && !/[?]/.test(f) && /^(atlas|models)\//.test(f) ? f + '?v=' + ATLAS_IMG_V : f; }
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const GOAL = 2;
const ATLAS = window.ATLAS || { categories: [], sets: [] };

/* ---------- storage ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { alertDlg('Не вдалося зберегти: сховище переповнене.'); } }
};
const IMG = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    let r; try { r = indexedDB.open('anat-trainer', 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => {
    const t = db.transaction('images', mode); const req = fn(t.objectStore('images'));
    t.oncomplete = () => res(req && req.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  return {
    async get(id) { try { return await tx('readonly', s => s.get(id)); } catch (e) { return localStorage.getItem('anat.img.' + id); } },
    async set(id, data) { try { await tx('readwrite', s => s.put(data, id)); } catch (e) { try { localStorage.setItem('anat.img.' + id, data); } catch (e2) { alertDlg('Картинка завелика для сховища цього браузера.'); } } },
    async del(id) { try { await tx('readwrite', s => s.delete(id)); } catch (e) {} localStorage.removeItem('anat.img.' + id); }
  };
})();
let decks = LS.get('anat.decks', []);
let progress = LS.get('anat.progress', {});
const saveDecks = () => { LS.set('anat.decks', decks); searchIdx = null; };   // колоди змінились — індекс пошуку перебудувати
const saveProgress = () => LS.set('anat.progress', progress);
const progFor = (setId, mode) => { const p = progress[setId] = progress[setId] || {}; return p[mode] = p[mode] || { streak: 0, passes: 0, best: null }; };
const plural = (n, a, b, c) => { const m10 = n % 10, m100 = n % 100; return (m10 === 1 && m100 !== 11) ? a : (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) ? b : c; };

/* ---------- інтервальне повторення (спрощений SM-2) ----------
   Запис на кожну структуру в кожному режимі: ключ setId|n|mode.
   ease — множник росту інтервалу, interval — днів до наступного повторення,
   due — час наступного повторення (ms), lapses — скільки разів забували,
   reps — правильних відповідей поспіль, seen — скільки разів взагалі бачили. */
const DAY = 86400000, SRS_STEPS = [1, 3, 7, 14, 30];
let srs = LS.get('anat.srs', {});
let days = LS.get('anat.days', {});           // 'YYYY-MM-DD' → кількість відповідей за день
const saveSrs = () => LS.set('anat.srs', srs);
const structKey = it => it.pid || it.n;            // для своїх схем — id піна, для атласу — номер
const srsKey = (setId, n, mode) => `${setId}|${n}|${mode}`;
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function touchDay() { const k = dayKey(); days[k] = (days[k] || 0) + 1; LS.set('anat.days', days); }
// відповідь по структурі: ok — правильно з першого разу в цьому проході
const srsBlank = () => ({ ease: 2.5, interval: 0, due: 0, lapses: 0, reps: 0, seen: 0 });
/* FSRS-4.5 (Free Spaced Repetition Scheduler): стан запису — складність D (1..10), стабільність S (днів),
   ймовірність пригадування R. Параметри за замовчуванням з open-spaced-repetition. */
const FSRS_W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const FSRS_RETENTION = 0.9;                       // бажана ймовірність пригадування на момент повторення
const LEARN_STEP_MS = 10 * 60 * 1000;             // один короткий крок у той самий день
const LEECH_LAPSES = 8;                           // після стількох забувань структура — «п’явка»
const GRADE_N = { again: 1, hard: 2, good: 3, easy: 4 };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fsrsInitD = g => clamp(FSRS_W[4] - (g - 3) * FSRS_W[5], 1, 10);
const fsrsR = (t, S) => Math.pow(1 + t / (9 * S), -1);
const fsrsNextD = (D, g) => clamp(FSRS_W[7] * fsrsInitD(4) + (1 - FSRS_W[7]) * (D - FSRS_W[6] * (g - 3)), 1, 10);
const fsrsNextS = (D, S, R, g) => S * (Math.exp(FSRS_W[8]) * (11 - D) * Math.pow(S, -FSRS_W[9]) * (Math.exp(FSRS_W[10] * (1 - R)) - 1) * (g === 2 ? FSRS_W[15] : 1) * (g === 4 ? FSRS_W[16] : 1) + 1);
const fsrsLapseS = (D, S, R) => Math.max(0.1, FSRS_W[11] * Math.pow(D, -FSRS_W[12]) * (Math.pow(S + 1, FSRS_W[13]) - 1) * Math.exp(FSRS_W[14] * (1 - R)));
const fsrsInterval = S => Math.max(1, Math.round(9 * S * (1 / FSRS_RETENTION - 1)));
// наступний стан запису після відповіді; grade: again | hard | good | easy
function srsNext(r0, ok, grade) {
  const r = Object.assign({}, r0 || srsBlank()), now = Date.now(), today = dayKey();
  grade = grade || (ok ? 'good' : 'again'); const g = GRADE_N[grade] || (ok ? 3 : 1);
  if (r.seen && !r.S) { r.S = Math.max(0.5, r.interval || 1); r.D = clamp(11 - ((r.ease || 2.5) - 1.3) / 1.7 * 9, 1, 10); }   // міграція зі старого SM-2
  if (!r.seen || !r.S) { r.S = FSRS_W[g - 1]; r.D = fsrsInitD(g); }
  else {
    const t = Math.max(0, (now - (r.last || now)) / DAY), R = fsrsR(t, r.S);
    r.D = fsrsNextD(r.D, g); r.S = ok ? fsrsNextS(r.D, r.S, R, g) : fsrsLapseS(r.D, r.S, R);
  }
  r.S = +r.S.toFixed(3); r.D = +r.D.toFixed(2);
  if (ok) {
    r.reps++;
    if (r.lastOkDay !== today) { r.okDays = (r.okDays || 0) + 1; r.lastOkDay = today; }   // успішні пригадування в різні дні
    r.interval = fsrsInterval(r.S); r.due = now + r.interval * DAY;
  } else {
    if (r.seen) r.lapses++;                       // перше знайомство не карається
    r.reps = 0; r.interval = 0; r.due = now + LEARN_STEP_MS;   // короткий крок: ще раз сьогодні
    if (r.lapses >= LEECH_LAPSES) r.leech = true;
  }
  r.ease = +(1.3 + (11 - r.D) / 9 * 1.7).toFixed(2);   // сумісність зі старими полями
  r.seen++; r.last = now;
  return r;
}
const srsMastered = r => !!r && (r.okDays || 0) >= 3;   // «засвоєно»: 3 успішні пригадування в різні дні
function srsReview(setId, n, mode, ok, grade) {
  const k = srsKey(setId, n, mode);
  const cur = srs[k] ? Object.assign({}, srs[k], { mode }) : Object.assign(srsBlank(), { mode });
  const r = srsNext(cur, ok, grade); delete r.mode;
  srs[k] = r; saveSrs(); touchDay(); updateBadge();
  return r;
}
// ключ → структура з набором (null, якщо набір видалили)
function srsResolve(k) {
  const [setId, n, mode] = k.split('|');
  if (setId === 'card') return null;             // картки колод обробляє js/decks.js
  let set = null, href = null;
  if (setId.startsWith('my:')) { const d = decks.find(x => 'my:' + x.id === setId); if (d && d.hasImage) { set = deckToSet(d); href = '#/my/' + d.id; } }
  else { set = ATLAS.sets.find(x => x.id === setId); if (set) href = '#/set/' + set.id; }
  if (!set) return null;
  const it = set.items.find(i => String(structKey(i)) === n); if (!it) return null;
  return { k, set, it, mode, href, r: srs[k] };
}
function srsDue(now = Date.now()) { return Object.keys(srs).filter(k => srs[k].due <= now).map(srsResolve).filter(Boolean).sort((a, b) => a.r.due - b.r.due); }
function srsWeak(limit = 20) { return Object.keys(srs).filter(k => srs[k].lapses > 0).map(srsResolve).filter(Boolean).sort((a, b) => b.r.lapses - a.r.lapses || a.r.due - b.r.due).slice(0, limit); }
function streakDays() {
  let n = 0; const d = new Date();
  if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);   // сьогодні ще не займались — рахуємо серію до вчора
  while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function navFit() {
  const nav = $('#nav'); if (!nav) return;
  const over = nav.scrollWidth > nav.clientWidth + 2;
  nav.classList.toggle('more', over);
  nav.classList.toggle('end', over && nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 2);
  nav.classList.toggle('start', over && nav.scrollLeft > 2);
}
$('#nav').addEventListener('scroll', navFit, { passive: true });
window.addEventListener('resize', navFit);
const EXT = { today: [], badge: [], homeHash: null };          // хуки для модулів: блоки на «Сьогодні», лічильники в бейдж
let confuse = LS.get('anat.confuse', {});
function noteConfusion(setId, tested, picked) {
  if (tested == null || picked == null || tested === picked) return;
  const k = setId + '|' + tested, m = confuse[k] = confuse[k] || {}; m[picked] = (m[picked] || 0) + 1; LS.set('anat.confuse', confuse);
}
function confusionsFor(set, it) { const m = confuse[set.id + '|' + structKey(it)] || {}; return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => ({ it: set.items.find(x => String(structKey(x)) === k), n })).filter(x => x.it); }

/* ---------- лексикон: англійська, розбір латинського терміна, вимова ---------- */
const LEX = window.LEXICON || { en: {}, roots: {} };
const ROMAN = { i: 'перший', ii: 'другий', iii: 'третій', iv: 'четвертий', v: 'п’ятий', vi: 'шостий', vii: 'сьомий', viii: 'восьмий', ix: 'дев’ятий', x: 'десятий', xi: 'одинадцятий', xii: 'дванадцятий' };
const rootKeys = Object.keys(LEX.roots).sort((a, b) => b.length - a.length);
function rootOf(word) {
  const w = word.toLowerCase();
  if (ROMAN[w]) return ROMAN[w]; if (w === 'et') return 'і';
  for (const k of rootKeys) if (w.startsWith(k) && w.length - k.length <= 6) return LEX.roots[k];
  return null;
}
function etymology(la) {
  const parts = String(la || '').replace(/\(.*?\)/g, ' ').split(/[\s,]+/).filter(Boolean);
  const out = parts.map(p => ({ w: p, m: rootOf(p) })); return out.some(x => x.m) ? out : [];
}
const enFor = la => LEX.en[la] || '';
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(String(text).replace(/\(.*?\)/g, '')); const vs = speechSynthesis.getVoices();
    const v = vs.find(x => /^la/i.test(x.lang)) || vs.find(x => /^it/i.test(x.lang)) || vs.find(x => /^es/i.test(x.lang)) || null;
    if (v) u.voice = v; u.lang = v ? v.lang : 'it-IT'; u.rate = 0.85; speechSynthesis.cancel(); speechSynthesis.speak(u); return true;
  } catch (e) { return false; }
}
if ('speechSynthesis' in window) speechSynthesis.getVoices();
// пояснення після відповіді: термін, вимова, розбір, англійська, українська, з чим плутають
function explainHtml(set, it, opts = {}) {
  const et = etymology(it.la), en = enFor(it.la), conf = set ? confusionsFor(set, it) : [];
  const r = set ? srs[srsKey(set.id, structKey(it), opts.mode || 'direct')] : null;
  return `<div class="explain ${opts.cls || ''}"><div class="ex-head"><i class="ex-la">${esc(it.la)}</i><button class="spk" data-say="${esc(it.la)}" title="Вимова">🔊</button>${r && r.leech ? '<span class="chip leech" title="Забували 8+ разів — варто розібрати термін і сусідів">п’явка</span>' : ''}</div>
    ${it.uk ? `<div class="ex-uk">${esc(it.uk)}</div>` : ''}${en ? `<div class="ex-en">${esc(en)}</div>` : ''}
    ${et.length ? `<div class="ex-et">${et.map(x => x.m ? `<span><b>${esc(x.w)}</b> — ${esc(x.m)}</span>` : `<span class="muted">${esc(x.w)}</span>`).join('')}</div>` : ''}
    ${conf.length ? `<div class="ex-conf">Не плутайте з: ${conf.map(c => `<i>${esc(c.it.la)}</i>${c.it.uk ? ` <span class="muted">(${esc(c.it.uk)})</span>` : ''}`).join(', ')}</div>` : ''}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest('.spk'); if (b) { e.preventDefault(); e.stopPropagation(); speak(b.dataset.say); } });
function updateBadge() { const b = $('#dueBadge'); if (!b) return; const n = srsDue().length + EXT.badge.reduce((a, f) => a + f(), 0); b.textContent = n > 99 ? '99+' : n; b.hidden = !n; }

/* ---------- dialogs ---------- */
function baseDlg(title, msg, withInput, def) {
  return new Promise(res => {
    const d = $('#dlg'); $('#dlgTitle').textContent = title; $('#dlgMsg').textContent = msg || ''; $('#dlgMsg').hidden = !msg;
    const inp = $('#dlgInput'); inp.hidden = !withInput; inp.value = def || ''; inp.required = !!withInput;
    d.returnValue = ''; d.showModal(); if (withInput) { inp.focus(); inp.select(); }
    d.onclose = () => res(d.returnValue === 'ok' ? (withInput ? inp.value.trim() : true) : null);
  });
}
const askText = (t, def) => baseDlg(t, '', true, def);
const confirmDlg = (t, m) => baseDlg(t, m, false);
const alertDlg = m => baseDlg('Увага', m, false);
function pinDialog(pin, editing) {
  return new Promise(res => {
    const d = $('#pinDialog'); $('#fLa').value = pin.la || ''; $('#fUk').value = pin.uk || '';
    $('#pdTitle').textContent = editing ? 'Редагувати структуру' : 'Нова структура'; $('#pdDel').hidden = !editing;
    d.returnValue = ''; d.showModal(); $('#fLa').focus();
    d.onclose = () => { const v = d.returnValue; if (v === 'ok') { const la = $('#fLa').value.trim(); res(la ? { la, uk: $('#fUk').value.trim() } : null); } else if (v === 'del') res('del'); else res(null); };
  });
}

/* ---------- theme ---------- */
function applyTheme(t) { document.documentElement.dataset.theme = t; LS.set('anat.theme', t); }
applyTheme(LS.get('anat.theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#themeBtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ---------- viewer engine (zoom / pan / pins) ---------- */
const Viewer = {
  el: null, stage: null, img: null, pinsEl: null, leadsEl: null,
  _pins: [], _sig: '',
  V: { z: 1, tx: 0, ty: 0, base: 1, iw: 0, ih: 0, ready: false }, ZMIN: 1, ZMAX: 16,
  handlers: {}, ptrs: new Map(), g: null, ro: null, mode: 'train',
  mount(container, opts) {
    this.handlers = opts || {}; this.mode = opts.mode || 'train';
    container.innerHTML = `<div id="stage"><img id="img" alt=""><svg id="leads" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div id="pins"></div></div>
      <div class="zoomctl"><button id="zin" title="Збільшити">＋</button><button id="zout" title="Зменшити">－</button><button id="zfit" title="Вписати">⤢</button></div>
      <div id="placeholder" hidden><div>Перетягніть сюди картинку (jpg / png)</div><button id="placeholderPick">Вибрати файл</button></div>
      <div class="hintbar">колесо — зум · перетягування — пан</div>`;
    this.el = container; this.stage = $('#stage', container); this.img = $('#img', container); this.pinsEl = $('#pins', container); this.leadsEl = $('#leads', container);
    this._pins = []; this._sig = '';
    this.V = { z: 1, tx: 0, ty: 0, base: 1, iw: 0, ih: 0, ready: false }; this.ptrs = new Map(); this.g = null;
    container.classList.toggle('edit', this.mode === 'edit');
    $('#zin', container).onclick = () => this.zoomAt(1.5, container.clientWidth / 2, container.clientHeight / 2);
    $('#zout', container).onclick = () => this.zoomAt(1 / 1.5, container.clientWidth / 2, container.clientHeight / 2);
    $('#zfit', container).onclick = () => this.fit();
    $('#placeholderPick', container).onclick = () => $('#fileImg').click();
    $('#placeholder', container).addEventListener('pointerdown', e => e.stopPropagation());
    container.addEventListener('wheel', e => { e.preventDefault(); if (!this.V.ready) return; const r = container.getBoundingClientRect(); this.zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => container.addEventListener(t, e => e.preventDefault()));
    container.addEventListener('pointerdown', e => this.onDown(e));
    container.addEventListener('pointermove', e => this.onMove(e));
    container.addEventListener('pointerup', e => this.onEnd(e));
    container.addEventListener('pointercancel', e => this.onEnd(e));
    container.addEventListener('contextmenu', e => e.preventDefault());
    if (this.ro) this.ro.disconnect(); this.ro = new ResizeObserver(() => this.layout()); this.ro.observe(container);
  },
  load(src, w, h) {
    return new Promise(res => {
      const V = this.V, ph = $('#placeholder', this.el);
      if (!src) { V.ready = false; this.img.removeAttribute('src'); this.stage.style.display = 'none'; ph.hidden = false; return res(false); }
      this.img.onload = () => { V.iw = this.img.naturalWidth || w || 1000; V.ih = this.img.naturalHeight || h || 1000; if (w && h && (!this.img.naturalWidth || Math.abs(V.iw / V.ih - w / h) > 0.02)) { V.iw = w; V.ih = h; } V.ready = true; this.stage.style.display = ''; ph.hidden = true; this.fit(); res(true); };
      this.img.onerror = () => { V.ready = false; ph.hidden = false; res(false); };
      this.img.src = src;
    });
  },
  sw() { return this.V.iw * this.V.base * this.V.z; }, sh() { return this.V.ih * this.V.base * this.V.z; },
  layout() { const V = this.V; if (!V.ready || !this.el) return; const cw = this.el.clientWidth, ch = this.el.clientHeight; V.base = Math.min(cw / V.iw, ch / V.ih); this.stage.style.width = (V.iw * V.base) + 'px'; this.stage.style.height = (V.ih * V.base) + 'px'; this.clamp(); this.apply(); },
  fit() { this.V.z = 1; this.layout(); },
  clamp() { const V = this.V, cw = this.el.clientWidth, ch = this.el.clientHeight, w = this.sw(), h = this.sh(); V.tx = w <= cw ? (cw - w) / 2 : Math.min(0, Math.max(cw - w, V.tx)); V.ty = h <= ch ? (ch - h) / 2 : Math.min(0, Math.max(ch - h, V.ty)); },
  apply() { const V = this.V; this.stage.style.transform = `translate(${V.tx}px,${V.ty}px) scale(${V.z})`; this.stage.style.setProperty('--inv', 1 / V.z); this.declutter(false); },
  zoomAt(f, px, py) { const V = this.V; const z = Math.min(this.ZMAX, Math.max(this.ZMIN, V.z * f)), k = z / V.z; V.tx = px - (px - V.tx) * k; V.ty = py - (py - V.ty) * k; V.z = z; this.clamp(); this.apply(); },
  centerOn(x, y, zoom) { const V = this.V; if (zoom && V.z < zoom) V.z = zoom; V.tx = this.el.clientWidth / 2 - x / 100 * this.sw(); V.ty = this.el.clientHeight / 2 - y / 100 * this.sh(); this.clamp(); this.apply(); },
  toPct(cx, cy) { const r = this.stage.getBoundingClientRect(); return { x: (cx - r.left) / r.width * 100, y: (cy - r.top) / r.height * 100 }; },
  onDown(e) {
    if (e.target.closest('.zoomctl, #placeholder') || !this.V.ready) return;
    if (e.button && e.button !== 0) return;
    e.preventDefault(); this.el.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const V = this.V;
    if (this.ptrs.size === 1) {
      const pinEl = e.target.closest('.pin');
      this.g = { type: pinEl && this.mode === 'edit' ? 'pin' : 'pan', id: e.pointerId, pinEl, sx: e.clientX, sy: e.clientY, tx: V.tx, ty: V.ty, moved: false };
      this.el.classList.add('dragging');
    } else if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      this.g = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, z0: V.z, tx0: V.tx, ty0: V.ty, moved: true };
    }
  },
  onMove(e) {
    const g = this.g, V = this.V; if (!this.ptrs.has(e.pointerId) || !g) return;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.type === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()], r = this.el.getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const z = Math.min(this.ZMAX, Math.max(this.ZMIN, g.z0 * d / g.d0)); const m0 = { x: g.m0.x - r.left, y: g.m0.y - r.top };
      V.tx = m.x - (m0.x - g.tx0) * (z / g.z0); V.ty = m.y - (m0.y - g.ty0) * (z / g.z0); V.z = z; this.clamp(); this.apply(); return;
    }
    if (e.pointerId !== g.id) return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (!g.moved && Math.hypot(dx, dy) > 5) g.moved = true;
    if (!g.moved) return;
    if (g.type === 'pan') { V.tx = g.tx + dx; V.ty = g.ty + dy; this.clamp(); this.apply(); }
    else if (g.type === 'pin') { const p = this.toPct(e.clientX, e.clientY); const x = +Math.min(100, Math.max(0, p.x)).toFixed(2), y = +Math.min(100, Math.max(0, p.y)).toFixed(2); g.pinEl.style.left = x + '%'; g.pinEl.style.top = y + '%'; g.pos = { x, y }; }
  },
  onEnd(e) {
    if (!this.ptrs.has(e.pointerId)) return; this.ptrs.delete(e.pointerId);
    const g = this.g; if (!g) return;
    if (g.type === 'pinch') {
      if (this.ptrs.size === 1) { const [id, p] = [...this.ptrs.entries()][0]; this.g = { type: 'pan', id, sx: p.x, sy: p.y, tx: this.V.tx, ty: this.V.ty, moved: true }; }
      else if (!this.ptrs.size) { this.g = null; this.el.classList.remove('dragging'); }
      return;
    }
    if (e.pointerId !== g.id) return;
    this.g = null; this.el.classList.remove('dragging');
    if (e.type === 'pointercancel') return;
    const H = this.handlers;
    if (g.type === 'pin') { if (g.moved) H.onPinMove && H.onPinMove(g.pinEl.dataset.id, g.pos); else H.onPinClick && H.onPinClick(g.pinEl.dataset.id); return; }
    if (g.moved) return;
    if (g.pinEl) H.onPinClick && H.onPinClick(g.pinEl.dataset.id);
    else if (H.onImageClick) H.onImageClick(e.clientX, e.clientY);
  },
  renderPins(list) { // list: [{id, x, y, label, cls}]
    this.pinsEl.innerHTML = '';
    for (const p of list) { const el = document.createElement('div'); el.className = 'pin ' + (p.cls || ''); el.dataset.id = p.id; el.style.left = p.x + '%'; el.style.top = p.y + '%'; el.textContent = p.label; if (p.title) el.title = p.title; this.pinsEl.appendChild(el); }
    this._pins = list;
    this.declutter(true);
  },
  /* Розводить піни, що злиплися на поточному масштабі: кластер розкладається
     по колу навколо свого центру, від кожного зсунутого піна йде тонка виноска
     до справжньої точки. Перераховується тільки при зміні масштабу. */
  declutter(force) {
    const V = this.V, list = this._pins;
    if (!this.pinsEl || !this.leadsEl) return;
    if (this.mode === 'edit' || !V.ready || !list.length) { this.leadsEl.innerHTML = ''; return; }
    const sig = V.z.toFixed(4) + ':' + V.base.toFixed(4) + ':' + list.length;
    if (!force && sig === this._sig) return;
    this._sig = sig;
    const W = this.sw(), H = this.sh();
    if (!(W > 1 && H > 1)) { this.leadsEl.innerHTML = ''; return; }   // сцена ще не розкладена
    const gap = this.el.classList.contains('dense') ? 25 : 30;   // діаметр піна + просвіт
    const pts = list.map(p => ({ x: p.x / 100 * W, y: p.y / 100 * H }));
    const n = pts.length, par = [...Array(n).keys()];
    const find = a => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
      if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < gap) { const a = find(i), b = find(j); if (a !== b) par[a] = b; }
    const groups = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
    const off = new Array(n).fill(null);
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const k = g.length;
      const cx = g.reduce((a, i) => a + pts[i].x, 0) / k, cy = g.reduce((a, i) => a + pts[i].y, 0) / k;
      const R = Math.min(64, Math.max(gap * 0.6, gap / (2 * Math.sin(Math.PI / k))));
      // порядок по вихідному куту — піни лишаються з того боку, де стояли
      const ord = g.slice().sort((a, b) => Math.atan2(pts[a].y - cy, pts[a].x - cx) - Math.atan2(pts[b].y - cy, pts[b].x - cx));
      ord.forEach((i, t) => {
        const ang = -Math.PI / 2 + t * 2 * Math.PI / k;
        off[i] = { dx: cx + R * Math.cos(ang) - pts[i].x, dy: cy + R * Math.sin(ang) - pts[i].y };
      });
    }
    // 2) релаксація: сусідні кластери могли зіткнутись — розштовхуємо залишки,
    //    слабка пружина тягне пін назад до справжньої точки, щоб не розповзались
    const pos = pts.map((p, i) => off[i] ? { x: p.x + off[i].dx, y: p.y + off[i].dy } : { x: p.x, y: p.y });
    const MAXOFF = 72;
    for (let pass = 0; pass < 24; pass++) {
      let hit = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y, d = Math.hypot(dx, dy);
        if (d >= gap) continue;
        if (d < 0.01) { dx = Math.cos(i * 2.4); dy = Math.sin(i * 2.4); d = 1; }
        const k2 = (gap - d) / 2 / d;
        pos[i].x -= dx * k2; pos[i].y -= dy * k2;
        pos[j].x += dx * k2; pos[j].y += dy * k2;
        hit = true;
      }
      for (let i = 0; i < n; i++) {
        const bx = pts[i].x - pos[i].x, by = pts[i].y - pos[i].y, dist = Math.hypot(bx, by);
        if (dist > MAXOFF) { pos[i].x += bx * (1 - MAXOFF / dist); pos[i].y += by * (1 - MAXOFF / dist); }
        else { pos[i].x += bx * 0.03; pos[i].y += by * 0.03; }
      }
      if (!hit) break;
    }
    for (let i = 0; i < n; i++) {
      const dx = pos[i].x - pts[i].x, dy = pos[i].y - pts[i].y;
      off[i] = Math.hypot(dx, dy) > 1 ? { dx, dy } : null;
    }

    const kids = this.pinsEl.children, lines = [];
    for (let i = 0; i < n; i++) {
      const el = kids[i]; if (!el) continue;
      const o = off[i];
      if (!o) { el.style.removeProperty('--dx'); el.style.removeProperty('--dy'); el.classList.remove('moved'); continue; }
      el.style.setProperty('--dx', (o.dx / V.z) + 'px');   // піни живуть у координатах сцени
      el.style.setProperty('--dy', (o.dy / V.z) + 'px');
      el.classList.add('moved');
      lines.push(`<line x1="${list[i].x}" y1="${list[i].y}" x2="${list[i].x + o.dx / W * 100}" y2="${list[i].y + o.dy / H * 100}"></line>`);
    }
    this.leadsEl.innerHTML = lines.join('');
  },
  flash(ids, cls) { ids.forEach(id => $$(`.pin[data-id="${CSS.escape(id)}"]`, this.pinsEl).forEach(el => { el.classList.add(cls); setTimeout(() => el.classList.remove(cls), 600); })); }
};

/* ---------- routing ---------- */
const app = $('#app');
const setTitle = t => { document.title = (t ? t + ' — ' : '') + 'Anatomia — тренажер з анатомії'; };
function route() {
  const h = location.hash.replace(/^#\/?/, ''); const parts = h.split('/').filter(Boolean);
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.r === (parts[0] || 'atlas') || (a.dataset.r === 'my' && parts[0] === 'edit') || (a.dataset.r === 'course' && parts[0] === 'choose')));
  Trainer.teardown(); Review.teardown(); updateBadge(); navFit();
  { const a = $('#nav a.active'); if (a && $('#nav').classList.contains('more')) a.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  setTitle({ today: 'Сьогодні', progress: 'Мій прогрес', my: 'Мої схеми', edit: 'Редагування', about: 'Про тренажер', decks: 'Колоди', blitz: 'Бліц', course: 'Курс', choose: 'Вибір курсу', krok: 'Крок 1' }[parts[0]] || '');
  if (!parts.length) { location.replace(EXT.homeHash ? EXT.homeHash() : '#/atlas'); return; }
  if (parts[0] === 'atlas') return renderHome();
  if (parts[0] === 'today') return parts[1] === 'session' ? Review.begin() : Review.renderStart();
  if (parts[0] === 'progress') return renderProgress();
  if (parts[0] === 'set' && parts[1]) { const s = ATLAS.sets.find(x => x.id === parts[1]); return s ? renderSet(s, parts[2], parts[3]) : renderHome(); }
  if (parts[0] === 'my' && parts[1]) { const d = decks.find(x => x.id === parts[1]); return d ? renderCustomSet(d, parts[2], parts[3]) : renderMy(); }
  if (parts[0] === 'my') return renderMy();
  if (parts[0] === 'edit' && parts[1]) { const d = decks.find(x => x.id === parts[1]); return d ? renderEditor(d) : renderMy(); }
  if (parts[0] === 'about') return renderAbout();
  const ext = ROUTES[parts[0]]; if (ext) return ext(parts.slice(1));
  renderHome();
}
const ROUTES = {};            // модулі додають свої маршрути: ROUTES.decks = parts => ...
const INIT = [];              // асинхронні ініціалізації модулів перед першим рендером
window.addEventListener('hashchange', route);

/* ---------- home ---------- */
let homeFilter = LS.get('anat.filter', 'Усі');
function progDots(setId) {
  const d = progFor(setId, 'direct').streak, r = progFor(setId, 'reverse').streak;
  const dots = n => `<span class="dots">${Array.from({ length: GOAL }, (_, i) => `<span class="${i < n ? 'f' : ''}"></span>`).join('')}</span>`;
  return `<span>Прямий${dots(d)}</span><span>Зворотний${dots(r)}</span>`;
}
function cardHtml(s, href, extra) {
  const done = progFor(s.id, 'direct').streak >= GOAL && progFor(s.id, 'reverse').streak >= GOAL;
  return `<a class="card" href="${href}">
    ${done ? '<span class="done">✓ Вивчено</span>' : ''}
    <div class="thumb" style="position:relative"><img src="${esc(imgUrl(s.thumb || s.file))}" alt="" loading="lazy">${s.model ? '<span class="badge3d">3D</span>' : ''}</div>
    <div class="body"><h3>${esc(s.title)}</h3>
      <div class="meta"><span class="chip">${esc(s.cat)}</span><span>${s.items.length} структур</span>${extra || ''}</div>
      <div class="prog">${progDots(s.id)}</div></div></a>`;
}
/* ---------- пошук по терміну ---------- */
let homeQuery = '';
let searchIdx = null;

// нормалізує рядок і повертає карту «символ нормалізованого → індекс в оригіналі»,
// щоб потім точно підсвітити збіг у вихідному тексті
function normMap(str) {
  let out = ''; const map = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += c; for (let j = 0; j < c.length; j++) map.push(i);
  }
  return { out, map };
}
const norm = str => normMap(str).out;

function searchIndex() {
  if (searchIdx) return searchIdx;
  searchIdx = [];
  const add = (set, href) => set.items.forEach(it => searchIdx.push({
    la: it.la || '', uk: it.uk || '', n: it.n, title: set.title, cat: set.cat, href,
    k: norm((it.la || '') + '|' + (it.uk || ''))
  }));
  ATLAS.sets.forEach(x => add(x, '#/set/' + x.id));
  decks.filter(d => d.pins.length && d.hasImage).forEach(d => add(deckToSet(d), '#/my/' + d.id));
  if (window.FACTS) for (const it of FACTS.items) searchIdx.push({ la: it.la, uk: it.uk, n: '', title: 'Теорія · ' + it.group, cat: (FACTS.types[it.type] || {}).name || 'Теорія', href: '#/facts/' + it.topic, url: '#/facts/' + it.topic, k: norm(it.la + '|' + it.uk) });
  return searchIdx;
}

function searchTerms(q, limit = 40) {
  const nq = norm(q.trim());
  if (nq.length < 2) return { rows: [], total: 0 };
  const hits = [];
  for (const r of searchIndex()) {
    const i = r.k.indexOf(nq);
    if (i < 0) continue;
    const fromWord = (i === 0 || /[\s|(,.\-]/.test(r.k[i - 1])) ? 0 : 1;   // збіг з початку слова — вище
    hits.push({ r, rank: fromWord * 1000 + i });
  }
  hits.sort((a, b) => a.rank - b.rank || a.r.la.localeCompare(b.r.la, 'uk'));
  return { rows: hits.slice(0, limit).map(h => h.r), total: hits.length };
}

function markHit(text, q) {
  const nq = norm(q.trim());
  if (!text || nq.length < 2) return esc(text);
  const nm = normMap(text), i = nm.out.indexOf(nq);
  if (i < 0) return esc(text);
  const a = nm.map[i], b = nm.map[i + nq.length - 1] + 1;
  return esc(text.slice(0, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>' + esc(text.slice(b));
}

function renderResults() {
  const box = $('#qres'); if (!box) return;
  const q = homeQuery.trim(), on = q.length >= 2;
  ['.filters', '#atlasGrid', '#myTitle', '#myGrid'].forEach(sel => { const el = $(sel); if (el) el.hidden = on; });
  const clr = $('#qclr'); if (clr) clr.hidden = !homeQuery;
  if (!on) { box.hidden = true; box.innerHTML = ''; return; }
  const { rows, total } = searchTerms(q);
  box.hidden = false;
  if (!rows.length) { box.innerHTML = `<div class="empty">За запитом «${esc(q)}» нічого не знайдено.</div>`; return; }
  box.innerHTML = `<p class="qhead">Знайдено ${total}${total > rows.length ? `, показано перші ${rows.length}` : ''}</p>
    <div class="qlist">${rows.map(r => `<a class="qrow" href="${r.url || (r.href + '/study/' + r.n)}">
      <span class="la">${markHit(r.la, q)}</span>${r.uk ? `<span class="uk">${markHit(r.uk, q)}</span>` : ''}
      <span class="spacer"></span><span class="arw">→</span>
      <span class="set">${esc(r.title)}</span><span class="cat">${esc(r.cat)}</span></a>`).join('')}</div>`;
}

/* ---------- home ---------- */
function renderHome() {
  const total = ATLAS.sets.reduce((a, s) => a + s.items.length, 0);
  const learned = ATLAS.sets.filter(s => progFor(s.id, 'direct').streak >= GOAL && progFor(s.id, 'reverse').streak >= GOAL).length;
  const cats = ['Усі', '3D', ...ATLAS.categories.filter(c => ATLAS.sets.some(s => s.cat === c))];
  const list = ATLAS.sets.filter(s => homeFilter === 'Усі' || (homeFilter === '3D' ? !!s.model : s.cat === homeFilter));
  const my = decks.filter(d => d.pins.length && d.hasImage);
  const due = srsDue().length;
  app.innerHTML = `<div class="wrap">
    <section class="hero">
      <h1>Анатомія по картинках.<br>Латина, яка запам’ятовується.</h1>
      <p>Оберіть схему з атласу, натискайте на пронумеровані точки й підбирайте правильну латинську назву. Два чисті проходи поспіль — і тема вивчена.</p>
      <div class="stats"><div><b>${ATLAS.sets.length}</b>схем</div><div><b>${total}</b>структур</div><div><b>${learned}</b>вивчено</div><a href="#/today" title="Сьогодні"><div><b>${due}</b>до повторення</div></a></div>
    </section>
    <div class="search">
      <span class="ico">⌕</span>
      <input id="q" type="search" autocomplete="off" spellcheck="false" enterkeyhint="search"
             placeholder="Пошук: латина або українська" value="${esc(homeQuery)}">
      <button class="clr" id="qclr" title="Очистити" ${homeQuery ? '' : 'hidden'}>×</button>
    </div>
    <div class="qres" id="qres" hidden></div>
    <div class="filters">${cats.map(c => `<button class="${c === homeFilter ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="grid" id="atlasGrid">${list.map(s => cardHtml(s, '#/set/' + s.id)).join('')}</div>
    ${my.length ? `<h2 class="section-title" id="myTitle">Мої схеми</h2><div class="grid" id="myGrid">${my.map(d => cardHtml(deckToSet(d), '#/my/' + d.id)).join('')}</div>` : ''}
  </div>`;
  $$('.filters button').forEach(b => b.onclick = () => { homeFilter = b.dataset.cat; LS.set('anat.filter', homeFilter); renderHome(); });
  const inp = $('#q');
  inp.oninput = () => { homeQuery = inp.value; renderResults(); };
  inp.onkeydown = e => {
    if (e.key === 'Escape') { homeQuery = ''; inp.value = ''; renderResults(); }
    else if (e.key === 'Enter') { const first = $('.qrow'); if (first) { e.preventDefault(); location.hash = first.getAttribute('href'); } }
  };
  $('#qclr').onclick = () => { homeQuery = ''; inp.value = ''; renderResults(); inp.focus(); };
  renderResults();
  window.scrollTo(0, 0);
}

/* ---------- about ---------- */
function renderAbout() {
  const nSets = ATLAS.sets.length, nItems = ATLAS.sets.reduce((a, s) => a + s.items.length, 0);
  app.innerHTML = `<div class="wrap"><div class="prose">
    <h1>Про тренажер</h1>
    <p>Anatomia — тренажер анатомічної номенклатури за схемами: ${nSets} схем і ${nItems} структур з відкритих атласів. Відкривається у браузері й працює навіть без інтернету; ваш прогрес поки зберігається у цьому браузері.</p>
    <h2>Три режими</h2>
    <ul>
      <li><b>Огляд</b> — усі точки підписані. Клацніть точку або рядок легенди, щоб зіставити назву й місце. Тут нічого не перевіряється: це читання схеми перед тренуванням.</li>
      <li><b>Прямий</b> — точка → назва. Натисніть пронумеровану точку на схемі, потім її латинську назву внизу. Правильна відповідь зеленіє й переходить у легенду під картинкою.</li>
      <li><b>Зворотний</b> — назва → точка. Вам показують термін, потрібно знайти його місце на схемі. Це складніше за прямий, бо підказки з номера немає.</li>
      <li>Лічильник рахує помилки за прохід. Мета — <b>два проходи поспіль без жодної помилки</b> в кожному режимі; тоді схема вважається вивченою.</li>
    </ul>
    <h2>Сьогодні: інтервальне повторення</h2>
    <p>Кожна відповідь у прямому чи зворотному режимі запам’ятовується окремо для кожної структури. Правильна з першого разу — наступне повторення через 1, 3, 7, 14, 30 днів і далі; помилка — вже завтра. Розділ «Сьогодні» збирає те, що пора повторити, у сесії по 20 структур упереміш із різних схем, і показує лічильник у меню.</p>
    <h2>Мій прогрес</h2>
    <p>Готовність за розділами атласу, серія днів поспіль, теплова карта активності за 12 тижнів і список слабких структур — тих, де ви помилялись найчастіше, з кнопкою «Тренувати».</p>
    <h2>Колоди</h2>
    <p>Картки як в Anki: імпорт колод із файлів .apkg (з картинками) і текстових експортів, колоди з будь-якого розділу атласу. Навчання з чотирма оцінками — знову, важко, добре, легко — і лімітом нових карток на день. Картки з’являються на «Сьогодні» разом зі схемами.</p>
    <h2>Бліц</h2>
    <p>Сесія на 2, 5 чи 10 хвилин у дусі Drops: вибери назву, знайди на схемі, склади слово з плиток, з’єднай пари, правда чи ні. Комбо множить очки, денна ціль — 100 очок. Кожна відповідь іде в інтервальне повторення.</p>
    <h2>Режим «Письмо» і вимова</h2>
    <p>Четвертий режим тренажера: показується точка, а назву треба надрукувати латиною. Дрібні описки прощаються, підказка зараховує відповідь як «важко». Кнопка 🔊 біля терміна вимовляє його вголос, а після кожної відповіді з’являється розбір: корені слова, українська й англійська назви та структури, з якими ви цей термін плутали.</p>
    <h2>Планувальник FSRS</h2>
    <p>Повторення плануються за FSRS — тим самим алгоритмом, що в сучасній Anki: для кожної структури оцінюються складність і стабільність пам’яті, наступний показ призначається так, щоб імовірність пригадати була близько 90 %. Помилка повертає структуру через 10 хвилин того ж дня; «засвоєно» — коли ви пригадали її правильно у три різні дні. Структури, які забували 8 і більше разів, позначаються як «п’явки».</p>
    <h2>Пошук по терміну</h2>
    <p>Поле пошуку на головній шукає одразу по всьому атласу — і по латині, і по українських назвах, від двох символів. У списку видно, на якій схемі є структура; клік відкриває цю схему в режимі «Огляд» з підсвіченою точкою.</p>
    <h2>Керування картинкою</h2>
    <ul><li>Колесо миші або пінч — масштаб; перетягування — прокрутка.</li><li>Якщо точки на щільній схемі злипаються, вони автоматично розходяться по колу, а тонка пунктирна виноска показує справжнє місце. Наблизьте — і вони повернуться на свої місця.</li><li><kbd>Esc</kbd> знімає виділення.</li></ul>
    <h2>Свої схеми</h2>
    <p>У розділі «Мої схеми» можна завантажити власний скан або фото, розставити точки й підписати їх. Набори експортуються в JSON, щоб перенести їх на інший пристрій.</p>
    <h2>Теорія</h2>
    <p>Для тем без схем — картки фактів: м’язи (початок, прикріплення, функція, іннервація), суглоби (форма, поверхні, зв’язки, рухи), черепні нерви, кістки черепа, органи, провідні шляхи. Кожне поле повторюється окремо за FSRS; є тест із чотирма варіантами. Блок «Теорія» видно на сторінці теми курсу, черга — на «Сьогодні». Пошук на головній знаходить і ці картки.</p>
    <h2>3D-схеми</h2>
    <p>Хребці, крижова кістка й м’язи є також як 3D-моделі (позначка «3D» на картці): модель можна крутити пальцем чи мишею, наближати, а точки на ній — ті самі структури, що й на схемах, тож працюють усі режими тренажера. Точки на звороті моделі притухають, поверніть модель — і вони відкриються. Моделі — з відкритого проєкту Z-Anatomy.</p>
    <h2>Офлайн і резервна копія</h2>
    <p>Тренажер можна встановити на телефон як застосунок (меню браузера → «Додати на головний екран»). Відкриті схеми зберігаються для роботи без мережі; кнопка «Зберегти всі схеми для офлайну» на «Прогрес» завантажує весь атлас. Там само — резервна копія прогресу (JSON), щоб перенести його на інший пристрій.</p>
    <h2>Джерела</h2>
    <p>Схеми взято з Wikimedia Commons; переважно це роботи LadyofHats (Mariana Ruiz Villarreal), Jmarchn (Jordi March i Nogué) та інших авторів під ліцензіями Public domain, CC BY та CC BY‑SA. Посилання на джерело й автора наведено під кожною схемою. Друковані номери на схемах замінено інтерактивними точками.</p>
  </div></div>`;
  window.scrollTo(0, 0);
}

/* ---------- trainer ---------- */
const deckToSet = d => ({ id: 'my:' + d.id, title: d.name, cat: 'Мої схеми', file: null, deckId: d.id, w: 0, h: 0, items: d.pins.map((p, i) => ({ n: i + 1, pid: p.id, la: p.la, uk: p.uk, pts: [[p.x, p.y]] })), credit: null });
const Trainer = {
  set: null, mode: 'study', T: null, active: false,
  teardown() { this.active = false; this.set = null; this.T = null; document.documentElement.style.removeProperty('--panelh'); },
  async open(set, mode, src, hl) {
    this.set = set; this.mode = mode; this.active = true; setTitle(set.title);
    this.wantHl = Number(hl) || null;   // точка з пошуку — підсвітити після завантаження
    const n = set.items.length;
    app.innerHTML = `<div class="wrap">
      <div class="sethead">
        <a class="back" href="${set.deckId ? '#/my' : '#/atlas'}">← ${set.deckId ? 'Мої схеми' : 'Атлас'}</a>
        <h1>${esc(set.title)}</h1><span class="chip">${esc(set.cat)}</span><span class="muted">${n} структур</span>
        <span class="spacer"></span>
        ${set.deckId ? `<a href="#/edit/${set.deckId}"><button class="small">✎ Редагувати</button></a>` : ''}
        ${set.rel3d && ATLAS.sets.some(x => x.id === set.rel3d) ? `<a href="#/set/${set.rel3d}/${mode}"><button class="small primary btn3d">⬡ Відкрити в 3D</button></a>` : ''}
        ${set.rel2d && ATLAS.sets.some(x => x.id === set.rel2d) ? `<a href="#/set/${set.rel2d}/${mode}"><button class="small btn3d">▤ Схема</button></a>` : ''}
        <div class="modes"><button data-mode="study">Огляд</button><button data-mode="direct">Прямий</button><button data-mode="reverse">Зворотний</button><button data-mode="write">Письмо</button></div>
      </div>
      <div class="trainwrap">
        <div class="viewcol">
          <div class="statbar" id="statbar"></div>
          <div id="viewer"></div>
          <div id="explainBox" hidden></div>
        </div>
        <div class="legendwrap"><div class="legend" id="legend"></div>
          ${set.credit ? `<div class="credit">Схема: ${esc(set.credit.artist || 'Wikimedia Commons')} · ${set.credit.licurl ? `<a href="${esc(set.credit.licurl)}" target="_blank" rel="noopener">${esc(set.credit.license)}</a>` : esc(set.credit.license)} · <a href="${esc(set.credit.source)}" target="_blank" rel="noopener">джерело</a>. Номери замінено інтерактивними точками.</div>` : ''}
        </div>
        <aside class="panel" id="panel" ${mode === 'study' ? 'hidden' : ''}><h4 id="panelTitle">Назви</h4><div id="bank"></div></aside>
      </div></div>`;
    $$('.modes button').forEach(b => b.onclick = () => { location.hash = (set.deckId ? '#/my/' + set.deckId : '#/set/' + set.id) + '/' + b.dataset.mode; });
    $$('.modes button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    $('#viewer').classList.toggle('dense', n > 20);
    Viewer.mount($('#viewer'), { mode: 'train', onPinClick: id => this.pinClick(id), onImageClick: () => { if (this.T && this.mode === 'direct') { this.T.selPin = null; this.renderPins(); } if (this.mode === 'study') { this.hl = null; this.renderPins(); this.renderLegend(); } } });
    const ok = await Viewer.load(src, set.w, set.h);
    if (!this.active || this.set !== set) return;
    if (!ok) { $('#legend').innerHTML = '<div class="empty">Не вдалося завантажити картинку.</div>'; return; }
    this.start();
    this.focusViewer();
  },
  start() {
    const set = this.set, ids = set.items.map(i => i.n);
    this.hl = null;
    if (this.mode === 'study') { this.T = null; }
    else this.T = { order: shuffle(ids), bank: shuffle(ids), queue: shuffle(ids), done: new Set(), wrong: new Set(), hints: new Set(), selPin: null, selName: null, mistakes: 0, finished: false, hint: false, typed: null };
    const eb = $('#explainBox'); if (eb) { eb.hidden = true; eb.innerHTML = ''; }
    const want = this.wantHl; this.wantHl = null;
    if (this.mode === 'study' && want && this.item(want)) this.hl = want;
    this.renderAll();
    if (this.hl) {                                  // прийшли з пошуку: навести й прокрутити легенду
      const it = this.item(this.hl);
      if (it && it.pts[0]) Viewer.centerOn(it.pts[0][0], it.pts[0][1], 1.8);
      const row = $(`.legend .row[data-n="${this.hl}"]`);
      row && row.scrollIntoView({ block: 'nearest' });
    }
    this.focusViewer();
  },
  focusViewer() {
    if (this.T && matchMedia('(max-width:900px)').matches) {
      const v = $('#viewer');
      if (v) { window.scrollTo({ top: Math.max(0, v.getBoundingClientRect().top + window.scrollY - 62) }); return; }
    }
    window.scrollTo(0, 0);
  },
  item(n) { return this.set.items.find(i => i.n === n); },
  numOf(n) { return this.T ? this.T.order.indexOf(n) + 1 : n; },
  pinClick(id) {
    const n = +id.split(':')[0];
    if (this.mode === 'study') { this.hl = this.hl === n ? null : n; this.renderPins(); this.renderLegend(); this.showExplain(this.hl ? this.item(this.hl) : null); if (this.hl) { const row = $(`.legend .row[data-n="${n}"]`); row && row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
    const T = this.T; if (!T || T.finished || T.done.has(n)) return;
    if (this.mode === 'write') return;
    if (this.mode === 'direct') { if (T.selName) this.check(n, T.selName); else { T.selPin = T.selPin === n ? null : n; this.renderPins(); } }
    else { if (n === T.queue[0]) this.solve(n); else this.mistake(n, null); }
  },
  nameClick(n) { const T = this.T; if (!T || T.finished) return; if (T.selPin) this.check(T.selPin, n); else { T.selName = T.selName === n ? null : n; this.renderBank(); } },
  check(pin, name) { pin === name ? this.solve(pin) : this.mistake(pin, name); },
  solve(n) {
    const T = this.T; T.done.add(n); T.selPin = T.selName = null; T.hint = false;
    T.bank = T.bank.filter(x => x !== n); T.queue = T.queue.filter(x => x !== n);
    srsReview(this.set.id, structKey(this.item(n)), this.mode === 'write' ? 'reverse' : this.mode, !T.wrong.has(n), T.wrong.has(n) ? 'again' : (T.hints.has(n) ? 'hard' : 'good'));   // підказка = «важко»
    this.showExplain(this.item(n), 'ok');
    if (T.done.size === this.set.items.length) { T.finished = true; const p = progFor(this.set.id, this.mode); p.streak = T.mistakes === 0 ? p.streak + 1 : 0; p.passes++; p.best = p.best == null ? T.mistakes : Math.min(p.best, T.mistakes); saveProgress(); }
    this.renderAll();
    if (T.finished) setTimeout(() => $('#statbar').scrollIntoView({ block: 'nearest' }), 50);
  },
  mistake(pin, name) {
    const T = this.T; T.mistakes++; T.selName = null; T.selPin = this.mode === 'direct' ? pin : null;
    const tested = this.mode === 'direct' ? pin : T.queue[0]; T.wrong.add(tested);   // яку структуру питали
    const picked = this.mode === 'direct' ? name : pin; if (picked != null) noteConfusion(this.set.id, structKey(this.item(tested)), structKey(this.item(picked)));
    this.showExplain(this.item(tested), 'bad');
    this.renderAll();
    Viewer.flash(this.item(pin).pts.map((_, i) => pin + ':' + i), 'bad');
    if (name != null) { const el = $(`#bank .name[data-n="${name}"]`); if (el) { el.classList.add('bad'); setTimeout(() => el.classList.remove('bad'), 600); } }
    if (navigator.vibrate) navigator.vibrate(60);
  },
  renderAll() { this.renderPins(); this.renderBank(); this.renderLegend(); this.renderStat(); },
  showExplain(it, cls) { const eb = $('#explainBox'); if (!eb) return; if (!it) { eb.hidden = true; eb.innerHTML = ''; return; } eb.hidden = false; eb.innerHTML = explainHtml(this.set, it, { cls: cls || '', mode: this.mode === 'write' ? 'reverse' : this.mode }); },
  // режим «Письмо»: показуємо точку, просимо надрукувати латинську назву
  normLa(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\(.*?\)/g, ' ').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim(); },
  lev(a, b) { const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; },
  checkTyped(typed, it) {
    const t = this.normLa(typed); if (!t) return false;
    const variants = [this.normLa(it.la)]; const par = /\((.*?)\)/.exec(it.la); if (par) variants.push(this.normLa(par[1]));
    return variants.some(v => v && (v === t || this.lev(v, t) <= Math.min(2, Math.floor(v.length / 8))));
  },
  submitTyped() {
    const T = this.T; if (!T || T.finished || T.typed) return; const n = T.queue[0], it = this.item(n); const inp = $('#typedInput'); if (!inp) return;
    const ok = this.checkTyped(inp.value, it);
    T.typed = { ok, value: inp.value, exact: this.normLa(inp.value) === this.normLa(it.la), n };
    if (ok) { this.solve(n); return; }
    T.mistakes++; T.wrong.add(n); this.renderAll(); this.showExplain(it, 'bad'); if (navigator.vibrate) navigator.vibrate(60);
  },
  typedNext() { const T = this.T; if (!T || !T.typed) return; if (!T.typed.ok) T.queue.push(T.queue.shift()); T.typed = null; T.hint = false; this.renderAll(); if (!T.finished) { const i = $('#typedInput'); i && !matchMedia('(max-width:900px)').matches && i.focus(); } },
  teardownPanelHeight() { document.documentElement.style.removeProperty('--panelh'); },
  renderPins() {
    const T = this.T, list = [];
    for (const it of this.set.items) it.pts.forEach((p, i) => {
      let cls = '';
      if (T) { if (T.done.has(it.n)) cls = 'ok'; if (T.selPin === it.n) cls += ' sel'; if (this.mode === 'reverse' && !T.finished && T.done.has(it.n)) cls += ' dim'; }
      else if (this.hl != null) cls = this.hl === it.n ? 'hl' : 'dim';
      let label = this.numOf(it.n);
      if (T && this.mode === 'write' && !T.finished) { const cur = T.typed ? T.typed.n : T.queue[0]; if (it.n === cur) { cls = T.typed ? (T.typed.ok ? 'ok' : 'bad') : 'sel'; label = T.typed ? (T.typed.ok ? '✓' : '✕') : '?'; } else if (!T.done.has(it.n)) cls = 'dim'; }
      list.push({ id: it.n + ':' + i, x: p[0], y: p[1], label, cls, title: T && !T.done.has(it.n) ? '' : it.la });
    });
    Viewer.renderPins(list);
  },
  renderBank() {
    const T = this.T, panel = $('#panel'), b = $('#bank'), title = $('#panelTitle');
    if (!T) { panel.hidden = true; return; } panel.hidden = false;
    if (T.finished) {
      if (T.wrong.size) {
        title.textContent = 'Прохід завершено';
        b.innerHTML = `<div class="question" style="flex:1"><div class="q" style="font-style:normal;font-size:18px">${'Помилок: ' + T.mistakes}</div><div class="p">${this.progressText()}</div><div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="primary" id="againWrong">Тільки помилки (${T.wrong.size})</button><button id="againBtn">Усе ще раз</button></div></div>`;
        $('#againBtn').onclick = () => this.start();
        $('#againWrong').onclick = () => { const wrong = [...T.wrong]; this.start(); const T2 = this.T; T2.queue = T2.queue.filter(x => wrong.includes(x)); T2.bank = T2.bank.filter(x => wrong.includes(x)); this.set.items.forEach(it => { if (!wrong.includes(it.n)) T2.done.add(it.n); }); this.renderAll(); };
        this.syncPanelHeight(); return;
      }
      title.textContent = 'Прохід завершено';
      b.innerHTML = `<div class="question" style="flex:1"><div class="q" style="font-style:normal;font-size:18px">${T.mistakes ? 'Помилок: ' + T.mistakes : 'Без помилок ✔'}</div><div class="p">${this.progressText()}</div><div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="primary" id="againBtn">Ще раз</button>${this.mode === 'direct' ? `<button id="toReverse">Зворотний режим →</button>` : ''}</div></div>`;
      $('#againBtn').onclick = () => this.start();
      const tr = $('#toReverse'); if (tr) tr.onclick = () => $$('.modes button').find(x => x.dataset.mode === 'reverse').click();
      return;
    }
    if (this.mode === 'write') {
      const it = this.item(T.typed ? T.typed.n : T.queue[0]); title.textContent = 'Напишіть латиною';
      if (T.typed) {
        b.innerHTML = `<div class="rvbank"><div class="question"><div class="q" style="font-size:19px">${T.typed.ok ? (T.typed.exact ? 'Правильно ✔' : 'Зараховано, правильно: ') : 'Неправильно. Правильно: '}${T.typed.exact ? '' : `<i>${esc(it.la)}</i>`}</div>${T.typed.ok ? '' : `<div class="p">Ви написали: ${esc(T.typed.value || '—')}</div>`}<div style="margin-top:8px"><button class="primary" id="typedNext">Далі →</button></div></div></div>`;
        $('#typedNext').onclick = () => this.typedNext(); setTimeout(() => { const b = $('#typedNext'); b && b.focus(); }, 30);   // Enter = далі
      } else {
        const hint = T.hint ? `<div class="hintText">${esc(it.uk || '')} · ${esc(it.la.split(/\s+/).map(w => w[0] + '…').join(' '))}</div>` : `<button class="small ghost" id="hintBtn">Підказка (зарахується як «важко»)</button>`;
        b.innerHTML = `<div class="rvbank"><div class="question"><div class="p">${T.done.size + 1} з ${this.set.items.length} · точка зі знаком «?»</div><form id="typedForm" class="typedrow"><input type="text" id="typedInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Латинська назва" enterkeyhint="done"><button class="primary" type="submit">Перевірити</button></form><div class="hint">${hint}</div></div></div>`;
        $('#typedForm').onsubmit = e => { e.preventDefault(); this.submitTyped(); };
        const hb = $('#hintBtn'); if (hb) hb.onclick = () => { T.hint = true; T.hints.add(T.queue[0]); this.renderBank(); $('#typedInput').focus(); };
        if (!matchMedia('(max-width:900px)').matches) setTimeout(() => { const i = $('#typedInput'); i && i.focus(); }, 50);
      }
      this.syncPanelHeight(); return;
    }
    if (this.mode === 'direct') {
      title.textContent = `Назви · залишилось ${T.bank.length}`;
      b.innerHTML = T.bank.map(n => `<button class="name ${T.selName === n ? 'sel' : ''}" data-n="${n}"><i>${esc(this.item(n).la)}</i></button>`).join('');
      $$('#bank .name').forEach(el => el.onclick = () => this.nameClick(+el.dataset.n));
    } else {
      title.textContent = 'Знайдіть на схемі';
      const it = this.item(T.queue[0]);
      b.innerHTML = `<div class="question" style="flex:1"><div class="q">${esc(it.la)}</div><div class="p">${T.done.size + 1} з ${this.set.items.length}</div>
        <div class="hint">${T.hint ? `<div class="hintText">${esc(it.uk || '—')}</div>` : (it.uk ? `<button class="small ghost" id="hintBtn">Підказка (зарахується як «важко»)</button>` : '')}</div></div>`;
      const hb = $('#hintBtn'); if (hb) hb.onclick = () => { T.hint = true; T.hints.add(T.queue[0]); this.renderBank(); };
    }
    this.syncPanelHeight();
  },
  syncPanelHeight() {
    const panel = $('#panel');
    const h = (!panel || panel.hidden) ? 0 : Math.round(panel.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--panelh', h + 'px');
  },
  progressText() { const p = progFor(this.set.id, this.mode); return p.streak >= GOAL ? 'Мета досягнута: ' + p.streak + ' чистих проходи поспіль 🎉' : `Чистих проходів поспіль: ${p.streak} з ${GOAL}`; },
  renderLegend() {
    const T = this.T, L = $('#legend'), set = this.set;
    const row = (it, cls) => `<div class="row ${cls}" data-n="${it.n}"><span class="num">${this.numOf(it.n)}</span><span class="txt"><i>${esc(it.la)}</i>${it.uk ? `<span>${esc(it.uk)}</span>` : ''}</span></div>`;
    if (!T) {
      L.innerHTML = `<h4>Легенда · ${set.items.length}</h4><div class="cols" style="--rows:${Math.ceil(set.items.length / 2)}">${set.items.map(it => row(it, this.hl === it.n ? 'hl' : '')).join('')}</div>`;
      $$('.legend .row').forEach(r => r.onclick = () => { const n = +r.dataset.n; this.hl = this.hl === n ? null : n; this.renderPins(); this.renderLegend(); this.showExplain(this.hl ? this.item(n) : null); if (this.hl) { const it = this.item(n); Viewer.centerOn(it.pts[0][0], it.pts[0][1], 1.6); } });
      return;
    }
    const done = set.items.filter(it => T.done.has(it.n)).sort((a, b) => this.numOf(a.n) - this.numOf(b.n));
    L.innerHTML = `<h4>Легенда · ${done.length} з ${set.items.length}</h4>` + (done.length ? `<div class="cols" style="--rows:${Math.ceil(done.length / 2)}">${done.map(it => row(it, 'ok')).join('')}</div>` : `<div class="muted" style="font-size:14px">${this.mode === 'direct' ? 'Натисніть точку на схемі, потім назву в панелі.' : 'Знайдіть на схемі точку, що відповідає назві.'}</div>`);
    $$('.legend .row').forEach(r => r.onclick = () => { const it = this.item(+r.dataset.n); Viewer.centerOn(it.pts[0][0], it.pts[0][1]); });
  },
  renderStat() {
    const s = $('#statbar'), T = this.T;
    if (!T) { s.innerHTML = `<span class="muted">Режим огляду: усі точки підписані. Клацніть точку або рядок легенди.</span><span class="spacer"></span><button class="small primary" id="startDirect">Почати тренування →</button>`; $('#startDirect').onclick = () => $$('.modes button').find(x => x.dataset.mode === 'direct').click(); return; }
    const p = progFor(this.set.id, this.mode);
    s.innerHTML = `<span>Помилки: <b>${T.mistakes}</b></span><span>Чисті проходи: <span class="dots">${Array.from({ length: GOAL }, (_, i) => `<span class="${i < p.streak ? 'f' : ''}"></span>`).join('')}</span> <b>${p.streak}</b>/${GOAL}</span>
      ${T.finished ? `<span class="result ${T.mistakes ? 'bad' : 'good'}">${T.mistakes ? 'Є помилки — серію скинуто' : (p.streak >= GOAL ? 'Чистий прохід! Мета досягнута 🎉' : 'Чистий прохід! Ще ' + (GOAL - p.streak))}</span>` : ''}
      <span class="spacer"></span><button class="small" id="shuffleBtn">Перемішати</button><button class="small ghost" id="resetStreak" title="Обнулити серію">Скинути серію</button>`;
    $('#shuffleBtn').onclick = () => this.start();
    $('#resetStreak').onclick = async () => { if (await confirmDlg('Скинути серію?', 'Лічильник чистих проходів у цьому режимі стане 0.')) { p.streak = 0; saveProgress(); this.renderStat(); } };
  }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Trainer.active && Trainer.T && !$('dialog[open]')) { Trainer.T.selPin = Trainer.T.selName = null; Trainer.renderPins(); Trainer.renderBank(); } });

function renderSet(set, mode, hl) { Trainer.open(set, ['study', 'direct', 'reverse', 'write'].includes(mode) ? mode : 'study', imgUrl(set.file), hl); }
async function renderCustomSet(d, mode, hl) { const set = deckToSet(d); const src = d.hasImage ? await IMG.get(d.id) : null; Trainer.open(set, ['study', 'direct', 'reverse', 'write'].includes(mode) ? mode : 'study', src, hl); }

/* ---------- сьогодні: сесія повторення ---------- */
function focusViewerMobile() {
  if (matchMedia('(max-width:900px)').matches) {
    const v = $('#viewer');
    if (v) { window.scrollTo({ top: Math.max(0, v.getBoundingClientRect().top + window.scrollY - 62) }); return; }
  }
  window.scrollTo(0, 0);
}
function queueBySet(due) {
  const m = new Map();
  for (const x of due) { const k = x.set.id + '|' + x.mode; const q = m.get(k) || { title: x.set.title, href: x.href, mode: x.mode, n: 0, due: x.r.due }; q.n++; m.set(k, q); }
  return [...m.values()].sort((a, b) => b.n - a.n || a.due - b.due);
}
function weakList(list) {
  return `<div class="legend weak">${list.map(x => `<div class="row"><span class="num bad" title="${x.r.leech ? 'П’явка: забували 8+ разів' : 'Разів забували'}">${x.r.leech ? '!' : x.r.lapses}</span>
    <span class="txt"><i>${esc(x.it.la)}</i>${x.it.uk ? `<span>${esc(x.it.uk)}</span>` : ''}<small>${esc(x.set.title)} · ${x.mode === 'direct' ? 'прямий' : 'зворотний'}</small></span>
    <a href="${x.href}/${x.mode}"><button class="small">Тренувати</button></a></div>`).join('')}</div>`;
}
const Review = {
  active: false, q: [], i: 0, cur: null, locked: false, picked: null, opts: [], loadedSet: null, results: [],
  teardown() { this.active = false; this.q = []; this.cur = null; document.documentElement.style.removeProperty('--panelh'); },
  renderStart() {
    const due = srsDue(), weak = srsWeak(10), total = Object.keys(srs).length, todayN = days[dayKey()] || 0;
    const text = due.length ? `Пора повторити ${due.length} ${plural(due.length, 'структуру', 'структури', 'структур')}. Сесія — до 20 за раз, упереміш зі схем, які ви вже тренували, в обох режимах.`
      : total ? 'На сьогодні все повторено. Загляньте у слабкі структури або відкрийте нову схему в атласі.'
      : 'Тут з’являтимуться структури, які пора повторити. Спершу пройдіть будь-яку схему в прямому чи зворотному режимі.';
    app.innerHTML = `<div class="wrap">
      <section class="page-hero"><h1>Сьогодні</h1><p>${text}</p></section>
      <div class="tiles"><div class="tile"><b>${due.length}</b><span>до повторення</span></div><div class="tile"><b>${total}</b><span>у повторенні</span></div><div class="tile"><b>${todayN}</b><span>відповідей сьогодні</span></div><div class="tile"><b>${streakDays()}</b><span>${plural(streakDays(), 'день', 'дні', 'днів')} поспіль</span></div></div>
      <div class="actions">${due.length ? `<a href="#/today/session"><button class="primary">Повторити ${Math.min(20, due.length)} →</button></a>` : `<a href="#/atlas"><button class="primary">До атласу →</button></a>`}<a href="#/progress"><button>Мій прогрес</button></a></div>
      ${EXT.today.map(f => f(due)).join('')}
      ${due.length ? `<h2 class="section-title">На черзі</h2><div class="queue">${queueBySet(due).map(q => `<a href="${q.href}/${q.mode}"><span class="t">${esc(q.title)}</span><span class="c">${q.n} · ${q.mode === 'direct' ? 'прямий' : 'зворотний'}</span></a>`).join('')}</div>` : ''}
      ${weak.length ? `<h2 class="section-title">Слабкі структури</h2>${weakList(weak.slice(0, due.length ? 5 : 10))}${weak.length > 5 && due.length ? `<p style="margin:10px 0 0"><a href="#/progress" class="muted" style="text-decoration:underline;text-underline-offset:3px;font-size:14px">Усі слабкі структури →</a></p>` : ''}` : ''}
      ${!total ? `<h2 class="section-title">Як це працює</h2><div class="prose" style="padding:0"><ul>
        <li>Кожна відповідь у прямому чи зворотному режимі запам’ятовується окремо для кожної структури.</li>
        <li>Правильно з першого разу — наступне повторення через 1, 3, 7, 14, 30 днів; помилка — вже завтра.</li>
        <li>Тут збирається те, що пора повторити: сесії по 20 структур упереміш із різних схем. Лічильник видно у меню.</li></ul></div>` : ''}
    </div>`;
    window.scrollTo(0, 0);
  },
  async begin() {
    const due = srsDue().slice(0, 20);
    if (!due.length) { location.hash = '#/today'; return; }
    this.relearn = [];
    // групуємо за схемою, щоб не перевантажувати картинку на кожне питання; порядок схем випадковий
    const bySet = new Map(); due.forEach(x => { const a = bySet.get(x.set.id) || []; a.push(x); bySet.set(x.set.id, a); });
    this.q = shuffle([...bySet.values()]).flatMap(a => shuffle(a));
    this.i = 0; this.results = []; this.active = true; this.loadedSet = null; this.cur = null;
    app.innerHTML = `<div class="wrap">
      <div class="sethead"><a class="back" href="#/today">← Сьогодні</a><h1 id="rvTitle"></h1><span class="chip" id="rvCat"></span><span class="spacer"></span><span class="muted" id="rvCount"></span></div>
      <div class="trainwrap">
        <div class="viewcol"><div class="statbar" id="statbar"></div><div id="viewer"></div><div id="rvExplain" hidden></div></div>
        <div class="legendwrap"><div class="legend" id="legend"></div></div>
        <aside class="panel" id="panel"><h4 id="panelTitle">Питання</h4><div id="bank"></div></aside>
      </div></div>`;
    Viewer.mount($('#viewer'), { mode: 'train', onPinClick: id => this.pinClick(id) });
    await this.next();
  },
  async next() {
    if (!this.active) return;
    if (this.i >= this.q.length) { if (this.relearn.length) { this.q = this.q.concat(this.relearn); this.relearn = []; } else return this.finish(); }
    const cur = this.cur = this.q[this.i]; this.locked = false; this.picked = null;
    const eb = $('#rvExplain'); if (eb) { eb.hidden = true; eb.innerHTML = ''; }
    if (this.loadedSet !== cur.set.id) {
      const src = cur.set.deckId ? await IMG.get(cur.set.deckId) : imgUrl(cur.set.file);
      const ok = await Viewer.load(src, cur.set.w, cur.set.h);
      if (!this.active) return;
      if (!ok) { this.i++; return this.next(); }
      this.loadedSet = cur.set.id;
      $('#viewer').classList.toggle('dense', cur.set.items.length > 20);
    }
    $('#rvTitle').textContent = cur.set.title; $('#rvCat').textContent = cur.set.cat;
    $('#rvCount').textContent = `${this.i + 1} з ${this.q.length}`;
    if (cur.mode === 'direct') this.opts = shuffle([cur.it, ...shuffle(cur.set.items.filter(x => x.n !== cur.it.n)).slice(0, 5)]);
    this.renderPins(); this.renderBank(); this.renderStat(); this.renderLog();
    if (cur.mode === 'direct') Viewer.centerOn(cur.it.pts[0][0], cur.it.pts[0][1]);
    focusViewerMobile();
  },
  renderPins() {
    const cur = this.cur, list = [];
    cur.set.items.forEach((it, idx) => it.pts.forEach((p, i) => {
      let cls = '';
      if (cur.mode === 'direct') cls = it.n === cur.it.n ? 'sel' : 'dim';
      if (this.locked) { if (it.n === cur.it.n) cls = 'ok'; else if (this.picked === it.n) cls = 'bad'; else if (cur.mode === 'direct') cls = 'dim'; }
      list.push({ id: it.n + ':' + i, x: p[0], y: p[1], label: this.locked && it.n === cur.it.n ? '✓' : (cur.mode === 'direct' && it.n === cur.it.n ? '?' : idx + 1), cls, title: this.locked ? it.la : '' });
    }));
    Viewer.renderPins(list);
  },
  pinClick(id) { if (!this.cur || this.locked || this.cur.mode !== 'reverse') return; const n = +id.split(':')[0]; this.answer(n === this.cur.it.n, n); },
  answer(ok, picked) {
    const cur = this.cur; this.locked = true; this.picked = picked;
    srsReview(cur.set.id, structKey(cur.it), cur.mode, ok);
    if (!ok && picked != null) { const p = cur.set.items.find(x => x.n === picked); if (p) noteConfusion(cur.set.id, structKey(cur.it), structKey(p)); }
    if (!ok) this.relearn.push(cur);   // короткий крок: ще раз наприкінці сесії
    const eb = $('#rvExplain'); if (eb) { eb.hidden = false; eb.innerHTML = explainHtml(cur.set, cur.it, { cls: ok ? 'ok' : 'bad', mode: cur.mode }); }
    this.results.push({ x: cur, ok });
    if (!ok && navigator.vibrate) navigator.vibrate(60);
    this.i++;
    this.renderPins(); this.renderBank(); this.renderStat(); this.renderLog();
    if (ok) setTimeout(() => { if (this.active && this.locked) this.next(); }, 650);
    else Viewer.centerOn(cur.it.pts[0][0], cur.it.pts[0][1]);
  },
  renderBank() {
    const cur = this.cur, b = $('#bank'), title = $('#panelTitle');
    if (cur.mode === 'direct') {
      title.textContent = 'Що це за структура?';
      b.innerHTML = `<div class="rvbank"><div class="opts">${this.opts.map(it => { let cls = ''; if (this.locked) { if (it.n === cur.it.n) cls = 'ok'; else if (this.picked === it.n) cls = 'bad'; } return `<button class="name ${cls}" data-n="${it.n}"><i>${esc(it.la)}</i></button>`; }).join('')}</div>
        ${this.locked && !this.results[this.results.length - 1].ok ? `<div class="question" style="display:flex;align-items:center;gap:10px;justify-content:space-between;text-align:left"><div class="p">${esc(cur.it.uk || '')}</div><button class="primary" id="rvNext">Далі →</button></div>` : ''}</div>`;
      $$('#bank .name').forEach(el => el.onclick = () => { if (this.locked) return; this.answer(+el.dataset.n === cur.it.n, +el.dataset.n); });
    } else {
      title.textContent = 'Знайдіть на схемі';
      const last = this.results[this.results.length - 1];
      b.innerHTML = `<div class="question" style="flex:1"><div class="q">${esc(cur.it.la)}</div>
        <div class="p">${this.locked ? (last.ok ? 'Правильно ✔' : 'Не туди — правильна точка зелена') + (cur.it.uk ? ' · ' + esc(cur.it.uk) : '') : 'Знайдіть точку на схемі'}</div>
        ${this.locked && !last.ok ? `<div style="margin-top:8px"><button class="primary" id="rvNext">Далі →</button></div>` : ''}</div>`;
    }
    const nx = $('#rvNext'); if (nx) nx.onclick = () => this.next();
    Trainer.syncPanelHeight();
  },
  renderStat() {
    const ok = this.results.filter(r => r.ok).length, bad = this.results.length - ok;
    $('#statbar').innerHTML = `<span>Правильно: <b>${ok}</b></span><span>Помилки: <b>${bad}</b></span><span class="muted">${this.cur.mode === 'direct' ? 'Прямий режим' : 'Зворотний режим'}</span>`;
  },
  renderLog() {
    const bad = this.results.filter(r => !r.ok), L = $('#legend');
    L.innerHTML = bad.length ? `<h4>Помилки цієї сесії · ${bad.length}</h4><div class="log">` + bad.map(r => `<div class="row"><span class="num">${r.x.set.items.indexOf(r.x.it) + 1}</span><span class="txt"><i>${esc(r.x.it.la)}</i>${r.x.it.uk ? `<span>${esc(r.x.it.uk)}</span>` : ''}<span>· ${esc(r.x.set.title)}</span></span></div>`).join('') + '</div>'
      : `<div class="muted" style="font-size:14px">${this.cur.mode === 'direct' ? 'Точка зі знаком «?» підсвічена — оберіть її назву в панелі.' : 'Знайдіть на схемі точку, що відповідає назві.'}</div>`;
  },
  finish() {
    const ok = this.results.filter(r => r.ok).length, n = this.results.length, more = srsDue().length;
    this.active = false;
    $('#panelTitle').textContent = 'Сесію завершено';
    $('#bank').innerHTML = `<div class="question" style="flex:1"><div class="q" style="font-style:normal;font-size:18px">${ok} з ${n} правильно</div><div class="p">${more ? `Ще ${more} ${plural(more, 'структура чекає', 'структури чекають', 'структур чекають')} на повторення` : 'На сьогодні все повторено 🎉'}</div>
      <div style="margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">${more ? `<button class="primary" id="rvMore">Ще ${Math.min(20, more)}</button>` : ''}<a href="#/today"><button>До «Сьогодні»</button></a><a href="#/progress"><button class="ghost">Мій прогрес</button></a></div></div>`;
    const m = $('#rvMore'); if (m) m.onclick = () => this.begin();
    $('#rvCount').textContent = `${n} з ${n}`;
    Trainer.syncPanelHeight();
    setTimeout(() => $('#statbar').scrollIntoView({ block: 'nearest' }), 50);
  }
};

/* ---------- мій прогрес ---------- */
function renderProgress() {
  const doneSet = s => progFor(s.id, 'direct').streak >= GOAL && progFor(s.id, 'reverse').streak >= GOAL;
  const cats = ATLAS.categories.filter(c => ATLAS.sets.some(s => s.cat === c));
  const rows = cats.map(c => { const l = ATLAS.sets.filter(s => s.cat === c), d = l.filter(doneSet).length; return { c, d, t: l.length, pct: Math.round(d / l.length * 100) }; });
  const my = decks.filter(d => d.pins.length && d.hasImage).map(deckToSet);
  if (my.length) { const d = my.filter(doneSet).length; rows.push({ c: 'Мої схеми', d, t: my.length, pct: Math.round(d / my.length * 100) }); }
  const totalDone = ATLAS.sets.filter(doneSet).length;
  // теплова карта: 12 тижнів по стовпчиках, рядки — пн…нд, закінчується поточним тижнем
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(end.getDate() - (end.getDay() + 6) % 7 - 7 * 11);
  const cells = []; let max = 0;
  for (let i = 0; i < 84; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const k = dayKey(d), v = days[k] || 0; max = Math.max(max, v); cells.push({ k, v, future: d > end, today: d.getTime() === end.getTime() }); }
  const lvl = v => !v ? '' : v >= max * 0.66 ? 'l3' : v >= max * 0.33 ? 'l2' : 'l1';
  const weak = srsWeak(20), totalAns = Object.values(days).reduce((a, b) => a + b, 0), activeDays = Object.keys(days).length, streak = streakDays();
  const inSrs = Object.keys(srs).length, dueN = srsDue().length;
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Мій прогрес</h1><p>Готовність за розділами атласу, активність і структури, які варто підтягнути. Усе рахується з проходів у прямому та зворотному режимах.</p></section>
    <div class="tiles">
      <div class="tile"><b>${totalDone}<small class="muted" style="font-size:16px"> / ${ATLAS.sets.length}</small></b><span>схем вивчено</span></div>
      <div class="tile"><b>${streak}</b><span>${plural(streak, 'день', 'дні', 'днів')} поспіль</span></div>
      <div class="tile"><b>${activeDays}</b><span>активних днів</span></div>
      <div class="tile"><b>${totalAns}</b><span>відповідей усього</span></div>
      <div class="tile"><b>${dueN}<small class="muted" style="font-size:16px"> / ${inSrs}</small></b><span>до повторення</span></div>
    </div>
    <h2 class="section-title">Готовність за розділами</h2>
    <div class="bars">${rows.map(r => `<div class="bar"><span class="lbl" title="${esc(r.c)}">${esc(r.c)}</span><div class="track"><div class="fill" style="width:${r.pct}%"></div></div><span class="pct">${r.pct}%<small>${r.d}/${r.t}</small></span></div>`).join('')}</div>
    <h2 class="section-title">Активність за 12 тижнів</h2>
    <div class="heat"><span>пн</span><span></span><span>ср</span><span></span><span>пт</span><span></span><span>нд</span>${cells.map(c => `<div class="${lvl(c.v)} ${c.today ? 'today' : ''} ${c.future ? 'future' : ''}" title="${c.k}: ${c.v} ${plural(c.v, 'відповідь', 'відповіді', 'відповідей')}"></div>`).join('')}</div>
    <h2 class="section-title">Слабкі структури</h2>
    ${weak.length ? `<p class="muted" style="margin:-4px 0 12px;font-size:14px">Топ за кількістю забувань. Кнопка відкриває схему в тому режимі, де були помилки.</p>${weakList(weak)}`
      : `<div class="empty">${inSrs ? 'Поки без помилок після першого знайомства — так тримати.' : 'Пройдіть кілька схем у прямому чи зворотному режимі — тут з’являться структури, які даються найважче.'}</div>`}
    <h2 class="section-title">Дані та офлайн</h2>
    <p class="muted" style="margin:-4px 0 12px;font-size:14px">Прогрес зберігається у цьому браузері. Щоб перенести його на інший пристрій або не втратити при чищенні браузера — збережіть резервну копію (JSON) і завантажте її там. Картинки власних схем і колод у копію не входять — їх експортуйте окремо на сторінці схеми чи колоди.</p>
    <div class="actions"><button id="bkExport">Зберегти резервну копію</button><button id="bkImport">Відновити з копії…</button><button id="bkOffline" ${'serviceWorker' in navigator && navigator.serviceWorker.controller ? '' : 'disabled title="Доступно після встановлення офлайн-режиму (потрібен https або localhost)"'}>Зберегти всі схеми для офлайну</button><span id="bkStatus" class="muted" style="font-size:13px"></span></div>
  </div>`;
  const bkKeys = () => Object.keys(localStorage).filter(k => k.startsWith('anat.'));
  $('#bkExport').onclick = () => { const data = {}; for (const k of bkKeys()) data[k] = localStorage.getItem(k); download(`anatomia-backup-${dayKey()}.json`, { app: 'anatomia', kind: 'backup', version: 1, at: new Date().toISOString(), data }); };
  $('#bkImport').onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json'; inp.onchange = async () => { const f = inp.files[0]; if (!f) return;
    let obj; try { obj = JSON.parse(await f.text()); } catch (e) { return alertDlg('Це не файл резервної копії.'); }
    if (!obj || obj.kind !== 'backup' || !obj.data) return alertDlg('Це не файл резервної копії Anatomia.');
    const n = Object.keys(obj.data).length; if (!await confirmDlg('Відновити з копії?', `${n} ${plural(n, 'запис', 'записи', 'записів')} від ${obj.at ? new Date(obj.at).toLocaleString('uk-UA') : '—'} замінять поточний прогрес у цьому браузері.`)) return;
    for (const k of bkKeys()) localStorage.removeItem(k); for (const [k, v] of Object.entries(obj.data)) if (k.startsWith('anat.')) localStorage.setItem(k, v);
    location.reload(); }; inp.click(); };
  $('#bkOffline').onclick = () => { const sw = navigator.serviceWorker.controller; if (!sw) return; const urls = [...new Set(ATLAS.sets.map(s => imgUrl(s.file)))]; const ch = new MessageChannel(); const st = $('#bkStatus'); st.textContent = 'Зберігаємо…';
    ch.port1.onmessage = e => { const d = e.data; st.textContent = d.finished ? `Готово: ${d.done - d.fail} з ${d.total} схем збережено${d.fail ? `, не вдалося ${d.fail}` : ''}.` : `${d.done} / ${d.total}…`; };
    sw.postMessage({ type: 'precache', urls }, [ch.port2]); };
  window.scrollTo(0, 0);
}

/* ---------- my decks ---------- */
function renderMy() {
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><h1>Мої схеми</h1><span class="muted">${decks.length}</span><span class="spacer"></span><button id="importBtn">Імпорт JSON</button><button class="primary" id="newDeck">＋ Нова схема</button></div>
    ${decks.length ? `<div class="grid">${decks.map(d => `<div class="card" data-id="${d.id}">
        <div class="thumb"><img data-img="${d.id}" alt=""></div>
        <div class="body"><h3>${esc(d.name)}</h3><div class="meta"><span>${d.pins.length} структур</span>${d.hasImage ? '' : '<span class="muted">без картинки</span>'}</div>
        <div class="prog" style="gap:8px"><a href="#/my/${d.id}/direct"><button class="small primary">Тренувати</button></a><a href="#/edit/${d.id}"><button class="small">Редагувати</button></a><span class="spacer"></span><button class="small ghost" data-del="${d.id}" title="Видалити">🗑</button></div></div></div>`).join('')}</div>`
      : `<div class="empty">Ще немає жодної схеми. Натисніть «Нова схема», завантажте картинку й розставте точки.</div>`}
  </div>`;
  $$('img[data-img]').forEach(async im => { const d = decks.find(x => x.id === im.dataset.img); if (d && d.hasImage) im.src = await IMG.get(d.id) || ''; });
  $$('.card[data-id]').forEach(c => c.onclick = e => { if (e.target.closest('button,a')) return; location.hash = '#/edit/' + c.dataset.id; });
  $$('button[data-del]').forEach(b => b.onclick = async () => { const d = decks.find(x => x.id === b.dataset.del); if (!await confirmDlg('Видалити схему?', `«${d.name}» разом із картинкою та ${d.pins.length} точками.`)) return; await IMG.del(d.id); decks = decks.filter(x => x !== d); delete progress['my:' + d.id]; saveProgress(); Object.keys(srs).filter(k => k.startsWith('my:' + d.id + '|')).forEach(k => delete srs[k]); saveSrs(); updateBadge(); saveDecks(); renderMy(); });
  $('#newDeck').onclick = async () => { const n = await askText('Назва схеми', 'Схема ' + (decks.length + 1)); if (n == null) return; const d = { id: uid(), name: n || ('Схема ' + (decks.length + 1)), pins: [], hasImage: false }; decks.push(d); saveDecks(); location.hash = '#/edit/' + d.id; };
  $('#importBtn').onclick = () => $('#fileJson').click();
  window.scrollTo(0, 0);
}
$('#fileJson').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let obj; try { obj = JSON.parse(await f.text()); } catch (err) { return alertDlg('Не вдалося прочитати JSON.'); }
  const list = Array.isArray(obj.decks) ? obj.decks : (obj.pins ? [obj] : []);
  if (!list.length) return alertDlg('У файлі немає схем.');
  let cnt = 0;
  for (const d of list) {
    if (!d || !Array.isArray(d.pins)) continue;
    const id = d.id || uid();
    const nd = { id, name: String(d.name || 'Імпорт'), hasImage: !!d.image, pins: d.pins.filter(p => p && typeof p.x === 'number' && typeof p.y === 'number' && p.la).map(p => ({ id: p.id || uid(), x: p.x, y: p.y, la: String(p.la), uk: String(p.uk || '') })) };
    const i = decks.findIndex(x => x.id === id); if (i >= 0) decks[i] = nd; else decks.push(nd);
    if (d.image) await IMG.set(id, d.image); cnt++;
  }
  saveDecks(); renderMy(); alertDlg(`Імпортовано схем: ${cnt}.`);
};

/* ---------- editor ---------- */
const Editor = {
  deck: null, sel: null,
  async open(d) {
    this.deck = d; this.sel = null;
    app.innerHTML = `<div class="wrap">
      <div class="sethead"><a class="back" href="#/my">← Мої схеми</a><input type="text" id="deckName" value="${esc(d.name)}" style="font-size:18px;min-width:220px"><span class="spacer"></span>
        ${(() => { const c = window.Course && Course.course(); if (!c) return ''; return `<select id="deckTopic" title="Тема курсу"><option value="">Без теми курсу</option>${c.modules.map(m => `<optgroup label="${esc(m.short)}">${m.topics.map(t => `<option value="${Course.id}:${m.id}:${t.n}" ${d.topic === `${Course.id}:${m.id}:${t.n}` ? 'selected' : ''}>${t.n}. ${esc(t.title.split('.')[0].slice(0, 60))}</option>`).join('')}</optgroup>`).join('')}</select>`; })()}
        <button id="pickImg">Картинка…</button><button id="exportDeck">Експорт</button><a href="#/my/${d.id}/direct"><button class="primary">Тренувати →</button></a></div>
      <div class="editbar"><span class="hint">Клік по картинці — нова точка. Точку можна тягнути; тап по точці — редагувати назву. Колесо / пінч — зум, перетягування — пан.</span></div>
      <div class="trainwrap" style="grid-template-columns:minmax(0,1fr)">
        <div class="viewcol"><div id="viewer"></div></div>
        <div class="legendwrap"><div class="pinlist legend" id="pinlist"></div></div>
      </div></div>`;
    $('#deckName').onchange = e => { d.name = e.target.value.trim() || d.name; e.target.value = d.name; saveDecks(); };
    const dt = $('#deckTopic'); if (dt) dt.onchange = () => { d.topic = dt.value || null; saveDecks(); };
    $('#pickImg').onclick = () => $('#fileImg').click();
    $('#exportDeck').onclick = async () => download(`anatomia-${d.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.json`, { app: 'anatomia', version: 1, decks: [{ id: d.id, name: d.name, pins: d.pins, image: d.hasImage ? await IMG.get(d.id) : null }] });
    const v = $('#viewer');
    Viewer.mount(v, { mode: 'edit', onPinClick: id => this.edit(d.pins.find(p => p.id === id)), onPinMove: (id, pos) => { const p = d.pins.find(x => x.id === id); if (p && pos) { p.x = pos.x; p.y = pos.y; saveDecks(); } }, onImageClick: (cx, cy) => this.add(cx, cy) });
    v.addEventListener('dragover', e => { e.preventDefault(); v.classList.add('over'); });
    v.addEventListener('dragleave', () => v.classList.remove('over'));
    v.addEventListener('drop', e => { e.preventDefault(); v.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) this.setImage(f); });
    await Viewer.load(d.hasImage ? await IMG.get(d.id) : null);
    this.render();
  },
  async setImage(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    await IMG.set(this.deck.id, data); this.deck.hasImage = true; saveDecks();
    await Viewer.load(data); this.render();
  },
  async add(cx, cy) {
    const d = this.deck, p = Viewer.toPct(cx, cy);
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return;
    const pin = { id: uid(), x: +p.x.toFixed(2), y: +p.y.toFixed(2), la: '', uk: '' };
    d.pins.push(pin); this.sel = pin.id; this.renderPins();
    const r = await pinDialog(pin, false);
    if (r && r !== 'del') Object.assign(pin, r); else d.pins = d.pins.filter(x => x !== pin);
    saveDecks(); this.render();
  },
  async edit(pin) {
    if (!pin) return; this.sel = pin.id; this.renderPins();
    const r = await pinDialog(pin, true);
    if (r === 'del') this.deck.pins = this.deck.pins.filter(x => x !== pin); else if (r) Object.assign(pin, r);
    saveDecks(); this.render();
  },
  renderPins() { Viewer.renderPins(this.deck.pins.map((p, i) => ({ id: p.id, x: p.x, y: p.y, label: i + 1, cls: this.sel === p.id ? 'hl' : '', title: p.la }))); },
  render() {
    this.renderPins(); const d = this.deck, l = $('#pinlist');
    l.innerHTML = `<h4>Точки · ${d.pins.length}</h4>` + (d.pins.length ? d.pins.map((p, i) => `<div class="row" data-id="${p.id}"><span class="num">${i + 1}</span><span class="txt"><i>${esc(p.la)}</i>${p.uk ? `<span>${esc(p.uk)}</span>` : ''}</span><button class="small" data-act="edit">✎</button><button class="small danger" data-act="del">🗑</button></div>`).join('')
      : `<div class="muted" style="font-size:14px">${Viewer.V.ready ? 'Клацніть по картинці, щоб додати першу точку.' : 'Спершу завантажте картинку: кнопка «Картинка…» або перетягніть файл на поле.'}</div>`);
    $$('#pinlist .row').forEach(row => { const pin = d.pins.find(p => p.id === row.dataset.id); row.onclick = e => { const a = e.target.dataset.act; if (a === 'edit') this.edit(pin); else if (a === 'del') { d.pins = d.pins.filter(x => x !== pin); saveDecks(); this.render(); } else { this.sel = pin.id; this.renderPins(); Viewer.centerOn(pin.x, pin.y); } }; });
  }
};
function renderEditor(d) { Editor.open(d); }
$('#fileImg').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f && Editor.deck && location.hash.startsWith('#/edit/')) Editor.setImage(f); };
function download(name, obj) { const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }

// перший рендер — коли всі модулі (js/*.js) зареєстрували маршрути й ініціалізації
const boot = () => Promise.all(INIT.map(f => f())).catch(e => console.error(e)).then(route);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
