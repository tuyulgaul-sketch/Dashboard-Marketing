import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

type Enrollment = { id:string; qr:string; secret:string };
type Verified = { id:string; friendly_name?:string };
const formatError = (error:unknown) =>
  error instanceof Error ? error.message : "Verifikasi keamanan gagal. Coba lagi.";

export const MfaSecurityDialog:React.FC<{open:boolean;onOpenChange:(value:boolean)=>void}> =
({open,onOpenChange})=>{
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [verified,setVerified]=useState<Verified[]>([]);
  const [enrollment,setEnrollment]=useState<Enrollment|null>(null);
  const [code,setCode]=useState("");

  useEffect(()=>{
    if(!open){
      setEnrollment(null);setCode("");setMessage("");setError("");
      return;
    }
    let active=true;
    setBusy(true);
    void supabase.auth.mfa.listFactors().then(({data,error})=>{
      if(!active)return;
      if(error)throw error;
      setVerified((data?.totp||[]).filter(f=>f.status==="verified").map(f=>({
        id:f.id,friendly_name:f.friendly_name
      })));
    }).catch(err=>{if(active)setError(formatError(err));})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[open]);

  const start = async()=>{
    setBusy(true);setError("");setMessage("");
    try {
      const {data,error}=await supabase.auth.mfa.enroll({
        factorType:"totp",friendlyName:"Dashboard Marketing PertaLife"
      });
      if(error)throw error;
      if(!data.totp?.qr_code)throw new Error("QR MFA tidak tersedia. Coba ulang.");
      setEnrollment({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
      setCode("");
    }catch(err){setError(formatError(err));}
    finally{setBusy(false);}
  };

  const verify=async()=>{
    if(!enrollment||!/^[0-9]{6}$/.test(code.trim())){
      setError("Masukkan 6 angka dari aplikasi authenticator.");return;
    }
    setBusy(true);setError("");setMessage("");
    try {
      const {error}=await supabase.auth.mfa.challengeAndVerify({
        factorId:enrollment.id,code:code.trim()
      });
      if(error)throw error;
      setVerified(v=>[...v,{id:enrollment.id,friendly_name:"Dashboard Marketing PertaLife"}]);
      setEnrollment(null);setCode("");
      setMessage("MFA berhasil diaktifkan. Login berikutnya memerlukan kode authenticator.");
    }catch(err){setError(formatError(err));}
    finally{setBusy(false);}
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700"/> Keamanan Akun · Autentikasi Dua Faktor</DialogTitle>
        <DialogDescription>
          Lindungi akun dengan kode enam digit dari aplikasi Google Authenticator, Microsoft Authenticator, atau aplikasi TOTP lain.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900">
          {verified.length>0
            ? <p><strong>MFA aktif.</strong> {verified.length} authenticator terverifikasi pada akun ini.</p>
            : <p><strong>MFA belum aktif.</strong> Aktifkan segera, terutama untuk akun yang memiliki akses administratif.</p>}
        </div>
        {verified.length>0&&<div className="space-y-1">
          {verified.map(f=><div className="flex items-center gap-2 text-emerald-800" key={f.id}>
            <ShieldCheck className="h-4 w-4"/> {f.friendly_name||"Authenticator terverifikasi"}
          </div>)}
        </div>}
        {enrollment ? <div className="space-y-3">
          <p className="font-semibold">1. Scan QR berikut di aplikasi authenticator.</p>
          <img src={enrollment.qr} alt="QR pendaftaran authenticator" className="mx-auto h-52 w-52 rounded-lg border bg-white p-2" />
          <p className="break-all rounded border bg-slate-50 p-2 text-xs">
            Kode manual (simpan rahasia): <strong>{enrollment.secret}</strong>
          </p>
          <p className="font-semibold">2. Masukkan kode 6 digit yang muncul di aplikasi.</p>
          <Input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="000000" aria-label="Kode authenticator 6 digit" />
          <Button type="button" className="w-full" disabled={busy||code.length!==6} onClick={verify}>
            {busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null} Verifikasi & Aktifkan MFA
          </Button>
          <p className="text-xs text-slate-600">
            Supabase tidak menyediakan recovery code. Daftarkan authenticator cadangan setelah yang pertama aktif. Jangan bagikan QR atau kode manual kepada siapa pun.
          </p>
        </div> :
        <Button type="button" variant={verified.length?"outline":"default"} className="w-full" disabled={busy} onClick={start}>
          {busy?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}
          {verified.length?"Tambah authenticator cadangan":"Aktifkan MFA"}
        </Button>}
        {error&&<p role="alert" className="flex gap-2 rounded-lg bg-red-50 p-3 text-red-700"><ShieldAlert className="h-4 w-4 shrink-0"/>{error}</p>}
        {message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-emerald-800">{message}</p>}
      </div>
    </DialogContent>
  </Dialog>;
};
