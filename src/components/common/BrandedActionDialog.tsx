import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Info,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BRANDED_DIALOG_EVENT,
  BrandedDialogEventDetail,
} from "@/lib/brandedDialog";

const APP_TITLE =
  "Dashboard Marketing PertaLife";

const TONE_CONFIG = {
  warning: {
    icon: AlertTriangle,
    iconClass:
      "text-amber-600",
    iconBg:
      "bg-amber-50 ring-amber-100",
    accent:
      "border-amber-200",
    confirmClass:
      "bg-amber-600 text-white hover:bg-amber-700",
  },
  danger: {
    icon: ShieldAlert,
    iconClass:
      "text-red-600",
    iconBg:
      "bg-red-50 ring-red-100",
    accent:
      "border-red-200",
    confirmClass:
      "bg-red-600 text-white hover:bg-red-700",
  },
  info: {
    icon: Info,
    iconClass:
      "text-blue-600",
    iconBg:
      "bg-blue-50 ring-blue-100",
    accent:
      "border-blue-200",
    confirmClass:
      "bg-blue-600 text-white hover:bg-blue-700",
  },
} as const;

const BrandedActionDialog = () => {
  const [
    request,
    setRequest,
  ] =
    useState<BrandedDialogEventDetail | null>(
      null
    );

  const [
    promptValue,
    setPromptValue,
  ] = useState("");

  const activeRequestRef =
    useRef<BrandedDialogEventDetail | null>(
      null
    );

  useEffect(() => {
    const cancelRequest = (
      current:
        BrandedDialogEventDetail | null
    ) => {
      if (!current) {
        return;
      }

      if (
        current.kind ===
        "confirm"
      ) {
        current.resolve(false);
      } else {
        current.resolve(null);
      }
    };

    const handleDialog = (
      event: Event
    ) => {
      const next =
        (
          event as CustomEvent<BrandedDialogEventDetail>
        ).detail;

      if (!next) {
        return;
      }

      cancelRequest(
        activeRequestRef.current
      );

      activeRequestRef.current =
        next;

      setRequest(next);
      setPromptValue(
        next.kind === "prompt"
          ? next.defaultValue || ""
          : ""
      );
    };

    window.addEventListener(
      BRANDED_DIALOG_EVENT,
      handleDialog
    );

    return () => {
      window.removeEventListener(
        BRANDED_DIALOG_EVENT,
        handleDialog
      );

      cancelRequest(
        activeRequestRef.current
      );

      activeRequestRef.current =
        null;
    };
  }, []);

  useEffect(() => {
    if (!request) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [request]);

  const promptIsValid =
    useMemo(() => {
      if (
        !request ||
        request.kind !== "prompt"
      ) {
        return true;
      }

      if (
        request.required &&
        !promptValue.trim()
      ) {
        return false;
      }

      if (
        request.expectedValue !==
          undefined &&
        promptValue !==
          request.expectedValue
      ) {
        return false;
      }

      return true;
    }, [
      promptValue,
      request,
    ]);

  const close = () => {
    activeRequestRef.current =
      null;
    setRequest(null);
    setPromptValue("");
  };

  const cancel = () => {
    const current =
      activeRequestRef.current;

    if (!current) {
      close();
      return;
    }

    if (
      current.kind ===
      "confirm"
    ) {
      current.resolve(false);
    } else {
      current.resolve(null);
    }

    close();
  };

  const confirm = () => {
    const current =
      activeRequestRef.current;

    if (!current) {
      close();
      return;
    }

    if (
      current.kind ===
      "confirm"
    ) {
      current.resolve(true);
      close();
      return;
    }

    if (!promptIsValid) {
      return;
    }

    current.resolve(
      promptValue
    );
    close();
  };

  useEffect(() => {
    if (!request) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        event.preventDefault();
        cancel();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
  }, [request]);

  if (!request) {
    return null;
  }

  const config =
    TONE_CONFIG[
      request.tone ||
        "warning"
    ];

  const Icon =
    config.icon;

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={
        request.heading ||
        "Konfirmasi tindakan"
      }
    >
      <div
        className={`w-full max-w-xl rounded-3xl border bg-white px-6 py-7 shadow-2xl sm:px-8 sm:py-8 ${config.accent}`}
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

          <div className="mt-2 text-base font-bold text-slate-800">
            {request.heading ||
              (request.kind === "prompt"
                ? "Mohon Lengkapi Informasi"
                : "Konfirmasi Tindakan")}
          </div>

          <div className="mt-3 max-w-md whitespace-pre-line text-sm font-medium leading-6 text-slate-600 sm:text-base">
            {request.message}
          </div>
        </div>

        {request.kind ===
          "prompt" && (
          <div className="mt-6">
            {request.multiline ? (
              <Textarea
                autoFocus
                value={promptValue}
                onChange={event =>
                  setPromptValue(
                    event.target.value
                  )
                }
                placeholder={
                  request.placeholder
                }
                className="min-h-28 resize-y"
              />
            ) : (
              <Input
                autoFocus
                value={promptValue}
                onChange={event =>
                  setPromptValue(
                    event.target.value
                  )
                }
                placeholder={
                  request.placeholder
                }
                onKeyDown={event => {
                  if (
                    event.key ===
                      "Enter" &&
                    promptIsValid
                  ) {
                    event.preventDefault();
                    confirm();
                  }
                }}
              />
            )}

            {request.helperText && (
              <div className="mt-2 text-xs font-medium text-slate-500">
                {request.helperText}
              </div>
            )}

            {request.expectedValue !==
              undefined &&
              promptValue !==
                request.expectedValue && (
                <div className="mt-2 text-xs font-semibold text-amber-700">
                  Ketik persis:{" "}
                  <span className="font-black">
                    {request.expectedValue}
                  </span>
                </div>
              )}
          </div>
        )}

        <div className="mt-7 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl font-bold"
            onClick={cancel}
          >
            {request.cancelLabel ||
              "Batal"}
          </Button>

          <Button
            type="button"
            className={`h-11 rounded-xl font-bold ${config.confirmClass}`}
            disabled={!promptIsValid}
            onClick={confirm}
          >
            {request.confirmLabel ||
              "Ya, Lanjutkan"}
          </Button>
        </div>

        <div className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          Tekan Esc untuk batal
        </div>
      </div>
    </div>
  );
};

export default BrandedActionDialog;
