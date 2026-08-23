/* ============================================================
   SERVICE WORKER — yalnızca statik "uygulama kabuğunu"
   (HTML/CSS/JS/ikonlar) önbelleğe alır. Google Sheets verisi
   ASLA önbelleklenmez; her veri isteği doğrudan Apps Script
   Web App'ine (network) gider. Bu sayede çevrimdışıyken uygulama
   açılır ama veriler her zaman güncel/gerçek zamanlı okunur.
============================================================ */

const CACHE_NAME = 'isik-panel-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './bridge.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Apps Script'e giden TÜM istekler (veri okuma/yazma) her zaman
  // ağdan yapılır — asla cache'den servis edilmez.
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Uygulama kabuğu: önce cache, yoksa ağdan al ve cache'e ekle.
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        }).catch(() => cached);
      })
    );
  }
});
