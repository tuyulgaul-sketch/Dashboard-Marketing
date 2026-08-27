import React, { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const LoginPage: React.FC = () => {
  const { session, profile, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const from =
    (location.state as { from?: string } | null)?.from || "/";

  useEffect(() => {
    if (!loading && session && profile) {
      navigate(from, { replace: true });
    }
  }, [loading, session, profile, from, navigate]);

  if (!loading && session && profile) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith("@pertalife.com")) {
      setError("Gunakan email perusahaan @pertalife.com.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    setBusy(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    setBusy(false);

    if (loginError) {
      setError("Email atau password tidak sesuai.");
      return;
    }

    navigate(from, { replace: true });
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
            Masuk menggunakan akun perusahaan yang sudah diundang.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Email PertaLife
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@pertalife.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            disabled={busy}
          >
            {busy ? "Memproses..." : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
