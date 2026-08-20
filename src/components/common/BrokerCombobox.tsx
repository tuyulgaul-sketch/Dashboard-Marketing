import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Check,
  ChevronDown,
  Search,
} from 'lucide-react';
import { store } from '@/services/store';
import { BrokerMaster } from '@/data/brokerMasterData';

interface BrokerComboboxProps {
  value?: string;
  onChange: (
    broker: BrokerMaster | null
  ) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const BrokerCombobox:
  React.FC<BrokerComboboxProps> = ({
    value,
    onChange,
    disabled = false,
    placeholder =
      'Ketik atau pilih broker...',
  }) => {
    const [
      brokers,
      setBrokers,
    ] = useState<BrokerMaster[]>(
      store
        .getBrokers()
        .filter(
          broker =>
            broker.status ===
            'Active'
        )
    );

    const [
      query,
      setQuery,
    ] = useState('');

    const [
      open,
      setOpen,
    ] = useState(false);

    const rootRef =
      useRef<HTMLDivElement>(null);

    useEffect(() => {
      const refresh = () =>
        setBrokers(
          store
            .getBrokers()
            .filter(
              broker =>
                broker.status ===
                'Active'
            )
        );

      refresh();
      return store.subscribe(refresh);
    }, []);

    useEffect(() => {
      const handleOutside =
        (event: MouseEvent) => {
          if (
            rootRef.current &&
            !rootRef.current.contains(
              event.target as Node
            )
          ) {
            setOpen(false);
          }
        };

      document.addEventListener(
        'mousedown',
        handleOutside
      );

      return () =>
        document.removeEventListener(
          'mousedown',
          handleOutside
        );
    }, []);

    const selected =
      brokers.find(
        broker =>
          broker.id ===
          value
      );

    const filtered =
      useMemo(() => {
        const normalized =
          query
            .trim()
            .toLowerCase();

        if (!normalized) {
          return brokers.slice(0, 100);
        }

        return brokers
          .filter(
            broker =>
              [
                broker.companyName,
                broker.licenseNumber,
                broker.city,
              ]
                .join(' ')
                .toLowerCase()
                .includes(
                  normalized
                )
          )
          .slice(0, 100);
      }, [brokers, query]);

    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setOpen(previous => !previous)
          }
          className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-xs shadow-sm transition hover:border-blue-300 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <span
            className={
              selected
                ? 'truncate font-semibold text-gray-900'
                : 'truncate text-gray-400'
            }
          >
            {selected?.companyName || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>

        {open && !disabled && (
          <div className="absolute z-[70] mt-1 w-full min-w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={event =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Ketik nama broker, nomor izin, atau kota..."
                  className="h-9 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-gray-400">
                  Broker tidak ditemukan.
                </div>
              ) : (
                filtered.map(broker => (
                  <button
                    key={broker.id}
                    type="button"
                    onClick={() => {
                      onChange(broker);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-blue-50"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                      {value === broker.id && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-gray-900">
                        {broker.companyName}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-gray-500">
                        {broker.licenseNumber || 'Nomor izin tidak tersedia'}
                        {broker.city ? ` • ${broker.city}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
              {brokers.length} broker aktif tersedia • baseline OJK Triwulan III 2025
            </div>
          </div>
        )}
      </div>
    );
  };

export default BrokerCombobox;
