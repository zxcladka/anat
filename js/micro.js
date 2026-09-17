/* Мікроскоп (#/micro): впізнавання паразитів за фото — яйця гельмінтів, найпростіші, членистоногі.
   #/micro — атлас із ознаками «на що дивитись»; #/micro/quiz — фото → 4 назви (дистрактори з тієї ж групи).
   Повторення: ключ micro|<id>|q (той самий FSRS). Дані — atlas/micro.js (фото Commons/CDC, кредити в кожному записі). */
'use strict';
(() => {
const M = window.MICRO; if (!M || !M.items.length) return;
const rec = id => srs[srsKey('micro', id, 'q')];
const due = () => M.items.filter(i => { const r = rec(i.id); return r && r.due <= Date.now(); });
const seen = () => M.items.filter(i => rec(i.id));
const creditHtml = it => `<div class="credit">Фото: ${esc(it.credit.artist)} · ${it.credit.licurl ? `<a href="${esc(it.credit.licurl)}" target="_blank" rel="noopener">${esc(it.credit.license)}</a>` : esc(it.credit.license)} · <a href="${esc(it.credit.source)}" target="_blank" rel="noopener">джерело</a></div>`;
const cardHtml = it => `<details class="mcard" id="mc-${it.id}"><summary><img src="${imgUrl(it.file)}" alt="" loading="lazy"><span class="mt"><i>${esc(it.la)}</i><span>${esc(it.uk)}</span><small class="muted">${esc(it.material)} · ${esc(it.size)}</small></span>${srsMastered(rec(it.id)) ? '<span class="chip ok">засвоєно</span>' : rec(it.id) ? '<span class="chip">у повторенні</span>' : ''}</summary>
  <div class="mbody"><img src="${imgUrl(it.file)}" alt="${esc(it.uk)}"><div><p><b>На що дивитись:</b> ${esc(it.key)}</p><p><b>Не плутати:</b> ${esc(it.confuse)}</p><p class="muted" style="font-size:13px">Матеріал: ${esc(it.material)}. Розмір: ${esc(it.size)}.</p>${creditHtml(it)}</div></div></details>`;

function renderHub() {
  const d = due().length, s = seen().length;
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/bio">← Біологія</a></div>
    <section class="page-hero" style="padding-top:6px"><h1>Мікроскоп</h1><p>${M.items.length} фото, які показують на практикумі й питають «що це?»: яйця гельмінтів, вегетативні форми й цисти найпростіших, мазки крові, членистоногі. До кожного — ознаки, за якими впізнати, і з чим найчастіше плутають. Фото з Wikimedia Commons і колекції CDC (вільні ліцензії).</p></section>
    <div class="tiles"><div class="tile"><b>${M.items.length}</b><span>препаратів</span></div><div class="tile"><b>${s}</b><span>у повторенні</span></div><div class="tile"><b>${M.items.filter(i => srsMastered(rec(i.id))).length}</b><span>засвоєно</span></div><div class="tile"><b>${d}</b><span>до повторення</span></div></div>
    <div class="actions"><a href="#/micro/quiz"><button class="primary">${d ? `Повторити ${d}` : 'Впізнавати'} →</button></a><button id="mcAll">Розгорнути все</button></div>
    ${M.groups.map(g => { const list = M.items.filter(i => i.group === g); return list.length ? `<h2 class="section-title">${esc(g)} <span class="muted" style="font-size:15px;font-family:var(--sans)">· ${list.length}</span></h2><div class="mlist">${list.map(cardHtml).join('')}</div>` : ''; }).join('')}
  </div>`;
  $('#mcAll').onclick = () => { const all = $$('details.mcard'); const open = all.some(x => !x.open); all.forEach(x => x.open = open); $('#mcAll').textContent = open ? 'Згорнути все' : 'Розгорнути все'; };
  window.scrollTo(0, 0);
}
const Quiz = {
  active: false, q: [], i: 0, cur: null, locked: false, picked: -1, ok: 0, n: 0,
  start() {
    const d = shuffle(due()); const fresh = shuffle(M.items.filter(i => !rec(i.id))); const rest = shuffle(M.items.filter(i => rec(i.id) && !d.includes(i)));
    this.q = d.concat(fresh.slice(0, Math.max(5, 15 - d.length)), rest).slice(0, 15); this.i = 0; this.ok = 0; this.n = 0; this.active = true; this.next();
  },
  next() {
    if (this.i >= this.q.length) return this.finish();
    const it = this.q[this.i]; const same = M.items.filter(x => x !== it && x.group === it.group), other = M.items.filter(x => x !== it && x.group !== it.group);
    const opts = shuffle([it, ...shuffle(same).slice(0, 3).concat(shuffle(other)).slice(0, 3)]);
    this.cur = { it, opts }; this.locked = false; this.picked = -1; this.render();
  },
  render() {
    const { it, opts } = this.cur;
    app.innerHTML = `<div class="wrap learnwrap" style="max-width:820px">
      <div class="sethead"><a class="back" href="#/micro">← Мікроскоп</a><span class="spacer"></span><span class="muted" style="font-size:13px">${this.i + 1} / ${this.q.length} · ${this.ok} правильно</span></div>
      <div class="mquiz"><img src="${imgUrl(it.file)}" alt="Препарат"><div class="muted" style="font-size:13px;margin-top:6px">${esc(it.material)}${this.locked ? ` · ${esc(it.size)}` : ''}</div></div>
      <div class="fopts">${opts.map((o, i) => { let cls = ''; if (this.locked) { if (o === it) cls = 'ok'; else if (this.picked === i) cls = 'bad'; } return `<button class="fopt ${cls}" data-i="${i}"><kbd>${i + 1}</kbd><i>${esc(o.la)}</i> <span class="muted">${esc(o.uk)}</span></button>`; }).join('')}</div>
      ${this.locked ? `<div class="explain ${opts[this.picked] === it ? 'ok' : 'bad'}" style="margin-top:14px"><div><b class="${opts[this.picked] === it ? 'okc' : 'badc'}">${opts[this.picked] === it ? 'Правильно.' : 'Неправильно.'}</b> <i>${esc(it.la)}</i> — ${esc(it.uk)}.</div><p style="margin:8px 0 0"><b>На що дивитись:</b> ${esc(it.key)}</p><p style="margin:6px 0 0"><b>Не плутати:</b> ${esc(it.confuse)}</p>${creditHtml(it)}</div><div class="actions" style="margin-top:12px"><button class="primary" id="mqNext">Далі <kbd style="margin-left:8px;opacity:.7">Enter</kbd></button></div>` : ''}
    </div>`;
    $$('.fopt').forEach(b => b.onclick = () => this.pick(+b.dataset.i));
    const nb = $('#mqNext'); if (nb) nb.onclick = () => { this.i++; this.next(); };
    window.scrollTo(0, 0);
  },
  pick(i) {
    if (this.locked) return; const { it, opts } = this.cur; this.locked = true; this.picked = i; this.n++;
    const ok = opts[i] === it; if (ok) this.ok++;
    srsReview('micro', it.id, 'q', ok, ok ? 'good' : 'again');
    if (!ok) { try { noteConfusion('micro', it.id, opts[i].id); } catch (e) {} this.q.push(it); }   // помилку — ще раз наприкінці
    this.render();
  },
  finish() {
    this.active = false; const more = due().length;
    app.innerHTML = `<div class="wrap learnwrap"><section class="page-hero"><h1>Сесію завершено</h1><p>${this.ok} з ${this.n} правильно. ${more ? `Ще ${more} до повторення.` : 'Наступні повторення з’являться на «Сьогодні».'}</p></section>
      <div class="actions"><a href="#/micro/quiz"><button class="primary">Ще сесія</button></a><a href="#/micro"><button>Атлас препаратів</button></a><a href="#/today"><button>Сьогодні</button></a></div></div>`;
  },
  key(e) { if (!this.active || location.hash !== '#/micro/quiz' || $('dialog[open]')) return; if (!this.locked && /^[1-4]$/.test(e.key)) { e.preventDefault(); this.pick(+e.key - 1); } else if (this.locked && e.key === 'Enter') { e.preventDefault(); this.i++; this.next(); } }
};
document.addEventListener('keydown', e => Quiz.key(e));
EXT.badge.push(() => due().length);
EXT.today.push(() => { const d = due().length; return d ? `<h2 class="section-title">Мікроскоп</h2><div class="actions" style="margin-top:0"><a href="#/micro/quiz"><button class="primary">Впізнати препарати: ${d} →</button></a></div>` : ''; });
ROUTES.micro = parts => { Quiz.active = false; if (parts[0] === 'quiz') return Quiz.start(); renderHub(); };
window.Micro = { due, items: M.items };
})();
