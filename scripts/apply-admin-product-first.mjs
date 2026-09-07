import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'src/pages/DokumenPendukungPage.tsx';
const expectedSha = 'aa76083ec74899a11c4c6dabbaa138e3bd01214a';
const actualSha = execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();
assert.equal(actualSha, expectedSha, 'Legacy source changed; review before applying the integration.');
let source = readFileSync(path, 'utf8');

function replaceOnce(label, before, after) {
  assert.equal(source.split(before).length - 1, 1, `Expected exactly one ${label} anchor.`);
  source = source.replace(before, after);
}

replaceOnce('browser import',
  "} from '@/components/layout/AppLayout';",
  "} from '@/components/layout/AppLayout';\nimport { AdminDocumentBrowser } from '@/components/documents/AdminDocumentBrowser';");

replaceOnce('existing publisher flags',
  "    const isAndi =\n",
  "    // Existing Administration operators and final approvers keep their full workflow.\n    const isAdminDocumentPublisher =\n      isAdminOperator || isEndah;\n\n    const isAndi =\n");

const originalBranch = `          {area ===
            'administration' && (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">`;
const replacementBranch = `          {area ===
            'administration' &&
            !isAdminDocumentPublisher && (
            <AdminDocumentBrowser
              key={currentUser.id}
              documents={publishedDocs}
              products={products}
              onDownload={document =>
                handleDownload(document.id, document.fileName)
              }
            />
          )}

          {area ===
            'administration' &&
            isAdminDocumentPublisher && (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">`;
replaceOnce('Administration reader/publisher split', originalBranch, replacementBranch);

assert.match(source, /pendingAdminDocs\.map\(\s*renderDocumentCard/);
assert.match(source, /store\.approveServiceDocument\(/);
assert.match(source, /Upload SPAJ \/ SPAK \/ Fact Finding/);
writeFileSync(path, source);
console.log('Integrated product-first browser for legacy non-publishers; original publisher workflow preserved.');
