import React, {
  useEffect,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  supabase,
} from "@/lib/supabase";
import {
  KeyRound,
  ShieldCheck,
} from "lucide-react";

const passwordIsValid =
  (
    value:
      string
  ) =>
    value.length >= 12 &&
    /[A-Z]/.test(
      value
    ) &&
    /[a-z]/.test(
      value
    ) &&
    /[0-9]/.test(
      value
    );

const SetPasswordPage:
  React.FC = () => {
    const navigate =
      useNavigate();

    const [
      password,
      setPassword,
    ] =
      useState("");

    const [
      confirmPassword,
      setConfirmPassword,
    ] =
      useState("");

    const [
      ready,
      setReady,
    ] =
      useState(false);

    const [
      checking,
      setChecking,
    ] =
      useState(true);

    const [
      loading,
      setLoading,
    ] =
      useState(false);

    const [
      message,
      setMessage,
    ] =
      useState("");

    const [
      error,
      setError,
    ] =
      useState("");

    useEffect(
      () => {
        let mounted =
          true;

        const applySession =
          (
            session:
              unknown
          ) => {
            if (!mounted) {
              return;
            }

            if (session) {
              setReady(
                true
              );
              setError(
                ""
              );
            }
          };

        const checkSession =
          async () => {
            try {
              const {
                data: {
                  session,
                },
              } =
                await supabase
                  .auth
                  .getSession();

              if (!mounted) {
                return;
              }

              if (session) {
                setReady(
                  true
                );
                setError(
                  ""
                );
              } else {
                setReady(
                  false
                );
                setError(
                  "Sesi reset password tidak ditemukan atau link sudah kedaluwarsa. Minta link baru dari halaman Login."
                );
              }
            } catch {
              if (!mounted) {
                return;
              }

              setReady(
                false
              );
              setError(
                "Gagal memeriksa sesi reset password. Minta link baru dari halaman Login."
              );
            } finally {
              if (mounted) {
                setChecking(
                  false
                );
              }
            }
          };

        void checkSession();

        const {
          data: {
            subscription,
          },
        } =
          supabase
            .auth
            .onAuthStateChange(
              (
                event,
                session
              ) => {
                if (!mounted) {
                  return;
                }

                if (
                  event ===
                    "PASSWORD_RECOVERY" ||
                  event ===
                    "SIGNED_IN" ||
                  event ===
                    "TOKEN_REFRESHED"
                ) {
                  applySession(
                    session
                  );

                  setChecking(
                    false
                  );
                }
              }
            );

        return () => {
          mounted =
            false;

          subscription.unsubscribe();
        };
      },
      []
    );

    const handleSubmit =
      async (
        event:
          React.FormEvent
      ) => {
        event.preventDefault();

        setError("");
        setMessage("");

        if (
          !passwordIsValid(
            password
          )
        ) {
          setError(
            "Password minimal 12 karakter dan wajib memiliki huruf besar, huruf kecil, serta angka."
          );
          return;
        }

        if (
          password !==
          confirmPassword
        ) {
          setError(
            "Konfirmasi password tidak sama."
          );
          return;
        }

        setLoading(
          true
        );

        const {
          error:
            updateError,
        } =
          await supabase
            .auth
            .updateUser({
              password,
            });

        if (
          updateError
        ) {
          setError(
            updateError.message
          );
          setLoading(
            false
          );
          return;
        }

        // End the recovery/activation session so the next access
        // proves the newly created password can actually authenticate.
        try {
          await supabase
            .auth
            .signOut();
        } catch {
          // Password update itself already succeeded.
        }

        setMessage(
          "Password berhasil diperbarui. Mengarahkan kembali ke halaman Login..."
        );

        setLoading(
          false
        );

        window.setTimeout(
          () => {
            navigate(
              "/login",
              {
                replace:
                  true,
              }
            );
          },
          1200
        );
      };

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-800 text-white flex items-center justify-center">
              <KeyRound className="h-6 w-6" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Atur Password Dashboard
            </h1>

            <p className="text-sm text-slate-500 mt-2">
              PT Perta Life Insurance
            </p>
          </div>

          {checking ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              Memeriksa link reset password...
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-700">
                {error}
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/login",
                    {
                      replace:
                        true,
                    }
                  )
                }
                className="w-full h-11 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-lg transition"
              >
                Kembali ke Login
              </button>
            </div>
          ) : (
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5"
            >
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

                <div className="text-xs leading-5 text-emerald-800">
                  Link valid. Buat password baru untuk akun dashboard Anda.
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Password Baru
                </label>

                <input
                  type="password"
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Minimal 12 karakter"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Konfirmasi Password Baru
                </label>

                <input
                  type="password"
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event
                  ) =>
                    setConfirmPassword(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full h-11 px-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                  placeholder="Ulangi password baru"
                  autoComplete="new-password"
                />
              </div>

              <div className="text-[11px] leading-5 text-slate-500">
                Minimal 12 karakter, mengandung huruf besar, huruf kecil, dan angka.
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  {error}
                </div>
              )}

              {message && (
                <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  loading
                }
                className="w-full h-11 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white font-semibold rounded-lg transition"
              >
                {loading
                  ? "Menyimpan..."
                  : "Simpan Password Baru"}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  };

export default SetPasswordPage;
