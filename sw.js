const CACHE_NAME = 'games-v1';

// Core shell to pre-cache
const SHELL = [
  '/',
  '/css/game-icons.css',
  '/css/leaderboard.css',
  '/js/supabase-config.js',
  '/manifest.json',
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for API/CDN, cache-first for local assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Skip non-GET and external API calls (supabase, CDN)
  if (e.request.method !== 'GET') return;
  if (url.hostname !== self.location.hostname) return;

  e.respondWith(
    // Try network first, fall back to cache
    fetch(e.request)
      .then(res => {
        // Cache successful responses
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
