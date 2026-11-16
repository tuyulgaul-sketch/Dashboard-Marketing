import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, ClipboardCheck, ClipboardList, Edit3, FileText, Lightbulb, Plus, Save, Trash2, X } from "lucide-react";
import type { InspireDraft, InspireRow, InspireStatus, InspireUnit } from "@/services/weeklyMarketingReviewService";

const UNIT_TITLES: Record<InspireUnit, string> = {
  DA: "DH DIGITAL & AFFINITY",
  MARCOMM: "DH MARKETING COMMUNICATION",
  MAS: "DH MARKETING ADMINISTRATION"
};
const markerColors = ["bg-[#276ab0]", "bg-[#98bc28]", "bg-[#e92036]"];
const makeEmpty = (unit: InspireUnit): InspireDraft => ({
  unit, title: "", rootCause: "", nextPlan: "", support: "", deliverable: "",
  rangeTime: "", status: "On Progress"
});
const fields: { name: keyof Pick<InspireDraft, "title" | "rootCause" | "nextPlan" | "support" | "deliverable" | "rangeTime">; placeholder: string }[] = [
  { name: "title", placeholder: "Apa (Issue)" },
  { name: "rootCause", placeholder: "Mengapa / Root Cause" },
  { name: "nextPlan", placeholder: "Next Plan / Tindak Lanjut" },
  { name: "support", placeholder: "Dukungan yang diperlukan" },
  { name: "deliverable", placeholder: "Hal yang dihasilkan" },
  { name: "rangeTime", placeholder: "Contoh: W4 November 2026" }
];
const icons = [
  { icon: ClipboardList, label: "Next Plan" },
  { icon: Lightbulb, label: "Support for Solution" },
  { icon: ClipboardCheck, label: "Items Deliverables" },
  { icon: CalendarClock, label: "Range Time" },
  { icon: FileText, label: "Status" }
];

type Props = {
  unit: InspireUnit;
  rows: InspireRow[];
  canEdit: boolean;
  loading: boolean;
  fullscreen?: boolean;
  onSave: (draft: InspireDraft, existingId?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const InspireTable: React.FC<Props> = ({ unit, rows, canEdit, loading, fullscreen = false, onSave, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InspireDraft>(() => makeEmpty(unit));
  const [saving, setSaving] = useState(false);
  const newRowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (editingId !== "NEW") return;
    const frame = requestAnimationFrame(() => {
      newRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [editingId]);
  useEffect(() => { setEditingId(null); setDraft(makeEmpty(unit)); }, [unit]);
  const beginAdd = () => { setDraft(makeEmpty(unit)); setEditingId("NEW"); };
  const beginEdit = (row: InspireRow) => {
    setDraft({ unit: row.unit, title: row.title, rootCause: row.rootCause, nextPlan: row.nextPlan, support: row.support, deliverable: row.deliverable, rangeTime: row.rangeTime, status: row.status });
    setEditingId(row.id);
  };
  const cancel = () => { setEditingId(null); setDraft(makeEmpty(unit)); };
  const setField = (key: keyof InspireDraft, value: string) =>
    setDraft(current => ({ ...current, [key]: value }));
  // Keep numbering when editing pasted multi-line text, not only at the
  // very end of the textarea. Read the live DOM value and current caret.
  // Shift+Enter remains a regular line break and paste content is untouched.
  const handleNumberedEnter = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    field: "rootCause" | "nextPlan"
  ) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey || event.ctrlKey || event.altKey || event.metaKey ||
      event.nativeEvent.isComposing
    ) return;

    const textarea = event.currentTarget;
    const value = textarea.value;
    const { selectionStart, selectionEnd } = textarea;
    if (selectionStart !== selectionEnd) return;

    const lineStart = value.slice(0, selectionStart).lastIndexOf("\n") + 1;
    const lineEndIndex = value.indexOf("\n", selectionStart);
    const lineEnd = lineEndIndex < 0 ? value.length : lineEndIndex;
    const prefix = value.slice(lineStart, selectionStart);
    const currentLine = value.slice(lineStart, lineEnd);
    const match = prefix.match(/^([ \t]*)(\d+)([.)])[ \t]*(.*)$/);

    let nextValue: string;
    let caret: number;
    if (match) {
      const [, indent, index, separator] = match;
      const itemText = currentLine.replace(/^[ \t]*\d+[.)][ \t]*/, "");
      if (!itemText.trim()) {
        // A second Enter on a blank numbered item ends the list.
        nextValue = value.slice(0, lineStart) +
          value.slice(lineEndIndex < 0 ? lineEnd : lineEnd + 1);
        caret = lineStart;
      } else {
        const nextNumber = Number(index) + 1;
        if (!Number.isSafeInteger(nextNumber)) return;
        const insert = "\n" + indent + nextNumber + separator + " ";
        nextValue = value.slice(0, selectionStart) + insert + value.slice(selectionStart);
        caret = selectionStart + insert.length;
      }
    } else if (
      // Pasted unnumbered paragraphs can start their first numbered list
      // even if more pasted lines exist below the caret.
      lineStart === 0 &&
      selectionStart === lineEnd &&
      prefix.trim() &&
      !/^[ \t]*\d+[.)][ \t]*/.test(currentLine)
    ) {
      const insert = "\n2. ";
      nextValue = "1. " + value.slice(0, selectionStart) +
        insert + value.slice(selectionStart);
      caret = 3 + selectionStart + insert.length;
    } else {
      return;
    }

    event.preventDefault();
    setField(field, nextValue);
    requestAnimationFrame(() => {
      if (textarea.isConnected) textarea.setSelectionRange(caret, caret);
    });
  };
  const save = async () => {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(draft, editingId === "NEW" ? undefined : editingId || undefined);
      cancel();
    } catch { /* Error details are displayed by the parent. Keep draft intact. */ }
    finally { setSaving(false); }
  };
  const remove = async (row: InspireRow) => {
    if (!window.confirm('Hapus baris "' + row.title + '" dari laporan minggu ini?')) return;
    setSaving(true);
    try { await onDelete(row.id); }
    catch { /* The parent will display the backend failure. */ }
    finally { setSaving(false); }
  };
  const inputRow = (id: string, index: number) => (
    <tr key={id} ref={id === "new-row" ? newRowRef : undefined} className="bg-blue-50/80 align-top">
      <td className="border border-slate-300 bg-[#2563a2] px-2 py-4 text-center text-xs font-bold text-white">{index}</td>
      {fields.map(field => <td key={field.name} className="border border-slate-300 p-2">
        <textarea
          aria-label={field.placeholder}
          value={draft[field.name]}
          onChange={event => setField(field.name, event.target.value)}
          onKeyDown={field.name === "rootCause" || field.name === "nextPlan" ? event => handleNumberedEnter(event, field.name as "rootCause" | "nextPlan") : undefined}
          placeholder={field.placeholder}
          rows={field.name === "title" || field.name === "rangeTime" ? 3 : 5}
          className="min-h-[88px] w-full resize-y rounded-md border border-blue-200 bg-white p-2 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-blue-300"
        />
      </td>)}
      <td className="border border-slate-300 p-2">
        <select aria-label="Status" value={draft.status} onChange={event => setField("status", event.target.value as InspireStatus)} className="w-full rounded-md border border-blue-200 bg-white p-2 text-xs focus:ring-2 focus:ring-blue-300">
          <option>On Progress</option><option>Done</option><option>Need Attention</option>
        </select>
      </td>
      <td className="border border-slate-300 p-2">
        <div className="flex flex-col gap-2">
          <button disabled={!draft.title.trim() || saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-1 rounded-md bg-[#17487d] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Save className="h-3.5 w-3.5" />Simpan</button>
          <button disabled={saving} onClick={cancel} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><X className="h-3.5 w-3.5" />Batal</button>
        </div>
      </td>
    </tr>
  );
  return (
    <section className={fullscreen ? "overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm" : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"}>
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <h2 className="text-xl font-extrabold uppercase tracking-wide text-[#3377ae] sm:text-2xl">LIST ACTION - {UNIT_TITLES[unit]}</h2>
          <div className="mt-2 flex h-1 w-48 gap-1"><span className="w-1/2 bg-[#347eb8]" /><span className="w-1/3 bg-[#8fae2d]" /><span className="flex-1 bg-[#e11d38]" /></div>
          <p className="mt-3 text-xs font-bold italic tracking-wide text-slate-900">LIST ACTION ITEM YANG PERLU DIMONITOR DAN DITINDAKLANJUTI</p>
        </div>
        {canEdit && <button type="button" disabled={Boolean(editingId) || loading || saving} onClick={beginAdd} className="inline-flex items-center gap-2 rounded-lg bg-[#17487d] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#12375d] disabled:opacity-40"><Plus className="h-4 w-4" />Tambah Baris</button>}
      </div>
      <div className={fullscreen ? "overflow-visible px-3 pb-5 sm:px-5" : "overflow-x-auto px-3 pb-5 sm:px-5"}>
        <table className="w-full min-w-[1470px] table-fixed border-collapse text-xs text-slate-900">
          <colgroup><col style={{ width: "4%" }} /><col style={{ width: "13%" }} /><col style={{ width: "16%" }} /><col style={{ width: "20%" }} /><col style={{ width: "14%" }} /><col style={{ width: "14%" }} /><col style={{ width: "10%" }} /><col style={{ width: "9%" }} />{canEdit && <col style={{ width: "9%" }} />}</colgroup>
          <thead className="bg-[#223963] text-white">
            <tr className="h-16">
              <th rowSpan={2} className="border border-white/30 px-2 py-3 text-center">NO</th>
              <th colSpan={2} className="border border-white/30 px-2 py-3 text-center">ITEMS TO SUPPORT (HAL PERLU DISUPPORT)</th>
              {icons.map(item => { const Icon = item.icon; return <th key={item.label} rowSpan={2} className="relative border border-white/30 px-2 pb-6 pt-3 text-center text-[10px] leading-4">
                {item.label === "Next Plan" ? "NEXT PLAN (TINDAK LANJUT)" : item.label === "Support for Solution" ? "SUPPORT FOR SOLUTION" : item.label === "Items Deliverables" ? "ITEMS DELIVERABLES (HAL YANG DIHASILKAN)" : item.label === "Range Time" ? "RANGE TIME NEED FOR COMPLETION" : "STATUS"}
                <span className="absolute -bottom-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#223963] bg-white text-[#223963] shadow-md"><Icon className="h-5 w-5" /></span>
              </th>; })}
              {canEdit && <th rowSpan={2} className="border border-white/30 px-2 py-3 text-center">AKSI</th>}
            </tr>
            <tr className="h-12"><th className="border border-white/30 px-2 py-3 text-center">APA (ISSUE)</th><th className="border border-white/30 px-2 py-3 text-center">MENGAPA (ROOT CAUSE)</th></tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && editingId !== "NEW" && <tr><td colSpan={canEdit ? 9 : 8} className="border border-slate-300 px-6 py-16 text-center text-sm text-slate-500">Belum ada action item untuk unit dan tanggal meeting ini. {canEdit ? "Klik Tambah Baris untuk mulai mengisi." : ""}</td></tr>}
            {loading && <tr><td colSpan={canEdit ? 9 : 8} className="border border-slate-300 px-6 py-12 text-center text-sm text-slate-500">Memuat list action...</td></tr>}
            {!loading && rows.map((row, index) => editingId === row.id ? inputRow(row.id, index + 1) :
              <tr key={row.id} className="align-middle hover:bg-slate-50">
                <td className={"border border-slate-300 px-2 py-6 text-center font-bold text-white " + markerColors[index % markerColors.length]}>{index + 1}</td>
                {[row.title, row.rootCause, row.nextPlan, row.support, row.deliverable, row.rangeTime].map((value, column) =>
                  <td key={column} className={"whitespace-pre-wrap break-words border border-slate-300 px-3 py-6 leading-5 " + ([0, 4, 5].includes(column) ? "text-center" : "text-left")}>{value || "—"}</td>
                )}
                <td className="border border-slate-300 px-2 py-6 text-center font-medium">{row.status}</td>
                {canEdit && <td className="border border-slate-300 px-2 py-6 text-center"><div className="flex flex-col gap-2">
                  <button type="button" disabled={Boolean(editingId) || saving} onClick={() => beginEdit(row)} className="inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40"><Edit3 className="h-3.5 w-3.5" />Edit</button>
                  <button type="button" disabled={Boolean(editingId) || saving} onClick={() => void remove(row)} className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />Hapus</button>
                </div></td>}
              </tr>
            )}
            {!loading && editingId === "NEW" && inputRow("new-row", rows.length + 1)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        <AlertTriangle className="h-4 w-4 shrink-0 text-slate-400" />
        {canEdit ? "Isi per baris, lalu Simpan. Di Root Cause dan Next Plan, Enter melanjutkan nomor otomatis; Shift+Enter membuat baris biasa. Tekan Enter pada nomor kosong untuk berhenti. Data tersimpan per tanggal meeting." : "Mode baca: akun Anda hanya dapat mengedit unit sendiri. Seluruh unit Marketing Support tetap bisa dilihat."}
      </div>
    </section>
  );
};
export default InspireTable;
