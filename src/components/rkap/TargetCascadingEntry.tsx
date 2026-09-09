import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import TargetCascadingWizard from './TargetCascadingWizard';
import LegacyTargetOnScreenSetup from './TargetOnScreenSetup';

const TargetCascadingEntry: React.FC<{ publisherAuthorized: boolean }> = ({ publisherAuthorized }) => {
  const [manual, setManual] = useState(false);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-slate-500">Setup terpandu menjadi alur utama. Editor manual tetap tersedia untuk kebutuhan khusus.</p>
      <Button size="sm" variant="outline" onClick={() => setManual(value => !value)}>{manual ? 'Kembali ke Wizard' : 'Editor Manual'}</Button>
    </div>
    {manual ? <LegacyTargetOnScreenSetup publisherAuthorized={publisherAuthorized}/> : <TargetCascadingWizard publisherAuthorized={publisherAuthorized}/>}
  </div>;
};
export default TargetCascadingEntry;
