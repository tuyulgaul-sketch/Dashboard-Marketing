/**
 * PertaLife Care Survey -> Dashboard Marketing.
 *
 * Setup:
 * 1) Project Settings > Script Properties:
 *    PERTALIFE_CARE_INGEST_KEY = <production key>
 * 2) Run installPertaLifeCareSurveyTrigger() once.
 *
 * Reconciliation rules:
 * - Form submit: upsert one response immediately.
 * - Edit / row insert / row delete: reconcile full active source.
 * - Every 6 hours: safety reconciliation.
 * - Supabase uses a stable fingerprint, never spreadsheet row number, as identity.
 */
const PLC_SURVEY_CONFIG = Object.freeze({
  responseSheetName: "Form Responses 1",
  endpoint: "https://olyfnaviewzsbocflrzi.supabase.co/functions/v1/pertalife-care-survey-ingest",
  secretProperty: "PERTALIFE_CARE_INGEST_KEY",
});

const PLC_SURVEY_FEATURES = Object.freeze([
  { key: "initial_access", label: "Awal membuka aplikasi", headerContains: "kendala saat awal membuka aplikasi" },
  { key: "registration", label: "Registrasi akun", headerContains: "kendala saat registrasi akun" },
  { key: "login", label: "Login", headerContains: "kendala saat login" },
  { key: "otp_verification", label: "OTP/Verifikasi", headerContains: "kode otp/verifikasi" },
  { key: "home_dashboard", label: "Halaman utama/Dashboard", headerContains: "halaman utama/dashboard" },
  { key: "profile", label: "Profil", headerContains: "kendala saat mengakses profil" },
  { key: "policy_benefit", label: "Informasi polis & manfaat/benefit", headerContains: "informasi polis & manfaat/benefit" },
  { key: "e_claim", label: "E-Claim", headerContains: "kendala saat mengakses e-claim" },
  { key: "provider", label: "Provider/Fasilitas Kesehatan", headerContains: "provider/fasilitas kesehatan" },
]);

const PLC_TRIGGER_HANDLERS = Object.freeze([
  "syncPertaLifeCareSurvey",
  "reconcilePertaLifeCareSurveyEdit",
  "reconcilePertaLifeCareSurveyChange",
  "reconcilePertaLifeCareSurveyScheduled",
]);

function plcNormalize_(value) {
  return String(value == null ? "" : value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function plcHeaderIndex_(headers, containsText) {
  const needle = plcNormalize_(containsText);
  return headers.findIndex(function (header) {
    return plcNormalize_(header).indexOf(needle) >= 0;
  });
}

function plcHeaderExactIndex_(headers, label) {
  const needle = plcNormalize_(label);
  return headers.findIndex(function (header) {
    return plcNormalize_(header) === needle;
  });
}

function plcValue_(values, index) {
  if (index < 0 || index >= values.length) return "";
  return String(values[index] == null ? "" : values[index]).trim();
}

function plcTimestampIso_(rawTimestamp) {
  if (rawTimestamp instanceof Date && !isNaN(rawTimestamp.getTime())) {
    return Utilities.formatDate(rawTimestamp, "Asia/Jakarta", "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  const text = String(rawTimestamp == null ? "" : rawTimestamp).trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return new Date().toISOString();
  return match[3] + "-" + match[2] + "-" + match[1] + "T" +
    match[4] + ":" + match[5] + ":" + match[6] + "+07:00";
}

function plcBuildPayload_(sheet, rowNumber) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const rawValues = sheet.getRange(rowNumber, 1, 1, lastColumn).getValues()[0];
  const values = sheet.getRange(rowNumber, 1, 1, lastColumn).getDisplayValues()[0];

  const timestampIndex = plcHeaderExactIndex_(headers, "Timestamp");
  const nameIndex = plcHeaderExactIndex_(headers, "Nama Pengguna");
  const memberIdIndex = plcHeaderExactIndex_(headers, "Member ID");
  const deviceIndex = plcHeaderExactIndex_(headers, "Perangkat yang digunakan");
  const osIndex = plcHeaderExactIndex_(headers, "Tipe OS (Operating System) yang digunakan");
  const selectedIndex = plcHeaderIndex_(headers, "Fitur mana yang mengalami kendala");
  const satisfactionIndex = plcHeaderIndex_(headers, "seberapa puas Anda menggunakan PertaLife Care");
  const contactableIndex = plcHeaderIndex_(headers, "bersedia dihubungi apabila kami membutuhkan informasi lebih lanjut");
  const phoneIndex = plcHeaderIndex_(headers, "Nomor WhatsApp yang dapat kami hubungi");

  if (timestampIndex < 0 || nameIndex < 0) {
    throw new Error("Header Timestamp/Nama Pengguna tidak ditemukan.");
  }

  const issues = [];
  PLC_SURVEY_FEATURES.forEach(function (feature) {
    const issueIndex = plcHeaderIndex_(headers, feature.headerContains);
    if (issueIndex < 0 || plcNormalize_(plcValue_(values, issueIndex)) !== "ya") return;
    issues.push({
      feature_key: feature.key,
      feature_label: feature.label,
      issue_detail: plcValue_(values, issueIndex + 1),
      evidence_url: plcValue_(values, issueIndex + 2),
    });
  });

  const scoreText = plcValue_(values, satisfactionIndex);
  const score = scoreText ? Number(scoreText.replace(",", ".")) : null;

  return {
    source_row: rowNumber,
    submitted_at: plcTimestampIso_(rawValues[timestampIndex]),
    respondent_name: plcValue_(values, nameIndex),
    member_id: plcValue_(values, memberIdIndex),
    device_type: plcValue_(values, deviceIndex),
    os_name: plcValue_(values, osIndex),
    selected_problem_feature: plcValue_(values, selectedIndex),
    satisfaction_score: score != null && !isNaN(score) ? score : null,
    contactable: plcNormalize_(plcValue_(values, contactableIndex)) === "ya",
    phone: plcValue_(values, phoneIndex),
    issues: issues,
    raw_payload: {
      source: "Google Forms / Form Responses 1",
      source_row: rowNumber,
    },
  };
}

function plcGetSecret_() {
  const key = PropertiesService.getScriptProperties().getProperty(PLC_SURVEY_CONFIG.secretProperty);
  if (!key) throw new Error("Script Property PERTALIFE_CARE_INGEST_KEY belum diisi.");
  return key;
}

function plcPost_(body) {
  const response = UrlFetchApp.fetch(PLC_SURVEY_CONFIG.endpoint, {
    method: "post",
    contentType: "application/json",
    headers: { "x-pertalife-survey-key": plcGetSecret_() },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      "Sync Survey PertaLife Care gagal. HTTP " + status + ": " + response.getContentText()
    );
  }
  return JSON.parse(response.getContentText() || "{}");
}

function plcSyncRow_(sheet, rowNumber) {
  if (!sheet || sheet.getName() !== PLC_SURVEY_CONFIG.responseSheetName) return null;
  if (rowNumber < 2 || !sheet.getRange(rowNumber, 1).getDisplayValue()) return null;
  return plcPost_(plcBuildPayload_(sheet, rowNumber));
}

function plcBuildAllPayloads_() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getSheetByName(PLC_SURVEY_CONFIG.responseSheetName);
  if (!sheet) throw new Error('Sheet "Form Responses 1" tidak ditemukan.');

  const payloads = [];
  const lastRow = sheet.getLastRow();
  for (let row = 2; row <= lastRow; row += 1) {
    if (!sheet.getRange(row, 1).getDisplayValue()) continue;
    payloads.push(plcBuildPayload_(sheet, row));
  }
  return payloads;
}

function plcReconcileAll_() {
  const rows = plcBuildAllPayloads_();
  return plcPost_({ mode: "reconcile", rows: rows });
}

function syncPertaLifeCareSurvey(e) {
  if (!e || !e.range) {
    throw new Error("Fungsi ini harus dijalankan oleh trigger On form submit.");
  }
  const sheet = e.range.getSheet();
  if (sheet.getName() !== PLC_SURVEY_CONFIG.responseSheetName) return;
  plcSyncRow_(sheet, e.range.getRow());
}

function reconcilePertaLifeCareSurveyEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() !== PLC_SURVEY_CONFIG.responseSheetName) return;
  plcReconcileAll_();
}

function reconcilePertaLifeCareSurveyChange(e) {
  if (e && e.changeType) {
    const relevant = ["REMOVE_ROW", "INSERT_ROW", "REMOVE_COLUMN", "INSERT_COLUMN", "OTHER"];
    if (relevant.indexOf(String(e.changeType)) < 0) return;
  }
  plcReconcileAll_();
}

function reconcilePertaLifeCareSurveyScheduled() {
  plcReconcileAll_();
}

function installPertaLifeCareSurveyTrigger() {
  const spreadsheet = SpreadsheetApp.getActive();

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (PLC_TRIGGER_HANDLERS.indexOf(trigger.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("syncPertaLifeCareSurvey")
    .forSpreadsheet(spreadsheet)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("reconcilePertaLifeCareSurveyEdit")
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();

  ScriptApp.newTrigger("reconcilePertaLifeCareSurveyChange")
    .forSpreadsheet(spreadsheet)
    .onChange()
    .create();

  ScriptApp.newTrigger("reconcilePertaLifeCareSurveyScheduled")
    .timeBased()
    .everyHours(6)
    .create();

  const result = plcReconcileAll_();
  spreadsheet.toast(
    "Trigger + reconciliation Survey PertaLife Care aktif.",
    "Dashboard Marketing",
    7
  );
  return result;
}

function backfillPertaLifeCareSurveyResponses() {
  const result = plcReconcileAll_();
  SpreadsheetApp.getActive().toast(
    "Reconciliation Survey PertaLife Care selesai.",
    "Dashboard Marketing",
    7
  );
  return result;
}
