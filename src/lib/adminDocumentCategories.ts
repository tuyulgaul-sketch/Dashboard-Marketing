import type { ServiceDocumentCategory } from '@/services/store';

/** The repository's three Marketing Administration document families. */
export const ADMIN_DOCUMENT_CATEGORIES = [
  { value: 'SPAJ', label: 'SPAJ' },
  { value: 'SPAK', label: 'SPAK' },
  { value: 'FACT_FINDING', label: 'Fact Finding' },
] as const satisfies ReadonlyArray<{ value: ServiceDocumentCategory; label: string }>;

export type AdminDocumentCategory = (typeof ADMIN_DOCUMENT_CATEGORIES)[number]['value'];

export const isAdminDocumentCategory = (value: unknown): value is AdminDocumentCategory =>
  ADMIN_DOCUMENT_CATEGORIES.some(category => category.value === value);

export const getAdminDocumentCategoryLabel = (value: string): string =>
  ADMIN_DOCUMENT_CATEGORIES.find(category => category.value === value)?.label || value;
