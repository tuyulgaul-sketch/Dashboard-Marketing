import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { TRANSFORMS } from './integrate-target-realization.mjs';
import { advisorReaderScopeTransform } from './approved-directorate-scope-transform.mjs';

const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one anchor: ${before.slice(0, 100)}`);
  return source.replace(before, after);
};

// Hide the complete legacy header, rather than leaving an empty white shell
// above the upload form. The original inner heading remains byte-for-byte.
const hideOuterHeader = (source, marker) => {
  const sf = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === 'div' &&
        node.openingElement.getText(sf).includes('justify-between gap-4 bg-white p-6') &&
        node.getText(sf).includes(marker)) matches.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  assert.equal(matches.length, 1, `Expected one upload header: ${marker}`);
  const node = matches[0];
  return source.slice(0, node.getStart(sf)) + `{!embedded && (${node.getText(sf)})}` + source.slice(node.end);
};

const transformRestoredRegression = source => replaceOnce(source,
  `  assert.match(sidebar, /isSupportRoot \\? 'Target & RKAP' : 'Target Kinerja'/);`,
  `  assert.match(sidebar, /renderFlyoutGroup\\('Target & Realisasi', Target, targetRealizationItems\\)/);\n  assert.match(sidebar, /Upload Target dan Realisasi/);\n  assert.doesNotMatch(sidebar, /label: 'Produksi', path: '\\/produksi'/);`);

const transformAdminDocumentRegression = source => {
  let next = replaceOnce(source, `check(canAccessFeature(reader, 'TARGET_RKAP'), false);`, `check(canAccessFeature(reader, 'TARGET_RKAP'), true);`);
  next = replaceOnce(next, `check(canAccessFeature(reader, 'PRODUCTION'), false);`, `check(canAccessFeature(reader, 'PRODUCTION'), true);`);
  return next;
};

const transformPerformanceMemo = source => {
  let next = TRANSFORMS['src/pages/DirectoratePerformancePage.tsx'](source);
  next = replaceOnce(next, `  const actualRows = summary?.productions || [];\n  const targetRows = summary?.targets || [];`,
    `  const actualRows = useMemo(() => summary?.productions || [], [summary]);\n  const targetRows = useMemo(() => summary?.targets || [], [summary]);`);
  return advisorReaderScopeTransform(next);
};

/** Issue #44: exact additive navigation transform for Marketing Administration bulk master import. */
const transformSidebarWithMasterBulk = source => {
  let next = TRANSFORMS['src/components/layout/AppSidebar.tsx'](source);
  next = replaceOnce(next, `  FileText,\n  LayoutDashboard,`, `  FileText,\n  FileUp,\n  LayoutDashboard,`);
  next = replaceOnce(next,
    `    const isExactActive = (\n      path: string\n    ) => {`,
    `    const canBulkManageIntermediaryMaster = Boolean(\n      profile?.active &&\n      profile.unit.trim().toLowerCase() === 'marketing support' &&\n      (profile.department || '').trim().toLowerCase() === 'marketing administration'\n    );\n\n    const isExactActive = (\n      path: string\n    ) => {`);
  next = replaceOnce(next,
    `        ...(canSeeBooking ? [{ label: 'Booking & Pipeline', path: '/booking-pipeline', icon: Briefcase }] : []),`,
    `        ...(canSeeBooking ? [{ label: 'Booking & Pipeline', path: '/booking-pipeline', icon: Briefcase }] : []),\n        ...(canBulkManageIntermediaryMaster ? [{ label: 'Import Agent & Broker', path: '/master-intermediary-import', icon: FileUp }] : []),`);
  return next;
};

/** Issue #44: route remains a separate guarded surface; existing manual master pages are untouched. */
const transformAppWithMasterBulk = source => {
  let next = TRANSFORMS['src/App.tsx'](source);
  next = replaceOnce(next,
    `import BookingPipelinePage from './pages/BookingPipelinePage';`,
    `import BookingPipelinePage from './pages/BookingPipelinePage';\nimport MasterIntermediaryBulkImportPage from './pages/MasterIntermediaryBulkImportPage';`);
  next = replaceOnce(next,
    `const DocumentOnly: React.FC<{`,
    `const MarketingAdministrationOnly: React.FC<{\n  children: React.ReactElement;\n}> = ({ children }) => {\n  const { profile } = useAuth();\n  const allowed = Boolean(\n    profile?.active && (\n      isSystemAdminProfile(profile) || (\n        profile.unit.trim().toLowerCase() === 'marketing support' &&\n        (profile.department || '').trim().toLowerCase() === 'marketing administration'\n      )\n    )\n  );\n\n  if (!allowed) {\n    return <Navigate to=\"/booking-pipeline\" replace />;\n  }\n\n  return children;\n};\n\nconst DocumentOnly: React.FC<{`);
  next = replaceOnce(next,
    `    <Route path="/booking-pipeline" element={<Protected><RestoredBusinessGuard feature="BOOKING_PIPELINE"><BookingPipelinePage /></RestoredBusinessGuard></Protected>} />`,
    `    <Route path="/booking-pipeline" element={<Protected><RestoredBusinessGuard feature="BOOKING_PIPELINE"><BookingPipelinePage /></RestoredBusinessGuard></Protected>} />\n    <Route path="/master-intermediary-import" element={<Protected><MarketingAdministrationOnly><MasterIntermediaryBulkImportPage /></MarketingAdministrationOnly></Protected>} />`);
  return next;
};

export const FINAL_TRANSFORMS = {
  ...TRANSFORMS,
  'src/components/layout/AppSidebar.tsx': transformSidebarWithMasterBulk,
  'src/App.tsx': transformAppWithMasterBulk,
  'src/pages/TargetRkapPage.tsx': source => hideOuterHeader(TRANSFORMS['src/pages/TargetRkapPage.tsx'](source), 'Target & RKAP Directorate Marketing'),
  'src/pages/ProduksiPage.tsx': source => hideOuterHeader(TRANSFORMS['src/pages/ProduksiPage.tsx'](source), 'Realisasi Official menggunakan snapshot laporan produksi CSV'),
  'src/pages/DirectoratePerformancePage.tsx': transformPerformanceMemo,
  'scripts/test-restored-business.mjs': transformRestoredRegression,
  'scripts/test-admin-document-access.mjs': transformAdminDocumentRegression,
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  for (const [path, transform] of Object.entries(FINAL_TRANSFORMS)) {
    const original = readFileSync(path, 'utf8');
    const next = transform(original);
    assert.notEqual(next, original, `${path} must change`);
    const sf = ts.createSourceFile(path, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(sf.parseDiagnostics.length, 0, `${path} syntax error: ${sf.parseDiagnostics.map(d => d.messageText).join('; ')}`);
    writeFileSync(path, next);
    console.log(`Integrated ${path}`);
  }
}
