import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react";

const APP_TITLE =
  "Dashboard Marketing PertaLife";

type AlertTone =
  | "success"
  | "warning"
  | "error"
  | "info";

type BrandedAlertState = {
  message: string;
  tone: AlertTone;
  key: number;
};

const resolveAlertTone = (
  message: string
): AlertTone => {
  const value =
    message.trim().toLowerCase();

  if (
    [
      "gagal",
      "error",
      "ditolak",
      "tidak ditemukan",
      "tidak diizinkan",
      "tidak dapat",
      "tidak tersedia",
      "failed",
    ].some((keyword) =>
      value.includes(keyword)
    )
  ) {
    return "error";
  }

  if (
    [
      "wajib",
      "harus",
      "pilih",
      "minimal",
      "warning",
      "peringatan",
      "belum",
      "bentrok",
      "tidak boleh",
    ].some((keyword) =>
      value.includes(keyword)
    )
  ) {
    return "warning";
  }

  if (
    [
      "berhasil",
      "sukses",
      "selesai",
      "disetujui",
      "tersimpan",
      "terkirim",
      "aktif",
    ].some((keyword) =>
      value.includes(keyword)
    )
  ) {
    return "success";
  }

  return "info";
};

const TONE_CONFIG = {
  success: {
    icon: CheckCircle2,
    iconClass:
      "text-emerald-600",
    iconBg:
      "bg-emerald-50 ring-emerald-100",
    accent:
      "border-emerald-200",
  },
  warning: {
    icon: AlertTriangle,
    iconClass:
      "text-amber-600",
    iconBg:
      "bg-amber-50 ring-amber-100",
    accent:
      "border-amber-200",
  },
  error: {
    icon: XCircle,
    iconClass:
      "text-red-600",
    iconBg:
      "bg-red-50 ring-red-100",
    accent:
      "border-red-200",
  },
  info: {
    icon: Info,
    iconClass:
      "text-blue-600",
    iconBg:
      "bg-blue-50 ring-blue-100",
    accent:
      "border-blue-200",
  },
} satisfies Record<
  AlertTone,
  {
    icon: typeof Info;
    iconClass: string;
    iconBg: string;
    accent: string;
  }
>;

const NativeAlertBridge:
  React.FC = () => {
    const [
      alertState,
      setAlertState,
    ] =
      useState<BrandedAlertState | null>(
        null
      );

    const dismissTimerRef =
      useRef<number | null>(null);

    useEffect(() => {
      const originalAlert =
        window.alert.bind(window);

      const clearDismissTimer =
        () => {
          if (
            dismissTimerRef.current !==
            null
          ) {
            window.clearTimeout(
              dismissTimerRef.current
            );
            dismissTimerRef.current =
              null;
          }
        };

      window.alert = (
        message?: unknown
      ) => {
        const text =
          String(
            message ?? ""
          ).trim() ||
          "Informasi tersedia.";

        clearDismissTimer();

        setAlertState({
          message: text,
          tone:
            resolveAlertTone(text),
          key: Date.now(),
        });

        dismissTimerRef.current =
          window.setTimeout(() => {
            setAlertState(null);
            dismissTimerRef.current =
              null;
          }, 3500);
      };

      return () => {
        clearDismissTimer();
        window.alert =
          originalAlert;
      };
    }, []);

    if (!alertState) {
      return null;
    }

    const config =
      TONE_CONFIG[
        alertState.tone
      ];
    const Icon =
      config.icon;

    return (
      <div
        key={alertState.key}
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/20 px-4 backdrop-blur-[1px]"
        role="status"
        aria-live="assertive"
      >
        <div
          className={`w-full max-w-xl rounded-3xl border bg-white px-8 py-8 shadow-2xl ${config.accent}`}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ring-8 ${config.iconBg}`}
            >
              <Icon
                className={`h-10 w-10 ${config.iconClass}`}
                strokeWidth={2.3}
              />
            </div>

            <div className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">
              {APP_TITLE}
            </div>

            <div className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-600 sm:text-base">
              {alertState.message}
            </div>

            <div className="mt-6 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-full animate-pulse rounded-full bg-slate-300" />
            </div>

            <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Menutup otomatis
            </div>
          </div>
        </div>
      </div>
    );
  };

export default NativeAlertBridge;
