import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute: React.FC<{
  children: React.ReactElement;
}> = ({ children }) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
          Memeriksa sesi login...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            Akses dashboard belum tersedia
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Akun berhasil login, tetapi tidak ditemukan profile aktif yang terhubung
            dengan akun ini.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
