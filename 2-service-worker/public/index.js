/* globals htm, preact, idb */
let dbPromise;

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', {
      scope: '/'
    });
  }
}

window.addEventListener('load', registerSW, false);

const { h, render, Component } = preact;
const html = htm.bind(h);

function CloseSvg() {
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
}

function Spin() {
  return html`
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="spin"
    >
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
  `;
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {};

    this.addTodo = this.addTodo.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleClickDelete = this.handleClickDelete.bind(this);
  }

  componentDidMount() {
    this.updateTodos();

    if ('serviceWorker' in navigator) {
      this.handleSWMessage = event => {
        if (event.data && event.data.type === 'sync-todo') {
          this.updateTodos({
            useCache: false
          });
        }
      };

      navigator.serviceWorker.addEventListener('message', this.handleSWMessage);
    }
  }

  componentWillUnmount() {
    this.clearForceUpdateTimer();

    if ('serviceWorker' in navigator && this.handleSWMessage) {
      navigator.serviceWorker.removeEventListener(
        'message',
        this.handleSWMessage
      );
    }
  }

  clearForceUpdateTimer() {
    if (this._forceUpdateTimer) {
      clearTimeout(this._forceUpdateTimer);
      this._forceUpdateTimer = null;
    }
  }

  async updateTodos({ useCache = true, useNetwork = true } = {}) {
    this.clearForceUpdateTimer();

    const todosFromNetPromise =
      useNetwork && navigator.onLine !== false
        ? request('/todo').catch(() => null)
        : null;

    const db = await openTodoDB();

    if (todosFromNetPromise !== null) {
      // 从响应更新缓存
      todosFromNetPromise.then(todos => {
        if (todos) {
          db.put('keyval', todos, 'todos');
        }
      });
    }

    const todosFromCachePromise = useCache
      ? db.get('keyval', 'todos').catch(() => null)
      : null;

    const update = async (todosInput, opts) => {
      if (!todosInput) return;
      this.setState({
        todos: await getTodos(db, todosInput, opts)
      });
    };

    if (todosFromCachePromise !== null) {
      await update(await todosFromCachePromise);
    }

    if (todosFromNetPromise !== null) {
      await update(await todosFromNetPromise, { cleanDeleted: true });
    }
  }

  async addTodo(e) {
    e.preventDefault();
    const { input } = this.state;
    if (!input) return;
    this.setState({
      input: ''
    });

    const todo = {
      content: input,
      id:
        Math.random()
          .toString(32)
          .slice(2) +
        Math.random()
          .toString(32)
          .slice(2)
    };

    const addTodo = () => {
      return request('/todo', {
        method: 'POST',
        body: JSON.stringify(todo)
      }).then(() => this.updateTodos());
    };

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const db = await openTodoDB();
        await db.add('add-todo', todo);

        if (!this._forceUpdateTimer) {
          this._forceUpdateTimer = setTimeout(() => {
            this._forceUpdateTimer = null;
            this.updateTodos();
          }, 200);
        }

        const swRegistration = await navigator.serviceWorker.ready;
        await swRegistration.sync.register('sync:add-todo');
      } catch (_) {
        await addTodo();
      }
    } else {
      await addTodo();
    }
  }

  handleInput(e) {
    this.setState({
      input: e.target.value
    });
  }

  async handleClickDelete(e) {
    const {
      dataset: { id }
    } = e.currentTarget;

    const deleteTodo = () => {
      return request(`/delete-todo`, {
        method: 'POST',
        body: JSON.stringify([id])
      }).then(() => this.updateTodos());
    };

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const db = await openTodoDB();
        await db.add('delete-todo', { id });
        this.updateTodos({ useNetwork: false });
        const swRegistration = await navigator.serviceWorker.ready;
        await swRegistration.sync.register('sync:delete-todo');
      } catch (_) {
        await deleteTodo();
      }
    } else {
      await deleteTodo();
    }
  }

  render() {
    const { todos = [], input } = this.state;

    return html`
      <div class="app">
        <div class="header">
          <h1>ToDo List</h1>
          <form onSubmit=${this.addTodo}>
            <input onInput=${this.handleInput} value=${input} />
            <button disabled=${!input}>Add Todo</button>
          </form>
        </div>
        <ul class="todo-list">
          ${todos.map(
            todo => html`
              <li key=${todo.id} class="todo-item">
                <div class="todo-item-content">${todo.content}</div>
                <div class="todo-item-op">
                  ${todo.pending
                    ? html`
                        <${Spin} />
                      `
                    : html`
                        <span
                          onClick=${this.handleClickDelete}
                          data-id=${todo.id}
                          class="close-btn"
                        >
                          <${CloseSvg} />
                        </span>
                      `}
                </div>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }
}

render(
  html`
    <${App} page="All" />
  `,
  document.getElementById('app')
);

function getTodosAdding(db, todosAdding, createdTodos) {
  if (!todosAdding || todosAdding.length < 1) return [];
  const idSet = new Set(createdTodos.map(x => x.id));
  const tx = db.transaction('add-todo', 'readwrite');

  return todosAdding
    .filter(todo => {
      const created = idSet.has(todo.id);

      if (created) {
        tx.store.delete(todo.i);
      }

      return !created;
    })
    .map(x => ({
      ...x,
      pending: true
    }))
    .reverse();
}

function filterDeleting(db, todosDeleting, todos, cleanDeleted) {
  if (!todosDeleting || todosDeleting.length < 1) return todos;

  // 清理已经删除的todo
  if (cleanDeleted) {
    const deletedTodos = todosDeleting.filter(x => x._deleted);
    if (deletedTodos.length > 0) {
      const idSet = new Set(todos.map(x => x.id));
      const tx = db.transaction('delete-todo', 'readwrite');
      deletedTodos.forEach(todo => {
        if (!idSet.has(todo.id)) {
          tx.store.delete(todo.i);
        }
      });
    }
  }

  const deletingTodoSet = new Set(todosDeleting.map(x => x.id));
  return todos.filter(x => !deletingTodoSet.has(x.id));
}

async function getTodos(
  db,
  todosFromCacheOrNetwork,
  { cleanDeleted = false } = {}
) {
  const reversedTodos = Array.isArray(todosFromCacheOrNetwork)
    ? [...todosFromCacheOrNetwork].reverse()
    : [];

  const [todosAdding, todosDeleting] = await Promise.all([
    db.getAll('add-todo').catch(() => []),
    db.getAll('delete-todo').catch(() => [])
  ]);

  const todosWithAddings = getTodosAdding(
    db,
    todosAdding,
    reversedTodos
  ).concat(reversedTodos);

  return filterDeleting(db, todosDeleting, todosWithAddings, cleanDeleted);
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
