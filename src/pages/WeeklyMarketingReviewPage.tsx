import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { loadExcelJS } from "@/utils/exceljsLoader";
import { toast } from "sonner";
import InspireTable from "@/components/weekly/InspireTable";
import WeeklyMasCharts from "@/components/weekly/WeeklyMasCharts";
import { deleteWeeklyInspireRow, loadWeeklyInspireRows, saveWeeklyInspireRow, type InspireDraft, type InspireRow } from "@/services/weeklyMarketingReviewService";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BarChart3, CheckCircle2, ChevronDown,
  ClipboardList, Download, FileSpreadsheet, FileText, Info, LayoutDashboard,
  Maximize2, Megaphone, Minimize2, MonitorPlay, Plus, Printer, ShieldCheck, Trash2, UploadCloud
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Unit = "DA" | "MARCOMM" | "MAS";
type WorkStatus = "On Progress" | "Done" | "Need Attention";
type Activity = {
  id: string;
  unit: Unit;
  title: string;
  issue: string;
  nextPlan: string;
  support: string;
  deliverable: string;
  status: WorkStatus;
};
type ProductRow = { product: string; unit: "Captive" | "CRM"; segment: "Tender" | "Non Tender"; cases: number; premium: number };
type StatusRow = { segment: "Tender" | "Non Tender"; unit: "Captive" | "CRM"; status: string; cases: number; premium: number };
type View = "inspire" | "chart" | "input" | "presentation";

const UNITS: { id: Unit; name: string; short: string }[] = [
  { id: "DA", name: "Digital & Affinity", short: "DA" },
  { id: "MARCOMM", name: "Marketing Communication", short: "Marcomm" },
  { id: "MAS", name: "Marketing Administration", short: "MAS" }
];
const DEMO_ACTIVITIES: Activity[] = [
  { id: "demo-da", unit: "DA", title: "Pengembangan platform digital", issue: "Pemantauan penyempurnaan fitur aplikasi", nextPlan: "Validasi hasil pengujian dan outstanding", support: "Koordinasi lintas unit terkait prioritas", deliverable: "Kesiapan fitur untuk peluncuran", status: "On Progress" },
  { id: "demo-marcomm", unit: "MARCOMM", title: "Materi komunikasi produk", issue: "Penyusunan aset visual dan konten publikasi", nextPlan: "Finalisasi storyline dan materi komunikasi", support: "Persetujuan konsep komunikasi", deliverable: "Materi komunikasi siap digunakan", status: "Need Attention" },
  { id: "demo-mas", unit: "MAS", title: "Monitoring quotation", issue: "Rekap quotation dan proyeksi premi mingguan", nextPlan: "Konsolidasi data Captive dan CRM", support: "", deliverable: "Dashboard laporan quotation", status: "On Progress" }
];
const DEMO_PRODUCTS: ProductRow[] = [
  { product: "Managed Care", unit: "Captive", segment: "Non Tender", cases: 42, premium: 21000000000 },
  { product: "MAPS", unit: "Captive", segment: "Non Tender", cases: 88, premium: 12500000000 },
  { product: "Medicare Plan", unit: "CRM", segment: "Tender", cases: 20, premium: 18000000000 },
  { product: "Executive Severance", unit: "CRM", segment: "Non Tender", cases: 16, premium: 7000000000 },
  { product: "Annuity PIPA", unit: "CRM", segment: "Non Tender", cases: 55, premium: 14000000000 }
];
const DEMO_STATUS: StatusRow[] = [
  { segment: "Tender", unit: "CRM", status: "Closing", cases: 11, premium: 13000000000 },
  { segment: "Tender", unit: "CRM", status: "Feedback Marketing", cases: 9, premium: 5000000000 },
  { segment: "Non Tender", unit: "Captive", status: "Closing", cases: 115, premium: 30000000000 },
  { segment: "Non Tender", unit: "Captive", status: "On Proses", cases: 15, premium: 3500000000 },
  { segment: "Non Tender", unit: "CRM", status: "Closing", cases: 62, premium: 15000000000 },
  { segment: "Non Tender", unit: "CRM", status: "Feedback Teknik", cases: 9, premium: 6000000000 }
];

const compactNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);
const rupiahCompact = (value: number) =>
  value >= 1e12 ? "Rp " + (value / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " T" :
  value >= 1e9 ? "Rp " + (value / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M" :
  "Rp " + compactNumber(value);
const currentDate = () => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
};
const asText = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    if ("text" in value) return String((value as { text: unknown }).text);
    if ("result" in value) return asText((value as { result: unknown }).result);
    if ("richText" in value) return ((value as { richText: Array<{ text: string }> }).richText || []).map(part => part.text).join("");
  }
  return String(value).trim();
};
const asNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const numeric = Number(asText(value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : 0;
};
const statusClass = (status: WorkStatus) =>
  status === "Done" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
  status === "Need Attention" ? "bg-rose-50 text-rose-700 border-rose-200" :
  "bg-amber-50 text-amber-700 border-amber-200";

const Panel: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = "" }) => (
  <section className={"rounded-2xl border border-slate-200 bg-white shadow-sm " + className}>
    <div className="border-b border-slate-100 px-5 py-4">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const WeeklyMarketingReviewPage: React.FC = () => {
  const { profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const inspireRootRef = useRef<HTMLDivElement>(null);
  const inspireScrollRef = useRef<HTMLDivElement>(null);
  const dragOrigin = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const [inspireFullscreen, setInspireFullscreen] = useState(false);
  const [inspireZoom, setInspireZoom] = useState(1);
  const [inspireDragging, setInspireDragging] = useState(false);
  const [view, setView] = useState<View>("inspire");
  const [week, setWeek] = useState(currentDate);
  const [demoMode, setDemoMode] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [inspireRows, setInspireRows] = useState<InspireRow[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [selectedInspireUnit, setSelectedInspireUnit] = useState<Unit>("DA");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [importName, setImportName] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [slide, setSlide] = useState(0);
  const department = (profile?.department || "").trim().toLowerCase();
  const ownUnit: Unit | null = department === "digital & affinity" ? "DA" : department === "marketing communication" ? "MARCOMM" : department === "marketing administration" ? "MAS" : null;
  const [inputUnit, setInputUnit] = useState<Unit>(ownUnit || "DA");
  const [draft, setDraft] = useState({ title: "", issue: "", nextPlan: "", support: "", deliverable: "", status: "On Progress" as WorkStatus });

  // Native browser fullscreen when allowed; fixed viewport acts as fallback.
  // Keep INSPIRE mounted so partially completed entries are not lost.
  const enterInspireFullscreen = () => {
    setInspireFullscreen(true);
    setInspireZoom(1);
    const element = inspireRootRef.current;
    if (element?.requestFullscreen && !document.fullscreenElement) {
      void element.requestFullscreen().catch(() => {});
    }
  };
  const leaveInspireFullscreen = () => {
    setInspireFullscreen(false);
    setInspireZoom(1);
    setInspireDragging(false);
    dragOrigin.current = null;
    if (document.fullscreenElement === inspireRootRef.current) {
      void document.exitFullscreen().catch(() => {});
    }
  };
  useEffect(() => {
    if (!inspireFullscreen) return;
    const onChange = () => {
      if (!document.fullscreenElement) {
        setInspireFullscreen(false);
        setInspireZoom(1);
        setInspireDragging(false);
        dragOrigin.current = null;
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        setInspireFullscreen(false);
        setInspireZoom(1);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("keydown", onEscape);
    };
  }, [inspireFullscreen]);
  useEffect(() => {
    if (!inspireFullscreen) return;
    const container = inspireScrollRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setInspireZoom(value =>
        Math.min(2, Math.max(0.55, Number((value + (event.deltaY < 0 ? 0.1 : -0.1)).toFixed(2))))
      );
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [inspireFullscreen]);
  const startInspirePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!inspireFullscreen || event.button !== 0 || event.pointerType !== "mouse") return;
    if ((event.target as Element).closest("button,input,textarea,select,a,[contenteditable='true']")) return;
    const viewport = event.currentTarget;
    dragOrigin.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      left: viewport.scrollLeft, top: viewport.scrollTop
    };
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveInspirePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    event.currentTarget.scrollLeft = origin.left - dx;
    event.currentTarget.scrollTop = origin.top - dy;
    if (Math.abs(dx) + Math.abs(dy) > 3) setInspireDragging(true);
  };
  const endInspirePan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current?.pointerId !== event.pointerId) return;
    dragOrigin.current = null;
    setInspireDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => { if (ownUnit) setSelectedInspireUnit(ownUnit); }, [ownUnit]);
  const toActivity = (row: InspireRow): Activity => ({
    id: row.id, unit: row.unit, title: row.title, issue: row.rootCause,
    nextPlan: row.nextPlan, support: row.support, deliverable: row.deliverable, status: row.status
  });
  useEffect(() => {
    let alive = true;
    setActionsLoading(true);
    loadWeeklyInspireRows(week).then(rows => {
      if (!alive) return;
      setInspireRows(rows);
      setActivities(rows.map(toActivity));
    }).catch(error => {
      if (!alive) return;
      toast.error("Gagal memuat INSPIRE: " + (error instanceof Error ? error.message : "Coba ulang."));
    }).finally(() => { if (alive) setActionsLoading(false); });
    return () => { alive = false; };
  }, [week, profile?.id]);
  const saveInspire = async (draft: InspireDraft, id?: string) => {
    if (ownUnit && ownUnit !== draft.unit) throw new Error("Tidak boleh mengubah baris unit lain.");
    try {
      const saved = await saveWeeklyInspireRow(week, draft, id);
      const next = id ? inspireRows.map(row => row.id === id ? saved : row) : [...inspireRows, saved];
      setInspireRows(next);
      setActivities(next.map(toActivity));
      toast.success("Baris INSPIRE berhasil disimpan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan baris."); throw error; }
  };
  const deleteInspire = async (id: string) => {
    const existing = inspireRows.find(row => row.id === id);
    if (!existing || (ownUnit && ownUnit !== existing.unit)) throw new Error("Akses tidak diizinkan.");
    try {
      await deleteWeeklyInspireRow(week, id);
      const next = inspireRows.filter(row => row.id !== id);
      setInspireRows(next);
      setActivities(next.map(toActivity));
      toast.success("Baris berhasil dihapus.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus baris."); throw error; }
  };
  const shownActivities = activities;
  const shownProducts = demoMode ? DEMO_PRODUCTS : products;
  const shownStatuses = demoMode ? DEMO_STATUS : statuses;
  const totalCases = shownProducts.reduce((sum, row) => sum + row.cases, 0);
  const totalPremium = shownProducts.reduce((sum, row) => sum + row.premium, 0);
  const tenderCases = shownProducts.filter(row => row.segment === "Tender").reduce((sum, row) => sum + row.cases, 0);
  const attention = shownActivities.filter(item => item.status === "Need Attention");
  const finished = shownActivities.filter(item => item.status === "Done").length;
  const productChart = useMemo(() => {
    const map = new Map<string, { name: string; captive: number; crm: number }>();
    shownProducts.forEach(row => {
      const item = map.get(row.product) || { name: row.product, captive: 0, crm: 0 };
      if (row.unit === "Captive") item.captive += row.cases;
      else item.crm += row.cases;
      map.set(row.product, item);
    });
    return [...map.values()].sort((a, b) => b.captive + b.crm - a.captive - a.crm).slice(0, 6);
  }, [shownProducts]);
  const segmentChart = useMemo(() => (["Captive", "CRM"] as const).map(unit => ({
    name: unit, tender: shownProducts.filter(row => row.unit === unit && row.segment === "Tender").reduce((n, row) => n + row.cases, 0),
    nonTender: shownProducts.filter(row => row.unit === unit && row.segment === "Non Tender").reduce((n, row) => n + row.cases, 0)
  })), [shownProducts]);
  const statusChart = useMemo(() => {
    const grouped = new Map<string, { name: string; closing: number; pending: number; cancel: number }>();
    shownStatuses.forEach(row => {
      const key = row.unit + " · " + row.segment;
      const item = grouped.get(key) || { name: key, closing: 0, pending: 0, cancel: 0 };
      const keyStatus = row.status.toLowerCase();
      if (keyStatus.includes("closing")) item.closing += row.cases;
      else if (keyStatus.includes("cancel")) item.cancel += row.cases;
      else item.pending += row.cases;
      grouped.set(key, item);
    });
    return [...grouped.values()];
  }, [shownStatuses]);
  const qc = useMemo(() => {
    const issues: string[] = [];
    if (!shownProducts.length || !shownStatuses.length) return issues;
    for (const unit of ["Captive", "CRM"] as const) for (const segment of ["Tender", "Non Tender"] as const) {
      const casesByProduct = shownProducts.filter(row => row.unit === unit && row.segment === segment).reduce((sum, row) => sum + row.cases, 0);
      const casesByStatus = shownStatuses.filter(row => row.unit === unit && row.segment === segment).reduce((sum, row) => sum + row.cases, 0);
      const premiumByProduct = shownProducts.filter(row => row.unit === unit && row.segment === segment).reduce((sum, row) => sum + row.premium, 0);
      const premiumByStatus = shownStatuses.filter(row => row.unit === unit && row.segment === segment).reduce((sum, row) => sum + row.premium, 0);
      if (casesByProduct !== casesByStatus) issues.push(unit + " " + segment + ": selisih jumlah case " + compactNumber(Math.abs(casesByProduct - casesByStatus)));
      if (Math.abs(premiumByProduct - premiumByStatus) > 1) issues.push(unit + " " + segment + ": selisih nilai premi " + rupiahCompact(Math.abs(premiumByProduct - premiumByStatus)));
    }
    return issues;
  }, [shownProducts, shownStatuses]);

  const resetDemo = () => { setDemoMode(false); setProducts([]); setStatuses([]); setImportName(""); toast.info("Data contoh grafik dikosongkan; data INSPIRE tetap tersimpan."); };
  const addActivity = () => {
    if (!draft.title.trim()) return toast.error("Nama aktivitas wajib diisi.");
    if (ownUnit && inputUnit !== ownUnit) return toast.error("Input dibatasi untuk unit akun Anda.");
    setDemoMode(false);
    setActivities(current => [...current, { ...draft, unit: ownUnit || inputUnit, title: draft.title.trim(), id: "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }]);
    setDraft({ title: "", issue: "", nextPlan: "", support: "", deliverable: "", status: "On Progress" });
    toast.success("Aktivitas ditambahkan untuk sesi preview ini.");
  };

  const importExcel = async (file: File) => {
    setImportBusy(true);
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error("Gunakan file .xlsx dengan sheet INPUT_MAS.");
      const Excel = await loadExcelJS();
      const workbook = new Excel.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer() as never);
      const sheet = workbook.getWorksheet("INPUT_MAS");
      if (!sheet) throw new Error("Sheet INPUT_MAS tidak ditemukan. Gunakan template Weekly MAS.");
      if (asText(sheet.getCell("A8").value).toLowerCase() !== "produk" || asText(sheet.getCell("J8").value).toLowerCase() !== "jenis bisnis") {
        throw new Error("Struktur kolom tidak sesuai template INPUT_MAS.");
      }
      const nextProducts: ProductRow[] = [];
      const nextStatuses: StatusRow[] = [];
      for (let i = 9; i <= Math.min(sheet.rowCount, 3000); i += 1) {
        const prod = asText(sheet.getCell("A" + i).value);
        const unit = asText(sheet.getCell("B" + i).value);
        const segment = asText(sheet.getCell("C" + i).value);
        if (prod && (unit === "CRM" || unit === "Captive") && (segment === "Tender" || segment === "Non Tender")) {
          nextProducts.push({ product: prod, unit, segment, cases: Math.max(0, asNumber(sheet.getCell("D" + i).value)), premium: Math.max(0, asNumber(sheet.getCell("E" + i).value)) });
        }
        const seg = asText(sheet.getCell("J" + i).value);
        const su = asText(sheet.getCell("K" + i).value);
        const stat = asText(sheet.getCell("L" + i).value);
        if ((seg === "Tender" || seg === "Non Tender") && (su === "Captive" || su === "CRM") && stat) {
          nextStatuses.push({ segment: seg, unit: su, status: stat, cases: Math.max(0, asNumber(sheet.getCell("M" + i).value)), premium: Math.max(0, asNumber(sheet.getCell("N" + i).value)) });
        }
      }
      if (!nextProducts.length) throw new Error("Tidak ada baris produk valid pada sheet INPUT_MAS.");
      if (!nextStatuses.length) toast.warning("Data status case kosong; grafik status belum dapat ditampilkan.");
      setProducts(nextProducts);
      setStatuses(nextStatuses);
      setDemoMode(false);
      setImportName(file.name);
      toast.success("Excel dibaca: " + nextProducts.length + " baris produk, " + nextStatuses.length + " baris status.");
      setView("overview");
    } catch (error) { toast.error(error instanceof Error ? error.message : "File Excel gagal dibaca."); }
    finally { setImportBusy(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const downloadTemplate = async () => {
    try {
      const Excel = await loadExcelJS();
      const wb = new Excel.Workbook();
      const ws = wb.addWorksheet("INPUT_MAS");
      ws.mergeCells("A1:G1"); ws.getCell("A1").value = "DATA QUOTATION & PREMI — MARKETING ADMINISTRATION";
      ws.mergeCells("J1:P1"); ws.getCell("J1").value = "STATUS CASE & PREMI — MARKETING ADMINISTRATION";
      ["Produk", "Unit", "Jenis Bisnis", "Jumlah Case", "Proyeksi Premi (Rp)", "Sumber", "Catatan"].forEach((value, index) => ws.getCell(8, index + 1).value = value);
      ["Jenis Bisnis", "Unit", "Status Case", "Jumlah Case", "Proyeksi Premi (Rp)", "Sumber", "Catatan"].forEach((value, index) => ws.getCell(8, index + 10).value = value);
      ws.getRow(8).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123B70" } };
      ws.columns.forEach(col => { col.width = 21; });
      ws.getColumn("A").width = 30; ws.getColumn("L").width = 27;
      ws.views = [{ state: "frozen", ySplit: 8 }];
      const bytes = await wb.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a"); link.href = url; link.download = "Template_Kosong_Weekly_MAS.xlsx"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error("Template belum dapat dibuat. Coba kembali."); }
  };

  const cards = [
    { label: "Aktivitas MS", value: compactNumber(shownActivities.length), foot: "DA · Marcomm · MAS", icon: ClipboardList, color: "text-blue-700", tint: "bg-blue-50" },
    { label: "Perlu perhatian", value: compactNumber(attention.length), foot: "Dukungan / keputusan", icon: AlertTriangle, color: "text-amber-700", tint: "bg-amber-50" },
    { label: "Total quotation", value: compactNumber(totalCases), foot: "Captive dan CRM", icon: BarChart3, color: "text-violet-700", tint: "bg-violet-50" },
    { label: "Proyeksi premi", value: rupiahCompact(totalPremium), foot: "Dari Excel MAS", icon: FileSpreadsheet, color: "text-emerald-700", tint: "bg-emerald-50" }
  ];
  const viewTabs: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "inspire", label: "INSPIRE", icon: ClipboardList },
    { id: "chart", label: "CHART", icon: BarChart3 }
  ];

  const slideTitle = ["Cover", "Executive Summary", "Digital & Affinity", "Marketing Communication", "Marketing Administration", "Quotation & Premi", "Director Attention", "Action Plan"];
  const activityList = (unit: Unit) => shownActivities.filter(item => item.unit === unit);
  const activityDetail = (unit: Unit) => (
    <div className="space-y-3">
      {activityList(unit).length === 0 ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">Belum ada aktivitas untuk unit ini.</p> :
        activityList(unit).map(item => (
          <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
              <span className={"rounded-full border px-2.5 py-1 text-[10px] font-bold " + statusClass(item.status)}>{item.status}</span>
            </div>
            <div className="mt-3 grid gap-3 text-xs leading-5 text-slate-600 sm:grid-cols-2">
              <p><span className="block font-bold text-slate-800">Issue / Aktivitas</span>{item.issue || "—"}</p>
              <p><span className="block font-bold text-slate-800">Tindak Lanjut</span>{item.nextPlan || "—"}</p>
              <p><span className="block font-bold text-slate-800">Deliverable</span>{item.deliverable || "—"}</p>
              <p><span className="block font-bold text-slate-800">Support Needed</span>{item.support || "—"}</p>
            </div>
            {view === "input" && !demoMode && (!ownUnit || ownUnit === unit) && (
              <button type="button" onClick={() => setActivities(rows => rows.filter(row => row.id !== item.id))} className="no-print mt-3 flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-800"><Trash2 className="h-3.5 w-3.5" />Hapus dari preview</button>
            )}
          </div>
        ))}
    </div>
  );

  const slideBody = (i: number) => {
    if (i === 0) return <div className="flex min-h-[400px] flex-col justify-between rounded-xl bg-gradient-to-br from-[#102e55] to-[#1874bd] p-8 text-white sm:p-12">
      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-200">PertaLife · Marketing Directorate</div>
      <div><p className="mb-3 text-sm font-semibold text-blue-200">Executive presentation</p><h2 className="max-w-2xl text-4xl font-black leading-tight sm:text-5xl">Weekly Marketing Review</h2><p className="mt-5 text-base text-blue-100">{week} · Digital & Affinity · Marcomm · MAS</p></div>
      <div className="flex justify-between border-t border-white/25 pt-5 text-xs text-blue-100"><span>Life, Health & Pension</span><span>{demoMode ? "CHART ILUSTRASI" : "CHART SESI BROWSER"}</span></div>
    </div>;
    if (i === 1) return <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">{cards.map(card => <div key={card.label} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-medium text-slate-500">{card.label}</p><p className="mt-2 text-3xl font-black text-slate-900">{card.value}</p></div>)}</div>
      <div className="rounded-xl border border-slate-200 p-5"><p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Status aktivitas lintas unit</p><div className="flex flex-wrap gap-4 text-sm"><span className="text-emerald-700">{finished} selesai</span><span className="text-amber-700">{shownActivities.filter(a => a.status === "On Progress").length} berjalan</span><span className="text-rose-700">{attention.length} perlu perhatian</span></div></div>
    </div>;
    if (i >= 2 && i <= 4) return activityDetail(UNITS[i - 2].id);
    if (i === 5) return <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">{[{ title: "Quotation", value: compactNumber(totalCases) }, { title: "Tender", value: compactNumber(tenderCases) }, { title: "Proyeksi premi", value: rupiahCompact(totalPremium) }].map(item => <div key={item.title} className="rounded-xl bg-blue-50 p-4"><p className="text-xs text-slate-500">{item.title}</p><p className="mt-2 text-xl font-black text-blue-950">{item.value}</p></div>)}</div>
      <div className="space-y-3">{productChart.length ? productChart.slice(0, 5).map(item => <div key={item.name} className="grid grid-cols-[130px_1fr_45px] items-center gap-3 text-xs"><span className="truncate font-semibold">{item.name}</span><div className="flex h-3 overflow-hidden rounded-full bg-slate-100"><div className="bg-[#185ba5]" style={{ width: (100 * item.captive / Math.max(1, productChart[0].captive + productChart[0].crm)) + "%" }} /><div className="bg-[#88b923]" style={{ width: (100 * item.crm / Math.max(1, productChart[0].captive + productChart[0].crm)) + "%" }} /></div><span className="text-right font-bold">{compactNumber(item.captive + item.crm)}</span></div>) : <p className="text-sm text-slate-500">Upload Excel MAS untuk menampilkan grafik.</p>}</div>
      <p className="text-[11px] text-slate-500">Biru = Captive · Hijau = CRM · Grafik jumlah quotation per produk</p>
    </div>;
    if (i === 6) return attention.length ? <div className="space-y-4">{attention.map(item => <div key={item.id} className="rounded-xl border-l-4 border-rose-400 bg-rose-50/60 p-5"><p className="text-xs font-bold uppercase text-rose-700">{UNITS.find(u => u.id === item.unit)?.name}</p><h3 className="mt-2 text-lg font-bold text-slate-900">{item.title}</h3><p className="mt-3 text-sm text-slate-600">{item.issue || "—"}</p><p className="mt-3 text-sm font-semibold text-rose-800">Dukungan: {item.support || "Belum diisi"}</p></div>)}</div> : <div className="rounded-xl border border-slate-200 p-10 text-center text-slate-500">Belum ada aktivitas berstatus Need Attention.</div>;
    return <div className="space-y-3">{shownActivities.filter(item => item.status !== "Done").map((item, index) => <div key={item.id} className="grid grid-cols-[30px_1fr_auto] gap-3 rounded-xl border border-slate-200 p-4 text-sm"><span className="font-black text-blue-700">{index + 1}</span><div><p className="font-bold">{item.title}</p><p className="mt-1 text-slate-500">{item.nextPlan || "Tindak lanjut belum diisi"}</p></div><span className="text-[10px] font-bold text-slate-400">{item.unit}</span></div>)}{!shownActivities.length && <p className="text-sm text-slate-500">Belum ada action plan.</p>}</div>;
  };

  return <AppLayout>
    <style>{"@media print { @page { size: landscape; margin: 10mm; } body { background: white!important; } header, aside, .no-print { display:none!important; } main { max-width: none!important; padding: 0!important; } #weekly-print[data-active=true] { display:block!important; } .weekly-print-slide { display:block!important; break-after:page; page-break-after:always; padding:8mm; min-height:165mm; box-shadow:none!important; border:0!important; } .weekly-print-slide:last-child { break-after:auto;page-break-after:auto; } }"}</style>
    <div className={view === "chart" ? "space-y-6" : "no-print space-y-6"}>
      <div className="no-print overflow-hidden rounded-2xl bg-gradient-to-r from-[#0e2b4f] to-[#155c9f] px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-200"><ShieldCheck className="h-4 w-4" /> Khusus Marketing Support</div><h1 className="mt-3 text-2xl font-black sm:text-3xl">Weekly Marketing Review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">Satu bahan presentasi gabungan Digital & Affinity, Marketing Communication, dan Marketing Administration.</p></div>
          <div className="rounded-xl border border-white/20 bg-white/10 p-3"><label htmlFor="weekly-date" className="block text-[10px] font-semibold uppercase text-blue-200">Tanggal meeting</label><input id="weekly-date" type="date" value={week} onChange={e => setWeek(e.target.value)} className="mt-2 block rounded-md border border-white/20 bg-white px-3 py-2 text-xs font-semibold text-slate-900" /></div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold">{demoMode ? "INSPIRE tersimpan · CHART data contoh" : "INSPIRE tersimpan · CHART sesi browser"}</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold">Tanpa approval koordinator</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold">PDF dari tampilan presentasi</span>
        </div>
      </div>
      <div className="no-print flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
        {viewTabs.map(tab => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setView(tab.id)} className={"flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition " + (view === tab.id ? "bg-[#154a83] text-white" : "text-slate-500 hover:bg-slate-100")}><Icon className="h-4 w-4" />{tab.label}</button>; })}
        {demoMode && <button type="button" onClick={resetDemo} className="ml-auto rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Kosongkan contoh</button>}
      </div>
      {view === "chart" && <WeeklyMasCharts meetingDate={week} canManage={department === "marketing administration" || department === ""} />}
      {view === "inspire" && <div
        ref={inspireRootRef}
        className={inspireFullscreen
          ? "fixed inset-0 z-[1000] flex min-h-0 flex-col gap-3 overflow-hidden bg-slate-100 p-3 sm:p-4"
          : "space-y-4"}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pilih unit INSPIRE">
            {UNITS.map(unit => <button key={unit.id} type="button" role="tab" aria-selected={selectedInspireUnit === unit.id} onClick={() => setSelectedInspireUnit(unit.id)} className={"rounded-lg px-5 py-2.5 text-xs font-bold transition " + (selectedInspireUnit === unit.id ? "bg-[#17487d] text-white shadow-sm" : "bg-slate-50 text-slate-600 hover:bg-slate-100")}>{unit.short.toUpperCase()}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {inspireFullscreen && <span className="hidden text-xs font-medium text-slate-500 sm:inline">Ctrl + Scroll: zoom ({Math.round(inspireZoom * 100)}%) · Klik-tahan & geser: pan · Esc: keluar</span>}
            <button type="button" onClick={inspireFullscreen ? leaveInspireFullscreen : enterInspireFullscreen}
              className="inline-flex items-center gap-2 rounded-lg bg-[#17487d] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#10365e]">
              {inspireFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {inspireFullscreen ? "Keluar Full Screen" : "Full Screen"}
            </button>
          </div>
        </div>
        <div
          ref={inspireScrollRef}
          className={inspireFullscreen
            ? "min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg bg-slate-100"
            : "overflow-visible"}
          style={inspireFullscreen ? { cursor: inspireDragging ? "grabbing" : "grab", userSelect: inspireDragging ? "none" : "auto" } : undefined}
          onPointerDown={startInspirePan}
          onPointerMove={moveInspirePan}
          onPointerUp={endInspirePan}
          onPointerCancel={endInspirePan}
          onLostPointerCapture={() => { dragOrigin.current = null; setInspireDragging(false); }}
        >
          <div style={inspireFullscreen ? { zoom: inspireZoom } : undefined}>
            <InspireTable
              key={week + selectedInspireUnit}
              unit={selectedInspireUnit}
              rows={inspireRows.filter(row => row.unit === selectedInspireUnit)}
              canEdit={!ownUnit || ownUnit === selectedInspireUnit}
              loading={actionsLoading}
              fullscreen={inspireFullscreen}
              onSave={saveInspire}
              onDelete={deleteInspire}
            />
          </div>
        </div>
      </div>}
      {view === "presentation" && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900"><Info className="mr-1 inline h-4 w-4" />Preview gabungan 8 slide. Bagian INSPIRE sudah mengambil data tersimpan per tanggal meeting; grafik MAS masih menggunakan data sesi browser. Gunakan Cetak / Simpan PDF untuk ekspor.</div>}
    </div>
    <div id="weekly-print" data-active={view === "presentation" ? "true" : "false"} className={view === "presentation" ? "mt-5" : "hidden"}>
      {view === "presentation" && <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><button type="button" onClick={() => setView("chart")} className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft className="h-3.5 w-3.5"/>Kembali ke CHART</button><p className="text-xs font-bold uppercase text-slate-500">Slide {slide + 1} dari 8</p><h3 className="mt-1 text-lg font-bold">{slideTitle[slide]}</h3></div>
        <div className="flex gap-2"><button type="button" disabled={slide === 0} onClick={() => setSlide(v => Math.max(0, v - 1))} className="rounded-lg border border-slate-200 bg-white p-2.5 disabled:opacity-40"><ArrowLeft className="h-4 w-4" /></button><button type="button" disabled={slide === 7} onClick={() => setSlide(v => Math.min(7, v + 1))} className="rounded-lg border border-slate-200 bg-white p-2.5 disabled:opacity-40"><ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#154a83] px-4 py-2 text-xs font-bold text-white"><Printer className="h-4 w-4" />Cetak / Simpan PDF</button></div>
      </div>}
      {slideTitle.map((title, index) => <section key={title} className={"weekly-print-slide rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 " + (view === "presentation" && slide === index ? "block" : "hidden")}>
        {index !== 0 && <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-700">PertaLife · Weekly Marketing Review</p><h2 className="mt-2 text-2xl font-black text-slate-900">{title}</h2></div><p className="text-xs text-slate-400">{week} · {String(index + 1).padStart(2, "0")}/08</p></div>}
        {slideBody(index)}
        {index !== 0 && <div className="mt-8 flex justify-between border-t border-slate-100 pt-4 text-[10px] text-slate-400"><span>Marketing Support · Internal Working Material</span><span>{demoMode ? "CHART ILUSTRASI" : "CHART SESI BROWSER"}</span></div>}
      </section>)}
      {view === "presentation" && <div className="no-print mt-4 flex flex-wrap gap-2">{slideTitle.map((title, i) => <button key={title} type="button" onClick={() => setSlide(i)} className={"rounded-md px-3 py-2 text-[11px] font-semibold " + (slide === i ? "bg-blue-700 text-white" : "border border-slate-200 bg-white text-slate-600")}>{i + 1}. {title}</button>)}</div>}
    </div>
  </AppLayout>;
};

export default WeeklyMarketingReviewPage;
