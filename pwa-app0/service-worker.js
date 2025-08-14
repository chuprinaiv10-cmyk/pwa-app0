// Импортируем скрипт Workbox из локальной папки js/lib/
// Путь изменён на относительный
importScripts('js/lib/workbox-sw.js');

if (workbox) {
  console.log('Workbox успешно загружен!');

  // Установка и активация сервис-воркера.
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Стратегия кэширования для статических файлов (CSS, JS, иконки).
  // Все пути изменены на относительные, чтобы корректно работать
  // из базовой директории Netlify.
  workbox.precaching.precacheAndRoute([
    { url: 'index.html', revision: '1' },
    { url: 'manifest.json', revision: '1' },
    { url: 'service-worker.js', revision: '1' },
    { url: 'css/main.css', revision: '1' },
    { url: 'css/tabulator.min.css', revision: '1' },
    { url: 'js/app.js', revision: '1' },
    { url: 'js/lib/vue.min.js', revision: '1' },
    { url: 'js/lib/tabulator.min.js', revision: '1' },
    { url: 'js/lib/localforage.min.js', revision: '1' },
    { url: 'js/lib/workbox-sw.js', revision: '1' },
    { url: 'icons/icon-192x192.png', revision: '1' },
    { url: 'icons/icon-512x512.png', revision: '1' },
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
      new RegExp('.*\.(?:png|gif|jpg|jpeg|svg)$'),
      new workbox.strategies.CacheFirst({
        cacheName: 'images',
        plugins: [
          new workbox.expiration.ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
          }),
        ],
      })
  );
} else {
  console.log('Workbox не удалось загрузить.');
}
