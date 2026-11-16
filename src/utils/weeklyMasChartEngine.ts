import { loadExcelJS } from "@/utils/exceljsLoader";

export type MasUnit = "Captive" | "CRM";
export type MasSegment = "Tender" | "Non Tender" | "Unclassified";
export type MasStatus = "Closing" | "Cancel" | "Feedback Marketing" | "Feedback Teknik" | "On Proses" | "Belum Terklasifikasi";
export type MasBucket = { unit: MasUnit; segment: MasSegment; product: string; status: MasStatus; cases: number; premium: number };
export type MasMeta = {
  rows: Record<MasUnit, number>;
  missingProduct: number;
  missingSegment: number;
  missingStatus: number;
  invalidPremium: number;
  unknownStatus: number;
  unknownSegment: number;
  normalizedStatus: number;
  notes: string[];
};
export type MasParsed = { buckets: MasBucket[]; meta: MasMeta };
export type MasOverride = {
  id: string;
  meeting_date: string;
  unit: MasUnit;
  business_type: "Tender" | "Non Tender";
  product: string;
  status: MasStatus | "ALL";
  method: "REPLACE" | "DELTA";
  cases: number | null;
  premium: number | null;
  reason: string;
};
export type MasFinalGroup = {
  unit: MasUnit; segment: MasSegment; product: string;
  cases: number; premium: number; baselineCases: number; baselinePremium: number;
};
export type MasFinalStatus = {
  unit: MasUnit; segment: MasSegment; product: string; status: MasStatus;
  cases: number; premium: number;
};
export type MasResults = { groups: MasFinalGroup[]; statuses: MasFinalStatus[]; warnings: string[] };

const PRODUCT_CANON: Record<string, string> = {
  "personal accident": "Personal Accident",
  "annuity pipa": "Annuity PIPA",
  "plife shield": "PLife Shield",
  "maps": "MAPS",
  "medicare plan": "Medicare Plan",
  "managed care": "Managed Care",
  "group term life": "Group Term Life",
  "executive severance": "Executive Severance",
  "orphanage scholarship": "Orphanage Scholarship",
  "group credit shield": "Group Credit Shield",
  "mandiri guna iii": "Mandiri Guna III",
  "group severance program": "Group Severance Program",
  "health guard": "Health Guard",
  "severance": "Severance"
};
const clean = (raw: string) => raw.replace(/\s+/g, " ").trim();
const keyOf = (unit: string, segment: string, product: string) => [unit, segment, product.toLowerCase()].join("|");
const bucketKey = (unit: string, segment: string, product: string, status: string) => [unit, segment, product.toLowerCase(), status].join("|");
const canonProduct = (name: string) => PRODUCT_CANON[clean(name).toLowerCase()] || clean(name);

export const normalizeMasSegment = (value: string): MasSegment => {
  const v = clean(value).toLowerCase().replace(/[_-]/g, " ");
  if (v === "tender") return "Tender";
  if (v === "non tender" || v === "nontender") return "Non Tender";
  return "Unclassified";
};
export const normalizeMasStatus = (value: string): MasStatus => {
  const v = clean(value).toLowerCase();
  if (v === "closing" || v === "closed") return "Closing";
  if (v === "cancel" || v === "cancelled" || v === "canceled") return "Cancel";
  if (v === "feedback marketing") return "Feedback Marketing";
  if (v === "feedback teknik") return "Feedback Teknik";
  if (v === "on proses" || v === "on process" || v === "on progress") return "On Proses";
  return "Belum Terklasifikasi";
};
const valueText = (raw: unknown): string => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object") {
    const data = raw as Record<string, unknown>;
    if ("result" in data) return valueText(data.result);
    if (Array.isArray(data.richText)) return data.richText.map((v: unknown) => valueText((v as { text?: unknown }).text)).join("");
    if ("text" in data) return valueText(data.text);
  }
  return String(raw).trim();
};
const valueMoney = (raw: unknown): { amount: number; invalid: boolean } => {
  if (raw === null || raw === undefined || raw === "") return { amount: 0, invalid: false };
  if (typeof raw === "number") return { amount: Number.isFinite(raw) ? raw : 0, invalid: !Number.isFinite(raw) };
  const text = valueText(raw).replace(/[^\d.,()-]/g, "").replace(/[()]/g, "-");
  if (!text) return { amount: 0, invalid: true };
  const lastComma = text.lastIndexOf(","), lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
  } else if (lastDot >= 0) {
    normalized = /^-?\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
  }
  const result = Number(normalized);
  return { amount: Number.isFinite(result) ? result : 0, invalid: !Number.isFinite(result) };
};

/** Reads only aggregated values; company, client, and participant identities never leave the browser. */
export const parseWeeklyMasFile = async (file: File): Promise<MasParsed> => {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Gunakan file Excel .xlsx.");
  if (file.size > 25 * 1024 * 1024) throw new Error("File lebih dari 25 MB. Kurangi ukuran workbook terlebih dahulu.");
  const Excel = await loadExcelJS();
  const wb = new Excel.Workbook();
  await wb.xlsx.load(await file.arrayBuffer() as never);
  const configs: { sheet: string; unit: MasUnit; segmentColumn: string; statusColumn: string }[] = [
    { sheet: "DATA CAPTIVE", unit: "Captive", segmentColumn: "P", statusColumn: "Q" },
    { sheet: "DATA CRM", unit: "CRM", segmentColumn: "O", statusColumn: "P" }
  ];
  const meta: MasMeta = {
    rows: { Captive: 0, CRM: 0 }, missingProduct: 0, missingSegment: 0, missingStatus: 0,
    invalidPremium: 0, unknownSegment: 0, unknownStatus: 0, normalizedStatus: 0, notes: []
  };
  const aggregate = new Map<string, MasBucket>();
  for (const config of configs) {
    const sheet = wb.getWorksheet(config.sheet);
    if (!sheet) throw new Error('Sheet "' + config.sheet + '" tidak ditemukan.');
    if (clean(valueText(sheet.getCell("F6").value)).toLowerCase() !== "produk" ||
      clean(valueText(sheet.getCell("J6").value)).toLowerCase() !== "premi terakhir" ||
      clean(valueText(sheet.getCell(config.segmentColumn + "6").value)).toLowerCase() !== "status") {
      throw new Error('Struktur kolom sheet "' + config.sheet + '" tidak sesuai workbook sumber (header baris 6).');
    }
    for (let i = 7; i <= sheet.rowCount; i++) {
      const productText = clean(valueText(sheet.getCell("F" + i).value));
      const company = valueText(sheet.getCell("D" + i).value);
      if (!productText) {
        if (company) meta.missingProduct++;
        continue;
      }
      const product = canonProduct(productText);
      const segmentRaw = valueText(sheet.getCell(config.segmentColumn + i).value);
      const statusRaw = valueText(sheet.getCell(config.statusColumn + i).value);
      const segment = normalizeMasSegment(segmentRaw);
      const status = normalizeMasStatus(statusRaw);
      const money = valueMoney(sheet.getCell("J" + i).value);
      meta.rows[config.unit]++;
      if (!segmentRaw) meta.missingSegment++;
      if (!statusRaw) meta.missingStatus++;
      if (segmentRaw && segment === "Unclassified") meta.unknownSegment++;
      if (statusRaw && status === "Belum Terklasifikasi") meta.unknownStatus++;
      if (statusRaw && clean(statusRaw) !== status && status !== "Belum Terklasifikasi") meta.normalizedStatus++;
      if (money.invalid) meta.invalidPremium++;
      const key = bucketKey(config.unit, segment, product, status);
      const existing = aggregate.get(key) || { unit: config.unit, segment, product, status, cases: 0, premium: 0 };
      existing.cases += 1;
      existing.premium += money.amount;
      aggregate.set(key, existing);
    }
  }
  if (!meta.rows.Captive && !meta.rows.CRM) throw new Error("Tidak ada record quotation yang terbaca pada kedua sheet.");
  if (meta.rows.Captive) meta.notes.push("Captive: " + meta.rows.Captive.toLocaleString("id-ID") + " record sumber.");
  if (meta.rows.CRM) meta.notes.push("CRM: " + meta.rows.CRM.toLocaleString("id-ID") + " record sumber.");
  return { buckets: [...aggregate.values()], meta };
};

const adjustValue = (base: number, amount: number | null, method: MasOverride["method"]) => {
  if (amount === null || amount === undefined) return base;
  return method === "REPLACE" ? amount : base + amount;
};

export const calculateMasResults = (buckets: MasBucket[], overrides: MasOverride[]): MasResults => {
  const groupBy = new Map<string, MasFinalGroup>();
  const statuses = new Map<string, MasFinalStatus>();
  const warnings: string[] = [];
  for (const b of buckets) {
    const groupKey = keyOf(b.unit, b.segment, b.product);
    const group = groupBy.get(groupKey) || {
      unit: b.unit, segment: b.segment, product: b.product, cases: 0, premium: 0, baselineCases: 0, baselinePremium: 0
    };
    group.baselineCases += b.cases;
    group.baselinePremium += b.premium;
    group.cases += b.cases;
    group.premium += b.premium;
    groupBy.set(groupKey, group);
    const statusKey = bucketKey(b.unit, b.segment, b.product, b.status);
    const status = statuses.get(statusKey) || { unit: b.unit, segment: b.segment, product: b.product, status: b.status, cases: 0, premium: 0 };
    status.cases += b.cases;
    status.premium += b.premium;
    statuses.set(statusKey, status);
  }
  const groupOverrides = overrides.filter(x => x.status === "ALL");
  for (const o of overrides.filter(x => x.status !== "ALL")) {
    const groupKey = keyOf(o.unit, o.business_type, o.product);
    const group = groupBy.get(groupKey) || {
      unit: o.unit, segment: o.business_type, product: o.product, cases: 0, premium: 0, baselineCases: 0, baselinePremium: 0
    };
    const key = bucketKey(o.unit, o.business_type, o.product, o.status);
    const status = statuses.get(key) || { unit: o.unit, segment: o.business_type, product: o.product, status: o.status as MasStatus, cases: 0, premium: 0 };
    const prevCases = status.cases, prevPremium = status.premium;
    status.cases = adjustValue(prevCases, o.cases, o.method);
    status.premium = adjustValue(prevPremium, o.premium, o.method);
    group.cases += status.cases - prevCases;
    group.premium += status.premium - prevPremium;
    statuses.set(key, status);
    groupBy.set(groupKey, group);
  }
  for (const o of groupOverrides) {
    const key = keyOf(o.unit, o.business_type, o.product);
    const group = groupBy.get(key) || {
      unit: o.unit, segment: o.business_type, product: o.product, cases: 0, premium: 0, baselineCases: 0, baselinePremium: 0
    };
    group.cases = adjustValue(group.cases, o.cases, o.method);
    group.premium = adjustValue(group.premium, o.premium, o.method);
    groupBy.set(key, group);
  }
  const statusByGroup = new Map<string, { cases: number; premium: number }>();
  for (const item of statuses.values()) {
    const key = keyOf(item.unit, item.segment, item.product);
    const total = statusByGroup.get(key) || { cases: 0, premium: 0 };
    total.cases += item.cases; total.premium += item.premium;
    statusByGroup.set(key, total);
    if (item.cases < 0 || item.premium < -1) warnings.push("Status negatif: " + item.unit + " · " + item.product + " · " + item.status);
  }
  const statusOutput = [...statuses.values()];
  for (const [key, group] of groupBy) {
    if (group.cases < 0 || group.premium < -1) warnings.push("Total negatif: " + group.unit + " · " + group.product);
    const subtotal = statusByGroup.get(key) || { cases: 0, premium: 0 };
    const residualCases = group.cases - subtotal.cases;
    const residualPremium = group.premium - subtotal.premium;
    if (Math.abs(residualCases) > 0 || Math.abs(residualPremium) > 1) {
      const unclassified = statusOutput.find(x => keyOf(x.unit, x.segment, x.product) === key && x.status === "Belum Terklasifikasi");
      if (unclassified) {
        unclassified.cases += residualCases;
        unclassified.premium += residualPremium;
      } else {
        statusOutput.push({ unit: group.unit, segment: group.segment, product: group.product, status: "Belum Terklasifikasi", cases: residualCases, premium: residualPremium });
      }
      if (residualCases < 0 || residualPremium < -1) {
        warnings.push("Penyesuaian melebihi total status: " + group.unit + " · " + group.product + " · " + group.segment);
      }
    }
  }
  return { groups: [...groupBy.values()], statuses: statusOutput, warnings };
};