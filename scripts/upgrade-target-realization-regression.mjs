import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/test-target-realization-navigation.mjs';
const source = readFileSync(path, 'utf8');
const before = `    assert.equal(read(path), transform(original), \`${'${path}'} contains an unexpected change\`);`;
const after = `    // XLSX upload changes are a separately approved release. Pin the two
    // changed upload pages to that release while retaining exact historical
    // transforms for every other navigation, permission and reader file.
    const xlsxBaseline = '76c655d4adadd42f0e5388e1729aa120afdb0c2d';
    const expected = ['src/pages/TargetRkapPage.tsx', 'src/pages/ProduksiPage.tsx'].includes(path)
      ? git('show', \`${'${xlsxBaseline}'}:${'${path}'}\`)
      : transform(original);
    assert.equal(read(path), expected, \`${'${path}'} contains an unexpected change\`);`;
assert.equal(source.split(before).length, 2, 'Expected exactly one historical source assertion');
const next = source.replace(before, after);
writeFileSync(path, next);
console.log('Historical source snapshot now recognizes the approved XLSX release. All functional and security assertions remain unchanged.');
