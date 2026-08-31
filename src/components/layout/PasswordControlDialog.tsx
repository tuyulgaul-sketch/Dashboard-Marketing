import React, { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  changeMyPassword,
  resetAllAccountPasswords,
} from "@/services/passwordService";

const PasswordField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
}> = ({
  value,
  onChange,
  placeholder,
  autoComplete,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-10"
      />

      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

export const PasswordControlDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> = ({ open, onOpenChange }) => {
  const { profile, signOut } = useAuth();

  const isSystemAdmin = Boolean(
    profile &&
      (
        profile.role_level?.trim().toUpperCase() === "SYSTEM_ADMIN" ||
        profile.unit?.trim().toLowerCase() === "administrasi sistem"
      )
  );

  const [mode, setMode] = useState<"SELF" | "ALL">("SELF");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setConfirmationText("");
    setMessage(null);
  };

  useEffect(() => {
    if (!open) {
      setMode("SELF");
      resetForm();
    }
  }, [open]);

  const passwordMatch = Boolean(
    newPassword &&
    newPassword === confirmPassword
  );

  const submitSelf = async () => {
    if (!passwordMatch) {
      setMessage({
        type: "error",
        text: "Konfirmasi password baru tidak sama.",
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      await changeMyPassword(
        currentPassword,
        newPassword
      );

      setMessage({
        type: "success",
        text: "Password berhasil diubah. Session lain akan ditutup jika didukung oleh Auth provider.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Gagal mengubah password.",
      });
    } finally {
      setBusy(false);
    }
  };

  const submitAll = async () => {
    if (!isSystemAdmin) return;

    if (!passwordMatch) {
      setMessage({
        type: "error",
        text: "Konfirmasi password standar tidak sama.",
      });
      return;
    }

    if (confirmationText !== "RESET PASSWORD SEMUA") {
      setMessage({
        type: "error",
        text: "Ketik RESET PASSWORD SEMUA untuk melanjutkan.",
      });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const result =
        await resetAllAccountPasswords(newPassword);

      if (result.failed_accounts > 0) {
        const failedNames = result.failed
          .slice(0, 5)
          .map((item) => item.full_name)
          .join(", ");

        setMessage({
          type: "error",
          text:
            `${result.updated_accounts}/${result.total_accounts} akun berhasil direset. ` +
            `${result.failed_accounts} gagal` +
            `${failedNames ? `: ${failedNames}` : ""}. ` +
            "Akun yang berhasil sudah memakai password baru.",
        });

        return;
      }

      setMessage({
        type: "success",
        text:
          `${result.updated_accounts} akun aktif berhasil direset ke password standar baru. ` +
          "Akun Marchat juga termasuk. Anda akan logout untuk memastikan password baru dapat dipakai.",
      });

      window.setTimeout(async () => {
        await signOut();
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Reset seluruh password gagal.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          onOpenChange(value);
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Pengaturan Password
          </DialogTitle>

          <DialogDescription>
            Kelola password akun dashboard PertaLife.
          </DialogDescription>
        </DialogHeader>

        {isSystemAdmin && (
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("SELF");
                resetForm();
              }}
              className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                mode === "SELF"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Password Saya
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("ALL");
                resetForm();
              }}
              className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                mode === "ALL"
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Reset Semua Akun
            </button>
          </div>
        )}

        {mode === "SELF" ? (
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Password Saat Ini
              </label>
              <PasswordField
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="Password saat ini"
                autoComplete="current-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Password Baru
              </label>
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Konfirmasi Password Baru
              </label>
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </div>

            <div className="text-[11px] leading-5 text-slate-500">
              Minimal 12 karakter, mengandung huruf besar, huruf kecil, dan angka.
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                <div>
                  <div className="text-xs font-black text-rose-800">
                    RESET MASSAL — TERMASUK MARCHAT
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-rose-700">
                    Seluruh akun aktif yang sudah memiliki Supabase Auth akan memakai password yang sama.
                    Gunakan hanya sebagai password standar sementara, karena shared password menurunkan keamanan dan auditability.
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Password Standar Baru
              </label>
              <PasswordField
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Minimal 12 karakter"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Konfirmasi Password Standar
              </label>
              <PasswordField
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Ulangi password standar"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-700">
                Konfirmasi Tindakan
              </label>
              <Input
                value={confirmationText}
                onChange={(event) =>
                  setConfirmationText(event.target.value)
                }
                placeholder="Ketik: RESET PASSWORD SEMUA"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800">
              <Users className="h-4 w-4 shrink-0" />
              Setelah reset, setiap user tetap dapat mengganti password sendiri dari tombol Password di header.
            </div>
          </div>
        )}

        {message && (
          <div
            className={`rounded-lg border p-3 text-xs leading-5 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Tutup
          </Button>

          <Button
            type="button"
            variant={mode === "ALL" ? "destructive" : "default"}
            onClick={mode === "ALL" ? submitAll : submitSelf}
            disabled={
              busy ||
              !newPassword ||
              !confirmPassword ||
              (mode === "SELF" && !currentPassword) ||
              (
                mode === "ALL" &&
                confirmationText !== "RESET PASSWORD SEMUA"
              )
            }
          >
            {busy
              ? "Memproses..."
              : mode === "ALL"
                ? "Reset Seluruh Password"
                : "Ubah Password Saya"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordControlDialog;
