import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADMIN_DOCUMENT_CATEGORIES, isAdminDocumentCategory } from '../src/lib/adminDocumentCategories.ts';
import {
  filterPublishedAdminDocuments,
  getAdminDocumentProductOptions,
  getPublishedAdminDocumentCounts,
} from '../src/lib/adminDocumentReaderView.ts';

const doc = (overrides = {}) => ({
  id: 'doc-1', ownerArea: 'MARKETING_ADMINISTRATION', status: 'PUBLISHED',
  category: 'SPAJ', productName: 'PLife Shield', title: 'Form SPAJ',
  fileName: 'spaj.pdf', versionLabel: 'V1', approvedAt: '2026-09-01', ...overrides,
});
const all = { product: 'ALL', search: '' };
const zeroCounts = { SPAJ: 0, SPAK: 0, FACT_FINDING: 0 };

test('three shared document categories are explicit and unique', () => {
  assert.deepEqual(ADMIN_DOCUMENT_CATEGORIES.map(item => item.value), ['SPAJ', 'SPAK', 'FACT_FINDING']);
  assert.equal(ADMIN_DOCUMENT_CATEGORIES[2].label, 'Fact Finding');
  assert.equal(isAdminDocumentCategory('FACT_FINDING'), true);
  assert.equal(isAdminDocumentCategory('BROSUR'), false);
  assert.equal(isAdminDocumentCategory('FACT_FINDING_OTHER'), false);
});

test('empty catalogue keeps active product choices and zero counts', () => {
  const products = [{ productName: 'PLife Shield', status: 'Active' }, { productName: 'MAPS', status: 'Active' }];
  assert.deepEqual(getAdminDocumentProductOptions(products, []), ['MAPS', 'PLife Shield']);
  assert.deepEqual(filterPublishedAdminDocuments([], all), []);
  assert.deepEqual(getPublishedAdminDocumentCounts([]), zeroCounts);
});

test('product choices are sorted, deduplicated and retain published archived products', () => {
  const products = [
    { productName: 'PLife Shield', status: 'Active' },
    { productName: 'plife shield', status: 'Active' },
    { productName: 'MAPS', status: 'Active' },
    { productName: 'Legacy Product', status: 'Inactive' },
    { productName: 'Never Published', status: 'Inactive' },
  ];
  const documents = [doc({ productName: 'Legacy Product' }), doc({ productName: 'Never Published', status: 'DRAFT' })];
  const options = getAdminDocumentProductOptions(products, documents);
  assert.deepEqual(options, ['Legacy Product', 'MAPS', 'plife shield']);
  assert.equal(options.includes('Never Published'), false);
});

test('only published admin SPAJ, SPAK and Fact Finding are visible', () => {
  const documents = [doc(), doc({ id: '2', category: 'SPAK' }), doc({ id: '3', status: 'DRAFT' }),
    doc({ id: '4', ownerArea: 'MARKETING_COMMUNICATION' }), doc({ id: '5', category: 'BROSUR' }),
    doc({ id: '6', status: 'PENDING_APPROVAL' }), doc({ id: '7', category: 'FACT_FINDING' }),
    doc({ id: '8', category: 'FACT_FINDING', status: 'INACTIVE' }),
    doc({ id: '9', category: 'FACT_FINDING', ownerArea: 'MARKETING_COMMUNICATION' }),
    doc({ id: '10', category: 'FACT_FINDING_OTHER' })];
  assert.deepEqual(filterPublishedAdminDocuments(documents, all).map(item => item.id), ['doc-1', '2', '7']);
  assert.deepEqual(getPublishedAdminDocumentCounts(documents), { SPAJ: 1, SPAK: 1, FACT_FINDING: 1 });
});

test('product selection uses exact normalized names, not partial matches', () => {
  const documents = [doc(), doc({ id: '2', productName: 'PLife Shield Plus' }), doc({ id: '3', productName: 'MAPS' })];
  assert.deepEqual(filterPublishedAdminDocuments(documents, { product: ' plife shield ', search: '' }).map(item => item.id), ['doc-1']);
  assert.equal(filterPublishedAdminDocuments(documents, { product: 'MAPS', search: '' }).length, 1);
  assert.equal(filterPublishedAdminDocuments(documents, { product: 'Unknown', search: '' }).length, 0);
});

test('search and product filter combine across title, category, filename and version', () => {
  const documents = [doc(), doc({ id: '2', category: 'SPAK', title: 'Ketentuan', fileName: 'ketentuan.pdf', versionLabel: 'V2' }),
    doc({ id: '3', category: 'FACT_FINDING', title: 'Kebutuhan Nasabah', fileName: 'needs.pdf', productName: 'MAPS' })];
  assert.deepEqual(filterPublishedAdminDocuments(documents, { product: 'PLife Shield', search: 'spak' }).map(item => item.id), ['2']);
  assert.deepEqual(filterPublishedAdminDocuments(documents, { product: 'MAPS', search: 'fact finding' }).map(item => item.id), ['3']);
  assert.equal(filterPublishedAdminDocuments(documents, { product: 'ALL', search: 'KETENTUAN.PDF' }).length, 1);
  assert.equal(filterPublishedAdminDocuments(documents, { product: 'ALL', search: 'v2' }).length, 1);
  assert.equal(filterPublishedAdminDocuments(documents, { product: 'PLife Shield', search: 'fact finding' }).length, 0);
});

test('summary counts include all published products and filtering never mutates input', () => {
  const documents = Object.freeze([Object.freeze(doc({ id: '1', category: 'SPAK', approvedAt: '2026-08-01' })),
    Object.freeze(doc({ id: '2', category: 'SPAJ', approvedAt: '2026-09-01' })), Object.freeze(doc({ id: '3', status: 'DRAFT' })),
    Object.freeze(doc({ id: '4', category: 'FACT_FINDING', approvedAt: '2026-09-02' }))]);
  assert.deepEqual(getPublishedAdminDocumentCounts(documents), { SPAJ: 1, SPAK: 1, FACT_FINDING: 1 });
  assert.deepEqual(filterPublishedAdminDocuments(documents, all).map(item => item.id), ['4', '2', '1']);
  assert.equal(documents[0].id, '1');
});
