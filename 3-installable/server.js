const Koa = require('koa');
const koaStatic = require('koa-static');

const app = new Koa();

app.use(koaStatic('./public'));
const server = app.listen(5000);
server.on('listening', () => {
  const { port } = server.address();
  console.log(`http://127.0.0.1:${port}`);
});
