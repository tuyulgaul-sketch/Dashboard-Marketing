import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canDownloadAdminDocument,
  getAdminDocumentBrowseView,
  hasSelectedAdminDocumentProduct,
} from '../src/lib/adminDocumentBrowse.ts';

const doc = (id, category, productName, overrides = {}) => ({
  id, category, productName, ownerArea: 'MARKETING_ADMINISTRATION', status: 'PUBLISHED',
  title: `${category} ${productName}`, fileName: `${id}.pdf`, versionLabel: 'V1',
  approvedAt: '2026-09-07', ...overrides,
});
const documents = Object.freeze([
  doc('1', 'SPAJ', 'Credit Shield'),
  doc('2', 'SPAK', 'Credit Shield'),
  doc('3', 'FACT_FINDING', 'Credit Shield'),
  doc('4', 'FACT_FINDING', 'PLife Shield'),
  doc('5', 'FACT_FINDING', 'Credit Shield', { status: 'PENDING_APPROVAL' }),
  doc('6', 'FACT_FINDING', 'Credit Shield', { status: 'INACTIVE' }),
  doc('7', 'FACT_FINDING', 'Credit Shield', { ownerArea: 'MARKETING_COMMUNICATION' }),
  doc('8', 'BROSUR', 'Credit Shield'),
  doc('9', 'SPAJ', 'Credit Shield Plus'),
]);
const choose = (product = 'ALL', category = null, search = '') => ({ product, category, search });
const view = (selection) => getAdminDocumentBrowseView(documents, selection);

 test('all products and empty product never expose a list or a download', () => {
  for (const product of ['ALL', 'all', '', '   ']) {
    const selection = choose(product, 'FACT_FINDING', '');
    const result = view(selection);
    assert.equal(hasSelectedAdminDocumentProduct(product), false);
    assert.equal(result.productSelected, false);
    assert.equal(result.category, null);
    assert.deepEqual(result.visibleDocuments, []);
    assert.equal(canDownloadAdminDocument(documents, selection, documents[2]), false);
  }
  assert.deepEqual(view(choose()).counts, { SPAJ: 2, SPAK: 1, FACT_FINDING: 2 });
});

test('selecting a product alone shows scoped counts but no document listing', () => {
  const selection = choose('Credit Shield');
  assert.equal(view(selection).productSelected, true);
  assert.equal(view(selection).category, null);
  assert.deepEqual(view(selection).counts, { SPAJ: 1, SPAK: 1, FACT_FINDING: 1 });
  assert.deepEqual(view(selection).visibleDocuments, []);
  assert.equal(canDownloadAdminDocument(documents, selection, documents[2]), false);
});

test('clicking each category reveals only that exact product and category', () => {
  for (const [category, id] of [['SPAJ', '1'], ['SPAK', '2'], ['FACT_FINDING', '3']]) {
    const selection = choose('Credit Shield', category);
    assert.deepEqual(view(selection).visibleDocuments.map(item => item.id), [id]);
    assert.equal(canDownloadAdminDocument(documents, selection, documents.find(item => item.id === id)), true);
  }
  assert.deepEqual(view(choose('Credit Shield', 'BROSUR')).visibleDocuments, []);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'FACT_FINDING'), documents[3]), false);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'FACT_FINDING'), documents[4]), false);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'FACT_FINDING'), documents[5]), false);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'FACT_FINDING'), documents[6]), false);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'SPAJ'), documents[8]), false);
});

test('search cannot bypass the product and category gates', () => {
  assert.deepEqual(view(choose('ALL', 'FACT_FINDING', 'Credit Shield')).visibleDocuments, []);
  assert.deepEqual(view(choose('Credit Shield', null, 'FACT_FINDING')).visibleDocuments, []);
  assert.deepEqual(view(choose('Credit Shield', 'FACT_FINDING', 'PLife Shield')).visibleDocuments, []);
  assert.deepEqual(view(choose('Credit Shield', 'FACT_FINDING', 'v1')).visibleDocuments.map(item => item.id), ['3']);
  assert.equal(canDownloadAdminDocument(documents, choose('Credit Shield', 'FACT_FINDING', 'not found'), documents[2]), false);
});

test('empty category and changing product never inherit a different product listing', () => {
  assert.deepEqual(view(choose('Credit Shield', 'SPAK')).visibleDocuments.map(item => item.id), ['2']);
  assert.deepEqual(view(choose('PLife Shield', 'SPAK')).visibleDocuments, []);
  assert.deepEqual(view(choose('PLife Shield', 'FACT_FINDING')).visibleDocuments.map(item => item.id), ['4']);
  assert.deepEqual(view(choose('Credit Shield', 'FACT_FINDING')).visibleDocuments.map(item => item.id), ['3']);
  assert.deepEqual(view(choose('Credit Shield', 'SPAJ')).counts, { SPAJ: 1, SPAK: 1, FACT_FINDING: 1 });
});

test('source-bound download validation rejects a copied or foreign row', () => {
  const selection = choose('Credit Shield', 'FACT_FINDING');
  assert.equal(canDownloadAdminDocument(documents, selection, { ...documents[2] }), false);
  assert.equal(canDownloadAdminDocument(documents, selection, documents[2]), true);
  assert.deepEqual(documents.map(item => item.id), ['1','2','3','4','5','6','7','8','9']);
});
