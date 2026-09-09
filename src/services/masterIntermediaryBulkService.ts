import { supabase } from '@/lib/supabase';
import type { AgentBulkCandidate, BrokerBulkCandidate } from '@/utils/masterIntermediaryBulk';

export type MasterBulkImportResult = {
  inserted: number;
  skipped: number;
  total: number;
};

const normalizeResult = (value: unknown): MasterBulkImportResult => {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const inserted = Number(row.inserted || 0);
  const skipped = Number(row.skipped || 0);
  const total = Number(row.total ?? inserted + skipped);
  if (![inserted, skipped, total].every(Number.isFinite)) {
    throw new Error('Respons bulk import dari server tidak valid.');
  }
  return { inserted, skipped, total };
};

export const bulkAddCentralAgents = async (
  rows: AgentBulkCandidate[],
  sourceName: string,
  sourcePeriod: string
): Promise<MasterBulkImportResult> => {
  const payload = rows
    .filter(row => row.disposition === 'ADD' || row.disposition === 'SKIP')
    .map(row => ({
      agentCode: row.agentCode,
      agentName: row.agentName,
      insuranceCompany: row.insuranceCompany,
      licenseNumber: row.licenseNumber,
      licenseDate: row.licenseDate,
      licenseExpiryDate: row.licenseExpiryDate,
      email: row.email,
      status: row.status,
    }));

  const { data, error } = await supabase.rpc('bulk_add_master_agents', {
    p_rows: payload,
    p_source_name: sourceName,
    p_source_period: sourcePeriod,
  });
  if (error) throw error;
  return normalizeResult(data);
};

export const bulkAddCentralBrokers = async (
  rows: BrokerBulkCandidate[],
  sourceName: string,
  sourcePeriod: string
): Promise<MasterBulkImportResult> => {
  const payload = rows
    .filter(row => row.disposition === 'ADD' || row.disposition === 'SKIP')
    .map(row => ({
      companyName: row.companyName,
      licenseNumber: row.licenseNumber,
      licenseDate: row.licenseDate,
      address: row.address,
      city: row.city,
      postalCode: row.postalCode,
      phone1: row.phone1,
      phone2: row.phone2,
      fax: row.fax,
      email: row.email,
      website: row.website,
    }));

  const { data, error } = await supabase.rpc('bulk_add_master_brokers', {
    p_rows: payload,
    p_source_name: sourceName,
    p_source_period: sourcePeriod,
  });
  if (error) throw error;
  return normalizeResult(data);
};
