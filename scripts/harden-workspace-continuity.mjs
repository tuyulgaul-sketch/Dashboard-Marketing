import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one source anchor: ${before.slice(0, 90)}`);
  return source.replace(before, after);
};
const change = (path, transform) => {
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  assert.notEqual(after, before);
  writeFileSync(path, after);
};

export const hardenAuth = original => {
  let s = original;
  s = once(s,
    "const AuthContext = createContext<AuthContextValue | undefined>(undefined);",
    `const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const authoritySignature = (profile: AuthProfile) => JSON.stringify([
  profile.id, profile.auth_user_id, profile.role_level, profile.unit,
  profile.department, profile.manager_id, profile.legacy_user_id, profile.active,
]);`);
  s = once(s,
    "      .eq('auth_user_id', currentSession.user.id).eq('active', true).single();",
    "      .eq('auth_user_id', currentSession.user.id).eq('active', true).single().catch(error => ({ data: null, error }));");
  s = once(s,
    `    const unchanged = Boolean(previous && JSON.stringify(previous) === JSON.stringify(authProfile));
    if (background && unchanged) {
      // Refresh only the authoritative directory when its revision changed.
      // Token renewal and window focus must not clear business runtimes or forms.
      if (forceDirectory) await syncCentralUserRuntime(authProfile);
      return;
    }
    try {`,
    `    const unchanged = Boolean(previous && JSON.stringify(previous) === JSON.stringify(authProfile));
    const sameAuthority = Boolean(previous && authoritySignature(previous) === authoritySignature(authProfile));
    if (background && sameAuthority) {
      // Display-only changes and directory revisions do not rebuild business
      // runtimes. Keep the active forms mounted and refresh only the directory.
      try {
        if (forceDirectory || !unchanged) await syncCentralUserRuntime(authProfile);
        if (isCurrent() && !unchanged) updateProfile(authProfile);
      } catch (refreshError) {
        console.error('Directory refresh failed:', refreshError);
      }
      return;
    }
    if (background && previous && !sameAuthority) {
      // A genuine role, hierarchy or account change must not retain the old
      // authorization while the new authoritative runtime is being loaded.
      updateProfile(null);
      setRestoredBusinessReady(false);
      clearLiteRuntime();
    }
    try {`);
  s = once(s,
    `    if (refreshing.current) return refreshing.current;
    const task = loadProfile(current, generation.current, true, true);
    refreshing.current = task;
    try { await task; } finally { if (refreshing.current === task) refreshing.current = null; }`,
    `    const version = generation.current;
    const previousTask = refreshing.current;
    if (previousTask) {
      // A directory revision must not be dropped just because a token check
      // is in flight. Wait, then perform the requested authoritative refresh.
      await previousTask.catch(error => { console.error('Profile refresh failed:', error); });
      if (generation.current !== version || sessionRef.current?.user.id !== current.user.id) return;
    }
    const task = loadProfile(sessionRef.current!, version, true, true);
    refreshing.current = task;
    try { await task; } finally { if (refreshing.current === task) refreshing.current = null; }`);
  s = once(s,
    `          void task.finally(() => { if (refreshing.current === task) refreshing.current = null; });`,
    `          void task.catch(error => { console.error('Profile refresh failed:', error); }).finally(() => { if (refreshing.current === task) refreshing.current = null; });`);
  return s;
};

export const hardenWizard = original => {
  let s = original;
  s = once(s,
    "  const [loaded, setLoaded] = useState(false); const [busy, setBusy]",
    "  const [loadedYear, setLoadedYear] = useState<number | null>(null);\n  const [loaded, setLoaded] = useState(false); const [busy, setBusy]");
  s = once(s,
    "shouldSave: authorized && loaded && (dirty || modalOpen)",
    "shouldSave: authorized && loaded && loadedYear === year && (dirty || modalOpen)");
  s = once(s,
    "    setBusy(true); setLoaded(false); setModalOpen(false); setReview(null);",
    "    setBusy(true); setLoaded(false); setLoadedYear(null); setModalOpen(false); setReview(null);");
  s = once(s,
    "      setLoaded(true);\n      setMessage(stored?.version === 3",
    "      setLoadedYear(selectedYear); setLoaded(true);\n      setMessage(stored?.version === 3");
  s = once(s,
    "dirty, year, actorId, sourceSnapshot, sourceDirectory, draft, form, modalOpen, reviewMonth, batchNotes]);",
    "dirty, year, loadedYear, actorId, sourceSnapshot, sourceDirectory, draft, form, modalOpen, reviewMonth, batchNotes]);");
  s = once(s,
    "persist(); setYear(value); };",
    "persist(); setLoaded(false); setLoadedYear(null); setYear(value); };");
  s = once(s,
    "const TargetCascadingWizard: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {",
    "const TargetCascadingWizard: React.FC<{ publisherAuthorized: boolean; active?: boolean }> = ({ publisherAuthorized, active = true }) => {");
  s = once(s,
    "<Dialog open={modalOpen && loaded && Boolean(tree)}",
    "<Dialog open={active && modalOpen && loaded && Boolean(tree)}");
  s = once(s,
    "onOpenChange={open => { if (!busy) setModalOpen(open); }}",
    "onOpenChange={open => { if (!busy && active) { persist(open); setModalOpen(open); } }}");
  s = once(s,
    "if (validForm(savedDraft.form)) setForm(savedDraft.form); else clearForm();",
    "if (validForm(savedDraft.form)) setForm(savedDraft.form); else clearForm(); persist(true);");
  return s;
};

export const hardenEntry = original => once(original,
  '<TargetCascadingWizard publisherAuthorized={publisherAuthorized}/>',
  '<TargetCascadingWizard publisherAuthorized={publisherAuthorized} active={!manual}/>');

if (process.argv[1]?.endsWith('harden-workspace-continuity.mjs')) {
  change('src/contexts/AuthContext.tsx', hardenAuth);
  change('src/components/rkap/TargetCascadingWizard.tsx', hardenWizard);
  change('src/components/rkap/TargetCascadingEntry.tsx', hardenEntry);
  console.log('Focus and year-scoped workspace hardening applied.');
}
