const CACHE_NAME = "pertalife-marketing-v13";

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

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch {
    payload = {
      title: "Dashboard Marketing",
      message: event.data?.text?.() || "Ada notifikasi baru.",
      linkPath: "/aktivitas",
    };
  }

  const title =
    payload.title || "Dashboard Marketing";

  const options = {
    body:
      payload.message || "Ada notifikasi baru.",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    data: {
      url:
        payload.linkPath || "/aktivitas",
    },
    tag:
      payload.tag ||
      `dashboard-marketing-${Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
    timestamp:
      payload.createdAt
        ? new Date(payload.createdAt).getTime()
        : Date.now(),
  };

  event.waitUntil(
    self.registration.showNotification(
      title,
      options
    )
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const relativeTarget =
      event.notification?.data?.url ||
      "/aktivitas";

    const absoluteTarget =
      new URL(
        relativeTarget,
        self.location.origin
      ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true,
        })
        .then((clientList) => {
          for (const client of clientList) {
            if (
              "focus" in client &&
              new URL(client.url).origin ===
                self.location.origin
            ) {
              return client
                .focus()
                .then(() =>
                  client.navigate(
                    absoluteTarget
                  )
                );
            }
          }

          if (
            self.clients.openWindow
          ) {
            return self.clients.openWindow(
              absoluteTarget
            );
          }

          return undefined;
        })
    );
  }
);
