import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const replaceOnce = (source, before, after) => {
  assert.equal(source.split(before).length, 2, `Expected exactly one integration anchor: ${before.slice(0, 100)}`);
  return source.replace(before, after);
};

export const integrateTandaTerimaPhotoPreview = source => {
  let next = replaceOnce(source,
    'import { AppLayout } from "@/components/layout/AppLayout";',
    'import { AppLayout } from "@/components/layout/AppLayout";\nimport HandoverEvidencePreview from "@/components/tandaTerima/HandoverEvidencePreview";');

  next = replaceOnce(next, `                              {step.evidenceFileId && (
                                <Button`, `                              {step.evidenceFileId && (
                                <div className="flex flex-wrap gap-2">
                                  <HandoverEvidencePreview
                                    fileId={step.evidenceFileId}
                                    fileName={step.evidenceFileName}
                                    transactionId={detailReceipt.id}
                                  />
                                <Button`);

  next = replaceOnce(next, `                                  <Download className="h-3.5 w-3.5" /> Download Foto
                                </Button>
                              )}`, `                                  <Download className="h-3.5 w-3.5" /> Download Foto
                                </Button>
                                </div>
                              )}`);

  next = replaceOnce(next, `                              {log.evidenceFileId && (
                                <Button`, `                              {log.evidenceFileId && (
                                <div className="flex flex-wrap gap-2">
                                  <HandoverEvidencePreview
                                    fileId={log.evidenceFileId}
                                    fileName={log.evidenceFileName}
                                    transactionId={detailReceipt.id}
                                  />
                                <Button`);

  next = replaceOnce(next, `                                  <Download className="h-3.5 w-3.5" />
                                  Download Foto
                                </Button>
                              )}`, `                                  <Download className="h-3.5 w-3.5" />
                                  Download Foto
                                </Button>
                                </div>
                              )}`);
  return next;
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const path = 'src/pages/TandaTerimaV14Page.tsx';
  const source = readFileSync(path, 'utf8');
  writeFileSync(path, integrateTandaTerimaPhotoPreview(source));
  console.log('Photo preview added to journey and audit evidence; existing download and mutation handlers preserved.');
}
