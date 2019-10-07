/* eslint-env serviceworker */

addEventListener('push', event => {
  const { body, title, pushId, action } = event.data.json();
  event.waitUntil(
    registration.showNotification(title, {
      body,
      tag: pushId,
      data: {
        action: action || 'https://www.huya.com'
      }
    })
  );
});

// https://docs.google.com/document/d/13VxFdLJbMwxHrvnpDm8RXnU41W2ZlcP0mdWWe9zXQT8/edit#heading=h.c8wwvmd83fkw

addEventListener('notificationclick', event => {
  const { notification } = event;
  if (notification.data.action) {
    event.notification.close();
    event.waitUntil(clients.openWindow(notification.data.action));
  }
});
