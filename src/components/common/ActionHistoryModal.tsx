import React from 'react';
import {
  History,
  X,
} from 'lucide-react';
import {
  Button,
} from '@/components/ui/button';
import {
  Badge,
} from '@/components/ui/badge';

export interface ActionHistoryEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole?: string;
  action: string;
  status?: string;
  description?: string;
  notes?: string;
}

interface ActionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entries: ActionHistoryEntry[];
}

const formatTraceDateTime =
  (
    value:
      string
  ) => {
    const date =
      new Date(
        value
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
      'id-ID',
      {
        day:
          '2-digit',
        month:
          'short',
        year:
          'numeric',
        hour:
          '2-digit',
        minute:
          '2-digit',
        second:
          '2-digit',
      }
    );
  };

export const ActionHistoryModal:
  React.FC<
    ActionHistoryModalProps
  > = ({
    open,
    onClose,
    title,
    subtitle,
    entries,
  }) => {
    if (
      !open
    ) {
      return null;
    }

    const sortedEntries =
      [
        ...entries,
      ].sort(
        (
          first,
          second
        ) =>
          new Date(
            first.timestamp
          ).getTime() -
          new Date(
            second.timestamp
          ).getTime()
      );

    return (
      <div
        className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
        onClick={
          onClose
        }
      >
        <div
          className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={
            event =>
              event.stopPropagation()
          }
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 shrink-0 text-blue-600" />

                <h2 className="truncate text-sm font-black text-gray-900">
                  {title}
                </h2>
              </div>

              {subtitle && (
                <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                  {subtitle}
                </p>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={
                onClose
              }
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-[76vh] overflow-y-auto p-5">
            {sortedEntries.length ===
            0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-xs text-gray-400">
                Belum ada riwayat aksi yang tersimpan.
              </div>
            ) : (
              <div className="relative pl-7">
                <div className="absolute bottom-0 left-[9px] top-0 w-px bg-gray-200" />

                <div className="space-y-4">
                  {sortedEntries.map(
                    entry => (
                      <div
                        key={
                          entry.id
                        }
                        className="relative"
                      >
                        <div className="absolute -left-7 top-1.5 h-[18px] w-[18px] rounded-full border-4 border-white bg-blue-600 shadow-sm" />

                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-xs font-black text-gray-900">
                                {entry.action}
                              </div>

                              <div className="mt-1 text-[10px] text-gray-600">
                                Oleh <b>{entry.actorName}</b>
                                {entry.actorRole
                                  ? ` • ${entry.actorRole}`
                                  : ''}
                              </div>
                            </div>

                            <div className="shrink-0 text-[9px] font-semibold text-gray-400">
                              {formatTraceDateTime(
                                entry.timestamp
                              )}
                            </div>
                          </div>

                          {entry.status && (
                            <div className="mt-2">
                              <Badge
                                variant="outline"
                                className="text-[9px] font-bold"
                              >
                                {entry.status}
                              </Badge>
                            </div>
                          )}

                          {entry.description && (
                            <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
                              {entry.description}
                            </p>
                          )}

                          {entry.notes && (
                            <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-900">
                              <b>Catatan:</b>{' '}
                              {entry.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

export default ActionHistoryModal;
