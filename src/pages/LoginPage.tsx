import React, {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  supabase,
} from "@/lib/supabase";
import {
  useAuth,
} from "@/contexts/AuthContext";
import {
  Button,
} from "@/components/ui/button";
import {
  Input,
} from "@/components/ui/input";
import {
  ArrowLeft,
  KeyRound,
  Mail,
} from "lucide-react";

const LoginPage:
  React.FC = () => {
    const {
      session,
      profile,
      loading,
    } = useAuth();

    const navigate =
      useNavigate();

    const location =
      useLocation();

    const [
      mode,
      setMode,
    ] =
      useState<
        "LOGIN" |
        "FORGOT"
      >("LOGIN");

    const [
      email,
      setEmail,
    ] =
      useState("");

    const [
      password,
      setPassword,
    ] =
      useState("");

    const [
      busy,
      setBusy,
    ] =
      useState(false);

    const [
      error,
      setError,
    ] =
      useState("");

    const [
      message,
      setMessage,
    ] =
      useState("");

    const from =
      (
        location.state as
          {
            from?:
              string;
          } |
          null
      )?.from ||
      "/";

    useEffect(
      () => {
        if (
          !loading &&
          session &&
          profile
        ) {
          navigate(
            from,
            {
              replace:
                true,
            }
          );
        }
      },
      [
        loading,
        session,
        profile,
        from,
        navigate,
      ]
    );

    if (
      !loading &&
      session &&
      profile
    ) {
      return (
        <Navigate
          to={from}
          replace
        />
      );
    }

    const normalizeEmail =
      () =>
        email
          .trim()
          .toLowerCase();

    const validateEmail =
      () => {
        const normalizedEmail =
          normalizeEmail();

        if (
          !normalizedEmail.endsWith(
            "@pertalife.com"
          )
        ) {
          setError(
            "Gunakan email perusahaan @pertalife.com."
          );
          return null;
        }

        return normalizedEmail;
      };

    const handleLogin =
      async (
        event:
          React.FormEvent
      ) => {
        event.preventDefault();

        setError("");
        setMessage("");

        const normalizedEmail =
          validateEmail();

        if (
          !normalizedEmail
        ) {
          return;
        }

        if (
          !password
        ) {
          setError(
            "Password wajib diisi."
          );
          return;
        }

        setBusy(
          true
        );

        const {
          error:
            loginError,
        } =
          await supabase
            .auth
            .signInWithPassword({
              email:
                normalizedEmail,
              password,
            });

        setBusy(
          false
        );

        if (
          loginError
        ) {
          setError(
            "Email atau password tidak sesuai."
          );
          return;
        }

        navigate(
          from,
          {
            replace:
              true,
          }
        );
      };

    const handleForgotPassword =
      async (
        event:
          React.FormEvent
      ) => {
        event.preventDefault();

        setError("");
        setMessage("");

        const normalizedEmail =
          validateEmail();

        if (
          !normalizedEmail
        ) {
          return;
        }

        setBusy(
          true
        );

        const redirectTo =
          `${window.location.origin}/set-password`;

        const {
          error:
            resetError,
        } =
          await supabase
            .auth
            .resetPasswordForEmail(
              normalizedEmail,
              {
                redirectTo,
              }
            );

        setBusy(
          false
        );

        if (
          resetError
        ) {
          console.error(
            "Password recovery request gagal:",
            resetError
          );

          setError(
            "Permintaan reset password belum dapat diproses. Coba beberapa saat lagi atau hubungi System Admin."
          );
          return;
        }

        // Deliberately generic to avoid revealing whether an email exists.
        setMessage(
          "Jika email tersebut terdaftar sebagai akun aktif, link reset password akan dikirim ke email perusahaan. Cek Inbox dan Spam/Junk."
        );
      };

    const switchMode =
      (
        next:
          "LOGIN" |
          "FORGOT"
      ) => {
        setMode(
          next
        );
        setError("");
        setMessage("");
        setPassword("");
      };

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-white p-7 shadow-2xl">
          <div className="mb-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-xl font-black text-white">
              P
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              Dashboard Marketing PertaLife
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {mode ===
              "LOGIN"
                ? "Masuk menggunakan akun perusahaan yang sudah diaktifkan."
                : "Minta link reset password ke email perusahaan Anda."}
            </p>
          </div>

          {mode ===
          "LOGIN" ? (
            <form
              onSubmit={
                handleLogin
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Email PertaLife
                </label>

                <Input
                  type="email"
                  autoComplete="email"
                  value={
                    email
                  }
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="nama@pertalife.com"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      switchMode(
                        "FORGOT"
                      )
                    }
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    Lupa Password?
                  </button>
                </div>

                <Input
                  type="password"
                  autoComplete="current-password"
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
                  placeholder="Password dashboard"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  busy
                }
              >
                {busy
                  ? "Memproses..."
                  : "Masuk"}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={
                handleForgotPassword
              }
              className="space-y-4"
            >
              <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />

                <div className="text-xs leading-5 text-blue-800">
                  Masukkan email PertaLife yang digunakan untuk login. Sistem akan mengirim link untuk membuat password baru.
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">
                  Email PertaLife
                </label>

                <Input
                  type="email"
                  autoComplete="email"
                  value={
                    email
                  }
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="nama@pertalife.com"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700">
                  {message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  busy
                }
              >
                <KeyRound className="mr-2 h-4 w-4" />

                {busy
                  ? "Mengirim..."
                  : "Kirim Link Reset Password"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={
                  busy
                }
                onClick={() =>
                  switchMode(
                    "LOGIN"
                  )
                }
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali ke Login
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  };

export default LoginPage;
