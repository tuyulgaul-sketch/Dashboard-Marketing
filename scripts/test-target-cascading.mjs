import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (mod, filename) => {
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
};
const w = require(resolve('src/utils/targetCascadingWizard.ts'));
const setup = require(resolve('src/utils/targetOnScreen.ts'));
const user = (id,role,superiorId,department='None',status='Active')=>({id,name:id,role,superiorId,department,unit:'Captive Marketing',status,position:role});
const users = [user('USR-000001','DIRECTOR_MARKETING',null),user('USR-000002','VP_CAPTIVE_MARKETING','USR-000001'),user('USR-000003','VP_CORPORATE_RETAIL_MARKETING','USR-000001'),user('USR-000004','ADVISOR_MARKETING_DIRECTOR','USR-000001'),user('USR-000005','DEPARTMENT_HEAD_MARKETING','USR-000002','Captive I'),user('USR-000006','DEPARTMENT_HEAD_MARKETING','USR-000002','Captive II'),user('USR-000007','STAFF_MARKETING','USR-000005'),user('USR-000008','STAFF_MARKETING','USR-000005'),user('USR-000009','STAFF_MARKETING','USR-000006'),user('USR-000010','STAFF_MARKETING','USR-000006','None','Inactive')];
const tree=w.buildWizardTree(users);
const A=(NB,RN)=>({NB:String(NB),RN:String(RN)});
const M=(nb,rn)=>({NB:nb.map(String),RN:rn.map(String)});
const months=(nb,rn)=>M([nb,...Array(11).fill(0)],[rn,...Array(11).fill(0)]);
const initial=()=>w.seedWizard(tree,[]);
const advance=(state,values)=>{
  const index=state.accepted.length,step=w.buildSteps(tree)[index];
  const next=structuredClone(state);next.allocations[step.id][step.phase]=values;
  return w.continueWizard(tree,w.acceptStep(tree,next,index));
};
const fixture=()=>{
 let s=initial();
 const values=[A(100,20),months(100,20),A(0,0),months(0,0),A(70,12),months(70,12),A(2,0),months(2,0),A(30,5),months(30,5),A(3,1),months(3,1),A(10,2),months(10,2),A(1,1),months(1,1),A(10,2),months(10,2)];
 for(const value of values) s=advance(s,value);
 return s;
};
test('hierarchy includes Advisor and excludes inactive users',()=>{
 assert.deepEqual(tree.nodes[tree.root].children,['USR-000002','USR-000003','USR-000004']);
 assert.equal(tree.order.includes('USR-000010'),false);
 assert.throws(()=>w.buildWizardTree([...users,users[6]]),/duplikat/);
 assert.throws(()=>w.buildWizardTree([...users,user('USR-000011','STAFF_MARKETING','USR-999999')]),/Atasan/);
});
test('annual, personal and monthly NB/RN cascade through every level',()=>{
 const s=fixture();const steps=w.buildSteps(tree);
 assert.equal(s.accepted.length,steps.length);
 const check=w.validateWizard(tree,s,2026);
 assert.equal(check.total,120);
 assert.equal(check.director.annualTargetTotal,120);
 assert.equal(check.entries.reduce((sum,row)=>sum+row.personalTargetTotal,0),120);
 assert.deepEqual(check.state.allocations['USR-000008'].team,A(17,2));
 assert.deepEqual(check.state.allocations['USR-000006'].team,A(38,7));
 assert.deepEqual(check.state.allocations['USR-000009'].personal,A(37,6));
 assert.deepEqual(check.state.allocations['USR-000004'].personal,A(20,6));
 assert.deepEqual(check.state.allocations['USR-000008'].personalMonths,months(17,2));
 assert.equal(check.entries.find(row=>row.userId==='USR-000002').annualTargetTotal,82);
 assert.deepEqual(check.entries.find(row=>row.userId==='USR-000008').monthlyNewBusiness,[17,...Array(11).fill(0)]);
});
test('independent monthly budgets reject overallocations and annual mismatches',()=>{
 let s=advance(initial(),A(100,20));
 assert.throws(()=>advance(s,months(99,20)),/12 bulan/);
 s=advance(s,M([99,...Array(10).fill(0),1],[20,...Array(11).fill(0)]));s=advance(s,A(0,0));s=advance(s,months(0,0));
 assert.throws(()=>advance(s,A(101,0)),/negatif/);
 assert.throws(()=>advance(s,A(0,21)),/negatif/);
 s=advance(s,A(70,12));
 assert.throws(()=>advance(s,months(71,12)),/12 bulan/);
 assert.throws(()=>advance(s,M([70,...Array(11).fill(0)],[13,...Array(11).fill(0)])),/12 bulan/);
 s=advance(s,M([69,...Array(10).fill(0),1],[12,...Array(11).fill(0)]));s=advance(s,A(2,0));
 assert.throws(()=>advance(s,months(3,0)),/12 bulan/);
 assert.throws(()=>advance(s,M([0,0,0,0,0,0,0,0,0,0,0,2],Array(12).fill(0))),/negatif/);
});
test('exact rupiah and complete confirmations are mandatory',()=>{
 for(const bad of ['-1','1E3','1.5','9007199254740992','']) assert.throws(()=>advance(initial(),A(bad,0)));
 assert.throws(()=>w.validateWizard(tree,initial(),2026),/belum dikonfirmasi/);
 const s=fixture();s.accepted[0]='wrong';assert.throws(()=>w.validateWizard(tree,s,2026),/belum dikonfirmasi/);
});
test('existing monthly values are preserved and changing prior allocations requires reconfirmation',()=>{
 const original=w.validateWizard(tree,fixture(),2026).entries;
 const seeded=w.seedWizard(tree,original);
 assert.deepEqual(seeded.allocations['USR-000008'].personalMonths,months(17,2));
 assert.deepEqual(seeded.allocations['USR-000002'].teamMonths,months(70,12));
 assert.equal(seeded.accepted.length,0);
 const s=fixture();const edited=structuredClone(s);edited.accepted=edited.accepted.slice(0,4);
 assert.throws(()=>w.validateWizard(tree,edited,2026),/belum dikonfirmasi/);
 const next=advance(edited,A(60,12));assert.equal(next.accepted.length,5);
 assert.deepEqual(next.allocations['USR-000002'].team,A(60,12));
 assert.throws(()=>w.validateWizard(tree,next,2026),/belum dikonfirmasi/);
});
test('last child receives exact monthly residual even when months differ',()=>{
 const simple=[user('USR-000001','DIRECTOR_MARKETING',null),user('USR-000002','STAFF_MARKETING','USR-000001'),user('USR-000003','STAFF_MARKETING','USR-000001')];
 const t=w.buildWizardTree(simple);let s=w.seedWizard(t,[]);
 const advanceSimple=value=>{const i=s.accepted.length,step=w.buildSteps(t)[i];const next=structuredClone(s);next.allocations[step.id][step.phase]=value;s=w.continueWizard(t,w.acceptStep(t,next,i));};
 advanceSimple(A(13,5));advanceSimple(M([2,1,...Array(10).fill(1)],[0,2,0,0,0,0,0,0,0,0,0,3]));advanceSimple(A(0,0));advanceSimple(w.zeroMonths());advanceSimple(A(5,1));advanceSimple(M([1,0,1,0,1,0,1,0,1,0,0,0],[0,1,...Array(10).fill(0)]));
 const check=w.validateWizard(t,s,2026);
 assert.deepEqual(check.state.allocations['USR-000003'].personal,A(8,4));
 assert.deepEqual(check.state.allocations['USR-000003'].personalMonths.NB,['1','1','0','1','0','1','0','1','0','1','1','1']);
 assert.equal(check.director.annualTargetNewBusiness,13);
});
test('source keeps official publication behind explicit authorization and confirmation',()=>{
 const component=readFileSync('src/components/rkap/TargetCascadingWizard.tsx','utf8');
 const parent=readFileSync('src/pages/TargetRealizationUploadPage.tsx','utf8');
 const entry=readFileSync('src/components/rkap/TargetCascadingEntry.tsx','utf8');
 assert.match(parent,/TargetCascadingEntry/);
 assert.match(entry,/TargetCascadingWizard/);
 assert.match(component,/useTargetRealizationPublisher/);
 assert.match(component,/actorId === 'USR-000024'/);
 assert.match(component,/await listCentralTargets\(year\)/);
 assert.match(component,/sourceSnapshot/);
 assert.match(component,/sourceDirectory/);
 assert.match(component,/window\.confirm\(/);
 assert.match(component,/await publishCentralTargetBatch\(/);
 assert.doesNotMatch(component,/store\.publishTargetBatch\(/);
 assert.doesNotMatch(component,/localStorage\.setItem/);
});
