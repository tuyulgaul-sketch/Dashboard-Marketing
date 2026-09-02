export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'DIRECTOR_MARKETING'
  | 'ADVISOR_MARKETING_DIRECTOR'
  | 'VP_CAPTIVE_MARKETING'
  | 'VP_CORPORATE_RETAIL_MARKETING'
  | 'DEPARTMENT_HEAD_MARKETING'
  | 'SUPERVISOR_MARKETING'
  | 'STAFF_MARKETING'
  | 'TEAM_LEADER_MARKETING_SUPPORT'
  | 'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION'
  | 'SUPERVISOR_MARKETING_ADMINISTRATION'
  | 'STAFF_MARKETING_ADMINISTRATION'
  | 'DEPARTMENT_HEAD_MARKETING_COMMUNICATION'
  | 'STAFF_MARKETING_COMMUNICATION';

export type UnitType =
  | 'Direktorat Pemasaran'
  | 'Advisor Pemasaran'
  | 'Captive Marketing'
  | 'Corporate & Retail Marketing'
  | 'Marketing Support'
  | 'Administrasi Sistem';

export type DepartmentType =
  | 'None'
  | 'Captive I'
  | 'Captive II'
  | 'Captive III'
  | 'CRM I'
  | 'CRM II'
  | 'CRM III'
  | 'Marketing Administration'
  | 'Marketing Communication';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  unit: UnitType;
  department: DepartmentType;
  superiorId: string | null;
  status: 'Active' | 'Inactive';
}

export interface UserOrganizationHistory {
  id: string;
  userId: string;
  userName: string;
  previousRole: UserRole;
  previousUnit: UnitType;
  previousDepartment: DepartmentType;
  previousSuperiorId: string | null;
  newRole: UserRole;
  newUnit: UnitType;
  newDepartment: DepartmentType;
  newSuperiorId: string | null;
  effectiveDate: string;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface ProductMaster {
  id: string;
  productCode: string;
  productName: string;
  insuranceType: 'Asuransi Jiwa' | 'Asuransi Kesehatan';
  customerCategory: 'Individu' | 'Kumpulan';
  status: 'Active' | 'Inactive';
  effectiveDate: string;
  notes?: string;
}

export type BusinessType = 'New Business' | 'Renewal Business';
export type CustomerCategory = 'Individu' | 'Kumpulan';
export type InsuranceType = 'Asuransi Jiwa' | 'Asuransi Kesehatan';
export type DistributionChannel = 'Direct Selling' | 'Agent' | 'Broker' | 'BUSB';

export interface TargetEntry {
  id: string;
  year: number;
  userId: string;
  userName: string;
  position: string;
  unit: UnitType;
  department: DepartmentType;
  
  annualTargetTotal: number;
  annualTargetNewBusiness: number;
  annualTargetRenewal: number;
  
  personalTargetTotal: number;
  personalTargetNewBusiness: number;
  personalTargetRenewal: number;

  monthlyNewBusiness: number[]; // 12 elements
  monthlyRenewal: number[];    // 12 elements
  
  notes?: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface TargetUploadBatch {
  id: string;
  year: number;
  filename: string;
  uploadedBy: string;
  uploadedAt: string;
  recordCount: number;
  status: 'Valid' | 'Published' | 'Error';
  notes?: string;
}

export interface BookingVerificationHistory {
  id: string;
  action:
    | 'FIRST_ACTION_VALID'
    | 'FIRST_ACTION_REKOMENDASI_TOLAK'
    | 'FINAL_APPROVED'
    | 'FINAL_REJECTED';
  recommendation?: 'VALID' | 'REKOMENDASI TOLAK';
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
  notes?: string;
}

export interface BookingCase {
  id: string; // BC-YYYY-00001
  customerName: string;
  insuranceType: InsuranceType;
  customerCategory: CustomerCategory;
  productId: string;
  productName: string;

  // Business setup collected during Booking wizard.
  // Optional for backward compatibility with older UAT records.
  businessType?: BusinessType;

  estimatedPremium: number;
  targetClosingDate: string;
  isTender: boolean;
  channel: DistributionChannel;

  // Existing / Renewal References
  existingPolicyNumber?: string;
  originalPolicyYear?: number;
  coverageStart?: string;
  coverageEnd?: string;
  renewalType?:
    | 'Regular Renewal'
    | 'Salary / Exposure Adjustment'
    | 'Benefit Adjustment'
    | 'Other Renewal';
  picUserId: string;
  picName: string;
  unit: UnitType;
  department: DepartmentType;
  notes?: string;
  relatedActivityId?: string;
  
  // Verification State
  // 'Claimed' dipertahankan hanya untuk backward compatibility data UAT lama.
  // Workflow baru memakai First Action Wins tanpa Claim Lock.
  status: 'Submitted' | 'Claimed' | 'Approved' | 'Rejected';

  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: string;

  verificationRecommendation?: 'VALID' | 'REKOMENDASI TOLAK';
  verifierNotes?: string;

  verificationFirstActionBy?: string;
  verificationFirstActionByName?: string;
  verificationFirstActionAt?: string;
  verificationHistory?: BookingVerificationHistory[];
  
  finalDecisionBy?: string;
  finalDecisionByName?: string;
  finalDecisionAt?: string;
  finalDecisionReason?: string;
  pipelineId?: string;
  
  createdAt: string;
  createdBy: string;
}

export type PipelineCanonicalStatus =
  | 'Menunggu Upload Dokumen Marketing'
  | 'Dokumen Diajukan oleh Marketing'
  | 'On Progress Marketing Support'
  | 'Perlu Perbaikan Dokumen Marketing'
  | 'On Process Teknik'
  | 'Penawaran Telah Terbit'
  | 'Menunggu Feedback / Konfirmasi Klien'
  | 'Menunggu Upload Dokumen Closing'
  | 'Dokumen Closing Diajukan'
  | 'Dalam Verifikasi Marketing Support'
  | 'Menunggu Final Approval Team Leader Marketing Support'
  | 'WIN'
  | 'LOSE';

export type CurrentHandlerBucket = 'MARKETING' | 'MARKETING SUPPORT' | 'TEKNIK' | 'CLIENT';

export type LoseReason =
  | 'Premi terlalu mahal / kalah price'
  | 'Kompetitor lebih unggul'
  | 'Keterbatasan coverage / benefit'
  | 'Anggaran klien dibatalkan'
  | 'Gagal kualifikasi tender';

export type PipelineOutcomeType = 'WIN' | 'LOSE';

export type PipelineOutcomeWorkflowStatus =
  | 'PENDING_MS_VERIFICATION'
  | 'PENDING_TLMS_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';

export interface PipelineDocument {
  id: string;
  category: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  fileUrl?: string;
  notes?: string;
}

export interface Quotation {
  id: string;
  version: number;
  quotationDate: string;
  amount: number;
  fileName: string;
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface PipelineTargetClosingHistory {
  id: string;
  oldDate: string;
  newDate: string;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface PipelineOwnershipHistory {
  id: string;
  oldPicUserId: string;
  oldPicName: string;
  newPicUserId: string;
  newPicName: string;
  effectiveDate: string;
  reason: string;
  changedBy: string;
  timestamp: string;
}

export interface Pipeline {
  id: string; // PL-YYYY-00001
  source: 'RKAP_BULK' | 'BOOKING_CASE';
  businessType: BusinessType;
  customerName: string;
  insuranceType: InsuranceType;
  customerCategory: CustomerCategory;
  productId: string;
  productName: string;
  estimatedPremium: number;
  currentCommercialValue: number; // Estimated premium or latest quotation amount
  
  originalTargetClosingDate: string;
  currentTargetClosingDate: string;
  actualClosingDate?: string;
  
  isTender: boolean;
  channel: DistributionChannel;
  picUserId: string;
  picName: string;
  unit: UnitType;
  department: DepartmentType;
  
  status: PipelineCanonicalStatus;
  currentHandler: CurrentHandlerBucket;
  lastProgressAt: string;
  dayLapse: number; // auto-calculated
  
  // Existing / Renewal References
  existingPolicyNumber?: string;
  originalPolicyYear?: number;
  coverageStart?: string;
  coverageEnd?: string;
  renewalType?: 'Regular Renewal' | 'Salary / Exposure Adjustment' | 'Benefit Adjustment' | 'Other Renewal';

  documents: PipelineDocument[];
  quotations: Quotation[];
  closingDocuments?: PipelineDocument[];
  
  // WIN metadata
  winDate?: string;
  winningQuotationAmount?: number;
  winApprovedBy?: string;
  winApprovedAt?: string;
  
  // LOSE metadata
  loseDate?: string;
  loseReason?: LoseReason;
  loseEvaluationNotes?: string;
  loseLastStage?: PipelineCanonicalStatus;
  loseLastHandler?: CurrentHandlerBucket;

  // Outcome Request Governance
  // Marketing mengajukan WIN / LOSE, Marketing Support memverifikasi,
  // Department Head Marketing Administration memberikan final approval.
  outcomeRequest?: PipelineOutcomeType;
  outcomeWorkflowStatus?: PipelineOutcomeWorkflowStatus;
  outcomePreviousStatus?: PipelineCanonicalStatus;

  outcomeSubmittedBy?: string;
  outcomeSubmittedByName?: string;
  outcomeSubmittedAt?: string;
  outcomeSubmissionNotes?: string;

  outcomeWinningAmount?: number;
  outcomeLoseReason?: LoseReason;
  outcomeLoseNotes?: string;

  outcomeVerifiedBy?: string;
  outcomeVerifiedByName?: string;
  outcomeVerifiedAt?: string;
  outcomeVerificationNotes?: string;

  outcomeFinalDecision?: 'APPROVED' | 'REJECTED';
  outcomeFinalDecisionBy?: string;
  outcomeFinalDecisionByName?: string;
  outcomeFinalDecisionAt?: string;
  outcomeFinalDecisionNotes?: string;

  // Appeal metadata
  hasActiveAppeal?: boolean;
  appealReason?: string;
  appealSubmittedBy?: string;
  appealSubmittedAt?: string;

  createdAt: string;
  createdBy: string;
}

export interface WinSubmission {
  id: string;
  pipelineId: string;
  customerName: string;
  picUserId: string;
  winningQuotationAmount: number;
  winDate: string;
  actualClosingDate: string;
  documents: PipelineDocument[];
  
  status: 'Pending Verification' | 'Approved' | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  verificationNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface Appeal {
  id: string;
  pipelineId: string;
  type: 'WIN' | 'LOSE';
  reason: string;
  attachmentName?: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNotes?: string;
}

export interface ProductionTransaction {
  id: string; // PTX-YYYY-00001
  pipelineId: string;
  customerName: string;
  productName: string;
  picUserId: string;
  picName: string;
  unit: UnitType;
  department: DepartmentType;
  businessType: BusinessType;
  
  // Core System References (Manually recorded by MS)
  corePolicyNumber: string; // From Core System or "Belum Terbit / Belum Diinput"
  coreInvoiceNumber: string; // From Core System
  
  invoiceDate: string;
  productionMonth: number; // 1 - 12
  productionYear: number;
  invoiceAmount: number;
  
  transactionType:
    | 'Initial Premium'
    | 'Additional Participant'
    | 'Salary / Exposure Adjustment'
    | 'Benefit Adjustment'
    | 'Regular Renewal'
    | 'Correction';
    
  isCorrection?: boolean;
  relatedTransactionId?: string;
  correctionReason?: string;

  makerUserId: string;
  makerUserName: string;
  makerTimestamp: string;
  
  checkerUserId?: string;
  checkerUserName?: string;
  checkerTimestamp?: string;
  checkerNotes?: string;
  
  status: 'Pending Checker' | 'POSTED' | 'Rejected';
  isDummy?: boolean;
}

export interface ParticipantAddition {
  id: string;
  pipelineId: string;
  corePolicyNumber: string;
  customerName: string;
  participantFile: string;
  uploadedBy: string;
  uploadedAt: string;
  status: 'Pending Verification' | 'Valid' | 'Needs Revision';
  verifierNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface HistoricalProduction {
  id: string;
  batchId: string;
  year: number;
  month: number;
  invoiceDate: string;
  invoiceNumber?: string;
  policyNumber?: string;
  customerName: string;
  productName: string;
  insuranceType: InsuranceType;
  customerCategory: CustomerCategory;
  businessType: BusinessType;
  transactionType: string;
  premiumAmount: number;
  picName?: string;
  unit?: string;
  department?: string;
  channel?: string;
  sourceData: string;
  notes?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export type ActivityType = 'Meeting' | 'Presentation' | 'Site Visit' | 'Courtesy Call' | 'Tender Clarification' | 'Negotiation' | 'Other';
export type InteractionMethod = 'In-Person / Offline' | 'Online Meeting' | 'Phone Call' | 'Email / Letter';
export type ActivityStatus = 'Planned' | 'On Progress' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'Overdue';

export interface Activity {
  id: string; // ACT-YYYY-00001
  activityDate: string;
  startTime: string;
  endTime: string;
  activityType: ActivityType;
  interactionMethod: InteractionMethod;
  companyName: string;
  personMet: string;
  positionMet: string;
  location: string;
  purpose: string;
  discussedProduct: string;
  relatedPipelineId?: string;
  relatedBookingId?: string;
  agenda: string;
  notes?: string;
  result?: string;
  followUp?: string;
  potentialPremium?: number;
  attachments?: string[];
  hasExpense: boolean;
  expenseAmount?: number;
  
  status: ActivityStatus;
  ownerUserId: string;
  ownerName: string;
  unit: UnitType;
  department: DepartmentType;
  taggedUserIds: string[]; // Shared visibility
  
  createdAt: string;
}

export interface ActivityComment {
  id: string;
  activityId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  commentText: string;
  attachmentName?: string;
  replyToId?: string;
  timestamp: string;
}

export type ReimbursementType =
  | 'Konsumsi'
  | 'Transport / Taxi / Online Transport'
  | 'Toll'
  | 'Parking'
  | 'Fuel'
  | 'Accommodation'
  | 'Ticket'
  | 'Event Registration'
  | 'Representation / Business Meal'
  | 'Supporting Supplies'
  | 'Other';

export interface Reimbursement {
  id: string; // RMB-YYYY-00001

  // One reimbursement is linked to one Marketing Activity.
  activityId: string;
  activityDate: string;
  expenseDate?: string;
  companyName: string;

  userId: string;
  userName: string;
  unit: UnitType;

  reimbursementType: ReimbursementType;
  amount: number;
  description: string;

  // Actual receipt binary is stored in the existing browser file repository.
  receiptFileId?: string;
  receiptFileName: string;
  receiptFileSize?: number;

  // Workflow:
  // Submitter -> Direct Superior -> Marketing Administration
  // -> DH Marketing Administration (Endah) -> Approved for Payment.
  //
  // Legacy statuses remain so old UAT records still render.
  status:
    | 'Submitted'
    | 'Approved Superior'
    | 'Verified Marketing Administration'
    | 'Approved for Payment'
    | 'Verified MS'
    | 'Approved TL MS'
    | 'Paid Finance'
    | 'Rejected';

  directSuperiorId?: string;
  directSuperiorName?: string;

  superiorApprovedBy?: string;
  superiorApprovedByName?: string;
  superiorApprovedAt?: string;
  superiorDecisionNotes?: string;

  marketingAdminVerifiedBy?: string;
  marketingAdminVerifiedByName?: string;
  marketingAdminVerifiedAt?: string;
  marketingAdminVerificationNotes?: string;

  finalApprovedBy?: string;
  finalApprovedByName?: string;
  finalApprovedAt?: string;
  finalApprovalNotes?: string;

  // Compatibility fields for old UAT records.
  msVerifiedBy?: string;
  msVerifiedAt?: string;
  tlApprovedBy?: string;
  tlApprovedAt?: string;
  financePaidBy?: string;
  financePaidAt?: string;

  rejectionStage?:
    | 'DIRECT_SUPERIOR'
    | 'MARKETING_ADMINISTRATION'
    | 'DH_MARKETING_ADMINISTRATION';
  rejectionReason?: string;

  createdAt: string;
  updatedAt?: string;
}


// ============================================================
// DIGITAL DOCUMENT HANDOVER / TANDA TERIMA DOKUMEN
// ============================================================

export type DocumentHandoverStatus =
  | 'MENUNGGU PENERIMAAN'
  | 'DITERIMA'
  | 'SELISIH DOKUMEN'
  | 'MENUNGGU KONFIRMASI PENGEMBALIAN'
  | 'DIKEMBALIKAN'
  | 'SELISIH PENGEMBALIAN'
  | 'DITOLAK'
  | 'DIBATALKAN';

export type DocumentHandoverType =
  | 'PENYERAHAN DOKUMEN'
  | 'PENGEMBALIAN DOKUMEN';

export type DocumentHandoverRelatedModule =
  | 'NONE'
  | 'PIPELINE'
  | 'BOOKING'
  | 'REIMBURSEMENT'
  | 'LAINNYA';

export type DocumentPhysicalForm =
  | 'Asli'
  | 'Copy'
  | 'Legalized Copy';

export interface DocumentHandoverItem {
  id: string;
  documentType:
    | 'Tagihan / Invoice'
    | 'Kwitansi'
    | 'Polis'
    | 'SPAJ'
    | 'SPAK'
    | 'Surat'
    | 'Proposal'
    | 'Dokumen Closing'
    | 'Lampiran'
    | 'Lainnya';
  description: string;
  physicalForm: DocumentPhysicalForm;
  quantity: number;
  notes?: string;
  receivedQuantity?: number;
  receiverNotes?: string;
}

export interface DocumentHandoverReturnItem {
  id: string;
  sourceItemId?: string;
  description: string;
  quantity: number;
  notes?: string;
  receivedQuantity?: number;
  receiverNotes?: string;
}

export interface DocumentHandoverDiscrepancySnapshotItem {
  itemId: string;
  expectedQuantity: number;
  receivedQuantity: number;
  receiverNotes?: string;
}

export interface DocumentHandover {
  id: string; // TRM-YYYY-MM-00001
  handoverType: DocumentHandoverType;
  handoverDate: string;

  senderUserId: string;
  senderName: string;
  senderRole: UserRole;
  senderUnit: UnitType;
  senderDepartment: DepartmentType;

  receiverUserId: string;
  receiverName: string;
  receiverRole: UserRole;
  receiverUnit: UnitType;
  receiverDepartment: DepartmentType;

  relatedModule: DocumentHandoverRelatedModule;
  relatedTransactionId?: string;
  relatedDescription?: string;
  relatedReceiptId?: string;

  items: DocumentHandoverItem[];
  status: DocumentHandoverStatus;

  submittedAt: string;
  submittedByUserId: string;
  submittedByName: string;

  receiverDecisionAt?: string;
  receiverDecisionByUserId?: string;
  receiverDecisionByName?: string;
  receiverDecisionNotes?: string;

  // Evidence wajib dari pihak yang menyerahkan dokumen.
  submissionPhotoFileId?: string;
  submissionPhotoFileName?: string;
  submissionPhotoFileSize?: number;

  // Evidence opsional dari pihak yang menerima penyerahan awal.
  receiptPhotoFileId?: string;
  receiptPhotoFileName?: string;
  receiptPhotoFileSize?: number;

  // Snapshot selisih awal dipertahankan walaupun selisih sudah diselesaikan.
  initialDiscrepancyItems?: DocumentHandoverDiscrepancySnapshotItem[];
  initialDiscrepancyResolvedAt?: string;
  initialDiscrepancyResolvedByUserId?: string;
  initialDiscrepancyResolvedByName?: string;
  initialDiscrepancyResolutionNotes?: string;
  initialDiscrepancyResolutionPhotoFileId?: string;
  initialDiscrepancyResolutionPhotoFileName?: string;
  initialDiscrepancyResolutionPhotoFileSize?: number;

  // Pengembalian tetap memakai registry TRM yang sama.
  returnItems?: DocumentHandoverReturnItem[];
  returnSubmittedAt?: string;
  returnSubmittedByUserId?: string;
  returnSubmittedByName?: string;

  // Evidence wajib dari pihak yang mengembalikan.
  returnPhotoFileId?: string;
  returnPhotoFileName?: string;
  returnPhotoFileSize?: number;

  // Acknowledgement penerimaan kembali.
  returnReceiverDecisionAt?: string;
  returnReceiverDecisionByUserId?: string;
  returnReceiverDecisionByName?: string;
  returnReceiverDecisionNotes?: string;

  // Evidence opsional dari penerima pengembalian.
  returnReceiptPhotoFileId?: string;
  returnReceiptPhotoFileName?: string;
  returnReceiptPhotoFileSize?: number;

  // Snapshot selisih pengembalian dipertahankan setelah diselesaikan.
  returnDiscrepancyItems?: DocumentHandoverDiscrepancySnapshotItem[];
  returnDiscrepancyResolvedAt?: string;
  returnDiscrepancyResolvedByUserId?: string;
  returnDiscrepancyResolvedByName?: string;
  returnDiscrepancyResolutionNotes?: string;
  returnDiscrepancyResolutionPhotoFileId?: string;
  returnDiscrepancyResolutionPhotoFileName?: string;
  returnDiscrepancyResolutionPhotoFileSize?: number;

  cancelledAt?: string;
  cancelledByUserId?: string;
  cancelledByName?: string;
  cancellationReason?: string;
}

export interface SupportingDocument {
  id: string;
  tabCategory: 'Proposal Penawaran' | 'SPAJ / SPAK' | 'Dokumen Lainnya';
  insuranceType: InsuranceType;
  customerCategory?: CustomerCategory;
  productName?: string;
  documentTitle: string;
  fileName: string;
  fileSize: number;
  version: string;
  status: 'Active' | 'Inactive';
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  module: string;
  action: string;
  recordType: string;
  recordId: string;
  previousValue?: string;
  newValue?: string;
  previousStatus?: string;
  newStatus?: string;
  reason?: string;
  fileReference?: string;

  // Evidence spesifik event untuk chain of custody.
  evidenceFileId?: string;
  evidenceFileName?: string;
  evidenceFileSize?: number;
}

export interface AppNotification {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  linkPath: string;
  isRead: boolean;
  createdAt: string;
}