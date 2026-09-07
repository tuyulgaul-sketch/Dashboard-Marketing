import ts from 'typescript';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
const source = p => ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const keys = /TARGETS|TARGET_BATCHES|BOOKINGS|PIPELINES|APPEALS|PRODUCTIONS|OFFICIAL_PRODUCTION|OFFICIAL_POLICY|PARTICIPANTS|HISTORICAL|REIMBURSEMENTS|SUPPORTING_DOCS/;
const store = source('src/services/store.ts');
function walk(node, fn) { fn(node); ts.forEachChild(node, child => walk(child, fn)); }
console.log('=== STORE METHODS TOUCHING CAPPED COLLECTIONS ===');
walk(store, node => {
  if (!ts.isClassDeclaration(node) || node.name?.text !== 'StoreService') return;
  for (const method of node.members) {
    if (!ts.isMethodDeclaration(method)) continue;
    const text = method.getText(store);
    if (!keys.test(text)) continue;
    const used = [...new Set([...text.matchAll(/STORAGE_KEYS\.([A-Z_]+)/g)].map(m => m[1]))];
    const calls = [...new Set([...text.matchAll(/this\.([A-Za-z][\w]*)\s*\(/g)].map(m => m[1]))];
    console.log(JSON.stringify({name:method.name.getText(store), line:store.getLineAndCharacterOfPosition(method.pos).line+1, keys:used, calls, signature:text.slice(0,text.indexOf('{')).trim().slice(0,600)}));
  }
});
for (const page of ['Index','TargetRkapPage','BookingPipelinePage','ProduksiPage','DigitalAffinityPage']) {
  const path = `src/pages/${page}.tsx`;
  if (!existsSync(path)) continue;
  const text = read(path);
  console.log(`=== PAGE ${page} ===`);
  console.log('STORE CALLS', JSON.stringify([...new Set([...text.matchAll(/store\.([A-Za-z][\w]*)\s*\(/g)].map(m=>m[1]))].sort()));
  console.log('FILE / SERVICE IMPORTS', JSON.stringify(text.split('\n').filter(line=>/from ['\"]@\/(services|lib)\//.test(line)||/from ['\"]\.\.?\//.test(line)).slice(0,100)));
  console.log('DIRECT STORAGE',JSON.stringify([...new Set([...text.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(([^,)]+)/g)].map(m=>m[1]))]));
}
console.log('=== RELEVANT SERVICE FILES ===');
console.log(JSON.stringify(readdirSync('src/services').filter(name=>/central|target|pipeline|production|fileStorage|historical|reimburse|participant|master/i.test(name)).sort()));
console.log('=== MIGRATION FILES ===');
console.log(JSON.stringify(readdirSync('supabase/migrations').filter(name=>/target|pipeline|production|business|master|restor/i.test(name)).sort()));
console.log('=== CAPPED STORAGE DIRECT USAGE ===');
for (const dir of ['src/pages','src/services','src/components']) {
  const visit = d => { for(const entry of readdirSync(d,{withFileTypes:true})) {const p=`${d}/${entry.name}`;if(entry.isDirectory())visit(p);else if(/\.(ts|tsx)$/.test(p)){const text=read(p);const matches=[...new Set([...text.matchAll(/(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\s*\(\s*['\"]([^'\"]+)['\"]/g)].map(m=>m[1]).filter(k=>/target|booking|pipeline|production|participant|historical|reimburse|policy|supporting_docs/i.test(k)))];if(matches.length)console.log(p,JSON.stringify(matches));}}};visit(dir);
}
