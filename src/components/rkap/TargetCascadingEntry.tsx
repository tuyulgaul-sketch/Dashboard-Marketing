import React, { useEffect, useState } from 'react';
import { store } from '@/services/store';
import { Button } from '@/components/ui/button';
import TargetCascadingWizard from './TargetCascadingWizard';
import LegacyTargetOnScreenSetup from './TargetOnScreenSetup';

const TargetCascadingEntry: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {
  const [manual, setManual] = useState(() => {
    try { return window.sessionStorage.getItem(`pertalife:target-editor:${store.getCurrentUser().id}`) === 'manual'; } catch { return false; }
  });
  useEffect(() => { try { window.sessionStorage.setItem(`pertalife:target-editor:${store.getCurrentUser().id}`, manual ? 'manual' : 'wizard'); } catch { /* Optional view state. */ } }, [manual]);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">Setup terpandu menjadi alur utama. Editor manual tetap tersedia untuk kebutuhan khusus.</p>
      <Button size="sm" variant="outline" onClick={() => setManual(value => !value)}>{manual ? 'Kembali ke Wizard' : 'Editor Manual'}</Button>
    </div>
    <div hidden={manual}><TargetCascadingWizard publisherAuthorized={publisherAuthorized}/></div>
    <div hidden={!manual}><LegacyTargetOnScreenSetup publisherAuthorized={publisherAuthorized}/></div>
  </div>;
};
export default TargetCascadingEntry;
