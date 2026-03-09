// Essential English PRO — Service Worker
// GitHub Pages path: /essential-english-web/

const CACHE_V   = 'ep-v1.1';
const STATIC    = 'ep-static-v1.1';
const DYNAMIC   = 'ep-dynamic-v1.1';
const FONTS     = 'ep-fonts-v1.1';
const BASE      = '/essential-english-web';

const STATIC_FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/register.html',
  BASE + '/manifest.json',
  BASE + '/icons/favicon.svg',
  BASE + '/icons/icon-192x192.svg',
  BASE + '/icons/icon-512x512.svg',
];

self.addEventListener('install', e => {
  console.log('[SW] Installing', CACHE_V);
  e.waitUntil(
    caches.open(STATIC)
      .then(c => Promise.allSettled(
        STATIC_FILES.map(u => c.add(u).catch(err => console.warn('[SW] skip:', u)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] Activating', CACHE_V);
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => ![STATIC, DYNAMIC, FONTS].includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;
  if (request.method !== 'GET' || url.startsWith('chrome-extension')) return;

  // Fonts & CDN → Cache First
  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare/.test(url)) {
    e.respondWith(cacheFirst(request, FONTS));
    return;
  }
  // API & JSON data → Network First
  if (/\/data\/book\d|openrouter\.ai|\/api\//.test(url)) {
    e.respondWith(networkFirst(request, DYNAMIC));
    return;
  }
  // Everything else → Stale While Revalidate
  e.respondWith(staleRevalidate(request, STATIC));
});

async function cacheFirst(req, name) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch { return new Response('Offline', { status: 503 }); }
}

async function networkFirst(req, name) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(name)).put(req, res.clone());
    return res;
  } catch {
    return await caches.match(req)
      || new Response('{"error":"offline"}', {
           status: 503,
           headers: { 'Content-Type': 'application/json' }
         });
  }
}

async function staleRevalidate(req, name) {
  const cache  = await caches.open(name);
  const cached = await cache.match(req);
  const fetchP = fetch(req)
    .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return cached || await fetchP || offlinePage();
}

function offlinePage() {
  return new Response(
    `<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>Offline</title>
     <style>body{background:#0f1219;color:#e6eeff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
     .c{background:#171d2e;border-radius:20px;padding:36px 28px;max-width:320px}
     button{background:linear-gradient(135deg,#7c5af6,#c084fc);border:none;border-radius:12px;color:white;font-weight:800;font-size:15px;padding:13px 28px;cursor:pointer;width:100%;margin-top:16px}</style>
     </head><body><div class="c">
     <div style="font-size:56px;margin-bottom:14px">&#128245;</div>
     <h2 style="color:#7c5af6;margin-bottom:10px">Internet aloqasi yo'q</h2>
     <p style="color:#7a8fad;font-size:13px;line-height:1.6">Ilova keshdan ishlashda davom etadi. O'rganilgan so'zlar va o'yinlar ishlaydi.</p>
     <button onclick="location.reload()">&#128260; Qayta urinish</button>
     </div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// Push notifications
self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(
    d.title || 'Essential English PRO',
    {
      body: d.body || "O'rganish vaqti keldi!",
      icon: BASE + '/icons/icon-192x192.svg',
      badge: BASE + '/icons/favicon.svg',
      vibrate: [200, 100, 200],
      data: { url: d.url || BASE + '/' }
    }
  ));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow(BASE + '/');
    })
  );
});
