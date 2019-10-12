/* eslint-env serviceworker */
/* globals idb */

importScripts('https://unpkg.com/idb@4.0.4/build/iife/index-min.js');

const version = 3;
const CACHENAME = 'static-v' + version;
const expectedCaches = [CACHENAME];

addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHENAME).then(cache =>
      cache.addAll([
        '/',
        '/index.js',
        '/style.css',
        // 下列URL需要支持跨域头，see https://stackoverflow.com/questions/39109789/what-limitations-apply-to-opaque-responses
        'https://unpkg.com/preact@10.0.0/dist/preact.umd.js',
        'https://unpkg.com/htm@2.2.1/dist/htm.umd.js',
        'https://unpkg.com/idb@4.0.4/build/iife/index-min.js'
      ])
    )
  );
});

addEventListener('activate', event => {
  async function upgrade() {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(key => {
        if (!expectedCaches.includes(key)) {
          return caches.delete(key);
        }

        return null;
      })
    );
  }

  event.waitUntil(upgrade());
});

// 如果有cache则返回cache，同时发出请求并更新cache
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHENAME);
  const response = await cache.match(request);
  const networkResponse = fetch(request).then(response => {
    if (response.status === 200) cache.put(request, response.clone());
    return response;
  });
  return response || networkResponse;
}

// 如果有cache则返回cache，否则发出请求并更新cache并返回响应
async function cacheFirst(request) {
  const cache = await caches.open(CACHENAME);
  const response = await cache.match(request);
  return (
    response ||
    fetch(request).then(response => {
      if (response.status === 200 || response.status === 0)
        cache.put(request, response.clone());
      return response;
    })
  );
}

addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (url.origin === 'https://unpkg.com') {
    event.respondWith(cacheFirst(event.request));
  }
});

addEventListener('sync', event => {
  if (event.tag === 'sync:add-todo') {
    event.waitUntil(addTodo());
  } else if (event.tag === 'sync:delete-todo') {
    event.waitUntil(deleteTodo());
  }
});

async function informUpdate() {
  for (const client of await clients.matchAll({
    includeUncontrolled: true,
    type: 'window'
  })) {
    client.postMessage({
      type: 'sync-todo'
    });
  }
}

async function addTodo() {
  const db = await openTodoDB();
  const todos = (await db.getAll('add-todo')).filter(x => !x._created);

  if (todos.length > 0) {
    await request('/todo', {
      method: 'POST',
      body: JSON.stringify(todos)
    });

    const tx = db.transaction('add-todo', 'readwrite');
    todos.forEach(todo => {
      tx.store.put({ ...todo, _created: true });
    });
    await tx.done;
  }

  await informUpdate();
}

async function deleteTodo() {
  const db = await openTodoDB();
  const todos = (await db.getAll('delete-todo')).filter(x => !x._deleted);

  if (todos.length > 0) {
    await request('/delete-todo', {
      method: 'POST',
      body: JSON.stringify(todos.map(x => x.id))
    });
    const tx = db.transaction('delete-todo', 'readwrite');
    todos.forEach(todo => {
      tx.store.put({ ...todo, _deleted: true });
    });
    await tx.done;
  }

  await informUpdate();
}

function takeJSON(response, opts) {
  const type = response.headers.get('content-type');
  if (opts.json && type && type.indexOf('json') > -1) {
    return response.json();
  }

  if (type && /text|json/.test(type)) {
    return response.text().then(text => ({ text }));
  }

  return { response };
}

function checkResponse(response, opts) {
  return Promise.resolve(takeJSON(response, opts)).then(ret => {
    if (!response.ok) {
      const { message: errorMessage, ...rest } = ret;
      const error = new Error(errorMessage || response.statusText);
      Object.assign(error, rest);
      throw error;
    }

    return ret;
  });
}

function request(path, options = {}) {
  const headers = {};
  if (options.method && options.method !== 'GET') {
    if (typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  return fetch(`http://localhost:4001${path}`, {
    credentials: 'same-origin',
    ...options,
    headers
  }).then(res => checkResponse(res, { json: options.json !== false }));
}

let dbPromise;

function openTodoDB() {
  if (!dbPromise) {
    const { openDB } = idb;
    dbPromise = openDB('Todos', 1, {
      upgrade(db) {
        db.createObjectStore('keyval');

        db.createObjectStore('add-todo', {
          keyPath: 'i',
          autoIncrement: true
        });

        db.createObjectStore('delete-todo', {
          keyPath: 'i',
          autoIncrement: true
        });
      }
    });
  }

  return dbPromise;
}
