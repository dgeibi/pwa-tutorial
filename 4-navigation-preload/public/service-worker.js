/* eslint-env serviceworker */

// 消耗1s
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
