import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { filterAdminProductOptions } from '../src/lib/adminProductSearch.ts';
import { getAdminDocumentBrowseView } from '../src/lib/adminDocumentBrowse.ts';

const products = Object.freeze(['Credit Shield', 'Credit Shield Plus', 'PLife Shield', 'MAPS', 'Élite Protection']);
const doc = (id, productName) => ({
  id, productName, category: 'FACT_FINDING', ownerArea: 'MARKETING_ADMINISTRATION',
  status: 'PUBLISHED', title: 'Fact Finding', fileName: `${id}.pdf`, versionLabel: 'V1',
});
const documents = [doc('credit', 'Credit Shield'), doc('other', 'PLife Shield')];

test('search matches names regardless of case, accents or term order', () => {
  assert.deepEqual(filterAdminProductOptions(products, 'cReDiT'), ['Credit Shield', 'Credit Shield Plus']);
  assert.deepEqual(filterAdminProductOptions(products, 'shield credit'), ['Credit Shield', 'Credit Shield Plus']);
  assert.deepEqual(filterAdminProductOptions(products, '  credit   SHIELD  '), ['Credit Shield', 'Credit Shield Plus']);
  assert.deepEqual(filterAdminProductOptions(products, 'elite'), ['Élite Protection']);
  assert.deepEqual(filterAdminProductOptions(products, 'maps'), ['MAPS']);
});

test('empty search restores all options; no match and unrelated names are handled', () => {
  assert.deepEqual(filterAdminProductOptions(products, ''), products);
  assert.deepEqual(filterAdminProductOptions(products, '   '), products);
  assert.deepEqual(filterAdminProductOptions(products, 'not-a-product'), []);
  assert.deepEqual(filterAdminProductOptions(products, 'credit maps'), []);
  assert.deepEqual(products, ['Credit Shield', 'Credit Shield Plus', 'PLife Shield', 'MAPS', 'Élite Protection']);
});

test('search suggestions do not select a product or unlock document listings', () => {
  assert.deepEqual(getAdminDocumentBrowseView(documents, { product: 'ALL', category: 'FACT_FINDING', search: 'credit' }).visibleDocuments, []);
  assert.deepEqual(getAdminDocumentBrowseView(documents, { product: 'Credit Shield', category: null, search: '' }).visibleDocuments, []);
  assert.deepEqual(getAdminDocumentBrowseView(documents, { product: 'Credit Shield', category: 'FACT_FINDING', search: '' }).visibleDocuments.map(item => item.id), ['credit']);
});

test('searchable picker is wired to the existing product-first selection and download guards', () => {
  const picker = readFileSync('src/components/documents/AdminProductPicker.tsx', 'utf8');
  const browser = readFileSync('src/components/documents/AdminDocumentBrowser.tsx', 'utf8');
  assert.match(picker, /<CommandInput[^>]*autoFocus[^>]*value=\{query\}/);
  assert.match(picker, /filterAdminProductOptions\(options, query\)/);
  assert.match(picker, /onSelect=\{\(\) => selectProduct\(productName\)\}/);
  assert.match(picker, /onChange\(product\)/);
  assert.match(picker, /setQuery\(''\)/);
  assert.match(picker, /disabled=\{disabled\}/);
  assert.match(browser, /<AdminProductPicker[^>]*value=\{selection\.product\}[^>]*onChange=\{changeProduct\}/);
  assert.match(browser, /setSelection\(\{ product, category: null, search: '' \}\)/);
  assert.match(browser, /!view\.productSelected \|\| busy/);
  assert.match(browser, /canDownloadAdminDocument\(documents, selection, document\)/);
});
