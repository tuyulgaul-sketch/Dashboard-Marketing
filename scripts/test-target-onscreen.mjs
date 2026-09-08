import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const load = path => {
  const filename = resolve(path);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(dirname(filename));
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {fileName: filename, compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
};
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(readFileSync(filename,'utf8'), {fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
};
const setup = load('src/utils/targetOnScreen.ts');
const user = (id, role, superiorId, status='Active') => ({id,name:`User ${id}`,role,superiorId,status,position:role,unit:'Captive Marketing',department:'Captive I'});
const users = [
  user('USR-000001','DIRECTOR_MARKETING',null),
  user('USR-000002','ADVISOR_MARKETING_DIRECTOR','USR-000001'),
  user('USR-000003','VP_CAPTIVE_MARKETING','USR-000001'),
  user('USR-000004','DEPARTMENT_HEAD_MARKETING','USR-000003'),
  user('USR-000005','STAFF_MARKETING','USR-000004'),
  user('USR-000006','STAFF_MARKETING','USR-000004','Inactive'),
];
const fresh = () => setup.seedTargetDraft(users,[],2026);
const set = (draft,id,month,kind,value) => {draft[id][kind][month-1]=String(value);};
const fixture = () => {
  const state=fresh();
  set(state.draft,'USR-000001',1,'NB',1000000);
  set(state.draft,'USR-000002',1,'RN',2000000);
  set(state.draft,'USR-000003',1,'NB',3000000);
  set(state.draft,'USR-000004',1,'RN',4000000);
  set(state.draft,'USR-000005',3,'NB',100000000);
  set(state.draft,'USR-000005',3,'RN',50000000);
  set(state.draft,'USR-000005',12,'NB',1);
  state.baseline={NB:'104000001',RN:'56000000'};
  state.confirmed=users.filter(u=>u.status==='Active').map(u=>u.id);
  return state;
};

test('new year starts empty, not silently published or confirmed',()=>{
  const state=fresh();
  assert.equal(Object.keys(state.draft).length,5);
  assert.deepEqual(state.confirmed,[]);
  assert.equal(state.baseline.NB,'');
  assert.equal(state.draft['USR-000005'].NB.length,12);
  assert.throws(()=>setup.validateTargetSetup(users,state.draft,2026,{NB:'0',RN:'0'},state.confirmed),/Konfirmasi/);
});

test('monthly personal allocations calculate every hierarchy level without double-counting',()=>{
  const state=fixture();
  const result=setup.validateTargetSetup(users,state.draft,2026,state.baseline,state.confirmed);
  const byId=id=>result.entries.find(row=>row.userId===id);
  assert.equal(result.entries.length,5);
  assert.equal(result.total,160000001);
  assert.equal(byId('USR-000005').personalTargetNewBusiness,100000001);
  assert.equal(byId('USR-000005').annualTargetTotal,150000001);
  assert.equal(byId('USR-000004').annualTargetTotal,154000001);
  assert.equal(byId('USR-000003').annualTargetTotal,157000001);
  assert.equal(byId('USR-000002').annualTargetTotal,2000000);
  assert.equal(byId('USR-000001').personalTargetTotal,1000000);
  assert.equal(byId('USR-000001').annualTargetNewBusiness,104000001);
  assert.equal(byId('USR-000001').annualTargetRenewal,56000000);
  assert.equal(byId('USR-000001').annualTargetTotal,160000001);
  assert.equal(byId('USR-000001').annualTargetTotal,byId('USR-000001').personalTargetTotal+byId('USR-000002').annualTargetTotal+byId('USR-000003').annualTargetTotal);
  assert.deepEqual(result.differences,{NB:0,RN:0});
  assert.equal(byId('USR-000005').monthlyNewBusiness[11],1);
  assert.equal(JSON.stringify(result.entries),JSON.stringify(setup.validateTargetSetup(users,state.draft,2026,state.baseline,state.confirmed).entries),'Preview must remain deterministic');
});

test('exact rupiah, complete confirmation and independent NB/RN totals are mandatory',()=>{
  const state=fixture();
  assert.throws(()=>setup.validateTargetSetup(users,state.draft,2026,{NB:'103000001',RN:'57000000'},state.confirmed),/Cascading/);
  assert.throws(()=>setup.validateTargetSetup(users,state.draft,2026,state.baseline,state.confirmed.slice(1)),/Konfirmasi/);
  assert.throws(()=>setup.validateTargetSetup(users,state.draft,2026,{NB:'',RN:'56000000'},state.confirmed),/wajib/);
  for(const bad of ['-1','1E+12','1.5','9007199254740992','']){
    const copy=structuredClone(state.draft);
    set(copy,'USR-000005',3,'NB',bad);
    assert.throws(()=>setup.calculateTargetSetup(users,copy,2026,state.baseline));
  }
  assert.throws(()=>setup.calculateTargetSetup(users,{...state.draft,'USR-000005':{...state.draft['USR-000005'],NB:[1]}},2026,state.baseline),/belum lengkap/);
  assert.throws(()=>setup.calculateTargetSetup([...users,users[0]],state.draft,2026,state.baseline),/duplikat/);
});

test('existing official target values and notes are loaded without mutation',()=>{
  const state=fixture();
  const official=setup.validateTargetSetup(users,state.draft,2026,state.baseline,state.confirmed).entries;
  official[4].notes='Approved allocation';
  const original=structuredClone(official);
  const seeded=setup.seedTargetDraft(users,official,2026);
  assert.equal(seeded.baseline.NB,'104000001');
  assert.equal(seeded.baseline.RN,'56000000');
  assert.equal(seeded.draft['USR-000005'].NB[2],'100000000');
  assert.equal(seeded.draft['USR-000005'].notes,'Approved allocation');
  assert.equal(seeded.confirmed.length,5);
  assert.deepEqual(official,original);
  assert.equal(seeded.draft['USR-000006'],undefined);
  assert.equal(setup.validateTargetSetup(users,seeded.draft,2026,seeded.baseline,seeded.confirmed).total,160000001);
});

test('on-screen is primary; existing Excel, pipeline, realization and archive remain',()=>{
  const navigation=readFileSync('src/pages/TargetRealizationUploadPage.tsx','utf8');
  const component=readFileSync('src/components/rkap/TargetOnScreenSetup.tsx','utf8');
  assert.match(navigation,/useState<UploadTab>\('setup'\)/);
  for(const value of ['setup','targets','bulk','realization','manage']) assert.match(navigation,new RegExp(`value="${value}"`));
  assert.match(navigation,/TargetRkapPage key="targets"/);
  assert.match(navigation,/RkapPipelineMatrixUpload publisherAuthorized/);
  assert.match(navigation,/OfficialUploadArchiveManager/);
  assert.match(component,/actor\.id === 'USR-000024'/);
  assert.match(component,/useTargetRealizationPublisher/);
  assert.match(component,/await publishCentralTargetBatch\(/);
  assert.match(component,/await listCentralTargets\(year\)/);
  assert.match(component,/sourceSnapshot/);
  assert.match(component,/sourceDirectory/);
  assert.doesNotMatch(component,/store\.publishTargetBatch\(/);
  assert.doesNotMatch(component,/localStorage\.setItem/);
});
