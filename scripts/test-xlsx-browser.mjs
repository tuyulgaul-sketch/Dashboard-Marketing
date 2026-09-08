import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(resolve(process.env.XLSX_PLAYWRIGHT_DIR, 'node_modules/playwright'));
const output = await mkdtemp(join(tmpdir(), 'xlsx-browser-'));
let browser;
let server;
try {
  await build({
    configFile: resolve('vite.config.ts'),
    build: { outDir: output, emptyOutDir: true, minify: true, lib: { entry: resolve('scripts/fixtures/xlsx-browser-probe.ts'), formats: ['es'], fileName: 'probe' } },
  });
  server = createServer(async (req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    if (pathname === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><body><script type="module" src="/probe.js"></script></body></html>');
      return;
    }
    const filename = pathname.slice(1);
    if (!/^[a-zA-Z0-9_.-]+$/.test(filename)) { res.writeHead(404); res.end(); return; }
    try {
      const content = await readFile(join(output, filename));
      res.setHeader('content-type', filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
      res.end(content);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolveListening => server.listen(0, '127.0.0.1', resolveListening));
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__xlsxProbe !== undefined, { timeout: 30000 });
  const result = await page.evaluate(() => window.__xlsxProbe);
  assert.deepEqual(result, { ok: true, rows: 72, total: '100000000' });
  assert.deepEqual(errors, []);
  console.log('PASS: production-bundled ExcelJS loads in Chromium, XLSX roundtrip succeeds, and 72 compact allocations cascade to the exact annual total.');
} finally {
  if (browser) await browser.close();
  if (server) await new Promise(resolveClose => server.close(resolveClose));
  await rm(output, { recursive: true, force: true });
}
