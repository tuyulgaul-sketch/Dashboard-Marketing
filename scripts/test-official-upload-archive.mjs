import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import Module from 'node:module';
import ts from 'typescript';

const source = path => readFileSync(path, 'utf8');
const calls = [];
const sample = {kind:'target',id:'TRG-2026-test',label:'Target.xlsx',year:2026,uploadedAt:'2026-09-08T00:00:00Z',recordCount:23,amount:100000000,status:'Published'};
const preview = {...sample,hash:'a'.repeat(64),blocked:0,periods:[]};
const rpc = async (name,args) => {
  calls.push([name,args]);
  if(name==='list_official_uploads_v1') return {data:[sample],error:null};
  if(name==='preview_official_upload_removal_v1') return {data:preview,error:null};
  if(name==='archive_official_upload_v1') return {data:{archiveId:'archive-uuid',kind:'target',id:sample.id,recordCount:23,status:'Archived'},error:null};
  throw new Error('Unexpected RPC '+name);
};
const loadTs = (path,overrides={}) => {
  const filename=resolve(path);
  const compiled=ts.transpileModule(source(filename),{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}});
  const mod=new Module(filename); mod.filename=filename; mod.paths=Module._nodeModulePaths(dirname(filename));
  const original=mod.require.bind(mod); mod.require=id=>Object.hasOwn(overrides,id)?overrides[id]:original(id);
  mod._compile(compiled.outputText,filename); return mod.exports;
};
const service=loadTs('src/services/officialUploadArchiveService.ts',{
  '@/lib/supabase':{supabase:{rpc}},
  '@/services/centralBusinessService':{CENTRAL_BUSINESS_STORAGE_KEYS:['pertalife_pipelines','pertalife_official_production_summaries','pertalife_official_production_batches']},
  '@/services/centralBusinessStorageRuntime':{waitForCentralBusinessStorageSync:async key=>calls.push(['wait',key]),refreshCentralBusinessRuntime:async()=>calls.push(['refresh','business'])},
  '@/services/centralTargetRuntime':{refreshCentralTargetRuntime:async()=>calls.push(['refresh','target'])},
});
assert.equal((await service.listOfficialUploadBatches())[0].id,sample.id);
assert.equal((await service.previewOfficialUploadRemoval('target',sample.id)).hash,preview.hash);
const before=calls.length;
await assert.rejects(()=>service.archiveOfficialUpload(preview,'short'),/Alasan/);
assert.equal(calls.length,before,'Invalid reason must not call the server');
const receipt=await service.archiveOfficialUpload(preview,'Koreksi upload resmi yang salah');
assert.equal(receipt.archiveId,'archive-uuid');
assert.equal(calls.filter(([name])=>name==='wait').length,3);
const archiveCall=calls.find(([name])=>name==='archive_official_upload_v1');
assert.deepEqual(archiveCall[1],{p_kind:'target',p_id:sample.id,p_expected_hash:preview.hash,p_reason:'Koreksi upload resmi yang salah'});
assert.equal(calls.filter(([name])=>name==='archive_official_upload_v1').length,1);
await service.refreshOfficialUploadReaders();
assert.equal(calls.filter(([name])=>name==='refresh').length,2);
const hub=source('src/pages/TargetRealizationUploadPage.tsx');
const ui=source('src/components/rkap/OfficialUploadArchiveManager.tsx');
const sql=source('supabase/migrations/20260908_official_upload_archive_v1.sql');
assert.match(hub,/OfficialUploadArchiveManager/);
assert.match(hub,/TabsContent value="manage"/);
assert.match(ui,/useTargetRealizationPublisher/);
assert.match(ui,/previewOfficialUploadRemoval/);
assert.match(ui,/confirmation\.trim\(\) !== selected\.id/);
assert.match(ui,/selected\.blocked > 0/);
assert.match(ui,/reason\.trim\(\)\.length < 10/);
assert.doesNotMatch(ui,/localStorage\.removeItem|window\.location\.reload|service_role/);
assert.doesNotMatch(source('src/services/officialUploadArchiveService.ts'),/\.from\(['"]central_business_entities['"]\)\.delete|service_role|localStorage\.removeItem/);
assert.match(sql,/can_publish_marketing_targets\(\)/);
assert.match(sql,/marketing_upload_archives/);
assert.match(sql,/marketing_upload_tombstones/);
assert.match(sql,/p_expected_hash is null/);
assert.match(sql,/v_deleted<>v_expected/);
assert.match(sql,/v_row\.version<>1/);
assert.match(sql,/jsonb_path_exists/);
assert.match(sql,/revoke all on function public\.official_upload_candidate_v1/);
assert.doesNotMatch(sql,/truncate table|drop table public\.marketing_targets|grant all on public\.central_business_entities/);
console.log('PASS: exact archive RPC, validation, source safeguards, no client delete, and explicit cache refresh.');
