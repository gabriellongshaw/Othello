const CACHE = 'othello-v2';

const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline/',
  '/offline/index.html',
  '/bot/',
  '/bot/index.html',
  '/bot/game/',
  '/bot/game/index.html',
  '/online/',
  '/online/index.html',
  '/online/create-game/',
  '/online/create-game/index.html',
  '/online/join-game/',
  '/online/join-game/index.html',
  '/online/game/',
  '/online/game/index.html',
  '/assets/fonts/ProductSans-Regular.ttf',
  '/assets/css/variables.css',
  '/assets/css/fonts.css',
  '/assets/css/main.css',
  '/assets/css/animations.css',
  '/assets/css/responsive.css',
  '/assets/css/components/screens.css',
  '/assets/css/components/buttons.css',
  '/assets/css/components/board.css',
  '/assets/css/components/multiplayer.css',
  '/assets/css/components/modal.css',
  '/service-worker.js',
  '/assets/js/core/sw.js',
  '/assets/images/favicon/android-icon-192x192.png',
  '/assets/js/core/firebase.js',
  '/assets/js/core/icons.js',
  '/assets/js/core/theme.js',
  '/assets/js/core/utils.js',
  '/assets/js/core/transition.js',
  '/assets/js/components/board.js',
  '/assets/js/components/confetti.js',
  '/assets/js/components/modal.js',
  '/assets/js/components/qrScanner.js',
  '/assets/js/modes/bot.js',
  '/assets/js/modes/offline.js',
  '/assets/js/modes/online.js',
  '/assets/js/pages/home.js',
  '/assets/js/pages/offline.js',
  '/assets/js/pages/botDifficulty.js',
  '/assets/js/pages/botGame.js',
  '/assets/js/pages/onlineMenu.js',
  '/assets/js/pages/createGame.js',
  '/assets/js/pages/joinGame.js',
  '/assets/js/pages/onlineGame.js',
];

const FIREBASE_ORIGIN = 'https://www.gstatic.com';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(STATIC.map(url => c.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.url.startsWith(FIREBASE_ORIGIN) && response.ok) {
          caches.open(CACHE).then(c => c.put(e.request, response.clone()));
        }
        return response;
      });
    })
  );
});