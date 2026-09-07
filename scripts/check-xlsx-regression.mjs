import { execFileSync } from 'node:child_process';
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';

const root = process.cwd();
const base = '6b087d9ceccd6a52fd1d83ea6dbaf27bdd9bbcbc';
const files = ['src/utils/marketingWorkbook.ts', 'src/utils/excelExport.ts', 'src/pages/TargetRkapPage.tsx', 'src/pages/ProduksiPage.tsx'];
const dir = mkdtempSync(join(tmpdir(), 'xlsx-baseline-'));
const run = (command, args, cwd) => {
  try { return execFileSync(command, args, {cwd, encoding:'utf8', maxBuffer:20*1024*1024}); }
  catch(error) { if (typeof error.stdout === 'string') return error.stdout; throw error; }
};
const diagnostics = (cwd) => {
  const config = ts.readConfigFile(join(cwd,'tsconfig.app.json'), ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, cwd);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  return ts.getPreEmitDiagnostics(program).map(d => {
    const path = d.file ? d.file.fileName.replace(cwd + '/', '') : 'config';
    return `${path}|TS${d.code}|${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`;
  });
};
const lint = (cwd, paths) => {
  const output = run(join(root,'node_modules/.bin/eslint'), ['--format','json',...paths], cwd);
  return JSON.parse(output).flatMap(file => file.messages.filter(m => m.severity === 2).map(m => `${file.filePath.replace(cwd + '/', '')}|${m.ruleId}|${m.message}`));
};
const compare = (label, before, after) => {
  const counts = new Map();
  for (const item of before) counts.set(item,(counts.get(item)||0)+1);
  const added=[];
  for(const item of after){const n=counts.get(item)||0;if(n)counts.set(item,n-1);else added.push(item);}
  console.log(`${label}: baseline=${before.length}, current=${after.length}, new=${added.length}`);
  if(added.length){console.error(added.join('\n'));process.exitCode=1;}
};
try {
  run('git',['worktree','add','--detach',dir,base],root);
  symlinkSync(join(root,'node_modules'),join(dir,'node_modules'));
  const oldFiles=files.filter(path=>path!=='src/utils/marketingWorkbook.ts');
  compare('ESLint errors',lint(dir,oldFiles),lint(root,files));
  compare('TypeScript diagnostics',diagnostics(dir),diagnostics(root));
} finally {
  rmSync(join(dir,'node_modules'),{force:true});
  run('git',['worktree','remove','--force',dir],root);
  rmSync(dir,{recursive:true,force:true});
}
if(process.exitCode) throw new Error('New static-analysis diagnostics found; release blocked.');
