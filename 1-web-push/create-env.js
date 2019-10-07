const webpush = require('web-push');
const fs = require('fs');

if (fs.existsSync('.env')) {
  console.log('已经存在 .env，不建议修改 VAPIDKeys');
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  fs.writeFileSync(
    '.env',
    `VAPID_PUBLIC_KEY=${publicKey}
  VAPID_PRIVATE_KEY=${privateKey}
  WEBPUSH_SUBJECT=mailto:example@example.com
  `
  );
  console.log('.env 生成完毕');
}
