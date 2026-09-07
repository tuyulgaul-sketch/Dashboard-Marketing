import { readFileSync, writeFileSync } from 'node:fs';

function edit(path, changes) {
  let source = readFileSync(path, 'utf8');
  for (const [label, pattern, replacement] of changes) {
    const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))];
    if (matches.length !== 1) throw new Error(`${path}: ${label}: expected one anchor, found ${matches.length}`);
    source = source.replace(pattern, replacement);
  }
  writeFileSync(path, source);
  console.log(`Updated ${path}`);
}

edit('src/services/store.ts', [
  ['category union', /(export type ServiceDocumentCategory =\s*\| 'SPAJ'\s*\| 'SPAK')/, "$1\n  | 'FACT_FINDING'"],
]);

edit('src/pages/DokumenPendukungPage.tsx', [
  ['shared category import', /(import \{\s*ManagedServiceDocument,)/, "import { ADMIN_DOCUMENT_CATEGORIES } from '@/lib/adminDocumentCategories';\n$1"],
  ['admin category definition', /const ADMIN_CATEGORIES:\s*Array<\{\s*value:\s*ServiceDocumentCategory;\s*label:\s*string;\s*\}> = \[\s*\{\s*value:\s*'SPAJ',\s*label:\s*'SPAJ',\s*\},\s*\{\s*value:\s*'SPAK',\s*label:\s*'SPAK',\s*\},\s*\];/, "const ADMIN_CATEGORIES: Array<{ value: ServiceDocumentCategory; label: string }> =\n  [...ADMIN_DOCUMENT_CATEGORIES];"],
  ['legacy description', /Repository SPAJ dan SPAK\. Suci\/Ayu\/Ulfia\/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing\./, 'Repository SPAJ, SPAK, dan Fact Finding. Suci/Ayu/Ulfia/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing.'],
  ['upload button', /Upload SPAJ \/ SPAK/, 'Upload SPAJ / SPAK / Fact Finding'],
  ['admin summary grid', /(<div className="grid gap-3 md:grid-cols-2">\s*\{ADMIN_CATEGORIES\.map\()/, '<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">\n                {ADMIN_CATEGORIES.map('],
]);

edit('src/pages/DokumenAdministrasiReaderPage.tsx', [
  ['shared category import', /(import \{\s*filterPublishedAdminDocuments,)/, "import { ADMIN_DOCUMENT_CATEGORIES } from '@/lib/adminDocumentCategories';\n$1"],
  ['reader description', /Repository SPAJ dan SPAK\. Suci\/Ayu\/Ulfia\/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing\./, 'Repository SPAJ, SPAK, dan Fact Finding. Suci/Ayu/Ulfia/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing.'],
  ['reader summary grid', /(<div className="grid gap-3 md:grid-cols-2">\s*\{)\(\['SPAJ', 'SPAK'\] as const\)\.map\(category => \(/, '$1ADMIN_DOCUMENT_CATEGORIES.map(category => ('],
  ['reader grid layout', /<div className="grid gap-3 md:grid-cols-2">\s*\{ADMIN_DOCUMENT_CATEGORIES\.map/, '<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">\n              {ADMIN_DOCUMENT_CATEGORIES.map'],
  ['reader category key', /<Card key=\{category\} className="border-blue-100 bg-blue-50\/30">/, '<Card key={category.value} className="border-blue-100 bg-blue-50/30">'],
  ['reader category title', /<div className="text-sm font-black text-gray-900">\{category\}<\/div>/, '<div className="text-sm font-black text-gray-900">{category.label}</div>'],
  ['reader category count', /\{counts\[category\]\} dokumen published/, '{counts[category.value]} dokumen published'],
]);

// Validate that the existing upload, approval, file and store workflows remain present.
const legacy = readFileSync('src/pages/DokumenPendukungPage.tsx', 'utf8');
for (const token of ['handleUploadServiceDocument', 'getNextDocumentVersion', 'pendingAdminDocs', 'renderDocumentCard', 'saveMarketingSupportFile', 'downloadMarketingSupportFile', 'isEndah', 'isAdminOperator']) {
  if (!legacy.includes(token)) throw new Error(`Missing existing workflow: ${token}`);
}
console.log('Fact Finding source changes applied without replacing existing workflows.');
