// Anguloneta: service worker. La app abre aunque no haya internet (muestra la ultima version guardada).
// Paginas: primero la red (para tener siempre lo mas nuevo) y, si tarda mas de 5 s o no hay internet, la copia guardada.
// Iconos y manifest: primero la copia guardada. Todo lo de otros sitios (ESPN, Analytics, registro) pasa sin tocar.
const CACHE = 'anguloneta-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

function clave(url) { return new Request(url.origin + url.pathname); }   // sin ?interno=1, ?b=... : una sola copia por pagina

async function redPrimero(req, url) {
  const cache = await caches.open(CACHE);
  try {
    const r = await Promise.race([
      fetch(req),
      new Promise((_, no) => setTimeout(() => no(new Error('lento')), 5000)),
    ]);
    if (r && r.ok && !url.search.includes('rev=')) cache.put(clave(url), r.clone());
    return r;
  } catch (e) {
    return (await cache.match(clave(url))) || (await cache.match(clave(new URL('./', self.registration.scope)))) || Response.error();
  }
}

async function copiaPrimero(req, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(clave(url));
  if (hit) return hit;
  const r = await fetch(req);
  if (r && r.ok) cache.put(clave(url), r.clone());
  return r;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || /\.html?$/.test(url.pathname) || url.pathname.endsWith('/')) e.respondWith(redPrimero(req, url));
  else if (/\.(png|webmanifest|svg|ico)$/.test(url.pathname)) e.respondWith(copiaPrimero(req, url));
});
