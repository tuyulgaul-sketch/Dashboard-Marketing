import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!mounted) return;

      if (data.session) {
        setReady(true);
      } else {
        setError(
          "Sesi aktivasi tidak ditemukan. Silakan buka kembali link undangan dari email."
        );
      }
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setReady(true);
        setError("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setMessage("Password berhasil dibuat. Mengarahkan ke Dashboard...");

    setTimeout(() => {
      navigate("/", { replace: true });
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-blue-800 text-white flex items-center justify-center font-bold text-xl">
            P
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Aktivasi Dashboard Marketing
          </h1>

          <p className="text-sm text-slate-500 mt-2">
            PT Perta Life Insurance
          </p>
        </div>

        {!ready ? (
          <div className="text-sm text-center text-slate-600">
            Memeriksa link aktivasi...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Password Baru
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Konfirmasi Password
              </label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-600"
                placeholder="Ulangi password"
                autoComplete="new-password"
              />
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
              disabled={loading}
              className="w-full h-11 bg-blue-800 hover:bg-blue-900 disabled:opacity-60 text-white font-semibold rounded-lg transition"
            >
              {loading ? "Menyimpan..." : "Buat Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default SetPasswordPage;
