import { readFileSync } from 'node:fs';

const files = [
  'src/services/store.ts',
  'src/pages/DokumenPendukungPage.tsx',
  'src/services/marketingSupportFileStorage.ts',
  'src/services/centralBusinessService.ts',
  'src/lib/adminDocumentReaderView.ts',
];
const terms = /SPAJ|SPAK|ServiceDocumentCategory|serviceCategoryLabel|publishedDocs|pendingAdminDocs|renderDocumentCard|handleUploadServiceDocument|handleServiceDocumentDecision|canReadPublishedAdminDocument|list_published_admin_documents|FACT_FINDING/i;
for (const file of files) {
  let source;
  try { source = readFileSync(file, 'utf8'); } catch { continue; }
  const lines = source.split('\n');
  console.log(`\n### ${file}: ${lines.length} lines`);
  const relevant = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (terms.test(lines[i])) for (let j = Math.max(0, i - 4); j <= Math.min(lines.length - 1, i + 5); j++) relevant.add(j);
  }
  for (const i of relevant) console.log(`${i + 1}: ${lines[i]}`);
}
