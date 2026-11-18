import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { MasOverride, MasResults, MasSourceDetail } from "@/utils/weeklyMasChartEngine";
import { readMasQuotationDetails, type MasDetailFilter, type MasDetailPage, type MasUpload } from "@/services/weeklyMasChartService";

export type MasDrillTarget = MasDetailFilter & { metric:"cases"|"premium"; title?:string };
const DrillContext = createContext<{ open:(v:MasDrillTarget)=>void } | null>(null);
const fmt=(v:number)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(v);
const money=(v:number)=>"Rp "+fmt(v);
const perPage=50;

export const DrillValue:React.FC<{target:MasDrillTarget;children:React.ReactNode;className?:string}> = ({target,children,className=""})=>{
  const ctx=useContext(DrillContext);
  if(!ctx)return <span>{children}</span>;
  return <button type="button" onClick={()=>ctx.open(target)} title="Klik untuk melihat daftar quotation"
    className={"cursor-pointer rounded-sm text-inherit underline decoration-dotted decoration-blue-400 underline-offset-2 hover:bg-blue-100 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 "+className}>{children}</button>;
};

export const MasDrilldownProvider:React.FC<{
  upload:MasUpload|null;overrides:MasOverride[];results:MasResults;children:React.ReactNode
}> = ({upload,overrides,results,children})=>{
  const [target,setTarget]=useState<MasDrillTarget|null>(null);
  const [offset,setOffset]=useState(0);
  const [page,setPage]=useState<MasDetailPage|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const open=(v:MasDrillTarget)=>{setOffset(0);setError("");setTarget(v);};
  useEffect(()=>{
    if(!target || !upload || upload.details_count===0){setPage(null);setLoading(false);return;}
    let active=true;setLoading(true);setError("");setPage(null);
    readMasQuotationDetails(upload.id,target,offset,perPage)
      .then(data=>{if(active)setPage(data);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:"Gagal membaca rincian.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[target,offset,upload?.id,upload?.details_count]);
  useEffect(()=>{
    if(!target)return;
    const esc=(event:KeyboardEvent)=>{if(event.key==="Escape")setTarget(null);};
    window.addEventListener("keydown",esc);
    return ()=>window.removeEventListener("keydown",esc);
  },[target]);

  const summary=useMemo(()=>{
    if(!target)return null;
    const matches=(x:{unit:string;segment:string;product:string;status?:string})=>
      (!target.unit||x.unit===target.unit)&&(!target.segment||x.segment===target.segment)&&
      (!target.product||x.product.toLowerCase()===target.product.toLowerCase())&&
      (!target.status||x.status===target.status);
    const records=(target.status?results.statuses:results.groups).filter(matches);
    const source=(upload?.aggregates||[]).filter(matches);
    const field=target.metric==="premium"?"premium":"cases";
    const final=records.reduce((n,x)=>n+x[field],0);
    const base=source.reduce((n,x)=>n+x[field],0);
    const related=overrides.filter(o=>
      (!target.unit||o.unit===target.unit)&&(!target.segment||o.business_type===target.segment)&&
      (!target.product||o.product.toLowerCase()===target.product.toLowerCase())&&
      (!target.status||o.status===target.status||o.status==="ALL"));
    return {final,base,difference:final-base,related};
  },[target,results,upload,overrides]);
  const label=target?[target.title||"Detail Quotation",target.product,target.unit,target.segment,target.status].filter(Boolean).join(" · "):"";
  const metric=(value:number)=>target?.metric==="premium"?money(value):fmt(value)+" case";
  return <DrillContext.Provider value={{open}}>
    {children}
    {target&&<div className="mas-drilldown-modal fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/65 p-2 sm:p-5"
      onMouseDown={e=>{if(e.target===e.currentTarget)setTarget(null);}}>
      <div role="dialog" aria-modal="true" aria-label={label} className="flex max-h-[94vh] w-full max-w-[1200px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-2 bg-[#17487d] px-4 py-4 text-white sm:px-6">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Weekly Marketing Review · Rincian Angka</p><h3 className="mt-1 text-lg font-extrabold">{label}</h3></div>
          <button type="button" onClick={()=>setTarget(null)} aria-label="Tutup rincian" className="rounded-md p-2 hover:bg-white/20"><X className="h-5 w-5"/></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          {summary&&<div className="mb-4 grid gap-2 sm:grid-cols-3">
            {([{label:"Nilai final CHART",amount:summary.final,cls:"border-blue-200 bg-blue-50"},{label:"Hasil baris Excel",amount:summary.base,cls:"border-slate-200 bg-slate-50"},{label:"Selisih / manual",amount:summary.difference,cls:"border-amber-200 bg-amber-50"}]).map(x=><div key={x.label} className={"rounded-lg border p-3 "+x.cls}>
              <p className="text-xs font-semibold text-slate-600">{x.label}</p><p className="mt-1 text-lg font-black text-[#173f73]">{metric(x.amount)}</p>
            </div>)}
          </div>}
          {!upload&&<p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Belum ada sumber Excel; angka ini berasal dari penyesuaian manual.</p>}
          {upload&&upload.details_count===0&&<p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <b>Snapshot ini belum memuat nama perusahaan.</b> MAS perlu upload ulang workbook DATA CAPTIVE dan DATA CRM untuk periode yang sama. Angka CHART tidak perlu dihapus terlebih dahulu.
          </p>}
          {upload&&upload.details_count>0&&<>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-[#153f73]">Sumber: {upload.source_filename}</p>
              <p className="text-xs text-slate-600">{page?fmt(page.total)+" record yang cocok":"Memuat detail..."}</p>
            </div>
            {loading&&<p className="p-6 text-center text-sm text-slate-500">Memuat detail quotation...</p>}
            {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
            {page&&!loading&&<div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[1000px] w-full border-collapse text-xs">
                <thead className="bg-[#e8f1fb] text-[#174573]"><tr>{["No.","Nama Perusahaan","Produk","Unit","Tender / Non Tender","Status","Tanggal","NB/RN","Peserta","Premi (Rp)","Marketing"].map(t=><th key={t} className="whitespace-nowrap border-b p-3 text-left">{t}</th>)}</tr></thead>
                <tbody>{page.items.map((x:MasSourceDetail,i)=><tr key={x.source_sheet+"-"+x.source_row} className={i%2?"bg-slate-50":"bg-white"}>
                  <td className="p-3">{offset+i+1}</td><td className="min-w-[180px] p-3 font-semibold">{x.company_name}</td><td className="p-3">{x.product}</td>
                  <td className="p-3">{x.unit}</td><td className="p-3">{x.segment}</td><td className="p-3">{x.status}</td>
                  <td className="whitespace-nowrap p-3">{x.quotation_date||"—"}</td><td className="p-3">{x.nb_rn||"—"}</td>
                  <td className="p-3 text-right">{x.participants||"—"}</td><td className="whitespace-nowrap p-3 text-right">{fmt(x.premium)}</td><td className="p-3">{x.marketing||"—"}</td>
                </tr>)}</tbody>
              </table>
              {!page.items.length&&<p className="p-5 text-center text-xs text-slate-500">Tidak ada baris Excel yang cocok dengan filter ini.</p>}
            </div>}
            {page&&page.total>perPage&&<div className="mt-3 flex items-center justify-end gap-3">
              <button type="button" disabled={offset===0||loading} onClick={()=>setOffset(x=>Math.max(0,x-perPage))} className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs disabled:opacity-40"><ArrowLeft className="h-4 w-4"/>Sebelumnya</button>
              <span className="text-xs text-slate-600">{Math.floor(offset/perPage)+1} / {Math.ceil(page.total/perPage)}</span>
              <button type="button" disabled={loading||offset+perPage>=page.total} onClick={()=>setOffset(x=>x+perPage)} className="flex items-center gap-1 rounded border px-2 py-1.5 text-xs disabled:opacity-40">Berikutnya<ArrowRight className="h-4 w-4"/></button>
            </div>}
          </>}
          {summary&&Math.abs(summary.difference)>(target.metric==="cases"?0:1)&&<p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Angka final berbeda dari data Excel. Selisih bukan otomatis quotation baru atau nama perusahaan tambahan; periksa penyesuaian MAS.
          </p>}
          {summary&&summary.related.length>0&&<div className="mt-4 rounded-lg border border-slate-200 p-3">
            <p className="text-xs font-bold">Penyesuaian manual terkait</p>
            {summary.related.map(x=><p key={x.id} className="mt-2 border-t pt-2 text-xs text-slate-600">
              {x.product} · {x.unit} · {x.business_type} · {x.status} · {x.method==="REPLACE"?"Ganti Total":"Tambah Selisih"} · {x.reason}
              {" · Case: "+(x.cases===null?"—":fmt(x.cases))+" · Premi: "+(x.premium===null?"—":money(x.premium))}
            </p>)}
          </div>}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500 sm:px-6">
          <span>Data internal Marketing Support, sesuai sumber Excel MAS.</span>
          <button type="button" onClick={()=>setTarget(null)} className="rounded-lg bg-[#17487d] px-4 py-2 font-bold text-white">Tutup</button>
        </div>
      </div>
    </div>}
  </DrillContext.Provider>;
};
