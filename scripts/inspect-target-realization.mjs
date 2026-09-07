import { readFileSync } from 'node:fs';
import ts from 'typescript';
const read = path => readFileSync(path, 'utf8');
const emit = (path, patterns, before=4, after=22) => {
  const lines = read(path).split('\n');
  console.log(`\n### ${path}: ${lines.length} lines`);
  const selected = new Set();
  for (let i=0;i<lines.length;i++) if(patterns.some(p=>p.test(lines[i]))) {
    for(let j=Math.max(0,i-before);j<=Math.min(lines.length-1,i+after);j++) selected.add(j);
  }
  for(const i of [...selected].sort((a,b)=>a-b)) console.log(`${i+1}: ${lines[i]}`);
};
const astReport = path => {
 const text=read(path), sf=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 console.log(`\n### STRUCTURE ${path}`);
 function visit(node){
  if(ts.isVariableDeclaration(node) && /^(TargetRkapPage|ProduksiPage)$/.test(node.name.getText(sf))){
   const arrow=node.initializer && (ts.isAsExpression(node.initializer)?node.initializer.expression:node.initializer);
   if(arrow && ts.isArrowFunction(arrow) && ts.isBlock(arrow.body)){
    for(const st of arrow.body.statements){
     const p=sf.getLineAndCharacterOfPosition(st.getStart(sf));
     const e=sf.getLineAndCharacterOfPosition(st.end);
     if(ts.isIfStatement(st) || ts.isReturnStatement(st)) console.log(`${p.line+1}-${e.line+1}: ${st.getText(sf).slice(0,230).replace(/\s+/g,' ')}`);
    }
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(sf);
};
emit('src/services/store.ts',[/OfficialProductionSummary/,/OfficialProductionBatch/,/publishOfficialProductionBatch/],3,35);
emit('src/pages/ProduksiPage.tsx',[/value="upload_official"/,/defaultValue="official"/,/isArianie &&/,/publishOfficialProductionBatch/],3,12);
emit('src/pages/TargetRkapPage.tsx',[/defaultValue="targets"/,/value="bulk"/,/isTLMS/,/publishTargetBatch/],2,8);
astReport('src/pages/TargetRkapPage.tsx');
astReport('src/pages/ProduksiPage.tsx');
