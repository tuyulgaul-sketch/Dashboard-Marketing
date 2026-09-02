import { useEffect } from "react";
import { toast } from "sonner";

const APP_TITLE = "Dashboard Marketing PertaLife";

type AlertTone =
  | "success"
  | "warning"
  | "error"
  | "info";

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

const showBrandedAlert = (
  message?: unknown
) => {
  const description =
    String(message ?? "").trim() ||
    "Informasi tersedia.";

  const options = {
    description,
    duration: 5500,
  };

  const tone =
    resolveAlertTone(description);

  if (tone === "success") {
    toast.success(
      APP_TITLE,
      options
    );
    return;
  }

  if (tone === "warning") {
    toast.warning(
      APP_TITLE,
      options
    );
    return;
  }

  if (tone === "error") {
    toast.error(
      APP_TITLE,
      options
    );
    return;
  }

  toast.info(
    APP_TITLE,
    options
  );
};

/**
 * Replaces native window.alert across the application with a branded
 * Sonner notification. Existing call sites can keep using alert()/window.alert()
 * without showing "<domain> says:" browser popups.
 */
const NativeAlertBridge:
  React.FC = () => {
    useEffect(() => {
      const originalAlert =
        window.alert.bind(window);

      window.alert = (
        message?: unknown
      ) => {
        showBrandedAlert(
          message
        );
      };

      return () => {
        window.alert =
          originalAlert;
      };
    }, []);

    return null;
  };

export default NativeAlertBridge;
