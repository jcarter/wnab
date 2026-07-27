import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.mjs';
import { FileStore } from './fileStore.mjs';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDirectory = resolve(projectRoot, 'dist');
const port = Number.parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';
const dataFile = resolve(process.env.DATA_FILE || resolve(projectRoot, 'data/together-budget.json'));
const ynabApiBaseUrl = 'https://api.ynab.com/v1';
const store = new FileStore(dataFile);
const auth = createAuth();
const maximumBodyBytes = 1024 * 1024;
const vite = process.env.NODE_ENV === 'development'
  ? await import('vite').then(({ createServer: createViteServer }) =>
    createViteServer({
      root: projectRoot,
      server: { middlewareMode: true },
      appType: 'spa',
    }))
  : null;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const securityHeaders = {
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    ...securityHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function sendError(response, status, detail) {
  sendJson(response, status, {
    error: {
      id: String(status),
      name: 'app_error',
      detail,
    },
  });
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodyBytes) {
      throw new Error('Request body is too large.');
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function getPlanIds(url) {
  const planIds = url.searchParams.getAll('planId');
  if (planIds.length !== 2 || planIds.some((planId) => !planId) || new Set(planIds).size !== 2) {
    throw new Error('Exactly two different planId values are required.');
  }
  return planIds;
}

function isAllowedYnabPath(pathname) {
  return (
    pathname === '/plans' ||
    /^\/plans\/[^/]+\/months$/.test(pathname) ||
    /^\/plans\/[^/]+\/months\/\d{4}-\d{2}-\d{2}$/.test(pathname)
  );
}

async function proxyYnab(request, response, url) {
  if (request.method !== 'GET') {
    sendError(response, 405, 'Only read-only YNAB requests are allowed.');
    return;
  }
  const token = process.env.YNAB_ACCESS_TOKEN?.trim();
  if (!token) {
    sendError(response, 503, 'Server is missing the YNAB_ACCESS_TOKEN environment variable.');
    return;
  }
  const ynabPath = url.pathname.slice('/api/ynab'.length);
  if (!isAllowedYnabPath(ynabPath)) {
    sendError(response, 404, 'Unknown YNAB endpoint.');
    return;
  }

  const upstream = await fetch(`${ynabApiBaseUrl}${ynabPath}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await upstream.text();
  response.writeHead(upstream.status, {
    ...securityHeaders,
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(body);
}

async function handleApi(request, response, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    const ynabConfigured = Boolean(process.env.YNAB_ACCESS_TOKEN?.trim());
    const configured = ynabConfigured && auth.configured;
    sendJson(response, configured ? 200 : 503, {
      status: configured ? 'ok' : 'configuration_error',
      ynabConfigured,
      passwordConfigured: auth.configured,
    });
    return;
  }

  if (url.pathname === '/api/auth/status' && request.method === 'GET') {
    sendJson(response, 200, {
      authenticated: auth.isAuthenticated(request),
      passwordConfigured: auth.configured,
    });
    return;
  }

  if (url.pathname === '/api/auth/login' && request.method === 'POST') {
    const body = await readJsonBody(request);
    auth.login(request, response, body?.password);
    sendJson(response, 200, { authenticated: true });
    return;
  }

  if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
    auth.logout(request, response);
    sendJson(response, 200, { authenticated: false });
    return;
  }

  if (!auth.isAuthenticated(request)) {
    sendError(response, 401, 'Authentication required.');
    return;
  }

  if (url.pathname.startsWith('/api/ynab/')) {
    await proxyYnab(request, response, url);
    return;
  }

  if (url.pathname === '/api/mappings' && request.method === 'GET') {
    const planIds = getPlanIds(url);
    sendJson(response, 200, { mapping: await store.getMapping(planIds) });
    return;
  }

  if (url.pathname === '/api/mappings' && request.method === 'PUT') {
    const body = await readJsonBody(request);
    sendJson(response, 200, { mapping: await store.saveMapping(body?.mapping) });
    return;
  }

  if (url.pathname === '/api/selected-budgets' && request.method === 'GET') {
    sendJson(response, 200, { selectedBudgets: await store.getSelectedBudgets() });
    return;
  }

  if (url.pathname === '/api/selected-budgets' && request.method === 'PUT') {
    const body = await readJsonBody(request);
    sendJson(response, 200, {
      selectedBudgets: await store.saveSelectedBudgets(body?.selectedBudgets),
    });
    return;
  }

  sendError(response, 404, 'Unknown API endpoint.');
}

async function serveStatic(request, response, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendError(response, 400, 'Invalid URL.');
    return;
  }

  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1);
  let filePath = resolve(distDirectory, requestedPath);
  if (filePath !== distDirectory && !filePath.startsWith(`${distDirectory}${sep}`)) {
    sendError(response, 404, 'Not found.');
    return;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    filePath = resolve(distDirectory, 'index.html');
    fileStat = await stat(filePath);
  }
  if (!fileStat.isFile()) {
    sendError(response, 404, 'Not found.');
    return;
  }

  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (request.method === 'HEAD') {
    response.end();
  } else {
    createReadStream(filePath).pipe(response);
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
    } else if (vite) {
      vite.middlewares(request, response, (error) => {
        if (error) {
          console.error(error);
          sendError(response, 500, 'Development server error.');
        }
      });
    } else if (request.method === 'GET' || request.method === 'HEAD') {
      await serveStatic(request, response, url);
    } else {
      sendError(response, 405, 'Method not allowed.');
    }
  } catch (error) {
    const status = error?.status || 500;
    if (status >= 500) console.error(error);
    sendError(response, status, error?.message || 'Internal server error.');
  }
});

server.listen(port, host, () => {
  console.log(`Together Budget listening on http://${host}:${port}`);
  console.log(`Persisting app data to ${dataFile}`);
});
