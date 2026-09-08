import type { User } from '@/types';
import { normalizeMarketingUnit, normalizeMarketingUserId, normalizeMarketingText } from './marketingWorkbook';

export type MarketingReportingGroup = 'Captive Marketing' | 'Corporate & Retail Marketing' | 'Advisor' | 'Directorate Marketing';

/** Use authoritative User Master roles and reporting lines. Never infer ownership from names or a hard-coded user list. */
export const resolveMarketingReportingGroup = (owner: User, users: User[]): MarketingReportingGroup => {
  const visited = new Set<string>();
  let current: User | undefined = owner;
  for (let depth = 0; current && depth < users.length; depth += 1) {
    if (visited.has(current.id)) throw new Error('Hirarki User Master memiliki siklus.');
    visited.add(current.id);
    if (current.role === 'ADVISOR_MARKETING_DIRECTOR' || normalizeMarketingText(current.unit) === 'advisor pemasaran') return 'Advisor';
    if (current.role === 'VP_CAPTIVE_MARKETING' || normalizeMarketingUnit(current.unit) === 'Captive Marketing') return 'Captive Marketing';
    if (current.role === 'VP_CORPORATE_RETAIL_MARKETING' || normalizeMarketingUnit(current.unit) === 'Corporate & Retail Marketing') return 'Corporate & Retail Marketing';
    if (current.role === 'DIRECTOR_MARKETING') return 'Directorate Marketing';
    const superiorId = current.superiorId ? normalizeMarketingUserId(current.superiorId) : '';
    const superior = superiorId ? users.filter(user => normalizeMarketingUserId(user.id) === superiorId) : [];
    if (superior.length > 1) throw new Error('Superior User ID tidak unik.');
    current = superior[0];
  }
  throw new Error(`Unit pelaporan ${owner.id} tidak dapat ditentukan dari User Master.`);
};
