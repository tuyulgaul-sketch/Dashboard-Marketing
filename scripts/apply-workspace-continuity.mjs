import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one source anchor: ${before.slice(0, 100)}`);
  return source.replace(before, after);
};
const change = (path, transform) => {
  const before = read(path); const after = transform(before);
  assert.notEqual(after, before, `${path} did not change`);
  writeFileSync(path, after);
};

export const wizardTransform = original => {
  let s = original;
  s = once(s, "import React, { useCallback, useEffect, useMemo, useState } from 'react';", "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';");
  s = once(s,
    "type SavedDraft = { version: 2; year: number; actorId: string; sourceSnapshot: string; sourceDirectory: string; state: WizardState; savedAt: string };\nconst storageKey = (id: string, year: number) => `pertalife:target-wizard:v2:${id}:${year}`;",
    `type WizardForm = { key: string; annual: Amounts; monthly: Months };
type SavedDraft = { version: 2 | 3; year: number; actorId: string; sourceSnapshot: string; sourceDirectory: string; state: WizardState; savedAt: string; form?: WizardForm; modalOpen?: boolean; reviewMonth?: string; batchNotes?: string };
const storageKey = (id: string, year: number) => \`pertalife:target-wizard:v3:\${id}:\${year}\`;
const legacyStorageKey = (id: string, year: number) => \`pertalife:target-wizard:v2:\${id}:\${year}\`;
const validForm = (value: unknown): value is WizardForm => {
  if (!value || typeof value !== 'object') return false;
  const form = value as WizardForm;
  return typeof form.key === 'string' && ['NB', 'RN'].every(kind => {
    const k = kind as 'NB' | 'RN';
    return typeof form.annual?.[k] === 'string' && Array.isArray(form.monthly?.[k]) && form.monthly[k].length === 12 && form.monthly[k].every(item => typeof item === 'string');
  });
};`);
  s = once(s, "  const [form, setForm] = useState<{ key: string; annual: Amounts; monthly: Months }>", "  const [form, setForm] = useState<WizardForm>");
  s = once(s,
    "  const markChanged = () => { setDirty(true); setReview(null); setAcknowledged(false); setMessage(''); };\n  const draftKey = storageKey(actorId, year);\n  const clearStored = () => { try { window.sessionStorage.removeItem(draftKey); } catch { /* Optional local draft only. */ } };",
    `  const markChanged = () => { setDirty(true); setReview(null); setAcknowledged(false); setMessage(''); };
  const updateForm = (value: WizardForm) => { setForm(value); markChanged(); };
  const draftKey = storageKey(actorId, year);
  const workspaceRef = useRef<{ key: string; saved: SavedDraft; shouldSave: boolean } | null>(null);
  workspaceRef.current = { key: draftKey, shouldSave: authorized && loaded && (dirty || modalOpen), saved: { version: 3, year, actorId, sourceSnapshot, sourceDirectory, state: draft, form, modalOpen, reviewMonth, batchNotes, savedAt: new Date().toISOString() } };
  const persist = useCallback(() => {
    const current = workspaceRef.current;
    if (!current?.shouldSave) return;
    try { window.sessionStorage.setItem(current.key, JSON.stringify(current.saved)); } catch { /* Keep the in-memory draft. */ }
  }, []);
  const clearStored = () => { try { window.sessionStorage.removeItem(draftKey); window.sessionStorage.removeItem(legacyStorageKey(actorId, year)); } catch { /* Optional local draft only. */ } };`);
  s = once(s,
    "      setUsers(directory); setOfficial(current); setDraft(seeded); setSourceSnapshot(source); setSourceDirectory(signature); setDirty(false); setBatchNotes(''); clearForm();\n      let stored: SavedDraft | null = null;",
    "      let stored: SavedDraft | null = null;");
  s = once(s,
    "        const raw = window.sessionStorage.getItem(storageKey(actorId, selectedYear));\n        if (raw) { const candidate = JSON.parse(raw) as SavedDraft; if (candidate.version === 2 && candidate.actorId === actorId && candidate.year === selectedYear && candidate.sourceSnapshot === source && candidate.sourceDirectory === signature && candidate.state && Array.isArray(candidate.state.accepted)) { const expected = buildSteps(nextTree); if (candidate.state.accepted.length <= expected.length && candidate.state.accepted.every((key, i) => key === stepKey(expected[i]))) { normalizeAutomatic(nextTree, candidate.state, candidate.state.accepted.length); stored = candidate; } } else window.sessionStorage.removeItem(storageKey(actorId, selectedYear)); }",
    `        const raw = window.sessionStorage.getItem(storageKey(actorId, selectedYear)) || window.sessionStorage.getItem(legacyStorageKey(actorId, selectedYear));
        if (raw) {
          const candidate = JSON.parse(raw) as SavedDraft;
          if ((candidate.version === 2 || candidate.version === 3) && candidate.actorId === actorId && candidate.year === selectedYear && candidate.sourceSnapshot === source && candidate.sourceDirectory === signature && candidate.state && Array.isArray(candidate.state.accepted)) {
            const expected = buildSteps(nextTree);
            if (candidate.state.accepted.length <= expected.length && candidate.state.accepted.every((key, i) => key === stepKey(expected[i]))) {
              const restored = normalizeAutomatic(nextTree, candidate.state, candidate.state.accepted.length);
              // Recheck every previously accepted step against the current hierarchy.
              for (let i = 0; i < candidate.state.accepted.length; i++) {
                const checked = acceptStep(nextTree, { ...restored, accepted: expected.slice(0, i).map(stepKey) }, i);
                if (checked.accepted.length !== i + 1) throw new Error('Draft tidak valid.');
              }
              stored = { ...candidate, state: restored };
            }
          }
        }`);
  s = once(s,
    "      setSavedDraft(stored); setLoaded(true); setModalOpen(!stored);\n      setMessage(stored ? 'Draft sebelumnya ditemukan. Lanjutkan atau mulai ulang dari data resmi.' : current.length ? `Memuat ${current.length} target resmi ${selectedYear}. Angka existing tidak berubah sampai Publish.` : 'Belum ada target resmi. Mulai dari pagu tahunan Direktorat.');",
    `      setUsers(directory); setOfficial(current); setSourceSnapshot(source); setSourceDirectory(signature);
      if (stored?.version === 3) {
        setDraft(stored.state); setDirty(true); setSavedDraft(null);
        setForm(validForm(stored.form) && (!stored.form.key || buildSteps(nextTree)[stored.state.accepted.length] && stored.form.key === stepKey(buildSteps(nextTree)[stored.state.accepted.length])) ? stored.form : { key: '', annual: ZERO, monthly: blankMonths() });
        setReviewMonth(stored.reviewMonth === 'annual' || (typeof stored.reviewMonth === 'string' && /^(?:[0-9]|1[01])$/.test(stored.reviewMonth)) ? stored.reviewMonth : 'annual');
        setBatchNotes(stored.batchNotes || '');
        setModalOpen(stored.modalOpen === true);
      } else {
        setDraft(seeded); setDirty(false); setSavedDraft(stored); setBatchNotes(''); clearForm(); setModalOpen(false);
      }
      setLoaded(true);
      setMessage(stored?.version === 3 ? 'Draft dan posisi terakhir dipulihkan. Validasi Publish harus dijalankan kembali.' : stored ? 'Draft sebelumnya ditemukan. Lanjutkan atau mulai ulang dari data resmi.' : current.length ? \`Memuat \${current.length} target resmi \${selectedYear}. Angka existing tidak berubah sampai Publish.\` : 'Belum ada target resmi. Klik Mulai Setup Target untuk membuka wizard.');`);
  s = once(s,
    "  useEffect(() => { if (!authorized || !loaded || !dirty) return; try { const saved: SavedDraft = { version: 2, year, actorId, sourceSnapshot, sourceDirectory, state: draft, savedAt: new Date().toISOString() }; window.sessionStorage.setItem(draftKey, JSON.stringify(saved)); } catch { /* In-memory draft remains usable. */ } }, [authorized, loaded, dirty, year, actorId, sourceSnapshot, sourceDirectory, draft, draftKey]);\n  const resume = () => { if (!savedDraft || !tree) return; try { const restored = continueWizard(tree, savedDraft.state); setDraft(restored); setDirty(true); setSavedDraft(null); setModalOpen(true); clearForm(); } catch (error) { setMessage(errorText(error)); } };\n  const start = () => { setSavedDraft(null); setModalOpen(true); clearForm(); };\n  const changeYear = (value: number) => { if (value === year || busy) return; if (dirty && !window.confirm('Draft tetap tersimpan di sesi browser. Ganti tahun?')) return; setYear(value); };",
    `  useEffect(() => { persist(); }, [persist, authorized, loaded, dirty, year, actorId, sourceSnapshot, sourceDirectory, draft, form, modalOpen, reviewMonth, batchNotes]);
  useEffect(() => {
    const save = () => persist();
    window.addEventListener('pagehide', save);
    const visibility = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', visibility); };
  }, [persist]);
  const resume = () => { if (!savedDraft || !tree) return; try { const restored = continueWizard(tree, savedDraft.state); setDraft(restored); setDirty(true); setSavedDraft(null); setModalOpen(true); if (validForm(savedDraft.form)) setForm(savedDraft.form); else clearForm(); } catch (error) { setMessage(errorText(error)); } };
  const start = () => { setSavedDraft(null); setModalOpen(true); };
  const changeYear = (value: number) => { if (value === year || busy) return; if (dirty && !window.confirm('Draft tetap tersimpan di sesi browser. Ganti tahun?')) return; persist(); setYear(value); };`);
  s = once(s,
    "    const nextState = structuredClone(draft); nextState.accepted = nextState.accepted.slice(0, target); setDraft(nextState); clearForm(); markChanged(); setModalOpen(true);",
    "    const nextState = structuredClone(draft); if (step && form.key === formKey) nextState.allocations[step.id][step.phase] = (isMonths(step.phase) ? monthly : annual) as never; nextState.accepted = nextState.accepted.slice(0, target); setDraft(nextState); clearForm(); markChanged(); setModalOpen(true);");
  s = once(s, "onChange={value => setForm({ key: formKey, annual, monthly: value })}", "onChange={value => updateForm({ key: formKey, annual, monthly: value })}");
  s = once(s, "value => setForm({ key: formKey, annual: { ...annual, NB: value }, monthly })", "value => updateForm({ key: formKey, annual: { ...annual, NB: value }, monthly })");
  s = once(s, "value => setForm({ key: formKey, annual: { ...annual, RN: value }, monthly })", "value => updateForm({ key: formKey, annual: { ...annual, RN: value }, monthly })");
  s = once(s, "onClick={() => setModalOpen(false)}>Simpan Draft & Tutup", "onClick={() => { setModalOpen(false); persist(); }}>Simpan Draft & Tutup");
  s = once(s, "const start = () => { setSavedDraft(null); setModalOpen(true); };", "const start = () => { setSavedDraft(null); setModalOpen(true); };");
  return s;
};

export const entryTransform = original => {
  let s = original;
  s = once(s, "import React, { useState } from 'react';", "import React, { useEffect, useState } from 'react';\nimport { store } from '@/services/store';");
  s = once(s, "  const [manual, setManual] = useState(false);", `  const [manual, setManual] = useState(() => {
    try { return window.sessionStorage.getItem(\`pertalife:target-editor:\${store.getCurrentUser().id}\`) === 'manual'; } catch { return false; }
  });
  useEffect(() => { try { window.sessionStorage.setItem(\`pertalife:target-editor:\${store.getCurrentUser().id}\`, manual ? 'manual' : 'wizard'); } catch { /* Optional view state. */ } }, [manual]);`);
  s = once(s, "    {manual ? <LegacyTargetOnScreenSetup publisherAuthorized={publisherAuthorized}/> : <TargetCascadingWizard publisherAuthorized={publisherAuthorized}/>}", "    <div hidden={manual}><TargetCascadingWizard publisherAuthorized={publisherAuthorized}/></div>\n    <div hidden={!manual}><LegacyTargetOnScreenSetup publisherAuthorized={publisherAuthorized}/></div>");
  return s;
};

if (process.argv[1]?.endsWith('apply-workspace-continuity.mjs')) {
  change('src/components/rkap/TargetCascadingWizard.tsx', wizardTransform);
  change('src/components/rkap/TargetCascadingEntry.tsx', entryTransform);
  console.log('Workspace continuity source patches applied.');
}
