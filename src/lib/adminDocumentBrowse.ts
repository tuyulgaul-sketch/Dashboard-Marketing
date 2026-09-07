import { isAdminDocumentCategory, type AdminDocumentCategory } from './adminDocumentCategories.ts';
import {
  filterPublishedAdminDocuments,
  getPublishedAdminDocumentCounts,
  type AdminDocumentListItem,
} from './adminDocumentReaderView.ts';

export interface AdminDocumentBrowseSelection {
  product: string;
  category: AdminDocumentCategory | null;
  search: string;
}

const normalize = (value: unknown): string =>
  String(value ?? '').trim().toLocaleLowerCase('id-ID');

export const hasSelectedAdminDocumentProduct = (product: string): boolean =>
  Boolean(normalize(product)) && normalize(product) !== 'all';

/** A UI safety gate, not a replacement for backend authorization. */
export function getAdminDocumentBrowseView<T extends AdminDocumentListItem>(
  documents: readonly T[],
  selection: AdminDocumentBrowseSelection,
) {
  const productSelected = hasSelectedAdminDocumentProduct(selection.product);
  const category = productSelected && isAdminDocumentCategory(selection.category)
    ? selection.category : null;
  const product = productSelected ? selection.product : 'ALL';
  const scopedDocuments = filterPublishedAdminDocuments(documents, { product, search: '' });
  const counts = getPublishedAdminDocumentCounts(scopedDocuments);
  const visibleDocuments = category === null ? [] : filterPublishedAdminDocuments(scopedDocuments, {
    product,
    search: selection.search,
  }).filter(document => document.category === category);
  return { productSelected, category, counts, visibleDocuments };
}

/** Download controls must use the same current selection as the visible list. */
export function canDownloadAdminDocument<T extends AdminDocumentListItem>(
  documents: readonly T[],
  selection: AdminDocumentBrowseSelection,
  document: T,
): boolean {
  const view = getAdminDocumentBrowseView(documents, selection);
  return view.productSelected && view.category !== null &&
    view.visibleDocuments.some(item => item === document);
}
