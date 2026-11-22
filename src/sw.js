// Vite подставляет список production-файлов при сборке.
const CACHE_NAME = '__PICKKING_CACHE_NAME__';
const PRECACHE_URLS = __PICKKING_PRECACHE_URLS__;

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key.startsWith('pickking-app-') && key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Не сохраняем API и пользовательские загрузки: там могут быть личные данные.
    if (request.method !== 'GET' || url.origin !== self.location.origin
        || url.pathname.startsWith('/api/') || url.pathname.startsWith('/images/')) {
        return;
    }

    // Для страниц используем сеть, а при отсутствии сети отдаём сохранённый index.html.
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
                    }
                    return response;
                })
                .catch(async () => (await caches.match('/index.html')) || Response.error())
        );
        return;
    }

    // JS, CSS, шрифты и локальные картинки читаем из кэша, если они уже сохранены.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                if (response.ok && response.type === 'basic') {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});