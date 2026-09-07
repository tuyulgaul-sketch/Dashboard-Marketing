import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  assert.equal(source.split(before).length, 2, `Expected exactly one anchor in ${path}: ${before.slice(0, 90)}`);
  writeFileSync(path, source.replace(before, after));
}

// Keep the original six collaborative collections and their legacy bootstrap
// exactly as they were. The restored business collections start from the server,
// never from an old browser's demo data.
const businessService = 'src/services/centralBusinessService.ts';
replaceOnce(businessService,
  'export const CENTRAL_BUSINESS_STORAGE_KEYS = [',
  'export const LITE_BUSINESS_STORAGE_KEYS = [');
replaceOnce(businessService,
  '] as const;\n\nexport type CentralBusinessStorageKey =',
  `] as const;

/** Previously capped collections. No automatic local-data migration. */
export const RESTORED_BUSINESS_STORAGE_KEYS = [
  'pertalife_bookings',
  'pertalife_pipelines',
  'pertalife_appeals',
  'pertalife_productions',
  'pertalife_official_production_summaries',
  'pertalife_official_production_batches',
  'pertalife_official_policy_directory',
  'pertalife_participants',
  'pertalife_historical',
  'pertalife_reimbursements',
  'pertalife_approver_delegations',
] as const;

export const CENTRAL_BUSINESS_STORAGE_KEYS = [
  ...LITE_BUSINESS_STORAGE_KEYS,
  ...RESTORED_BUSINESS_STORAGE_KEYS,
] as const;

export type CentralBusinessStorageKey =`);
replaceOnce(businessService,
`  const {
    data,
    error,
  } =
    await supabase
      .from(
        "central_business_entities"
      )
      .select(
        "storage_key, entity_id, payload, relation_user_id, status, entity_year, dedupe_key, version, updated_at"
      )
      .in(
        "storage_key",
        storageKeys
      );

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as CentralEntityRow[];`,
`  // Fetch every page. A truncated snapshot must never become the source of
  // truth for a legacy read/write facade, or a later save could lose rows.
  const result: CentralEntityRow[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('central_business_entities')
      .select('storage_key, entity_id, payload, relation_user_id, status, entity_year, dedupe_key, version, updated_at')
      .in('storage_key', storageKeys)
      .order('storage_key', { ascending: true })
      .order('entity_id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data || []) as CentralEntityRow[];
    result.push(...page);
    if (page.length < pageSize) break;
  }
  return result;`);

const businessRuntime = 'src/services/centralBusinessStorageRuntime.ts';
replaceOnce(businessRuntime,
  '  CENTRAL_BUSINESS_STORAGE_KEYS,\n',
  '  CENTRAL_BUSINESS_STORAGE_KEYS,\n  LITE_BUSINESS_STORAGE_KEYS,\n');
replaceOnce(businessRuntime,
  '    for (\n      const key of\n      CENTRAL_BUSINESS_STORAGE_KEYS\n    ) {',
  '    for (\n      const key of\n      LITE_BUSINESS_STORAGE_KEYS\n    ) {');
replaceOnce(businessRuntime,
  `  async (
    profile:
      AuthProfile
  ) => {
    installCentralBusinessStorageInterceptor();`,
  `  async (
    profile:
      AuthProfile
  ) => {
    installCentralBusinessStorageInterceptor();

    // Do not synthesize policy numbers or seed dummy transactions in live.
    // The existing service-document, handover and activity methods are intact.
    store.getOfficialPolicyDirectory = () => JSON.parse(
      localStorage.getItem('pertalife_official_policy_directory') || '[]'
    );
    store.generateDummyData = () => {
      throw new Error('Data dummy tidak tersedia pada Dashboard Marketing live.');
    };`);

const auth = 'src/contexts/AuthContext.tsx';
replaceOnce(auth,
  'import type {\n  Session,\n} from "@supabase/supabase-js";',
  `import type {
  Session,
} from "@supabase/supabase-js";
import { canAccessFeature } from '@/lib/accessControl';
import { syncCentralMasterRuntime, clearCentralMasterRuntime } from '@/services/centralMasterRuntime';
import { syncCentralTargetRuntime, clearCentralTargetRuntime } from '@/services/centralTargetRuntime';`);
replaceOnce(auth,
  '  signOut: () => Promise<void>;\n};',
  `  signOut: () => Promise<void>;
  restoredBusinessReady: boolean;
  restoredBusinessError: string | null;
  retryRestoredBusiness: () => Promise<void>;
};`);
replaceOnce(auth,
  `    clearCentralUserRuntime();
  };`,
  `    clearCentralUserRuntime();
    clearCentralMasterRuntime();
    clearCentralTargetRuntime();
  };`);
replaceOnce(auth,
  `    const loadProfile =
      async (`,
  `    const [restoredBusinessReady, setRestoredBusinessReady] = useState(false);
    const [restoredBusinessError, setRestoredBusinessError] = useState<string | null>(null);

    const loadRestoredBusiness = async (authProfile: AuthProfile) => {
      setRestoredBusinessReady(false);
      setRestoredBusinessError(null);
      try {
        await syncCentralMasterRuntime(authProfile);
        if (canAccessFeature(authProfile, 'TARGET_RKAP')) {
          await syncCentralTargetRuntime(authProfile.id);
        } else {
          clearCentralTargetRuntime();
        }
        setRestoredBusinessReady(true);
      } catch (error) {
        clearCentralMasterRuntime();
        clearCentralTargetRuntime();
        const message = error instanceof Error ? error.message : 'Database pusat belum dapat dimuat.';
        console.error('[Restored Business] Sinkronisasi gagal', error);
        setRestoredBusinessError(message);
      }
    };

    const loadProfile =
      async (`);
replaceOnce(auth,
  `        if (!currentSession) {
          clearLiteRuntime();`,
  `        if (!currentSession) {
          setRestoredBusinessReady(false);
          setRestoredBusinessError(null);
          clearLiteRuntime();`);
replaceOnce(auth,
  `          await syncCentralUserRuntime(
            authProfile
          );

          // Supabase Lite only syncs the whitelisted service-document,`,
  `          await syncCentralUserRuntime(
            authProfile
          );

          // Restored modules have their own readiness gate. A failure must
          // not prevent the existing live service modules from loading.
          await loadRestoredBusiness(authProfile);

          // Supabase Lite only syncs the whitelisted service-document,`);
replaceOnce(auth,
  `    const signOut =
      async () => {
        clearLiteRuntime();`,
  `    const retryRestoredBusiness = async () => {
      if (profile) await loadRestoredBusiness(profile);
    };

    const signOut =
      async () => {
        setRestoredBusinessReady(false);
        setRestoredBusinessError(null);
        clearLiteRuntime();`);
replaceOnce(auth,
  `          signOut,
        }}`, 
  `          signOut,
          restoredBusinessReady,
          restoredBusinessError,
          retryRestoredBusiness,
        }}`);

const app = 'src/App.tsx';
replaceOnce(app,
  'import AktivitasUniversalPage from "./pages/AktivitasUniversalPage";',
  `import Index from './pages/Index';
import TargetRkapPage from './pages/TargetRkapPage';
import BookingPipelinePage from './pages/BookingPipelinePage';
import ProduksiPage from './pages/ProduksiPage';
import DigitalAffinityPage from './pages/DigitalAffinityPage';
import RestoredBusinessGuard from './components/common/RestoredBusinessGuard';
import { isDigitalAffinityProfile } from '@/lib/accessControl';
import AktivitasUniversalPage from "./pages/AktivitasUniversalPage";`);
const appSource = readFileSync(app, 'utf8');
const homeStart = appSource.indexOf('const HomeRoute: React.FC = () => {');
const homeEnd = appSource.indexOf('const Protected =', homeStart);
assert(homeStart >= 0 && homeEnd > homeStart);
writeFileSync(app, appSource.slice(0, homeStart) + `const HomeRoute: React.FC = () => {
  const { profile } = useAuth();
  if (!profile) return null;
  if (isSystemAdminProfile(profile)) return <Navigate to="/administrasi" replace />;
  if (isDigitalAffinityProfile(profile)) return <DigitalAffinityPage />;
  if (!profile.legacy_user_id) return <Navigate to="/aktivitas" replace />;
  return <RestoredBusinessGuard feature="DASHBOARD"><Index /></RestoredBusinessGuard>;
};

` + appSource.slice(homeEnd));
replaceOnce(app,
  `    <Route
      path="/booking-ruang-meeting"`,
  `    <Route path="/target-rkap" element={<Protected><RestoredBusinessGuard feature="TARGET_RKAP"><TargetRkapPage /></RestoredBusinessGuard></Protected>} />
    <Route path="/booking-pipeline" element={<Protected><RestoredBusinessGuard feature="BOOKING_PIPELINE"><BookingPipelinePage /></RestoredBusinessGuard></Protected>} />
    <Route path="/produksi" element={<Protected><RestoredBusinessGuard feature="PRODUCTION"><ProduksiPage /></RestoredBusinessGuard></Protected>} />

    <Route
      path="/booking-ruang-meeting"`);

const sidebar = 'src/components/layout/AppSidebar.tsx';
replaceOnce(sidebar,
  '  isSystemAdminProfile,\n',
  '  isSystemAdminProfile,\n  isMarketingSupportRootProfile,\n');
replaceOnce(sidebar,
  '  FileText,\n',
  '  FileText,\n  LayoutDashboard,\n  Target,\n  TrendingUp,\n');
replaceOnce(sidebar,
  `    const canSeeMeetingRoom =`,
  `    const canSeeTarget = canAccessFeature(profile, 'TARGET_RKAP');
    const canSeeBooking = canAccessFeature(profile, 'BOOKING_PIPELINE');
    const canSeeProduction = canAccessFeature(profile, 'PRODUCTION');
    const isSupportRoot = isMarketingSupportRootProfile(profile);

    const canSeeMeetingRoom =`);
replaceOnce(sidebar,
  `    const administrationItems:
      FlyoutItem[] = [`,
  `    const administrationItems:
      FlyoutItem[] = [
        ...(canSeeBooking ? [{ label: 'Booking & Pipeline', path: '/booking-pipeline', icon: Briefcase }] : []),
        ...(canSeeProduction ? [{ label: 'Produksi', path: '/produksi', icon: TrendingUp }] : []),`);
replaceOnce(sidebar,
  `        <nav className="flex-1 space-y-1 p-3">
          {!isSystemAdmin &&
            canAccessFeature(
              profile,
              "ACTIVITY"
            ) && (`,
  `        <nav className="flex-1 space-y-1 p-3">
          {!isSystemAdmin && canAccessFeature(profile, 'DASHBOARD') && (
            <NavLink to="/" end onClick={onNavigate} className={({ isActive }) =>
              \`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all \${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}\`}>
              <LayoutDashboard className="h-4 w-4 shrink-0" /><span>Dashboard</span>
            </NavLink>
          )}
          {canSeeTarget && (
            <NavLink to="/target-rkap" onClick={onNavigate} className={({ isActive }) =>
              \`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all \${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}\`}>
              <Target className="h-4 w-4 shrink-0" /><span>{isSupportRoot ? 'Target & RKAP' : 'Target Kinerja'}</span>
            </NavLink>
          )}
          {!isSystemAdmin &&
            canAccessFeature(
              profile,
              "ACTIVITY"
            ) && (`);

console.log('Applied additive route, navigation and central-runtime integration. Existing live document, activity, meeting room, handover and admin routes remain unchanged.');
