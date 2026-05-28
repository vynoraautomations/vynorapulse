const path = require('path');
const fs = require('fs');
const { execFile, execSync } = require('child_process');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');

// Aggressive Chrome detection
function findChromePath() {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    process.env.PUPPETEER_EXECUTABLE_PATH,
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      console.log(`[Chrome Detection] ✓ Found Chrome at: ${chromePath}`);
      return chromePath;
    }
  }

  // Try to find via which command
  try {
    const found = execSync('which chromium-browser || which chromium || which google-chrome', { encoding: 'utf8' }).trim();
    if (found && fs.existsSync(found)) {
      console.log(`[Chrome Detection] ✓ Found Chrome via which: ${found}`);
      return found;
    }
  } catch (e) {
    // ignore
  }

  console.warn('[Chrome Detection] ⚠ Chrome not found in standard locations');
  return undefined;
}

// Use puppeteer-extra for better stealth mode
let puppeteer;
try {
  puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  console.log('[whatsapp] Using puppeteer-extra with stealth plugin');
} catch (e) {
  console.log('[whatsapp] Fallback: Using regular puppeteer without stealth');
  puppeteer = require('puppeteer');
}

// Set executable path from environment or detect
let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
if (!executablePath) {
  executablePath = findChromePath();
}

if (executablePath) {
  console.log(`[whatsapp] Configured Chrome executable: ${executablePath}`);
} else {
  console.warn('[whatsapp] ⚠ Chrome executable path not set. Puppeteer will attempt auto-discovery.');
}

const app = express();
const PORT = process.env.PORT || 3001;
const SESSION_PATH =
  process.env.WHATSAPP_SESSION_PATH || path.join(__dirname, 'sessions');
const DEFAULT_HEADLESS = process.env.WHATSAPP_HEADLESS !== undefined
  ? process.env.WHATSAPP_HEADLESS === 'true'
  : true;

app.use(cors());
app.use(express.json());

const state = {
  client: null,
  status: 'disconnected',
  ready: false,
  qr: null,
  error: null,
  createdAt: null,
  lastQrAt: null,
  lastSeenSocketState: null,
  connectionMonitorInterval: null,
};

function normalizeToNumber(value) {
  return (value || '').replace(/[^0-9]/g, '');
}

function buildRecipientId(value) {
  const normalized = normalizeToNumber(value);
  return normalized ? `${normalized}@c.us` : '';
}

async function syncReadyStateFromClient(client) {
  if (!client || typeof client.getState !== 'function') {
    return;
  }

  try {
    const socketState = await client.getState();
    if (!socketState) {
      return;
    }

    if (state.lastSeenSocketState !== socketState) {
      console.log('[whatsapp] socket state', socketState);
      if (client.pupPage) {
        try {
          const currentUrl = client.pupPage.url();
          const currentTitle = await client.pupPage.title();
          console.log('[whatsapp] page snapshot', { url: currentUrl, title: currentTitle });
        } catch (snapshotError) {
          console.log('[whatsapp] page snapshot failed', snapshotError.message || String(snapshotError));
        }
      }
    }
    state.lastSeenSocketState = socketState;

    if (socketState === 'CONNECTED') {
      state.status = 'connected';
      state.ready = true;
      state.error = null;
      state.qr = null;
      state.createdAt = state.createdAt || new Date().toISOString();
    } else if (socketState === 'OPENING' || socketState === 'PAIRING') {
      state.status = 'connecting';
      state.ready = false;
    }
  } catch (error) {
    console.log('[whatsapp] socket state sync failed', error.message || String(error));
  }
}

function startConnectionMonitor() {
  if (state.connectionMonitorInterval) {
    return;
  }

  state.connectionMonitorInterval = setInterval(async () => {
    if (!state.client || state.ready) {
      return;
    }

    await syncReadyStateFromClient(state.client);
  }, 3000);
}

async function ensureWWebJSInjected(client) {
  if (!client || !client.pupPage) {
    return false;
  }

  const alreadyInjected = await client.pupPage.evaluate(
    () => typeof window.WWebJS !== 'undefined',
  );

  if (alreadyInjected) {
    return true;
  }

  await client.pupPage.evaluate(LoadUtils);

  return await client.pupPage.evaluate(
    () => typeof window.WWebJS !== 'undefined',
  );
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function cleanupDirectory(targetPath) {
  if (!targetPath) return;
  try {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup failures; the next client will recreate the profile if needed.
  }
}

function buildSessionPath(isFresh = false) {
  ensureDirectory(SESSION_PATH);
  if (isFresh) {
    const freshPath = path.join(SESSION_PATH, `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    ensureDirectory(freshPath);
    return freshPath;
  }

  const stablePath = path.join(SESSION_PATH, 'session');
  ensureDirectory(stablePath);
  return stablePath;
}

let currentSessionPath = buildSessionPath(false);

function refreshSessionPath() {
  const previousPath = currentSessionPath;
  currentSessionPath = buildSessionPath(true);
  cleanupDirectory(previousPath);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forceKillBrowserProcess(pid) {
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => resolve());
    });
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    // Ignore missing or already exited processes.
  }
}

async function cleanupPuppeteerChromeProcesses() {
  if (process.platform !== 'win32') {
    return;
  }

  const command = [
    '-NoProfile',
    '-Command',
    `$pids = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -like '*puppeteer\\chrome*' } | Select-Object -ExpandProperty ProcessId; if ($pids) { $pids | ForEach-Object { Stop-Process -Id $_ -Force } }`,
  ];

  await new Promise((resolve, reject) => {
    execFile('powershell', command, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  await wait(500);
}

async function teardownClient(client) {
  if (!client) return;

  try {
    if (client.logout) {
      await client.logout().catch(() => undefined);
    }
  } catch (error) {
    // Ignore logout failures during teardown.
  }

  try {
    await cleanupPuppeteerChromeProcesses();
  } catch (error) {
    // Ignore Puppeteer browser cleanup failures during teardown.
  }

  try {
    if (client.pupBrowser) {
      const browserProcess = client.pupBrowser.process?.();
      await client.pupBrowser.close().catch(() => undefined);
      const browserPid = browserProcess?.pid;
      if (browserProcess && typeof browserProcess.kill === 'function' && !browserProcess.killed) {
        browserProcess.kill('SIGKILL');
      }
      if (browserPid) {
        await forceKillBrowserProcess(browserPid);
        await wait(500);
      }
    }
  } catch (error) {
    // Ignore browser close failures during teardown.
  }

  try {
    await cleanupPuppeteerChromeProcesses();
  } catch (error) {
    // Ignore Puppeteer browser cleanup failures during teardown.
  }

  try {
    await client.destroy().catch(() => undefined);
  } catch (error) {
    // Ignore destroy failures during teardown.
  }
}

async function buildClient() {
  if (state.client) {
    return state.client;
  }

  state.status = 'connecting';
  state.ready = false;
  state.error = null;

  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: currentSessionPath,
    }),
    puppeteer: {
      headless: DEFAULT_HEADLESS,
      executablePath: executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
      ],
    },
  });

  client.on('qr', async (qr) => {
    console.log('[whatsapp] qr generated');
    state.qr = await qrcode.toDataURL(qr);
    state.lastQrAt = Date.now();
    state.status = 'qr_pending';
    state.ready = false;
    state.error = null;
  });

  client.on('loading_screen', (percent, message) => {
    console.log('[whatsapp] loading_screen', percent, message);
    if (typeof percent === 'number' && percent < 100) {
      state.status = 'connecting';
      state.ready = false;
    }
  });

  client.on('ready', () => {
    console.log('[whatsapp] ready event fired');
    state.status = 'connected';
    state.ready = true;
    state.qr = null;
    state.error = null;
  });

  client.on('authenticated', () => {
    console.log('[whatsapp] authenticated event fired');
    state.status = 'connected';
    state.ready = true;
    state.qr = null;
    state.error = null;
  });

  client.on('auth_failure', (msg) => {
    console.log('[whatsapp] auth_failure', msg?.message || String(msg || 'Authentication failed'));
    state.status = 'error';
    state.ready = false;
    state.error = msg?.message || String(msg || 'Authentication failed');
  });

  client.on('disconnected', (reason) => {
    console.log('[whatsapp] disconnected', reason?.message || String(reason || 'Disconnected'));
    state.status = 'disconnected';
    state.ready = false;
    state.error = reason?.message || String(reason || 'Disconnected');
  });

  client.on('change_state', (stateName) => {
    console.log('[whatsapp] change_state', stateName);
    if (stateName === 'CONNECTED') {
      state.status = 'connected';
      state.ready = true;
      state.qr = null;
      state.error = null;
    }
  });

  await client.initialize();
  state.client = client;
  state.createdAt = new Date().toISOString();

  const page = client.pupPage;
  if (page) {
    page.on('console', (msg) => {
      console.log('[whatsapp] page console', msg.type(), msg.text());
    });
    page.on('pageerror', (error) => {
      console.log('[whatsapp] page error', error.message || String(error));
    });
    page.on('requestfailed', (request) => {
      console.log('[whatsapp] request failed', request.failure()?.errorText || 'unknown', request.url());
    });
  }

  startConnectionMonitor();
  await syncReadyStateFromClient(client);
  return client;
}

async function ensureClient() {
  try {
    if (!state.client) {
      await buildClient();
      return state.client;
    }

    if (!state.ready && state.status === 'disconnected') {
      await state.client.initialize();
    }

    return state.client;
  } catch (error) {
    state.status = 'error';
    state.ready = false;
    state.error = error.message || String(error);
    throw error;
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', whatsapp: state.status, ready: state.ready });
});

app.get('/api/whatsapp/status', (_req, res) => {
  res.json({
    status: state.status,
    ready: state.ready,
    hasQR: Boolean(state.qr),
    qr: state.qr,
    error: state.error,
  });
});

app.get('/api/whatsapp/qr', (_req, res) => {
  if (!state.qr) {
    return res.status(404).json({ success: false, error: 'QR not available' });
  }
  res.json({ qr: state.qr, success: true });
});

app.post('/api/whatsapp/reset', async (_req, res) => {
  try {
    const clientToDestroy = state.client;
    state.client = null;

    await teardownClient(clientToDestroy);

    refreshSessionPath();
    state.status = 'disconnected';
    state.ready = false;
    state.qr = null;
    state.error = null;
    await buildClient();
    res.json({ success: true, status: state.status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    const clientToDestroy = state.client;
    state.client = null;

    await teardownClient(clientToDestroy);

    refreshSessionPath();
    state.status = 'disconnected';
    state.ready = false;
    state.qr = null;
    state.error = null;
    res.json({ success: true, status: state.status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body || {};
    const recipientId = buildRecipientId(to);

    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'Recipient number is required' });
    }

    const client = await ensureClient();
    if (!state.ready) {
      return res.status(409).json({ success: false, error: 'WhatsApp gateway is not ready yet' });
    }

    const injected = await ensureWWebJSInjected(client);
    if (!injected) {
      return res.status(500).json({ success: false, error: 'WhatsApp browser helper injection failed' });
    }

    const result = await client.sendMessage(recipientId, message || '');
    res.json({ success: true, message_id: result.id._serialized || result.id || 'sent' });
  } catch (error) {
    console.error('[whatsapp] send failed', {
      error: error.message || String(error),
      stack: error.stack,
    });
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`WhatsApp gateway listening on port ${PORT}`);
    try {
      await buildClient();
    } catch (error) {
      console.error('Failed to initialize WhatsApp gateway:', error.message || error);
    }
  });
}

module.exports = {
  app,
  buildRecipientId,
  normalizeToNumber,
  ensureWWebJSInjected,
};
