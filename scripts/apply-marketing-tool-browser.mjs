import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'src/pages/DokumenPendukungPage.tsx';
const expectedSha = '8ac729dbbd601fe9898935d8c19098345015c9a5';
assert.equal(execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim(), expectedSha,
  'The reviewed page source changed. Re-review before integration.');
let source = readFileSync(path, 'utf8');
function replaceOnce(label, before, after) {
  assert.equal(source.split(before).length - 1, 1, `Expected exactly one ${label} anchor.`);
  source = source.replace(before, after);
}
replaceOnce('browser import',
  "import { AdminDocumentBrowser } from '@/components/documents/AdminDocumentBrowser';",
  "import { AdminDocumentBrowser } from '@/components/documents/AdminDocumentBrowser';\nimport { MarketingToolBrowser } from '@/components/documents/MarketingToolBrowser';");
replaceOnce('publisher boundary',
  `    const canManageMarcommStock =
      isArianie ||`,
  `    // Preserve the existing publisher and final-approval workflow.\n    const isMarketingToolPublisher = isAndi || isKarina;\n\n    const canManageMarcommStock =\n      isArianie ||`);
replaceOnce('marketing tools reader and publisher routing',
  `          {area ===
            'marketing-tools' && (
            <>
              <div className="grid gap-3 md:grid-cols-3">`,
  `          {area ===
            'marketing-tools' &&
            !isMarketingToolPublisher && (
            <MarketingToolBrowser
              key={currentUser.id}
              documents={publishedDocs}
              products={products}
              onDownload={document =>
                handleDownload(document.id, document.fileName)
              }
            />
          )}

          {area ===
            'marketing-tools' &&
            isMarketingToolPublisher && (
            <>
              <div className="grid gap-3 md:grid-cols-3">`);
assert.match(source, /pendingMarcommDocs\.length/);
assert.match(source, /handleUploadServiceDocument/);
assert.match(source, /isMarketingToolPublisher && \(/);
assert.match(source, /area ===\s*'marcomm-requests' && \(/);
writeFileSync(path, source);
console.log('Integrated the read-only Marketing Tools browser; existing publisher and Marcomm request workflows remain intact.');
