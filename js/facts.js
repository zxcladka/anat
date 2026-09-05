/* Теорія: картки фактів (м'язи, суглоби, нерви) — дані в atlas/facts.js.
   Маршрути: #/facts — огляд; #/facts/<тема> — список; #/facts/<тема>/learn — картки з оцінками; #/facts/<тема>/quiz — тест.
   <тема> — 'm1:19' або 'all'. Повторення — той самий FSRS, ключ `fact:<id>|<поле>|q`. */
(function () {
const F = window.FACTS; if (!F) return;
const T = F.types;
const topicKey = id => { const p = String(id).split(':'); return p.length === 3 ? p.slice(1).join(':') : id; };
const byTopic = id => id === 'all' ? F.items : F.items.filter(i => i.topic === topicKey(id));
const fieldsOf = it => T[it.type].fields;
const fkey = (it, fk) => srsKey('fact:' + it.id, fk, 'q');
const rec = (it, fk) => srs[fkey(it, fk)];
const isDue = (it, fk, now) => { const r = rec(it, fk); return !!r && r.due <= (now || Date.now()); };
const isNew = (it, fk) => !rec(it, fk);
const cards = items => items.flatMap(it => fieldsOf(it).map(f => ({ it, f })));
const dueCards = items => cards(items || F.items).filter(c => isDue(c.it, c.f.k));
const newCards = items => cards(items || F.items).filter(c => isNew(c.it, c.f.k));
const NEW_ITEMS = 5;                                   // нових карток (структур) за сесію
const seenItem = it => fieldsOf(it).some(f => !isNew(it, f.k));
const masteredItem = it => fieldsOf(it).every(f => srsMastered(rec(it, f.k)));
const topics = () => [...new Set(F.items.map(i => i.topic))];
function topicInfo(tk) {
  const c = (window.Course && Course.course()) || (window.CURRICULUM && CURRICULUM.courses[0]); const [mid, n] = tk.split(':');
  const m = c && c.modules.find(x => x.id === mid); const t = m && m.topics.find(x => x.n === +n);
  return { title: t ? t.title.split('.')[0] : tk, n: t ? t.n : '', href: t ? `#/course/${m.id}/${t.n}` : '#/course', m };
}
const typeName = items => { const ts = [...new Set(items.map(i => i.type))]; return ts.map(t => T[t].name.toLowerCase()).join(', '); };
const stat = items => ({ total: items.length, seen: items.filter(seenItem).length, mastered: items.filter(masteredItem).length, due: dueCards(items).length, nw: newCards(items).length });
const record = (it, fk, ok, grade) => srsReview('fact:' + it.id, fk, 'q', ok, grade);

/* ---- рендер картки ---- */
function itemHtml(it, open, hl) {
  return `<details class="fact" ${open ? 'open' : ''}><summary><i>${esc(it.la)}</i><span class="uk">${esc(it.uk)}</span>${masteredItem(it) ? '<span class="chip ok">засвоєно</span>' : seenItem(it) ? '<span class="chip">у повторенні</span>' : ''}</summary>
    <dl>${fieldsOf(it).map(f => `<div class="${hl === f.k ? 'hl' : ''}"><dt>${esc(f.uk)}<small>${esc(f.la)}</small></dt><dd>${esc(it.f[f.k])}</dd></div>`).join('')}</dl></details>`;
}

/* ---- огляд ---- */
function renderHub() {
  const s = stat(F.items); const c = (window.Course && Course.course()) || (window.CURRICULUM && CURRICULUM.courses[0]);
  const groups = {}; for (const tk of topics().sort((a, b) => { const [ma, na] = a.split(':'), [mb, nb] = b.split(':'); return ma.localeCompare(mb) || (+na - +nb); })) { const info = topicInfo(tk); const mid = info.m ? info.m.id : tk.split(':')[0]; (groups[mid] = groups[mid] || []).push(tk); }
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Теорія</h1><p>Картки для тем без схем: м’язи — початок, прикріплення, функція та іннервація; суглоби — форма, поверхні, зв’язки, рухи; черепні нерви — ядра, вихід, гілки, ділянка іннервації. Повторення за тим самим алгоритмом, що й схеми.</p></section>
    <div class="tiles"><div class="tile"><b>${s.total}</b><span>структур</span></div><div class="tile"><b>${s.seen}</b><span>у повторенні</span></div><div class="tile"><b>${s.mastered}</b><span>засвоєно</span></div><div class="tile"><b>${s.due}</b><span>карток до повторення</span></div></div>
    <div class="actions">${s.due ? `<a href="#/facts/all/learn"><button class="primary">Повторити ${s.due} →</button></a>` : ''}<a href="#/facts/all/quiz"><button>Тест по всьому</button></a></div>
    ${Object.entries(groups).map(([mid, tks]) => { const m = c && c.modules.find(x => x.id === mid); return `<h2 class="section-title">${esc(m ? m.title : mid)}</h2><div class="queue">${tks.map(tk => { const info = topicInfo(tk), st = stat(byTopic(tk)); return `<a href="#/facts/${tk}"><span class="tnum">${info.n}</span><span class="t">${esc(info.title)}<small class="muted"> · ${st.total} ${esc(typeName(byTopic(tk)))}</small></span><span class="c">${st.due ? `<b>${st.due}</b> до повторення` : st.seen ? `${st.mastered}/${st.total} засвоєно` : 'нова тема'}</span></a>`; }).join('')}</div>`; }).join('')}
  </div>`;
  window.scrollTo(0, 0);
}

/* ---- тема ---- */
function renderTopic(tk) {
  const items = byTopic(tk); if (!items.length) return renderHub();
  const info = topicInfo(tk), s = stat(items);
  const groups = [...new Set(items.map(i => i.group))];
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/facts">← Теорія</a><span class="spacer"></span><a href="${info.href}"><button class="small">Тема курсу →</button></a></div>
    <section class="page-hero" style="padding-top:6px"><div class="crow-h">${info.n ? `<span class="tnum big">${info.n}</span>` : ''}<h1 style="font-size:clamp(22px,3vw,32px)">${esc(info.title)}</h1></div><p>${s.total} ${esc(typeName(items))}: ${groups.length} ${plural(groups.length, 'група', 'групи', 'груп')}. Розгорніть картку, щоб прочитати, або одразу вчіть — кожне поле повторюється окремо.</p></section>
    <div class="tiles"><div class="tile"><b>${s.seen}<small class="muted" style="font-size:16px"> / ${s.total}</small></b><span>у повторенні</span></div><div class="tile"><b>${s.mastered}</b><span>засвоєно</span></div><div class="tile"><b>${s.due}</b><span>до повторення</span></div><div class="tile"><b>${s.nw}</b><span>нових карток</span></div></div>
    <div class="actions"><a href="#/facts/${tk}/learn"><button class="primary">${s.due ? `Повторити ${s.due}` : s.nw ? 'Вчити картки' : 'Повторити'} →</button></a><a href="#/facts/${tk}/quiz"><button>Тест</button></a><button id="fxAll">Розгорнути все</button></div>
    ${groups.map(g => `<h2 class="section-title">${esc(g)}</h2><div class="factlist">${items.filter(i => i.group === g).map(i => itemHtml(i)).join('')}</div>`).join('')}
  </div>`;
  $('#fxAll').onclick = () => { const all = $$('details.fact'); const open = all.some(d => !d.open); all.forEach(d => d.open = open); $('#fxAll').textContent = open ? 'Згорнути все' : 'Розгорнути все'; };
  window.scrollTo(0, 0);
}

/* ---- сесія карток ---- */
const Learn = {
  active: false, q: [], i: 0, shown: false, tk: 'all', done: 0, again: 0,
  start(tk) {
    this.tk = tk; const items = byTopic(tk);
    let q = shuffle(dueCards(items)).slice(0, 30);
    const seenIds = new Set(q.map(c => c.it.id));
    const fresh = shuffle(items.filter(it => !seenItem(it) && !seenIds.has(it.id))).slice(0, NEW_ITEMS);
    for (const it of fresh) for (const f of fieldsOf(it)) q.push({ it, f, fresh: true });
    if (!q.length) { app.innerHTML = `<div class="wrap"><div class="sethead"><a class="back" href="#/facts/${tk === 'all' ? '' : tk}">← Назад</a></div><div class="empty">Тут поки нічого повторювати: усе повторено, нових карток немає.</div></div>`; return; }
    this.q = q; this.i = 0; this.done = 0; this.again = 0; this.active = true; this.render();
  },
  cur() { return this.q[this.i]; },
  render() {
    const c = this.cur(); if (!c) return this.finish();
    const { it, f } = c; const info = topicInfo(it.topic);
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/facts/${this.tk === 'all' ? '' : this.tk}">← ${this.tk === 'all' ? 'Теорія' : esc(info.title)}</a><span class="spacer"></span><span class="muted" style="font-size:13px">${this.i + 1} / ${this.q.length}</span></div>
      <div class="tbar" style="margin:8px 0 14px"><div class="tfill" style="width:${Math.round(this.i / this.q.length * 100)}%"></div></div>
      <div class="cardbox"><div class="cardface">
        <div class="cdeck muted">${esc(it.group)}${c.fresh ? ' · нова' : ''}</div>
        <div class="cfront"><i>${esc(it.la)}</i> <button class="small ghost spk" data-say="${esc(it.la)}" title="Вимова">🔊</button><div class="muted" style="font-size:16px;font-family:var(--sans)">${esc(it.uk)}</div></div>
        <div class="fq">${esc(f.uk)}<small>${esc(f.la)}</small></div>
        ${this.shown ? `<hr><div class="fans">${esc(it.f[f.k])}</div><details class="fmore"><summary>Уся картка</summary><dl>${fieldsOf(it).filter(x => x.k !== f.k).map(x => `<div><dt>${esc(x.uk)}</dt><dd>${esc(it.f[x.k])}</dd></div>`).join('')}</dl></details>` : ''}
      </div></div>
      <div class="grades" id="grades">${this.shown
        ? ['again', 'hard', 'good', 'easy'].map((g, i) => `<button class="grade ${g === 'again' ? 'bad' : g === 'good' ? 'ok' : g === 'easy' ? 'easy' : ''}" data-g="${g}"><kbd>${i + 1}</kbd>${{ again: 'Не знаю', hard: 'Важко', good: 'Знаю', easy: 'Легко' }[g]}<small>${this.ivl(c, g)}</small></button>`).join('')
        : `<button class="primary" id="fxShow">Показати відповідь <kbd style="margin-left:8px;opacity:.7">пробіл</kbd></button>`}</div>
      <p class="lnhint muted">Спершу відповідайте подумки, потім відкривайте. «Не знаю» — картка повернеться через 10 хвилин; «Знаю» — за інтервалом.</p>
    </div>`;
    const sb = $('#fxShow'); if (sb) sb.onclick = () => this.show();
    $$('#grades .grade').forEach(b => b.onclick = () => this.grade(b.dataset.g));
    const spk = $('.spk'); if (spk) spk.onclick = () => speak(spk.dataset.say);
    window.scrollTo(0, 0);
  },
  ivl(c, g) {
    const r = srsNext(rec(c.it, c.f.k), g !== 'again', g);
    if (!r.interval) return '10 хв'; return r.interval + ' ' + plural(r.interval, 'день', 'дні', 'днів');
  },
  show() { this.shown = true; this.render(); },
  grade(g) {
    const c = this.cur(); const ok = g !== 'again'; record(c.it, c.f.k, ok, g);
    if (ok) this.done++; else { this.again++; this.q.push({ it: c.it, f: c.f }); }   // повернути в кінець сесії
    this.shown = false; this.i++; this.render();
  },
  finish() {
    this.active = false;
    app.innerHTML = `<div class="wrap learnwrap"><section class="page-hero"><h1>Сесію завершено</h1><p>${this.done} ${plural(this.done, 'картка', 'картки', 'карток')} відповіли, ${this.again} — повторювали ще раз. Наступні повторення з’являться на «Сьогодні».</p></section>
      <div class="actions"><a href="#/facts/${this.tk}/learn"><button class="primary">Ще сесія</button></a><a href="#/facts/${this.tk}/quiz"><button>Тест</button></a><a href="#/facts/${this.tk === 'all' ? '' : this.tk}"><button>До теми</button></a><a href="#/today"><button>Сьогодні</button></a></div></div>`;
  },
  key(e) {
    if (!this.active || $('dialog[open]')) return;
    if (!this.shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); this.show(); }
    else if (this.shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); this.grade(['again', 'hard', 'good', 'easy'][+e.key - 1]); }
  }
};

/* ---- тест ---- */
const Quiz = {
  active: false, tk: 'all', items: [], n: 0, ok: 0, cur: null, locked: false, picked: -1,
  start(tk) { this.tk = tk; this.items = byTopic(tk); if (!this.items.length) return renderHub(); this.n = 0; this.ok = 0; this.active = true; this.next(); },
  make() {
    const items = this.items; const it = items[Math.floor(Math.random() * items.length)]; const f = fieldsOf(it)[Math.floor(Math.random() * fieldsOf(it).length)];
    const pool = (items.filter(x => x.type === it.type).length >= 4 ? items : F.items).filter(x => x !== it && x.type === it.type);   // мала тема — дистрактори з усього типу
    const same = pool.filter(x => x.group === it.group), rest = pool.filter(x => x.group !== it.group);
    const reverse = Math.random() < 0.4;
    let opts;
    if (reverse) { opts = shuffle(same).slice(0, 3); if (opts.length < 3) opts = opts.concat(shuffle(rest).slice(0, 3 - opts.length)); opts = shuffle([it, ...opts]); }
    else { const seen = new Set([it.f[f.k]]); opts = []; for (const x of shuffle(same).concat(shuffle(rest))) { const v = x.f[f.k]; if (seen.has(v)) continue; seen.add(v); opts.push(x); if (opts.length === 3) break; } opts = shuffle([it, ...opts]); }
    return { it, f, reverse, opts };
  },
  next() { this.cur = this.make(); this.locked = false; this.picked = -1; this.render(); },
  render() {
    const { it, f, reverse, opts } = this.cur; const info = topicInfo(it.topic);
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/facts/${this.tk === 'all' ? '' : this.tk}">← ${this.tk === 'all' ? 'Теорія' : esc(info.title)}</a><span class="spacer"></span><span class="muted" style="font-size:13px">${this.ok} / ${this.n}</span></div>
      <div class="cardbox"><div class="cardface">
        <div class="cdeck muted">${esc(it.group)} · ${reverse ? esc(f.uk) : 'питання'}</div>
        ${reverse ? `<div class="fans" style="font-size:18px">${esc(it.f[f.k])}</div><div class="fq">Який ${esc(T[it.type].one)}?</div>`
          : `<div class="cfront"><i>${esc(it.la)}</i><div class="muted" style="font-size:16px;font-family:var(--sans)">${esc(it.uk)}</div></div><div class="fq">${esc(f.uk)}<small>${esc(f.la)}</small></div>`}
      </div></div>
      <div class="fopts">${opts.map((o, i) => { let cls = ''; if (this.locked) { if (o === it) cls = 'ok'; else if (this.picked === i) cls = 'bad'; } return `<button class="fopt ${cls}" data-i="${i}"><kbd>${i + 1}</kbd>${reverse ? `<i>${esc(o.la)}</i> <span class="muted">${esc(o.uk)}</span>` : esc(o.f[f.k])}</button>`; }).join('')}</div>
      ${this.locked ? `<div class="explain" style="margin-top:14px">${this.picked >= 0 && opts[this.picked] === it ? '<b class="okc">Правильно.</b>' : `<b class="badc">Неправильно.</b> Правильна відповідь${reverse ? '' : ' виділена'}: ${reverse ? `<i>${esc(it.la)}</i>` : ''}`}${itemHtml(it, true, f.k)}</div><div class="actions" style="margin-top:12px"><button class="primary" id="fxNext">Далі <kbd style="margin-left:8px;opacity:.7">Enter</kbd></button></div>` : ''}
    </div>`;
    $$('.fopt').forEach(b => b.onclick = () => this.pick(+b.dataset.i));
    const nb = $('#fxNext'); if (nb) nb.onclick = () => this.next();
    window.scrollTo(0, 0);
  },
  pick(i) {
    if (this.locked) return; const { it, f, opts } = this.cur; this.locked = true; this.picked = i; this.n++;
    const ok = opts[i] === it; if (ok) this.ok++;
    record(it, f.k, ok); if (!ok) { const o = opts[i]; if (window.noteConfusion) try { noteConfusion('fact:' + it.id, it.id, o.id); } catch (e) {} }
    this.render();
  },
  key(e) {
    if (!this.active || $('dialog[open]')) return;
    if (!this.locked && /^[1-4]$/.test(e.key)) { e.preventDefault(); this.pick(+e.key - 1); }
    else if (this.locked && e.key === 'Enter') { e.preventDefault(); this.next(); }
  }
};
document.addEventListener('keydown', e => { Learn.key(e); Quiz.key(e); });

/* ---- блок на сторінці теми курсу ---- */
function topicHtml(id) {
  const items = byTopic(id); if (!items.length) return '';
  const s = stat(items), tk = topicKey(id); const groups = [...new Set(items.map(i => i.group))];
  return `<h2 class="section-title">Теорія: ${esc(typeName(items))}</h2>
    <div class="factsum"><p class="muted" style="margin:0 0 8px;font-size:14px">${s.total} ${plural(s.total, 'картка', 'картки', 'карток')} · ${groups.map(g => esc(g)).join(' · ')}</p>
    <div class="actions"><a href="#/facts/${tk}/learn"><button class="primary">${s.due ? `Повторити ${s.due}` : s.seen ? 'Вчити далі' : 'Вчити картки'} →</button></a><a href="#/facts/${tk}"><button>Переглянути</button></a><a href="#/facts/${tk}/quiz"><button>Тест</button></a>${s.seen ? `<span class="muted" style="font-size:13px">${s.mastered}/${s.total} засвоєно</span>` : ''}</div></div>`;
}

/* ---- «Сьогодні» і бейдж ---- */
EXT.badge.push(() => dueCards().length);
EXT.today.push(() => {
  const due = dueCards(); const seenAny = F.items.some(seenItem);
  if (!due.length && !seenAny) return '';
  const per = {}; for (const c of due) per[c.it.topic] = (per[c.it.topic] || 0) + 1;
  const list = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return `<h2 class="section-title">Теорія</h2>${list.length ? `<div class="queue">${list.map(([tk, n]) => { const info = topicInfo(tk); return `<a href="#/facts/${tk}/learn"><span class="tnum">${info.n}</span><span class="t">${esc(info.title)}</span><span class="c">${n} ${plural(n, 'картка', 'картки', 'карток')}</span></a>`; }).join('')}</div>
    <div class="actions" style="margin-top:10px"><a href="#/facts/all/learn"><button class="primary">Повторити теорію: ${due.length} →</button></a></div>` : `<p class="muted" style="margin:0">Картки теорії повторено. <a href="#/facts" style="text-decoration:underline">Вчити нові</a></p>`}`;
});

ROUTES.facts = parts => {
  Learn.active = false; Quiz.active = false;
  const tk = parts[0]; if (!tk) return renderHub();
  if (parts[1] === 'learn') return Learn.start(tk);
  if (parts[1] === 'quiz') return Quiz.start(tk);
  return renderTopic(tk);
};
window.Facts = { byTopic, topicHtml, stat, dueCards, topicKey };
})();
