import React, { useEffect, useState } from "react";
import { ShieldCheck, LogOut, Loader2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Stage = "checking"|"ready"|"challenge"|"error";
type Factor = {id:string;friendly_name?:string};

export const MfaSessionGuard:React.FC<{
  session:Session; signOut:()=>Promise<void>; children:React.ReactNode
}> = ({session,signOut,children})=>{
  const [stage,setStage]=useState<Stage>("checking");
  const [factor,setFactor]=useState<Factor|null>(null);
  const [code,setCode]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);

  useEffect(()=>{
    let active=true;
    setStage("checking");setFactor(null);setError("");setCode("");
    void (async()=>{
      // If a user has enrolled a verified TOTP factor, their password-only
      // session MUST NOT mount the protected dashboard UI.
      const [{data:aal,error:aalError},{data:factors,error:factorsError}]=await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors()
      ]);
      if(aalError)throw aalError;
      if(factorsError)throw factorsError;
      if(!active)return;
      const verified=(factors?.totp||[]).filter(f=>f.status==="verified");
      if(verified.length===0){
        setStage("ready");return;
      }
      if(aal?.currentLevel==="aal2"){
        setStage("ready");return;
      }
      setFactor({id:verified[0].id,friendly_name:verified[0].friendly_name});
      setStage("challenge");
    })().catch(err=>{
      if(active){setError(err instanceof Error?err.message:"Tidak dapat memeriksa keamanan sesi.");setStage("error");}
    });
    return()=>{active=false;};
  },[session.user.id,session.access_token,retry]);

  const verify=async()=>{
    if(!factor||!/^[0-9]{6}$/.test(code.trim())){
      setError("Isi kode 6 angka dari authenticator.");return;
    }
    setBusy(true);setError("");
    try{
      const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor.id,code:code.trim()});
      if(error)throw error;
      // Supabase publishes the upgraded aal2 session on auth state change.
      setCode("");setStage("ready");
    }catch(err){setError(err instanceof Error?err.message:"Kode tidak valid.");}
    finally{setBusy(false);}
  };

  if(stage==="ready")return <>{children}</>;
  return <div className="min-h-screen bg-slate-950 px-4 py-12 flex items-center justify-center">
    <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
      <ShieldCheck className="h-9 w-9 text-blue-800"/>
      <h1 className="text-xl font-bold text-slate-900">Verifikasi Keamanan Dashboard</h1>
      {stage==="checking"?
        <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/> Memeriksa autentikasi dua faktor...</p>
        : stage==="challenge"?
        <>
          <p className="text-sm text-slate-600">Akun ini memiliki authenticator aktif. Masukkan kode 6 digit untuk melanjutkan login.</p>
          <label htmlFor="mfa-code" className="block text-sm font-semibold">Kode authenticator</label>
          <input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            onKeyDown={e=>{if(e.key==="Enter")void verify();}}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-xl tracking-[0.4em]"
            placeholder="000000"/>
          <button type="button" onClick={()=>void verify()} disabled={busy||code.length!==6}
            className="w-full rounded-lg bg-blue-800 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy?"Memverifikasi...":"Verifikasi & Masuk"}
          </button>
        </> :
        <><p className="text-sm text-red-700">{error||"Pemeriksaan sesi gagal."}</p>
          <button onClick={()=>setRetry(x=>x+1)} type="button"
            className="w-full rounded-lg border px-3 py-2 text-sm font-semibold">Coba Periksa Ulang</button></>}
      {error&&stage==="challenge"&&<p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <button type="button" className="flex items-center gap-2 text-sm text-slate-600 underline"
        onClick={()=>void signOut()}><LogOut className="h-4 w-4"/> Keluar dari akun</button>
    </div>
  </div>;
};
