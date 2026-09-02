const CACHE_NAME = "pertalife-marketing-v11";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/pwa-192.png",
  "/pwa-512.png",
  "/apple-touch-icon.png",
  "/pertalife.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((error) => {
        console.warn(
          "[PWA] App shell cache gagal:",
          error
        );
      })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Supabase dan external API tidak disentuh service worker.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.ok
        ) {
          const clone = response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) =>
              cache.put(request, clone)
            )
            .catch(() => undefined);
        }

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        if (request.mode === "navigate") {
          const shell =
            await caches.match("/");

          if (shell) {
            return shell;
          }
        }

        throw new Error(
          "Network dan cache tidak tersedia."
        );
      })
  );
});
