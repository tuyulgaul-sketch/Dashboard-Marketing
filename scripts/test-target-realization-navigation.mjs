import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { FINAL_TRANSFORMS } from './integrate-target-realization-v2.mjs';
import { COMPACT_BASE, compactTargetTransform } from './integrate-compact-target.mjs';
import { MATRIX_BASE, matrixTransforms } from './integrate-rkap-pipeline-matrix.mjs';
import { advisorProductionPageTransform } from './approved-advisor-production-transform.mjs';

const require = createRequire(import.meta.url);
const read = path => readFileSync(path, 'utf8');
const BASE = '9bfee0235fd36b02c8f74577dc5bea66d52c4028';
const NEW_BASES = {
  'src/pages/DirectoratePerformancePage.tsx': 'f9a658990b112c4a8b284bfe4c18e40f09dc3f5a',
  'src/pages/TargetRealizationUploadPage.tsx': 'af31810c08f3f6d051fec76d53a861a32c5cb380',
};
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const load = (path, mocks = {}) => {
  const compiledCode = ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const Module = require('node:module');
  const filename = resolve(path) + '.test.cjs';
  const compiled = new Module(filename);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(resolve('.'));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : normalRequire(id);
  compiled._compile(compiledCode, filename);
  return compiled.exports;
};

const profile = (unit, department = null, overrides = {}) => ({
  id: 'profile-test', auth_user_id: 'auth-test', full_name: 'Test', email: 'test@example.invalid',
  role_level: 'Staff', unit, department, manager_id: null, legacy_user_id: null, active: true, ...overrides,
});

test('every intentional existing-source change is exactly the approved transform', () => {
  for (const [path, transform] of Object.entries(FINAL_TRANSFORMS)) {
    const original = git('show', `${NEW_BASES[path] || BASE}:${path}`);
    // XLSX upload changes are a separately approved release. Pin the two
    // changed upload pages to that release while retaining exact historical
    // transforms for every other navigation, permission and reader file.
    const xlsxBaseline = '76c655d4adadd42f0e5388e1729aa120afdb0c2d';
    const expected = path === 'src/pages/ProduksiPage.tsx'
      ? advisorProductionPageTransform(git('show', `${xlsxBaseline}:${path}`))
      : path === 'src/pages/TargetRealizationUploadPage.tsx'
        ? git('show', `8120adfa0e9183843924b9fb43496abf7b028945:${path}`)
        : matrixTransforms[path]
          ? matrixTransforms[path](git('show', `${MATRIX_BASE}:${path}`))
          : path === 'src/pages/TargetRkapPage.tsx'
            ? compactTargetTransform[path](git('show', `${COMPACT_BASE}:${path}`))
            : transform(original);
    assert.equal(read(path), expected, `${path} contains an unexpected change`);
  }
  for (const path of ['src/services/centralBusinessService.ts','src/services/centralBusinessStorageRuntime.ts','src/services/centralTargetRuntime.ts','src/services/targetService.ts','src/contexts/AuthContext.tsx','src/pages/BookingPipelinePage.tsx','src/pages/TandaTerimaV14Page.tsx','src/pages/DokumenPendukungPage.tsx','src/pages/DokumenAdministrasiReaderPage.tsx','src/pages/AktivitasUniversalPage.tsx','src/pages/MarketingMeetingRoomPage.tsx','src/services/documentHandoverFileStorage.ts']) {
    assert.equal(read(path), git('show', `${BASE}:${path}`), `${path} must remain byte-for-byte unchanged`);
  }
  console.log('Existing business handlers, approvals, documents, TRM, auth and storage remain unchanged.');
});

test('read-only target and realization access widens without changing unrelated RBAC', () => {
  const { canAccessFeature } = load('src/lib/accessControl.ts');
  const users = [
    profile('Captive Marketing','Captive I',{legacy_user_id:'USR-000005'}),
    profile('Corporate & Retail Marketing','CRM I',{legacy_user_id:'USR-000016'}),
    profile('Marketing Support','Marketing Administration',{legacy_user_id:'USR-000026'}),
    profile('Marketing Support','Marketing Communication'),
    profile('Marketing Support','Digital & Affinity'),
    profile('Marketing Support',null,{legacy_user_id:'USR-000024'}),
    profile('Directorate Marketing',null,{role_level:'Director',legacy_user_id:'USR-000001'}),
  ];
  for (const user of users) {
    assert.equal(canAccessFeature(user,'TARGET_RKAP'),true);
    assert.equal(canAccessFeature(user,'PRODUCTION'),true);
    assert.equal(canAccessFeature({...user,active:false},'TARGET_RKAP'),false);
    assert.equal(canAccessFeature({...user,active:false},'PRODUCTION'),false);
  }
  const system = profile('Administrasi Sistem',null,{role_level:'SYSTEM_ADMIN'});
  for (const feature of ['TARGET_RKAP','PRODUCTION','BOOKING_PIPELINE','DOCUMENT_ADMIN']) assert.equal(canAccessFeature(system,feature),false);
  assert.equal(canAccessFeature(system,'SYSTEM_ADMIN'),true);
  for (const department of ['Marketing Communication','Digital & Affinity']) {
    const user = profile('Marketing Support',department);
    assert.equal(canAccessFeature(user,'BOOKING_PIPELINE'),false);
    assert.equal(canAccessFeature(user,'DOCUMENT_ADMIN'),true);
    assert.equal(canAccessFeature(user,'DOCUMENT_MARCOMM'),department==='Marketing Communication' ? false : false);
  }
  assert.equal(canAccessFeature(profile('Marketing Support','Marketing Administration',{legacy_user_id:'USR-000026'}),'BOOKING_PIPELINE'),true);
  assert.equal(canAccessFeature(profile('Captive Marketing','Captive I'),'BOOKING_PIPELINE'),false);
  assert.equal(canAccessFeature(null,'TARGET_RKAP'),false);
});

test('desktop and mobile navigation show two reader choices and only the authorized third choice', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const access = load('src/lib/accessControl.ts');
  let currentProfile = profile('Marketing Support','Digital & Affinity');
  let publisher = false;
  const RouterLink = ({ to, children, className }) => React.createElement('a', { href: to, className: typeof className === 'function' ? className({isActive:false}) : className }, children);
  const { AppSidebar } = load('src/components/layout/AppSidebar.tsx', {
    react: React,
    'react-router-dom': { Link: RouterLink, NavLink: RouterLink, useLocation: () => ({pathname:'/',search:''}) },
    '@/contexts/AuthContext': { useAuth: () => ({profile:currentProfile}) },
    '@/lib/accessControl': access,
    '@/hooks/useTargetRealizationPublisher': { useTargetRealizationPublisher: () => ({canPublish:publisher,loading:false}) },
  });
  const render = mobile => renderToStaticMarkup(React.createElement(AppSidebar,{mobile}));
  for (const mobile of [false,true]) {
    let html = render(mobile);
    assert.match(html,/Target &amp; Realisasi/);
    assert.match(html,/href="\/target-rkap"/);
    assert.match(html,/href="\/produksi"/);
    assert.doesNotMatch(html,/href="\/target-realisasi\/upload"/);
    assert.doesNotMatch(html,/>Produksi<\/span>/);
    currentProfile=profile('Marketing Support',null,{legacy_user_id:'USR-000024'});
    publisher=true;
    html=render(mobile);
    assert.match(html,/href="\/target-realisasi\/upload"/);
    assert.match(html,/Upload Target dan Realisasi/);
    currentProfile=profile('Marketing Support','Marketing Administration',{legacy_user_id:'USR-000026'});
    publisher=false;
    html=render(mobile);
    assert.match(html,/href="\/produksi"/);
    assert.doesNotMatch(html,/href="\/target-realisasi\/upload"/);
    currentProfile=profile('Marketing Support','Digital & Affinity');
  }
});

test('publisher permission waits for the actual server result and rejects Login As escalation', async () => {
  const React = require('react');
  const states = [];
  let index = 0;
  const effects = [];
  let actualProfile = profile('Marketing Support',null,{legacy_user_id:'USR-000024'});
  let actor = 'USR-000024';
  let subscription;
  let calls = 0;
  let serverAllows = true;
  const fakeReact = {
    useState: initial => {
      const slot=index++;
      if (!(slot in states)) states[slot]=typeof initial==='function'?initial():initial;
      return [states[slot], value => {states[slot]=typeof value==='function'?value(states[slot]):value;}];
    },
    useEffect: callback => {effects.push(callback);},
  };
  const { useTargetRealizationPublisher } = load('src/hooks/useTargetRealizationPublisher.ts', {
    react: fakeReact,
    '@/contexts/AuthContext': {useAuth:()=>({session:{user:{id:'auth-test'}},profile:actualProfile})},
    '@/lib/supabase': {supabase:{rpc:async name=>{calls++;assert.equal(name,'can_publish_marketing_targets');return {data:serverAllows,error:null};}}},
    '@/services/store': {store:{getCurrentUser:()=>({id:actor}),subscribe:callback=>{subscription=callback;return ()=>{};}}},
  });
  const render=()=>{index=0;effects.length=0;return useTargetRealizationPublisher();};
  assert.deepEqual(render(),{canPublish:false,loading:true});
  for(const effect of effects) effect();
  await Promise.resolve();
  assert.deepEqual(render(),{canPublish:true,loading:false});
  assert.equal(calls,1);
  actor='USR-000005'; subscription();
  assert.equal(render().canPublish,false);
  actor='USR-000024'; subscription();
  actualProfile=profile('Marketing Support','Marketing Communication');
  assert.equal(render().canPublish,false);
  serverAllows=false;
  actualProfile=profile('Marketing Support',null,{legacy_user_id:'USR-000024'});
  states.length=0;
  assert.equal(render().loading,true);
  for(const effect of effects) effect();
  await Promise.resolve();
  assert.equal(render().canPublish,false);
  assert.equal(calls,2);
  assert.match(read('src/pages/TargetRealizationUploadPage.tsx'),/if \(!canPublish\) return <Navigate/);
});

test('aggregation uses distributed personal targets and current official rows only', async () => {
  const payload = {
    refreshedAt:'2026-09-07T07:00:00Z',
    targets:[
      {year:2026,unit:'Captive Marketing',department:'Captive I',annualTotal:120,annualNB:80,annualRN:40,monthlyNB:[80,...Array(11).fill(0)],monthlyRN:[40,...Array(11).fill(0)]},
      {year:2026,unit:'Corporate & Retail Marketing',department:'CRM I',annualTotal:240,annualNB:120,annualRN:120,monthlyNB:[120,...Array(11).fill(0)],monthlyRN:[120,...Array(11).fill(0)]},
      {year:2026,unit:'Directorate Marketing',department:'None',annualTotal:60,annualNB:50,annualRN:10,monthlyNB:[50,...Array(11).fill(0)],monthlyRN:[10,...Array(11).fill(0)]},
    ],
    summaries:[
      {id:'s1',year:2026,month:1,unit:'Captive Marketing',department:'Captive I',businessType:'New Business',productName:'Credit Shield',amount:30,transactionCount:3},
      {id:'s2',year:2026,month:1,unit:'Captive Marketing',department:'Captive I',businessType:'Renewal Business',productName:'Credit Shield',amount:-5,transactionCount:1},
      {id:'s3',year:2026,month:2,unit:'Corporate & Retail Marketing',department:'CRM I',businessType:'New Business',productName:'MAPS',amount:20,transactionCount:5},
    ],
    batches:[{id:'b1',uploadedAt:'2026-09-07T07:00:00Z',uploadedByName:'Publisher',filename:'snapshot.csv',publishedPeriodKeys:['2026-01','2026-02'],totalProductionAmount:45,validRowCount:9}],
  };
  let rpcName='';
  const service=load('src/services/directoratePerformanceService.ts',{
    '@/lib/supabase':{supabase:{rpc:async name=>{rpcName=name;return {data:payload,error:null};}}},
  });
  const snapshot=await service.listDirectoratePerformance();
  assert.equal(rpcName,'list_directorate_performance_v33');
  const overall=service.buildPerformanceSummary(snapshot,2026,'ALL','OVERALL');
  assert.equal(overall.annualTarget,420);
  assert.equal(overall.actual,45);
  assert.equal(overall.nb,50);
  assert.equal(overall.rn,-5);
  assert.equal(overall.transactions,9);
  assert.equal(overall.monthly[0].actual,25);
  assert.equal(overall.monthly[1].actual,20);
  assert.equal(overall.achievement,45/420*100);
  const captive=service.buildPerformanceSummary(snapshot,2026,'Captive Marketing','OVERALL');
  assert.equal(captive.annualTarget,120);
  assert.equal(captive.actual,25);
  assert.equal(service.buildPerformanceSummary(snapshot,2026,'ALL','New Business').annualTarget,250);
  assert.equal(service.buildPerformanceSummary(snapshot,2026,'ALL','Renewal Business').actual,-5);
  assert.equal(service.buildPerformanceSummary(snapshot,2027,'ALL','OVERALL').achievement,null);
  assert.equal(service.matchesPerformanceScope({unit:'Captive II',department:'None'},'Captive Marketing'),true);
  assert.equal(service.matchesPerformanceScope({unit:'Captive II',department:'None'},'CRM I'),false);
  payload.summaries[0].amount='not-a-number';
  await assert.rejects(service.listDirectoratePerformance(),/angka yang tidak valid/);
});

test('reader and upload migrations are narrow, non-destructive and do not expose policy records', () => {
  const reader=read('supabase/migrations/20260907_directorate_performance_reader_v33.sql');
  const guard=read('supabase/migrations/20260907_official_upload_guard_v34.sql');
  assert.match(reader,/security definer/);
  assert.match(reader,/auth\.uid\(\)/);
  assert.match(reader,/p\.active = true/);
  assert.match(reader,/revoke all[\s\S]*?from public, anon/);
  assert.match(reader,/grant execute[\s\S]*?to authenticated/);
  assert.doesNotMatch(reader,/official_policy_directory|customerName|policyNumber|picName|picUserId/);
  assert.doesNotMatch(reader,/\b(insert|update|delete|truncate)\s+(into\s+|from\s+)?public\./i);
  assert.match(reader,/b\.is_current = true/);
  assert.match(guard,/can_publish_marketing_targets\(\)/);
  assert.match(guard,/v_old_source <> 'RKAP_BULK'/);
  assert.match(guard,/pertalife_official_production_summaries/);
  assert.match(guard,/pertalife_official_production_batches/);
  assert.doesNotMatch(guard,/drop\s+table|truncate\s+table|update\s+public\.profiles|delete\s+from\s+public\.profiles/i);
  for(const path of ['src/pages/DirectoratePerformancePage.tsx','src/services/directoratePerformanceService.ts']) {
    const source=read(path);
    assert.doesNotMatch(source,/localStorage|sessionStorage|applyCentralBusinessChanges|publishOfficialProductionSnapshot|publishTargetBatch|service_role/);
  }
  const app=read('src/App.tsx');
  for(const route of ['/target-rkap','/produksi','/target-realisasi/upload','/booking-pipeline','/aktivitas','/tanda-terima']) assert(app.includes(`path="${route}"`));
  assert.match(app,/<TargetViewRoute \/>/);
  assert.match(app,/<DirectoratePerformancePage view="realization" \/>/);
  const hub=read('src/pages/TargetRealizationUploadPage.tsx');
  for(const tab of ['targets','bulk','realization']) assert(hub.includes(`value="${tab}"`));
  assert.match(hub,/publisherAuthorized=\{canPublish\}/);
  console.log('Only the intended reader, upload hub and narrow writer guard are introduced.');
});
