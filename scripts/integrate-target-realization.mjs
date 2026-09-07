import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected one anchor: ${before.slice(0, 100)}`);
  return source.replace(before, after);
};
const replaceAllExact = (source, before, after, expected) => {
  assert.equal(source.split(before).length - 1, expected, `Expected ${expected} anchors: ${before}`);
  return source.split(before).join(after);
};
const wrapJsx = (source, tag, marker, condition) => {
  const sf = ts.createSourceFile('component.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = [];
  const visit = node => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sf) === tag && node.getText(sf).includes(marker)) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  // Choose the innermost matching element so a wrapper cannot swallow unrelated UI.
  const inner = matches.filter(node => !matches.some(other => other !== node && other.pos > node.pos && other.end < node.end));
  assert.equal(inner.length, 1, `Expected one ${tag} containing ${marker}; got ${inner.length}`);
  const node = inner[0];
  return source.slice(0, node.getStart(sf)) + `{${condition} && (${node.getText(sf)})}` + source.slice(node.end);
};

export const transformAccessControl = source => {
  let next = replaceOnce(source,
    '  // Modules below masih memakai identity legacy untuk menjaga kompatibilitas',
    `  // These two routes are read-only for every active directorate profile.\n  // Upload authorization remains a separate server-verified permission.\n  if (feature === "TARGET_RKAP" || feature === "PRODUCTION") {\n    return !isSystemAdminProfile(profile);\n  }\n\n  // Modules below masih memakai identity legacy untuk menjaga kompatibilitas`);
  next = replaceOnce(next, `    case "TARGET_RKAP":\n      return business || supportRoot;\n\n`, '');
  next = replaceOnce(next, `    case "PRODUCTION":\n      return (\n        business ||\n        supportRoot ||\n        marketingAdmin\n      );\n\n`, '');
  return next;
};

export const transformSidebar = source => {
  let next = replaceOnce(source, '  isMarketingSupportRootProfile,\n', '');
  next = replaceOnce(next, 'import { useAuth } from "@/contexts/AuthContext";',
    'import { useAuth } from "@/contexts/AuthContext";\nimport { useTargetRealizationPublisher } from "@/hooks/useTargetRealizationPublisher";');
  next = replaceOnce(next, '  Target,\n  TrendingUp,', '  Target,\n  TrendingUp,\n  Upload,');
  next = replaceOnce(next, `    const isSupportRoot = isMarketingSupportRootProfile(profile);`,
    `    const { canPublish } = useTargetRealizationPublisher();\n    const targetRealizationItems: FlyoutItem[] = [\n      ...(canSeeTarget ? [{ label: 'Target', path: '/target-rkap', icon: Target }] : []),\n      ...(canSeeProduction ? [{ label: 'Realisasi', path: '/produksi', icon: TrendingUp }] : []),\n      ...(canPublish ? [{ label: 'Upload Target dan Realisasi', path: '/target-realisasi/upload', icon: Upload }] : []),\n    ];`);
  next = replaceOnce(next, `        ...(canSeeProduction ? [{ label: 'Produksi', path: '/produksi', icon: TrendingUp }] : []),\n`, '');
  next = replaceOnce(next, `          {canSeeTarget && (\n            <NavLink to="/target-rkap" onClick={onNavigate} className={({ isActive }) =>\n              \`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all \${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}\`}>\n              <Target className="h-4 w-4 shrink-0" /><span>{isSupportRoot ? 'Target & RKAP' : 'Target Kinerja'}</span>\n            </NavLink>\n          )}`,
    `          {renderFlyoutGroup('Target & Realisasi', Target, targetRealizationItems)}`);
  return next;
};

export const transformApp = source => {
  let next = replaceOnce(source, `import TargetRkapPage from './pages/TargetRkapPage';`,
    `import TargetRkapPage from './pages/TargetRkapPage';\nimport DirectoratePerformancePage from './pages/DirectoratePerformancePage';\nimport TargetRealizationUploadPage from './pages/TargetRealizationUploadPage';`);
  next = replaceOnce(next, `import { isDigitalAffinityProfile } from '@/lib/accessControl';`,
    `import { isDigitalAffinityProfile, isMarketingSupportProfile } from '@/lib/accessControl';`);
  next = replaceOnce(next, `const Protected = ({`,
    `// Preserve the original hierarchy cockpit for marketing target holders.\n// Support functions use the independent company-wide aggregate reader.\nconst TargetViewRoute: React.FC = () => {\n  const { profile } = useAuth();\n  if (!profile) return null;\n  if (isMarketingSupportProfile(profile) || !profile.legacy_user_id) {\n    return <DirectoratePerformancePage view="target" />;\n  }\n  return <RestoredBusinessGuard feature="TARGET_RKAP"><TargetRkapPage /></RestoredBusinessGuard>;\n};\n\nconst Protected = ({`);
  next = replaceOnce(next,
    `<Route path="/target-rkap" element={<Protected><RestoredBusinessGuard feature="TARGET_RKAP"><TargetRkapPage /></RestoredBusinessGuard></Protected>} />`,
    `<Route path="/target-rkap" element={<Protected><FeatureOnly feature="TARGET_RKAP"><TargetViewRoute /></FeatureOnly></Protected>} />`);
  next = replaceOnce(next,
    `<Route path="/produksi" element={<Protected><RestoredBusinessGuard feature="PRODUCTION"><ProduksiPage /></RestoredBusinessGuard></Protected>} />`,
    `<Route path="/produksi" element={<Protected><FeatureOnly feature="PRODUCTION"><DirectoratePerformancePage view="realization" /></FeatureOnly></Protected>} />\n    <Route path="/target-realisasi/upload" element={<Protected><RestoredBusinessGuard feature="TARGET_RKAP"><TargetRealizationUploadPage /></RestoredBusinessGuard></Protected>} />`);
  next = replaceOnce(next, `import ProduksiPage from './pages/ProduksiPage';\n`, '');
  return next;
};

export const transformTargetPage = source => {
  let next = replaceOnce(source, `export const TargetRkapPage: React.FC = () => {`,
    `export const TargetRkapPage: React.FC<{ embedded?: boolean; initialUploadTab?: 'targets' | 'bulk'; publisherAuthorized?: boolean }> = ({ embedded = false, initialUploadTab = 'targets', publisherAuthorized = false }) => {\n  const PageLayout = embedded ? React.Fragment : AppLayout;`);
  next = replaceOnce(next, `  const isTLMS =\n    currentUser.role ===\n    'TEAM_LEADER_MARKETING_SUPPORT';`,
    `  const isTLMS =\n    publisherAuthorized && currentUser.role ===\n    'TEAM_LEADER_MARKETING_SUPPORT';`);
  next = replaceOnce(next, `  if (\n    isMarketingTargetUser\n  ) {`, `  if (\n    isMarketingTargetUser && !embedded\n  ) {`);
  next = replaceAllExact(next, '<AppLayout>', '<PageLayout>', 3);
  next = replaceAllExact(next, '</AppLayout>', '</PageLayout>', 3);
  next = replaceOnce(next, `          defaultValue="targets"\n          className="w-full"`, `          defaultValue={initialUploadTab}\n          className="w-full"`);
  next = wrapJsx(next, 'TabsList', 'Master Target RKAP', '!embedded');
  // Keep the original upload header when opened directly; the hub owns it when embedded.
  next = wrapJsx(next, 'div', 'Target & RKAP Directorate Marketing', '!embedded');
  return next;
};

export const transformProductionPage = source => {
  let next = replaceOnce(source, `export const ProduksiPage: React.FC = () => {`,
    `export const ProduksiPage: React.FC<{ embedded?: boolean; uploadOnly?: boolean; publisherAuthorized?: boolean }> = ({ embedded = false, uploadOnly = false, publisherAuthorized = false }) => {\n  const PageLayout = embedded ? React.Fragment : AppLayout;`);
  next = replaceOnce(next, `  const isArianie =\n    currentUser.id ===\n    'USR-000024';`,
    `  const isArianie =\n    publisherAuthorized && currentUser.id ===\n    'USR-000024';`);
  next = replaceAllExact(next, '<AppLayout>', '<PageLayout>', 1);
  next = replaceAllExact(next, '</AppLayout>', '</PageLayout>', 1);
  next = replaceOnce(next, `          defaultValue="official"\n          className="w-full"`, `          defaultValue={uploadOnly ? 'upload_official' : 'official'}\n          className="w-full"`);
  next = wrapJsx(next, 'TabsList', 'Upload Realisasi', '!embedded');
  next = wrapJsx(next, 'div', 'Realisasi Official menggunakan snapshot laporan produksi CSV', '!embedded');
  return next;
};

export const transformUploadHub = source => {
  let next = replaceOnce(source, `<TargetRkapPage key="targets" embedded initialUploadTab="targets" />`, `<TargetRkapPage key="targets" embedded initialUploadTab="targets" publisherAuthorized={canPublish} />`);
  next = replaceOnce(next, `<TargetRkapPage key="bulk" embedded initialUploadTab="bulk" />`, `<TargetRkapPage key="bulk" embedded initialUploadTab="bulk" publisherAuthorized={canPublish} />`);
  return replaceOnce(next, `<ProduksiPage embedded uploadOnly />`, `<ProduksiPage embedded uploadOnly publisherAuthorized={canPublish} />`);
};

export const transformPerformancePage = source => {
  let next = replaceOnce(source, `buildPerformanceSummary, listDirectoratePerformance, matchesPerformanceScope,`, `buildPerformanceSummary, listDirectoratePerformance,`);
  return replaceOnce(next, `: 'Data pusat'}</span>`, `: loading ? 'Memuat laporan pusat...' : 'Data pusat'}</span>`);
};

export const TRANSFORMS = {
  'src/lib/accessControl.ts': transformAccessControl,
  'src/components/layout/AppSidebar.tsx': transformSidebar,
  'src/App.tsx': transformApp,
  'src/pages/TargetRkapPage.tsx': transformTargetPage,
  'src/pages/ProduksiPage.tsx': transformProductionPage,
  'src/pages/TargetRealizationUploadPage.tsx': transformUploadHub,
  'src/pages/DirectoratePerformancePage.tsx': transformPerformancePage,
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  for (const [path, transform] of Object.entries(TRANSFORMS)) {
    const original = readFileSync(path, 'utf8');
    const next = transform(original);
    assert.notEqual(next, original, `${path} must change`);
    const sf = ts.createSourceFile(path, next, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(sf.parseDiagnostics.length, 0, `${path} has syntax errors: ${sf.parseDiagnostics.map(d => d.messageText).join('; ')}`);
    writeFileSync(path, next);
    console.log(`Integrated ${path}`);
  }
}
