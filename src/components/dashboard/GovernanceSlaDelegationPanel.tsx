import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  UserRoundCog,
  X,
} from 'lucide-react';
import {
  store,
  ActingApproverArea,
  ActingApproverDelegation,
} from '@/services/store';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  STANDARD_SLA_BUSINESS_DAYS,
} from '@/utils/slaGovernance';

type DelegationTarget = {
  area: ActingApproverArea;
  label: string;
  userId: 'USR-000028' | 'USR-000030';
  name: string;
};

const TARGETS: DelegationTarget[] = [
  {
    area: 'MARKETING_ADMINISTRATION',
    label: 'Marketing Administration',
    userId: 'USR-000028',
    name: 'RR Endah Wasis Wuwuh Mumpuni',
  },
  {
    area: 'MARKETING_COMMUNICATION',
    label: 'Marketing Communication',
    userId: 'USR-000030',
    name: 'Andi Rita Anastasya Baso',
  },
];

const todayKey = () =>
  new Date().toLocaleDateString('en-CA');

export const GovernanceSlaDelegationPanel: React.FC<{
  currentUser: User;
}> = ({ currentUser }) => {
  const [delegations, setDelegations] =
    useState<ActingApproverDelegation[]>(
      store.getApproverDelegations()
    );

  const [target, setTarget] =
    useState<DelegationTarget | null>(null);

  const [startDate, setStartDate] =
    useState(todayKey());
  const [endDate, setEndDate] =
    useState(todayKey());
  const [reason, setReason] =
    useState('Cuti / tidak berada di tempat');

  useEffect(() => {
    const refresh = () =>
      setDelegations(
        store.getApproverDelegations()
      );

    refresh();
    return store.subscribe(refresh);
  }, []);

  const canConfigure =
    currentUser.id === 'USR-000024' ||
    currentUser.id === 'USR-000028' ||
    currentUser.id === 'USR-000030';

  const visibleTargets = useMemo(
    () =>
      currentUser.id === 'USR-000024'
        ? TARGETS
        : currentUser.id === 'USR-000028'
          ? TARGETS.filter(
              item =>
                item.userId === 'USR-000028'
            )
          : currentUser.id === 'USR-000030'
            ? TARGETS.filter(
                item =>
                  item.userId === 'USR-000030'
              )
            : [],
    [currentUser.id]
  );

  const openDelegation = (
    nextTarget: DelegationTarget
  ) => {
    setTarget(nextTarget);
    setStartDate(todayKey());
    setEndDate(todayKey());
    setReason('Cuti / tidak berada di tempat');
  };

  const save = () => {
    if (!target) {
      return;
    }

    try {
      store.saveApproverDelegation({
        area: target.area,
        startDate,
        endDate,
        reason,
      });
      setTarget(null);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan delegasi.'
      );
    }
  };

  return (
    <>
      <Card className="border-blue-100 bg-gradient-to-r from-blue-50/70 via-white to-violet-50/70 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-black text-slate-950">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Governance SLA & Acting Approver
              </CardTitle>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                SLA standar seluruh proses lintas fungsi adalah <b>{STANDARD_SLA_BUSINESS_DAYS} hari kerja</b> (Senin–Jumat). Saat Department Head cuti, kewenangan approval dapat dialihkan sementara ke Team Leader Marketing Support.
              </p>
            </div>

            <Badge
              variant="outline"
              className="w-fit border-emerald-200 bg-emerald-50 text-[10px] font-black text-emerald-700"
            >
              SLA Standard: {STANDARD_SLA_BUSINESS_DAYS} Hari Kerja
            </Badge>
          </div>
        </CardHeader>

        {visibleTargets.length > 0 && (
          <CardContent className="grid gap-3 md:grid-cols-2">
          {visibleTargets.map(item => {
            const active =
              store.getActiveApproverDelegation(
                item.area
              );

            return (
              <div
                key={item.area}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {item.label}
                    </div>
                    <div className="mt-1 text-xs font-black text-slate-900">
                      {item.name}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500">
                      Primary Approver
                    </div>
                  </div>

                  {active ? (
                    <Badge className="bg-violet-100 text-[9px] font-black text-violet-700 hover:bg-violet-100">
                      Acting Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold text-slate-500"
                    >
                      Normal
                    </Badge>
                  )}
                </div>

                {active ? (
                  <div className="mt-3 rounded-lg border border-violet-100 bg-violet-50 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-black text-violet-900">
                      <UserRoundCog className="h-3.5 w-3.5" />
                      Acting Approver: Arianie Fajarwati
                    </div>
                    <div className="mt-1 text-[9px] leading-relaxed text-violet-700">
                      {active.startDate} s.d. {active.endDate} • {active.reason}
                    </div>
                    {currentUser.id === 'USR-000024' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          window.location.href =
                            item.area === 'MARKETING_ADMINISTRATION'
                              ? '/booking-pipeline'
                              : '/dokumen-pendukung?area=marcomm-requests';
                        }}
                        className="mt-2 mr-2 h-7 bg-violet-700 text-[9px] font-bold text-white hover:bg-violet-800"
                      >
                        Buka Acting Action Queue
                      </Button>
                    )}

                    {canConfigure && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              'Hentikan acting delegation ini?'
                            )
                          ) {
                            try {
                              store.deactivateApproverDelegation(
                                active.id
                              );
                            } catch (error) {
                              alert(
                                error instanceof Error
                                  ? error.message
                                  : 'Gagal menghentikan delegasi.'
                              );
                            }
                          }
                        }}
                        className="mt-2 h-7 text-[9px] font-bold"
                      >
                        Hentikan Delegasi
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[9px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approval berjalan melalui Department Head normal.
                  </div>
                )}

                {canConfigure && !active && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openDelegation(item)
                    }
                    className="mt-3 h-8 gap-1 text-[10px] font-bold"
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    Aktifkan Acting Approver
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
        )}
      </Card>

      {target && (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTarget(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white shadow-2xl"
            onClick={event =>
              event.stopPropagation()
            }
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-sm font-black text-slate-950">
                  Aktifkan Acting Approver
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {target.label} • {target.name} → Arianie Fajarwati
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTarget(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Mulai Delegasi *
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={event =>
                    setStartDate(
                      event.target.value
                    )
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Akhir Delegasi *
                </label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={event =>
                    setEndDate(
                      event.target.value
                    )
                  }
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Alasan *
                </label>
                <Textarea
                  value={reason}
                  onChange={event =>
                    setReason(
                      event.target.value
                    )
                  }
                  placeholder="Contoh: Cuti tahunan 24–28 Agustus 2026"
                  className="min-h-24 text-xs"
                />
              </div>

              <div className="md:col-span-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900">
                Selama periode aktif, Arianie dapat melakukan approval yang secara normal menjadi kewenangan {target.name}. Semua action tetap tercatat atas nama Arianie sebagai actor pada Riwayat/Audit Trail.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={save}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Aktifkan Delegasi
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GovernanceSlaDelegationPanel;
