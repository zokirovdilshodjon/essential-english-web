// ═══════════════════════════════════════════════════════════════════
// Essential English PRO — Service Worker v1.0
// Strategiyalar:
//   Cache First    → Google Fonts (tez, o'zgarmaydi)
//   Network First  → so'z JSON fayllari (yangi ma'lumot muhim)
//   Stale-While-Revalidate → HTML/CSS/JS asosiy fayllar
// ═══════════════════════════════════════════════════════════════════

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE  = `ep-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `ep-dynamic-${CACHE_VERSION}`;
const FONTS_CACHE   = `ep-fonts-${CACHE_VERSION}`;

// Darhol keshlanadigan statik fayllar
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/register.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/icons/favicon.svg',
];

// Network First domain patterns (so'z JSON fayllari)
const NETWORK_FIRST_PATTERNS = [
  /\/data\/book\d+\/unit\d+\.json/,
  /openrouter\.ai/,
  /api\./,
];

// Cache First patterns (fonts, CDN)
const CACHE_FIRST_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdnjs\.cloudflare\.com/,
];

// ─── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Try each asset individually — don't fail if one missing
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Skip:', url, err.message))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== FONTS_CACHE)
          .map(key => { console.log('[SW] Deleting old cache:', key); return caches.delete(key); })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  // Skip non-GET and chrome-extension
  if (request.method !== 'GET') return;
  if (url.startsWith('chrome-extension')) return;

  // Strategy 1: Cache First — Fonts & CDN
  if (CACHE_FIRST_PATTERNS.some(p => p.test(url))) {
    event.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }

  // Strategy 2: Network First — API & JSON data
  if (NETWORK_FIRST_PATTERNS.some(p => p.test(url))) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
    return;
  }

  // Strategy 3: Stale-While-Revalidate — HTML/CSS/JS
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ─── STRATEGIES ───────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Offline', cached: false }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response(
    offlineFallback(),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ─── OFFLINE FALLBACK PAGE ─────────────────────────────────────────
function offlineFallback() {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Essential English PRO — Offline</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0f1219;color:#e6eeff;font-family:'Nunito',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}
  .card{background:#171d2e;border:1px solid #2d3a56;border-radius:24px;padding:40px 32px;max-width:340px}
  h1{font-size:48px;margin-bottom:8px}
  h2{font-size:20px;font-weight:800;color:#7c5af6;margin-bottom:12px}
  p{color:#7a8fad;font-size:14px;line-height:1.6;margin-bottom:24px}
  button{background:linear-gradient(135deg,#7c5af6,#c084fc);border:none;border-radius:14px;color:white;font-weight:800;font-size:15px;padding:14px 32px;cursor:pointer;width:100%}
</style>
</head>
<body>
<div class="card">
  <div style="font-size:64px;margin-bottom:16px">📵</div>
  <h2>Internet aloqasi yo'q</h2>
  <p>Hozircha internetga ulanib bo'lmadi. Ilova avval yuklangan ma'lumotlar bilan ishlashda davom etadi.</p>
  <button onclick="location.reload()">🔄 Qayta urinish</button>
</div>
</body>
</html>`;
}

// ─── PUSH NOTIFICATIONS (Daily Reminder) ──────────────────────────
self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const title = data.title || 'Essential English PRO';
  const options = {
    body: data.body || "Bugun o'rganish vaqti! 🎯",
    icon: '/icons/icon-192x192.svg',
    badge: '/icons/icon-72x72.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: "Ochish" },
      { action: 'dismiss', title: "Keyinroq" }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ─── BACKGROUND SYNC (progress save retry) ────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-progress') {
    event.waitUntil(syncProgress());
  }
});

async function syncProgress() {
  // Future: retry failed API saves
  console.log('[SW] Background sync: progress');
}
