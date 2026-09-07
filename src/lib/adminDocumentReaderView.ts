import {
  ADMIN_DOCUMENT_CATEGORIES,
  getAdminDocumentCategoryLabel,
  isAdminDocumentCategory,
  type AdminDocumentCategory,
} from './adminDocumentCategories.ts';

export interface AdminDocumentListItem {
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

export interface AdminDocumentProduct {
  productName: string;
  status: string;
}

export interface AdminDocumentFilters {
  product: string;
  search: string;
}

const normalize = (value: unknown): string =>
  String(value ?? '').trim().toLocaleLowerCase('id-ID');

export const isPublishedAdminDocument = (document: AdminDocumentListItem): boolean =>
  document.ownerArea === 'MARKETING_ADMINISTRATION' &&
  document.status === 'PUBLISHED' &&
  isAdminDocumentCategory(document.category);

/** A second client-side guard; the catalogue RPC remains the authority. */
export function filterPublishedAdminDocuments<T extends AdminDocumentListItem>(
  documents: readonly T[],
  { product, search }: AdminDocumentFilters,
): T[] {
  const selectedProduct = product === 'ALL' ? '' : normalize(product);
  const query = normalize(search);
  return documents
    .filter(isPublishedAdminDocument)
    .filter(document => !selectedProduct || normalize(document.productName) === selectedProduct)
    .filter(document => !query || [
      document.title,
      document.productName,
      document.fileName,
      getAdminDocumentCategoryLabel(document.category || ''),
      document.category,
      document.versionLabel,
    ].some(value => normalize(value).includes(query)))
    .sort((a, b) =>
      (b.approvedAt || b.uploadedAt || '').localeCompare(a.approvedAt || a.uploadedAt || '') ||
      normalize(a.title).localeCompare(normalize(b.title), 'id')
    );
}

/** Matches the legacy active-product dropdown, retaining archived products with published files. */
export function getAdminDocumentProductOptions(
  products: readonly AdminDocumentProduct[],
  documents: readonly AdminDocumentListItem[],
): string[] {
  const names = new Map<string, string>();
  for (const product of products) {
    const name = product.productName?.trim();
    if (product.status === 'Active' && name) names.set(normalize(name), name);
  }
  for (const document of documents) {
    const name = document.productName?.trim();
    if (isPublishedAdminDocument(document) && name && !names.has(normalize(name))) {
      names.set(normalize(name), name);
    }
  }
  return [...names.values()].sort((a, b) => a.localeCompare(b, 'id'));
}

export function getPublishedAdminDocumentCounts(documents: readonly AdminDocumentListItem[]): Record<AdminDocumentCategory, number> {
  const counts = Object.fromEntries(ADMIN_DOCUMENT_CATEGORIES.map(category => [category.value, 0])) as Record<AdminDocumentCategory, number>;
  for (const document of documents) {
    if (isPublishedAdminDocument(document)) counts[document.category as AdminDocumentCategory] += 1;
  }
  return counts;
}
