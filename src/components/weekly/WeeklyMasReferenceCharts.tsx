import React, { useMemo } from "react";

import { ClipboardList, Coins, Users, TrendingUp } from "lucide-react";
import type { MasResults, MasStatus, MasUnit } from "@/utils/weeklyMasChartEngine";

type Props = { results: MasResults; meetingDate: string };
type ProductBar = { product: string; Captive: number; CRM: number; Tender: number; "Non Tender": number };
type Breakdown = { unit: MasUnit; cases: number; premium: number };
const BLUE = "#3179c5";
const LIME = "#a4c628";
const money = (n: number) => "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n);
const count = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
const compact = (n: number) => Math.abs(n) >= 1e12
  ? "Rp " + (n / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " T"
  : Math.abs(n) >= 1e9
  ? "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M"
  : money(n);
const percentage = (n: number, total: number) => total ? (n * 100 / total).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%" : "0%";
const dateLabel = (s: string) => {
  const parts = s.split("-").map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? new Intl.DateTimeFormat("id-ID", {day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(parts[0],parts[1]-1,parts[2]))) : s;
};
const statuses: MasStatus[] = ["Closing","Cancel","Feedback Marketing","Feedback Teknik","On Proses","Belum Terklasifikasi"];
const statusIcons: Record<MasStatus, string> = {
  Closing:"✅",Cancel:"❌","Feedback Marketing":"📣","Feedback Teknik":"💬","On Proses":"🔎","Belum Terklasifikasi":"⚠️"
};

const Slide: React.FC<{title: string; subheading?: string; children: React.ReactNode; id: string; index: number; meetingDate: string}> =
  ({title,subheading,children,id,index,meetingDate}) =>
  <section id={id} className="mas-report mas-reference-slide overflow-hidden rounded-2xl border border-blue-200 bg-[#f6f9ff] p-4 shadow-sm sm:p-6">
    <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="text-[10px] font-bold tracking-widest text-[#4177a4]">PERTALIFE · WEEKLY MARKETING REVIEW</p>
        <h2 className="mt-1 text-xl font-black leading-tight text-[#10356b] sm:text-[26px]">{title}</h2>
        <p className="mt-1 text-[11px] font-semibold italic text-slate-600">{subheading || "LIST ACTION ITEM YANG PERLU DIMONITOR DAN DITINDAKLANJUTI"}</p>
        <div className="mt-2 flex h-1 w-44 gap-1"><span className="w-1/2 bg-blue-600"/><span className="w-1/3 bg-lime-500"/><span className="flex-1 bg-rose-500"/></div>
      </div>
      <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-right text-[11px] font-semibold text-[#376395]">
        {dateLabel(meetingDate)}<span className="mt-1 block text-[10px] text-slate-400">{index} / 5</span>
      </div>
    </header>
    {children}
  </section>;

const SmallTotal: React.FC<{label:string;value:number;color?:string}> = ({label,value,color="text-blue-700"}) =>
  <div className="flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3">
    <Users className={"h-7 w-7 shrink-0 "+color}/>
    <div><p className="text-xs font-bold text-slate-700">{label}</p><p className={"text-2xl font-black "+color}>{count(value)} <span className="text-xs font-medium text-slate-500">Case</span></p></div>
  </div>;

/**
 * Render the per-product comparison as native horizontal bars.
 *
 * The previous Recharts component nested <Bar> inside a React.Fragment.
 * Recharts v2 discovers graphical children by direct child type, so it
 * rendered the axes and legend but no bars. DOM bars remove that fragile
 * dependency and keep every product readable when printed to PDF.
 */
const QuotationGraph: React.FC<{
  data: ProductBar[];
  mode: "units" | "segments";
  sharedScale?: number;
}> = ({ data, mode, sharedScale }) => {
  const series = mode === "units"
    ? [{ key: "Captive" as const, label: "Captive", color: BLUE }, { key: "CRM" as const, label: "CRM", color: LIME }]
    : [{ key: "Tender" as const, label: "Tender", color: BLUE }, { key: "Non Tender" as const, label: "Non Tender", color: LIME }];
  const localMax = Math.max(0, ...data.flatMap(row => series.map(item => row[item.key])));
  const scale = Math.max(1, sharedScale || localMax);
  return <div className="rounded-lg bg-white p-3 sm:p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
      <div className="flex flex-wrap items-center gap-4">
        {series.map(item => <div key={item.key} className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="h-3 w-3 rounded-sm" style={{backgroundColor:item.color}}/>{item.label}
        </div>)}
      </div>
      <span className="text-[10px] font-medium text-slate-500">Skala maksimum: {count(scale)} case</span>
    </div>
    <div className="space-y-2.5">
      {data.map(row => <div key={row.product} className="grid grid-cols-[minmax(105px,165px)_minmax(0,1fr)] items-center gap-3 border-b border-slate-100/80 pb-2.5 last:border-b-0 last:pb-0">
        <p className="break-words text-[11px] font-semibold leading-snug text-[#214779]" title={row.product}>{row.product}</p>
        <div className="space-y-1.5">
          {series.map(item => {
            const raw = row[item.key];
            const value = Math.max(0,raw);
            return <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_45px] items-center gap-2" title={item.label+" · "+count(raw)+" case"}>
              <div className="relative h-3.5 overflow-hidden rounded-sm bg-[#edf2f8]">
                <div className="h-full rounded-r-sm transition-[width] duration-200" style={{
                  width:Math.min(100,100*value/scale)+"%",
                  minWidth:value>0?"3px":undefined,
                  backgroundColor:item.color
                }}/>
              </div>
              <span className="text-right text-[11px] font-extrabold tabular-nums text-[#1c426f]">{raw===0?"–":count(raw)}</span>
            </div>;
          })}
        </div>
      </div>)}
      {!data.length&&<p className="py-10 text-center text-xs text-slate-500">Belum ada data produk untuk kategori ini.</p>}
    </div>
    <p className="mt-3 text-[10px] text-slate-500">Panjang batang mengikuti jumlah case; angka tepat ditampilkan di sisi kanan setiap batang.</p>
  </div>;
};

type StatusStats = { name: MasStatus; captive: number; crm: number; captivePremium: number; crmPremium: number };
const SummaryStatus: React.FC<{kind:"Tender"|"Non Tender";results:MasResults;meetingDate:string;index:number}> =
 ({kind,results,meetingDate,index}) => {
  const getGroup = (unit:MasUnit) => results.groups.filter(x=>x.unit===unit&&x.segment===kind)
    .reduce((acc,x)=>({cases:acc.cases+x.cases,premium:acc.premium+x.premium}),{cases:0,premium:0});
  const capt=getGroup("Captive");
  const crm=getGroup("CRM");
  const details: StatusStats[] = statuses.map(name=>{
    const group=(unit:MasUnit)=>results.statuses.filter(x=>x.unit===unit&&x.segment===kind&&x.status===name)
      .reduce((acc,x)=>({cases:acc.cases+x.cases,premium:acc.premium+x.premium}),{cases:0,premium:0});
    const a=group("Captive"), b=group("CRM");
    return {name,captive:a.cases,crm:b.cases,captivePremium:a.premium,crmPremium:b.premium};
  }).filter(x=>x.name!=="Belum Terklasifikasi"||x.captive!==0||x.crm!==0||Math.abs(x.captivePremium)>1||Math.abs(x.crmPremium)>1);
  const totalCase=capt.cases+crm.cases, totalPremium=capt.premium+crm.premium;
  return <Slide title={"RINGKASAN STATUS "+kind.toUpperCase()} subheading="Rekapitulasi Total Case dan Total Proyeksi Premi per Status" id={"mas-reference-status-"+kind.toLowerCase().replace(" ","-")} index={index} meetingDate={meetingDate}>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-blue-300 bg-white p-4">
        <div className="flex items-center gap-2"><Users className="h-6 w-6 text-blue-600"/><p className="text-sm font-extrabold uppercase text-[#174c9a]">Total Case</p></div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-center">
          <div className="border-r border-blue-200"><div className="text-3xl font-black text-blue-700">{count(capt.cases)}</div><p className="text-xs font-semibold">Captive</p></div>
          <div><div className="text-3xl font-black text-blue-700">{count(crm.cases)}</div><p className="text-xs font-semibold">CRM</p></div>
        </div>
        <p className="mx-auto mt-4 max-w-[240px] rounded-full bg-[#123b84] py-1.5 text-center text-sm font-black text-white">{count(totalCase)} TOTAL CASE</p>
      </div>
      <div className="rounded-xl border border-emerald-300 bg-white p-4">
        <div className="flex items-center gap-2"><Coins className="h-6 w-6 text-green-700"/><p className="text-sm font-extrabold uppercase text-green-800">Total Proyeksi Premi</p></div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-center">
          <div className="border-r border-green-200"><div className="text-xl font-black text-green-800">{compact(capt.premium)}</div><p className="text-xs font-semibold">Captive</p></div>
          <div><div className="text-xl font-black text-green-800">{compact(crm.premium)}</div><p className="text-xs font-semibold">CRM</p></div>
        </div>
        <p className="mx-auto mt-4 max-w-[290px] rounded-full bg-green-700 py-1.5 text-center text-sm font-black text-white">{compact(totalPremium)} TOTAL PROYEKSI PREMI</p>
      </div>
    </div>
    <div className="mt-3 overflow-x-auto rounded-xl border border-blue-200 bg-white">
      <table className="w-full min-w-[860px] border-collapse text-xs">
        <thead className="bg-[#123c82] text-white">
          <tr><th rowSpan={2} className="border border-white/30 p-3 text-left">Status</th><th colSpan={2} className="border border-white/30 p-2">Total Case</th>
            <th colSpan={2} className="border border-white/30 bg-green-800 p-2">Total Proyeksi Premi (Rp)</th>
            <th colSpan={2} className="border border-white/30 p-2">Persentase Case</th></tr>
          <tr>{["Captive","CRM","Captive","CRM","Captive","CRM"].map((s,i)=><th key={i} className={"border border-white/30 p-2 "+(i===2||i===3?"bg-green-800":"")}>{s}</th>)}</tr>
        </thead>
        <tbody>
          {details.map((row,i)=><tr key={row.name} className={i%2?"bg-[#f2f7ff]":"bg-white"}>
            <td className="border border-slate-200 px-3 py-3 font-semibold"><span className="mr-2">{statusIcons[row.name]}</span>{row.name}</td>
            <td className="border border-slate-200 p-2 text-center font-bold text-blue-800">{count(row.captive)}</td>
            <td className="border border-slate-200 p-2 text-center font-bold text-blue-800">{count(row.crm)}</td>
            <td className="border border-slate-200 p-2 text-right">{row.captivePremium===0?"–":money(row.captivePremium)}</td>
            <td className="border border-slate-200 p-2 text-right">{row.crmPremium===0?"–":money(row.crmPremium)}</td>
            {([{value:row.captive,total:capt.cases},{value:row.crm,total:crm.cases}]).map((entry,j)=><td key={j} className="border border-slate-200 px-2 py-2">
              <div className="flex items-center gap-2"><span className="w-11 shrink-0 text-right font-medium">{percentage(entry.value,entry.total)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-green-700" style={{width:(entry.total?Math.max(0,Math.min(100,100*entry.value/entry.total)):0)+"%"}}/></div></div>
            </td>)}
          </tr>)}
          <tr className="bg-[#dbeaff] font-black text-[#14376f]">
            <td className="border border-blue-200 px-3 py-3">TOTAL</td><td className="border border-blue-200 p-2 text-center">{count(capt.cases)}</td><td className="border border-blue-200 p-2 text-center">{count(crm.cases)}</td>
            <td className="border border-blue-200 p-2 text-right">{money(capt.premium)}</td><td className="border border-blue-200 p-2 text-right">{money(crm.premium)}</td>
            <td className="border border-blue-200 p-2 text-center">{capt.cases>0?"100%":"—"}</td><td className="border border-blue-200 p-2 text-center">{crm.cases>0?"100%":"—"}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.5fr]">
      <div className="rounded-xl border border-blue-200 bg-white px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-extrabold text-blue-800"><TrendingUp className="h-4 w-4"/> TOTAL KESELURUHAN</p>
        <div className="mt-2 flex items-center justify-between text-sm"><span>Captive <b>{count(capt.cases)}</b></span><span>CRM <b>{count(crm.cases)}</b></span><span>Total <b>{count(totalCase)}</b></span></div>
      </div>
      <div className="rounded-xl border border-green-200 bg-white px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-extrabold text-green-800"><Coins className="h-4 w-4"/> TOTAL PROYEKSI PREMI (Rp)</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span>Captive <b>{money(capt.premium)}</b></span><span>CRM <b>{money(crm.premium)}</b></span><span>Total <b>{money(totalPremium)}</b></span></div>
      </div>
    </div>
    <p className="mt-3 text-[10px] italic text-slate-500">Persentase dihitung terhadap total case masing-masing unit pada kategori {kind}. Angka berasal dari data upload dan penyesuaian MAS.</p>
  </Slide>;
};

const WeeklyMasReferenceCharts: React.FC<Props> = ({results,meetingDate}) => {
  const data=useMemo(()=>{
    const map=new Map<string,ProductBar>();
    const unitMap: Record<MasUnit,Map<string,ProductBar>>={Captive:new Map(),CRM:new Map()};
    for(const item of results.groups){
      const row=map.get(item.product)||{product:item.product,Captive:0,CRM:0,Tender:0,"Non Tender":0};
      row[item.unit]+=item.cases;
      map.set(item.product,row);
      const one=unitMap[item.unit].get(item.product)||{product:item.product,Captive:0,CRM:0,Tender:0,"Non Tender":0};
      if(item.segment==="Tender"||item.segment==="Non Tender")one[item.segment]+=item.cases;
      unitMap[item.unit].set(item.product,one);
    }
    const sort=(a:ProductBar,b:ProductBar)=> (b.Captive+b.CRM+b.Tender+b["Non Tender"])-(a.Captive+a.CRM+a.Tender+a["Non Tender"])||a.product.localeCompare(b.product);
    const unitTotals=(unit:MasUnit,seg?:string)=>results.groups.filter(x=>x.unit===unit&&(!seg||x.segment===seg)).reduce((n,x)=>n+x.cases,0);
    const unclassified=results.groups.filter(x=>x.segment==="Unclassified").reduce((n,x)=>n+x.cases,0);
    const segmentMax = Math.max(1,
      ...[...unitMap.Captive.values(), ...unitMap.CRM.values()]
        .flatMap(row => [row.Tender, row["Non Tender"]]));

    return {
      overall:[...map.values()].sort(sort),
      captive:[...unitMap.Captive.values()].filter(x=>x.Tender+x["Non Tender"]>0).sort(sort),
      crm:[...unitMap.CRM.values()].filter(x=>x.Tender+x["Non Tender"]>0).sort(sort),
      cTotal:unitTotals("Captive"),rTotal:unitTotals("CRM"),
      cTender:unitTotals("Captive","Tender"),cNon:unitTotals("Captive","Non Tender"),
      rTender:unitTotals("CRM","Tender"),rNon:unitTotals("CRM","Non Tender"),
      unclassified,
      segmentMax
    };
  },[results]);
  return <>
    <style>{"@media print { .mas-reference-slide{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;margin-top:0!important;box-shadow:none!important}.mas-reference-slide .overflow-x-auto{overflow:visible!important}.mas-reference-slide .min-w-\\[860px\\]{min-width:0!important}.mas-reference-slide .recharts-responsive-container{height:300px!important}.mas-reference-slide table{font-size:8px!important}.mas-reference-slide td,.mas-reference-slide th{padding:4px!important}} "}</style>
    <Slide title="LIST ACTION - DH MARKETING ADMINISTRATION" id="mas-reference-quotation" index={2} meetingDate={meetingDate}>
      <div className="rounded-xl border border-blue-300 bg-white p-3">
        <div className="mb-2 rounded-lg bg-[#3973b5] py-2 text-center text-sm font-extrabold text-white">Overall Quotation</div>
        <QuotationGraph data={data.overall} mode="units"/>
      </div>
      <div className="mx-auto mt-3 grid max-w-xl gap-3 sm:grid-cols-2">
        <SmallTotal label="Total Captive" value={data.cTotal} color="text-[#2f72c1]"/>
        <SmallTotal label="Total CRM" value={data.rTotal} color="text-[#8aae22]"/>
      </div>
    </Slide>
    <Slide title="LIST ACTION - DH MARKETING ADMINISTRATION" id="mas-reference-business-type" index={3} meetingDate={meetingDate}>
      <div className="grid gap-3 xl:grid-cols-2">
        {([
          {unit:"Captive" as MasUnit,rows:data.captive,tender:data.cTender,non:data.cNon},
          {unit:"CRM" as MasUnit,rows:data.crm,tender:data.rTender,non:data.rNon}
        ]).map(card=><div key={card.unit} className="overflow-hidden rounded-xl border border-blue-200 bg-white">
          <h3 className={"py-2 text-center text-sm font-extrabold text-white "+(card.unit==="Captive"?"bg-[#3973b5]":"bg-[#a2c42c]")}>{card.unit} Tender vs Non Tender</h3>
          <QuotationGraph data={card.rows} mode="segments" sharedScale={data.segmentMax}/>
          <div className="mx-3 mb-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 text-center">
            <div><p className="text-xs font-semibold text-slate-600">Total Tender</p><p className="text-xl font-black text-blue-700">{count(card.tender)} <span className="text-xs font-medium">Case</span></p></div>
            <div className="border-l border-slate-200"><p className="text-xs font-semibold text-slate-600">Total Non Tender</p><p className="text-xl font-black text-[#7ca51c]">{count(card.non)} <span className="text-xs font-medium">Case</span></p></div>
          </div>
        </div>)}
      </div>
      {data.unclassified!==0&&<p className="mt-2 text-xs text-amber-800">Catatan: {count(data.unclassified)} case belum terklasifikasi Tender/Non Tender; tidak dimasukkan secara paksa ke salah satu kelompok.</p>}
    </Slide>
    <SummaryStatus kind="Tender" results={results} meetingDate={meetingDate} index={4}/>
    <SummaryStatus kind="Non Tender" results={results} meetingDate={meetingDate} index={5}/>
  </>;
};
export default WeeklyMasReferenceCharts;
