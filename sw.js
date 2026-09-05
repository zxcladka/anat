/* Service worker: офлайн-робота тренажера.
   Оболонка (index.html, js, css, vendor, дані атласу) — network-first із запасом у кеші, тож оновлення доходять одразу;
   картинки схем — cache-first із фоновим оновленням: раз відкрита схема лишається доступною без мережі.
   Версію CACHE піднімати разом із ?v= в index.html, щоб старий кеш прибрався. */
const CACHE = 'anat-v14';
const SHELL = ['./', './index.html', './manifest.json', './css/modules.css', './js/app.js', './js/decks.js', './js/blitz.js', './js/course.js', './js/krok.js', './js/facts.js',
  './atlas/data.js', './atlas/curriculum.js', './atlas/lexicon.js', './atlas/krok1.js', './atlas/facts.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const stripV = url => { const u = new URL(url); u.search = ''; return u.href; };   // ?v= — лише для браузерного кешу; у SW один запис на файл
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const key = stripV(req.url);
  const isImage = /\.(png|jpe?g|webp|svg)$/i.test(url.pathname);
  if (isImage) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(key);
      const net = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    try { const r = await fetch(req); if (r.ok) c.put(key, r.clone()); return r; }
    catch (err) { const hit = await c.match(key) || (req.mode === 'navigate' ? await c.match('./index.html') : null); return hit || new Response('Офлайн: цей файл ще не збережено.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
  }));
});
// повідомлення з застосунку: закешувати всі схеми для офлайну
self.addEventListener('message', e => {
  const d = e.data || {}; if (d.type !== 'precache' || !Array.isArray(d.urls)) return;
  const port = e.ports && e.ports[0];
  e.waitUntil(caches.open(CACHE).then(async c => {
    let done = 0, fail = 0;
    for (const u of d.urls) { try { const key = stripV(new URL(u, location.href).href); if (!(await c.match(key))) { const r = await fetch(u); if (r.ok) await c.put(key, r); else fail++; } done++; if (port) port.postMessage({ done, fail, total: d.urls.length }); } catch (err) { fail++; done++; if (port) port.postMessage({ done, fail, total: d.urls.length }); } }
    if (port) port.postMessage({ finished: true, done, fail, total: d.urls.length });
  }));
});
