import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, FileSpreadsheet, Maximize2, Minimize2, PencilLine, Save, Trash2, UploadCloud, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import MasExecutiveSummary from "@/components/weekly/MasExecutiveSummary";
import WeeklyMasReferenceCharts from "@/components/weekly/WeeklyMasReferenceCharts";
import { MasDrilldownProvider } from "@/components/weekly/MasDrilldown";
import { calculateMasResults, parseWeeklyMasFile, type MasParsed, type MasOverride, type MasStatus, type MasUnit } from "@/utils/weeklyMasChartEngine";
import { readMasPeriod, removeMasOverride, resetMasPeriod, saveMasOverride, saveMasUpload, type MasManualDraft, type MasUpload } from "@/services/weeklyMasChartService";

type Props = { meetingDate: string; canManage: boolean };
const statusNames: (MasStatus | "ALL")[] = ["ALL","Closing","Cancel","Feedback Marketing","Feedback Teknik","On Proses","Belum Terklasifikasi"];
const colors: Record<MasStatus, string> = {"Closing":"#2ca76b","Cancel":"#da5569","Feedback Marketing":"#edb246","Feedback Teknik":"#6196d7","On Proses":"#8569c3","Belum Terklasifikasi":"#9ca3af"};
const int = (x:number) => new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(x);
const rup = (x:number) => "Rp " + int(x);
const shortRp = (x:number) => Math.abs(x)>=1e12?"Rp "+(x/1e12).toLocaleString("id-ID",{maximumFractionDigits:2})+" T":Math.abs(x)>=1e9?"Rp "+(x/1e9).toLocaleString("id-ID",{maximumFractionDigits:2})+" M":rup(x);
const emptyDraft = (): MasManualDraft => ({unit:"CRM",business_type:"Non Tender",product:"",status:"ALL",method:"REPLACE",cases:null,premium:null,reason:""});
const numeric = (raw:string):number|null => {
  if (!raw.trim()) return null;
  let s=raw.replace(/\s/g,"");
  const c=s.lastIndexOf(","), d=s.lastIndexOf(".");
  if(c>=0&&d>=0)s=c>d?s.replace(/\./g,"").replace(",","."):s.replace(/,/g,"");
  else if(c>=0)s=s.replace(/\./g,"").replace(",",".");
  else if(/^[-]?\d{1,3}(\.\d{3})+$/.test(s))s=s.replace(/\./g,"");
  return Number(s);
};
const Box: React.FC<{title:string;note?:string;children:React.ReactNode}> = ({title,note,children}) =>
  <section className="mas-report rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-4"><h3 className="font-extrabold text-[#173f73]">{title}</h3>{note&&<p className="mt-1 text-xs text-slate-500">{note}</p>}</div><div className="p-4 sm:p-5">{children}</div></section>;
const Stat: React.FC<{title:string;value:string;detail?:string}> = ({title,value,detail}) =>
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-semibold text-slate-500">{title}</p><p className="mt-2 text-xl font-black text-slate-900">{value}</p>{detail&&<p className="mt-1 text-[11px] text-slate-500">{detail}</p>}</div>;

const WeeklyMasCharts:React.FC<Props> = ({meetingDate,canManage}) => {
  const picker=useRef<HTMLInputElement>(null);
  const [upload,setUpload]=useState<MasUpload|null>(null);
  const [manual,setManual]=useState<MasOverride[]>([]);
  const [candidate,setCandidate]=useState<{filename:string;data:MasParsed}|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[full,setFull]=useState(false);
  const [draft,setDraft]=useState<MasManualDraft>(emptyDraft);
  const [caseInput,setCaseInput]=useState(""),[premiumInput,setPremiumInput]=useState("");
  const refresh=async()=>{const result=await readMasPeriod(meetingDate);setUpload(result.upload);setManual(result.overrides);};
  useEffect(()=>{
    let alive=true;setLoading(true);setUpload(null);setManual([]);setCandidate(null);
    readMasPeriod(meetingDate).then(data=>{if(alive){setUpload(data.upload);setManual(data.overrides);}})
      .catch(err=>{if(alive)toast.error(err instanceof Error?err.message:"CHART gagal dibuka.");})
      .finally(()=>{if(alive)setLoading(false);});
    return()=>{alive=false;};
  },[meetingDate]);
  const result=useMemo(()=>calculateMasResults(upload?.aggregates||[],manual),[upload,manual]);
  const productData=useMemo(()=>{
    const map=new Map<string,{product:string;Captive:number;CRM:number;premium:number}>();
    result.groups.forEach(row=>{
      const x=map.get(row.product)||{product:row.product,Captive:0,CRM:0,premium:0};
      x[row.unit]+=row.cases;x.premium+=row.premium;map.set(row.product,x);
    });return [...map.values()];
  },[result]);
  const caseRank=[...productData].sort((a,b)=>b.Captive+b.CRM-a.Captive-a.CRM).slice(0,10);
  const premiumRank=[...productData].sort((a,b)=>b.premium-a.premium).slice(0,8).map(x=>({...x,billion:x.premium/1e9}));
  const totals={
    cases:result.groups.reduce((n,x)=>n+x.cases,0),
    captive:result.groups.filter(x=>x.unit==="Captive").reduce((n,x)=>n+x.cases,0),
    crm:result.groups.filter(x=>x.unit==="CRM").reduce((n,x)=>n+x.cases,0),
    premium:result.groups.reduce((n,x)=>n+x.premium,0)
  };
  const tender=(["Captive","CRM"] as MasUnit[]).map(unit=>({
    name:unit,Tender:result.groups.filter(x=>x.unit===unit&&x.segment==="Tender").reduce((n,x)=>n+x.cases,0),
    "Non Tender":result.groups.filter(x=>x.unit===unit&&x.segment==="Non Tender").reduce((n,x)=>n+x.cases,0),
    "Tidak Terklasifikasi":result.groups.filter(x=>x.unit===unit&&x.segment==="Unclassified").reduce((n,x)=>n+x.cases,0)
  }));
  const statusSummaries=(["Captive","CRM"] as MasUnit[]).flatMap(unit=>
    (["Tender","Non Tender","Unclassified"] as const).map(segment=>{
      const statuses=result.statuses.filter(x=>x.unit===unit&&x.segment===segment);
      const categories=statusNames.filter(x=>x!=="ALL").map(status=>({
        status:status as MasStatus,
        cases:statuses.filter(x=>x.status===status).reduce((n,x)=>n+x.cases,0),
        premium:statuses.filter(x=>x.status===status).reduce((n,x)=>n+x.premium,0)
      }));
      return {unit,segment,categories,cases:categories.reduce((n,x)=>n+x.cases,0)};
    }).filter(x=>x.cases!==0||x.categories.some(c=>Math.abs(c.premium)>1))
  );
  const issues=[
    ...(upload?.parse_meta?.missingProduct?["Produk kosong: "+upload.parse_meta.missingProduct]:[]),
    ...(upload?.parse_meta?.missingSegment?["Jenis bisnis kosong: "+upload.parse_meta.missingSegment]:[]),
    ...(upload?.parse_meta?.unknownSegment?["Jenis bisnis tak dikenali: "+upload.parse_meta.unknownSegment]:[]),
    ...(upload?.parse_meta?.missingStatus?["Status kosong: "+upload.parse_meta.missingStatus]:[]),
    ...(upload?.parse_meta?.unknownStatus?["Status tak dikenali: "+upload.parse_meta.unknownStatus]:[]),
    ...(upload?.parse_meta?.invalidPremium?["Premi tidak terbaca: "+upload.parse_meta.invalidPremium]:[]),
    ...result.warnings
  ];
  const noStatus=result.statuses.filter(x=>x.status==="Belum Terklasifikasi").reduce((n,x)=>n+x.cases,0);
  const products=[...new Set([...(upload?.aggregates||[]).map(x=>x.product),...manual.map(x=>x.product)])].sort((a,b)=>a.localeCompare(b));
  const relevant=result.groups.find(g=>g.unit===draft.unit&&g.segment===draft.business_type&&g.product.toLowerCase()===draft.product.trim().toLowerCase());
  const hasData=!!upload||manual.length>0;
  const readFile=async(file:File)=>{
    setBusy(true);try{setCandidate({filename:file.name,data:await parseWeeklyMasFile(file)});toast.info("Excel terbaca. Periksa preview sebelum Simpan Upload.");}
    catch(err){setCandidate(null);toast.error(err instanceof Error?err.message:"Gagal membaca Excel.");}
    finally{setBusy(false);if(picker.current)picker.current.value="";}
  };
  const saveFile=async()=>{
    if(!candidate||!canManage)return;setBusy(true);
    try{await saveMasUpload(meetingDate,candidate.filename,candidate.data.buckets,candidate.data.meta,candidate.data.details);setCandidate(null);await refresh();toast.success("Data agregat tersimpan. Grafik diperbarui.");}
    catch(err){toast.error(err instanceof Error?err.message:"Gagal menyimpan Excel.");}
    finally{setBusy(false);}
  };
  const resetChart = async () => {
    if (!canManage || busy || (!upload && manual.length === 0)) return;
    const accepted = window.confirm(
      "HAPUS DATA CHART — " + meetingDate + "\n\n" +
      "Seluruh versi upload Excel dan " + manual.length + " penyesuaian manual pada tanggal ini akan DIHAPUS PERMANEN.\n" +
      "Semua grafik akan kembali kosong sehingga MAS bisa upload ulang.\n\n" +
      "Data INSPIRE dan laporan tanggal lain tidak akan berubah.\n\n" +
      "Yakin ingin melanjutkan?"
    );
    if (!accepted) return;
    setBusy(true);
    try {
      const deleted = await resetMasPeriod(meetingDate);
      setUpload(null);
      setManual([]);
      setCandidate(null);
      setDraft(emptyDraft());
      setCaseInput("");
      setPremiumInput("");
      if (picker.current) picker.current.value = "";
      await refresh();
      toast.success(
        "CHART " + meetingDate + " dikosongkan. " +
        deleted.upload_versions_deleted + " versi upload dan " +
        deleted.manual_adjustments_deleted + " penyesuaian manual dihapus."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus data CHART.");
    } finally {
      setBusy(false);
    }
  };
  const saveManual=async()=>{
    if(!canManage)return;
    const cases=numeric(caseInput),premi=numeric(premiumInput);
    if(cases!==null&&!Number.isSafeInteger(cases))return toast.error("Jumlah case harus angka bulat.");
    if((cases!==null&&!Number.isFinite(cases))||(premi!==null&&!Number.isFinite(premi)))return toast.error("Angka tidak valid.");
    setBusy(true);try{await saveMasOverride(meetingDate,{...draft,cases,premium:premi});await refresh();setDraft(emptyDraft());setCaseInput("");setPremiumInput("");toast.success("Penyesuaian berhasil disimpan.");}
    catch(err){toast.error(err instanceof Error?err.message:"Gagal menyimpan penyesuaian.");}
    finally{setBusy(false);}
  };
  const edit=(x:MasOverride)=>{
    setDraft({unit:x.unit,business_type:x.business_type,product:x.product,status:x.status,method:x.method,cases:x.cases,premium:x.premium,reason:x.reason});
    setCaseInput(x.cases===null?"":String(x.cases));setPremiumInput(x.premium===null?"":String(x.premium));
    document.getElementById("mas-manual-form")?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  const remove=async(x:MasOverride)=>{
    if(!canManage||!window.confirm("Hapus penyesuaian "+x.product+"?"))return;
    setBusy(true);try{await removeMasOverride(x.id);await refresh();toast.success("Penyesuaian dihapus.");}
    catch(err){toast.error(err instanceof Error?err.message:"Gagal menghapus.");}
    finally{setBusy(false);}
  };
  return <div id="mas-chart-root" className={full?"fixed inset-0 z-[1000] overflow-auto bg-slate-100 p-3 sm:p-5":"space-y-5"}>
    <style>{'@media print{@page{size:landscape;margin:10mm}#mas-chart-root{position:static!important;padding:0!important}.mas-drilldown-modal{display:none!important}.mas-drill-number{text-decoration:none!important}.mas-controls{display:none!important}.mas-report{box-shadow:none!important;border:0!important;margin-bottom:9mm;break-inside:auto}.mas-report .overflow-auto{max-height:none!important;overflow:visible!important}.mas-report tr{break-inside:avoid}.recharts-responsive-container{height:250px!important}}'}</style>
    <section className="mas-controls rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-extrabold text-[#173f73]">CHART · Marketing Administration</h2><p className="mt-1 text-xs text-slate-500">DATA CAPTIVE + DATA CRM · Periode {meetingDate}</p></div>
        <div className="flex flex-wrap gap-2">
          {hasData&&canManage&&<button type="button" disabled={busy||loading} onClick={()=>void resetChart()} className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" title={"Hapus data CHART khusus periode "+meetingDate}><Trash2 className="h-4 w-4"/>Hapus Data CHART</button>}
          {hasData&&<a href="#mas-overall-dashboard" className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs font-bold text-[#1b4a86] hover:bg-blue-100">Lihat Dashboard Overall</a>}
          <button onClick={()=>setFull(v=>!v)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-xs font-bold">{full?<Minimize2 className="h-4 w-4"/>:<Maximize2 className="h-4 w-4"/>}{full?"Keluar Full Screen":"Full Screen"}</button>
          <button disabled={!hasData} onClick={()=>window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#17487d] px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40"><FileDown className="h-4 w-4"/>Cetak / Simpan PDF</button>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 p-4">
        <p className="flex items-center gap-2 text-sm font-bold"><UploadCloud className="h-5 w-5 text-blue-700"/>01 · Upload Excel Sumber</p>
        <p className="mt-2 text-xs text-slate-600">Pilih satu workbook yang memuat sheet <b>DATA CAPTIVE</b> dan <b>DATA CRM</b>. Sistem menyimpan rekap angka, bukan nama perusahaan atau data nasabah.</p>
        {canManage && hasData && <p className="mt-2 text-xs text-slate-500">Untuk mulai ulang sepenuhnya pada periode ini, gunakan <b>Hapus Data CHART</b> di kanan atas. Tindakan itu juga menghapus semua versi upload dan penyesuaian manual periode ini.</p>}
        <input ref={picker} type="file" accept=".xlsx" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);}}/>
        {canManage?<button disabled={busy} onClick={()=>picker.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#17487d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><FileSpreadsheet className="h-4 w-4"/>Pilih Excel</button>:<p className="mt-2 text-xs text-amber-800">Upload hanya untuk MAS atau root Marketing Support.</p>}
        {upload&&<p className="mt-3 text-xs text-slate-700">Upload aktif: <b>{upload.source_filename}</b> · {new Date(upload.created_at).toLocaleString("id-ID")} · {int(upload.details_count||0)} baris rincian tersimpan</p>}
        {upload&&upload.details_count===0&&<p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">Upload lama hanya berisi rekap angka. Upload Excel yang sama sekali lagi untuk mengaktifkan pop-up nama perusahaan pada CHART. Tidak perlu Hapus Data CHART.</p>}
        <p className="mt-2 text-xs text-slate-500">Mulai upload berikutnya, nama perusahaan dan detail quotation relevan disimpan sebagai data internal yang hanya dapat dilihat pengguna Marketing Support.</p>
      </div>
      {candidate&&<div className="mt-3 rounded-xl border border-blue-300 p-4">
        <p className="text-sm font-bold">Preview: {candidate.filename}</p>
        <p className="mt-1 text-xs text-slate-600">Captive {int(candidate.data.meta.rows.Captive)} record · CRM {int(candidate.data.meta.rows.CRM)} record · {candidate.data.buckets.length} kelompok agregat · {candidate.data.details.length} detail quotation</p>
        <p className="mt-2 text-xs text-amber-800">Periksa: produk kosong {candidate.data.meta.missingProduct}, jenis bisnis kosong {candidate.data.meta.missingSegment}, status kosong {candidate.data.meta.missingStatus}, premi invalid {candidate.data.meta.invalidPremium}.</p>
        <div className="mt-3 flex gap-2"><button disabled={busy} onClick={()=>void saveFile()} className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white">Simpan Upload & Buat Chart</button><button onClick={()=>setCandidate(null)} className="rounded-lg border px-4 py-2 text-xs">Batal</button></div>
      </div>}
    </section>
    {loading&&<div className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Memuat laporan...</div>}
    {!loading&&!hasData&&<div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Belum ada data CHART pada periode ini. Upload Excel sumber untuk memulai.</div>}
    {!loading&&hasData&&<MasDrilldownProvider upload={upload} overrides={manual} results={result}>
      <MasExecutiveSummary meetingDate={meetingDate} results={result}/>
      <WeeklyMasReferenceCharts results={result} meetingDate={meetingDate}/>
      <div className="mas-controls mt-4">
      <Box title="Validasi Data dan Catatan Rekonsiliasi" note="Pastikan seluruh selisih diperiksa sebelum bahan digunakan untuk Direktur">
        <div className={"rounded-lg border p-3 "+(issues.length?"border-amber-200 bg-amber-50":"border-emerald-200 bg-emerald-50")}>
          <div className="flex items-center gap-2 text-xs font-bold">{issues.length?<AlertTriangle className="h-4 w-4 text-amber-700"/>:<CheckCircle2 className="h-4 w-4 text-emerald-700"/>}{issues.length?issues.length+" catatan perlu pemeriksaan":"Tidak ada masalah yang terdeteksi"}</div>
          <p className="mt-1 text-xs">Case dengan status belum terklasifikasi setelah penyesuaian: <b>{int(noStatus)}</b>. Nilai tambahan manual tidak otomatis dianggap Closing.</p>
          {issues.length>0&&<div className="mt-2 grid gap-1 text-xs text-amber-800 sm:grid-cols-2">{issues.slice(0,12).map((issue,i)=><p key={i}>• {issue}</p>)}</div>}
        </div>
      </Box>
      </div>
    </MasDrilldownProvider>}
    <section id="mas-manual-form" className="mas-controls rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2"><PencilLine className="h-5 w-5 text-blue-700"/><h3 className="text-lg font-black text-[#173f73]">Penyesuaian Data Manual</h3></div>
      <p className="mt-2 text-xs leading-5 text-slate-600">Pilih produk apa pun. <b>Ganti Total</b> mengganti nilai kategori; <b>Tambah Selisih</b> menambah/mengurangi nilai. Jika mengubah total tanpa rincian status, selisihnya dicatat sebagai Belum Terklasifikasi.</p>
      {canManage?<><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-bold">Unit<select value={draft.unit} onChange={e=>setDraft(d=>({...d,unit:e.target.value as MasUnit}))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option>Captive</option><option>CRM</option></select></label>
        <label className="text-xs font-bold">Jenis Bisnis<select value={draft.business_type} onChange={e=>setDraft(d=>({...d,business_type:e.target.value as MasManualDraft["business_type"]}))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option>Tender</option><option>Non Tender</option></select></label>
        <label className="text-xs font-bold">Produk<input list="mas-product-list" value={draft.product} onChange={e=>setDraft(d=>({...d,product:e.target.value}))} placeholder="Pilih / ketik produk" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/><datalist id="mas-product-list">{products.map(p=><option key={p} value={p}/>)}</datalist></label>
        <label className="text-xs font-bold">Status<select value={draft.status} onChange={e=>setDraft(d=>({...d,status:e.target.value as MasManualDraft["status"]}))} className="mt-1 w-full rounded-lg border p-2.5 text-sm">{statusNames.map(x=><option key={x} value={x}>{x==="ALL"?"ALL · Total Produk":x}</option>)}</select></label>
        <label className="text-xs font-bold">Metode<select value={draft.method} onChange={e=>setDraft(d=>({...d,method:e.target.value as MasManualDraft["method"]}))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"><option value="REPLACE">Ganti Total</option><option value="DELTA">Tambah Selisih (+/-)</option></select></label>
        <label className="text-xs font-bold">Jumlah Case<input value={caseInput} onChange={e=>setCaseInput(e.target.value)} inputMode="numeric" placeholder="Kosongkan = tidak diubah" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
        <label className="text-xs font-bold">Proyeksi Premi (Rp)<input value={premiumInput} onChange={e=>setPremiumInput(e.target.value)} inputMode="decimal" placeholder="Kosongkan = tidak diubah" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
        <label className="text-xs font-bold">Alasan / Sumber<input value={draft.reason} onChange={e=>setDraft(d=>({...d,reason:e.target.value}))} placeholder="Contoh: PIPA rekap manual" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/></label>
      </div>
      {relevant&&<p className="mt-3 rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Angka sumber: {int(relevant.baselineCases)} case / {shortRp(relevant.baselinePremium)} · Final saat ini: {int(relevant.cases)} case / {shortRp(relevant.premium)}</p>}
      <div className="mt-4 flex gap-2"><button disabled={busy} onClick={()=>void saveManual()} className="inline-flex items-center gap-2 rounded-lg bg-[#17487d] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"><Save className="h-4 w-4"/>Simpan Penyesuaian</button><button onClick={()=>{setDraft(emptyDraft());setCaseInput("");setPremiumInput("");}} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs"><X className="h-4 w-4"/>Bersihkan</button></div>
      </>:<p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Hanya MAS/root Marketing Support yang dapat mengubah data. Tim MS lain hanya membaca.</p>}
      <h4 className="mt-6 text-sm font-bold">Daftar Penyesuaian ({manual.length})</h4>
      <div className="mt-2 max-h-[290px] overflow-auto"><table className="min-w-[940px] w-full text-xs"><thead className="bg-slate-100"><tr>{["Produk","Unit","Jenis","Status","Metode","Case","Premi (Rp)","Keterangan",...(canManage?["Aksi"]:[])].map(x=><th key={x} className="p-2 text-left">{x}</th>)}</tr></thead><tbody>{manual.map(x=><tr key={x.id} className="border-t"><td className="p-2 font-bold">{x.product}</td><td className="p-2">{x.unit}</td><td className="p-2">{x.business_type}</td><td className="p-2">{x.status}</td><td className="p-2">{x.method==="REPLACE"?"Ganti Total":"Tambah Selisih"}</td><td className="p-2">{x.cases===null?"—":int(x.cases)}</td><td className="p-2">{x.premium===null?"—":rup(x.premium)}</td><td className="p-2">{x.reason}</td>{canManage&&<td className="p-2"><div className="flex gap-2"><button title="Edit" onClick={()=>edit(x)} className="text-blue-700"><PencilLine className="h-4 w-4"/></button><button title="Hapus" onClick={()=>void remove(x)} className="text-rose-700"><Trash2 className="h-4 w-4"/></button></div></td>}</tr>)}</tbody></table>{!manual.length&&<p className="p-4 text-center text-xs text-slate-500">Belum ada penyesuaian manual.</p>}</div>
    </section>
  </div>;
};
export default WeeklyMasCharts;