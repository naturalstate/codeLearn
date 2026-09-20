/* codeLearn service worker — offline-first with a controlled update flow.
   Bump CACHE (and APP_VERSION in the page) on every release so clients
   are offered the update. The new worker waits until the user accepts. */
const CACHE = 'codelearn-v1.3.0';
const CORE = ['./', './index.html', './manifest.json', './icons/icon.svg'];

self.addEventListener('install', (e) => {
  // Do NOT skipWaiting here: let the new worker wait so the page can
  // show an "update ready" prompt and the user chooses when to reload.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* The page posts this when the user taps "update". */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const isNav =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNav) {
    // Network-first for the page itself, so a fresh version loads when online;
    // fall back to cache (then the cached shell) when offline.
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((h) => h || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for other assets (fonts, icons), refreshing in the background.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit)
    )
  );
});
