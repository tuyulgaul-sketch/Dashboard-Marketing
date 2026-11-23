import React, { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { MfaSecurityDialog } from "@/components/auth/MfaSecurityDialog";

type Stage = "checking" | "ready" | "challenge" | "enroll" | "error";
type Factor = { id: string; friendly_name?: string };

type Props = {
  session: Session;
  signOut: () => Promise<void>;
  onVerified: () => Promise<void>;
  requireMfa?: boolean;
  children: React.ReactNode;
};

/**
 * The AAL1 profile may render this MFA challenge, but protected content
 * cannot mount until AAL2 has been verified and its runtime is initialized.
 */
export const MfaSessionGuard: React.FC<Props> = ({
  session,
  signOut,
  onVerified,
  requireMfa = false,
  children,
}) => {
  const [stage, setStage] = useState<Stage>("checking");
  const [factor, setFactor] = useState<Factor | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // An AAL2 token update can rerun the session-check effect while the
  // verification promise is still initializing the dashboard.
  const verificationInFlight = useRef(false);
  const mfaWasAccepted = useRef(false);
  const bootstrapComplete = useRef(false);
  const lastAutoAttempt = useRef("");

  useEffect(() => {
    let active = true;
    setStage("checking");
    setFactor(null);
    setError("");
    setCode("");
    lastAutoAttempt.current = "";

    void (async () => {
      const [
        { data: aal, error: aalError },
        { data: factors, error: factorsError },
      ] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      if (aalError) throw aalError;
      if (factorsError) throw factorsError;
      if (!active) return;

      const verified = (factors?.totp || []).filter(
        candidate => candidate.status === "verified"
      );
      if (aal?.currentLevel === "aal2") {
        // The explicit post-code bootstrap takes precedence. Never unlock
        // the page in the middle of a password -> MFA token transition.
        if (!verificationInFlight.current &&
            (!mfaWasAccepted.current || bootstrapComplete.current)) {
          setStage("ready");
        }
        return;
      }

      if (verified.length === 0) {
        // Admins must enroll a new MFA factor before receiving any admin UI,
        // including after an authorized lost-device recovery.
        setStage(requireMfa ? "enroll" : "ready");
        return;
      }

      setFactor({
        id: verified[0].id,
        friendly_name: verified[0].friendly_name,
      });
      setStage("challenge");
    })().catch(err => {
      if (!active) return;
      setError(
        err instanceof Error
          ? err.message
          : "Tidak dapat memeriksa keamanan sesi."
      );
      setStage("error");
    });

    return () => { active = false; };
  }, [session.user.id, session.access_token, retry, requireMfa]);

  const verify = useCallback(async (candidate: string) => {
    if (verificationInFlight.current) return;
    const normalized = candidate.trim();
    if (!factor || !/^[0-9]{6}$/.test(normalized)) {
      setError("Isi kode 6 angka dari authenticator.");
      return;
    }

    verificationInFlight.current = true;
    setBusy(true);
    setError("");
    let challengeAccepted = false;

    try {
      const { error: challengeError } =
        await supabase.auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: normalized,
        });
      if (challengeError) throw challengeError;
      challengeAccepted = true;
      mfaWasAccepted.current = true;
      setStage("checking");
      // Hydrates the verified profile explicitly: do not wait for a token
      // refresh callback or require users to refresh the browser.
      await onVerified();
      bootstrapComplete.current = true;
      setCode("");
      setStage("ready");
    } catch (err) {
      if (challengeAccepted) {
        setError(
          "Kode berhasil diverifikasi, tetapi dashboard belum selesai dimuat. " +
          (err instanceof Error ? err.message : "Silakan coba muat sesi kembali.")
        );
        setStage("error");
      } else {
        // Clearing the input lets the next six digits auto-submit normally.
        setCode("");
        lastAutoAttempt.current = "";
        setError(
          err instanceof Error
            ? "Kode salah atau kedaluwarsa. Masukkan kode terbaru dari authenticator."
            : "Kode authenticator tidak valid."
        );
        setStage("challenge");
      }
    } finally {
      verificationInFlight.current = false;
      setBusy(false);
    }
  }, [factor, onVerified]);

  // Automatically verify on the sixth digit, including pasted/autofilled
  // codes. A synchronous ref prevents duplicate requests from rerenders.
  useEffect(() => {
    if (stage !== "challenge" || !factor || code.length !== 6 || busy) return;
    if (lastAutoAttempt.current === code) return;
    lastAutoAttempt.current = code;
    void verify(code);
  }, [busy, code, factor, stage, verify]);

  const retryReadySession = async () => {
    if (verificationInFlight.current) return;
    verificationInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onVerified();
      bootstrapComplete.current = true;
      setStage("ready");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Dashboard belum berhasil dimuat. Silakan coba kembali."
      );
      setStage("error");
    } finally {
      verificationInFlight.current = false;
      setBusy(false);
    }
  };

  if (stage === "ready") return <>{children}</>;

  if (stage === "enroll") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
        <div className="max-w-lg text-center text-sm text-white">
          Akun administrator wajib mendaftarkan MFA baru sebelum mengakses Dashboard Marketing.
        </div>
        <MfaSecurityDialog
          open={true}
          recoveryMode
          onOpenChange={open => { if (!open) void signOut(); }}
          onEnrolled={async () => {
            verificationInFlight.current = true;
            mfaWasAccepted.current = true;
            setStage("checking");
            setError("");
            try {
              await onVerified();
              bootstrapComplete.current = true;
              setStage("ready");
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Sesi administrator belum berhasil dimuat. Silakan coba kembali."
              );
              setStage("error");
            } finally {
              verificationInFlight.current = false;
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        <ShieldCheck className="h-9 w-9 text-blue-800" />
        <h1 className="text-xl font-bold text-slate-900">
          Verifikasi Keamanan Dashboard
        </h1>

        {stage === "checking" ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {verificationInFlight.current
              ? "Memverifikasi kode dan menyiapkan dashboard..."
              : "Memeriksa autentikasi dua faktor..."}
          </p>
        ) : stage === "challenge" ? (
          <>
            <p className="text-sm text-slate-600">
              Masukkan kode 6 digit dari aplikasi authenticator. Sistem akan
              memverifikasi dan masuk otomatis setelah digit keenam.
            </p>
            <label htmlFor="mfa-code" className="block text-sm font-semibold">
              Kode authenticator
            </label>
            <input
              id="mfa-code"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={event => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                if (next.length < 6) lastAutoAttempt.current = "";
                setCode(next);
              }}
              onKeyDown={event => {
                if (event.key === "Enter" && code.length === 6) {
                  event.preventDefault();
                  void verify(code);
                }
              }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-xl tracking-[0.4em]"
              placeholder="000000"
              aria-label="Kode authenticator 6 digit"
            />
            <button
              type="button"
              onClick={() => void verify(code)}
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-blue-800 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Memverifikasi..." : "Verifikasi & Masuk"}
            </button>
          </>
        ) : (
          <>
            <p role="alert" className="text-sm text-red-700">
              {error || "Pemeriksaan sesi gagal."}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (mfaWasAccepted.current) {
                  void retryReadySession();
                } else {
                  setRetry(value => value + 1);
                }
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {busy ? "Memuat..." : "Coba Periksa Ulang"}
            </button>
          </>
        )}

        {error && stage === "challenge" && (
          <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-slate-600 underline"
          onClick={() => void signOut()}
        >
          <LogOut className="h-4 w-4" />
          Keluar dari akun
        </button>
      </div>
    </div>
  );
};
