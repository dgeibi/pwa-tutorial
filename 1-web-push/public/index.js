function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

async function getKeyFromServer() {
  const response = await fetch('./vapidPublicKey');
  const vapidPublicKey = await response.text();
  const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
  return convertedVapidKey;
}

let subscription;

async function main() {
  navigator.serviceWorker.register('service-worker.js', { scope: '/' });

  // 等待与本页相关的serviceWorker激活
  const registration = await navigator.serviceWorker.ready;

  // 从 pushManager 获取之前的订阅，否则创建一个订阅
  subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true, // 推送只用来给用户展示消息
      applicationServerKey: await getKeyFromServer() // 从服务器获取公钥
    }));

  /**
   * { enpoint: '' , expirationTime: null, keys: {} }
   */
  // 将订阅传回给服务器
  await fetch('/register', {
    method: 'POST',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      subscription
    })
  });
}

const form = document.getElementById('push-form');
form.onsubmit = e => {
  e.preventDefault();
  const formData = new FormData(form);
  fetch('./sendNotification', {
    method: 'post',
    headers: {
      'Content-type': 'application/json'
    },
    body: JSON.stringify({
      subscription,
      delay: Number(formData.get('delay')) || 0,
      ttl: formData.get('ttl'),
      title: formData.get('title'),
      body: formData.get('body'),
      action: formData.get('action')
    })
  });
};

window.addEventListener('load', main, false);
