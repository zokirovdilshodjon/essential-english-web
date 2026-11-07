// Essential English PRO — Service Worker v2
// HTML / JSON / JS => Network First (yangilanishlar darhol ko'rinadi)
// Shrift va CDN => Cache First
const VER     = 'ep-v2.0';
const STATIC  = 'ep-static-' + VER;
const DYNAMIC = 'ep-dynamic-' + VER;
const FONTS   = 'ep-fonts-' + VER;
const BASE    = '/essential-english-web';

const PRECACHE = [
  BASE + '/', BASE + '/index.html', BASE + '/register.html', BASE + '/manifest.json',
  BASE + '/icons/favicon.svg', BASE + '/icons/icon-192x192.svg', BASE + '/icons/icon-512x512.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![STATIC, DYNAMIC, FONTS].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = request.url;
  if (request.method !== 'GET' || !url.startsWith('http')) return;

  // Supabase, AI, Telegram — keshlanmaydi
  if (/supabase\.co|generativelanguage|openrouter\.ai|telegram\.org|dictionaryapi|dicebear/.test(url)) return;

  if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare|cdn\.jsdelivr/.test(url)) {
    e.respondWith(cacheFirst(request, FONTS));
    return;
  }
  // Hamma o'z fayllarimiz: avval tarmoq, offline bo'lsa kesh
  e.respondWith(networkFirst(request, request.mode === 'navigate' ? STATIC : DYNAMIC));
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
    return (await caches.match(req)) || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('push', e => {
  const d = e.data?.json() || {};
  e.waitUntil(self.registration.showNotification(d.title || 'Essential English PRO', {
    body: d.body || "O'rganish vaqti keldi!",
    icon: BASE + '/icons/icon-192x192.svg',
    badge: BASE + '/icons/favicon.svg',
    vibrate: [200, 100, 200],
    data: { url: d.url || BASE + '/' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return clients.openWindow(BASE + '/');
  }));
});
