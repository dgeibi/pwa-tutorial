/* eslint-disable no-await-in-loop */
require('dotenv').config();
const Koa = require('koa');
const koaBody = require('koa-body');
const webpush = require('web-push');
const Router = require('@koa/router');
const koaStatic = require('koa-static');

const app = new Koa();

const {
  WEBPUSH_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  PORT
} = process.env;

const delay = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

// 设置推送主体信息，公钥和私钥
webpush.setVapidDetails(WEBPUSH_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.use(koaBody());

const subscriptions = new Map();

function addSubsription(ctx) {
  const { subscription } = ctx.request.body;
  if (subscription && subscription.endpoint) {
    console.log(subscription);
    subscriptions.set(subscription.endpoint, subscription);
  } else {
    ctx.throw(400);
  }
}

async function broadcast(payload, options) {
  for (const [, subscription] of subscriptions) {
    try {
      await webpush.sendNotification(subscription, payload, options);
    } catch (e) {
      if (e.statusCode === 410) {
        // 订阅过期或者取消了
        subscriptions.delete(e.endpoint);
        console.error(e.statusCode, e.endpoint);
      }
    }
  }
}

const router = new Router();

router.get('/vapidPublicKey', ctx => {
  ctx.body = VAPID_PUBLIC_KEY;
});

router.post('/register', ctx => {
  addSubsription(ctx);
  ctx.status = 201;
});

let count = 0;

router.post('/sendNotification', async ctx => {
  const {
    body: { subscription, ttl, delay: sec, body, title, action }
  } = ctx.request;

  if (subscription) addSubsription(ctx);

  count += 1;

  const payload = JSON.stringify({
    pushId: `${count}-${Date.now()}`,
    body,
    title,
    action
  });

  if (typeof sec === 'number' && sec < 100 && sec > 0) {
    await delay(sec * 1000);
  }

  await broadcast(payload, {
    TTL: ttl // TTL is a value in seconds that describes how long a push message is retained by the push service (by default, four weeks).
  });

  // eslint-disable-next-line require-atomic-updates
  ctx.status = 201;
});

app.use(router.routes(), router.allowedMethods());

app.use(koaStatic('./public'));

const server = app.listen(PORT || 3000);
server.on('listening', () => {
  const { port } = server.address();
  console.log(`http://127.0.0.1:${port}`);
});
