import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => readFileSync(path, 'utf8');
const replaceOnce = (source, before, after) => {
  assert(source.includes(before), `Missing approved source anchor: ${before.slice(0, 80)}`);
  assert.equal(source.split(before).length, 2, 'Source anchor is not unique.');
  return source.replace(before, after);
};
const changes = {
  'src/utils/targetCompact.ts': source => {
    source = replaceOnce(source,
      "  const missing = holders.filter(user => !amounts.has(idOf(user.id))).map(user => user.id);\n  if (missing.length) throw new Error(`User target aktif belum tercakup. Sertakan minimal satu baris (boleh nol) untuk: ${missing.join(', ')}.`);",
      "  // A full-year publication replaces the annual snapshot. Never interpret\n  // an omitted month as zero: that could silently erase an approved allocation.\n  const missing = holders.flatMap(user => MONTHS.flatMap((_, month) => ['NB', 'RN'].filter(kind => !seen.has(`${idOf(user.id)}|${month}|${kind}`)).map(kind => `${idOf(user.id)} / ${month + 1} / ${kind}`)));\n  if (missing.length) throw new Error(`Alokasi bulanan belum lengkap. Setiap user aktif wajib memiliki 12 bulan x NB/RN, termasuk nilai nol. Baris yang belum ada: ${missing.slice(0, 12).join(', ')}${missing.length > 12 ? `, dan ${missing.length - 12} lainnya` : ''}.`);\n  if (seen.size !== holders.length * 24) throw new Error('Jumlah alokasi tidak sesuai dengan 24 kombinasi per pemilik target aktif.');");
    source = replaceOnce(source,
      "  const director = holders.find(user => user.role === 'DIRECTOR_MARKETING');\n  if (!director) throw new Error('Direktur Marketing aktif tidak ditemukan.');",
      "  const directors = holders.filter(user => user.role === 'DIRECTOR_MARKETING');\n  if (directors.length !== 1) throw new Error('User Master harus memiliki tepat satu Direktur Marketing aktif untuk cascading.');\n  const director = directors[0];");
    return source;
  },
  'scripts/test-compact-target.mjs': source => {
    source = replaceOnce(source,
      "invalid(copy => copy.splice(0,24), /belum tercakup/);",
      "invalid(copy => copy.splice(0,24), /belum lengkap/);\ninvalid(copy => copy.splice(0,1), /belum lengkap/);");
    source = replaceOnce(source,
      "assert.equal(compact.normalizeTargetUploadRows(sparse,users,2026).length,5);",
      "assert.throws(() => compact.normalizeTargetUploadRows(sparse,users,2026), /belum lengkap/);");
    source = replaceOnce(source,
      "assert.throws(() => compact.expandCompactTargetRows(rows,[...users,users[0]],2026),/duplikat/);",
      "assert.throws(() => compact.expandCompactTargetRows(rows,[...users,users[0]],2026),/duplikat/);\nconst extraDirector = [...users, user('USR-000007','DIRECTOR_MARKETING',null)];\nconst extraRows = compact.buildCompactTargetTemplateRows(extraDirector,2026);\nassert.throws(() => compact.expandCompactTargetRows(extraRows,extraDirector,2026),/tepat satu Direktur/);");
    return source;
  },
  'scripts/integrate-compact-target.mjs': source => replaceOnce(source,
    'buildCompactTargetTemplateRows(targetHolders, selectedTargetYear)',
    'buildCompactTargetTemplateRows(users, selectedTargetYear)').replace(
    'normalizeTargetUploadRows(importedRows, targetHolders, selectedTargetYear)',
    'normalizeTargetUploadRows(importedRows, users, selectedTargetYear)'),
};
for (const [path, transform] of Object.entries(changes)) {
  const original = read(path);
  const expected = transform(original);
  assert.notEqual(expected, original, `${path} was not modified`);
  writeFileSync(path, expected);
  console.log(`Hardened approved target source: ${path}`);
}
