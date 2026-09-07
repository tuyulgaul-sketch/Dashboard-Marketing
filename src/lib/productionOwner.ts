import type { User } from '@/types';

export type ProductionMarketingFunction =
  | 'Captive Marketing'
  | 'Corporate & Retail Marketing';

export const PRODUCTION_OWNER_HEADER = 'User ID Pemilik Realisasi';

export const normalizeProductionUserId = (value: unknown): string =>
  String(value ?? '').replace(/\u00a0/g, ' ').trim().toUpperCase();

const normalizeName = (value: unknown): string =>
  String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id');

export const isProductionOwnerEligible = (user: User): boolean =>
  user.status === 'Active' &&
  (user.unit === 'Captive Marketing' || user.unit === 'Corporate & Retail Marketing') &&
  [
    'DIRECTOR_MARKETING',
    'ADVISOR_MARKETING_DIRECTOR',
    'VP_CAPTIVE_MARKETING',
    'VP_CORPORATE_RETAIL_MARKETING',
    'DEPARTMENT_HEAD_MARKETING',
    'SUPERVISOR_MARKETING',
    'STAFF_MARKETING',
  ].includes(user.role);

export interface ProductionOwnerResolution {
  user?: User;
  errors: string[];
}

/** Never infer financial ownership from a person's name or a browser identity. */
export const resolveProductionOwner = (
  users: readonly User[],
  rawUserId: unknown,
  rawPicName: unknown,
  marketingFunction: ProductionMarketingFunction | null,
): ProductionOwnerResolution => {
  const id = normalizeProductionUserId(rawUserId);
  const errors: string[] = [];
  if (!id) {
    return { errors: ['User ID Pemilik Realisasi wajib diisi. Nama PIC tidak dapat digunakan sebagai pengganti ID.'] };
  }
  const matches = users.filter(user => normalizeProductionUserId(user.id) === id);
  if (matches.length !== 1) {
    return { errors: [matches.length ? `User ID ${id} tidak unik di User Master.` : `User ID ${id} tidak ditemukan di User Master.`] };
  }
  const user = matches[0];
  if (user.status !== 'Active') errors.push(`User ID ${id} tidak aktif.`);
  if (!isProductionOwnerEligible(user)) errors.push(`User ID ${id} bukan pemilik realisasi Marketing yang berhak.`);
  if (marketingFunction && user.unit !== marketingFunction) {
    errors.push(`Fungsi Marketing tidak sesuai User ID ${id}. Seharusnya ${user.unit}.`);
  }
  const picName = String(rawPicName ?? '').trim();
  if (picName && picName.toLowerCase() !== '#n/a' && normalizeName(picName) !== normalizeName(user.name)) {
    errors.push(`PIC Marketing tidak sesuai User ID ${id}. Seharusnya ${user.name}.`);
  }
  return errors.length ? { errors } : { user, errors: [] };
};

/** Recheck immediately before publication, including after a master-data change. */
export const validateProductionOwnersForPublish = (
  records: readonly { picUserId?: string; picName: string; marketingFunction: ProductionMarketingFunction }[],
  users: readonly User[],
): string[] => {
  const errors: string[] = [];
  records.forEach((record, index) => {
    const result = resolveProductionOwner(users, record.picUserId, record.picName, record.marketingFunction);
    result.errors.forEach(message => errors.push(`Baris ${index + 1}: ${message}`));
  });
  return errors;
};
