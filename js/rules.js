/* Закономірності іннервації (#/rules): довідник «група м'язів → нерв → винятки» і тест (#/rules/quiz).
   Повторення: ключ rules|<id>|q (нерв групи) і rules|<id>:ex|q (винятки). */
'use strict';
(() => {
const R = window.RULES || []; if (!R.length) return;
const regions = () => [...new Set(R.map(r => r.region))];
const rec = k => srs[srsKey('rules', k, 'q')];
const due = () => R.filter(r => { const a = rec(r.id), b = rec(r.id + ':ex'); return (a && a.due <= Date.now()) || (b && b.due <= Date.now()); }).length;
const nerves = () => [...new Set(R.map(r => r.nerve))];

function renderHub() {
  const seen = R.filter(r => rec(r.id) || rec(r.id + ':ex')).length;
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/facts">← Теорія</a></div>
    <section class="page-hero" style="padding-top:6px"><h1>Закономірності іннервації</h1><p>Замість 300 окремих фактів — ${R.length} правил і ${R.reduce((a, r) => a + r.ex.length, 0)} винятків. Група м’язів має один нерв; винятки — це саме те, що питають на контролі. Вчіть правило разом із винятком: «передня група передпліччя — серединний, крім…».</p></section>
    <div class="tiles"><div class="tile"><b>${R.length}</b><span>правил</span></div><div class="tile"><b>${R.reduce((a, r) => a + r.ex.length, 0)}</b><span>винятків</span></div><div class="tile"><b>${seen}</b><span>у повторенні</span></div><div class="tile"><b>${due()}</b><span>до повторення</span></div></div>
    <div class="actions"><a href="#/rules/quiz"><button class="primary">Тест →</button></a></div>
    ${regions().map(reg => `<h2 class="section-title">${esc(reg)}</h2><div class="rules">${R.filter(r => r.region === reg).map(r => `<details class="rule"><summary><span class="rg">${esc(r.group)}</span><span class="rn">${esc(r.nerve)}</span>${r.ex.length ? `<span class="chip">${r.ex.length} ${plural(r.ex.length, 'виняток', 'винятки', 'винятків')}</span>` : '<span class="chip ok">без винятків</span>'}</summary>
      <div class="rbody"><p><b>М’язи:</b> ${esc(r.muscles)}</p>${r.ex.length ? `<p><b>Винятки:</b></p><ul>${r.ex.map(([m, n]) => `<li><i>${esc(m)}</i> — ${esc(n)}</li>`).join('')}</ul>` : ''}${r.mnemo ? `<p class="mnemo">${esc(r.mnemo)}</p>` : ''}</div></details>`).join('')}</div>`).join('')}
  </div>`;
  window.scrollTo(0, 0);
}
const Quiz = {
  active: false, n: 0, ok: 0, cur: null, locked: false, picked: -1,
  start() { this.n = 0; this.ok = 0; this.active = true; this.next(); },
  make() {
    const r = R[Math.floor(Math.random() * R.length)];
    const kind = r.ex.length && Math.random() < 0.5 ? 'ex' : 'nerve';
    if (kind === 'nerve') {
      const dist = shuffle(nerves().filter(n => n !== r.nerve)).slice(0, 3);
      return { r, kind, q: `Яким нервом іннервується: <b>${esc(r.group.toLowerCase())}</b>?`, opts: shuffle([r.nerve, ...dist]), ans: r.nerve, key: r.id };
    }
    const [m, n] = r.ex[Math.floor(Math.random() * r.ex.length)];
    if (Math.random() < 0.5) { const dist = shuffle(nerves().filter(x => x !== n && x !== r.nerve)).slice(0, 2); return { r, kind, q: `<i>${esc(m)}</i> — виняток у групі «${esc(r.group.toLowerCase())}». Який нерв його іннервує?`, opts: shuffle([n, r.nerve, ...dist]), ans: n, key: r.id + ':ex' }; }
    // який м'яз — виняток
    const own = r.muscles.split(/[,;]\s*/).map(x => x.replace(/\s+—.*$/, '').trim()).filter(x => /^m{1,2}\./i.test(x) && !r.ex.some(e => e[0].toLowerCase().includes(x.toLowerCase().replace(/^mm?\.\s*/, '')))).slice(0, 8);
    const dist = shuffle(own).slice(0, 3); if (dist.length < 3) return this.make();
    return { r, kind, q: `Який м’яз у групі «${esc(r.group.toLowerCase())}» іннервується <b>не</b> ${esc(r.nerve.split(' (')[0])}, а іншим нервом?`, opts: shuffle([m, ...dist]), ans: m, key: r.id + ':ex' };
  },
  next() { this.cur = this.make(); this.locked = false; this.picked = -1; this.render(); },
  render() {
    const c = this.cur;
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/rules">← Закономірності</a><span class="spacer"></span><span class="muted" style="font-size:13px">${this.ok} / ${this.n}</span></div>
      <div class="cardbox"><div class="cardface"><div class="cdeck muted">${esc(c.r.region)}</div><div class="fq" style="margin-top:8px;font-weight:500;font-size:19px;line-height:1.35;display:block">${c.q}</div></div></div>
      <div class="fopts">${c.opts.map((o, i) => { let cls = ''; if (this.locked) { if (o === c.ans) cls = 'ok'; else if (this.picked === i) cls = 'bad'; } return `<button class="fopt ${cls}" data-i="${i}"><kbd>${i + 1}</kbd>${esc(o)}</button>`; }).join('')}</div>
      ${this.locked ? `<div class="explain ${c.opts[this.picked] === c.ans ? 'ok' : 'bad'}" style="margin-top:14px"><b class="${c.opts[this.picked] === c.ans ? 'okc' : 'badc'}">${c.opts[this.picked] === c.ans ? 'Правильно.' : 'Неправильно.'}</b> <b>${esc(c.r.group)}</b> — ${esc(c.r.nerve)}. ${esc(c.r.muscles)}.${c.r.ex.length ? ` <b>Винятки:</b> ${c.r.ex.map(([m, n]) => `${esc(m)} — ${esc(n)}`).join('; ')}.` : ''}${c.r.mnemo ? `<div class="mnemo" style="margin-top:8px">${esc(c.r.mnemo)}</div>` : ''}</div><div class="actions" style="margin-top:12px"><button class="primary" id="rqNext">Далі <kbd style="margin-left:8px;opacity:.7">Enter</kbd></button></div>` : ''}
    </div>`;
    $$('.fopt').forEach(b => b.onclick = () => this.pick(+b.dataset.i));
    const nb = $('#rqNext'); if (nb) nb.onclick = () => this.next();
    window.scrollTo(0, 0);
  },
  pick(i) { if (this.locked) return; const c = this.cur; this.locked = true; this.picked = i; this.n++; const ok = c.opts[i] === c.ans; if (ok) this.ok++; srsReview('rules', c.key, 'q', ok, ok ? 'good' : 'again'); this.render(); },
  key(e) { if (!this.active || location.hash !== '#/rules/quiz' || $('dialog[open]')) return; if (!this.locked && /^[1-4]$/.test(e.key)) { e.preventDefault(); this.pick(+e.key - 1); } else if (this.locked && e.key === 'Enter') { e.preventDefault(); this.next(); } }
};
document.addEventListener('keydown', e => Quiz.key(e));
EXT.badge.push(() => due());
EXT.today.push(() => { const d = due(); return d ? `<h2 class="section-title">Закономірності іннервації</h2><div class="actions" style="margin-top:0"><a href="#/rules/quiz"><button class="primary">Повторити правила: ${d} →</button></a></div>` : ''; });
ROUTES.rules = parts => { Quiz.active = false; if (parts[0] === 'quiz') return Quiz.start(); renderHub(); };
window.Rules = { R, due };
})();
