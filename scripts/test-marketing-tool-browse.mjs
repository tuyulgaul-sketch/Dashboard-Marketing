import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  MARKETING_TOOL_BROWSE_CATEGORIES,
  getMarketingToolProductOptions,
  getMarketingToolBrowseView,
  canDownloadMarketingTool,
} from '../src/lib/marketingToolBrowse.ts';
import { filterAdminProductOptions } from '../src/lib/adminProductSearch.ts';

const categories = MARKETING_TOOL_BROWSE_CATEGORIES.map(item => item.value);
const document = (id, productName, category, overrides = {}) => ({
  id, productName, category, ownerArea: 'MARKETING_COMMUNICATION', status: 'PUBLISHED',
  title: `Title ${id}`, fileName: `${id}.pdf`, versionLabel: 'V1',
  approvedAt: '2026-09-01T00:00:00Z', ...overrides,
});
const docs = [
  document('proposal-credit', 'Credit Shield', categories[0]),
  document('slides-credit', 'Credit Shield', categories[1]),
  document('brochure-credit', 'Credit Shield', categories[2]),
  document('proposal-life', 'PLife Shield', categories[0]),
  document('draft-credit', 'Credit Shield', categories[0], { status: 'PENDING_APPROVAL' }),
  document('inactive-credit', 'Credit Shield', categories[0], { status: 'INACTIVE' }),
  document('admin-credit', 'Credit Shield', 'SPAJ', { ownerArea: 'MARKETING_ADMINISTRATION' }),
  document('wrong-category', 'Credit Shield', 'FLYER'),
];
const selected = (product = 'ALL', category = null, search = '') => ({ product, category, search });

test('all-products default has totals but no listing or downloadable file', () => {
  const view = getMarketingToolBrowseView(docs, selected());
  assert.deepEqual(categories.map(category => view.counts[category]), [2, 1, 1]);
  assert.equal(view.productSelected, false);
  assert.deepEqual(view.visibleDocuments, []);
  assert.equal(canDownloadMarketingTool(docs, selected(), docs[0]), false);
  assert.deepEqual(getMarketingToolBrowseView(docs, selected('ALL', categories[0])).visibleDocuments, []);
});

test('selecting a product alone does not expose documents', () => {
  const view = getMarketingToolBrowseView(docs, selected('Credit Shield'));
  assert.deepEqual(categories.map(category => view.counts[category]), [1, 1, 1]);
  assert.deepEqual(view.visibleDocuments, []);
  assert.equal(canDownloadMarketingTool(docs, selected('Credit Shield'), docs[0]), false);
});

test('product and category together expose only matching published tools', () => {
  const view = getMarketingToolBrowseView(docs, selected('Credit Shield', categories[0]));
  assert.deepEqual(view.visibleDocuments.map(item => item.id), ['proposal-credit']);
  assert.equal(canDownloadMarketingTool(docs, selected('Credit Shield', categories[0]), docs[0]), true);
  for (const item of docs.slice(1)) assert.equal(canDownloadMarketingTool(docs, selected('Credit Shield', categories[0]), item), false);
});

test('all three established categories are available and other categories cannot unlock the catalogue', () => {
  assert.equal(categories.length, 3);
  for (const category of categories) assert.equal(getMarketingToolBrowseView(docs, selected('Credit Shield', category)).visibleDocuments.length, 1);
  assert.deepEqual(getMarketingToolBrowseView(docs, selected('Credit Shield', 'SPAJ')).visibleDocuments, []);
});

test('document search is scoped to the selected product and category', () => {
  const selection = selected('Credit Shield', categories[0], 'proposal-credit');
  assert.equal(getMarketingToolBrowseView(docs, selection).visibleDocuments.length, 1);
  assert.equal(canDownloadMarketingTool(docs, selected('Credit Shield', categories[0], 'no match'), docs[0]), false);
  assert.equal(canDownloadMarketingTool(docs, selected('Credit Shield', categories[0], 'no match'), docs[3]), false);
});

test('active and archived-with-published-file products remain selectable', () => {
  const products = [
    { productName: 'Credit Shield', status: 'Active' },
    { productName: 'Empty Product', status: 'Active' },
    { productName: 'PLife Shield', status: 'Inactive' },
    { productName: 'Unpublished Only', status: 'Inactive' },
  ];
  const options = getMarketingToolProductOptions(products, docs);
  assert.deepEqual(options, ['Credit Shield', 'Empty Product', 'PLife Shield']);
  assert.deepEqual(getMarketingToolBrowseView(docs, selected('Empty Product', categories[0])).visibleDocuments, []);
});

test('the existing searchable picker supports partial and multiword product names', () => {
  const options = ['Credit Shield', 'PLife Shield', 'Credit Protection'];
  assert.deepEqual(filterAdminProductOptions(options, 'CREDIT shield'), ['Credit Shield']);
  assert.deepEqual(filterAdminProductOptions(options, 'shield'), ['Credit Shield', 'PLife Shield']);
});

test('publication order is deterministic and does not mutate source data', () => {
  const items = [document('old', 'Credit Shield', categories[0]), document('new', 'Credit Shield', categories[0], { approvedAt: '2026-09-02T00:00:00Z' })];
  const before = JSON.stringify(items);
  assert.deepEqual(getMarketingToolBrowseView(items, selected('Credit Shield', categories[0])).visibleDocuments.map(item => item.id), ['new', 'old']);
  assert.equal(JSON.stringify(items), before);
});

test('the integrated reader preserves product-first and read-only UI guards', () => {
  const page = readFileSync('src/pages/DokumenPendukungPage.tsx', 'utf8');
  const browser = readFileSync('src/components/documents/MarketingToolBrowser.tsx', 'utf8');
  assert.match(page, /<MarketingToolBrowser\b/);
  assert.match(page, /!isMarketingToolPublisher/);
  assert.match(page, /isMarketingToolPublisher\s*&&\s*\(/);
  assert.match(page, /pendingMarcommDocs/);
  assert.match(page, /handleUploadServiceDocument/);
  assert.match(page, /isAndi/);
  assert.match(page, /isKarina/);
  assert.match(browser, /<AdminProductPicker\b/);
  assert.match(browser, /!view\.productSelected/);
  assert.match(browser, /canDownloadMarketingTool\(documents, selection, document\)/);
  assert.doesNotMatch(browser, /saveMarketingSupportFile|deleteMarketingSupportFile|Review & Approve|Upload Marketing Tool/);
});
