import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = 'scripts/test-target-realization-navigation.mjs';
const hub = 'src/pages/TargetRealizationUploadPage.tsx';
const read = file => readFileSync(file, 'utf8');
const once = (text, before, after) => {
  assert.equal(text.split(before).length, 2, `Approved anchor must occur exactly once: ${before}`);
  return text.replace(before, after);
};
export const archiveHubTransform = original => {
  let value = once(original,
    "import { AlertCircle, FileSpreadsheet, Upload } from 'lucide-react';",
    "import { AlertCircle, Archive, FileSpreadsheet, Upload } from 'lucide-react';");
  value = once(value,
    "import RkapPipelineMatrixUpload from '@/components/rkap/RkapPipelineMatrixUpload';",
    "import RkapPipelineMatrixUpload from '@/components/rkap/RkapPipelineMatrixUpload';\nimport OfficialUploadArchiveManager from '@/components/rkap/OfficialUploadArchiveManager';");
  value = once(value, "type UploadTab = 'targets' | 'bulk' | 'realization';", "type UploadTab = 'targets' | 'bulk' | 'realization' | 'manage';");
  value = once(value, 'sm:grid-cols-3', 'sm:grid-cols-4');
  value = once(value,
    '            <TabsTrigger value="realization" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Realisasi</TabsTrigger>',
    '            <TabsTrigger value="realization" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Realisasi</TabsTrigger>\n            <TabsTrigger value="manage" className="gap-2 py-2.5 text-xs"><Archive className="h-4 w-4" /> Kelola / Hapus Upload</TabsTrigger>');
  value = once(value,
    '          <TabsContent value="realization" className="mt-4"><ProduksiPage embedded uploadOnly publisherAuthorized={canPublish} /></TabsContent>',
    '          <TabsContent value="realization" className="mt-4"><ProduksiPage embedded uploadOnly publisherAuthorized={canPublish} /></TabsContent>\n          <TabsContent value="manage" className="mt-4"><OfficialUploadArchiveManager /></TabsContent>');
  value = once(value,
    'Setiap upload tetap menggunakan validasi, konfirmasi, dan mekanisme publish yang sudah ada. Perubahan ini hanya memindahkan tempat pengelolaannya; data existing tidak direset.',
    'Upload dan penghapusan hanya tersedia bagi publisher resmi. Setiap penghapusan memerlukan preview, alasan, dan konfirmasi ID batch. Snapshot lengkap disimpan untuk audit; data lain tidak direset.');
  return value;
};

if (process.argv[1]?.endsWith('prepare-official-archive-regression.mjs')) {
  const baseline = execFileSync('git', ['show', '050e3b24a983216a66378cf0ae925e89865b9d36:' + hub], {encoding:'utf8'});
  assert.equal(read(hub), archiveHubTransform(baseline), 'Only the approved archive hub extension is allowed.');
  let fixture = read(path);
  fixture = once(fixture,
    "import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';",
    "import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';\nimport { archiveHubTransform } from './prepare-official-archive-regression.mjs';");
  fixture = once(fixture,
    '    const expected = matrixTransforms[path]',
    '    const expectedBase = matrixTransforms[path]');
  fixture = once(fixture,
    '          : transform(original);\n    assert.equal(read(path), expected,',
    `          : transform(original);\n    const expected = path === '${hub}' ? archiveHubTransform(expectedBase) : expectedBase;\n    assert.equal(read(path), expected,`);
  writeFileSync(path, fixture);
  console.log('Pinned historical navigation checks extended by the exact approved archive hub diff.');
}
