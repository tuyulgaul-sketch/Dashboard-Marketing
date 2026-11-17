import React, { useMemo } from "react";
import { BarChart3, Boxes, Building2, ClipboardList, Coins, Lightbulb, ShieldCheck, TrendingUp, Users } from "lucide-react";
import type { MasResults } from "@/utils/weeklyMasChartEngine";

type Props = { meetingDate: string; results: MasResults };
type Line = {
 product: string; captive: number; crm: number; cTender: number; cNon: number; rTender: number; rNon: number;
 pcTender: number; pcNon: number; prTender: number; prNon: number; pcTotal: number; prTotal: number; premium: number
};
type Numeric = Exclude<keyof Line, "product">;
const keys: Numeric[] = ["captive","crm","cTender","cNon","captive","rTender","rNon","crm",
 "pcTender","pcNon","pcTotal","prTender","prNon","prTotal","premium"];
const zero = (product: string): Line => ({product,captive:0,crm:0,cTender:0,cNon:0,rTender:0,rNon:0,
 pcTender:0,pcNon:0,prTender:0,prNon:0,pcTotal:0,prTotal:0,premium:0});
const number = (v: number) => new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(v);
const money = (v: number) => "Rp "+number(v);
const short = (v: number) => Math.abs(v)>=1e12 ? "Rp "+(v/1e12).toLocaleString("id-ID",{maximumFractionDigits:2})+" Triliun"
 : Math.abs(v)>=1e9 ? "Rp "+(v/1e9).toLocaleString("id-ID",{maximumFractionDigits:2})+" Miliar" : money(v);
const portion = (a: number,b: number) => b ? (100*a/b).toLocaleString("id-ID",{maximumFractionDigits:1})+"%" : "0%";
const dateText = (value: string) => {
 const p=value.split("-").map(Number);
 if(p.length!==3 || p.some(v=>!Number.isFinite(v)))return value;
 return new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(p[0],p[1]-1,p[2])));
};

const Kpi: React.FC<{label:string;value:string;icon:React.ComponentType<{className?:string}>;tone:string}> =
 ({label,value,icon:Icon,tone})=><div className="flex min-w-0 items-center gap-2 rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
 <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white "+tone}><Icon className="h-5 w-5"/></div>
 <div className="min-w-0"><p className="min-h-7 text-[10px] font-bold leading-3.5 text-[#315589]">{label}</p>
 <p className="mt-1 break-words text-base font-black leading-tight text-[#133d77]">{value}</p></div></div>;

const MasExecutiveSummary: React.FC<Props> = ({meetingDate,results})=>{
 const data=useMemo(()=>{
  const map=new Map<string,Line>();
  for(const x of results.groups){
   const r=map.get(x.product)||zero(x.product);
   if(x.unit==="Captive"){
    r.captive+=x.cases;r.pcTotal+=x.premium;
    if(x.segment==="Tender"){r.cTender+=x.cases;r.pcTender+=x.premium;}
    if(x.segment==="Non Tender"){r.cNon+=x.cases;r.pcNon+=x.premium;}
   }else{
    r.crm+=x.cases;r.prTotal+=x.premium;
    if(x.segment==="Tender"){r.rTender+=x.cases;r.prTender+=x.premium;}
    if(x.segment==="Non Tender"){r.rNon+=x.cases;r.prNon+=x.premium;}
   }
   r.premium+=x.premium;map.set(x.product,r);
  }
  const rows=[...map.values()];
  const total=rows.reduce((acc,row)=>{
   (["captive","crm","cTender","cNon","rTender","rNon","pcTender","pcNon","prTender","prNon","pcTotal","prTotal","premium"] as Numeric[])
    .forEach(key=>{acc[key]+=row[key];});
   return acc;
  },zero("Grand Total"));
  const top=[...rows].filter(x=>x.premium>0).sort((a,b)=>b.premium-a.premium).slice(0,5);
  const missing=results.groups.filter(x=>x.segment==="Unclassified").reduce((acc,x)=>({cases:acc.cases+x.cases,premium:acc.premium+x.premium}),{cases:0,premium:0});
  return {rows,total,top,missing};
 },[results]);
 const {rows,total,top,missing}=data;
 const quotation=total.captive+total.crm;
 const nonTender=total.cNon+total.rNon;
 const leader=top[0];
 const max=Math.max(leader?.premium||0,1);
 const cell=(n:number)=><span>{n===0?"–":number(n)}</span>;
 return <section id="mas-overall-dashboard" className="mas-report mas-overall-dashboard overflow-hidden rounded-2xl border border-blue-200 bg-[#f5faff] p-3 shadow-sm sm:p-5">
 <style>{"@media print {.mas-overall-dashboard {background:white!important;break-after:page;page-break-after:always}.mas-overall-dashboard .mas-overall-scroll{overflow:visible!important}.mas-overall-dashboard .mas-overall-matrix{min-width:0!important;width:100%!important}.mas-overall-dashboard .mas-overall-matrix th,.mas-overall-dashboard .mas-overall-matrix td{padding:2px!important;font-size:5.4px!important}.mas-overall-dashboard .mas-overall-kpis{grid-template-columns:repeat(7,minmax(0,1fr))!important}.mas-overall-dashboard .mas-overall-insights{grid-template-columns:repeat(5,minmax(0,1fr))!important} }"}</style>
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-blue-100 pb-3">
  <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#3377b5]">PertaLife · Marketing Support</p>
   <h2 className="mt-1 text-xl font-black leading-tight text-[#173568] sm:text-[26px]">Dashboard Overall Progress &amp; Proyeksi Premi</h2>
   <p className="mt-1 text-xs font-bold text-[#4b78a5]">Captive vs CRM | Berdasarkan Source Data</p></div>
  <div className="rounded-xl border border-blue-100 bg-white px-4 py-2 text-center text-[#315589]">
   <p className="text-[10px] font-semibold">Periode Data</p><p className="text-xs font-bold">{dateText(meetingDate)}</p></div>
 </div>

 <div className="mas-overall-kpis grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
  <Kpi label="Total Quotation" value={number(quotation)} icon={ClipboardList} tone="bg-[#237cdd]"/>
  <Kpi label="Total Produk" value={number(rows.length)} icon={Boxes} tone="bg-[#2a8bef]"/>
  <Kpi label="Captive Progress Total" value={number(total.captive)} icon={Users} tone="bg-[#1d9f6f]"/>
  <Kpi label="CRM Progress Total" value={number(total.crm)} icon={Building2} tone="bg-[#269e74]"/>
  <Kpi label="Captive Total Proyeksi Premi" value={short(total.pcTotal)} icon={ShieldCheck} tone="bg-[#662ebe]"/>
  <Kpi label="CRM Total Proyeksi Premi" value={short(total.prTotal)} icon={ShieldCheck} tone="bg-[#813acb]"/>
  <Kpi label="Total Proyeksi Premi Keseluruhan" value={short(total.premium)} icon={Coins} tone="bg-[#1b74df]"/>
 </div>

 <div className="mt-3 rounded-xl border border-blue-100 bg-white p-4">
  <h3 className="text-center text-sm font-black text-[#173a72]">Top 5 Produk by Total Proyeksi Premi (Captive + CRM)</h3>
  <div className="mt-4 space-y-2">{top.map((r,i)=><div key={r.product} className="grid grid-cols-[23px_minmax(100px,165px)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[28px_minmax(150px,195px)_minmax(0,1fr)]">
   <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#207de1] text-[10px] font-black text-white">{i+1}</span>
   <span className="truncate text-[11px] font-bold text-[#204679]" title={r.product}>{r.product}</span>
   <div className="relative h-5 overflow-hidden rounded bg-[#f0f6ff]">
    <div className="h-full rounded-r bg-gradient-to-r from-[#3198fb] to-[#1467d9]" style={{width:((100*r.premium/max)+"%")}}/>
    <span className="absolute right-0 top-0 rounded bg-white/95 px-1 text-[10px] font-bold text-[#163a75]">{money(r.premium)}</span>
   </div>
  </div>)}
  {!top.length&&<p className="p-6 text-center text-xs text-slate-500">Belum ada data premi positif.</p>}</div>
  <p className="mt-3 text-right text-[10px] font-semibold text-slate-500">Bar menunjukkan nilai relatif; angka ditampilkan dalam Rupiah</p>
 </div>

 <div className="mas-overall-scroll mt-3 overflow-x-auto rounded-xl border border-blue-100 bg-white">
 <table className="mas-overall-matrix w-full min-w-[1660px] table-fixed border-collapse text-[9px] leading-tight text-slate-800">
  <colgroup><col style={{width:"170px"}}/>{Array.from({length:8},(_,i)=><col key={"q"+i} style={{width:i<2?"64px":"65px"}}/>)}
   {Array.from({length:6},(_,i)=><col key={"p"+i} style={{width:"112px"}}/>)}<col style={{width:"145px"}}/></colgroup>
  <thead>
   <tr className="text-white">
    <th rowSpan={2} className="sticky left-0 z-10 border border-white/40 bg-[#204b83] p-2 text-left">Produk</th>
    <th colSpan={2} className="border border-white/40 bg-[#176bd0] p-2">Quotation</th>
    <th colSpan={3} className="border border-white/40 bg-[#159061] p-2">Captive</th>
    <th colSpan={3} className="border border-white/40 bg-[#159061] p-2">CRM</th>
    <th colSpan={3} className="border border-white/40 bg-[#7132c0] p-2">Captive Total Proyeksi Premi</th>
    <th colSpan={3} className="border border-white/40 bg-[#7132c0] p-2">CRM Total Proyeksi Premi</th>
    <th rowSpan={2} className="border border-white/40 bg-[#204b83] p-2">Total Proyeksi Premi Produk</th>
   </tr>
   <tr>
    {["Captive","CRM"].map(x=><th key={"quote"+x} className="border border-slate-200 bg-[#d5e9ff] p-2 text-[#164d94]">{x}</th>)}
    {["Captive","CRM"].flatMap(unit=>["Tender","Non Tender","Total"].map(t=>
     <th key={unit+t} className="border border-slate-200 bg-[#d5f0e4] p-2 text-[#166447]">{t}</th>))}
    {["Captive","CRM"].flatMap(unit=>["Tender","Non Tender","Total"].map(t=>
     <th key={"prem"+unit+t} className="border border-slate-200 bg-[#ecdeff] p-2 text-[#542996]">{t}</th>))}
   </tr>
  </thead>
  <tbody>
   {rows.map((r,i)=><tr key={r.product} className={i%2?"bg-[#f3f8ff]":"bg-white"}>
    <td className="sticky left-0 z-[1] border border-slate-200 bg-inherit px-2 py-2 font-bold text-[#173568]">{r.product}</td>
    {keys.map((key,j)=><td key={j} className={"whitespace-nowrap border border-slate-200 px-1.5 py-2 text-right tabular-nums "+([4,7,10,13,14].includes(j)?"font-extrabold":"")}>{cell(r[key])}</td>)}
   </tr>)}
   <tr className="bg-[#1b4a86] font-extrabold text-white">
    <td className="sticky left-0 z-[1] border border-white/30 bg-[#1b4a86] p-2">Grand Total</td>
    {keys.map((key,j)=><td key={j} className="whitespace-nowrap border border-white/30 px-1 py-2 text-right tabular-nums">{number(total[key])}</td>)}
   </tr>
  </tbody>
 </table></div>
 {(missing.cases!==0 || Math.abs(missing.premium)>1)&&<p className="mt-2 text-[10px] text-amber-800">
  Catatan: {number(missing.cases)} case dan {money(missing.premium)} belum diklasifikasikan sebagai Tender/Non Tender.
  Nilai itu tetap masuk Total tetapi tidak diasumsikan ke salah satu kategori.</p>}

 <div className="mas-overall-insights mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
  <div className="flex items-center gap-2 rounded-xl bg-[#123f85] p-3 text-white"><Lightbulb className="h-6 w-6 shrink-0"/><b className="text-xs uppercase">Insight Utama</b></div>
  <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white p-3"><Users className="h-6 w-6 shrink-0 text-[#227ee4]"/>
   <p className="text-[11px] leading-5 text-slate-700">Captive membukukan <b>{number(total.captive)} quotation</b> ({portion(total.captive,quotation)} dari total).</p></div>
  <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-white p-3"><BarChart3 className="h-6 w-6 shrink-0 text-[#227ee4]"/>
   <p className="text-[11px] leading-5 text-slate-700">Non Tender mencakup <b>{number(nonTender)} case</b> dari {number(quotation)} quotation ({portion(nonTender,quotation)}).</p></div>
  <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-white p-3"><TrendingUp className="h-6 w-6 shrink-0 text-[#168c64]"/>
   <p className="text-[11px] leading-5 text-slate-700">{leader?<><b>{leader.product}</b> memiliki proyeksi premi tertinggi: <b>{short(leader.premium)}</b>.</>:"Belum ada nilai premi positif."}</p></div>
  <div className="flex items-center gap-2 rounded-xl border border-purple-100 bg-white p-3"><Coins className="h-6 w-6 shrink-0 text-[#8034b8]"/><p className="text-[11px] leading-5 text-slate-700">Total proyeksi premi keseluruhan mencapai <b className="text-[#8034b8]">{short(total.premium)}</b>.</p></div>
 </div>
 <p className="mt-2 text-right text-[10px] font-medium text-slate-500">Berdasarkan data upload dan penyesuaian manual MAS untuk periode yang dipilih.</p>
 </section>;
};
export default MasExecutiveSummary;
