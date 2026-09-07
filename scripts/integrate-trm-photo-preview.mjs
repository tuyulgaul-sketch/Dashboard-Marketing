import assert from 'node:assert/strict';

// Pure regression fixture: describes the only permitted changes to the live page.
// It is not an application runtime or a source-writing migration.
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
