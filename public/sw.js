self.addEventListener('push', function (event) {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body || '¡Tu pedido está listo para recoger!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 250, 500, 250, 500],
    tag: 'order-ready',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🔔 ¡PEDIDO LISTO!', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});