const fs = require('fs');
const Koa = require('koa');
const koaBody = require('koa-body');
const cors = require('@koa/cors');
const path = require('path');
const Router = require('@koa/router');

const router = new Router();

router.post('/todo', async ctx => {
  const todos = Array.isArray(ctx.request.body)
    ? ctx.request.body
    : [ctx.request.body];
  todos.forEach(todo => {
    addTodo(todo.id, safeTodo(todo, ctx), false);
  });
  await writeDB(state, true);
  // eslint-disable-next-line require-atomic-updates
  ctx.body = null;
});

router.post('/delete-todo', async ctx => {
  const todoIds = Array.isArray(ctx.request.body)
    ? ctx.request.body
    : [ctx.request.body];

  todoIds.forEach(id => {
    deleteTodo(id, false);
  });
  await writeDB(state, true);
  // eslint-disable-next-line require-atomic-updates
  ctx.body = null;
});

router.get('/todo', ctx => {
  ctx.body = Object.values(state.todos || {});
});

const DB_FILE = path.resolve(__dirname, 'db.json');

let state = readDb(DB_FILE);

const app = new Koa();
app.use(cors());
app.use(koaBody());
app.use(router.routes(), router.allowedMethods());
const server = app.listen(4001);
server.on('listening', () => {
  const { port } = server.address();
  console.log(`http://127.0.0.1:${port}`);
});

async function addTodo(id, item, write) {
  const data = { ...state };
  data.todos = { ...data.todos };
  const todo = { ...item, id };
  data.todos[id] = todo;
  await writeDB(data, write);
  return todo;
}

async function deleteTodo(id, write) {
  const data = { ...state };
  data.todos = { ...data.todos };
  delete data.todos[id];
  await writeDB(data, write);
}

function safeTodo(todo, ctx) {
  const { content } = todo;
  if (typeof content !== 'string' || content === '') {
    ctx.throw(400);
  }

  return {
    content
  };
}

function readDb(dbfile) {
  if (fs.existsSync(dbfile)) {
    return JSON.parse(fs.readFileSync(dbfile, 'utf8'));
  }

  return {
    todos: {}
  };
}

function writeDB(data, write = true) {
  state = data;
  return new Promise((resolve, reject) => {
    if (write) {
      fs.writeFile(DB_FILE, JSON.stringify(data), err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}
