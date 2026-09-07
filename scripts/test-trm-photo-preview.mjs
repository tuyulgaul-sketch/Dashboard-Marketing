import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { resolveHandoverPhotoMime } from '../src/lib/handoverPhotoPreview.ts';
import { integrateTandaTerimaPhotoPreview } from './integrate-trm-photo-preview.mjs';

const require = createRequire(import.meta.url);

await test('only recognized raster photos can be previewed', () => {
  assert.equal(resolveHandoverPhotoMime('image/jpeg', 'a.jpg'), 'image/jpeg');
  assert.equal(resolveHandoverPhotoMime('image/png; charset=binary', 'a.png'), 'image/png');
  assert.equal(resolveHandoverPhotoMime('application/octet-stream', 'a.WEBP'), 'image/webp');
  assert.equal(resolveHandoverPhotoMime('image/*', 'a.heic'), 'image/heic');
  assert.equal(resolveHandoverPhotoMime('image/avif', 'a.avif'), 'image/avif');
  assert.equal(resolveHandoverPhotoMime('image/svg+xml', 'a.svg'), null);
  assert.equal(resolveHandoverPhotoMime('application/pdf', 'a.jpg'), null);
  assert.equal(resolveHandoverPhotoMime('text/html', 'a.jpg'), null);
  assert.equal(resolveHandoverPhotoMime('application/octet-stream', 'a.pdf'), null);
  assert.equal(resolveHandoverPhotoMime('', 'a'), null);
});

await test('existing Tanda Terima page changes only at the two evidence buttons', () => {
  const base = execFileSync('git', ['merge-base', 'origin/main', 'HEAD'], { encoding: 'utf8' }).trim();
  const path = 'src/pages/TandaTerimaV14Page.tsx';
  const original = execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8' });
  const current = readFileSync(path, 'utf8');
  assert.equal(current, integrateTandaTerimaPhotoPreview(original));
  assert.equal((current.match(/<HandoverEvidencePreview\b/g) || []).length, 2);
  assert.equal((current.match(/Download Foto/g) || []).length, (original.match(/Download Foto/g) || []).length);
  console.log('Existing download, workflow, approvals and registry logic preserved byte-for-byte.');
});

await test('private photo modal loads, closes, cleans up and rejects foreign evidence', async () => {
  const testRequire = createRequire('/tmp/trm-preview-test/package.json');
  const { JSDOM } = testRequire('jsdom');
  const { build } = testRequire('esbuild');
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
  const originalGlobals = new Map();
  const install = (key, value) => {
    originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of [
    'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node',
    'NodeFilter', 'Document', 'DocumentFragment', 'HTMLInputElement',
    'HTMLButtonElement', 'HTMLTextAreaElement', 'HTMLSelectElement',
    'SVGElement', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent',
    'KeyboardEvent', 'FocusEvent', 'ShadowRoot',
  ]) {
    install(key, key === 'window' ? dom.window : dom.window[key]);
  }
  install('getComputedStyle', dom.window.getComputedStyle.bind(dom.window));
  install('requestAnimationFrame', callback => setTimeout(callback, 0));
  install('cancelAnimationFrame', clearTimeout);
  install('IS_REACT_ACT_ENVIRONMENT', true);

  const React = require('react');
  const { act } = React;
  const { createRoot } = require('react-dom/client');
  const created = [];
  const revoked = [];
  const oldCreate = URL.createObjectURL;
  const oldRevoke = URL.revokeObjectURL;
  URL.createObjectURL = blob => {
    const url = `blob:trm-preview-${created.length + 1}`;
    created.push({ url, blob });
    return url;
  };
  URL.revokeObjectURL = url => revoked.push(url);

  let fetchEvidence = async () => ({
    transactionId: 'TRM-TEST-001',
    fileName: 'bukti.jpg',
    fileType: 'image/jpeg',
    blob: new Blob(['photo bytes'], { type: 'image/jpeg' }),
  });
  let fetchCount = 0;
  const mocks = {
    '@/components/ui/button': {
      Button: React.forwardRef(({ variant, size, asChild, ...props }, ref) => React.createElement('button', { ...props, ref })),
    },
    '@/services/documentHandoverFileStorage': {
      getDocumentHandoverFile: async (...args) => {
        fetchCount++;
        return fetchEvidence(...args);
      },
    },
  };

  let root;
  try {
    const result = await build({
      entryPoints: [resolve('src/components/tandaTerima/HandoverEvidencePreview.tsx')],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs',
      plugins: [{
        name: 'isolate-preview-dependencies',
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, args =>
            Object.prototype.hasOwnProperty.call(mocks, args.path)
              ? { path: args.path, external: true }
              : { path: resolve('src', args.path.slice(2) + '.ts') }
          );
        },
      }],
      external: ['react', 'react-dom', '@radix-ui/react-dialog', 'lucide-react', ...Object.keys(mocks)],
    });
    const Module = require('node:module');
    const filename = resolve('src/components/tandaTerima/__preview_test_bundle.cjs');
    const compiled = new Module(filename);
    compiled.filename = filename;
    compiled.paths = Module._nodeModulePaths(resolve('.'));
    const normalRequire = compiled.require.bind(compiled);
    compiled.require = name => Object.prototype.hasOwnProperty.call(mocks, name) ? mocks[name] : normalRequire(name);
    compiled._compile(result.outputFiles[0].text, filename);
    const Preview = compiled.exports.default;
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(Preview, {
      fileId: 'FILE-TEST-001', transactionId: 'TRM-TEST-001', fileName: 'bukti.jpg',
    })));

    assert.equal(fetchCount, 0, 'No file fetch before the user opens preview');
    const click = async element => act(async () => element.click());
    const open = () => document.querySelector('button[aria-label="Preview foto bukti.jpg"]');
    const close = () => document.querySelector('button[aria-label="Tutup preview foto"]');
    await click(open());
    assert.equal(fetchCount, 1);
    assert.equal(document.querySelector('[role="dialog"]') !== null, true);
    assert.equal(document.querySelector('[role="dialog"] img')?.getAttribute('src'), 'blob:trm-preview-1');
    assert.equal(created[0].blob.type, 'image/jpeg');
    await click(close());
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.deepEqual(revoked, ['blob:trm-preview-1']);

    fetchEvidence = async () => ({ transactionId: 'TRM-OTHER', fileName: 'foreign.jpg', fileType: 'image/jpeg', blob: new Blob(['foreign']) });
    await click(open());
    assert.match(document.querySelector('[role="alert"]')?.textContent || '', /tidak terkait dengan registry/);
    assert.equal(created.length, 1);
    await click(close());

    fetchEvidence = async () => ({ transactionId: 'TRM-TEST-001', fileName: 'file.pdf', fileType: 'application/pdf', blob: new Blob(['pdf']) });
    await click(open());
    assert.match(document.querySelector('[role="alert"]')?.textContent || '', /tidak didukung/);
    assert.equal(created.length, 1);
    await click(close());

    let resolveDelayed;
    fetchEvidence = () => new Promise(resolvePromise => { resolveDelayed = resolvePromise; });
    await click(open());
    assert.match(document.querySelector('[role="status"]')?.textContent || '', /Memuat foto/);
    await click(close());
    await act(async () => resolveDelayed({ transactionId: 'TRM-TEST-001', fileName: 'late.jpg', fileType: 'image/jpeg', blob: new Blob(['late']) }));
    assert.equal(created.length, 1);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    console.log('React DOM preview interaction, private fetch, close/revoke, wrong-registry, unsupported format and stale request passed.');
  } finally {
    if (root) await act(async () => root.unmount());
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    dom.window.close();
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
