import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'src/pages/TandaTerimaV14Page.tsx';
const expectedSha = '08dc7cc2c1926b6d22d7ee106226f446e17336d1';
const actualSha = execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();
assert.equal(actualSha, expectedSha, 'The registry source changed. Review before applying.');
let source = readFileSync(path, 'utf8');
function replaceOnce(label, before, after) {
  assert.equal(source.split(before).length - 1, 1, `Expected exactly one ${label} anchor.`);
  source = source.replace(before, after);
}

replaceOnce('sort import',
  '} from "@/utils/slaGovernance";',
  '} from "@/utils/slaGovernance";\nimport { getHandoverSubmissionTime, sortHandoversBySubmission } from "@/lib/documentHandoverSort";');

replaceOnce('safe timestamp formatter',
  `const formatDateTime = (
  value?: string
) =>
  value
    ? new Date(
        value
      ).toLocaleString(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      )
    : "-";`,
  `const formatDateTime = (
  value?: string
) => {
  const timestamp = getHandoverSubmissionTime(value);
  return timestamp === null
    ? "-"
    : new Date(timestamp).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};`);

replaceOnce('filtered registry ordering',
  '          return receipts.filter(\n',
  '          return sortHandoversBySubmission(receipts.filter(\n');
replaceOnce('filtered registry closing',
  `            }
          );
        },
        [
          receipts,
          currentUser.id,
          filter,
          search,
        ]
      );`,
  `            }
          ));
        },
        [
          receipts,
          currentUser.id,
          filter,
          search,
        ]
      );`);

replaceOnce('registry sort description',
  'Cari berdasarkan nomor, pengirim, penerima, posisi/fungsi, atau dokumen. Journey eksternal tersimpan pada registry yang sama.',
  'Urutan berdasarkan tanggal submission terbaru. Cari berdasarkan nomor, pengirim, penerima, posisi/fungsi, atau dokumen. Journey eksternal tersimpan pada registry yang sama.');
replaceOnce('submission column header',
  '<th className="p-3">Tanggal</th>',
  '<th className="p-3">Tanggal Submission ↓</th>');
replaceOnce('submission date cell',
  `<td className="p-3 text-gray-700">
                              {formatDateOnly(
                                receipt.handoverDate
                              )}
                            </td>`,
  `<td className="p-3 text-gray-700">
                              <div className="font-medium">
                                {formatDateTime(
                                  receipt.submittedAt
                                )}
                              </div>
                              <div className="mt-1 text-[10px] text-gray-400">
                                Tanggal penyerahan: {formatDateOnly(
                                  receipt.handoverDate
                                )}
                              </div>
                            </td>`);

assert.match(source, /getVisibleDocumentHandoversV14\(/);
assert.match(source, /getDocumentHandoverHistoryV14\(/);
assert.match(source, /resendDocumentHandoverV14\(/);
assert.match(source, /updateExternalDocumentJourneyV23\(/);
assert.match(source, /filteredReceipts\.map\(/);
writeFileSync(path, source);
console.log('Integrated latest-submission ordering in the registry only; original workflows and custody data remain unchanged.');
