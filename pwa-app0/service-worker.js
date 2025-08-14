// Импортируем скрипт Workbox из локальной папки /pwa-app0/js/lib/
importScripts('/pwa-app0/js/lib/workbox-sw.js');

if (workbox) {
  console.log('Workbox успешно загружен!');

  // Установка и активация сервис-воркера.
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Стратегия кэширования для статических файлов (CSS, JS, иконки).
  // Все пути здесь должны начинаться с /pwa-app0/, чтобы соответствовать расположению на сервере.
  workbox.precaching.precacheAndRoute([
    { url: '/pwa-app0/index.html', revision: '2' },
    { url: '/pwa-app0/manifest.json', revision: '1' },
    { url: '/pwa-app0/service-worker.js', revision: '1' },
    { url: '/pwa-app0/css/main.css', revision: '1' },
    { url: '/pwa-app0/css/tabulator.min.css', revision: '1' },
    { url: '/pwa-app0/js/app.js', revision: '4' },
    { url: '/pwa-app0/js/lib/vue.min.js', revision: '1' },
    { url: '/pwa-app0/js/lib/tabulator.min.js', revision: '1' },
    { url: '/pwa-app0/js/lib/localforage.min.js', revision: '1' },
    { url: '/pwa-app0/js/lib/workbox-sw.js', revision: '1' },
    { url: '/pwa-app0/icons/icon-192x192.png', revision: '1' },
    { url: '/pwa-app0/icons/icon-512x512.png', revision: '1' },
  ]);

  // Стратегия для навигации: NetworkFirst (Сеть в первую очередь)
  workbox.routing.registerRoute(
    new workbox.routing.NavigationRoute(
      new workbox.strategies.NetworkFirst({
        cacheName: 'navigation-cache',
      })
    )
  );

  // Стратегия для всех остальных запросов: CacheFirst (Кэш в первую очередь)
  workbox.routing.registerRoute(
    new RegExp('.*'),
    new workbox.strategies.CacheFirst({
      cacheName: 'pwa-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        }),
      ],
    })
  );

} else {
  console.log('Workbox не удалось загрузить.');
}
