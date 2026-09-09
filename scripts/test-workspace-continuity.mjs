import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);

const hooks = () => {
  const slots = []; let cursor = 0; let pending = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const slot = create => { const i = cursor++; if (!(i in slots)) slots[i] = create(); return [i, slots[i]]; };
  const react = {
    createContext: value => ({ Provider: 'Provider', value }),
    useContext: context => context.value,
    useState: initial => { const [i, value] = slot(() => typeof initial === 'function' ? initial() : initial); return [value, next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => slot(() => ({ current: initial }))[1],
    useMemo: (fn, deps) => { const [i, old] = slot(() => ({ deps: undefined, value: undefined })); if (!same(old.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useCallback: (fn, deps) => react.useMemo(() => fn, deps),
    useEffect: (fn, deps) => { const [i, old] = slot(() => ({ deps: undefined, cleanup: null })); if (!same(old.deps, deps)) { pending.push(() => { old.cleanup?.(); const cleanup = fn(); slots[i] = { deps, cleanup: typeof cleanup === 'function' ? cleanup : null }; }); slots[i] = { ...old, deps }; } },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  return { react, jsx, render: (component, props = {}) => { cursor = 0; const value = component(props); const effects = pending; pending = []; effects.forEach(fn => fn()); return value; }, cleanup: () => { for (const item of slots) if (item?.cleanup) item.cleanup(); } };
};
const load = (path, mocks = {}) => {
  const source = readFileSync(path, 'utf8');
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const Module = require('node:module'); const filename = resolve(path) + '.test.cjs'; const mod = new Module(filename); mod.filename = filename; mod.paths = Module._nodeModulePaths(resolve('.'));
  const original = mod.require.bind(mod); mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : original(id); mod._compile(code, filename); return mod.exports;
};
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
const profile = (id = 'auth-1') => ({ id: 'profile-' + id, auth_user_id: id, full_name: 'Arianie', email: 'test@example.invalid', role_level: 'TL', unit: 'Marketing Support', department: null, manager_id: null, legacy_user_id: 'USR-000024', active: true });
const session = id => ({ user: { id }, access_token: 'token-' + id });

const authFixture = () => {
  const h = hooks(); let authEvent; let current = session('auth-1'); let record = profile(); let deferred = null; let reloads = 0; let reset = false;
  const counts = { master: 0, target: 0, users: 0, business: 0, clears: 0 };
  const supabase = { auth: { getSession: async () => ({ data: { session: current } }), onAuthStateChange: callback => { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } }; }, signOut: async () => { authEvent('SIGNED_OUT', null); } }, from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ single: async () => { if (deferred) { const wait = deferred; deferred = null; return wait.promise; } return record ? { data: { ...record }, error: null } : { data: null, error: { code: 'PGRST116' } }; } }) }) }) }) };
  const mocks = { react: h.react, 'react/jsx-runtime': { jsx: h.jsx, jsxs: h.jsx }, '@/lib/supabase': { supabase }, '@/lib/accessControl': { canAccessFeature: () => true }, '@/services/centralMasterRuntime': { syncCentralMasterRuntime: async () => { counts.master++; }, clearCentralMasterRuntime: () => { counts.clears++; } }, '@/services/centralTargetRuntime': { syncCentralTargetRuntime: async () => { counts.target++; }, clearCentralTargetRuntime: () => { counts.clears++; } }, '@/services/centralUserRuntime': { syncCentralUserRuntime: async () => { counts.users++; }, clearCentralUserRuntime: () => { counts.clears++; } }, '@/services/centralBusinessStorageRuntime': { syncCentralBusinessRuntime: async () => { counts.business++; }, clearCentralBusinessRuntime: () => { counts.clears++; } }, '@/lib/legacyIdentityBridge': { syncLegacyIdentityFromSupabase: () => {} }, '@/lib/globalResetSync': { syncGlobalResetState: async () => { const value = reset; reset = false; return value; } } };
  const { AuthProvider } = load('src/contexts/AuthContext.tsx', mocks);
  const intervals = new Map(); let id = 0;
  globalThis.window = { setInterval: fn => { intervals.set(++id, fn); return id; }, clearInterval: key => intervals.delete(key), location: { reload: () => { reloads++; } } };
  const render = () => h.render(AuthProvider, { children: null }).props.value;
  return { render, event: (name, value) => { current = value; authEvent(name, value); }, setProfile: value => { record = value; }, defer: () => { let resolve; const promise = new Promise(r => { resolve = r; }); deferred = { promise, resolve }; return deferred; }, counts, intervals, reset: () => { reset = true; }, reloads: () => reloads, cleanup: h.cleanup };
};

test('token refresh and directory updates preserve mounted authenticated workspace', async () => {
  const f = authFixture(); f.render(); await settle(); let state = f.render();
  assert.equal(state.profile.full_name, 'Arianie'); assert.equal(state.restoredBusinessReady, true);
  const before = { ...f.counts };
  f.event('TOKEN_REFRESHED', session('auth-1')); state = f.render();
  assert.equal(state.loading, false); assert.equal(state.restoredBusinessReady, true);
  await settle(); state = f.render();
  assert.equal(f.counts.master, before.master); assert.equal(f.counts.target, before.target); assert.equal(f.counts.business, before.business);
  f.setProfile({ ...profile(), full_name: 'Arianie Fajarwati' });
  await state.refreshAuthenticatedProfile(); state = f.render();
  assert.equal(state.profile.full_name, 'Arianie Fajarwati'); assert.equal(state.restoredBusinessReady, true);
  assert.equal(f.counts.master, before.master); assert.equal(f.counts.business, before.business);
  const waiting = f.defer(); f.event('TOKEN_REFRESHED', session('auth-1')); f.render();
  const refresh = f.render().refreshAuthenticatedProfile();
  waiting.resolve({ data: { ...profile(), full_name: 'Arianie Fajarwati' }, error: null });
  await refresh; await settle(); f.render();
  assert(f.counts.users >= before.users + 2, 'directory revision must not be dropped while token refresh is pending');
  assert.equal(f.reloads(), 0);
  f.cleanup();
});

test('changed authority, inactive users, signout and explicit reset remain protected', async () => {
  const f = authFixture(); f.render(); await settle(); let state = f.render();
  f.setProfile({ ...profile(), role_level: 'Staff', legacy_user_id: 'USR-000099' });
  await state.refreshAuthenticatedProfile(); state = f.render();
  assert.equal(state.profile.legacy_user_id, 'USR-000099');
  f.setProfile(null); await state.refreshAuthenticatedProfile(); state = f.render();
  assert.equal(state.profile, null); assert.equal(state.restoredBusinessReady, false);
  f.event('SIGNED_IN', session('auth-1')); f.setProfile(profile()); await settle(); state = f.render();
  f.reset(); for (const timer of f.intervals.values()) await timer();
  assert.equal(f.reloads(), 1, 'only explicit global reset may reload');
  f.event('SIGNED_OUT', null); state = f.render();
  assert.equal(state.session, null); assert.equal(state.profile, null);
  f.cleanup();
});

const storage = () => { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => values.delete(key) }; };
const wizardFixture = saved => {
  const h = hooks(); const listeners = new Map(); const sessionStorage = saved || storage();
  globalThis.window = { sessionStorage, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name), confirm: () => true };
  globalThis.document = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const zero = () => ({ NB: '0', RN: '0' }); const months = () => ({ NB: Array(12).fill('0'), RN: Array(12).fill('0') });
  const user = { id: 'USR-000024', name: 'Arianie', role: 'TEAM_LEADER_MARKETING_SUPPORT' };
  const director = { id: 'USR-000001', name: 'Director', role: 'DIRECTOR_MARKETING', status: 'Active', superiorId: null, unit: 'Directorate Marketing', department: 'None', position: 'Director' };
  const allocation = () => ({ team: zero(), teamMonths: months(), personal: zero(), personalMonths: months(), notes: '' });
  const tree = { root: director.id, order: [director.id], nodes: { [director.id]: { user: director, children: [], depth: 0 } } };
  const steps = ['team', 'teamMonths', 'personal', 'personalMonths'].map(phase => ({ id: director.id, phase, automatic: false, lastChild: false }));
  const engine = { ZERO: zero(), blankMonths: months, buildWizardTree: () => tree, buildSteps: () => steps, seedWizard: () => ({ allocations: { [director.id]: allocation() }, accepted: [] }), normalizeAutomatic: (_, state) => state, continueWizard: (_, state) => state, acceptStep: (_, state, index) => ({ ...state, accepted: steps.slice(0, index + 1).map(step => `${step.id}:${step.phase}`) }), availableFor: () => undefined, sumMonths: value => ({ NB: String(value.NB.reduce((a, b) => a + Number(b || 0), 0)), RN: String(value.RN.reduce((a, b) => a + Number(b || 0), 0)) }), validateWizard: (_, state) => ({ state, entries: [], director: { annualTargetNewBusiness: 0, annualTargetRenewal: 0 }, total: 0 }) };
  const mockUi = Object.fromEntries(['Card','CardContent','CardDescription','CardHeader','CardTitle','Button','Input','Badge','Checkbox','Textarea','Dialog','DialogContent','DialogDescription','DialogHeader','DialogTitle','DialogFooter'].map(name => [name, name]));
  const mocks = { react: h.react, 'react/jsx-runtime': { jsx: h.jsx, jsxs: h.jsx, Fragment: 'Fragment' }, '@/services/store': { store: { getCurrentUser: () => user, getUsers: () => [director] } }, '@/services/targetService': { listCentralTargets: async () => [], publishCentralTargetBatch: async () => ({ batchId: 'test', recordCount: 0 }) }, '@/services/centralTargetRuntime': { refreshCentralTargetRuntime: async () => {} }, '@/hooks/useTargetRealizationPublisher': { useTargetRealizationPublisher: () => ({ canPublish: true, loading: false }) }, '@/utils/formatters': { formatRupiah: value => String(value) }, '@/utils/targetCompact': { parseExactTargetRupiah: value => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid'); return n; } }, '@/utils/targetOnScreen': { targetSetupHolders: users => users, TARGET_MONTHS: Array.from({length:12},(_,i)=>`Month ${i+1}`) }, '@/utils/targetCascadingWizard': engine, '@/components/ui/card': mockUi, '@/components/ui/button': mockUi, '@/components/ui/input': mockUi, '@/components/ui/badge': mockUi, '@/components/ui/checkbox': mockUi, '@/components/ui/textarea': mockUi, '@/components/ui/dialog': mockUi, 'lucide-react': new Proxy({}, { get: (_, key) => String(key) }) };
  const { default: Wizard } = load('src/components/rkap/TargetCascadingWizard.tsx', mocks);
  const render = () => h.render(Wizard, { publisherAuthorized: true });
  const walk = (node, predicate) => { if (node === null || node === undefined || typeof node === 'boolean') return null; if (Array.isArray(node)) { for (const child of node) { const found = walk(child,predicate); if (found) return found; } return null; } if (typeof node !== 'object') return null; if (predicate(node)) return node; return walk(node.props?.children,predicate); };
  const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : '';
  const find = (root, type, label) => walk(root, node => node.type === type && (!label || text(node).includes(label)));
  return { render, find, walk, text, storage: sessionStorage, listeners, cleanup: h.cleanup };
};

test('wizard opens only on click and restores unconfirmed NB/RN, exact step and modal visibility', async () => {
  const saved = storage(); let f = wizardFixture(saved); f.render(); await settle(); let view = f.render();
  assert.equal(f.find(view,'Dialog').props.open,false);
  f.find(view,'Button','Mulai Setup Target').props.onClick(); view = f.render();
  assert.equal(f.find(view,'Dialog').props.open,true);
  const input = label => f.walk(view, node => node.type === 'Input' && node.props['aria-label'] === label);
  input('Target tim tahunan NB').props.onChange({ target: { value: '100' } });
  input('Target tim tahunan RN').props.onChange({ target: { value: '20' } });
  view = f.render(); f.find(view,'Button','Lanjut').props.onClick(); view = f.render();
  const monthly = f.walk(view, node => typeof node.type === 'function' && node.type.name === 'MonthlyEditor');
  assert(monthly); monthly.props.onChange({ NB: ['60','40',...Array(10).fill('0')], RN: ['5','15',...Array(10).fill('0')] });
  view = f.render(); globalThis.document.visibilityState = 'hidden'; f.listeners.get('visibilitychange')();
  const key = 'pertalife:target-wizard:v3:USR-000024:2026';
  let stored = JSON.parse(saved.getItem(key)); assert.equal(stored.modalOpen,true); assert.equal(stored.state.accepted.length,1); assert.equal(stored.form.monthly.NB[0],'60'); assert.equal(stored.form.monthly.RN[1],'15');
  f.cleanup(); f = wizardFixture(saved); f.render(); await settle(); view = f.render();
  assert.equal(f.find(view,'Dialog').props.open,true);
  const restored = f.walk(view, node => typeof node.type === 'function' && node.type.name === 'MonthlyEditor');
  assert.deepEqual(restored.props.values.NB.slice(0,2),['60','40']); assert.equal(restored.props.values.RN[1],'15');
  f.find(view,'Button','Simpan Draft & Tutup').props.onClick(); view = f.render();
  assert.equal(f.find(view,'Dialog').props.open,false);
  assert.equal(JSON.parse(saved.getItem(key)).modalOpen,false);
  f.cleanup(); f = wizardFixture(saved); f.render(); await settle(); view = f.render();
  assert.equal(f.find(view,'Dialog').props.open,false);
  assert(f.find(view,'Button','Lanjutkan Wizard'));
  f.cleanup();
});

test('year switching cannot overwrite another year with the previous year draft', async () => {
  const saved = storage(); const f = wizardFixture(saved); f.render(); await settle(); let view=f.render();
  f.find(view,'Button','Mulai Setup Target').props.onClick(); view=f.render();
  f.walk(view,n=>n.type==='Input'&&n.props['aria-label']==='Target tim tahunan NB').props.onChange({target:{value:'2026'}});
  view=f.render(); const year = f.walk(view,n=>n.type==='select'&&n.props.value===2026); year.props.onChange({target:{value:'2027'}});
  view=f.render(); await settle(); view=f.render();
  const next = saved.getItem('pertalife:target-wizard:v3:USR-000024:2027');
  assert.equal(next,null,'2026 draft must never be written under the 2027 key');
  assert.equal(JSON.parse(saved.getItem('pertalife:target-wizard:v3:USR-000024:2026')).form.annual.NB,'2026');
  f.cleanup();
});
