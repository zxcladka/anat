/* Медична біологія: хаб (#/bio), послідовності (#/bio/seq/<id>), генетичні задачі (#/bio/gen).
   Картки (клітина, спадкові хвороби, паразити) живуть у FACTS з темами bio:1–4 — їх вчить js/facts.js. */
(function () {
const B = window.BIO; if (!B || !window.Facts) return;
const seqKey = id => srsKey('bio:seq', id, 'q');
const seqRec = id => srs[seqKey(id)];
const seqDue = () => B.sequences.filter(s => { const r = seqRec(s.id); return r && r.due <= Date.now(); });
const genKey = kind => srsKey('bio:gen', kind, 'q');
const topicOf = id => B.topics.find(t => t.id === id);

/* ---------- хаб ---------- */
function renderHub() {
  const due = Facts.dueCards(FACTS.items.filter(i => i.topic.startsWith('bio:'))).length + seqDue().length;
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Медична біологія</h1><p>Перший курс: клітина, генетика, паразити. Картки з полями (як у теорії з анатомії), послідовності «розстав по порядку» і генератор генетичних задач із розв’язком. Усе йде в те саме повторення, що й анатомія.</p></section>
    <div class="actions">${due ? `<a href="#/facts/all/learn"><button class="primary">Повторити ${due} →</button></a>` : ''}<a href="#/bio/gen"><button class="${due ? '' : 'primary'}">Генетичні задачі</button></a><a href="#/bio/ped"><button>Родоводи</button></a></div>
    <h2 class="section-title">Теми</h2>
    <div class="queue">${B.topics.map(t => { const items = Facts.byTopic(t.id), st = Facts.stat(items), sq = B.sequences.filter(s => s.topic === t.id); return `<a href="#/bio/${t.n}"><span class="tnum">${t.n}</span><span class="t">${esc(t.title)}<small class="muted"> · ${st.total} ${plural(st.total, 'картка', 'картки', 'карток')}${sq.length ? `, ${sq.length} ${plural(sq.length, 'послідовність', 'послідовності', 'послідовностей')}` : ''}</small></span><span class="c">${st.due ? `<b>${st.due}</b> до повторення` : st.seen ? `${st.mastered}/${st.total} засвоєно` : 'нова тема'}</span></a>`; }).join('')}</div>
    <h2 class="section-title">Послідовності</h2>
    <div class="queue">${B.sequences.map(s => { const r = seqRec(s.id); return `<a href="#/bio/seq/${s.id}"><span class="t">${esc(s.title)}</span><span class="c">${r ? (r.due <= Date.now() ? 'пора повторити' : `${r.reps} ${plural(r.reps, 'раз', 'рази', 'разів')} правильно`) : 'нова'}</span></a>`; }).join('')}</div>
  </div>`;
  window.scrollTo(0, 0);
}
function renderTopic(n) {
  const t = B.topics.find(x => x.n === +n); if (!t) return renderHub();
  const items = Facts.byTopic(t.id), st = Facts.stat(items), sq = B.sequences.filter(s => s.topic === t.id);
  const groups = [...new Set(items.map(i => i.group))];
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/bio">← Біологія</a></div>
    <section class="page-hero" style="padding-top:6px"><div class="crow-h"><span class="tnum big">${t.n}</span><h1 style="font-size:clamp(22px,3vw,32px)">${esc(t.title)}</h1></div><p>${esc(t.desc)}</p></section>
    <div class="tiles"><div class="tile"><b>${st.seen}<small class="muted" style="font-size:16px"> / ${st.total}</small></b><span>у повторенні</span></div><div class="tile"><b>${st.mastered}</b><span>засвоєно</span></div><div class="tile"><b>${st.due}</b><span>до повторення</span></div></div>
    <div class="actions"><a href="#/facts/${t.id}/learn"><button class="primary">${st.due ? `Повторити ${st.due}` : 'Вчити картки'} →</button></a><a href="#/facts/${t.id}"><button>Переглянути картки</button></a><a href="#/facts/${t.id}/quiz"><button>Тест</button></a>${t.id === 'bio:2' ? '<a href="#/bio/gen"><button>Генетичні задачі</button></a><a href="#/bio/ped"><button>Родоводи</button></a>' : ''}</div>
    <p class="muted" style="font-size:14px;margin:12px 0 0">${groups.map(g => esc(g)).join(' · ')}</p>
    ${sq.length ? `<h2 class="section-title">Послідовності</h2><div class="queue">${sq.map(s => `<a href="#/bio/seq/${s.id}"><span class="t">${esc(s.title)}</span><span class="c">${s.steps.length} етапів</span></a>`).join('')}</div>` : ''}
  </div>`;
  window.scrollTo(0, 0);
}

/* ---------- послідовності: розставити етапи ---------- */
const Seq = {
  s: null, order: [], picked: [], checked: false,
  start(id) {
    this.s = B.sequences.find(x => x.id === id); if (!this.s) return renderHub();
    this.order = shuffle(this.s.steps.map((_, i) => i)); this.picked = []; this.checked = false; this.render();
  },
  render() {
    const s = this.s, t = topicOf(s.topic);
    const left = this.order.filter(i => !this.picked.includes(i));
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/bio/${t ? t.n : ''}">← ${esc(t ? t.short : 'Біологія')}</a><span class="spacer"></span><span class="muted" style="font-size:13px">${this.picked.length} / ${s.steps.length}</span></div>
      <h1 style="font-size:24px;margin:8px 0">${esc(s.title)}</h1>
      <p class="muted" style="margin:0 0 12px;font-size:14px">Натискайте етапи в правильному порядку — від першого до останнього. Помилились — приберіть останній.</p>
      <div class="seqpicked">${this.picked.map((i, k) => { let cls = ''; if (this.checked) cls = i === k ? 'ok' : 'bad'; return `<div class="seqstep ${cls}"><span class="num">${k + 1}</span>${esc(s.steps[i])}</div>`; }).join('') || '<div class="muted" style="padding:10px 0">Тут з’явиться ваш порядок</div>'}</div>
      ${!this.checked ? `<div class="seqpool">${left.map(i => `<button class="seqopt" data-i="${i}">${esc(s.steps[i])}</button>`).join('')}</div>
        <div class="actions" style="margin-top:12px">${this.picked.length ? '<button id="sqUndo">← Прибрати останній</button>' : ''}${!left.length ? '<button class="primary" id="sqCheck">Перевірити</button>' : ''}</div>`
      : `<div class="explain ${this.ok ? 'ok' : 'bad'}" style="margin-top:12px"><b class="${this.ok ? 'okc' : 'badc'}">${this.ok ? 'Усе правильно.' : `Помилок: ${this.errors}.`}</b> ${esc(s.hint)}${this.ok ? '' : `<ol style="margin:10px 0 0 18px;padding:0">${s.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`}</div>
        <div class="actions" style="margin-top:12px"><a href="#/bio/seq/${s.id}"><button class="primary">Ще раз</button></a><a href="#/bio/${t ? t.n : ''}"><button>До теми</button></a></div>`}
    </div>`;
    $$('.seqopt').forEach(b => b.onclick = () => { this.picked.push(+b.dataset.i); this.render(); });
    const u = $('#sqUndo'); if (u) u.onclick = () => { this.picked.pop(); this.render(); };
    const c = $('#sqCheck'); if (c) c.onclick = () => this.check();
  },
  check() {
    this.errors = this.picked.filter((i, k) => i !== k).length; this.ok = this.errors === 0; this.checked = true;
    srsReview('bio:seq', this.s.id, 'q', this.ok, this.ok ? 'good' : 'again'); this.render();
  }
};

/* ---------- генетичні задачі ---------- */
const GENE = {
  mono: [['A', 'a', 'нормальна пігментація', 'альбінізм', 'аутосомно-рецесивна'], ['B', 'b', 'карі очі', 'блакитні очі', 'аутосомно-домінантна (спрощено)'], ['P', 'p', 'полідактилія', 'нормальна кількість пальців', 'аутосомно-домінантна'], ['F', 'f', 'нормальний обмін', 'фенілкетонурія', 'аутосомно-рецесивна'], ['R', 'r', 'резус-позитивна кров', 'резус-негативна кров', 'аутосомно-домінантна']],
  di: [['A', 'a', 'карі очі', 'блакитні очі', 'B', 'b', 'праворукість', 'ліворукість'], ['R', 'r', 'резус-позитивність', 'резус-негативність', 'D', 'd', 'темне волосся', 'світле волосся']],
};
const gametes = geno => { // 'AaBb' → ['AB','Ab','aB','ab']
  const pairs = geno.match(/../g); let out = [''];
  for (const p of pairs) { const al = p[0] === p[1] ? [p[0]] : [p[0], p[1]]; out = out.flatMap(g => al.map(a => g + a)); }
  return out;
};
const norm = gt => gt.match(/../g).map(p => p.split('').sort((x, y) => x.toLowerCase() === y.toLowerCase() ? (x === x.toUpperCase() ? -1 : 1) : x.toLowerCase() < y.toLowerCase() ? -1 : 1).join('')).join('');
function cross(g1, g2) {
  const G1 = gametes(g1), G2 = gametes(g2), res = {};
  for (const a of G1) for (const b of G2) { const gt = norm(a.split('').map((x, i) => x + b[i]).join('')); res[gt] = (res[gt] || 0) + 1; }
  return { G1, G2, res, total: G1.length * G2.length };
}
const Gen = {
  kind: 'mono', task: null, answered: false,
  start(kind) { this.kind = kind || this.kind; this.task = this.make(this.kind); this.answered = false; this.render(); },
  make(kind) {
    const pick = a => a[Math.floor(Math.random() * a.length)];
    if (kind === 'mono') {
      const [A, a, dom, rec, type] = pick(GENE.mono); const gs = [A + A, A + a, a + a]; const g1 = pick(gs), g2 = pick(gs);
      const c = cross(g1, g2); const domCount = Object.entries(c.res).filter(([g]) => g.includes(A)).reduce((s, [, n]) => s + n, 0);
      const ph = (A === 'B' ? dom : dom);
      const ask = pick(['dom', 'rec', 'hetero']);
      let q, ans, expl;
      if (ask === 'dom') { q = `Яка частка нащадків матиме ознаку «${dom}»?`; ans = domCount / c.total; }
      else if (ask === 'rec') { q = `Яка частка нащадків матиме ознаку «${rec}»?`; ans = (c.total - domCount) / c.total; }
      else { q = `Яка частка нащадків буде гетерозиготною (${A}${a})?`; ans = (c.res[A + a] || 0) / c.total; }
      return { kind, text: `Ознака «${dom}» домінує над «${rec}» (${type}). Схрестили батьків із генотипами ${g1} × ${g2}. ${q}`, ans, cross: c, A, a, dom, rec, g1, g2 };
    }
    if (kind === 'di') {
      const [A, a, dA, rA, Bg, b, dB, rB] = pick(GENE.di); const g1 = A + a + Bg + b, g2 = pick([A + a + Bg + b, a + a + b + b, A + a + b + b]);
      const c = cross(g1, g2); const ask = pick(['both', 'rec']);
      const cnt = f => Object.entries(c.res).filter(([g]) => f(g)).reduce((s, [, n]) => s + n, 0);
      let q, ans;
      if (ask === 'both') { q = `Яка частка нащадків матиме обидві домінантні ознаки («${dA}» і «${dB}»)?`; ans = cnt(g => g.includes(A) && g.includes(Bg)) / c.total; }
      else { q = `Яка частка нащадків матиме обидві рецесивні ознаки («${rA}» і «${rB}»)?`; ans = cnt(g => !g.includes(A) && !g.includes(Bg)) / c.total; }
      return { kind, text: `Гени не зчеплені. «${dA}» (${A}) домінує над «${rA}» (${a}), «${dB}» (${Bg}) — над «${rB}» (${b}). Батьки: ${g1} × ${g2}. ${q}`, ans, cross: c, g1, g2 };
    }
    if (kind === 'xlinked') {
      const dis = pick([['гемофілія', 'H', 'h'], ['дальтонізм', 'D', 'd'], ['м’язова дистрофія Дюшенна', 'M', 'm']]);
      const [name, D, d] = dis;
      let mother = pick([`X${D}X${d}`, `X${D}X${D}`]), father = pick([`X${D}Y`, `X${d}Y`]);
      if (mother === `X${D}X${D}` && father === `X${D}Y`) mother = `X${D}X${d}`;   // без тривіального випадку «всі здорові»
      const mg = mother === `X${D}X${d}` ? [`X${D}`, `X${d}`] : [`X${D}`]; const fg = father === `X${D}Y` ? [`X${D}`, 'Y'] : [`X${d}`, 'Y'];
      const kids = []; for (const m of mg) for (const f of fg) kids.push(m + f);
      const isSick = k => k === `X${d}X${d}` || k === `X${d}Y`; const isBoy = k => k.endsWith('Y');
      const ask = pick(['sick', 'sickBoys', 'carrierGirls']);
      let q, ans;
      if (ask === 'sick') { q = `Яка частка всіх дітей хворітиме?`; ans = kids.filter(isSick).length / kids.length; }
      else if (ask === 'sickBoys') { q = `Яка частка синів хворітиме?`; const boys = kids.filter(isBoy); ans = boys.filter(isSick).length / boys.length; }
      else { q = `Яка частка дочок буде носійками (X${D}X${d})?`; const girls = kids.filter(k => !isBoy(k)); ans = girls.filter(k => k === `X${D}X${d}`).length / girls.length; }
      const who = m => m === `X${D}X${d}` ? 'носійка' : 'здорова, не носійка', whoF = f => f === `X${D}Y` ? 'здоровий' : 'хворий';
      return { kind, text: `${name[0].toUpperCase() + name.slice(1)} — Х-зчеплена рецесивна ознака (${d}). Мати ${mother} (${who(mother)}), батько ${father} (${whoF(father)}). ${q}`, ans, kids, mg, fg, g1: mother, g2: father };
    }
    // ABO
    const genos = ['IAIA', 'IAi', 'IBIB', 'IBi', 'IAIB', 'ii']; const gr = g => g === 'ii' ? 'I (0)' : g.includes('IA') && g.includes('IB') ? 'IV (AB)' : g.includes('IA') ? 'II (A)' : 'III (B)';
    const gam = g => g === 'IAIA' ? ['IA'] : g === 'IBIB' ? ['IB'] : g === 'ii' ? ['i'] : g === 'IAIB' ? ['IA', 'IB'] : [g.slice(0, 2), 'i'];
    const g1 = genos[Math.floor(Math.random() * 6)], g2 = genos[Math.floor(Math.random() * 6)];
    const kids = []; for (const x of gam(g1)) for (const y of gam(g2)) { const k = [x, y].sort().join(''); kids.push(k === 'IBi' ? 'IBi' : k); }
    const groupsN = kids.map(k => gr(k.replace('iIA', 'IAi').replace('iIB', 'IBi'))); const target = groupsN[Math.floor(Math.random() * groupsN.length)];
    const ans = groupsN.filter(x => x === target).length / groupsN.length;
    return { kind, text: `Групи крові системи AB0: IA і IB кодомінантні, i — рецесивний. Мати має генотип ${g1} (${gr(g1)}), батько — ${g2} (${gr(g2)}). Яка ймовірність народження дитини з групою ${target}?`, ans, kids: kids.map((k, i) => k + ' → ' + groupsN[i]), g1, g2 };
  },
  fmt(x) { const fr = [[0, '0'], [1 / 16, '1/16'], [1 / 8, '1/8'], [3 / 16, '3/16'], [1 / 4, '1/4'], [3 / 8, '3/8'], [1 / 2, '1/2'], [9 / 16, '9/16'], [5 / 8, '5/8'], [3 / 4, '3/4'], [7 / 8, '7/8'], [1, '1 (усі)']]; const f = fr.find(([v]) => Math.abs(v - x) < 1e-6); return (f ? f[1] : x.toFixed(3)) + ` (${Math.round(x * 100)} %)`; },
  parse(s) { s = String(s).trim().replace(',', '.').replace('%', ''); if (!s) return NaN; if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b : NaN; } const v = Number(s); return v > 1 ? v / 100 : v; },
  render() {
    const t = this.task, kinds = [['mono', 'Моногібридне'], ['di', 'Дигібридне'], ['xlinked', 'Зчеплене з X'], ['abo', 'Групи крові']];
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/bio">← Біологія</a><h1 style="font-size:22px">Генетичні задачі</h1><span class="spacer"></span><a href="#/bio/ped"><button class="small">Родоводи →</button></a></div>
      <div class="filters" style="margin:8px 0 14px">${kinds.map(([k, n]) => `<button class="${k === this.kind ? 'active' : ''}" data-kind="${k}">${n}</button>`).join('')}</div>
      <div class="cardbox"><div class="cardface" style="font-size:17px">${esc(t.text)}</div></div>
      ${!this.answered ? `<div class="actions" style="margin-top:12px"><input id="genAns" type="text" inputmode="decimal" placeholder="Відповідь: 3/4, 0.75 або 75 %" style="flex:1;min-width:200px;font-size:16px;padding:10px 12px;border:1px solid var(--line2);border-radius:10px;background:var(--paper);color:var(--ink)"><button class="primary" id="genCheck">Перевірити</button></div>`
      : `<div class="explain ${this.ok ? 'ok' : 'bad'}" style="margin-top:12px"><b class="${this.ok ? 'okc' : 'badc'}">${this.ok ? 'Правильно.' : 'Неправильно.'}</b> Відповідь: <b>${this.fmt(t.ans)}</b>${this.explain()}</div>
        <div class="actions" style="margin-top:12px"><button class="primary" id="genNext">Наступна задача</button></div>`}
    </div>`;
    $$('.filters button[data-kind]').forEach(b => b.onclick = () => this.start(b.dataset.kind));
    const c = $('#genCheck'); if (c) { c.onclick = () => this.check(); $('#genAns').addEventListener('keydown', e => { if (e.key === 'Enter') this.check(); }); $('#genAns').focus(); }
    const n = $('#genNext'); if (n) n.onclick = () => this.start();
  },
  explain() {
    const t = this.task;
    if (t.cross) { const { G1, G2, res } = t.cross; return `<div style="margin-top:8px;overflow-x:auto"><table class="punnett"><tr><th></th>${G2.map(g => `<th>${g}</th>`).join('')}</tr>${G1.map(a => `<tr><th>${a}</th>${G2.map(b => `<td>${norm(a.split('').map((x, i) => x + b[i]).join(''))}</td>`).join('')}</tr>`).join('')}</table></div><p style="margin:8px 0 0;font-size:14px">Генотипи нащадків: ${Object.entries(res).map(([g, n]) => `${g} — ${n}/${t.cross.total}`).join(', ')}.</p>`; }
    if (t.kids) return `<p style="margin:8px 0 0;font-size:14px">Гамети: ${t.mg ? t.mg.join(', ') + ' × ' + t.fg.join(', ') : ''}. Нащадки: ${t.kids.join('; ')}.</p>`;
    return '';
  },
  check() {
    const v = this.parse($('#genAns').value); if (isNaN(v)) { $('#genAns').focus(); return; }
    this.ok = Math.abs(v - this.task.ans) < 0.02; this.answered = true;
    srsReview('bio:gen', this.kind, 'q', this.ok, this.ok ? 'good' : 'again'); this.render();
  }
};

/* ---------- родоводи: генератор + розбір через спростування типів успадкування ---------- */
const MODES = { AD: 'Аутосомно-домінантний', AR: 'Аутосомно-рецесивний', XD: 'X-зчеплений домінантний', XR: 'X-зчеплений рецесивний', Y: 'Y-зчеплений (голандричний)' };
const TRAITS = { AD: ['полідактилія', 'ахондроплазія', 'хорея Гентінгтона', 'синдром Марфана', 'брахідактилія'], AR: ['фенілкетонурія', 'альбінізм', 'муковісцидоз', 'галактоземія', 'серпоподібноклітинна анемія'], XD: ['гіпофосфатемічний рахіт', 'темна емаль зубів'], XR: ['гемофілія', 'дальтонізм', 'міодистрофія Дюшенна'], Y: ['гіпертрихоз вушних раковин', 'іхтіоз (Y-зчеплена форма)'] };
const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
function affectedOf(mode, p) {
  const g = p.g;
  if (mode === 'AD' || mode === 'XD') return g.includes('A');
  if (mode === 'AR') return g[0] === 'a' && g[1] === 'a';
  if (mode === 'XR') return p.sex === 'm' ? g[0] === 'a' : (g[0] === 'a' && g[1] === 'a');
  return p.sex === 'm' && g[0] === 'Y';
}
function child(mode, f, m) {
  const sex = Math.random() < 0.5 ? 'm' : 'f'; let g;
  if (mode === 'AD' || mode === 'AR') g = [pick(f.g), pick(m.g)];
  else if (mode === 'XD' || mode === 'XR') g = sex === 'm' ? [pick(m.g)] : [f.g[0], pick(m.g)];
  else g = sex === 'm' ? [f.g[0]] : ['-'];
  return { sex, g, father: f, mother: m };
}
function spouse(mode, sex) {
  const g = mode === 'AD' || mode === 'XD' ? (sex === 'm' && mode === 'XD' ? ['a'] : ['a', 'a'])
    : mode === 'AR' ? (Math.random() < 0.55 ? ['A', 'a'] : ['A', 'A'])
    : mode === 'XR' ? (sex === 'm' ? ['A'] : (Math.random() < 0.4 ? ['A', 'a'] : ['A', 'A']))
    : (sex === 'm' ? ['y'] : ['-']);
  return { sex, g };
}
function founders(mode) {
  const f = { sex: 'm' }, m = { sex: 'f' };
  if (mode === 'AD') { if (Math.random() < 0.5) { f.g = ['A', 'a']; m.g = ['a', 'a']; } else { f.g = ['a', 'a']; m.g = ['A', 'a']; } }
  else if (mode === 'AR') { f.g = ['A', 'a']; m.g = Math.random() < 0.6 ? ['A', 'a'] : ['a', 'a']; if (Math.random() < 0.3) f.g = ['a', 'a']; }
  else if (mode === 'XD') { if (Math.random() < 0.5) { f.g = ['A']; m.g = ['a', 'a']; } else { f.g = ['a']; m.g = ['A', 'a']; } }
  else if (mode === 'XR') { f.g = Math.random() < 0.4 ? ['a'] : ['A']; m.g = ['A', 'a']; }
  else { f.g = ['Y']; m.g = ['-']; }
  return [f, m];
}
function generate(mode) {
  const [f0, m0] = founders(mode); const people = [f0, m0]; f0.gen = 1; m0.gen = 1; f0.spouse = m0; m0.spouse = f0;
  const n2 = 3 + rnd(3); f0.kids = [];
  for (let i = 0; i < n2; i++) { const c = child(mode, f0, m0); c.gen = 2; f0.kids.push(c); people.push(c);
    if (Math.random() < 0.75) { const s = spouse(mode, c.sex === 'm' ? 'f' : 'm'); s.gen = 2; s.spouse = c; c.spouse = s; people.push(s);
      const n3 = 2 + rnd(3); c.kids = []; const fa = c.sex === 'm' ? c : s, mo = c.sex === 'm' ? s : c;
      for (let j = 0; j < n3; j++) { const k = child(mode, fa, mo); k.gen = 3; c.kids.push(k); people.push(k); } } }
  people.forEach(p => { p.aff = affectedOf(mode, p); });
  // нумерація: покоління римськими, зліва направо
  const order = []; const push = p => { p.id = `${['', 'I', 'II', 'III'][p.gen]}-${order.filter(x => x.gen === p.gen).length + 1}`; order.push(p); };
  push(f0); push(m0);
  for (const c of f0.kids) { if (c.spouse && c.sex === 'f') { push(c.spouse); push(c); } else { push(c); if (c.spouse) push(c.spouse); } }
  for (const c of f0.kids) if (c.kids) for (const k of c.kids) push(k);
  return { mode, people, root: f0 };
}
// спростування: які факти виключають кожен тип
function analyze(P) {
  const ps = P.people, ex = { AD: [], AR: [], XD: [], XR: [], Y: [] };
  const kids = ps.filter(p => p.father);
  for (const k of kids) {
    if (k.aff && !k.father.aff && !k.mother.aff) { ex.AD.push(`${k.id} ${k.sex === 'm' ? 'хворий' : 'хвора'}, а батьки ${k.father.id} і ${k.mother.id} здорові — домінантна ознака не може «перескочити» покоління`); ex.XD.push(`${k.id} з хворобою при здорових батьках — для X-домінантного типу теж неможливо`); }
    if (!k.aff && k.father.aff && k.mother.aff) ex.AR.push(`у двох хворих батьків ${k.father.id} і ${k.mother.id} народилась здорова дитина ${k.id} — при рецесивному типі обоє батьків aa і всі діти мали б бути хворі`);
    if (k.sex === 'f' && k.aff && !k.father.aff) ex.XR.push(`хвора дочка ${k.id} має здорового батька ${k.father.id} — X-рецесивна хвора жінка отримує рецесивну X і від батька, тож він мав би бути хворим`);
    if (k.sex === 'm' && !k.aff && k.mother.aff) ex.XR.push(`у хворої матері ${k.mother.id} є здоровий син ${k.id} — при X-рецесивному типі всі сини хворої матері хворі`);
    if (k.sex === 'f' && !k.aff && k.father.aff) ex.XD.push(`хворий батько ${k.father.id} має здорову дочку ${k.id} — при X-домінантному типі всі дочки хворого батька хворі`);
    if (k.sex === 'm' && k.aff && !k.mother.aff) ex.XD.push(`хворий син ${k.id} має здорову матір ${k.mother.id} — син отримує X лише від матері`);
    if (k.sex === 'm' && k.aff && !k.father.aff) ex.Y.push(`хворий чоловік ${k.id} має здорового батька ${k.father.id}`);
    if (k.sex === 'm' && !k.aff && k.father.aff) ex.Y.push(`у хворого батька ${k.father.id} є здоровий син ${k.id} — Y передається всім синам`);
  }
  const affF = ps.filter(p => p.aff && p.sex === 'f'); if (affF.length) ex.Y.push(`є ${affF.length > 1 ? 'хворі жінки' : 'хвора жінка'} (${affF.map(p => p.id).join(', ')}) — Y-хромосоми в жінок немає`);
  const R = Object.keys(ex).filter(m => !ex[m].length);
  const affected = ps.filter(p => p.aff);
  const skipping = kids.some(k => k.aff && !k.father.aff && !k.mother.aff);
  let answer = null, why = [];
  if (R.length === 1) answer = R[0];
  else if (R.includes('Y') && affected.every(p => p.sex === 'm') && affected.filter(p => p.father).every(p => p.father.aff) && affected.length >= 3 && kids.some(k => k.sex === 'f' && !k.aff && k.father.aff)) { answer = 'Y'; why.push('хворіють лише чоловіки, кожен хворий син має хворого батька, усі сини хворих батьків хворі, а дочки — здорові'); }
  else if (!skipping) {
    if (R.includes('XD') && R.includes('AD')) {
      const informative = ps.filter(p => p.sex === 'm' && p.aff && p.kids && p.kids.some(k => k.sex === 'f') && p.kids.some(k => k.sex === 'm') && p.kids.every(k => k.sex === 'f' ? k.aff : !k.aff));
      if (informative.length) { answer = 'XD'; why.push(`у хворого батька ${informative[0].id} всі дочки хворі, а всі сини здорові — так передається X-домінантна ознака`); }
      else { const dad = ps.find(p => p.sex === 'm' && p.aff && p.kids && p.kids.some(k => k.sex === 'm' && k.aff)); if (dad) { answer = 'AD'; why.push(`хворий батько ${dad.id} передав ознаку синові — через X це неможливо`); } }
    } else if (R.includes('AD')) { answer = 'AD'; why.push('ознака в кожному поколінні, у кожного хворого є хворий батько чи мати; X-домінантний виключено'); }
    else if (R.includes('XD')) { answer = 'XD'; why.push('ознака в кожному поколінні, аутосомно-домінантний виключено'); }
  } else {
    if (R.includes('XR') && R.includes('AR')) {
      if (affected.every(p => p.sex === 'm') && affected.length >= 2) { answer = 'XR'; why.push('хворіють лише чоловіки, ознака передається через здорових матерів (носійок) — типова картина X-рецесивного успадкування'); }
      else { answer = 'AR'; why.push('серед хворих є жінки, обидві статі уражаються, батьки хворих здорові — аутосомно-рецесивний тип'); }
    } else if (R.includes('AR')) { answer = 'AR'; why.push('ознака «перескакує» покоління, X-рецесивний виключено'); }
    else if (R.includes('XR')) { answer = 'XR'; why.push('ознака «перескакує» покоління, аутосомно-рецесивний виключено'); }
  }
  return { ex, R, answer, why, skipping, affected };
}
function makePedigree() {
  const modes = shuffle(Object.keys(MODES));   // спершу випадковий тип, і лише якщо не вдалось згенерувати однозначний родовід — наступний
  for (let t = 0; t < 600; t++) {
    const mode = modes[Math.floor(t / 120) % modes.length]; const P = generate(mode); const A = analyze(P);
    if (A.answer !== mode || A.affected.length < 2 || A.affected.length > P.people.length * 0.6) continue;
    if (A.affected.every(p => p.gen === 1)) continue;
    if (mode === 'AR' && A.affected.every(p => p.sex === 'm')) continue;
    if (mode === 'XR' && A.affected.some(p => p.sex === 'f')) continue;
    return { P, A, trait: pick(TRAITS[mode]) };
  }
  return null;
}
function svgPedigree(P) {
  const U = 46, GY = 96, S = 13; const root = P.root;
  const widthOf = c => c.spouse ? Math.max(2, (c.kids || []).length) : 1;
  const w2 = root.kids.reduce((a, c) => a + widthOf(c), 0); const W = Math.max(w2, 2) * U + 40, H = 3 * GY + 30;
  let x = 20; const el = []; const pos = new Map();
  const sym = (p, cx, cy) => { pos.set(p, [cx, cy]); el.push(p.sex === 'm' ? `<rect x="${cx - S}" y="${cy - S}" width="${2 * S}" height="${2 * S}" class="${p.aff ? 'aff' : ''}"/>` : `<circle cx="${cx}" cy="${cy}" r="${S}" class="${p.aff ? 'aff' : ''}"/>`); el.push(`<text x="${cx}" y="${cy + S + 13}">${p.id}</text>`); };
  const couple = (a, b, cx, cy) => { const ax = cx - U / 2, bx = cx + U / 2; el.push(`<line x1="${ax + S}" y1="${cy}" x2="${bx - S}" y2="${cy}"/>`); sym(a.sex === 'm' ? a : b, ax, cy); sym(a.sex === 'm' ? b : a, bx, cy); };
  const sibs = (cx, cy, xs, ky) => { el.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy + 26}"/>`); if (xs.length > 1) el.push(`<line x1="${xs[0]}" y1="${cy + 26}" x2="${xs[xs.length - 1]}" y2="${cy + 26}"/>`); xs.forEach(kx => el.push(`<line x1="${kx}" y1="${cy + 26}" x2="${kx}" y2="${ky - S}"/>`)); };
  const y1 = 24, y2 = y1 + GY, y3 = y2 + GY; const xs2 = [];
  for (const c of root.kids) {
    const w = widthOf(c) * U; const cx = x + w / 2;
    if (c.spouse) { couple(c, c.spouse, cx, y2); xs2.push(cx + (c.sex === 'm' ? -U / 2 : U / 2));
      const kids = c.kids || []; const kxs = kids.map((k, i) => x + w / 2 - (kids.length - 1) * U / 2 + i * U); kids.forEach((k, i) => sym(k, kxs[i], y3)); if (kids.length) sibs(cx, y2, kxs, y3); }
    else { sym(c, cx, y2); xs2.push(cx); }
    x += w;
  }
  const cx1 = (xs2[0] + xs2[xs2.length - 1]) / 2; couple(root, root.spouse, cx1, y1); sibs(cx1, y1, xs2, y2);
  return `<svg class="pedigree" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Родовід">${el.join('')}</svg>`;
}
const Ped = {
  cur: null, answered: false, picked: null,
  start() { const t = makePedigree(); if (!t) return renderHub(); this.cur = t; this.answered = false; this.picked = null; this.render(); },
  render() {
    const { P, A, trait } = this.cur; const modes = Object.keys(MODES);
    app.innerHTML = `<div class="wrap learnwrap">
      <div class="sethead"><a class="back" href="#/bio">← Біологія</a><h1 style="font-size:22px">Родоводи</h1></div>
      <p class="muted" style="margin:6px 0 10px;font-size:14px">Ознака: <b>${esc(trait)}</b>. Зафарбовані — хворі; квадрат — чоловік, коло — жінка. Визначте тип успадкування. Порада: не «вгадуйте» тип — по черзі спростовуйте кожен: знайдіть сім’ю, де він неможливий.</p>
      <div class="cardbox" style="overflow-x:auto;text-align:center"><div style="display:inline-block;min-width:100%">${svgPedigree(P)}</div></div>
      <div class="fopts" style="margin-top:12px">${modes.map((m, i) => { let cls = ''; if (this.answered) { if (m === A.answer) cls = 'ok'; else if (this.picked === m) cls = 'bad'; } return `<button class="fopt ${cls}" data-m="${m}"><kbd>${i + 1}</kbd>${MODES[m]}</button>`; }).join('')}</div>
      ${this.answered ? `<div class="explain ${this.ok ? 'ok' : 'bad'}" style="margin-top:14px"><div><b class="${this.ok ? 'okc' : 'badc'}">${this.ok ? 'Правильно.' : 'Неправильно.'}</b> Відповідь: ${MODES[A.answer].toLowerCase()}.</div>
        <div style="margin-top:8px;font-size:14px;line-height:1.5"><b>Спростування по черзі:</b><ol style="margin:4px 0 0 18px;padding:0">${modes.filter(m => m !== A.answer && A.ex[m].length).map(m => `<li>${MODES[m]} — <b>ні</b>: ${esc(A.ex[m][0])}.</li>`).join('')}</ol>
        ${(() => { const rest = modes.filter(m => m !== A.answer && !A.ex[m].length); return rest.length ? `<p style="margin:6px 0 0">${rest.map(m => MODES[m].toLowerCase()).join(', ')} — формально не суперечить, але ${esc(A.why[0] || 'менш імовірно')}.</p>` : `<p style="margin:6px 0 0">Лишається один тип — <b>${MODES[A.answer].toLowerCase()}</b>${A.why.length ? ': ' + esc(A.why[0]) : ''}.</p>`; })()}</div></div>
        <div class="actions" style="margin-top:12px"><button class="primary" id="pdNext">Наступний родовід</button></div>` : ''}
    </div>`;
    $$('.fopt[data-m]').forEach(b => b.onclick = () => this.pick(b.dataset.m));
    const n = $('#pdNext'); if (n) n.onclick = () => this.start();
    window.scrollTo(0, 0);
  },
  pick(m) { if (this.answered) return; this.picked = m; this.ok = m === this.cur.A.answer; this.answered = true; srsReview('bio:ped', 'all', 'q', this.ok, this.ok ? 'good' : 'again'); this.render(); },
  key(e) { if (!this.cur || location.hash !== '#/bio/ped' || $('dialog[open]')) return; if (!this.answered && /^[1-5]$/.test(e.key)) { e.preventDefault(); this.pick(Object.keys(MODES)[+e.key - 1]); } else if (this.answered && e.key === 'Enter') { e.preventDefault(); this.start(); } }
};
document.addEventListener('keydown', e => Ped.key(e));

EXT.today.push(() => {
  const d = seqDue(); if (!d.length) return '';
  return `<h2 class="section-title">Біологія: послідовності</h2><div class="queue">${d.map(s => `<a href="#/bio/seq/${s.id}"><span class="t">${esc(s.title)}</span><span class="c">повторити</span></a>`).join('')}</div>`;
});
EXT.badge.push(() => seqDue().length);

ROUTES.bio = parts => {
  if (!parts[0]) return renderHub();
  if (parts[0] === 'seq') return Seq.start(parts[1]);
  if (parts[0] === 'gen') return Gen.start(parts[1]);
  if (parts[0] === 'ped') return Ped.start();
  return renderTopic(parts[0]);
};
window.Bio = { Seq, Gen, Ped };
})();
