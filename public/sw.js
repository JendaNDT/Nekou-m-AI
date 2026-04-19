const CACHE_NAME = "ai-terapeut-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // We only want to handle GET requests
  if (event.request.method !== "GET") return;

  // Network-first strategy with fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache the successful response
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // If network fails, try to return from cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache, return the cached index.html for navigation requests
        if (event.request.mode === 'navigate') {
          const indexResponse = await caches.match('/');
          if (indexResponse) return indexResponse;
          const indexHtmlResponse = await caches.match('/index.html');
          if (indexHtmlResponse) return indexHtmlResponse;
        }
        return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
      })
  );
});
