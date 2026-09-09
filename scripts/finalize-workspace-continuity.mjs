import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const once = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one anchor: ${before.slice(0, 90)}`);
  return source.replace(before, after);
};
const path = 'src/components/rkap/TargetCascadingWizard.tsx';
let source = readFileSync(path, 'utf8');
source = once(source,
  "  const persist = useCallback(() => {\n    const current = workspaceRef.current;\n    if (!current?.shouldSave) return;\n    try { window.sessionStorage.setItem(current.key, JSON.stringify(current.saved)); } catch { /* Keep the in-memory draft. */ }\n  }, []);",
  "  const persist = useCallback((open?: boolean) => {\n    const current = workspaceRef.current;\n    if (!current?.shouldSave) return;\n    try { window.sessionStorage.setItem(current.key, JSON.stringify({ ...current.saved, modalOpen: open ?? current.saved.modalOpen })); } catch { /* Keep the in-memory draft. */ }\n  }, []);");
source = once(source,
  "  const start = () => { setSavedDraft(null); setModalOpen(true); };",
  "  const start = () => { setSavedDraft(null); setModalOpen(true); persist(true); };");
source = once(source,
  "onClick={() => { setModalOpen(false); persist(); }}>Simpan Draft & Tutup",
  "onClick={() => { persist(false); setModalOpen(false); }}>Simpan Draft & Tutup");
// Reopening and closing a modal are presentation changes, not financial edits.
// Keep the current draft exactly as typed; the only reset is explicit restart.
source = once(source,
  "if (window.confirm('Mulai ulang dari target resmi? Draft sesi sebelumnya akan diganti.')) { clearStored(); setDraft(seedWizard(tree!, official)); setDirty(false); setSavedDraft(null); start(); }",
  "if (window.confirm('Mulai ulang dari target resmi? Draft sesi sebelumnya akan diganti.')) { clearStored(); setDraft(seedWizard(tree!, official)); clearForm(); setReview(null); setAcknowledged(false); setDirty(false); setSavedDraft(null); setModalOpen(true); }");
// Review data is intentionally not persisted as an authorization to Publish.
// A restored completed draft must pass the full authoritative validation again.
writeFileSync(path, source);
console.log('Workspace modal controls and explicit restart finalized.');
