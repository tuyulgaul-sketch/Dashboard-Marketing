import type { MarketingToolCategory } from '@/services/store';

export const MARKETING_TOOL_BROWSE_CATEGORIES = [
  { value: 'PROPOSAL_PENAWARAN_STANDAR', label: 'Proposal Produk Standar' },
  { value: 'MATERI_PRESENTASI', label: 'Materi Presentasi Produk Standar' },
  { value: 'BROSUR', label: 'Brosur Produk Standar' },
] as const satisfies readonly { value: MarketingToolCategory; label: string }[];

export type MarketingToolBrowseCategory = typeof MARKETING_TOOL_BROWSE_CATEGORIES[number]['value'];

export interface MarketingToolBrowseItem {
  id: string;
  ownerArea?: string;
  status?: string;
  category?: string;
  productName?: string;
  title?: string;
  fileName?: string;
  versionLabel?: string;
  approvedAt?: string;
  uploadedAt?: string;
}

export interface MarketingToolBrowseSelection {
  product: string;
  category: MarketingToolBrowseCategory | null;
  search: string;
}

const normalize = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('id-ID');
const categorySet = new Set<string>(MARKETING_TOOL_BROWSE_CATEGORIES.map(item => item.value));

export const isPublishedMarketingTool = (document: MarketingToolBrowseItem): boolean =>
  document.ownerArea === 'MARKETING_COMMUNICATION' &&
  document.status === 'PUBLISHED' &&
  categorySet.has(document.category ?? '');

/** Keep active Product Master names and archived products that still have published tools. */
export function getMarketingToolProductOptions(
  products: readonly { productName: string; status: string }[],
  documents: readonly MarketingToolBrowseItem[],
): string[] {
  const names = new Map<string, string>();
  for (const product of products) {
    const name = product.productName?.trim();
    if (product.status === 'Active' && name) names.set(normalize(name), name);
  }
  for (const document of documents) {
    const name = document.productName?.trim();
    if (isPublishedMarketingTool(document) && name && !names.has(normalize(name))) {
      names.set(normalize(name), name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'id'));
}

/** Presentation guard only; existing authenticated storage authorization remains authoritative. */
export function getMarketingToolBrowseView<T extends MarketingToolBrowseItem>(
  documents: readonly T[],
  selection: MarketingToolBrowseSelection,
) {
  const productSelected = Boolean(normalize(selection.product)) && normalize(selection.product) !== 'all';
  const category = productSelected && selection.category && categorySet.has(selection.category)
    ? selection.category : null;
  const scopedDocuments = documents.filter(isPublishedMarketingTool).filter(document =>
    !productSelected || normalize(document.productName) === normalize(selection.product));
  const counts = Object.fromEntries(MARKETING_TOOL_BROWSE_CATEGORIES.map(item => [item.value, 0])) as Record<MarketingToolBrowseCategory, number>;
  for (const document of scopedDocuments) counts[document.category as MarketingToolBrowseCategory] += 1;
  const query = normalize(selection.search);
  const visibleDocuments = category === null ? [] : scopedDocuments
    .filter(document => document.category === category)
    .filter(document => !query || [document.title, document.fileName, document.versionLabel, document.productName]
      .some(value => normalize(value).includes(query)))
    .sort((a, b) =>
      (b.approvedAt || b.uploadedAt || '').localeCompare(a.approvedAt || a.uploadedAt || '') ||
      normalize(a.title).localeCompare(normalize(b.title), 'id') ||
      a.id.localeCompare(b.id));
  return { productSelected, category, counts, visibleDocuments };
}

export function canDownloadMarketingTool<T extends MarketingToolBrowseItem>(
  documents: readonly T[], selection: MarketingToolBrowseSelection, document: T,
): boolean {
  const view = getMarketingToolBrowseView(documents, selection);
  return view.productSelected && view.category !== null &&
    view.visibleDocuments.some(item => item === document);
}
