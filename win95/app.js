const desktop = document.getElementById('desktop');
const taskbarButtons = document.getElementById('taskbarButtons');
const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
const clock = document.getElementById('clock');
const windowRegistry = new Map();
let zCounter = 10;

function formatClock() {
  const now = new Date();
  const hours = now.getHours();
  const mins = String(now.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const normalized = ((hours + 11) % 12) + 1;
  clock.textContent = `${normalized}:${mins} ${period}`;
}

function bringToFront(win) {
  zCounter += 1;
  win.style.zIndex = String(zCounter);
  document.querySelectorAll('.window').forEach((item) => item.classList.remove('active'));
  win.classList.add('active');

  const appId = [...windowRegistry.entries()].find(([, value]) => value.window === win)?.[0];
  document.querySelectorAll('.task-btn').forEach((btn) => btn.classList.remove('active'));
  if (appId) {
    const match = [...taskbarButtons.children].find((btn) => btn.dataset.appId === appId);
    if (match) match.classList.add('active');
  }
}

function buildDeskIcon({ id, label, x, y, icon, click }) {
  const item = document.createElement('div');
  item.className = 'desktop-icon';
  item.style.left = `${x}px`;
  item.style.top = `${y}px`;
  item.dataset.app = id;
  item.innerHTML = `<span class="icon icon-${icon}"></span><div>${label}</div>`;
  item.addEventListener('dblclick', click);
  item.addEventListener('click', () => {
    document.querySelectorAll('.desktop-icon').forEach((el) => el.classList.remove('selected'));
    item.classList.add('selected');
  });
  desktop.appendChild(item);
}

function openWindow(appId) {
  const app = appDefs.find((item) => item.id === appId);
  if (!app) return;

  if (windowRegistry.has(appId)) {
    const existing = windowRegistry.get(appId);
    existing.window.classList.remove('hidden');
    bringToFront(existing.window);
    return;
  }

  const win = document.createElement('div');
  win.className = 'window';
  win.style.left = `${app.x}px`;
  win.style.top = `${app.y}px`;
  win.style.width = `${app.width}px`;
  win.style.height = `${app.height}px`;

  const titleBar = document.createElement('div');
  titleBar.className = 'title-bar';
  titleBar.innerHTML = `
    <div class="title-text">${app.title}</div>
    <div class="window-controls">
      <button class="win-btn" type="button" aria-label="Minimize">_</button>
      <button class="win-btn" type="button" aria-label="Maximize">□</button>
      <button class="win-btn" type="button" aria-label="Close">×</button>
    </div>
  `;

  const body = document.createElement('div');
  body.className = 'window-body';
  body.appendChild(app.render());

  const closeBtn = titleBar.querySelectorAll('.win-btn')[2];
  const minimizeBtn = titleBar.querySelectorAll('.win-btn')[0];
  const maximizeBtn = titleBar.querySelectorAll('.win-btn')[1];

  closeBtn.addEventListener('click', () => {
    win.classList.add('hidden');
  });
  minimizeBtn.addEventListener('click', () => {
    win.classList.add('hidden');
  });
  maximizeBtn.addEventListener('click', () => {
    const isMax = win.dataset.maximized === 'true';
    win.dataset.maximized = String(!isMax);
    if (!isMax) {
      win.style.left = '20px';
      win.style.top = '20px';
      win.style.width = `${window.innerWidth - 40}px`;
      win.style.height = `${window.innerHeight - 100}px`;
    } else {
      win.style.left = `${app.x}px`;
      win.style.top = `${app.y}px`;
      win.style.width = `${app.width}px`;
      win.style.height = `${app.height}px`;
    }
  });

  win.appendChild(titleBar);
  win.appendChild(body);

  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'window-resize-handle';
  win.appendChild(resizeHandle);
  desktop.appendChild(win);

  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let originLeft = 0;
  let originTop = 0;

  titleBar.addEventListener('mousedown', (event) => {
    dragging = true;
    const rect = win.getBoundingClientRect();
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    originLeft = rect.left;
    originTop = rect.top;
    bringToFront(win);
  });

  document.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    win.style.left = `${Math.max(0, originLeft + dx)}px`;
    win.style.top = `${Math.max(0, originTop + dy)}px`;
  });

  document.addEventListener('mouseup', () => { dragging = false; });

  const taskBtn = document.createElement('button');
  taskBtn.type = 'button';
  taskBtn.className = 'task-btn';
  taskBtn.dataset.appId = appId;
  taskBtn.textContent = app.title;
  taskBtn.addEventListener('click', () => {
    if (win.classList.contains('hidden')) win.classList.remove('hidden');
    bringToFront(win);
  });
  taskbarButtons.appendChild(taskBtn);

  win.addEventListener('mousedown', () => bringToFront(win));

  windowRegistry.set(appId, { window: win, taskBtn, appId });
  bringToFront(win);
}

function stripHtml(raw) {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchViaProxy(targetUrl) {
  const cleaned = targetUrl.trim();
  if (!cleaned) throw new Error('Enter a URL first.');
  const candidates = [
    () => `https://r.jina.ai/http://${cleaned.replace(/^https?:\/\//, '')}`,
    () => `https://api.allorigins.win/get?url=${encodeURIComponent(cleaned)}`,
    () => `https://corsproxy.io/?${encodeURIComponent(cleaned)}`
  ];

  let lastError = null;

  for (const factory of candidates) {
    try {
      const url = factory();
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const data = await response.json();
        const text = data && typeof data.contents === 'string' ? data.contents : JSON.stringify(data);
        if (text && text.length) return text;
      }

      const text = await response.text();
      if (text && text.length) return text;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Unable to fetch this page through the available proxy endpoints.');
}

function createBrowserApp() {
  const wrapper = document.createElement('div');
  wrapper.className = 'browser';

  const toolbar = document.createElement('div');
  toolbar.className = 'browser-toolbar';

  const addressBar = document.createElement('input');
  addressBar.className = 'address-bar';
  addressBar.value = 'https://example.com';

  const goBtn = document.createElement('button');
  goBtn.type = 'button';
  goBtn.className = 'win-btn';
  goBtn.textContent = 'Go';

  const page = document.createElement('div');
  page.className = 'browser-page';
  page.innerHTML = '<h3>Web Browser</h3><p>Load a page to preview it via the built-in proxy.</p>';

  async function loadPage() {
    const target = addressBar.value.trim();
    if (!target) {
      page.innerHTML = '<h3>Web Browser</h3><p>Please enter a URL.</p>';
      return;
    }

    page.innerHTML = '<h3>Web Browser</h3><p>Loading...</p>';

    try {
      const html = await fetchViaProxy(target);
      const clean = stripHtml(html);
      const safeText = clean.length > 14000 ? `${clean.slice(0, 14000)}...` : clean;
      page.innerHTML = `<h3>Website preview</h3><pre style="white-space:pre-wrap;font-family:inherit;">${safeText}</pre>`;
    } catch (error) {
      page.innerHTML = `<h3>Proxy load failed</h3><p>${error.message}</p><p>Try a public website such as https://example.com.</p>`;
    }
  }

  goBtn.addEventListener('click', loadPage);
  addressBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') loadPage();
  });

  toolbar.appendChild(addressBar);
  toolbar.appendChild(goBtn);
  wrapper.appendChild(toolbar);
  wrapper.appendChild(page);
  return wrapper;
}

const appDefs = [
  {
    id: 'mycomputer',
    label: 'My Computer',
    x: 24,
    y: 24,
    icon: 'computer',
    title: 'My Computer',
    width: 470,
    height: 320,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'explorer';
      wrapper.innerHTML = `
        <div class="explorer-toolbar">My Computer</div>
        <div class="explorer-body">
          <div class="explorer-sidebar">
            <div class="drive-row"><span class="drive-icon"></span> Hard Disk (C:)</div>
            <div class="drive-row"><span class="drive-icon"></span> Floppy (A:)</div>
            <div class="drive-row"><span class="drive-icon"></span> Network</div>
          </div>
          <div class="explorer-main">
            <h3>System Information</h3>
            <p>Windows 95</p>
            <p>Intel Pentium</p>
            <p>64 MB RAM</p>
            <p>Video: 800x600</p>
          </div>
        </div>
      `;
      return wrapper;
    }
  },
  {
    id: 'documents',
    label: 'My Documents',
    x: 38,
    y: 120,
    icon: 'doc',
    title: 'My Documents',
    width: 420,
    height: 280,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'explorer';
      wrapper.innerHTML = `
        <div class="explorer-toolbar">My Documents</div>
        <div class="explorer-body">
          <div class="explorer-sidebar">
            <div class="drive-row"><span class="drive-icon"></span> Resume.txt</div>
            <div class="drive-row"><span class="drive-icon"></span> Holiday.jpg</div>
            <div class="drive-row"><span class="drive-icon"></span> Notes.doc</div>
          </div>
          <div class="explorer-main">
            <h3>Documents</h3>
            <p>Classic personal files and nostalgia.</p>
            <p>Double-click a document to open it.</p>
          </div>
        </div>
      `;
      return wrapper;
    }
  },
  {
    id: 'recycle',
    label: 'Recycle Bin',
    x: 280,
    y: 40,
    icon: 'bin',
    title: 'Recycle Bin',
    width: 300,
    height: 220,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'explorer';
      wrapper.innerHTML = `
        <div class="explorer-toolbar">Recycle Bin</div>
        <div class="explorer-body">
          <div class="explorer-sidebar">
            <div class="drive-row"><span class="drive-icon"></span> Empty</div>
          </div>
          <div class="explorer-main">
            <h3>Recycle Bin</h3>
            <p>The bin is empty and ready for future nostalgia.</p>
          </div>
        </div>
      `;
      return wrapper;
    }
  },
  {
    id: 'ie',
    label: 'Internet Explorer',
    x: 150,
    y: 180,
    icon: 'browser',
    title: 'Internet Explorer',
    width: 560,
    height: 380,
    render: createBrowserApp
  },
  {
    id: 'notepad',
    label: 'Notepad',
    x: 440,
    y: 180,
    icon: 'notepad',
    title: 'Untitled - Notepad',
    width: 380,
    height: 280,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'notepad';
      const toolbar = document.createElement('div');
      toolbar.className = 'notepad-toolbar';
      toolbar.textContent = 'Note';
      const ta = document.createElement('textarea');
      ta.className = 'notepad-textarea';
      ta.value = 'Welcome to the retro desktop.\n\nThe proxy feature is enabled for the browser app, so you can preview pages without leaving the desktop.';
      wrapper.appendChild(toolbar);
      wrapper.appendChild(ta);
      return wrapper;
    }
  },
  {
    id: 'calc',
    label: 'Calculator',
    x: 520,
    y: 70,
    icon: 'calc',
    title: 'Calculator',
    width: 250,
    height: 290,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'calculator';
      const display = document.createElement('div');
      display.className = 'calc-display';
      display.textContent = '0';

      let value = '0';
      let stored = null;
      let operator = null;

      function setDisplay() {
        display.textContent = value.length > 10 ? Number(value).toPrecision(7).toString() : value;
      }

      function press(symbol) {
        if (/[0-9]/.test(symbol)) {
          value = value === '0' ? symbol : value + symbol;
        } else if (symbol === '.') {
          if (!value.includes('.')) value += '.';
        } else if (symbol === 'C') {
          value = '0';
          stored = null;
          operator = null;
        } else if (symbol === '=') {
          if (stored !== null && operator) {
            const left = Number(stored);
            const right = Number(value);
            const result = operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right;
            value = String(result);
            stored = null;
            operator = null;
          }
        } else if (['+','-','*','/'].includes(symbol)) {
          if (stored !== null && operator) {
            const left = Number(stored);
            const right = Number(value);
            const result = operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right;
            value = String(result);
          }
          stored = value;
          operator = symbol;
          value = '0';
        }
        setDisplay();
      }

      const keySets = [['C', '/', '*', '←'], ['7', '8', '9', '-'], ['4', '5', '6', '+'], ['1', '2', '3', '='], ['0', '.']];
      const grid = document.createElement('div');
      grid.className = 'calc-grid';

      keySets.flat().forEach((key) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'calc-btn';
        btn.textContent = key;
        if (key === '0') btn.classList.add('wide');
        btn.addEventListener('click', () => press(key === '←' ? 'C' : key));
        grid.appendChild(btn);
      });

      wrapper.appendChild(display);
      wrapper.appendChild(grid);
      return wrapper;
    }
  },
  {
    id: 'minesweeper',
    label: 'Minesweeper',
    x: 200,
    y: 250,
    icon: 'game',
    title: 'Minesweeper',
    width: 260,
    height: 250,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'game-window';
      const toolbar = document.createElement('div');
      toolbar.className = 'game-toolbar';
      toolbar.textContent = 'Minesweeper';
      const content = document.createElement('div');
      content.className = 'game-content';

      const board = document.createElement('div');
      board.className = 'minesweeper-board';
      for (let i = 0; i < 81; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        if (i % 10 === 0) cell.textContent = '•';
        cell.addEventListener('click', () => {
          cell.classList.add('revealed');
          if (cell.textContent === '•') cell.textContent = 'X';
        });
        board.appendChild(cell);
      }

      content.appendChild(board);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(content);
      return wrapper;
    }
  },
  {
    id: 'solitaire',
    label: 'Solitaire',
    x: 350,
    y: 220,
    icon: 'game',
    title: 'Solitaire',
    width: 320,
    height: 220,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'game-window';
      const toolbar = document.createElement('div');
      toolbar.className = 'game-toolbar';
      toolbar.textContent = 'Solitaire';
      const content = document.createElement('div');
      content.className = 'game-content';

      const board = document.createElement('div');
      board.className = 'solitaire-board';

      ['A', 'K', 'Q', 'J', '10'].forEach((value, index) => {
        const pile = document.createElement('div');
        pile.className = 'solitaire-pile';
        const card = document.createElement('div');
        card.className = `card ${index % 2 === 0 ? 'red' : 'black'}`;
        card.textContent = value;
        pile.appendChild(card);
        board.appendChild(pile);
      });

      content.appendChild(board);
      wrapper.appendChild(toolbar);
      wrapper.appendChild(content);
      return wrapper;
    }
  },
  {
    id: 'about',
    label: 'About',
    x: 180,
    y: 120,
    icon: 'notepad',
    title: 'About Windows 95',
    width: 360,
    height: 250,
    render: () => {
      const wrapper = document.createElement('div');
      wrapper.className = 'about-box';
      wrapper.innerHTML = `
        <div class="about-logo">Windows</div>
        <p>Desktop Nostalgia is a browser-based tribute to the iconic Windows 95 experience.</p>
        <p>Features include a boot splash, taskbar, retro apps, and a proxy-aware browser window.</p>
        <p>Built with HTML, CSS, and a lightweight JS shell for a self-contained experience.</p>
      `;
      return wrapper;
    }
  }
];

appDefs.forEach((app, index) => {
  buildDeskIcon({
    id: app.id,
    label: app.label,
    x: 24 + ((index % 3) * 82),
    y: 24 + (Math.floor(index / 3) * 78),
    icon: app.icon,
    click: () => openWindow(app.id)
  });
});

document.querySelectorAll('.start-item').forEach((item) => {
  item.addEventListener('click', () => {
    const appId = item.dataset.app;
    openWindow(appId);
    startMenu.classList.remove('show');
    startBtn.classList.remove('active');
  });
});

startBtn.addEventListener('click', () => {
  const willOpen = !startMenu.classList.contains('show');
  startMenu.classList.toggle('show', willOpen);
  startBtn.classList.toggle('active', willOpen);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.start-menu') && !event.target.closest('.start-btn')) {
    startMenu.classList.remove('show');
    startBtn.classList.remove('active');
  }
});

formatClock();
setInterval(formatClock, 60000);
setTimeout(() => document.body.classList.add('booted'), 1800);

const params = new URLSearchParams(window.location.search);
if (params.has('demo')) {
  setTimeout(() => openWindow('ie'), 2200);
}
