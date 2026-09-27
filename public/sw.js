// Service Worker — Web Push notifications uchun.
// Foydalanuvchi browser yopiq bo'lsa ham bu kod ishlaydi va push xabarni
// notification sifatida chiqaradi.

self.addEventListener("install", (event) => {
  // Darhol activate bo'lsin
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Barcha tab'larda darhol nazoratga olamiz
  event.waitUntil(self.clients.claim());
});

// Push xabar kelganda
self.addEventListener("push", (event) => {
  // Server bo'sh payload yuboradi (Content-Length: 0) — kontentni
  // /api/announcements'dan o'zimiz tortib olamiz.
  if (!event.data) {
    event.waitUntil(
      fetch("/api/announcements")
        .then((r) => r.json())
        .then((d) => {
          const a = d?.announcements?.[0];
          return self.registration.showNotification(a?.title || "Niyat", {
            body: a?.body || "Yangi e'lon",
            icon: "/yuksalish.logo.png",
            badge: "/yuksalish.logo.png",
            tag: a?.id ? "ann-" + a.id : "niyat-push",
            data: { url: "/" },
            vibrate: [200, 100, 200],
          });
        })
        .catch(() =>
          self.registration.showNotification("Niyat", {
            body: "Yangi e'lon bor",
            icon: "/yuksalish.logo.png",
            data: { url: "/" },
          }),
        ),
    );
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Niyat", body: event.data.text() };
  }

  const title = payload.title || "Niyat";
  const options = {
    body: payload.body || "",
    icon: "/yuksalish.logo.png",
    badge: "/yuksalish.logo.png",
    tag: payload.tag || "niyat-push",
    data: { url: payload.url || "/" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification bosilganda — ilovani ochish
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Mavjud tabni topib focus qilamiz
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Yo'q bo'lsa yangi tab ochamiz
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
