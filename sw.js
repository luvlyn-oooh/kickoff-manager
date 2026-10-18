/* 킥오프 매니저 - 오프라인 캐시 (파일을 바꾸면 VERSION을 올리세요) */
const VERSION = 'kickoff-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './css/style.css',
  './js/data.js', './js/engine.js', './js/game.js', './js/render.js', './js/ui.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon.png',
  // 언더독 컵
  './cup/', './cup/index.html', './cup/manifest.webmanifest', './cup/cup.css',
  './cup/cards.js', './cup/run.js', './cup/ui.js',
  './cup/icons/icon-192.png', './cup/icons/icon-512.png', './cup/icons/apple-touch-icon.png', './cup/icons/favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 같은 출처: 네트워크 우선(최신 버전), 실패 시 캐시 → 오프라인에서도 실행
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(url.pathname.includes('/cup/') ? './cup/index.html' : './index.html'))),
    );
    return;
  }
  // 웹폰트: 캐시 우선
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});
