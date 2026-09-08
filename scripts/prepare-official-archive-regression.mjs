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

/** The original archive contract remains pinned; only the approved manual setup extension is added. */
export const onscreenHubTransform = original => {
  let value = once(original,
    "import { AlertCircle, Archive, FileSpreadsheet, Upload } from 'lucide-react';",
    "import { AlertCircle, Archive, FileSpreadsheet, Upload, Target as TargetIcon } from 'lucide-react';");
  value = once(value,
    "import OfficialUploadArchiveManager from '@/components/rkap/OfficialUploadArchiveManager';",
    "import OfficialUploadArchiveManager from '@/components/rkap/OfficialUploadArchiveManager';\nimport TargetOnScreenSetup from '@/components/rkap/TargetOnScreenSetup';");
  value = once(value,
    "type UploadTab = 'targets' | 'bulk' | 'realization' | 'manage';",
    "type UploadTab = 'setup' | 'targets' | 'bulk' | 'realization' | 'manage';");
  value = once(value,
    '/** Existing validators and publishers are reused, not copied or rewritten. */',
    '/** The original publisher boundary and existing upload workflows are preserved. */');
  value = once(value,
    "useState<UploadTab>('targets')",
    "useState<UploadTab>('setup')");
  value = once(value,
    'Memverifikasi otoritas upload...',
    'Memverifikasi otoritas publisher...');
  value = once(value,
    '<Upload className="h-5 w-5 text-blue-700" />',
    '<TargetIcon className="h-5 w-5 text-blue-700" />');
  value = once(value,
    'Upload Target dan Realisasi</h1><p className="mt-1 text-xs text-slate-500">Pusat pengelolaan',
    'Setup Target dan Realisasi</h1><p className="mt-1 text-xs text-slate-500">Pengelolaan');
  value = once(value, 'sm:grid-cols-4', 'sm:grid-cols-2 lg:grid-cols-5');
  value = once(value,
    '            <TabsTrigger value="targets" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Target</TabsTrigger>',
    '            <TabsTrigger value="setup" className="gap-2 py-2.5 text-xs"><TargetIcon className="h-4 w-4" /> Setup Target</TabsTrigger>\n            <TabsTrigger value="targets" className="gap-2 py-2.5 text-xs"><FileSpreadsheet className="h-4 w-4" /> Upload Target Excel</TabsTrigger>');
  value = once(value,
    '          <TabsContent value="targets" className="mt-4">',
    "          <TabsContent value=\"setup\" forceMount className={tab === 'setup' ? 'mt-4' : 'hidden'}><TargetOnScreenSetup publisherAuthorized={canPublish} /></TabsContent>\n          <TabsContent value=\"targets\" className=\"mt-4\">");
  value = once(value,
    'Upload dan penghapusan hanya tersedia bagi publisher resmi. Setiap penghapusan memerlukan preview, alasan, dan konfirmasi ID batch. Snapshot lengkap disimpan untuk audit; data lain tidak direset.',
    'Setup target, upload, dan penghapusan hanya tersedia bagi publisher resmi. Target baru tidak mengganti data resmi sebelum validasi dan konfirmasi Publish. Penghapusan tetap memerlukan preview, alasan, serta konfirmasi ID batch; riwayat resmi dipertahankan.');
  return value;
};

if (process.argv[1]?.endsWith('prepare-official-archive-regression.mjs')) {
  const baseline = execFileSync('git', ['show', '050e3b24a983216a66378cf0ae925e89865b9d36:' + hub], {encoding:'utf8'});
  assert.equal(read(hub), onscreenHubTransform(archiveHubTransform(baseline)), 'Only the approved archive and on-screen hub extensions are allowed.');
  let fixture = read(path);
  fixture = once(fixture,
    "import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';",
    "import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';\nimport { archiveHubTransform, onscreenHubTransform } from './prepare-official-archive-regression.mjs';");
  fixture = once(fixture,
    '    const expected = matrixTransforms[path]',
    '    const expectedBase = matrixTransforms[path]');
  fixture = once(fixture,
    '          : transform(original);\n    assert.equal(read(path), expected,',
    `          : transform(original);\n    const expected = path === '${hub}' ? onscreenHubTransform(archiveHubTransform(expectedBase)) : expectedBase;\n    assert.equal(read(path), expected,`);
  writeFileSync(path, fixture);
  console.log('Pinned historical navigation checks extended by the exact approved archive and on-screen hub diffs.');
}
