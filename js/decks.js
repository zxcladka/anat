/* ---------- Колоди карток: імпорт з Anki (.apkg / текст), навчання з оцінками ---------- */
'use strict';
(() => {
const DECKS_KEY = 'anat.cards.decks', NEW_KEY = 'anat.cards.new';
let cardDecks = LS.get(DECKS_KEY, []);
const saveCardDecks = () => LS.set(DECKS_KEY, cardDecks);
const CARDS = new Map();                                   // id → { id, deck, ord, front, back }
const byDeck = deckId => [...CARDS.values()].filter(c => c.deck === deckId).sort((a, b) => a.ord - b.ord);
const deckOf = id => cardDecks.find(d => d.id === id);
const cardKey = id => srsKey('card', id, 'card');

/* ---- IndexedDB: картки та медіа ---- */
const CDB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    let r; try { r = indexedDB.open('anat-cards', 1); } catch (e) { return rej(e); }
    r.onupgradeneeded = () => { const db = r.result; const st = db.createObjectStore('cards', { keyPath: 'id' }); st.createIndex('deck', 'deck'); db.createObjectStore('media', { keyPath: 'key' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = async (store, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(store, mode); const req = fn(t.objectStore(store)); t.oncomplete = () => res(req && 'result' in req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const delRange = (store, range) => tx(store, 'readwrite', s => { s.openKeyCursor(range).onsuccess = e => { const c = e.target.result; if (c) { s.delete(c.primaryKey); c.continue(); } }; });
  return {
    all: () => tx('cards', 'readonly', s => s.getAll()),
    putCards: cards => tx('cards', 'readwrite', s => { cards.forEach(c => s.put(c)); }),
    delDeck: deckId => tx('cards', 'readwrite', s => { s.index('deck').openKeyCursor(IDBKeyRange.only(deckId)).onsuccess = e => { const c = e.target.result; if (c) { s.delete(c.primaryKey); c.continue(); } }; }),
    putMedia: items => tx('media', 'readwrite', s => { items.forEach(m => s.put(m)); }),
    getMedia: key => tx('media', 'readonly', s => s.get(key)),
    delMedia: deckId => delRange('media', IDBKeyRange.bound(deckId + '/', deckId + '/￿'))
  };
})();
INIT.push(async () => { try { (await CDB.all()).forEach(c => CARDS.set(c.id, c)); } catch (e) { console.error('cards db', e); } });

/* ---- черга ---- */
const newToday = () => { const v = LS.get(NEW_KEY, {}); return v.date === dayKey() ? v : { date: dayKey(), n: {} }; };
const bumpNew = deckId => { const v = newToday(); v.n[deckId] = (v.n[deckId] || 0) + 1; LS.set(NEW_KEY, v); };
const isNew = c => !srs[cardKey(c.id)];
function cardsDue(deckId, now = Date.now()) {
  const out = [];
  for (const k of Object.keys(srs)) { if (!k.startsWith('card|')) continue; const c = CARDS.get(k.split('|')[1]); if (!c || (deckId && c.deck !== deckId)) continue; if (srs[k].due <= now) out.push(c); }
  return out.sort((a, b) => srs[cardKey(a.id)].due - srs[cardKey(b.id)].due);
}
function newAvail(deckId) { const d = deckOf(deckId); if (!d) return []; const used = newToday().n[deckId] || 0; const lim = Math.max(0, (d.newPerDay ?? 20) - used); return byDeck(deckId).filter(isNew).slice(0, lim); }
function newAvailAll() { return cardDecks.flatMap(d => newAvail(d.id)); }
EXT.badge.push(() => cardsDue().length);
EXT.today.push(() => {
  if (!cardDecks.length) return '';
  const due = cardsDue().length, nw = newAvailAll().length;
  return `<h2 class="section-title">Картки</h2><div class="queue">${cardDecks.map(d => { const dd = cardsDue(d.id).length, dn = newAvail(d.id).length; return `<a href="#/decks/${d.id}/learn"><span class="t">${esc(d.name)}</span><span class="c">${dd ? dd + ' до повторення' : ''}${dd && dn ? ' · ' : ''}${dn ? dn + ' нових' : ''}${!dd && !dn ? 'на сьогодні все' : ''}</span></a>`; }).join('')}</div>
    ${due + nw ? `<div class="actions" style="margin-top:10px"><a href="#/decks/all/learn"><button class="primary">Вчити картки: ${due + nw} →</button></a></div>` : ''}`;
});

/* ---- рендер картки: безпечний HTML, cloze, медіа ---- */
const ALLOWED = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'BR', 'DIV', 'SPAN', 'P', 'IMG', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'SMALL', 'H1', 'H2', 'H3', 'TABLE', 'TBODY', 'TR', 'TD', 'TH', 'HR', 'CENTER', 'FONT']);
const mediaUrls = new Map();
async function mediaUrl(deckId, name) {
  const key = deckId + '/' + name;
  if (mediaUrls.has(key)) return mediaUrls.get(key);
  let url = ''; try { const m = await CDB.getMedia(key); if (m && m.blob) url = URL.createObjectURL(m.blob); } catch (e) {}
  mediaUrls.set(key, url); return url;
}
async function cardHtml(card, side) {
  let text = (side === 'front' ? card.front : card.back) || '';
  text = text.replace(/\[sound:[^\]]*\]/g, '').replace(/\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs, (m, n, ans, hint) => {
    if (side === 'front' && +n === (card.cloze || 1)) return `<span class="cloze">[${hint ? esc(hint) : '…'}]</span>`;
    return side === 'back' && +n === (card.cloze || 1) ? `<span class="cloze ans">${ans}</span>` : ans;
  });
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const walk = el => { for (const ch of [...el.childNodes]) { if (ch.nodeType !== 1) continue; if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'AUDIO', 'VIDEO', 'SVG'].includes(ch.tagName)) { ch.remove(); continue; }
    if (!ALLOWED.has(ch.tagName)) { ch.replaceWith(...ch.childNodes); continue; } for (const a of [...ch.attributes]) if (!(ch.tagName === 'IMG' && a.name === 'src') && a.name !== 'class') ch.removeAttribute(a.name); walk(ch); } };
  walk(doc.body);
  for (const img of [...doc.body.querySelectorAll('img')]) { const src = decodeURIComponent(img.getAttribute('src') || ''); if (/^(https?:|data:)/.test(src)) continue; const u = await mediaUrl(card.deck, src); if (u) img.src = u; else img.remove(); }
  return doc.body.innerHTML.trim();
}

/* ---- імпорт ---- */
const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не вдалося завантажити ' + src)); document.head.appendChild(s); });
function textCards(deckId, text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  const sep = lines.some(l => l.includes('\t')) ? '\t' : lines.some(l => l.includes(';')) ? ';' : ',';
  const unq = v => { v = v.trim(); return v.length > 1 && v[0] === '"' && v.at(-1) === '"' ? v.slice(1, -1).replace(/""/g, '"') : v; };
  return lines.map((l, i) => { const p = l.split(sep).map(unq); return { id: `${deckId}:${i}`, deck: deckId, ord: i, front: p[0] || '', back: p.slice(1).filter(Boolean).join('<br>') }; }).filter(c => c.front);
}
async function apkgCards(deckId, file) {
  await loadScript('vendor/jszip.min.js'); await loadScript('vendor/sql-wasm.js');
  const zip = await JSZip.loadAsync(file);
  const dbName = ['collection.anki21', 'collection.anki2'].find(n => zip.file(n));
  if (!dbName) throw new Error(zip.file('collection.anki21b') ? 'Це новий формат Anki. При експорті в Anki увімкніть «Support older Anki versions» і збережіть колоду ще раз.' : 'У файлі немає бази Anki.');
  const SQL = await initSqlJs({ locateFile: f => 'vendor/' + f });
  const db = new SQL.Database(await zip.file(dbName).async('uint8array'));
  const col = db.exec('SELECT models, decks FROM col')[0].values[0];
  const models = JSON.parse(col[0]); let name = '';
  try { const dk = Object.values(JSON.parse(col[1])).map(d => d.name).filter(n => n && n !== 'Default'); name = (dk.sort((a, b) => a.length - b.length)[0] || '').split('::').pop(); } catch (e) {}
  const notes = (db.exec('SELECT id, mid, flds, sfld FROM notes')[0] || { values: [] }).values;
  db.close();
  const cards = []; let ord = 0;
  for (const [nid, mid, flds] of notes) {
    const m = models[mid] || {}; const f = String(flds).split('\x1f');
    if (m.type === 1 || /\{\{c\d+::/.test(f[0])) {                   // cloze: окрема картка на кожен номер
      const nums = [...new Set([...f[0].matchAll(/\{\{c(\d+)::/g)].map(x => +x[1]))].sort((a, b) => a - b);
      const extra = f.slice(1).filter(x => x.trim()).join('<br>');
      for (const n of nums.length ? nums : [1]) cards.push({ id: `${deckId}:${nid}:${n}`, deck: deckId, ord: ord++, front: f[0], back: f[0] + (extra ? '<hr>' + extra : ''), cloze: n });
    } else {
      const back = f.slice(1).filter(x => x.trim()).join('<hr>');
      if (f[0].trim()) cards.push({ id: `${deckId}:${nid}`, deck: deckId, ord: ord++, front: f[0], back });
    }
  }
  // медіа: тільки ті файли, на які є посилання в картках
  let mediaMap = {}; const mf = zip.file('media'); if (mf) { try { mediaMap = JSON.parse(await mf.async('string')); } catch (e) {} }
  const used = new Set(); for (const c of cards) for (const m of (c.front + ' ' + c.back).matchAll(/src="([^"]+)"/g)) used.add(decodeURIComponent(m[1]));
  const items = [];
  for (const [num, fname] of Object.entries(mediaMap)) { if (!used.has(fname)) continue; const zf = zip.file(String(num)); if (!zf) continue; const blob = await zf.async('blob'); items.push({ key: deckId + '/' + fname, blob }); }
  return { cards, media: items, name };
}
async function importFile(file) {
  const deckId = uid(); const base = file.name.replace(/\.(apkg|txt|csv|tsv)$/i, '');
  let cards, media = [], name = base, src = 'text';
  if (/\.apkg$/i.test(file.name)) { const r = await apkgCards(deckId, file); cards = r.cards; media = r.media; name = r.name || base; src = 'apkg'; }
  else cards = textCards(deckId, await file.text());
  if (!cards.length) throw new Error('У файлі не знайдено карток.');
  await CDB.putCards(cards); if (media.length) await CDB.putMedia(media);
  cards.forEach(c => CARDS.set(c.id, c));
  cardDecks.push({ id: deckId, name, n: cards.length, created: Date.now(), newPerDay: 20, src }); saveCardDecks();
  return deckId;
}
function atlasDeck(catOrSet) {
  const sets = catOrSet.startsWith('cat:') ? ATLAS.sets.filter(s => s.cat === catOrSet.slice(4)) : ATLAS.sets.filter(s => s.id === catOrSet);
  const deckId = uid(); let ord = 0; const cards = [];
  for (const s of sets) for (const it of s.items) cards.push({ id: `${deckId}:${s.id}:${it.n}`, deck: deckId, ord: ord++, front: `<i>${esc(it.la)}</i>`, back: `${esc(it.uk || '—')}<div class="fld muted">${esc(s.title)}</div>` });
  return { cards, name: catOrSet.startsWith('cat:') ? catOrSet.slice(4) : sets[0].title };
}
async function createAtlasDeck(catOrSet) {
  const { cards, name } = atlasDeck(catOrSet); if (!cards.length) return null;
  const deckId = cards[0].deck;
  await CDB.putCards(cards); cards.forEach(c => CARDS.set(c.id, c));
  cardDecks.push({ id: deckId, name, n: cards.length, created: Date.now(), newPerDay: 20, src: 'atlas' }); saveCardDecks();
  return deckId;
}
async function deleteDeck(deckId) {
  await CDB.delDeck(deckId); await CDB.delMedia(deckId);
  for (const c of byDeck(deckId)) { CARDS.delete(c.id); delete srs[cardKey(c.id)]; }
  saveSrs(); cardDecks = cardDecks.filter(d => d.id !== deckId); saveCardDecks(); updateBadge();
}

/* ---- сторінки ---- */
function renderDecks(msg) {
  const opts = ATLAS.categories.filter(c => ATLAS.sets.some(s => s.cat === c)).map(c => `<optgroup label="${esc(c)}"><option value="cat:${esc(c)}">Увесь розділ: ${esc(c)}</option>${ATLAS.sets.filter(s => s.cat === c).map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</optgroup>`).join('');
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Колоди</h1><p>Картки як в Anki: імпортуйте колоду з файлу .apkg або текстового експорту, чи зберіть із атласу. Повторення — за тими ж інтервалами, що й схеми; усе видно на «Сьогодні».</p></section>
    ${msg ? `<div class="result ${msg.bad ? 'bad' : 'good'}" style="display:inline-block;margin-bottom:14px">${esc(msg.text)}</div>` : ''}
    <div class="actions"><button class="primary" id="dkImport">Імпорт .apkg / .txt / .csv</button>
      <span class="atlaspick"><select id="dkAtlas"><option value="">З атласу…</option>${opts}</select><button id="dkCreate" disabled>Створити</button></span></div>
    ${cardDecks.length ? `<div class="grid" style="margin-top:20px">${cardDecks.map(d => { const due = cardsDue(d.id).length, nw = newAvail(d.id).length, seen = byDeck(d.id).filter(c => !isNew(c)).length;
      return `<div class="card deckcard" data-id="${d.id}"><div class="body"><h3>${esc(d.name)}</h3>
        <div class="meta"><span class="chip">${{ apkg: 'Anki', text: 'текст', atlas: 'атлас' }[d.src] || d.src}</span><span>${d.n} карток</span><span>${seen ? Math.round(seen / d.n * 100) + '% розпочато' : 'не розпочато'}</span></div>
        <div class="dkstat"><span>${due ? `<b>${due}</b> до повторення` : 'повторень немає'}</span><span>${nw ? `<b>${nw}</b> нових сьогодні` : 'нових на сьогодні немає'}</span></div>
        <div class="prog" style="gap:8px"><a href="#/decks/${d.id}/learn"><button class="small primary" ${due + nw ? '' : 'disabled'}>Вчити${due + nw ? ' ' + (due + nw) : ''}</button></a><a href="#/decks/${d.id}"><button class="small">Картки</button></a><span class="spacer"></span><button class="small ghost" data-del="${d.id}" title="Видалити">🗑</button></div></div></div>`; }).join('')}</div>`
      : `<div class="empty" style="margin-top:20px">Ще немає жодної колоди. Імпортуйте файл з Anki або створіть колоду з розділу атласу.</div>`}
    <h2 class="section-title">Як імпортувати з Anki</h2><div class="prose" style="padding:0"><ul>
      <li>В Anki: колода → Export → формат <b>Anki Deck Package (.apkg)</b>, увімкнути <b>Support older Anki versions</b>, за потреби <b>Include media</b>.</li>
      <li>Або Export → <b>Notes in Plain Text (.txt)</b>: перше поле стане лицем картки, решта — зворотом.</li>
      <li>Свій список: текстовий файл, у кожному рядку «термін<span class="muted">[Tab або ;]</span>переклад».</li></ul></div>
    <input type="file" id="dkFile" accept=".apkg,.txt,.csv,.tsv,text/plain,application/zip" hidden>
  </div>`;
  $('#dkImport').onclick = () => $('#dkFile').click();
  $('#dkFile').onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    $('#dkImport').disabled = true; $('#dkImport').textContent = 'Імпортую…';
    try { const id = await importFile(f); renderDecks({ text: `Імпортовано «${deckOf(id).name}»: ${deckOf(id).n} карток.` }); updateBadge(); }
    catch (err) { console.error(err); renderDecks({ bad: true, text: 'Не вдалося імпортувати: ' + (err.message || err) }); }
  };
  const sel = $('#dkAtlas'); sel.onchange = () => { $('#dkCreate').disabled = !sel.value; };
  $('#dkCreate').onclick = async () => { const id = await createAtlasDeck(sel.value); if (id) renderDecks({ text: `Створено «${deckOf(id).name}»: ${deckOf(id).n} карток.` }); };
  $$('button[data-del]').forEach(b => b.onclick = async () => { const d = deckOf(b.dataset.del); if (!await confirmDlg('Видалити колоду?', `«${d.name}», ${d.n} карток і весь прогрес по них.`)) return; await deleteDeck(d.id); renderDecks(); });
  window.scrollTo(0, 0);
}
async function renderDeck(deckId) {
  const d = deckOf(deckId); if (!d) return renderDecks();
  const cards = byDeck(deckId); const page = 100;
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/decks">← Колоди</a><h1>${esc(d.name)}</h1><span class="muted">${d.n} карток</span><span class="spacer"></span>
      <label class="muted" style="font-size:14px">Нових на день <input type="number" id="dkNew" min="0" max="500" value="${d.newPerDay ?? 20}" style="width:70px;margin-left:6px;background:var(--paper);border:1px solid var(--line2);border-radius:8px;padding:5px 8px"></label>
      <a href="#/decks/${d.id}/learn"><button class="primary">Вчити →</button></a></div>
    <div class="cardlist" id="cardlist"></div>
    ${cards.length > page ? `<div class="actions" style="margin-top:14px"><button id="dkMore">Показати ще</button><span class="muted" id="dkCount"></span></div>` : ''}
  </div>`;
  $('#dkNew').onchange = e => { d.newPerDay = Math.max(0, +e.target.value || 0); saveCardDecks(); };
  let shown = 0; const list = $('#cardlist');
  const more = async () => { const chunk = cards.slice(shown, shown + page); shown += chunk.length;
    for (const c of chunk) { const r = srs[cardKey(c.id)]; const st = !r ? 'нова' : r.due <= Date.now() ? 'до повторення' : `через ${Math.max(1, Math.ceil((r.due - Date.now()) / DAY))} д`;
      list.insertAdjacentHTML('beforeend', `<div class="crow"><div class="cf">${await cardHtml(c, 'front')}</div><div class="cb">${await cardHtml(c, 'back')}</div><div class="cs muted">${st}${r && r.lapses ? ` · забували ${r.lapses}` : ''}</div></div>`); }
    const cnt = $('#dkCount'); if (cnt) cnt.textContent = `${shown} з ${cards.length}`; const mb = $('#dkMore'); if (mb) mb.hidden = shown >= cards.length; };
  await more(); const mb = $('#dkMore'); if (mb) mb.onclick = more;
  window.scrollTo(0, 0);
}

/* ---- навчання ---- */
const Learn = {
  active: false, queue: [], relearn: [], cur: null, side: 'front', done: 0, again: 0, deckId: null,
  begin(deckId) {
    this.deckId = deckId === 'all' ? null : deckId; this.active = true; this.done = 0; this.again = 0; this.relearn = [];
    const due = cardsDue(this.deckId), nw = this.deckId ? newAvail(this.deckId) : newAvailAll();
    this.queue = due.concat(nw); this.total = this.queue.length;
    const d = this.deckId && deckOf(this.deckId);
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="${d ? '#/decks/' + d.id : '#/decks'}">← ${d ? esc(d.name) : 'Колоди'}</a><span class="spacer"></span><span class="muted" id="lnCount"></span></div>
      <div class="cardbox" id="cardbox"></div>
      <div class="grades" id="grades"></div>
      <p class="muted lnhint">Пробіл або Enter — показати відповідь · 1 2 3 4 — оцінка</p>
    </div>`;
    if (!this.queue.length) return this.finish();
    this.next();
  },
  teardown() { this.active = false; this.cur = null; },
  next() {
    if (!this.queue.length) { if (this.relearn.length) { this.queue = this.relearn; this.relearn = []; } else return this.finish(); }
    this.cur = this.queue.shift(); this.side = 'front'; this.render();
  },
  async render() {
    const c = this.cur, box = $('#cardbox'), g = $('#grades'); if (!c || !box) return;
    const d = deckOf(c.deck), r = srs[cardKey(c.id)];
    $('#lnCount').textContent = `${this.done + 1} з ${this.total + this.again}${this.relearn.length ? ' · ще раз: ' + this.relearn.length : ''}`;
    const front = await cardHtml(c, 'front'); if (this.cur !== c) return;
    box.innerHTML = `<div class="cardface"><div class="cdeck muted">${esc(d ? d.name : '')}${!r ? ' · <span class="chip">нова</span>' : ''}</div><div class="cfront">${front}</div>${this.side === 'back' ? `<hr><div class="cback">${await cardHtml(c, 'back')}</div>` : ''}</div>`;
    if (this.side === 'front') { g.innerHTML = `<button class="primary" id="lnShow">Показати відповідь</button>`; $('#lnShow').onclick = () => this.flip(); }
    else {
      const base = Object.assign(srsBlank(), r || {}, { mode: 'card' });
      const iv = grade => { const n = srsNext(base, grade !== 'again', grade); const ms = n.due - Date.now(); return ms < DAY ? `${Math.max(1, Math.round(ms / 60000))} хв` : `${Math.round(ms / DAY)} д`; };
      g.innerHTML = [['again', 'Знову', 'bad'], ['hard', 'Важко', ''], ['good', 'Добре', 'ok'], ['easy', 'Легко', 'easy']].map(([k, t, cls], i) => `<button class="grade ${cls}" data-g="${k}"><span>${t}</span><small>${iv(k)}</small><kbd>${i + 1}</kbd></button>`).join('');
      $$('#grades .grade').forEach(b => b.onclick = () => this.grade(b.dataset.g));
    }
  },
  flip() { if (!this.cur || this.side === 'back') return; this.side = 'back'; this.render(); },
  grade(gr) {
    const c = this.cur; if (!c || this.side !== 'back') return;
    const wasNew = isNew(c);
    srsReview('card', c.id, 'card', gr !== 'again', gr);
    if (wasNew) bumpNew(c.deck);
    if (gr === 'again') { this.relearn.push(c); this.again++; } else this.done++;
    if (navigator.vibrate && gr === 'again') navigator.vibrate(40);
    this.next();
  },
  finish() {
    this.active = false;
    const box = $('#cardbox'), g = $('#grades'); if (!box) return;
    $('#lnCount').textContent = '';
    box.innerHTML = `<div class="cardface" style="text-align:center"><div class="q" style="font-family:var(--serif);font-size:24px">${this.total ? 'Сесію завершено' : 'На сьогодні все'}</div><div class="p muted" style="margin-top:8px">${this.total ? `Карток: ${this.total}${this.again ? `, повторних відповідей «знову»: ${this.again}` : ''}` : 'Нові картки з’являться завтра, або підніміть ліміт «нових на день» у колоді.'}</div></div>`;
    g.innerHTML = `<a href="#/decks"><button class="primary">До колод</button></a><a href="#/today"><button>Сьогодні</button></a>`;
    $('.lnhint').hidden = true;
  }
};
document.addEventListener('keydown', e => {
  if (!Learn.active || $('dialog[open]') || e.target.matches('input,textarea,select')) return;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Learn.flip(); }
  else if (['1', '2', '3', '4'].includes(e.key)) Learn.grade(['again', 'hard', 'good', 'easy'][+e.key - 1]);
});

ROUTES.decks = parts => {
  Learn.teardown();
  if (!parts.length) return renderDecks();
  if (parts[1] === 'learn') return Learn.begin(parts[0]);
  return renderDeck(parts[0]);
};
window.addEventListener('hashchange', () => { if (!location.hash.includes('/learn')) Learn.teardown(); });
window.Cards = { CARDS, cardDecks: () => cardDecks, cardsDue, newAvail, importFile, createAtlasDeck, deleteDeck, cardHtml, Learn };
})();
