/* eslint-env serviceworker */

// open 127.0.0.1
// 等待 1s，chrome devtool slow
// open chrome://inspect/#service-workers and terminate service worker
const start = Date.now();
while (Date.now() - start < 1000);

addEventListener('activate', event => {
  if (registration.navigationPreload) {
    event.waitUntil(registration.navigationPreload.enable());
  }
});

addEventListener('fetch', function(event) {
  if (event.preloadResponse) {
    event.respondWith(
      event.preloadResponse.then(maybeResponse => {
        if (maybeResponse) return maybeResponse;
        return fetch(event.request);
      })
    );
  }
});
