/**
 * Admin Web Push service worker (scope /admin/).
 *
 * Separate from the main @ducanh2912/next-pwa service worker (which owns /)
 * so we don't collide with its precache logic. This one only handles
 * "push" and "notificationclick" events for admin notifications:
 * new WhatsApp appointments, immediate-call requests, etc.
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'UsaLatinoPrime', body: event.data.text() };
  }
  const {
    title = 'UsaLatinoPrime',
    body = '',
    url = '/admin',
    tag,
    icon = '/icons/icon-192.png',
    badge = '/icons/badge.png',
  } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
      requireInteraction: false,
      vibrate: [150, 75, 150],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin';
  event.waitUntil(
    (async () => {
      const matching = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of matching) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
