/* ---------- Курс: вибір курсу, модулі → теми → матеріали (схеми, картки, бліц) ---------- */
'use strict';
(() => {
const CUR = window.CURRICULUM || { courses: [] };
const COURSE_KEY = 'anat.course', LINKS_KEY = 'anat.topicLinks';
let courseId = LS.get(COURSE_KEY, null);                  // null — ще не обрано; 'none' — без курсу
const course = () => CUR.courses.find(c => c.id === courseId) || null;
const tid = (m, t) => `${courseId}:${m.id}:${t.n}`;
const setsOf = t => t.sets.map(id => ATLAS.sets.find(s => s.id === id)).filter(Boolean);
const findTopic = (mid, n) => { const c = course(); const m = c && c.modules.find(x => x.id === mid); const t = m && m.topics.find(x => x.n === +n); return t ? { c, m, t } : null; };
// відома структура — є запис повторення з хоча б однією правильною відповіддю у будь-якому режимі
function topicStats(t) {
  const sets = setsOf(t); let total = 0, known = 0, done = 0, mastered = 0;
  for (const s of sets) { total += s.items.length; if (progFor(s.id, 'direct').streak >= GOAL && progFor(s.id, 'reverse').streak >= GOAL) done++;
    for (const it of s.items) { const k = structKey(it), a = srs[srsKey(s.id, k, 'direct')], b = srs[srsKey(s.id, k, 'reverse')]; if ((a && (a.reps || a.okDays)) || (b && (b.reps || b.okDays))) known++; if (srsMastered(a) || srsMastered(b)) mastered++; } }
  return { sets: sets.length, total, known, done, mastered, pct: total ? Math.round(known / total * 100) : 0 };
}
function moduleStats(m) { let total = 0, known = 0, withMat = 0; for (const t of m.topics) { if (t.control) continue; const s = topicStats(t); total += s.total; known += s.known; if (s.sets || (window.Facts && Facts.byTopic(tid(m, t)).length)) withMat++; } return { total, known, withMat, topics: m.topics.filter(t => !t.control).length, pct: total ? Math.round(known / total * 100) : 0 }; }
function nextTopic() { const c = course(); if (!c) return null; for (const m of c.modules) for (const t of m.topics) { if (t.control || !t.sets.length) continue; if (topicStats(t).pct < 100) return { m, t }; } return null; }
const links = () => LS.get(LINKS_KEY, {});
const bar = (pct, cls = '') => `<div class="track ${cls}"><div class="fill" style="width:${pct}%"></div></div>`;

EXT.homeHash = () => courseId === 'none' ? '#/atlas' : courseId ? '#/course' : '#/choose';
EXT.today.unshift(() => {
  const c = course(); if (!c) return '';
  const nx = nextTopic(); if (!nx) return '';
  const st = topicStats(nx.t);
  return `<div class="blitzcta"><a href="#/course/${nx.m.id}/${nx.t.n}"><div class="goal"><div class="tnum">${nx.t.n}</div><div style="min-width:0"><b>${esc(c.name)} · ${esc(nx.m.short)}</b><span class="muted tclip">${esc(nx.t.title)}</span></div><span class="spacer"></span><button class="primary">Тема →</button></div></a></div>`;
});

function renderChoose() {
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><h1>Який у вас курс?</h1><p>Матеріали атласу, картки та бліц будуть згруповані за модулями й темами вашої програми. Це можна змінити будь-коли.</p></section>
    <div class="grid courses">${CUR.courses.map(c => `<div class="card coursecard ${c.modules.length ? '' : 'soon'}" data-id="${c.id}"><div class="body"><h3>${esc(c.name)}</h3><div class="muted">${esc(c.full)}</div>
      <div class="meta">${c.modules.length ? c.modules.map(m => `<span class="chip">${esc(m.short)}</span>`).join('') : '<span class="chip" style="background:var(--line);color:var(--muted)">скоро</span>'}</div>
      <div class="muted" style="font-size:13px">${c.modules.length ? c.modules.reduce((a, m) => a + m.topics.length, 0) + ' тем' : esc(c.note)}</div>
      <div class="prog"><button class="small primary">${c.modules.length ? 'Обрати' : 'Обрати все одно'}</button></div></div></div>`).join('')}
      <div class="card coursecard" data-id="none"><div class="body"><h3>Без курсу</h3><div class="muted">Увесь атлас без прив’язки до програми: ${ATLAS.sets.length} схем, ${ATLAS.sets.reduce((a, s) => a + s.items.length, 0)} структур.</div><div class="prog"><button class="small">Просто атлас</button></div></div></div>
    </div></div>`;
  $$('.coursecard').forEach(el => el.onclick = () => { courseId = el.dataset.id; LS.set(COURSE_KEY, courseId); location.hash = courseId === 'none' ? '#/atlas' : '#/course'; });
  window.scrollTo(0, 0);
}
function renderCourse() {
  const c = course(); if (!c) return renderChoose();
  const nx = nextTopic();
  app.innerHTML = `<div class="wrap">
    <section class="page-hero"><div class="crow-h"><h1>${esc(c.name)}</h1><a href="#/choose" class="muted chg">змінити курс</a></div><p>${esc(c.full)}. ${esc(c.note)}</p></section>
    ${!c.modules.length ? `<div class="empty">Тем для цього курсу ще немає. Поки що вся база доступна в <a href="#/atlas" style="text-decoration:underline">атласі</a>.</div>` : ''}
    ${nx ? `<div class="actions" style="margin:-4px 0 10px"><a href="#/course/${nx.m.id}/${nx.t.n}"><button class="primary">Продовжити: тема ${nx.t.n} →</button></a><a href="#/atlas"><button>Увесь атлас</button></a></div>` : ''}
    ${c.modules.map((m, mi) => { const ms = moduleStats(m); const open = LS.get('anat.modOpen', {})[m.id] ?? (mi === 0 || (nx && nx.m === m)); return `<details class="module" data-m="${m.id}" ${open ? 'open' : ''}>
      <summary class="modhead"><h2 class="section-title">${esc(m.title)}</h2><div class="modstat"><span class="muted">${ms.withMat} з ${ms.topics} тем із матеріалами · ${ms.known}/${ms.total} структур</span>${bar(ms.pct)}<b>${ms.pct}%</b></div></summary>
      <div class="topics">${m.topics.map(t => { const st = topicStats(t); const has = st.sets > 0 || !!(window.Facts && Facts.byTopic(tid(m, t)).length); return `<a class="topic ${has ? '' : 'nomat'} ${t.control ? 'ctrl' : ''}" href="#/course/${m.id}/${t.n}">
        <span class="tnum">${t.n}</span><span class="ttitle">${esc(t.title)}</span>
        <span class="tmeta">${t.control ? `<span class="chip">підсумок модуля</span>` : has ? `<span>${st.sets} ${plural(st.sets, 'схема', 'схеми', 'схем')} · ${st.total} структур</span>${bar(st.pct, 'mini')}<b>${st.pct}%</b>` : `<span class="muted">матеріалів ще немає</span>`}</span></a>`; }).join('')}</div></details>`; }).join('')}
  </div>`;
  $$('details.module').forEach(d => d.addEventListener('toggle', () => { const o = LS.get('anat.modOpen', {}); o[d.dataset.m] = d.open; LS.set('anat.modOpen', o); }));
  window.scrollTo(0, 0);
}
async function renderTopic(mid, n) {
  const f = findTopic(mid, n); if (!f) return renderCourse();
  const { c, m, t } = f, sets = setsOf(t), st = topicStats(t), id = tid(m, t), my = (links()[id] || []);
  const prev = m.topics.find(x => x.n === t.n - 1), next = m.topics.find(x => x.n === t.n + 1);
  const deck = window.Cards ? Cards.cardDecks().find(d => d.topic === id) : null;
  const myDecks = decks.filter(x => x.topic === id && x.pins.length && x.hasImage);
  const srcSets = 'sets:' + sets.map(s => s.id).join(',');
  app.innerHTML = `<div class="wrap">
    <div class="sethead"><a class="back" href="#/course">← ${esc(c.name)} · ${esc(m.short)}</a><span class="spacer"></span>${prev ? `<a href="#/course/${m.id}/${prev.n}"><button class="small">← ${prev.n}</button></a>` : ''}${next ? `<a href="#/course/${m.id}/${next.n}"><button class="small">${next.n} →</button></a>` : ''}</div>
    <section class="page-hero" style="padding-top:6px"><div class="crow-h"><span class="tnum big">${t.n}</span><h1 style="font-size:clamp(22px,3vw,32px)">${esc(t.title)}</h1></div></section>
    ${sets.length ? `<div class="tiles"><div class="tile"><b>${st.sets}</b><span>${plural(st.sets, 'схема', 'схеми', 'схем')}</span></div><div class="tile"><b>${st.known}<small class="muted" style="font-size:16px"> / ${st.total}</small></b><span>структур знаєте</span></div><div class="tile"><b>${st.mastered}</b><span>засвоєно (3 різні дні правильно)</span></div><div class="tile"><b>${st.done}<small class="muted" style="font-size:16px"> / ${st.sets}</small></b><span>схем вивчено</span></div><div class="tile"><b>${st.pct}%</b><span>готовність теми</span></div></div>
      <div class="actions"><a href="#/set/${sets[0].id}/direct"><button class="primary">Тренувати схеми →</button></a><button id="tpCards">${deck ? 'Картки теми' : 'Створити картки теми'}</button><button id="tpBlitz">Бліц по темі</button>${window.Krok && Krok.byTopic(id).length ? `<a href="#/krok?topic=${id}"><button>Крок-1: ${Krok.byTopic(id).length} ${plural(Krok.byTopic(id).length, 'питання', 'питання', 'питань')}</button></a>` : ''}</div>
      <h2 class="section-title">Схеми теми</h2><div class="grid">${sets.map(s => cardHtml(s, '#/set/' + s.id)).join('')}</div>`
      : `<div class="empty">${window.Facts && Facts.byTopic(id).length ? 'Схем для цієї теми в атласі поки немає — вчіть картки теорії нижче.' : `Для цієї теми в атласі ще немає схем${t.control ? '' : ' — вони з’являться з наступними оновленнями'}.`} Ви можете додати свої матеріали нижче або створити власну схему в розділі «Мої схеми».</div>${window.Krok && Krok.byTopic(id).length ? `<div class="actions" style="margin-top:12px"><a href="#/krok?topic=${id}"><button>Крок-1: ${Krok.byTopic(id).length} ${plural(Krok.byTopic(id).length, 'питання', 'питання', 'питань')}</button></a></div>` : ''}`}
    ${window.Facts ? Facts.topicHtml(id) : ''}
    ${myDecks.length ? `<h2 class="section-title">Мої препарати і схеми</h2><div class="grid">${myDecks.map(x => cardHtml(deckToSet(x), '#/my/' + x.id)).join('')}</div>` : ''}
    <h2 class="section-title">Мої матеріали</h2>
    <p class="muted" style="margin:-4px 0 10px;font-size:14px">Посилання на методичку, конспект, відео чи тести з Moodle — щоб усе було в одному місці. Фото препарата з кафедри додайте через «Мої схеми» і виберіть цю тему в редакторі.</p>
    ${my.length ? `<div class="queue">${my.map((l, i) => `<a href="${esc(l.url)}" target="_blank" rel="noopener"><span class="t">${esc(l.t)}</span><span class="c">${esc((() => { try { return new URL(l.url).host.replace(/^www\./, ''); } catch (e) { return ''; } })())}</span><button class="small ghost" data-del="${i}" title="Прибрати">✕</button></a>`).join('')}</div>` : ''}
    <div class="actions" style="margin-top:10px"><button id="tpAdd">+ Додати посилання</button></div>
  </div>`;
  const tb = $('#tpBlitz'); if (tb) tb.onclick = () => { if (window.Blitz) { Blitz.src = srcSets; Blitz.srcLabel = `Тема ${t.n}`; location.hash = '#/blitz/go'; } };
  const tc = $('#tpCards'); if (tc) tc.onclick = async () => { if (!window.Cards) return; let d = deck; if (!d) { const did = await Cards.createAtlasDeck(srcSets, `Тема ${t.n}. ${t.title.split('.')[0]}`, id); d = Cards.cardDecks().find(x => x.id === did); } if (d) location.hash = `#/decks/${d.id}/learn`; };
  $('#tpAdd').onclick = async () => { const url = await askText('Посилання (URL)', ''); if (!url) return; if (!/^https?:\/\//i.test(url)) return alertDlg('Посилання має починатися з http:// або https://'); const t2 = await askText('Назва', 'Методична вказівка'); if (t2 == null) return; const all = links(); (all[id] = all[id] || []).push({ t: t2 || url, url }); LS.set(LINKS_KEY, all); renderTopic(mid, n); };
  $$('button[data-del]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); const all = links(); all[id].splice(+b.dataset.del, 1); LS.set(LINKS_KEY, all); renderTopic(mid, n); });
  window.scrollTo(0, 0);
}
ROUTES.choose = () => renderChoose();
ROUTES.course = parts => parts.length >= 2 ? renderTopic(parts[0], parts[1]) : renderCourse();
window.Course = { get id() { return courseId; }, course, nextTopic, topicStats, setsOf, CUR };
})();
