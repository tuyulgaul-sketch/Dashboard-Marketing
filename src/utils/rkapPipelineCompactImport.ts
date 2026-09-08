import type { Pipeline, User, RkapPremiumSchedule } from '@/types';
import type { CompactMatrixPlan } from './rkapPipelineCompact';

export type CompactScheduledPipeline = Pipeline & {
  pipelineYear: number;
  pipelineMonth: number;
  rkapPremiumSchedule: RkapPremiumSchedule;
  rkapReportingGroup: CompactMatrixPlan['reportingGroup'];
  rkapOperationalDetailsPending: boolean;
  rkapProcurementStatus: CompactMatrixPlan['procurementStatus'];
};

/** Preserve unknown operational values; the compatibility boolean is not a confirmed procurement classification while status is Unknown. */
export const makeCompactPipelineRecord = (plan: CompactMatrixPlan, id: string, actor: User, batchId: string, fileName: string, now: string): CompactScheduledPipeline => ({
  id, source: 'RKAP_BULK', pipelineYear: plan.year, pipelineMonth: plan.targetClosingDate ? Number(plan.targetClosingDate.slice(5, 7)) : 0,
  businessType: plan.businessType, customerName: plan.customerName, insuranceType: plan.insuranceType,
  customerCategory: plan.customerCategory, productId: plan.productId, productName: plan.productName,
  estimatedPremium: plan.totalIdr, currentCommercialValue: plan.totalIdr,
  originalTargetClosingDate: plan.targetClosingDate, currentTargetClosingDate: plan.targetClosingDate,
  isTender: plan.isTender, channel: plan.channel, picUserId: plan.owner.id, picName: plan.owner.name,
  unit: plan.owner.unit, department: plan.owner.department,
  rkapReportingGroup: plan.reportingGroup, rkapOperationalDetailsPending: plan.operationalDetailsPending,
  rkapProcurementStatus: plan.procurementStatus,
  status: 'Menunggu Upload Dokumen Marketing', currentHandler: 'MARKETING', lastProgressAt: now, dayLapse: 0,
  existingPolicyNumber: plan.existingPolicyNumber, originalPolicyYear: plan.originalPolicyYear,
  coverageStart: plan.coverageStart, coverageEnd: plan.coverageEnd, renewalType: plan.renewalType,
  documents: [], quotations: [], createdAt: now, createdBy: actor.name,
  rkapPremiumSchedule: {
    version: 1, year: plan.year, sourceRow: plan.rowReference, sourceFile: fileName, sourceBatchId: batchId,
    currency: plan.currency, exchangeRate: plan.exchangeRate, exchangeRateSource: plan.exchangeRateSource,
    exchangeRateDate: plan.exchangeRateDate, paymentMode: plan.paymentMode, monthlyOriginal: plan.monthlyOriginal,
    monthlyIdr: plan.monthlyIdr, totalOriginal: plan.totalOriginal, totalIdr: plan.totalIdr, notes: plan.notes,
  },
});
