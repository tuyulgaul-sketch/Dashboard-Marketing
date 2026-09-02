import {
  User,
  ProductMaster,
  TargetEntry,
  BookingCase,
  Pipeline,
  ProductionTransaction,
  Activity,
  ActivityComment,
  Reimbursement,
  SupportingDocument,
  AuditLog,
  AppNotification,
  HistoricalProduction,
  Appeal,
  ParticipantAddition,
  TargetUploadBatch,
  PipelineCanonicalStatus,
  CurrentHandlerBucket,
  PipelineDocument,
  LoseReason,
  DocumentHandover,
  DocumentHandoverItem
} from '@/types';

import {
  BASELINE_BROKERS,
  BROKER_MASTER_VERSION,
  BrokerMaster,
} from '@/data/brokerMasterData';

import {
  AGENT_MASTER_VERSION,
  AgentMaster,
  BASELINE_AGENTS,
} from '@/data/agentMasterData';

import {
  formatDateKeyId,
  getMinimumMarcommNeedDateKey,
  isValidMarcommNeedDate,
} from '@/utils/businessDay';

type PipelineWithOutcomeDocuments =
  Pipeline & {
    outcomeDocuments?:
      PipelineDocument[];
  };

type QuotationRevisionRequest = {
  id: string;
  targetVersion: number;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  notes: string;
  documents: PipelineDocument[];
};

type PipelineWithQuotationRevision =
  Pipeline & {
    quotationRevisionRequestedById?: string;
    quotationRevisionRequestedByName?: string;
    quotationRevisionRequestedAt?: string;
    quotationRevisionNotes?: string;
    quotationRevisionTargetVersion?: number;
    quotationRevisionDocuments?: PipelineDocument[];
    quotationRevisionRequests?: QuotationRevisionRequest[];
  };

// ============================================================
// BASELINE USER MASTER
// 31 business users + 1 SysAdmin.
// Marketing Support structure updated 18 Aug 2026.
// ============================================================
export const USER_MASTER_VERSION =
  '2026-08-18-v2-marketing-support-subdivisions';

export const BASELINE_USERS: User[] = [
  {
    id: 'USR-SYSADMIN',
    name: 'System Admin',
    email: 'sysadmin@ptperta.demo',
    role: 'SYSTEM_ADMIN',
    position: 'Super Admin Operational',
    unit: 'Administrasi Sistem',
    department: 'None',
    superiorId: null,
    status: 'Active'
  },
  {
    id: 'USR-000001',
    name: 'Martino Faishal Saudi',
    email: 'martino.faishal@ptperta.demo',
    role: 'DIRECTOR_MARKETING',
    position: 'Direktur Marketing',
    unit: 'Direktorat Pemasaran',
    department: 'None',
    superiorId: null,
    status: 'Active'
  },
  {
    id: 'USR-000002',
    name: 'Mursid Pratomo',
    email: 'mursid.pratomo@ptperta.demo',
    role: 'ADVISOR_MARKETING_DIRECTOR',
    position: 'Advisor to Direktur Pemasaran',
    unit: 'Advisor Pemasaran',
    department: 'None',
    superiorId: 'USR-000001',
    status: 'Active'
  },
  {
    id: 'USR-000003',
    name: 'Enda Perimsa',
    email: 'enda.perimsa@ptperta.demo',
    role: 'VP_CAPTIVE_MARKETING',
    position: 'VP Captive Marketing',
    unit: 'Captive Marketing',
    department: 'None',
    superiorId: 'USR-000001',
    status: 'Active'
  },
  {
    id: 'USR-000004',
    name: 'Diyaul Miqdas',
    email: 'diyaul.miqdas@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head Captive I',
    unit: 'Captive Marketing',
    department: 'Captive I',
    superiorId: 'USR-000003',
    status: 'Active'
  },
  {
    id: 'USR-000005',
    name: 'Faisal Mahdi',
    email: 'faisal.mahdi@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff Captive I',
    unit: 'Captive Marketing',
    department: 'Captive I',
    superiorId: 'USR-000004',
    status: 'Active'
  },
  {
    id: 'USR-000006',
    name: 'Jainike br Karo',
    email: 'jainike.karo@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff Captive I',
    unit: 'Captive Marketing',
    department: 'Captive I',
    superiorId: 'USR-000004',
    status: 'Active'
  },
  {
    id: 'USR-000007',
    name: 'Resty Irma Aria',
    email: 'resty.irma@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head Captive II',
    unit: 'Captive Marketing',
    department: 'Captive II',
    superiorId: 'USR-000003',
    status: 'Active'
  },
  {
    id: 'USR-000008',
    name: 'Hidayatulloh Priyo Utomo',
    email: 'hidayatulloh.utomo@ptperta.demo',
    role: 'SUPERVISOR_MARKETING',
    position: 'Supervisor Captive II',
    unit: 'Captive Marketing',
    department: 'Captive II',
    superiorId: 'USR-000007',
    status: 'Active'
  },
  {
    id: 'USR-000009',
    name: 'Ganesti Dwi Pratiwi',
    email: 'ganesti.pratiwi@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff Captive II',
    unit: 'Captive Marketing',
    department: 'Captive II',
    superiorId: 'USR-000008',
    status: 'Active'
  },
  {
    id: 'USR-000010',
    name: 'Affit Zakaria',
    email: 'affit.zakaria@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head Captive III',
    unit: 'Captive Marketing',
    department: 'Captive III',
    superiorId: 'USR-000003',
    status: 'Active'
  },
  {
    id: 'USR-000011',
    name: 'Hary Oktafian',
    email: 'hary.oktafian@ptperta.demo',
    role: 'SUPERVISOR_MARKETING',
    position: 'Supervisor Captive III',
    unit: 'Captive Marketing',
    department: 'Captive III',
    superiorId: 'USR-000010',
    status: 'Active'
  },
  {
    id: 'USR-000012',
    name: 'Irmha Chaerunnisa',
    email: 'irmha.chaerunnisa@ptperta.demo',
    role: 'SUPERVISOR_MARKETING',
    position: 'Supervisor Captive III',
    unit: 'Captive Marketing',
    department: 'Captive III',
    superiorId: 'USR-000010',
    status: 'Active'
  },
  {
    id: 'USR-000013',
    name: 'Prisko Ginting',
    email: 'prisko.ginting@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff Captive III',
    unit: 'Captive Marketing',
    department: 'Captive III',
    superiorId: 'USR-000012', // Reports to Irmha Chaerunnisa
    status: 'Active'
  },
  {
    id: 'USR-000014',
    name: 'Engel',
    email: 'engel@ptperta.demo',
    role: 'VP_CORPORATE_RETAIL_MARKETING',
    position: 'VP Corporate & Retail Marketing',
    unit: 'Corporate & Retail Marketing',
    department: 'None',
    superiorId: 'USR-000001',
    status: 'Active'
  },
  {
    id: 'USR-000015',
    name: 'Febby Kurniawan',
    email: 'febby.kurniawan@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head CRM I',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM I',
    superiorId: 'USR-000014',
    status: 'Active'
  },
  {
    id: 'USR-000016',
    name: 'Nadya Astriani Putri',
    email: 'nadya.putri@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM I',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM I',
    superiorId: 'USR-000015',
    status: 'Active'
  },
  {
    id: 'USR-000017',
    name: 'Reinhard Tumbur',
    email: 'reinhard.tumbur@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM I',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM I',
    superiorId: 'USR-000015',
    status: 'Active'
  },
  {
    id: 'USR-000018',
    name: 'Larmo',
    email: 'larmo@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head CRM II',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM II',
    superiorId: 'USR-000014',
    status: 'Active'
  },
  {
    id: 'USR-000019',
    name: 'Raedi Rigel Pratomo',
    email: 'raedi.pratomo@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM II',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM II',
    superiorId: 'USR-000018',
    status: 'Active'
  },
  {
    id: 'USR-000020',
    name: 'Violeta Virgin Gemert',
    email: 'violeta.gemert@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM II',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM II',
    superiorId: 'USR-000018',
    status: 'Active'
  },
  {
    id: 'USR-000021',
    name: 'Sri Bayu Prasetiyo',
    email: 'sri.bayu@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING',
    position: 'Department Head CRM III',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM III',
    superiorId: 'USR-000014',
    status: 'Active'
  },
  {
    id: 'USR-000022',
    name: 'Anissa Faradina Razak',
    email: 'anissa.razak@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM III',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM III',
    superiorId: 'USR-000021',
    status: 'Active'
  },
  {
    id: 'USR-000023',
    name: 'Riady Yahya Angkat',
    email: 'riady.angkat@ptperta.demo',
    role: 'STAFF_MARKETING',
    position: 'Staff CRM III',
    unit: 'Corporate & Retail Marketing',
    department: 'CRM III',
    superiorId: 'USR-000021',
    status: 'Active'
  },
  {
    id: 'USR-000024',
    name: 'Arianie Fajarwati',
    email: 'arianie.fajarwati@ptperta.demo',
    role: 'TEAM_LEADER_MARKETING_SUPPORT',
    position: 'Team Leader Marketing Support',
    unit: 'Marketing Support',
    department: 'None',
    superiorId: 'USR-000001',
    status: 'Active'
  },
  {
    id: 'USR-000028',
    name: 'RR Endah Wasis Wuwuh Mumpuni',
    email: 'endah.wasis@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION',
    position: 'Department Head Marketing Administration',
    unit: 'Marketing Support',
    department: 'Marketing Administration',
    superiorId: 'USR-000024',
    status: 'Active'
  },
  {
    id: 'USR-000025',
    name: 'Suci Yumarlia',
    email: 'suci.yumarlia@ptperta.demo',
    role: 'SUPERVISOR_MARKETING_ADMINISTRATION',
    position: 'Supervisor Marketing Administration',
    unit: 'Marketing Support',
    department: 'Marketing Administration',
    superiorId: 'USR-000028',
    status: 'Active'
  },
  {
    id: 'USR-000026',
    name: 'Ayu Evarinanty',
    email: 'ayu.evarinanty@ptperta.demo',
    role: 'STAFF_MARKETING_ADMINISTRATION',
    position: 'Staff Marketing Administration',
    unit: 'Marketing Support',
    department: 'Marketing Administration',
    superiorId: 'USR-000025',
    status: 'Active'
  },
  {
    id: 'USR-000027',
    name: 'Ulfia Hegrina',
    email: 'ulfia.hegrina@ptperta.demo',
    role: 'STAFF_MARKETING_ADMINISTRATION',
    position: 'Staff Marketing Administration',
    unit: 'Marketing Support',
    department: 'Marketing Administration',
    superiorId: 'USR-000025',
    status: 'Active'
  },
  {
    id: 'USR-000029',
    name: 'Raydinda Rizko Prahesanandy',
    email: 'raydinda.prahesanandy@ptperta.demo',
    role: 'STAFF_MARKETING_ADMINISTRATION',
    position: 'Staff Marketing Administration',
    unit: 'Marketing Support',
    department: 'Marketing Administration',
    superiorId: 'USR-000025',
    status: 'Active'
  },
  {
    id: 'USR-000030',
    name: 'Andi Rita Anastasya Baso',
    email: 'andi.rita@ptperta.demo',
    role: 'DEPARTMENT_HEAD_MARKETING_COMMUNICATION',
    position: 'Department Head Marketing Communication',
    unit: 'Marketing Support',
    department: 'Marketing Communication',
    superiorId: 'USR-000024',
    status: 'Active'
  },
  {
    id: 'USR-000031',
    name: 'Karina Malik',
    email: 'karina.malik@ptperta.demo',
    role: 'STAFF_MARKETING_COMMUNICATION',
    position: 'Staff Marketing Communication',
    unit: 'Marketing Support',
    department: 'Marketing Communication',
    superiorId: 'USR-000030',
    status: 'Active'
  }
];

// ============================================================
// BASELINE PRODUCT MASTER — VERSION 2026-08-12
// Source: updated product master supplied by user.
// ============================================================
export const PRODUCT_MASTER_VERSION = '2026-08-12-v2-mandiri-guna';

export const BASELINE_PRODUCTS: ProductMaster[] = [
  // ==========================================================
  // ASJIW — INDIVIDU / JIWA INDIVIDU
  // ==========================================================
  { id: 'PRD-JI-01', productCode: 'JI-01', productName: 'PA MEDICARD', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-02', productCode: 'JI-02', productName: 'EKAWARSA', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-03', productCode: 'JI-03', productName: 'TM POWER LINK', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-04', productCode: 'JI-04', productName: 'PLIFE DANA MAKSIMA', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-05', productCode: 'JI-05', productName: 'PLIFE SHIELD', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-06', productCode: 'JI-06', productName: 'TM SMART GIFT', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-07', productCode: 'JI-07', productName: 'P-INF PRIME ANNUITY (PIPA)', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JI-08', productCode: 'JI-08', productName: 'P-INF ANUITAS RETIRE GUARD', insuranceType: 'Asuransi Jiwa', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },

  // ==========================================================
  // ASJIW — KUMPULAN / JIWA KUMPULAN
  // ==========================================================
  { id: 'PRD-JK-01', productCode: 'JK-01', productName: 'TM ORPHANAGE SCHOLARSHIP', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-02', productCode: 'JK-02', productName: 'TM SEVERANCE PROGRAM', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-03', productCode: 'JK-03', productName: 'TM GROUP PERSONAL ACCIDENT', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-04', productCode: 'JK-04', productName: 'PERTA WHOLE LIFE PROTECTION', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-05', productCode: 'JK-05', productName: 'TM GROUP TERM LIFE', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-06', productCode: 'JK-06', productName: 'TM EXECUTIVE SEVERANCE PROGRAM', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-07', productCode: 'JK-07', productName: 'MANDIRI ASURANSI PESANGON SEJAHTERA', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12', notes: 'Source row 15' },
  { id: 'PRD-JK-08', productCode: 'JK-08', productName: 'PLIFE BIZ TRIP', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-09', productCode: 'JK-09', productName: 'TM GROUP CREDIT SHIELD', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-10', productCode: 'JK-10', productName: 'MANDIRI GUNA', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12', notes: 'Canonical product replacing legacy MANDIRI GUNA I / II / III' },
  { id: 'PRD-JK-13', productCode: 'JK-13', productName: 'MANDIRI ASURANSI PESANGON SEJAHTERA', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12', notes: 'Source row 21 — duplicate product name retained exactly as supplied' },
  { id: 'PRD-JK-14', productCode: 'JK-14', productName: 'BPJ', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-JK-15', productCode: 'JK-15', productName: 'ANUITAS', insuranceType: 'Asuransi Jiwa', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },

  // ==========================================================
  // ASKES — INDIVIDU / KESEHATAN INDIVIDU
  // ==========================================================
  { id: 'PRD-KI-01', productCode: 'KI-01', productName: 'TM HEALTH GUARD', insuranceType: 'Asuransi Kesehatan', customerCategory: 'Individu', status: 'Active', effectiveDate: '2026-08-12' },

  // ==========================================================
  // ASKES — KUMPULAN / KESEHATAN KUMPULAN
  // ==========================================================
  { id: 'PRD-KK-01', productCode: 'KK-01', productName: 'TM GROUP MEDICARE PLAN', insuranceType: 'Asuransi Kesehatan', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' },
  { id: 'PRD-KK-02', productCode: 'KK-02', productName: 'TM GROUP MANAGED HEALTH CARE PLAN', insuranceType: 'Asuransi Kesehatan', customerCategory: 'Kumpulan', status: 'Active', effectiveDate: '2026-08-12' }
];


// ============================================================
// LOCAL STORAGE KEYS & INITIALIZATION
// ============================================================
const STORAGE_KEYS = {
  CURRENT_USER_ID: 'pertalife_current_user_id',
  USERS: 'pertalife_users',
  USER_MASTER_VERSION: 'pertalife_user_master_version',
  PRODUCTS: 'pertalife_products',
  PRODUCT_MASTER_VERSION: 'pertalife_product_master_version',
  BROKERS: 'pertalife_brokers',
  BROKER_MASTER_VERSION: 'pertalife_broker_master_version',
  AGENTS: 'pertalife_agents',
  AGENT_MASTER_VERSION: 'pertalife_agent_master_version',
  TARGETS: 'pertalife_targets',
  TARGET_BATCHES: 'pertalife_target_batches',
  BOOKINGS: 'pertalife_bookings',
  PIPELINES: 'pertalife_pipelines',
  APPEALS: 'pertalife_appeals',
  PRODUCTIONS: 'pertalife_productions',
  OFFICIAL_PRODUCTION_SUMMARIES: 'pertalife_official_production_summaries',
  OFFICIAL_PRODUCTION_BATCHES: 'pertalife_official_production_batches',
  OFFICIAL_POLICY_DIRECTORY: 'pertalife_official_policy_directory',
  SERVICE_DOCUMENTS: 'pertalife_service_documents',
  MARCOMM_REQUESTS: 'pertalife_marcomm_requests',
  MARCOMM_STOCK_TRANSACTIONS: 'pertalife_marcomm_stock_transactions',
  MARCOMM_STOCK_OPNAMES: 'pertalife_marcomm_stock_opnames',
  PARTICIPANTS: 'pertalife_participants',
  HISTORICAL: 'pertalife_historical',
  ACTIVITIES: 'pertalife_activities',
  ACTIVITY_COMMENTS: 'pertalife_activity_comments',
  REIMBURSEMENTS: 'pertalife_reimbursements',
  SUPPORTING_DOCS: 'pertalife_supporting_docs',
  AUDIT_LOGS: 'pertalife_audit_logs',
  NOTIFICATIONS: 'pertalife_notifications',
  APPROVER_DELEGATIONS: 'pertalife_approver_delegations',
  DOCUMENT_HANDOVERS: 'pertalife_document_handovers'
};

export type ActingApproverArea =
  | 'MARKETING_ADMINISTRATION'
  | 'MARKETING_COMMUNICATION';

export interface ActingApproverDelegation {
  id: string;
  area: ActingApproverArea;
  delegatorUserId: string;
  delegatorName: string;
  delegateUserId: 'USR-000024';
  delegateName: 'Arianie Fajarwati';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  deactivatedAt?: string;
  deactivatedByUserId?: string;
  deactivatedByName?: string;
}

export interface OfficialProductionImportRecord {
  productionYear: number;
  productionMonth: number;
  policyNumber?: string;
  customerName: string;
  noteNumber?: string;
  productName: string;
  coverageStart?: string;
  coverageEnd?: string;
  productionAmount: number;
  marketingFunction:
    | 'Captive Marketing'
    | 'Corporate & Retail Marketing';
  businessType:
    | 'New Business'
    | 'Renewal Business';
  picName: string;
  picUserId?: string;
  department?: string;
}

export interface OfficialProductionSummary {
  id: string;
  batchId: string;
  productionYear: number;
  productionMonth: number;
  marketingFunction:
    | 'Captive Marketing'
    | 'Corporate & Retail Marketing';
  unit:
    | 'Captive Marketing'
    | 'Corporate & Retail Marketing';
  department: string;
  businessType:
    | 'New Business'
    | 'Renewal Business';
  productName: string;
  picName: string;
  picUserId?: string;
  productionAmount: number;
  transactionCount: number;
  adjustmentCount: number;
}

export interface OfficialProductionBatch {
  id: string;
  filename: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  sourceRowCount: number;
  validRowCount: number;
  ignoredRowCount: number;
  warningRowCount: number;
  publishedPeriodKeys: string[];
  totalProductionAmount: number;
  status: 'Published';
}


export interface OfficialPolicyRecord {
  id: string;
  policyNumber: string;
  customerName: string;
  productName: string;
  marketingFunction:
    | 'Captive Marketing'
    | 'Corporate & Retail Marketing';
  department: string;
  businessType:
    | 'New Business'
    | 'Renewal Business';
  picName: string;
  picUserId?: string;
  productionYear: number;
  productionMonth: number;
  lastProductionAmount: number;
  sourceBatchId: string;
  updatedAt: string;
  isDummyPolicyNumber?: boolean;
}

export type ServiceDocumentOwner =
  | 'MARKETING_ADMINISTRATION'
  | 'MARKETING_COMMUNICATION';

export type ServiceDocumentCategory =
  | 'SPAJ'
  | 'SPAK'
  | 'PROPOSAL_PENAWARAN_STANDAR'
  | 'MATERI_PRESENTASI'
  | 'MATERI_SOSIALISASI'
  | 'BROSUR'
  | 'FLYER';

export interface ManagedServiceDocument {
  id: string;
  ownerArea: ServiceDocumentOwner;
  category: ServiceDocumentCategory;
  productName?: string;
  insuranceType?: string;
  customerCategory?: string;
  title: string;
  version: number;
  versionLabel: string;
  fileName: string;
  fileSize: number;
  status:
    | 'PENDING_APPROVAL'
    | 'PUBLISHED'
    | 'REJECTED'
    | 'INACTIVE';
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;
  requestId?: string;
  notes?: string;
}

export type MarketingToolCategory =
  | 'PROPOSAL_PENAWARAN_STANDAR'
  | 'MATERI_PRESENTASI'
  | 'MATERI_SOSIALISASI'
  | 'BROSUR'
  | 'FLYER';

export type MarcommRequestType =
  | 'MARKETING_TOOL'
  | 'MATERI_BROADCAST'
  | 'SOUVENIR'
  | 'OPEN_BOOTH'
  | 'KARANGAN_BUNGA_UCAPAN'
  | 'HAMPERS_HARI_RAYA'
  | 'LITERASI_KEUANGAN';

export type MarcommStockCategory =
  | 'SOUVENIR';

export type MarcommStockTier =
  | 'VIP'
  | 'REGULER';

export interface MarcommStockTransaction {
  id: string;
  stockCategory:
    MarcommStockCategory;
  giftTier:
    MarcommStockTier;
  transactionType:
    | 'STOCK_IN'
    | 'STOCK_OUT'
    | 'ADJUSTMENT';
  quantity: number;
  requestId?: string;
  notes?: string;
  attachment?: MarcommRequestDocument;
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
}

export interface MarcommStockOpname {
  id: string;
  stockCategory:
    MarcommStockCategory;
  giftTier:
    MarcommStockTier;
  systemOnHandAtSubmission: number;
  physicalQuantity: number;
  differenceAtSubmission: number;
  notes?: string;
  attachment?: MarcommRequestDocument;
  submittedAt: string;
  submittedByUserId: string;
  submittedByName: string;
  status:
    | 'PENDING_ANDI_APPROVAL'
    | 'APPROVED'
    | 'REJECTED';
  decidedAt?: string;
  decidedByUserId?: string;
  decidedByName?: string;
  decisionNotes?: string;
  approvedAdjustment?: number;
}

export interface MarcommStockSnapshot {
  stockCategory:
    MarcommStockCategory;
  giftTier:
    MarcommStockTier;
  onHand: number;
  reserved: number;
  available: number;
  lastOpnameAt?: string;
  lastOpnamePhysical?: number;
}

export interface MarcommRequestDocument {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  documentRole:
    | 'REQUEST_ATTACHMENT'
    | 'REVISION_ATTACHMENT'
    | 'DELIVERABLE'
    | 'EVIDENCE';
}

export interface MarcommDeliverableVersion {
  id: string;
  version: number;
  submittedAt: string;
  submittedByUserId: string;
  submittedByName: string;
  notes?: string;
  documents: MarcommRequestDocument[];
  status:
    | 'PENDING_ANDI_APPROVAL'
    | 'PUBLISHED'
    | 'REJECTED';
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  approvalNotes?: string;
}

export interface MarcommRevisionHistory {
  id: string;
  requestedAt: string;
  requestedByUserId: string;
  requestedByName: string;
  notes: string;
  attachments: MarcommRequestDocument[];
  targetVersion: number;
}

export interface MarcommRequest {
  id: string;
  requestType: MarcommRequestType;
  marketingToolCategory?: MarketingToolCategory;

  requestGroup?:
    | 'DESIGN'
    | 'GOODS_SERVICES';

  designType?:
    | 'BROADCAST'
    | 'FLYER'
    | 'PROPOSAL_PENAWARAN'
    | 'MATERI_PRESENTASI'
    | 'MATERI_SOSIALISASI'
    | 'BROSUR';

  flowerOption?:
    | 'BUNGA_MEJA'
    | 'BUNGA_PAPAN'
    | 'DESIGN_UCAPAN_SAJA';

  greetingText?: string;
  participantEstimate?: number;

  requesterUserId: string;
  requesterName: string;
  requesterUnit: string;
  requesterDepartment: string;
  requesterPosition: string;

  clientType:
    | 'EXISTING'
    | 'PROSPECT';
  policyNumber?: string;
  clientName: string;
  productName?: string;

  requestedAt: string;
  needDate: string;
  location?: string;
  quantity?: number;
  giftTier?: 'VIP' | 'REGULER';

  // Final operational authority for Souvenir / Hampers belongs to
  // Andi Rita. Original Marketing request remains preserved above.
  approvedQuantity?: number;
  approvedGiftTier?: 'VIP' | 'REGULER';
  andiOperationalAdjustmentAt?: string;

  estimatedBudget?: number;
  brief: string;
  requestAttachments: MarcommRequestDocument[];

  status:
    | 'PENDING_ANDI_APPROVAL'
    | 'REJECTED_BY_ANDI'
    | 'APPROVED_WAITING_KARINA'
    | 'IN_PROGRESS'
    | 'PENDING_ANDI_FINAL_REVIEW'
    | 'PUBLISHED_WAITING_MARKETING'
    | 'REVISION_REQUESTED_PENDING_ANDI'
    | 'COMPLETED';

  andiDecision?: 'APPROVED' | 'REJECTED';
  andiDecisionAt?: string;
  andiDecisionNotes?: string;

  assignedToUserId?: string;
  assignedToName?: string;
  startedAt?: string;

  deliverables: MarcommDeliverableVersion[];
  revisionHistory: MarcommRevisionHistory[];

  completedAt?: string;
  completedByUserId?: string;
  completedByName?: string;
  lastUpdatedAt: string;
}

class StoreService {
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'USR-000001'); // Martino Faishal Saudi default
    }
    const storedUserMasterVersion =
      localStorage.getItem(
        STORAGE_KEYS.USER_MASTER_VERSION
      );

    if (
      storedUserMasterVersion !==
      USER_MASTER_VERSION
    ) {
      localStorage.setItem(
        STORAGE_KEYS.USERS,
        JSON.stringify(
          BASELINE_USERS
        )
      );

      localStorage.setItem(
        STORAGE_KEYS.USER_MASTER_VERSION,
        USER_MASTER_VERSION
      );

      const currentLogin =
        localStorage.getItem(
          STORAGE_KEYS.CURRENT_USER_ID
        );

      if (
        currentLogin &&
        !BASELINE_USERS.some(
          user =>
            user.id ===
            currentLogin
        )
      ) {
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_USER_ID,
          'USR-000001'
        );
      }
    } else if (
      !localStorage.getItem(
        STORAGE_KEYS.USERS
      )
    ) {
      localStorage.setItem(
        STORAGE_KEYS.USERS,
        JSON.stringify(
          BASELINE_USERS
        )
      );
    }

    // Product Master migration:
    // overwrite the existing browser product master ONCE when the
    // master version changes. After migration, normal admin edits are
    // preserved until PRODUCT_MASTER_VERSION is intentionally bumped.
    const storedProductMasterVersion =
      localStorage.getItem(
        STORAGE_KEYS.PRODUCT_MASTER_VERSION
      );

    if (
      storedProductMasterVersion !==
      PRODUCT_MASTER_VERSION
    ) {
      localStorage.setItem(
        STORAGE_KEYS.PRODUCTS,
        JSON.stringify(
          BASELINE_PRODUCTS
        )
      );

      localStorage.setItem(
        STORAGE_KEYS.PRODUCT_MASTER_VERSION,
        PRODUCT_MASTER_VERSION
      );
    } else if (
      !localStorage.getItem(
        STORAGE_KEYS.PRODUCTS
      )
    ) {
      localStorage.setItem(
        STORAGE_KEYS.PRODUCTS,
        JSON.stringify(
          BASELINE_PRODUCTS
        )
      );
    }
    
    // Broker Master migration:
    // restore/update the OJK baseline only when the broker master
    // version intentionally changes. Admin edits remain preserved
    // until BROKER_MASTER_VERSION is bumped.
    const storedBrokerMasterVersion =
      localStorage.getItem(
        STORAGE_KEYS.BROKER_MASTER_VERSION
      );

    if (
      storedBrokerMasterVersion !==
      BROKER_MASTER_VERSION
    ) {
      localStorage.setItem(
        STORAGE_KEYS.BROKERS,
        JSON.stringify(
          BASELINE_BROKERS
        )
      );

      localStorage.setItem(
        STORAGE_KEYS.BROKER_MASTER_VERSION,
        BROKER_MASTER_VERSION
      );
    } else if (
      !localStorage.getItem(
        STORAGE_KEYS.BROKERS
      )
    ) {
      localStorage.setItem(
        STORAGE_KEYS.BROKERS,
        JSON.stringify(
          BASELINE_BROKERS
        )
      );
    }

    // Agent Master migration.
    // Marketing Support edits remain preserved until AGENT_MASTER_VERSION is bumped.
    const storedAgentMasterVersion =
      localStorage.getItem(
        STORAGE_KEYS.AGENT_MASTER_VERSION
      );

    if (
      storedAgentMasterVersion !==
      AGENT_MASTER_VERSION
    ) {
      localStorage.setItem(
        STORAGE_KEYS.AGENTS,
        JSON.stringify(
          BASELINE_AGENTS
        )
      );

      localStorage.setItem(
        STORAGE_KEYS.AGENT_MASTER_VERSION,
        AGENT_MASTER_VERSION
      );
    } else if (
      !localStorage.getItem(
        STORAGE_KEYS.AGENTS
      )
    ) {
      localStorage.setItem(
        STORAGE_KEYS.AGENTS,
        JSON.stringify(
          BASELINE_AGENTS
        )
      );
    }

    // Ensure all transactional arrays exist
    const defaultEmptyKeys = [
      STORAGE_KEYS.TARGETS,
      STORAGE_KEYS.TARGET_BATCHES,
      STORAGE_KEYS.BOOKINGS,
      STORAGE_KEYS.PIPELINES,
      STORAGE_KEYS.APPEALS,
      STORAGE_KEYS.PRODUCTIONS,
      STORAGE_KEYS.OFFICIAL_PRODUCTION_SUMMARIES,
      STORAGE_KEYS.OFFICIAL_PRODUCTION_BATCHES,
      STORAGE_KEYS.OFFICIAL_POLICY_DIRECTORY,
      STORAGE_KEYS.SERVICE_DOCUMENTS,
      STORAGE_KEYS.MARCOMM_REQUESTS,
      STORAGE_KEYS.MARCOMM_STOCK_TRANSACTIONS,
      STORAGE_KEYS.MARCOMM_STOCK_OPNAMES,
      STORAGE_KEYS.PARTICIPANTS,
      STORAGE_KEYS.HISTORICAL,
      STORAGE_KEYS.ACTIVITIES,
      STORAGE_KEYS.ACTIVITY_COMMENTS,
      STORAGE_KEYS.REIMBURSEMENTS,
      STORAGE_KEYS.SUPPORTING_DOCS,
      STORAGE_KEYS.AUDIT_LOGS,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.APPROVER_DELEGATIONS
    ];

    defaultEmptyKeys.forEach(key => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify([]));
      }
    });

    // Hampers Hari Raya is no longer stock-controlled.
    // Permanently remove legacy Hampers stock transactions/opnames
    // from active browser storage so stock opname is Souvenir-only.
    const storedStockTransactions:
      MarcommStockTransaction[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.MARCOMM_STOCK_TRANSACTIONS
        ) || '[]'
      );

    const souvenirStockTransactions =
      storedStockTransactions.filter(
        transaction =>
          transaction.stockCategory ===
          'SOUVENIR'
      );

    if (
      souvenirStockTransactions.length !==
      storedStockTransactions.length
    ) {
      localStorage.setItem(
        STORAGE_KEYS.MARCOMM_STOCK_TRANSACTIONS,
        JSON.stringify(
          souvenirStockTransactions
        )
      );
    }

    const storedStockOpnames:
      MarcommStockOpname[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.MARCOMM_STOCK_OPNAMES
        ) || '[]'
      );

    const souvenirStockOpnames =
      storedStockOpnames.filter(
        opname =>
          opname.stockCategory ===
          'SOUVENIR'
      );

    if (
      souvenirStockOpnames.length !==
      storedStockOpnames.length
    ) {
      localStorage.setItem(
        STORAGE_KEYS.MARCOMM_STOCK_OPNAMES,
        JSON.stringify(
          souvenirStockOpnames
        )
      );
    }

    // ========================================================
    // LEGACY SUPPORTING DOCUMENT MIGRATION
    // Old repository:
    //   Proposal Penawaran -> Marketing Communication
    //   SPAJ / SPAK       -> Marketing Administration
    //   Dokumen Lainnya   -> intentionally dropped
    //
    // Binary IDs are retained. marketingSupportFileStorage.ts
    // can read the legacy IndexedDB store as fallback.
    // ========================================================
    const existingServiceDocuments:
      ManagedServiceDocument[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.SERVICE_DOCUMENTS
        ) || '[]'
      );

    if (
      existingServiceDocuments.length ===
      0
    ) {
      const legacySupportingDocuments:
        SupportingDocument[] =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEYS.SUPPORTING_DOCS
          ) || '[]'
        );

      const migrated =
        legacySupportingDocuments
          .filter(
            document =>
              document.status ===
                'Active' &&
              document.tabCategory !==
                'Dokumen Lainnya'
          )
          .map(
            (
              document,
              index
            ): ManagedServiceDocument => {
              const isProposal =
                document.tabCategory ===
                'Proposal Penawaran';

              const titleLower =
                (
                  document.documentTitle ||
                  ''
                ).toLowerCase();

              const category:
                ServiceDocumentCategory =
                isProposal
                  ? 'PROPOSAL_PENAWARAN_STANDAR'
                  : titleLower.includes(
                      'spak'
                    )
                    ? 'SPAK'
                    : 'SPAJ';

              const versionNumber =
                Number(
                  String(
                    document.version ||
                    ''
                  )
                    .replace(
                      /[^0-9.]/g,
                      ''
                    )
                    .split(
                      '.'
                    )[0]
                ) ||
                1;

              return {
                id:
                  document.id,
                ownerArea:
                  isProposal
                    ? 'MARKETING_COMMUNICATION'
                    : 'MARKETING_ADMINISTRATION',
                category,
                productName:
                  document.productName,
                insuranceType:
                  document.insuranceType,
                customerCategory:
                  document.customerCategory,
                title:
                  document.documentTitle,
                version:
                  versionNumber,
                versionLabel:
                  document.version ||
                  `V${versionNumber}`,
                fileName:
                  document.fileName,
                fileSize:
                  document.fileSize,
                status:
                  'PUBLISHED',
                uploadedByUserId:
                  BASELINE_USERS.find(
                    user =>
                      user.name ===
                      document.uploadedBy
                  )?.id ||
                  'USR-000024',
                uploadedByName:
                  document.uploadedBy,
                uploadedAt:
                  document.uploadedAt,
                approvedByUserId:
                  isProposal
                    ? 'USR-000030'
                    : 'USR-000028',
                approvedByName:
                  isProposal
                    ? 'Andi Rita Anastasya Baso'
                    : 'RR Endah Wasis Wuwuh Mumpuni',
                approvedAt:
                  document.uploadedAt,
                approvalNotes:
                  'Migrasi otomatis dari repository Dokumen Pendukung UAT lama.',
                notes:
                  document.notes,
              };
            }
          );

      if (
        migrated.length >
        0
      ) {
        localStorage.setItem(
          STORAGE_KEYS.SERVICE_DOCUMENTS,
          JSON.stringify(
            migrated
          )
        );
      }
    }

    // ========================================================
    // PRODUCT ALIAS MIGRATION — MANDIRI GUNA
    // MANDIRI GUNA I / II / III are now one canonical product.
    // Existing UAT transactional records are migrated so every
    // dashboard/module displays and aggregates them consistently.
    // ========================================================
    const legacyMandiriGunaNames = new Set([
      'MANDIRI GUNA I',
      'MANDIRI GUNA II',
      'MANDIRI GUNA III'
    ]);

    const normalizeMandiriGunaRecord = (record: any) => {
      let changed = false;
      const next = { ...record };

      if (
        typeof next.productName === 'string' &&
        legacyMandiriGunaNames.has(next.productName.trim().toUpperCase())
      ) {
        next.productName = 'MANDIRI GUNA';
        changed = true;
      }

      if (
        typeof next.discussedProduct === 'string' &&
        legacyMandiriGunaNames.has(next.discussedProduct.trim().toUpperCase())
      ) {
        next.discussedProduct = 'MANDIRI GUNA';
        changed = true;
      }

      if (
        next.productId === 'PRD-JK-11' ||
        next.productId === 'PRD-JK-12'
      ) {
        next.productId = 'PRD-JK-10';
        changed = true;
      }

      if (
        next.productCode === 'JK-11' ||
        next.productCode === 'JK-12'
      ) {
        next.productCode = 'JK-10';
        changed = true;
      }

      return {
        changed,
        record: next
      };
    };

    const mandiriGunaMigrationKeys = [
      STORAGE_KEYS.BOOKINGS,
      STORAGE_KEYS.PIPELINES,
      STORAGE_KEYS.PRODUCTIONS,
      STORAGE_KEYS.HISTORICAL,
      STORAGE_KEYS.ACTIVITIES,
      STORAGE_KEYS.SUPPORTING_DOCS
    ];

    mandiriGunaMigrationKeys.forEach(key => {
      try {
        const currentRecords = JSON.parse(
          localStorage.getItem(key) || '[]'
        );

        if (!Array.isArray(currentRecords)) {
          return;
        }

        let hasChanges = false;

        const migratedRecords = currentRecords.map(record => {
          const result = normalizeMandiriGunaRecord(record);

          if (result.changed) {
            hasChanges = true;
          }

          return result.record;
        });

        if (hasChanges) {
          localStorage.setItem(
            key,
            JSON.stringify(migratedRecords)
          );
        }
      } catch {
        // Do not block application startup if legacy UAT data is malformed.
      }
    });

    // Supporting Documents must represent REAL uploaded files only.
    // Legacy UAT placeholders DOC-001 / DOC-002 only stored metadata and had
    // no downloadable binary file. Remove them so users never see fake files.
    const supportingDocs = this.getSupportingDocuments();
    const cleanedSupportingDocs = supportingDocs.filter(
      doc =>
        doc.id !== 'DOC-001' &&
        doc.id !== 'DOC-002'
    );

    if (
      cleanedSupportingDocs.length !==
      supportingDocs.length
    ) {
      localStorage.setItem(
        STORAGE_KEYS.SUPPORTING_DOCS,
        JSON.stringify(
          cleanedSupportingDocs
        )
      );
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  // ============================================================
  // USER & AUTH & HIERARCHY
  // ============================================================
  public getUsers(): User[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
  }

  public getCurrentUser(): User {
    const users = this.getUsers();
    const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    const user = users.find(u => u.id === currentId);
    return user || users[1]; // Fallback to Martino
  }

  public setCurrentUser(userId: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
    this.addAuditLog('AUTH', 'SWITCH_USER', 'User', userId, undefined, undefined, undefined, 'User switched login account in UAT toolbar');
    this.notify();
  }

  public saveUser(user: User) {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify();
  }

  // Get all subordinate User IDs recursively according to organizational hierarchy
  public getSubordinateUserIds(managerId: string): string[] {
    const users = this.getUsers();
    const result: string[] = [managerId];

    const findSubordinates = (parentId: string) => {
      const direct = users.filter(u => u.superiorId === parentId);
      for (const d of direct) {
        result.push(d.id);
        findSubordinates(d.id);
      }
    };

    findSubordinates(managerId);
    return Array.from(new Set(result));
  }

  // Check if target user is in manager's scope
  public isUserInScope(managerUser: User, targetUserId: string): boolean {
    if (managerUser.role === 'SYSTEM_ADMIN' || managerUser.role === 'DIRECTOR_MARKETING') {
      return true;
    }
    if (managerUser.role === 'TEAM_LEADER_MARKETING_SUPPORT' ||
        managerUser.role === 'SUPERVISOR_MARKETING_ADMINISTRATION' ||
        managerUser.role === 'STAFF_MARKETING_ADMINISTRATION') {
      return true; // Marketing support has broad operational visibility for queues
    }
    const subordinates = this.getSubordinateUserIds(managerUser.id);
    return subordinates.includes(targetUserId);
  }

  // ============================================================
  // PRODUCT MASTER
  // ============================================================
  public getProducts(): ProductMaster[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
  }

  public normalizeProductName(productName: string): string {
    const normalized = String(productName || '').trim().toUpperCase();

    if (
      normalized === 'MANDIRI GUNA I' ||
      normalized === 'MANDIRI GUNA II' ||
      normalized === 'MANDIRI GUNA III'
    ) {
      return 'MANDIRI GUNA';
    }

    return String(productName || '').trim();
  }

  public saveProduct(product: ProductMaster) {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index >= 0) {
      products[index] = product;
    } else {
      products.push(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.notify();
  }

  // ============================================================
  // TARGET & RKAP
  // ============================================================
  // ============================================================
  // BROKER MASTER — OJK DIRECTORY
  // ============================================================
  public getBrokers(): BrokerMaster[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.BROKERS
      ) || '[]'
    );
  }

  private assertMarketingSupportForBrokerMaster() {
    const currentUser =
      this.getCurrentUser();

    if (
      currentUser.unit !==
      'Marketing Support'
    ) {
      throw new Error(
        'Master Broker hanya dapat dikelola oleh akun Marketing Support.'
      );
    }
  }

  public addBroker(
    broker: BrokerMaster
  ) {
    this.assertMarketingSupportForBrokerMaster();

    const brokers =
      this.getBrokers();

    const duplicateName =
      brokers.some(
        item =>
          item.companyName.trim().toLowerCase() ===
          broker.companyName.trim().toLowerCase()
      );

    if (
      duplicateName
    ) {
      throw new Error(
        `Broker "${broker.companyName}" sudah terdaftar.`
      );
    }

    const now =
      new Date().toISOString();

    const currentUser =
      this.getCurrentUser();

    const newBroker:
      BrokerMaster = {
        ...broker,
        createdAt:
          broker.createdAt ||
          now,
        updatedAt:
          now,
        updatedBy:
          currentUser.name,
      };

    brokers.push(
      newBroker
    );

    brokers.sort(
      (
        first,
        second
      ) =>
        first.companyName.localeCompare(
          second.companyName,
          'id'
        )
    );

    localStorage.setItem(
      STORAGE_KEYS.BROKERS,
      JSON.stringify(
        brokers
      )
    );

    this.addAuditLog(
      'BROKER_MASTER',
      'CREATE',
      'BrokerMaster',
      newBroker.id,
      undefined,
      newBroker.status,
      undefined,
      `Added broker ${newBroker.companyName}`
    );

    this.notify();
  }

  public updateBroker(
    broker: BrokerMaster
  ) {
    this.assertMarketingSupportForBrokerMaster();

    const brokers =
      this.getBrokers();

    const index =
      brokers.findIndex(
        item =>
          item.id ===
          broker.id
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Broker tidak ditemukan.'
      );
    }

    const duplicateName =
      brokers.some(
        item =>
          item.id !==
            broker.id &&
          item.companyName.trim().toLowerCase() ===
            broker.companyName.trim().toLowerCase()
      );

    if (
      duplicateName
    ) {
      throw new Error(
        `Broker "${broker.companyName}" sudah terdaftar.`
      );
    }

    const previous =
      brokers[
        index
      ];

    const currentUser =
      this.getCurrentUser();

    const updated:
      BrokerMaster = {
        ...previous,
        ...broker,
        updatedAt:
          new Date().toISOString(),
        updatedBy:
          currentUser.name,
      };

    brokers[
      index
    ] =
      updated;

    brokers.sort(
      (
        first,
        second
      ) =>
        first.companyName.localeCompare(
          second.companyName,
          'id'
        )
    );

    localStorage.setItem(
      STORAGE_KEYS.BROKERS,
      JSON.stringify(
        brokers
      )
    );

    this.addAuditLog(
      'BROKER_MASTER',
      'UPDATE',
      'BrokerMaster',
      updated.id,
      previous.status,
      updated.status,
      undefined,
      `Updated broker ${updated.companyName}`
    );

    this.notify();
  }

  public setBrokerStatus(
    brokerId: string,
    status:
      | 'Active'
      | 'Inactive'
  ) {
    const broker =
      this.getBrokers().find(
        item =>
          item.id ===
          brokerId
      );

    if (
      !broker
    ) {
      throw new Error(
        'Broker tidak ditemukan.'
      );
    }

    this.updateBroker({
      ...broker,
      status,
    });
  }

  public deleteBroker(
    brokerId: string
  ) {
    this.assertMarketingSupportForBrokerMaster();

    const brokers =
      this.getBrokers();

    const broker =
      brokers.find(
        item =>
          item.id ===
          brokerId
      );

    if (
      !broker
    ) {
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.BROKERS,
      JSON.stringify(
        brokers.filter(
          item =>
            item.id !==
            brokerId
        )
      )
    );

    this.addAuditLog(
      'BROKER_MASTER',
      'DELETE',
      'BrokerMaster',
      brokerId,
      broker.status,
      undefined,
      undefined,
      `Deleted broker ${broker.companyName}`
    );

    this.notify();
  }

  public restoreBaselineBrokerMaster() {
    this.assertMarketingSupportForBrokerMaster();

    localStorage.setItem(
      STORAGE_KEYS.BROKERS,
      JSON.stringify(
        BASELINE_BROKERS
      )
    );

    localStorage.setItem(
      STORAGE_KEYS.BROKER_MASTER_VERSION,
      BROKER_MASTER_VERSION
    );

    this.addAuditLog(
      'BROKER_MASTER',
      'RESTORE_BASELINE',
      'BrokerMaster',
      BROKER_MASTER_VERSION,
      undefined,
      'Restored',
      undefined,
      `Restored ${BASELINE_BROKERS.length} broker records from OJK Triwulan III 2025 baseline`
    );

    this.notify();
  }

  // ============================================================
  // AGENT MASTER — Marketing Support
  // ============================================================
  public getAgents(): AgentMaster[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.AGENTS
      ) || '[]'
    );
  }

  private assertMarketingSupportForAgentMaster() {
    const currentUser =
      this.getCurrentUser();

    if (
      currentUser.unit !==
      'Marketing Support'
    ) {
      throw new Error(
        'Master Agent hanya dapat dikelola oleh akun Marketing Support.'
      );
    }
  }

  private getLocalTodayIso(): string {
    const now =
      new Date();

    return [
      now.getFullYear(),
      String(
        now.getMonth() + 1
      ).padStart(2, '0'),
      String(
        now.getDate()
      ).padStart(2, '0'),
    ].join('-');
  }

  private validateAgentExpiryDate(
    licenseExpiryDate: string
  ) {
    if (
      !licenseExpiryDate
    ) {
      throw new Error(
        'Tanggal Masa Berlaku Lisensi wajib diisi.'
      );
    }

    const today =
      this.getLocalTodayIso();

    if (
      licenseExpiryDate <
      today
    ) {
      throw new Error(
        `Tanggal Masa Berlaku Lisensi tidak boleh kurang dari tanggal hari berjalan (${today}).`
      );
    }
  }

  public addAgent(
    agent: AgentMaster
  ) {
    this.assertMarketingSupportForAgentMaster();
    this.validateAgentExpiryDate(
      agent.licenseExpiryDate
    );

    const agents =
      this.getAgents();

    if (
      agents.some(
        item =>
          item.agentCode.trim().toLowerCase() ===
          agent.agentCode.trim().toLowerCase()
      )
    ) {
      throw new Error(
        `Kode Agent "${agent.agentCode}" sudah terdaftar.`
      );
    }

    const currentUser =
      this.getCurrentUser();

    const now =
      new Date().toISOString();

    const created:
      AgentMaster = {
        ...agent,
        createdAt:
          agent.createdAt ||
          now,
        updatedAt:
          now,
        updatedBy:
          currentUser.name,
      };

    agents.push(
      created
    );

    agents.sort(
      (
        first,
        second
      ) =>
        first.agentName.localeCompare(
          second.agentName,
          'id'
        )
    );

    localStorage.setItem(
      STORAGE_KEYS.AGENTS,
      JSON.stringify(
        agents
      )
    );

    this.addAuditLog(
      'AGENT_MASTER',
      'CREATE',
      'AgentMaster',
      created.id,
      undefined,
      created.status,
      undefined,
      `Added agent ${created.agentName}`
    );

    this.notify();
  }

  public updateAgent(
    agent: AgentMaster
  ) {
    this.assertMarketingSupportForAgentMaster();

    const agents =
      this.getAgents();

    const index =
      agents.findIndex(
        item =>
          item.id ===
          agent.id
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Agent tidak ditemukan.'
      );
    }

    const previous =
      agents[index];

    // If expiry is changed, it may never be backdated.
    // Active Agent must always have a current/future expiry date.
    if (
      agent.licenseExpiryDate !==
        previous.licenseExpiryDate ||
      agent.status ===
        'Active'
    ) {
      this.validateAgentExpiryDate(
        agent.licenseExpiryDate
      );
    }

    if (
      agents.some(
        item =>
          item.id !==
            agent.id &&
          item.agentCode.trim().toLowerCase() ===
          agent.agentCode.trim().toLowerCase()
      )
    ) {
      throw new Error(
        `Kode Agent "${agent.agentCode}" sudah terdaftar.`
      );
    }

    const currentUser =
      this.getCurrentUser();

    const updated:
      AgentMaster = {
        ...previous,
        ...agent,
        updatedAt:
          new Date().toISOString(),
        updatedBy:
          currentUser.name,
      };

    agents[index] =
      updated;

    agents.sort(
      (
        first,
        second
      ) =>
        first.agentName.localeCompare(
          second.agentName,
          'id'
        )
    );

    localStorage.setItem(
      STORAGE_KEYS.AGENTS,
      JSON.stringify(
        agents
      )
    );

    this.addAuditLog(
      'AGENT_MASTER',
      'UPDATE',
      'AgentMaster',
      updated.id,
      previous.status,
      updated.status,
      undefined,
      `Updated agent ${updated.agentName}; expiry ${updated.licenseExpiryDate}`
    );

    this.notify();
  }

  public setAgentStatus(
    agentId: string,
    status:
      | 'Active'
      | 'Inactive'
  ) {
    const agent =
      this.getAgents().find(
        item =>
          item.id ===
          agentId
      );

    if (
      !agent
    ) {
      throw new Error(
        'Agent tidak ditemukan.'
      );
    }

    this.updateAgent({
      ...agent,
      status,
    });
  }

  public deleteAgent(
    agentId: string
  ) {
    this.assertMarketingSupportForAgentMaster();

    const agents =
      this.getAgents();

    const agent =
      agents.find(
        item =>
          item.id ===
          agentId
      );

    if (!agent) {
      return;
    }

    localStorage.setItem(
      STORAGE_KEYS.AGENTS,
      JSON.stringify(
        agents.filter(
          item =>
            item.id !==
            agentId
        )
      )
    );

    this.addAuditLog(
      'AGENT_MASTER',
      'DELETE',
      'AgentMaster',
      agentId,
      agent.status,
      undefined,
      undefined,
      `Deleted agent ${agent.agentName}`
    );

    this.notify();
  }

  public getAgentLicenseReminders(
    reminderDays = 14
  ): Array<
    AgentMaster & {
      daysRemaining: number;
      reminderStatus:
        | 'EXPIRED'
        | 'DUE_TODAY'
        | 'DUE_SOON';
    }
  > {
    const now =
      new Date();

    const today =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

    const dayMs =
      24 * 60 * 60 * 1000;

    return this
      .getAgents()
      .filter(
        agent =>
          agent.status ===
            'Active' &&
          Boolean(
            agent.licenseExpiryDate
          )
      )
      .map(
        agent => {
          const [
            year,
            month,
            day,
          ] =
            agent.licenseExpiryDate
              .split('-')
              .map(Number);

          const expiry =
            new Date(
              year,
              month - 1,
              day
            );

          const daysRemaining =
            Math.ceil(
              (
                expiry.getTime() -
                today.getTime()
              ) /
              dayMs
            );

          return {
            ...agent,
            daysRemaining,
            reminderStatus:
              (
                daysRemaining <
                0
                  ? 'EXPIRED'
                  : daysRemaining ===
                    0
                    ? 'DUE_TODAY'
                    : 'DUE_SOON'
              ) as
                | 'EXPIRED'
                | 'DUE_TODAY'
                | 'DUE_SOON',
          };
        }
      )
      .filter(
        agent =>
          agent.daysRemaining <=
          reminderDays
      )
      .sort(
        (
          first,
          second
        ) =>
          first.daysRemaining -
          second.daysRemaining
      );
  }

  public getTargets(): TargetEntry[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TARGETS) || '[]');
  }

  public getTargetBatches(): TargetUploadBatch[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.TARGET_BATCHES) || '[]');
  }

  public publishTargetBatch(batch: TargetUploadBatch, entries: TargetEntry[]) {
    const existing = this.getTargets().filter(t => t.year !== batch.year);
    const updated = [...existing, ...entries];
    localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(updated));

    const batches = this.getTargetBatches();
    batches.unshift(batch);
    localStorage.setItem(STORAGE_KEYS.TARGET_BATCHES, JSON.stringify(batches));

    const currentUser = this.getCurrentUser();
    this.addAuditLog('TARGET', 'PUBLISH_BATCH', 'TargetUploadBatch', batch.id, undefined, 'Published', undefined, `Target RKAP year ${batch.year} published with ${entries.length} records`);
    this.notify();
  }

  // ============================================================
  // BOOKING CASE
  // ============================================================
  public getBookings(): BookingCase[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.BOOKINGS) || '[]');
  }

  public addBooking(booking: BookingCase) {
    const bookings = this.getBookings();
    bookings.unshift(booking);
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));

    this.addAuditLog('BOOKING', 'CREATE', 'BookingCase', booking.id, undefined, 'Submitted', undefined, `Created Booking Case for ${booking.customerName}`);
    
    // Notify operational Marketing Administration queue only.
    const msUsers = this.getUsers().filter(
      user =>
        [
          'USR-000025',
          'USR-000026',
          'USR-000027',
          'USR-000029',
        ].includes(
          user.id
        )
    );
    msUsers.forEach(u => {
      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        recipientUserId: u.id,
        title: 'Booking Case Baru',
        message: `Booking Case baru ${booking.id} (${booking.customerName}) memerlukan verifikasi.`,
        linkPath: '/booking-pipeline?tab=booking',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    this.notify();
  }

  public updateBooking(booking: BookingCase) {
    const bookings = this.getBookings();
    const idx = bookings.findIndex(b => b.id === booking.id);
    if (idx >= 0) {
      bookings[idx] = booking;
      localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
      this.notify();
    }
  }

  public verifyBookingFirstActionWins(
    bookingId: string,
    recommendation: 'VALID' | 'REKOMENDASI TOLAK',
    notes?: string
  ) {
    const currentUser = this.getCurrentUser();

    const isVerifier =
      [
        'USR-000025',
        'USR-000026',
        'USR-000027',
        'USR-000029',
      ].includes(
        currentUser.id
      );

    if (!isVerifier) {
      throw new Error(
        'Verifikasi Booking Case hanya dapat dilakukan oleh Staff/Supervisor Marketing Administration.'
      );
    }

    // Re-read state terbaru saat tombol ditekan.
    // Dalam mode UAT localStorage, ini menjadi mekanisme First Action Wins.
    const bookings: BookingCase[] = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.BOOKINGS) || '[]'
    );

    const idx = bookings.findIndex(
      booking => booking.id === bookingId
    );

    if (idx < 0) {
      throw new Error(`Booking Case ${bookingId} tidak ditemukan.`);
    }

    const latest = bookings[idx];

    if (
      latest.status === 'Approved' ||
      latest.status === 'Rejected'
    ) {
      throw new Error(
        `Booking Case ${bookingId} sudah berstatus ${latest.status}.`
      );
    }

    if (
      latest.verificationRecommendation ||
      latest.verificationFirstActionBy
    ) {
      const actor =
        latest.verificationFirstActionByName ||
        'verifier lain';

      const at =
        latest.verificationFirstActionAt
          ? new Date(
              latest.verificationFirstActionAt
            ).toLocaleString('id-ID')
          : 'waktu sebelumnya';

      throw new Error(
        `First Action Wins: Booking Case ini sudah diproses oleh ${actor} pada ${at}.`
      );
    }

    const now = new Date().toISOString();

    const historyEntry = {
      id:
        'BKH-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 7),
      action:
        recommendation === 'VALID'
          ? 'FIRST_ACTION_VALID'
          : 'FIRST_ACTION_REKOMENDASI_TOLAK',
      recommendation,
      actorUserId:
        currentUser.id,
      actorName:
        currentUser.name,
      actorRole:
        currentUser.role,
      timestamp:
        now,
      notes:
        notes ||
        (
          recommendation === 'VALID'
            ? 'Booking Case dinyatakan VALID oleh verifier pertama.'
            : 'Booking Case direkomendasikan TOLAK oleh verifier pertama.'
        )
    } as const;

    const updated: BookingCase = {
      ...latest,

      // Legacy Claim Lock dinormalisasi keluar dari workflow baru.
      status:
        'Submitted',
      claimedBy:
        undefined,
      claimedByName:
        undefined,
      claimedAt:
        undefined,

      verificationRecommendation:
        recommendation,
      verifierNotes:
        historyEntry.notes,

      verificationFirstActionBy:
        currentUser.id,
      verificationFirstActionByName:
        currentUser.name,
      verificationFirstActionAt:
        now,

      verificationHistory: [
        ...(latest.verificationHistory || []),
        historyEntry
      ]
    };

    bookings[idx] = updated;

    localStorage.setItem(
      STORAGE_KEYS.BOOKINGS,
      JSON.stringify(bookings)
    );

    this.addAuditLog(
      'BOOKING',
      'FIRST_ACTION_WINS',
      'BookingCase',
      bookingId,
      undefined,
      recommendation,
      historyEntry.notes,
      `First Action Wins by ${currentUser.name} (${currentUser.id}) at ${now}`
    );

    const finalApprovers = this.getUsers().filter(
      user =>
        user.id ===
        'USR-000028'
    );

    finalApprovers.forEach(user => {
      this.addNotification({
        id:
          'NOTIF-' +
          Date.now() +
          '-' +
          Math.random()
            .toString(36)
            .slice(2, 6),
        recipientUserId:
          user.id,
        title:
          'Booking Menunggu Final Approval DH Marketing Administration',
        message:
          `${bookingId} (${latest.customerName}) telah diproses oleh ${currentUser.name} dengan rekomendasi ${recommendation}.`,
        linkPath:
          '/booking-pipeline?tab=booking',
        isRead:
          false,
        createdAt:
          now
      });
    });

    this.notify();

    return updated;
  }

  // ============================================================
  // PIPELINE
  // ============================================================
  public getPipelines(): Pipeline[] {
    const pipelines: Pipeline[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.PIPELINES) || '[]');
    
    // Dynamically recalculate Day Lapse
    const now = new Date().getTime();
    return pipelines.map(p => {
      const lastProgress = new Date(p.lastProgressAt).getTime();
      const diffDays = Math.max(0, Math.floor((now - lastProgress) / (1000 * 60 * 60 * 24)));
      return {
        ...p,
        dayLapse: diffDays
      };
    });
  }

  public addPipeline(pipeline: Pipeline) {
    const pipelines = this.getPipelines();
    pipelines.unshift(pipeline);
    localStorage.setItem(STORAGE_KEYS.PIPELINES, JSON.stringify(pipelines));

    this.addAuditLog('PIPELINE', 'CREATE', 'Pipeline', pipeline.id, undefined, pipeline.status, undefined, `Pipeline created from ${pipeline.source}`);
    this.notify();
  }

  public updatePipeline(pipeline: Pipeline, reasonNotes?: string) {
    const pipelines = this.getPipelines();
    const idx = pipelines.findIndex(p => p.id === pipeline.id);
    if (idx >= 0) {
      const old = pipelines[idx];
      
      // Calculate Handler bucket from canonical status
      pipeline.currentHandler = this.deriveCurrentHandler(pipeline.status);
      
      pipelines[idx] = pipeline;
      localStorage.setItem(STORAGE_KEYS.PIPELINES, JSON.stringify(pipelines));

      if (old.status !== pipeline.status) {
        this.addAuditLog('PIPELINE', 'UPDATE_STATUS', 'Pipeline', pipeline.id, old.status, pipeline.status, reasonNotes, `Pipeline status changed to ${pipeline.status}`);
      }

      this.notify();
    }
  }

  public deriveCurrentHandler(status: PipelineCanonicalStatus): CurrentHandlerBucket {
    switch (status) {
      case 'Menunggu Upload Dokumen Marketing':
      case 'Perlu Perbaikan Dokumen Marketing':
      case 'Menunggu Upload Dokumen Closing':
        return 'MARKETING';
      case 'Dokumen Diajukan oleh Marketing':
      case 'On Progress Marketing Support':
      case 'Dokumen Closing Diajukan':
      case 'Dalam Verifikasi Marketing Support':
      case 'Menunggu Final Approval Team Leader Marketing Support':
        return 'MARKETING SUPPORT';
      case 'On Process Teknik':
        return 'TEKNIK';
      case 'Penawaran Telah Terbit':
        return 'MARKETING';
      case 'Menunggu Feedback / Konfirmasi Klien':
      case 'WIN':
      case 'LOSE':
        return 'CLIENT';
      default:
        return 'MARKETING';
    }
  }

  // ============================================================
  // GOVERNED PIPELINE WORKFLOW
  // ============================================================

  private isMarketingActionUser(user: User): boolean {
    return [
      'ADVISOR_MARKETING_DIRECTOR',
      'VP_CAPTIVE_MARKETING',
      'VP_CORPORATE_RETAIL_MARKETING',
      'DEPARTMENT_HEAD_MARKETING',
      'SUPERVISOR_MARKETING',
      'STAFF_MARKETING'
    ].includes(user.role);
  }

  private isMarketingSupportVerifier(user: User): boolean {
    return [
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029',
    ].includes(
      user.id
    );
  }

  private isTeamLeaderMarketingSupport(user: User): boolean {
    // Compatibility name retained internally.
    // Final Booking and WIN/LOSE approval now belongs to
    // RR Endah Wasis Wuwuh Mumpuni — DH Marketing Administration.
    return user.id === 'USR-000028';
  }

  private getPipelineOrThrow(pipelineId: string): Pipeline {
    const pipeline = this.getPipelines().find(p => p.id === pipelineId);

    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} tidak ditemukan.`);
    }

    return pipeline;
  }

  public submitMarketingDocuments(
    pipelineId: string,
    documents: PipelineDocument[]
  ) {
    const currentUser = this.getCurrentUser();
    const pipeline = this.getPipelineOrThrow(pipelineId);

    if (!this.isMarketingActionUser(currentUser)) {
      throw new Error('Hanya user Marketing yang dapat mengunggah dokumen pipeline.');
    }

    if (pipeline.picUserId !== currentUser.id) {
      throw new Error('Dokumen hanya dapat diunggah oleh PIC Marketing pemilik pipeline.');
    }

    if (
      pipeline.status !== 'Menunggu Upload Dokumen Marketing' &&
      pipeline.status !== 'Perlu Perbaikan Dokumen Marketing'
    ) {
      throw new Error('Status pipeline saat ini tidak menerima upload dokumen awal dari Marketing.');
    }

    if (!documents || documents.length === 0) {
      throw new Error('Minimal satu dokumen wajib dipilih.');
    }

    const updated: Pipeline = {
      ...pipeline,
      documents: [
        ...(pipeline.documents || []),
        ...documents
      ],
      status: 'Dokumen Diajukan oleh Marketing',
      currentHandler: 'MARKETING SUPPORT',
      lastProgressAt: new Date().toISOString()
    };

    this.updatePipeline(
      updated,
      `Marketing submitted ${documents.length} document(s) for Marketing Support review`
    );

    const msVerifiers = this.getUsers().filter(
      user => this.isMarketingSupportVerifier(user)
    );

    msVerifiers.forEach(user => {
      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        recipientUserId: user.id,
        title: 'Dokumen Pipeline Diajukan',
        message: `${pipeline.id} (${pipeline.customerName}) telah mengirim dokumen Marketing dan menunggu proses Marketing Support.`,
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });
  }

  public movePipelineByMarketingSupport(
    pipelineId: string,
    nextStatus: PipelineCanonicalStatus,
    reasonNotes?: string
  ) {
    const currentUser = this.getCurrentUser();
    const pipeline = this.getPipelineOrThrow(pipelineId);

    if (!this.isMarketingSupportVerifier(currentUser)) {
      throw new Error(
        'Perubahan tahapan operasional Pipeline hanya dapat dilakukan oleh verifier Marketing Support.'
      );
    }

    const allowedTransitions: Partial<
      Record<PipelineCanonicalStatus, PipelineCanonicalStatus[]>
    > = {
      'Dokumen Diajukan oleh Marketing': [
        'On Progress Marketing Support'
      ],
      'On Progress Marketing Support': [
        'Perlu Perbaikan Dokumen Marketing',
        'On Process Teknik'
      ],
      // Penawaran Telah Terbit tidak boleh dipindahkan hanya dengan klik status.
      // Status tersebut hanya dapat dibuat melalui submitQuotationByMarketingSupport()
      // yang mewajibkan upload file penawaran terlebih dahulu.
      'Dokumen Closing Diajukan': [
        'Dalam Verifikasi Marketing Support'
      ]
    };

    const allowed = allowedTransitions[pipeline.status] || [];

    if (!allowed.includes(nextStatus)) {
      throw new Error(
        `Transisi ${pipeline.status} → ${nextStatus} tidak diperbolehkan untuk Marketing Support.`
      );
    }

    const updated: Pipeline = {
      ...pipeline,
      status: nextStatus,
      currentHandler: this.deriveCurrentHandler(nextStatus),
      lastProgressAt: new Date().toISOString()
    };

    this.updatePipeline(
      updated,
      reasonNotes || `Marketing Support moved pipeline to ${nextStatus}`
    );
  }

  public requestQuotationRevisionByMarketing(
    pipelineId: string,
    revisionNotes: string,
    documents: PipelineDocument[] = []
  ) {
    const currentUser =
      this.getCurrentUser();

    const pipeline =
      this.getPipelineOrThrow(
        pipelineId
      );

    if (
      !this.isMarketingActionUser(
        currentUser
      )
    ) {
      throw new Error(
        'Hanya user Marketing yang dapat meminta revisi penawaran.'
      );
    }

    if (
      pipeline.picUserId !==
      currentUser.id
    ) {
      throw new Error(
        'Revisi penawaran hanya dapat diminta oleh PIC Marketing pemilik pipeline.'
      );
    }

    if (
      pipeline.status !==
      'Menunggu Feedback / Konfirmasi Klien'
    ) {
      throw new Error(
        'Revisi penawaran hanya dapat diminta saat pipeline sedang Menunggu Feedback / Konfirmasi Klien.'
      );
    }

    if (
      !revisionNotes.trim()
    ) {
      throw new Error(
        'Catatan revisi penawaran wajib diisi.'
      );
    }

    if (
      documents.length >
      10
    ) {
      throw new Error(
        'Maksimal 10 lampiran untuk satu permintaan revisi penawaran.'
      );
    }

    const currentQuotationVersion =
      pipeline.quotations?.length ||
      0;

    if (
      currentQuotationVersion <=
      0
    ) {
      throw new Error(
        'Belum ada penawaran sebelumnya yang dapat direvisi.'
      );
    }

    const now =
      new Date().toISOString();

    const targetVersion =
      currentQuotationVersion +
      1;

    const pipelineWithRevision =
      pipeline as
        PipelineWithQuotationRevision;

    const revisionRequest:
      QuotationRevisionRequest = {
      id:
        `QREV-${pipeline.id}-${targetVersion}-${Date.now()}`,
      targetVersion,
      requestedById:
        currentUser.id,
      requestedByName:
        currentUser.name,
      requestedAt:
        now,
      notes:
        revisionNotes.trim(),
      documents:
        documents.map(
          document => ({
            ...document,
            category:
              document.category ||
              `Lampiran Revisi Penawaran V${targetVersion}`,
          })
        ),
    };

    const updated:
      PipelineWithQuotationRevision = {
      ...pipeline,
      quotationRevisionRequestedById:
        currentUser.id,
      quotationRevisionRequestedByName:
        currentUser.name,
      quotationRevisionRequestedAt:
        now,
      quotationRevisionNotes:
        revisionNotes.trim(),
      quotationRevisionTargetVersion:
        targetVersion,
      quotationRevisionDocuments:
        revisionRequest.documents,
      quotationRevisionRequests: [
        ...(
          pipelineWithRevision.quotationRevisionRequests ||
          []
        ),
        revisionRequest,
      ],
      status:
        'On Process Teknik',
      currentHandler:
        'TEKNIK',
      lastProgressAt:
        now,
    };

    this.updatePipeline(
      updated,
      `PIC Marketing requested quotation revision for v${targetVersion} with ${documents.length} attachment(s): ${revisionNotes.trim()}`
    );

    const msVerifiers =
      this.getUsers().filter(
        user =>
          this.isMarketingSupportVerifier(
            user
          )
      );

    msVerifiers.forEach(
      user => {
        this.addNotification({
          id:
            'NOTIF-' +
            Date.now() +
            '-' +
            Math.random()
              .toString(36)
              .substr(2, 5),
          recipientUserId:
            user.id,
          title:
            `Permintaan Revisi Penawaran v${targetVersion}`,
          message:
            `${pipeline.id} (${pipeline.customerName}) meminta revisi penawaran dari ${currentUser.name} dengan ${documents.length} lampiran. Catatan: ${revisionNotes.trim()}`,
          linkPath:
            '/booking-pipeline?tab=pipeline',
          isRead:
            false,
          createdAt:
            now,
        });
      }
    );
  }

  public submitQuotationByMarketingSupport(
    pipelineId: string,
    quotation: {
      id: string;
      fileName: string;
      fileSize: number;
      mimeType?: string;
      amount: number;
      notes?: string;
    }
  ) {
    const currentUser =
      this.getCurrentUser();

    const pipeline =
      this.getPipelineOrThrow(
        pipelineId
      );

    if (
      !this.isMarketingSupportVerifier(
        currentUser
      )
    ) {
      throw new Error(
        'Hanya verifier Marketing Support yang dapat menerbitkan penawaran.'
      );
    }

    if (
      pipeline.status !==
      'On Process Teknik'
    ) {
      throw new Error(
        'Penawaran hanya dapat diterbitkan saat status pipeline On Process Teknik.'
      );
    }

    if (
      !quotation.fileName ||
      quotation.fileSize <= 0
    ) {
      throw new Error(
        'File penawaran wajib diunggah sebelum status Penawaran Telah Terbit.'
      );
    }

    if (
      !quotation.amount ||
      quotation.amount <= 0
    ) {
      throw new Error(
        'Nilai penawaran harus lebih besar dari 0.'
      );
    }

    const now =
      new Date().toISOString();

    const quotationDate =
      this.getLocalTodayIso();

    const previousQuotations =
      pipeline.quotations || [];

    const version =
      previousQuotations.length + 1;

    const nextQuotation = {
      id:
        quotation.id,
      version,
      quotationDate,
      amount:
        quotation.amount,
      fileName:
        quotation.fileName,
      fileSize:
        quotation.fileSize,
      mimeType:
        quotation.mimeType,
      notes:
        quotation.notes,
      uploadedBy:
        currentUser.name,
      uploadedAt:
        now,
    };

    const updated:
      Pipeline = {
        ...pipeline,
        quotations: [
          ...previousQuotations,
          nextQuotation,
        ],
        currentCommercialValue:
          quotation.amount,
        status:
          'Penawaran Telah Terbit',
        currentHandler:
          'MARKETING',
        lastProgressAt:
          now,
      };

    this.updatePipeline(
      updated,
      `Marketing Support uploaded quotation v${version}: ${quotation.fileName}`
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .substr(2, 5),
      recipientUserId:
        pipeline.picUserId,
      title:
        'Penawaran Telah Terbit',
      message:
        `${pipeline.id} (${pipeline.customerName}) memiliki Penawaran v${version}. Download lampiran penawaran dan sampaikan ke klien.`,
      linkPath:
        '/booking-pipeline?tab=pipeline',
      isRead:
        false,
      createdAt:
        now,
    });
  }

  public confirmQuotationDeliveredByMarketing(
    pipelineId: string
  ) {
    const currentUser =
      this.getCurrentUser();

    const pipeline =
      this.getPipelineOrThrow(
        pipelineId
      );

    if (
      !this.isMarketingActionUser(
        currentUser
      )
    ) {
      throw new Error(
        'Hanya user Marketing yang dapat menandai penawaran sudah disampaikan ke klien.'
      );
    }

    if (
      pipeline.picUserId !==
      currentUser.id
    ) {
      throw new Error(
        'Hanya PIC Marketing pemilik pipeline yang dapat menandai penawaran sudah disampaikan.'
      );
    }

    if (
      pipeline.status !==
      'Penawaran Telah Terbit'
    ) {
      throw new Error(
        'Status pipeline saat ini belum siap untuk konfirmasi penyampaian penawaran.'
      );
    }

    if (
      !pipeline.quotations ||
      pipeline.quotations.length === 0
    ) {
      throw new Error(
        'Lampiran penawaran belum tersedia.'
      );
    }

    const updated:
      Pipeline = {
        ...pipeline,
        status:
          'Menunggu Feedback / Konfirmasi Klien',
        currentHandler:
          'CLIENT',
        lastProgressAt:
          new Date().toISOString(),
      };

    this.updatePipeline(
      updated,
      'PIC Marketing confirmed quotation has been delivered to client'
    );
  }

  public submitPipelineOutcome(
    pipelineId: string,
    outcome: 'WIN' | 'LOSE',
    options?: {
      winningAmount?: number;
      loseReason?: LoseReason;
      loseNotes?: string;
      notes?: string;
      documents?: PipelineDocument[];
    }
  ) {
    const currentUser = this.getCurrentUser();
    const pipeline = this.getPipelineOrThrow(pipelineId);

    if (!this.isMarketingActionUser(currentUser)) {
      throw new Error('Hanya user Marketing yang dapat mengajukan WIN / LOSE.');
    }

    if (pipeline.picUserId !== currentUser.id) {
      throw new Error('WIN / LOSE hanya dapat diajukan oleh PIC Marketing pemilik pipeline.');
    }

    const allowedStatuses: PipelineCanonicalStatus[] = [
      'Penawaran Telah Terbit',
      'Menunggu Feedback / Konfirmasi Klien',
      'Menunggu Upload Dokumen Closing'
    ];

    if (!allowedStatuses.includes(pipeline.status)) {
      throw new Error(
        'WIN / LOSE baru dapat diajukan setelah penawaran terbit atau saat menunggu feedback/closing.'
      );
    }

    if (
      pipeline.outcomeWorkflowStatus === 'PENDING_MS_VERIFICATION' ||
      pipeline.outcomeWorkflowStatus === 'PENDING_TLMS_APPROVAL'
    ) {
      throw new Error('Pipeline ini sudah memiliki usulan outcome yang sedang diproses.');
    }

    if (
      !options?.documents ||
      options.documents.length ===
        0
    ) {
      throw new Error(
        `Minimal satu dokumen pendukung wajib diunggah untuk usulan ${outcome}.`
      );
    }

    if (
      options.documents.length >
      10
    ) {
      throw new Error(
        'Maksimal 10 dokumen pendukung untuk satu usulan WIN/LOSE.'
      );
    }

    if (outcome === 'LOSE') {
      if (!options?.loseReason) {
        throw new Error('Alasan LOSE wajib dipilih.');
      }

      if (!options?.loseNotes?.trim()) {
        throw new Error('Catatan evaluasi LOSE wajib diisi.');
      }
    }

    const now = new Date().toISOString();

    const updated:
      PipelineWithOutcomeDocuments = {
      ...pipeline,
      status: 'Dalam Verifikasi Marketing Support',
      currentHandler: 'MARKETING SUPPORT',
      lastProgressAt: now,

      outcomeRequest: outcome,
      outcomeWorkflowStatus: 'PENDING_MS_VERIFICATION',
      outcomePreviousStatus: pipeline.status,

      outcomeSubmittedBy: currentUser.id,
      outcomeSubmittedByName: currentUser.name,
      outcomeSubmittedAt: now,
      outcomeSubmissionNotes: options?.notes,

      outcomeWinningAmount:
        outcome === 'WIN'
          ? Number(options?.winningAmount || pipeline.currentCommercialValue)
          : undefined,

      outcomeLoseReason:
        outcome === 'LOSE'
          ? options?.loseReason
          : undefined,

      outcomeLoseNotes:
        outcome === 'LOSE'
          ? options?.loseNotes?.trim()
          : undefined,

      outcomeDocuments:
        options.documents.map(
          document => ({
            ...document,
            category:
              document.category ||
              `Dokumen Usulan ${outcome}`,
          })
        ),

      outcomeVerifiedBy: undefined,
      outcomeVerifiedByName: undefined,
      outcomeVerifiedAt: undefined,
      outcomeVerificationNotes: undefined,

      outcomeFinalDecision: undefined,
      outcomeFinalDecisionBy: undefined,
      outcomeFinalDecisionByName: undefined,
      outcomeFinalDecisionAt: undefined,
      outcomeFinalDecisionNotes: undefined
    };

    this.updatePipeline(
      updated,
      `${outcome} submitted by Marketing with ${options.documents.length} supporting document(s) for Marketing Support verification`
    );

    const msVerifiers = this.getUsers().filter(
      user => this.isMarketingSupportVerifier(user)
    );

    msVerifiers.forEach(user => {
      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        recipientUserId: user.id,
        title: `Usulan ${outcome} Menunggu Verifikasi`,
        message: `${pipeline.id} (${pipeline.customerName}) diajukan ${outcome} oleh ${currentUser.name} dengan ${options.documents.length} dokumen pendukung untuk direview.`,
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: now
      });
    });
  }

  public verifyPipelineOutcome(
    pipelineId: string,
    approved: boolean,
    notes?: string
  ) {
    const currentUser = this.getCurrentUser();
    const pipeline = this.getPipelineOrThrow(pipelineId);

    if (!this.isMarketingSupportVerifier(currentUser)) {
      throw new Error('Verifikasi outcome hanya dapat dilakukan oleh verifier Marketing Support.');
    }

    if (
      pipeline.status !== 'Dalam Verifikasi Marketing Support' ||
      !pipeline.outcomeRequest ||
      pipeline.outcomeWorkflowStatus !== 'PENDING_MS_VERIFICATION'
    ) {
      throw new Error('Pipeline ini tidak sedang menunggu verifikasi outcome Marketing Support.');
    }

    const now = new Date().toISOString();

    if (!approved) {
      const returnStatus =
        pipeline.outcomePreviousStatus ||
        'Menunggu Feedback / Konfirmasi Klien';

      const rejected: Pipeline = {
        ...pipeline,
        status: returnStatus,
        currentHandler: this.deriveCurrentHandler(returnStatus),
        lastProgressAt: now,

        outcomeWorkflowStatus: 'REJECTED',
        outcomeVerifiedBy: currentUser.id,
        outcomeVerifiedByName: currentUser.name,
        outcomeVerifiedAt: now,
        outcomeVerificationNotes:
          notes || 'Usulan outcome dikembalikan oleh Marketing Support.',
        outcomeFinalDecision: undefined,
        outcomeFinalDecisionBy: undefined,
        outcomeFinalDecisionByName: undefined,
        outcomeFinalDecisionAt: undefined,
        outcomeFinalDecisionNotes: undefined
      };

      this.updatePipeline(
        rejected,
        `${pipeline.outcomeRequest} request rejected by Marketing Support verifier`
      );

      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        recipientUserId: pipeline.picUserId,
        title: `Usulan ${pipeline.outcomeRequest} Dikembalikan`,
        message: `${pipeline.id} dikembalikan oleh Marketing Support untuk ditindaklanjuti kembali.`,
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: now
      });

      return;
    }

    const verified: Pipeline = {
      ...pipeline,
      status: 'Menunggu Final Approval Team Leader Marketing Support',
      currentHandler: 'MARKETING SUPPORT',
      lastProgressAt: now,

      outcomeWorkflowStatus: 'PENDING_TLMS_APPROVAL',
      outcomeVerifiedBy: currentUser.id,
      outcomeVerifiedByName: currentUser.name,
      outcomeVerifiedAt: now,
      outcomeVerificationNotes:
        notes || 'Outcome telah diverifikasi Marketing Support.'
    };

    this.updatePipeline(
      verified,
      `${pipeline.outcomeRequest} verified by Marketing Support and submitted to TLMS`
    );

    const tlmsUsers = this.getUsers().filter(
      user => this.isTeamLeaderMarketingSupport(user)
    );

    tlmsUsers.forEach(user => {
      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        recipientUserId: user.id,
        title: `Final Approval ${pipeline.outcomeRequest}`,
        message: `${pipeline.id} (${pipeline.customerName}) telah diverifikasi dan menunggu final approval DH Marketing Administration.`,
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: now
      });
    });
  }

  public finalizePipelineOutcome(
    pipelineId: string,
    approved: boolean,
    notes?: string
  ) {
    const currentUser = this.getCurrentUser();
    const pipeline = this.getPipelineOrThrow(pipelineId);

    if (!this.isTeamLeaderMarketingSupport(currentUser)) {
      throw new Error(
        'Final approval WIN / LOSE hanya dapat dilakukan oleh Department Head Marketing Administration.'
      );
    }

    if (
      pipeline.status !== 'Menunggu Final Approval Team Leader Marketing Support' ||
      !pipeline.outcomeRequest ||
      pipeline.outcomeWorkflowStatus !== 'PENDING_TLMS_APPROVAL'
    ) {
      throw new Error('Pipeline ini tidak sedang menunggu final approval outcome.');
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    if (!approved) {
      const returnStatus =
        pipeline.outcomePreviousStatus ||
        'Menunggu Feedback / Konfirmasi Klien';

      const rejected: Pipeline = {
        ...pipeline,
        status: returnStatus,
        currentHandler: this.deriveCurrentHandler(returnStatus),
        lastProgressAt: now,

        outcomeWorkflowStatus: 'REJECTED',
        outcomeFinalDecision: 'REJECTED',
        outcomeFinalDecisionBy: currentUser.id,
        outcomeFinalDecisionByName: currentUser.name,
        outcomeFinalDecisionAt: now,
        outcomeFinalDecisionNotes:
          notes || 'Final outcome ditolak oleh Department Head Marketing Administration.'
      };

      this.updatePipeline(
        rejected,
        `${pipeline.outcomeRequest} final approval rejected by TL Marketing Support`
      );

      this.addNotification({
        id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        recipientUserId: pipeline.picUserId,
        title: `Final ${pipeline.outcomeRequest} Ditolak`,
        message: `${pipeline.id} dikembalikan ke status sebelumnya oleh Department Head Marketing Administration.`,
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: now
      });

      return;
    }

    let finalized: Pipeline;

    if (pipeline.outcomeRequest === 'WIN') {
      finalized = {
        ...pipeline,
        status: 'WIN',
        currentHandler: 'CLIENT',
        lastProgressAt: now,

        actualClosingDate: pipeline.actualClosingDate || today,
        winDate: today,
        winningQuotationAmount:
          Number(
            pipeline.outcomeWinningAmount ||
            pipeline.currentCommercialValue
          ),
        winApprovedBy: currentUser.name,
        winApprovedAt: now,

        outcomeWorkflowStatus: 'APPROVED',
        outcomeFinalDecision: 'APPROVED',
        outcomeFinalDecisionBy: currentUser.id,
        outcomeFinalDecisionByName: currentUser.name,
        outcomeFinalDecisionAt: now,
        outcomeFinalDecisionNotes:
          notes || 'WIN disetujui final oleh Department Head Marketing Administration.'
      };
    } else {
      const previousStatus =
        pipeline.outcomePreviousStatus ||
        'Menunggu Feedback / Konfirmasi Klien';

      finalized = {
        ...pipeline,
        status: 'LOSE',
        currentHandler: 'CLIENT',
        lastProgressAt: now,

        loseDate: today,
        loseReason:
          pipeline.outcomeLoseReason ||
          'Premi terlalu mahal / kalah price',
        loseEvaluationNotes:
          pipeline.outcomeLoseNotes ||
          'LOSE disetujui final oleh Department Head Marketing Administration.',
        loseLastStage: previousStatus,
        loseLastHandler:
          this.deriveCurrentHandler(previousStatus),

        outcomeWorkflowStatus: 'APPROVED',
        outcomeFinalDecision: 'APPROVED',
        outcomeFinalDecisionBy: currentUser.id,
        outcomeFinalDecisionByName: currentUser.name,
        outcomeFinalDecisionAt: now,
        outcomeFinalDecisionNotes:
          notes || 'LOSE disetujui final oleh Department Head Marketing Administration.'
      };
    }

    this.updatePipeline(
      finalized,
      `${pipeline.outcomeRequest} finalized by Department Head Marketing Administration`
    );

    this.addNotification({
      id: 'NOTIF-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      recipientUserId: pipeline.picUserId,
      title: `${pipeline.outcomeRequest} Final Disetujui`,
      message: `${pipeline.id} (${pipeline.customerName}) resmi berstatus ${pipeline.outcomeRequest}.`,
      linkPath: '/booking-pipeline?tab=pipeline',
      isRead: false,
      createdAt: now
    });
  }

  // ============================================================
  // APPEALS
  // ============================================================
  public getAppeals(): Appeal[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.APPEALS) || '[]');
  }

  public addAppeal(appeal: Appeal) {
    const appeals = this.getAppeals();
    appeals.unshift(appeal);
    localStorage.setItem(STORAGE_KEYS.APPEALS, JSON.stringify(appeals));

    this.addAuditLog('APPEAL', 'SUBMIT', 'Appeal', appeal.id, undefined, 'Pending', undefined, `Appeal submitted for Pipeline ${appeal.pipelineId}`);
    this.notify();
  }

  public updateAppeal(appeal: Appeal) {
    const appeals = this.getAppeals();
    const idx = appeals.findIndex(a => a.id === appeal.id);
    if (idx >= 0) {
      appeals[idx] = appeal;
      localStorage.setItem(STORAGE_KEYS.APPEALS, JSON.stringify(appeals));
      this.notify();
    }
  }

  // ============================================================
  // PRODUCTION
  // ============================================================
  public getProductions(): ProductionTransaction[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTIONS) || '[]');
  }

  public addProduction(production: ProductionTransaction) {
    const productions = this.getProductions();
    productions.unshift(production);
    localStorage.setItem(STORAGE_KEYS.PRODUCTIONS, JSON.stringify(productions));

    this.addAuditLog('PRODUCTION', 'CREATE_INVOICE', 'ProductionTransaction', production.id, undefined, production.status, undefined, `Recorded invoice ${production.coreInvoiceNumber} for amount ${production.invoiceAmount}`);
    this.notify();
  }

  public updateProduction(production: ProductionTransaction) {
    const productions = this.getProductions();
    const idx = productions.findIndex(p => p.id === production.id);
    if (idx >= 0) {
      productions[idx] = production;
      localStorage.setItem(STORAGE_KEYS.PRODUCTIONS, JSON.stringify(productions));
      this.notify();
    }
  }

  // ============================================================
  // OFFICIAL PRODUCTION ACTUAL — CSV SNAPSHOT
  // Source of truth untuk dashboard realisasi produksi.
  // Disimpan dalam bentuk agregat agar UAT localStorage tetap aman
  // untuk source file puluhan ribu baris.
  // ============================================================
  public getOfficialProductionSummaries(): OfficialProductionSummary[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.OFFICIAL_PRODUCTION_SUMMARIES
      ) || '[]'
    );
  }

  public getOfficialProductionBatches(): OfficialProductionBatch[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.OFFICIAL_PRODUCTION_BATCHES
      ) || '[]'
    );
  }

  public getOfficialPolicyDirectory(): OfficialPolicyRecord[] {
    const stored:
      OfficialPolicyRecord[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.OFFICIAL_POLICY_DIRECTORY
        ) || '[]'
      );

    if (
      stored.length >
      0
    ) {
      return stored;
    }

    // UAT fallback:
    // Build one dummy policy per aggregated official production row
    // so Existing Client lookup remains testable before real policy
    // numbers are re-uploaded.
    return this
      .getOfficialProductionSummaries()
      .map(
        (
          summary,
          index
        ) => ({
          id:
            `POL-DUMMY-${summary.id}`,
          policyNumber:
            `DUMMY-POL-${summary.productionYear}${String(
              summary.productionMonth
            ).padStart(
              2,
              '0'
            )}-${String(
              index + 1
            ).padStart(
              5,
              '0'
            )}`,
          customerName:
            `Existing Client Dummy - ${summary.productName}`,
          productName:
            summary.productName,
          marketingFunction:
            summary.marketingFunction,
          department:
            summary.department,
          businessType:
            summary.businessType,
          picName:
            summary.picName,
          picUserId:
            summary.picUserId,
          productionYear:
            summary.productionYear,
          productionMonth:
            summary.productionMonth,
          lastProductionAmount:
            summary.productionAmount,
          sourceBatchId:
            summary.batchId,
          updatedAt:
            new Date().toISOString(),
          isDummyPolicyNumber:
            true,
        })
      );
  }

  public publishOfficialProductionSnapshot(
    batch: OfficialProductionBatch,
    records: OfficialProductionImportRecord[]
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      currentUser.id !==
      'USR-000024'
    ) {
      throw new Error(
        'Publish Realisasi Produksi hanya dapat dilakukan oleh Arianie Fajarwati.'
      );
    }

    if (
      !records ||
      records.length === 0
    ) {
      throw new Error(
        'Tidak ada baris valid yang dapat dipublish.'
      );
    }

    const periodKeys =
      Array.from(
        new Set(
          records.map(
            record =>
              `${record.productionYear}-${String(
                record.productionMonth
              ).padStart(2, '0')}`
          )
        )
      );

    const periodKeySet =
      new Set(
        periodKeys
      );

    const existing =
      this.getOfficialProductionSummaries();

    const retained =
      existing.filter(
        summary =>
          !periodKeySet.has(
            `${summary.productionYear}-${String(
              summary.productionMonth
            ).padStart(2, '0')}`
          )
      );

    const aggregation =
      new Map<
        string,
        {
          productionYear: number;
          productionMonth: number;
          marketingFunction:
            | 'Captive Marketing'
            | 'Corporate & Retail Marketing';
          unit:
            | 'Captive Marketing'
            | 'Corporate & Retail Marketing';
          department: string;
          businessType:
            | 'New Business'
            | 'Renewal Business';
          productName: string;
          picName: string;
          picUserId?: string;
          productionAmount: number;
          transactionCount: number;
          adjustmentCount: number;
        }
      >();

    records.forEach(
      record => {
        const key =
          JSON.stringify([
            record.productionYear,
            record.productionMonth,
            record.marketingFunction,
            record.department ||
              'Unassigned / Data Historis',
            record.businessType,
            record.productName,
            record.picUserId ||
              '',
            record.picName
          ]);

        const previous =
          aggregation.get(
            key
          );

        if (
          previous
        ) {
          previous.productionAmount +=
            Number(
              record.productionAmount ||
              0
            );

          previous.transactionCount +=
            1;

          if (
            Number(
              record.productionAmount ||
              0
            ) < 0
          ) {
            previous.adjustmentCount +=
              1;
          }

          return;
        }

        aggregation.set(
          key,
          {
            productionYear:
              record.productionYear,
            productionMonth:
              record.productionMonth,
            marketingFunction:
              record.marketingFunction,
            unit:
              record.marketingFunction,
            department:
              record.department ||
              'Unassigned / Data Historis',
            businessType:
              record.businessType,
            productName:
              record.productName,
            picName:
              record.picName,
            picUserId:
              record.picUserId,
            productionAmount:
              Number(
                record.productionAmount ||
                0
              ),
            transactionCount:
              1,
            adjustmentCount:
              Number(
                record.productionAmount ||
                0
              ) < 0
                ? 1
                : 0
          }
        );
      }
    );

    const nextSummaries:
      OfficialProductionSummary[] =
      Array.from(
        aggregation.values()
      ).map(
        (
          item,
          index
        ) => ({
          id:
            `OPS-${batch.id}-${String(
              index + 1
            ).padStart(5, '0')}`,
          batchId:
            batch.id,
          ...item
        })
      );

    localStorage.setItem(
      STORAGE_KEYS.OFFICIAL_PRODUCTION_SUMMARIES,
      JSON.stringify([
        ...nextSummaries,
        ...retained
      ])
    );

    const existingPolicies =
      this.getOfficialPolicyDirectory();

    const policyMap =
      new Map<
        string,
        OfficialPolicyRecord
      >();

    existingPolicies.forEach(
      policy => {
        // Do not carry fallback dummy policies once real/upload-derived
        // policy rows are available.
        if (
          !policy.isDummyPolicyNumber
        ) {
          policyMap.set(
            policy.policyNumber
              .trim()
              .toUpperCase(),
            policy
          );
        }
      }
    );

    records.forEach(
      (
        record,
        index
      ) => {
        const policyNumber =
          String(
            record.policyNumber ||
            ''
          ).trim();

        if (
          !policyNumber
        ) {
          return;
        }

        const normalized =
          policyNumber.toUpperCase();

        const candidate:
          OfficialPolicyRecord = {
          id:
            `POL-${batch.id}-${String(
              index + 1
            ).padStart(
              6,
              '0'
            )}`,
          policyNumber,
          customerName:
            record.customerName ||
            `Existing Client - ${policyNumber}`,
          productName:
            record.productName,
          marketingFunction:
            record.marketingFunction,
          department:
            record.department ||
            'Unassigned / Data Historis',
          businessType:
            record.businessType,
          picName:
            record.picName,
          picUserId:
            record.picUserId,
          productionYear:
            record.productionYear,
          productionMonth:
            record.productionMonth,
          lastProductionAmount:
            Number(
              record.productionAmount ||
              0
            ),
          sourceBatchId:
            batch.id,
          updatedAt:
            batch.uploadedAt,
          isDummyPolicyNumber:
            policyNumber.startsWith(
              'DUMMY-POL-'
            ),
        };

        const previous =
          policyMap.get(
            normalized
          );

        if (
          !previous ||
          candidate.productionYear >
            previous.productionYear ||
          (
            candidate.productionYear ===
              previous.productionYear &&
            candidate.productionMonth >=
              previous.productionMonth
          )
        ) {
          policyMap.set(
            normalized,
            candidate
          );
        }
      }
    );

    localStorage.setItem(
      STORAGE_KEYS.OFFICIAL_POLICY_DIRECTORY,
      JSON.stringify(
        Array.from(
          policyMap.values()
        ).sort(
          (
            first,
            second
          ) =>
            first.policyNumber.localeCompare(
              second.policyNumber,
              'id'
            )
        )
      )
    );

    const existingBatches =
      this.getOfficialProductionBatches();

    localStorage.setItem(
      STORAGE_KEYS.OFFICIAL_PRODUCTION_BATCHES,
      JSON.stringify([
        batch,
        ...existingBatches
      ])
    );

    this.addAuditLog(
      'PRODUCTION',
      'PUBLISH_OFFICIAL_SNAPSHOT',
      'OfficialProductionBatch',
      batch.id,
      undefined,
      'Published',
      undefined,
      `Published official production snapshot for ${periodKeys.join(
        ', '
      )}; ${records.length} valid source rows; total ${batch.totalProductionAmount}`
    );

    this.notify();
  }

  public getParticipants(): ParticipantAddition[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
  }

  public addParticipant(part: ParticipantAddition) {
    const parts = this.getParticipants();
    parts.unshift(part);
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(parts));
    this.notify();
  }

  public getHistorical(): HistoricalProduction[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORICAL) || '[]');
  }

  public addHistoricalBatch(records: HistoricalProduction[]) {
    const hist = this.getHistorical();
    const updated = [...records, ...hist];
    localStorage.setItem(STORAGE_KEYS.HISTORICAL, JSON.stringify(updated));
    this.addAuditLog('HISTORICAL', 'UPLOAD_BATCH', 'HistoricalProduction', records[0]?.batchId || 'BATCH', undefined, 'Published', undefined, `Uploaded ${records.length} historical production records`);
    this.notify();
  }

  // ============================================================
  // ACTIVITIES & REIMBURSEMENTS
  // ============================================================
  public getActivities(): Activity[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES) || '[]');
  }

  public addActivity(activity: Activity) {
    const activities = this.getActivities();
    activities.unshift(activity);
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));

    this.addAuditLog('ACTIVITY', 'CREATE', 'Activity', activity.id, undefined, activity.status, undefined, `Created activity with ${activity.companyName}`);
    this.notify();
  }

  public updateActivity(activity: Activity) {
    const activities = this.getActivities();
    const idx = activities.findIndex(a => a.id === activity.id);
    if (idx >= 0) {
      activities[idx] = activity;
      localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
      this.notify();
    }
  }

  public getActivityComments(): ActivityComment[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITY_COMMENTS) || '[]');
  }

  public addActivityComment(comment: ActivityComment) {
    const comments = this.getActivityComments();
    comments.push(comment);
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_COMMENTS, JSON.stringify(comments));
    this.notify();
  }

  public getReimbursements(): Reimbursement[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.REIMBURSEMENTS
      ) || '[]'
    );
  }

  private isMarketingAdministrationReimbursementVerifier(
    user:
      User
  ): boolean {
    return [
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029',
    ].includes(
      user.id
    );
  }

  private notifyReimbursementUser(
    recipientUserId:
      string,
    reimbursement:
      Reimbursement,
    title:
      string,
    message:
      string
  ) {
    this.addNotification({
      id:
        `NOTIF-RMB-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
      recipientUserId,
      title,
      message,
      linkPath:
        `/aktivitas?tab=reimbursement&rmbId=${encodeURIComponent(
          reimbursement.id
        )}`,
      isRead:
        false,
      createdAt:
        new Date().toISOString(),
    });
  }

  public submitReimbursement(
    reimbursement:
      Reimbursement
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      reimbursement.userId !==
      currentUser.id
    ) {
      throw new Error(
        'Pengajuan reimbursement hanya dapat disubmit oleh pemilik aktivitas.'
      );
    }

    const activity =
      this.getActivities().find(
        item =>
          item.id ===
          reimbursement.activityId
      );

    if (
      !activity ||
      activity.ownerUserId !==
        currentUser.id
    ) {
      throw new Error(
        'Aktivitas yang dipilih tidak valid atau bukan milik user login.'
      );
    }

    const normalizedAmount =
      Number(
        reimbursement.amount
      );

    if (
      !Number.isFinite(
        normalizedAmount
      ) ||
      normalizedAmount <=
        0
    ) {
      throw new Error(
        'Nominal reimbursement harus lebih dari 0.'
      );
    }

    if (
      !reimbursement.receiptFileId ||
      !reimbursement.receiptFileName
    ) {
      throw new Error(
        'Bukti / receipt wajib di-upload.'
      );
    }

    const existingActive =
      this.getReimbursements().some(
        item =>
          item.activityId ===
            reimbursement.activityId &&
          item.status !==
            'Rejected'
      );

    if (
      existingActive
    ) {
      throw new Error(
        'Aktivitas ini sudah memiliki pengajuan reimbursement aktif.'
      );
    }

    const users =
      this.getUsers();

    const directSuperior =
      currentUser.superiorId
        ? users.find(
            user =>
              user.id ===
              currentUser.superiorId
          )
        : undefined;

    const now =
      new Date().toISOString();

    const next:
      Reimbursement = {
      ...reimbursement,
      amount:
        normalizedAmount,
      directSuperiorId:
        directSuperior?.id,
      directSuperiorName:
        directSuperior?.name,
      status:
        directSuperior
          ? 'Submitted'
          : 'Approved Superior',
      superiorApprovedBy:
        directSuperior
          ? undefined
          : 'SYSTEM-AUTO',
      superiorApprovedByName:
        directSuperior
          ? undefined
          : 'Auto Skip — No Direct Superior',
      superiorApprovedAt:
        directSuperior
          ? undefined
          : now,
      superiorDecisionNotes:
        directSuperior
          ? undefined
          : 'Direct superior tidak tersedia pada User Master; workflow otomatis diteruskan ke Marketing Administration.',
      createdAt:
        reimbursement.createdAt ||
        now,
      updatedAt:
        now,
    };

    const rmbs =
      this.getReimbursements();

    rmbs.unshift(
      next
    );

    localStorage.setItem(
      STORAGE_KEYS.REIMBURSEMENTS,
      JSON.stringify(
        rmbs
      )
    );

    this.addAuditLog(
      'REIMBURSEMENT',
      'SUBMIT',
      'Reimbursement',
      next.id,
      undefined,
      next.status,
      undefined,
      `Submit reimbursement Rp${normalizedAmount} untuk aktivitas ${next.activityId}`
    );

    if (
      directSuperior
    ) {
      this.notifyReimbursementUser(
        directSuperior.id,
        next,
        'Approval Reimbursement',
        `${next.id} dari ${currentUser.name} menunggu approval atasan langsung.`
      );
    } else {
      this.getUsers()
        .filter(
          user =>
            this.isMarketingAdministrationReimbursementVerifier(
              user
            )
        )
        .forEach(
          user =>
            this.notifyReimbursementUser(
              user.id,
              next,
              'Verifikasi Reimbursement',
              `${next.id} menunggu verifikasi Marketing Administration.`
            )
        );
    }

    this.notify();
  }

  // Backward-compatible method name used by older UAT code.
  public addReimbursement(
    reimbursement:
      Reimbursement
  ) {
    this.submitReimbursement(
      reimbursement
    );
  }

  public decideReimbursementBySuperior(
    reimbursementId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    const rmbs =
      this.getReimbursements();

    const index =
      rmbs.findIndex(
        item =>
          item.id ===
          reimbursementId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Reimbursement tidak ditemukan.'
      );
    }

    const reimbursement =
      rmbs[
        index
      ];

    if (
      reimbursement.status !==
      'Submitted'
    ) {
      throw new Error(
        'Reimbursement ini tidak lagi menunggu approval atasan langsung.'
      );
    }

    if (
      reimbursement.directSuperiorId !==
      currentUser.id
    ) {
      throw new Error(
        'Approval ini hanya dapat dilakukan oleh atasan langsung submitter.'
      );
    }

    const now =
      new Date().toISOString();

    rmbs[
      index
    ] = {
      ...reimbursement,
      status:
        approved
          ? 'Approved Superior'
          : 'Rejected',
      superiorApprovedBy:
        currentUser.id,
      superiorApprovedByName:
        currentUser.name,
      superiorApprovedAt:
        now,
      superiorDecisionNotes:
        notes?.trim() ||
        undefined,
      rejectionStage:
        approved
          ? undefined
          : 'DIRECT_SUPERIOR',
      rejectionReason:
        approved
          ? undefined
          : (
              notes?.trim() ||
              'Ditolak oleh atasan langsung.'
            ),
      updatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.REIMBURSEMENTS,
      JSON.stringify(
        rmbs
      )
    );

    this.addAuditLog(
      'REIMBURSEMENT',
      approved
        ? 'APPROVE_SUPERIOR'
        : 'REJECT_SUPERIOR',
      'Reimbursement',
      reimbursement.id,
      reimbursement.status,
      approved
        ? 'Approved Superior'
        : 'Rejected',
      notes,
      `${currentUser.name} sebagai atasan langsung`
    );

    if (
      approved
    ) {
      this.getUsers()
        .filter(
          user =>
            this.isMarketingAdministrationReimbursementVerifier(
              user
            )
        )
        .forEach(
          user =>
            this.notifyReimbursementUser(
              user.id,
              reimbursement,
              'Verifikasi Reimbursement',
              `${reimbursement.id} telah disetujui atasan langsung dan menunggu verifikasi Marketing Administration.`
            )
        );
    } else {
      this.notifyReimbursementUser(
        reimbursement.userId,
        reimbursement,
        'Reimbursement Ditolak',
        `${reimbursement.id} ditolak oleh atasan langsung.${notes ? ` Catatan: ${notes}` : ''}`
      );
    }

    this.notify();
  }

  public verifyReimbursementByMarketingAdministration(
    reimbursementId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isMarketingAdministrationReimbursementVerifier(
        currentUser
      )
    ) {
      throw new Error(
        'Verifikasi reimbursement hanya dapat dilakukan oleh Supervisor/Staff Marketing Administration.'
      );
    }

    const rmbs =
      this.getReimbursements();

    const index =
      rmbs.findIndex(
        item =>
          item.id ===
          reimbursementId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Reimbursement tidak ditemukan.'
      );
    }

    const reimbursement =
      rmbs[
        index
      ];

    if (
      reimbursement.status !==
      'Approved Superior'
    ) {
      throw new Error(
        'Reimbursement ini tidak lagi tersedia pada antrean verifikasi Marketing Administration.'
      );
    }

    const now =
      new Date().toISOString();

    rmbs[
      index
    ] = {
      ...reimbursement,
      status:
        approved
          ? 'Verified Marketing Administration'
          : 'Rejected',
      marketingAdminVerifiedBy:
        currentUser.id,
      marketingAdminVerifiedByName:
        currentUser.name,
      marketingAdminVerifiedAt:
        now,
      marketingAdminVerificationNotes:
        notes?.trim() ||
        undefined,
      // Compatibility fields:
      msVerifiedBy:
        currentUser.name,
      msVerifiedAt:
        now,
      rejectionStage:
        approved
          ? undefined
          : 'MARKETING_ADMINISTRATION',
      rejectionReason:
        approved
          ? undefined
          : (
              notes?.trim() ||
              'Ditolak oleh Marketing Administration.'
            ),
      updatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.REIMBURSEMENTS,
      JSON.stringify(
        rmbs
      )
    );

    this.addAuditLog(
      'REIMBURSEMENT',
      approved
        ? 'VERIFY_MARKETING_ADMINISTRATION'
        : 'REJECT_MARKETING_ADMINISTRATION',
      'Reimbursement',
      reimbursement.id,
      reimbursement.status,
      approved
        ? 'Verified Marketing Administration'
        : 'Rejected',
      notes,
      `${currentUser.name} • First Action Wins Marketing Administration`
    );

    if (
      approved
    ) {
      this.notifyReimbursementUser(
        'USR-000028',
        reimbursement,
        'Final Approval Reimbursement',
        `${reimbursement.id} telah diverifikasi Marketing Administration dan menunggu final approval Department Head Marketing Administration.`
      );
    } else {
      this.notifyReimbursementUser(
        reimbursement.userId,
        reimbursement,
        'Reimbursement Ditolak',
        `${reimbursement.id} ditolak pada verifikasi Marketing Administration.${notes ? ` Catatan: ${notes}` : ''}`
      );
    }

    this.notify();
  }

  public finalizeReimbursementByEndah(
    reimbursementId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.canActAsMarketingAdministrationHead(
        currentUser.id
      )
    ) {
      throw new Error(
        'Final approval reimbursement hanya dapat dilakukan oleh Department Head Marketing Administration atau Team Leader Marketing Support saat acting delegation aktif.'
      );
    }

    const rmbs =
      this.getReimbursements();

    const index =
      rmbs.findIndex(
        item =>
          item.id ===
          reimbursementId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Reimbursement tidak ditemukan.'
      );
    }

    const reimbursement =
      rmbs[
        index
      ];

    const validStatus =
      reimbursement.status ===
        'Verified Marketing Administration' ||
      reimbursement.status ===
        'Verified MS';

    if (
      !validStatus
    ) {
      throw new Error(
        'Reimbursement ini tidak sedang menunggu final approval Department Head Marketing Administration.'
      );
    }

    const now =
      new Date().toISOString();

    rmbs[
      index
    ] = {
      ...reimbursement,
      status:
        approved
          ? 'Approved for Payment'
          : 'Rejected',
      finalApprovedBy:
        currentUser.id,
      finalApprovedByName:
        currentUser.name,
      finalApprovedAt:
        now,
      finalApprovalNotes:
        notes?.trim() ||
        undefined,
      // Compatibility fields:
      tlApprovedBy:
        currentUser.name,
      tlApprovedAt:
        now,
      rejectionStage:
        approved
          ? undefined
          : 'DH_MARKETING_ADMINISTRATION',
      rejectionReason:
        approved
          ? undefined
          : (
              notes?.trim() ||
              'Ditolak oleh Department Head Marketing Administration.'
            ),
      updatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.REIMBURSEMENTS,
      JSON.stringify(
        rmbs
      )
    );

    this.addAuditLog(
      'REIMBURSEMENT',
      approved
        ? 'FINAL_APPROVE_FOR_PAYMENT'
        : 'FINAL_REJECT',
      'Reimbursement',
      reimbursement.id,
      reimbursement.status,
      approved
        ? 'Approved for Payment'
        : 'Rejected',
      notes,
      'Final decision Department Head Marketing Administration'
    );

    this.notifyReimbursementUser(
      reimbursement.userId,
      reimbursement,
      approved
        ? 'Reimbursement Approved for Payment'
        : 'Reimbursement Ditolak Final',
      approved
        ? `${reimbursement.id} telah final approved dan siap diproses pembayaran di luar Dashboard Marketing.`
        : `${reimbursement.id} ditolak final oleh Department Head Marketing Administration.${notes ? ` Catatan: ${notes}` : ''}`
    );

    this.notify();
  }

  public updateReimbursement(
    reimbursement:
      Reimbursement
  ) {
    const rmbs =
      this.getReimbursements();

    const index =
      rmbs.findIndex(
        item =>
          item.id ===
          reimbursement.id
      );

    if (
      index >=
      0
    ) {
      rmbs[
        index
      ] =
        reimbursement;

      localStorage.setItem(
        STORAGE_KEYS.REIMBURSEMENTS,
        JSON.stringify(
          rmbs
        )
      );

      this.notify();
    }
  }

  // ============================================================
  // ACTING APPROVER DELEGATION
  // DH Marketing Administration / DH Marketing Communication
  // may delegate final authority to Team Leader Marketing Support
  // (Arianie Fajarwati) during leave.
  // ============================================================
  public getApproverDelegations(): ActingApproverDelegation[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.APPROVER_DELEGATIONS
      ) || '[]'
    );
  }

  private delegationAreaForUserId(
    userId: string
  ): ActingApproverArea | null {
    if (userId === 'USR-000028') {
      return 'MARKETING_ADMINISTRATION';
    }

    if (userId === 'USR-000030') {
      return 'MARKETING_COMMUNICATION';
    }

    return null;
  }

  public getActiveApproverDelegation(
    area: ActingApproverArea,
    at: Date = new Date()
  ): ActingApproverDelegation | undefined {
    const dateKey = at
      .toLocaleDateString('en-CA');

    return this
      .getApproverDelegations()
      .find(
        delegation =>
          delegation.area === area &&
          delegation.status === 'ACTIVE' &&
          delegation.startDate <= dateKey &&
          delegation.endDate >= dateKey
      );
  }

  public canActForApprover(
    delegatorUserId: string,
    userId: string = this.getCurrentUser().id
  ): boolean {
    if (userId === delegatorUserId) {
      return true;
    }

    if (userId !== 'USR-000024') {
      return false;
    }

    const area =
      this.delegationAreaForUserId(
        delegatorUserId
      );

    if (!area) {
      return false;
    }

    const active =
      this.getActiveApproverDelegation(
        area
      );

    return Boolean(
      active &&
      active.delegatorUserId ===
        delegatorUserId
    );
  }

  public canActAsMarketingAdministrationHead(
    userId: string = this.getCurrentUser().id
  ): boolean {
    return this.canActForApprover(
      'USR-000028',
      userId
    );
  }

  public canActAsMarketingCommunicationHead(
    userId: string = this.getCurrentUser().id
  ): boolean {
    return this.canActForApprover(
      'USR-000030',
      userId
    );
  }

  public getEffectiveApproverUserId(
    delegatorUserId: 'USR-000028' | 'USR-000030'
  ): string {
    return this.canActForApprover(
      delegatorUserId,
      'USR-000024'
    )
      ? 'USR-000024'
      : delegatorUserId;
  }

  public saveApproverDelegation(
    input: {
      area: ActingApproverArea;
      startDate: string;
      endDate: string;
      reason: string;
    }
  ) {
    const currentUser =
      this.getCurrentUser();

    const delegatorUserId =
      input.area ===
        'MARKETING_ADMINISTRATION'
        ? 'USR-000028'
        : 'USR-000030';

    if (
      currentUser.id !==
        delegatorUserId &&
      currentUser.id !==
        'USR-000024'
    ) {
      throw new Error(
        'Delegasi hanya dapat diatur oleh Department Head terkait atau Team Leader Marketing Support.'
      );
    }

    if (
      !input.startDate ||
      !input.endDate ||
      input.endDate < input.startDate
    ) {
      throw new Error(
        'Periode delegasi tidak valid.'
      );
    }

    if (!input.reason.trim()) {
      throw new Error(
        'Alasan delegasi wajib diisi.'
      );
    }

    const delegator =
      this.getUsers().find(
        user =>
          user.id ===
          delegatorUserId
      );

    if (!delegator) {
      throw new Error(
        'Department Head delegator tidak ditemukan.'
      );
    }

    const now =
      new Date().toISOString();

    const delegations =
      this.getApproverDelegations()
      .map(
        delegation =>
          delegation.area === input.area &&
          delegation.status === 'ACTIVE'
            ? {
                ...delegation,
                status: 'INACTIVE' as const,
                deactivatedAt: now,
                deactivatedByUserId:
                  currentUser.id,
                deactivatedByName:
                  currentUser.name,
              }
            : delegation
      );

    const next: ActingApproverDelegation = {
      id:
        `DLG-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
      area: input.area,
      delegatorUserId,
      delegatorName:
        delegator.name,
      delegateUserId:
        'USR-000024',
      delegateName:
        'Arianie Fajarwati',
      startDate:
        input.startDate,
      endDate:
        input.endDate,
      reason:
        input.reason.trim(),
      status:
        'ACTIVE',
      createdAt:
        now,
      createdByUserId:
        currentUser.id,
      createdByName:
        currentUser.name,
    };

    delegations.unshift(next);

    localStorage.setItem(
      STORAGE_KEYS.APPROVER_DELEGATIONS,
      JSON.stringify(delegations)
    );

    this.addAuditLog(
      'APPROVER_DELEGATION',
      'ACTIVATE',
      'ActingApproverDelegation',
      next.id,
      delegator.name,
      'Arianie Fajarwati',
      next.reason,
      `${input.area} • ${input.startDate} s.d. ${input.endDate}`
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        'USR-000024',
      title:
        'Acting Approver Aktif',
      message:
        `${delegator.name} mendelegasikan kewenangan approval kepada Arianie Fajarwati untuk periode ${input.startDate} s.d. ${input.endDate}.`,
      linkPath:
        '/',
      isRead:
        false,
      createdAt:
        now,
    });

    this.notify();
  }

  public deactivateApproverDelegation(
    delegationId: string
  ) {
    const currentUser =
      this.getCurrentUser();

    const delegations =
      this.getApproverDelegations();

    const index =
      delegations.findIndex(
        item =>
          item.id ===
          delegationId
      );

    if (index < 0) {
      throw new Error(
        'Delegasi tidak ditemukan.'
      );
    }

    const delegation =
      delegations[index];

    if (
      currentUser.id !==
        delegation.delegatorUserId &&
      currentUser.id !==
        'USR-000024'
    ) {
      throw new Error(
        'Delegasi hanya dapat dihentikan oleh Department Head terkait atau Team Leader Marketing Support.'
      );
    }

    const now =
      new Date().toISOString();

    delegations[index] = {
      ...delegation,
      status:
        'INACTIVE',
      deactivatedAt:
        now,
      deactivatedByUserId:
        currentUser.id,
      deactivatedByName:
        currentUser.name,
    };

    localStorage.setItem(
      STORAGE_KEYS.APPROVER_DELEGATIONS,
      JSON.stringify(delegations)
    );

    this.addAuditLog(
      'APPROVER_DELEGATION',
      'DEACTIVATE',
      'ActingApproverDelegation',
      delegation.id,
      'ACTIVE',
      'INACTIVE',
      undefined,
      `${delegation.area} • dihentikan oleh ${currentUser.name}`
    );

    this.notify();
  }

  // ============================================================
  // MARKETING SUPPORT SERVICE DOCUMENTS
  // ============================================================
  public getServiceDocuments(): ManagedServiceDocument[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.SERVICE_DOCUMENTS
      ) || '[]'
    );
  }

  private isMarketingAdministrationOperator(
    user:
      User
  ): boolean {
    return [
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029',
    ].includes(
      user.id
    );
  }

  private isEndahMarketingAdministrationHead(
    user:
      User
  ): boolean {
    return this.canActAsMarketingAdministrationHead(
      user.id
    );
  }

  private isAndiMarcommHead(
    user:
      User
  ): boolean {
    return this.canActAsMarketingCommunicationHead(
      user.id
    );
  }

  private isKarinaMarcommOperator(
    user:
      User
  ): boolean {
    return user.id ===
      'USR-000031';
  }

  public saveServiceDocument(
    document:
      ManagedServiceDocument
  ) {
    const currentUser =
      this.getCurrentUser();

    const canUpload =
      (
        document.ownerArea ===
          'MARKETING_ADMINISTRATION' &&
        this.isMarketingAdministrationOperator(
          currentUser
        )
      ) ||
      (
        document.ownerArea ===
          'MARKETING_COMMUNICATION' &&
        this.isKarinaMarcommOperator(
          currentUser
        )
      );

    if (
      !canUpload
    ) {
      throw new Error(
        'User ini tidak memiliki kewenangan upload dokumen pada service owner tersebut.'
      );
    }

    const docs =
      this.getServiceDocuments();

    const index =
      docs.findIndex(
        item =>
          item.id ===
          document.id
      );

    const next:
      ManagedServiceDocument = {
      ...document,
      status:
        'PENDING_APPROVAL',
      uploadedByUserId:
        currentUser.id,
      uploadedByName:
        currentUser.name,
      uploadedAt:
        document.uploadedAt ||
        new Date().toISOString(),
    };

    if (
      index >=
      0
    ) {
      docs[
        index
      ] =
        next;
    } else {
      docs.unshift(
        next
      );
    }

    localStorage.setItem(
      STORAGE_KEYS.SERVICE_DOCUMENTS,
      JSON.stringify(
        docs
      )
    );

    const approverId =
      document.ownerArea ===
        'MARKETING_ADMINISTRATION'
        ? this.getEffectiveApproverUserId(
            'USR-000028'
          )
        : this.getEffectiveApproverUserId(
            'USR-000030'
          );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        approverId,
      title:
        'Dokumen Menunggu Approval',
      message:
        `${document.title} ${document.versionLabel} di-upload oleh ${currentUser.name} dan menunggu approval.`,
      linkPath:
        document.ownerArea ===
          'MARKETING_ADMINISTRATION'
          ? '/dokumen-pendukung?area=administration'
          : '/dokumen-pendukung?area=marketing-tools',
      isRead:
        false,
      createdAt:
        new Date().toISOString(),
    });

    this.addAuditLog(
      'SERVICE_DOCUMENT',
      'UPLOAD_PENDING_APPROVAL',
      'ManagedServiceDocument',
      document.id,
      undefined,
      'PENDING_APPROVAL',
      document.ownerArea,
      `${document.category} | ${document.fileName}`
    );

    this.notify();
  }

  public approveServiceDocument(
    documentId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    const docs =
      this.getServiceDocuments();

    const index =
      docs.findIndex(
        item =>
          item.id ===
          documentId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Dokumen tidak ditemukan.'
      );
    }

    const document =
      docs[
        index
      ];

    const canApprove =
      (
        document.ownerArea ===
          'MARKETING_ADMINISTRATION' &&
        this.isEndahMarketingAdministrationHead(
          currentUser
        )
      ) ||
      (
        document.ownerArea ===
          'MARKETING_COMMUNICATION' &&
        this.isAndiMarcommHead(
          currentUser
        )
      );

    if (
      !canApprove
    ) {
      throw new Error(
        'User ini bukan approver dokumen untuk service owner tersebut.'
      );
    }

    const now =
      new Date().toISOString();

    if (
      approved
    ) {
      // Only the latest approved version stays published in the
      // direct-download catalog for the same category + product.
      docs.forEach(
        (
          item,
          itemIndex
        ) => {
          if (
            itemIndex !==
              index &&
            item.ownerArea ===
              document.ownerArea &&
            item.category ===
              document.category &&
            (
              item.productName ||
              ''
            ) ===
              (
                document.productName ||
                ''
              ) &&
            item.status ===
              'PUBLISHED'
          ) {
            docs[
              itemIndex
            ] = {
              ...item,
              status:
                'INACTIVE',
            };
          }
        }
      );
    }

    docs[
      index
    ] = {
      ...document,
      status:
        approved
          ? 'PUBLISHED'
          : 'REJECTED',
      approvedByUserId:
        currentUser.id,
      approvedByName:
        currentUser.name,
      approvedAt:
        now,
      approvalNotes:
        notes?.trim() ||
        undefined,
    };

    localStorage.setItem(
      STORAGE_KEYS.SERVICE_DOCUMENTS,
      JSON.stringify(
        docs
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        document.uploadedByUserId,
      title:
        approved
          ? 'Dokumen Disetujui & Dipublikasikan'
          : 'Dokumen Ditolak',
      message:
        `${document.title} ${document.versionLabel} ${approved ? 'telah dipublikasikan' : 'ditolak'} oleh ${currentUser.name}.`,
      linkPath:
        document.ownerArea ===
          'MARKETING_ADMINISTRATION'
          ? '/dokumen-pendukung?area=administration'
          : '/dokumen-pendukung?area=marketing-tools',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'SERVICE_DOCUMENT',
      approved
        ? 'APPROVE_PUBLISH'
        : 'REJECT',
      'ManagedServiceDocument',
      document.id,
      document.status,
      approved
        ? 'PUBLISHED'
        : 'REJECTED',
      notes,
      `${currentUser.name} final decision`
    );

    this.notify();
  }

  public deactivateServiceDocument(
    documentId:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    const docs =
      this.getServiceDocuments();

    const index =
      docs.findIndex(
        item =>
          item.id ===
          documentId
      );

    if (
      index <
      0
    ) {
      return;
    }

    const document =
      docs[
        index
      ];

    const canDeactivate =
      this.isEndahMarketingAdministrationHead(
        currentUser
      ) ||
      this.isAndiMarcommHead(
        currentUser
      );

    if (
      !canDeactivate
    ) {
      throw new Error(
        'Hanya Department Head pemilik layanan yang dapat menonaktifkan dokumen.'
      );
    }

    docs[
      index
    ] = {
      ...document,
      status:
        'INACTIVE',
    };

    localStorage.setItem(
      STORAGE_KEYS.SERVICE_DOCUMENTS,
      JSON.stringify(
        docs
      )
    );

    this.addAuditLog(
      'SERVICE_DOCUMENT',
      'DEACTIVATE',
      'ManagedServiceDocument',
      document.id,
      document.status,
      'INACTIVE',
      undefined,
      `${currentUser.name} menonaktifkan dokumen ${document.versionLabel}.`
    );

    this.notify();
  }

  // ============================================================
  // MARCOMM SERVICE DESK
  // ============================================================
  public getMarcommStockTransactions(): MarcommStockTransaction[] {
    const records:
      MarcommStockTransaction[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.MARCOMM_STOCK_TRANSACTIONS
        ) || '[]'
      );

    // Hampers is no longer stock-controlled. Legacy Hampers stock
    // records are intentionally excluded from the active stock ledger.
    return records.filter(
      record =>
        record.stockCategory ===
        'SOUVENIR'
    );
  }

  public getMarcommStockOpnames(): MarcommStockOpname[] {
    const records:
      MarcommStockOpname[] =
      JSON.parse(
        localStorage.getItem(
          STORAGE_KEYS.MARCOMM_STOCK_OPNAMES
        ) || '[]'
      );

    return records.filter(
      record =>
        record.stockCategory ===
        'SOUVENIR'
    );
  }

  public getMarcommStockSnapshot(
    stockCategory:
      MarcommStockCategory,
    giftTier:
      MarcommStockTier,
    excludeRequestId?:
      string
  ): MarcommStockSnapshot {
    const transactions =
      this.getMarcommStockTransactions()
        .filter(
          transaction =>
            transaction.stockCategory ===
              stockCategory &&
            transaction.giftTier ===
              giftTier
        );

    const onHand =
      transactions.reduce(
        (
          total,
          transaction
        ) => {
          if (
            transaction.transactionType ===
            'STOCK_IN'
          ) {
            return (
              total +
              Math.abs(
                Number(
                  transaction.quantity ||
                  0
                )
              )
            );
          }

          if (
            transaction.transactionType ===
            'STOCK_OUT'
          ) {
            return (
              total -
              Math.abs(
                Number(
                  transaction.quantity ||
                  0
                )
              )
            );
          }

          return (
            total +
            Number(
              transaction.quantity ||
              0
            )
          );
        },
        0
      );

    const reservableStatuses:
      MarcommRequest['status'][] = [
        'APPROVED_WAITING_KARINA',
        'IN_PROGRESS',
        'PENDING_ANDI_FINAL_REVIEW',
      ];

    const reserved =
      this.getMarcommRequests()
        .filter(
          request =>
            request.id !==
              excludeRequestId &&
            request.requestType ===
              stockCategory &&
            request.approvedGiftTier ===
              giftTier &&
            reservableStatuses.includes(
              request.status
            )
        )
        .reduce(
          (
            total,
            request
          ) =>
            total +
            Math.max(
              0,
              Number(
                request.approvedQuantity ||
                0
              )
            ),
          0
        );

    const latestApprovedOpname =
      this.getMarcommStockOpnames()
        .filter(
          opname =>
            opname.stockCategory ===
              stockCategory &&
            opname.giftTier ===
              giftTier &&
            opname.status ===
              'APPROVED'
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              second.decidedAt ||
              second.submittedAt
            ).getTime() -
            new Date(
              first.decidedAt ||
              first.submittedAt
            ).getTime()
        )[0];

    return {
      stockCategory,
      giftTier,
      onHand,
      reserved,
      available:
        Math.max(
          0,
          onHand -
          reserved
        ),
      lastOpnameAt:
        latestApprovedOpname?.decidedAt ||
        latestApprovedOpname?.submittedAt,
      lastOpnamePhysical:
        latestApprovedOpname?.physicalQuantity,
    };
  }

  private appendMarcommStockTransaction(
    transaction:
      MarcommStockTransaction
  ) {
    const transactions =
      this.getMarcommStockTransactions();

    transactions.unshift(
      transaction
    );

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_STOCK_TRANSACTIONS,
      JSON.stringify(
        transactions
      )
    );
  }

  public recordMarcommStockIn(
    stockCategory:
      MarcommStockCategory,
    giftTier:
      MarcommStockTier,
    quantity:
      number,
    notes?:
      string,
    attachment?:
      MarcommRequestDocument
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isKarinaMarcommOperator(
        currentUser
      )
    ) {
      throw new Error(
        'Stock masuk hanya dapat dicatat oleh Karina Malik.'
      );
    }

    if (
      stockCategory !==
      'SOUVENIR'
    ) {
      throw new Error(
        'Stock hanya dikelola untuk Souvenir. Hampers Hari Raya tidak menggunakan stock opname.'
      );
    }

    const normalizedQuantity =
      Number(
        quantity
      );

    if (
      !Number.isFinite(
        normalizedQuantity
      ) ||
      normalizedQuantity <=
        0
    ) {
      throw new Error(
        'Jumlah stock masuk harus lebih dari 0.'
      );
    }

    const now =
      new Date().toISOString();

    const transaction:
      MarcommStockTransaction = {
      id:
        `MCSTK-IN-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
      stockCategory,
      giftTier,
      transactionType:
        'STOCK_IN',
      quantity:
        normalizedQuantity,
      notes:
        notes?.trim() ||
        undefined,
      attachment,
      createdAt:
        now,
      createdByUserId:
        currentUser.id,
      createdByName:
        currentUser.name,
    };

    this.appendMarcommStockTransaction(
      transaction
    );

    this.addAuditLog(
      'MARCOMM_STOCK',
      'STOCK_IN',
      'MarcommStockTransaction',
      transaction.id,
      undefined,
      `+${normalizedQuantity}`,
      `${stockCategory} ${giftTier}`,
      notes
    );

    this.notify();
  }

  public submitMarcommStockOpname(
    stockCategory:
      MarcommStockCategory,
    giftTier:
      MarcommStockTier,
    physicalQuantity:
      number,
    notes?:
      string,
    attachment?:
      MarcommRequestDocument
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isKarinaMarcommOperator(
        currentUser
      )
    ) {
      throw new Error(
        'Stock opname hanya dapat disubmit oleh Karina Malik.'
      );
    }

    if (
      stockCategory !==
      'SOUVENIR'
    ) {
      throw new Error(
        'Stock opname hanya berlaku untuk Souvenir.'
      );
    }

    const normalizedPhysical =
      Number(
        physicalQuantity
      );

    if (
      !Number.isFinite(
        normalizedPhysical
      ) ||
      normalizedPhysical <
        0
    ) {
      throw new Error(
        'Stock fisik harus 0 atau lebih.'
      );
    }

    const snapshot =
      this.getMarcommStockSnapshot(
        stockCategory,
        giftTier
      );

    const now =
      new Date().toISOString();

    const opname:
      MarcommStockOpname = {
      id:
        `MCOP-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
      stockCategory,
      giftTier,
      systemOnHandAtSubmission:
        snapshot.onHand,
      physicalQuantity:
        normalizedPhysical,
      differenceAtSubmission:
        normalizedPhysical -
        snapshot.onHand,
      notes:
        notes?.trim() ||
        undefined,
      attachment,
      submittedAt:
        now,
      submittedByUserId:
        currentUser.id,
      submittedByName:
        currentUser.name,
      status:
        'PENDING_ANDI_APPROVAL',
    };

    const opnames =
      this.getMarcommStockOpnames();

    opnames.unshift(
      opname
    );

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_STOCK_OPNAMES,
      JSON.stringify(
        opnames
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        this.getEffectiveApproverUserId(
          'USR-000030'
        ),
      title:
        'Stock Opname Menunggu Approval',
      message:
        `${stockCategory} ${giftTier}: sistem ${snapshot.onHand}, fisik ${normalizedPhysical}, selisih ${normalizedPhysical - snapshot.onHand}.`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'MARCOMM_STOCK',
      'SUBMIT_STOCK_OPNAME',
      'MarcommStockOpname',
      opname.id,
      String(
        snapshot.onHand
      ),
      String(
        normalizedPhysical
      ),
      `${stockCategory} ${giftTier}`,
      notes
    );

    this.notify();
  }

  public decideMarcommStockOpname(
    opnameId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isAndiMarcommHead(
        currentUser
      )
    ) {
      throw new Error(
        'Adjustment stock opname hanya dapat disetujui oleh Department Head Marketing Communication.'
      );
    }

    const opnames =
      this.getMarcommStockOpnames();

    const index =
      opnames.findIndex(
        opname =>
          opname.id ===
          opnameId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Stock opname tidak ditemukan.'
      );
    }

    const opname =
      opnames[
        index
      ];

    if (
      opname.status !==
      'PENDING_ANDI_APPROVAL'
    ) {
      throw new Error(
        'Stock opname ini sudah diputuskan.'
      );
    }

    const now =
      new Date().toISOString();

    const currentSnapshot =
      this.getMarcommStockSnapshot(
        opname.stockCategory,
        opname.giftTier
      );

    const liveAdjustment =
      opname.physicalQuantity -
      currentSnapshot.onHand;

    if (
      approved &&
      liveAdjustment !==
        0
    ) {
      this.appendMarcommStockTransaction({
        id:
          `MCSTK-ADJ-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
        stockCategory:
          opname.stockCategory,
        giftTier:
          opname.giftTier,
        transactionType:
          'ADJUSTMENT',
        quantity:
          liveAdjustment,
        notes:
          `Stock opname ${opname.id}${notes ? ` • ${notes.trim()}` : ''}`,
        attachment:
          opname.attachment,
        createdAt:
          now,
        createdByUserId:
          currentUser.id,
        createdByName:
          currentUser.name,
      });
    }

    opnames[
      index
    ] = {
      ...opname,
      status:
        approved
          ? 'APPROVED'
          : 'REJECTED',
      decidedAt:
        now,
      decidedByUserId:
        currentUser.id,
      decidedByName:
        currentUser.name,
      decisionNotes:
        notes?.trim() ||
        undefined,
      approvedAdjustment:
        approved
          ? liveAdjustment
          : undefined,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_STOCK_OPNAMES,
      JSON.stringify(
        opnames
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        opname.submittedByUserId,
      title:
        approved
          ? 'Stock Opname Disetujui'
          : 'Stock Opname Ditolak',
      message:
        approved
          ? `${opname.stockCategory} ${opname.giftTier} disesuaikan ke stock fisik ${opname.physicalQuantity}. Adjustment ${liveAdjustment >= 0 ? '+' : ''}${liveAdjustment}.`
          : `${opname.stockCategory} ${opname.giftTier} ditolak Department Head Marketing Communication.`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'MARCOMM_STOCK',
      approved
        ? 'APPROVE_STOCK_OPNAME'
        : 'REJECT_STOCK_OPNAME',
      'MarcommStockOpname',
      opname.id,
      String(
        currentSnapshot.onHand
      ),
      approved
        ? String(
            opname.physicalQuantity
          )
        : 'REJECTED',
      `${opname.stockCategory} ${opname.giftTier}`,
      notes
    );

    this.notify();
  }

  public getMarcommRequests(): MarcommRequest[] {
    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEYS.MARCOMM_REQUESTS
      ) || '[]'
    );
  }

  public createMarcommRequest(
    request:
      MarcommRequest
  ) {
    const currentUser =
      this.getCurrentUser();

    const minimumNeedDate =
      getMinimumMarcommNeedDateKey();

    if (
      !isValidMarcommNeedDate(
        request.needDate
      )
    ) {
      throw new Error(
        `Tanggal dibutuhkan minimal 3 hari kerja dari tanggal sistem. Tanggal paling awal ${formatDateKeyId(
          minimumNeedDate
        )}. Hari kerja Senin-Jumat dan hari pengajuan tidak dihitung.`
      );
    }

    if (
      !this.isMarketingActionUser(
        currentUser
      )
    ) {
      throw new Error(
        'Permintaan Marcomm hanya dapat dibuat oleh user Marketing.'
      );
    }

    if (
      request.requesterUserId !==
      currentUser.id
    ) {
      throw new Error(
        'Requester harus sama dengan user login.'
      );
    }

    const requests =
      this.getMarcommRequests();

    requests.unshift({
      ...request,
      status:
        'PENDING_ANDI_APPROVAL',
      lastUpdatedAt:
        new Date().toISOString(),
    });

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        this.getEffectiveApproverUserId(
          'USR-000030'
        ),
      title:
        'Request Marcomm Baru',
      message:
        `${request.id} dari ${currentUser.name} menunggu approval awal Department Head Marketing Communication.`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        new Date().toISOString(),
    });

    this.addAuditLog(
      'MARCOMM',
      'CREATE_REQUEST',
      'MarcommRequest',
      request.id,
      undefined,
      'PENDING_ANDI_APPROVAL',
      request.requestType,
      request.brief
    );

    this.notify();
  }

  public decideMarcommRequestByAndi(
    requestId:
      string,
    approved:
      boolean,
    notes?:
      string,
    operationalAdjustment?: {
      quantity?: number;
      giftTier?:
        | 'VIP'
        | 'REGULER';
    }
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isAndiMarcommHead(
        currentUser
      )
    ) {
      throw new Error(
        'Approval awal request Marcomm hanya dapat dilakukan oleh Department Head Marketing Communication.'
      );
    }

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    const now =
      new Date().toISOString();

    const isRevision =
      request.status ===
      'REVISION_REQUESTED_PENDING_ANDI';

    const isGiftAuthorityRequest =
      request.requestType ===
        'SOUVENIR' ||
      request.requestType ===
        'HAMPERS_HARI_RAYA';

    const approvedQuantity =
      isGiftAuthorityRequest &&
      approved
        ? Number(
            operationalAdjustment?.quantity ??
            request.approvedQuantity ??
            request.quantity ??
            0
          )
        : request.approvedQuantity;

    const approvedGiftTier =
      isGiftAuthorityRequest &&
      approved
        ? (
            operationalAdjustment?.giftTier ||
            request.approvedGiftTier ||
            request.giftTier
          )
        : request.approvedGiftTier;

    if (
      isGiftAuthorityRequest &&
      approved
    ) {
      if (
        !Number.isFinite(
          approvedQuantity
        ) ||
        approvedQuantity <=
          0
      ) {
        throw new Error(
          'Jumlah final Souvenir/Hampers harus lebih dari 0.'
        );
      }

      if (
        approvedGiftTier !==
          'VIP' &&
        approvedGiftTier !==
          'REGULER'
      ) {
        throw new Error(
          'Jenis final Souvenir/Hampers wajib VIP atau Reguler.'
        );
      }

      if (
        request.requestType ===
        'SOUVENIR'
      ) {
        const stockSnapshot =
          this.getMarcommStockSnapshot(
            'SOUVENIR',
            approvedGiftTier
          );

        if (
          approvedQuantity >
          stockSnapshot.available
        ) {
          throw new Error(
            `Stock Souvenir ${approvedGiftTier} tidak mencukupi. Available saat ini ${stockSnapshot.available}. Ubah jumlah final atau jenis sebelum approve.`
          );
        }
      }
    }

    requests[
      index
    ] = {
      ...request,
      status:
        approved
          ? 'APPROVED_WAITING_KARINA'
          : isRevision
            ? 'PUBLISHED_WAITING_MARKETING'
            : 'REJECTED_BY_ANDI',
      andiDecision:
        approved
          ? 'APPROVED'
          : 'REJECTED',
      andiDecisionAt:
        now,
      andiDecisionNotes:
        notes?.trim() ||
        undefined,
      approvedQuantity:
        isGiftAuthorityRequest &&
        approved
          ? approvedQuantity
          : request.approvedQuantity,
      approvedGiftTier:
        isGiftAuthorityRequest &&
        approved
          ? approvedGiftTier
          : request.approvedGiftTier,
      andiOperationalAdjustmentAt:
        isGiftAuthorityRequest &&
        approved
          ? now
          : request.andiOperationalAdjustmentAt,
      assignedToUserId:
        approved
          ? 'USR-000031'
          : request.assignedToUserId,
      assignedToName:
        approved
          ? 'Karina Malik'
          : request.assignedToName,
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        approved
          ? 'USR-000031'
          : request.requesterUserId,
      title:
        approved
          ? 'Request Marcomm Disetujui'
          : 'Request Marcomm Ditolak',
      message:
        approved
          ? isGiftAuthorityRequest
            ? `${request.id} disetujui Department Head Marketing Communication. Eksekusi final: ${approvedGiftTier} • Qty ${approvedQuantity}. Keputusan jumlah/jenis bersifat final dan dapat mulai dikerjakan Karina.`
            : `${request.id} disetujui Department Head Marketing Communication dan dapat mulai dikerjakan Karina.`
          : `${request.id} ditolak Department Head Marketing Communication.${notes ? ` Catatan: ${notes}` : ''}`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    if (
      isGiftAuthorityRequest &&
      approved
    ) {
      this.addAuditLog(
        'MARCOMM',
        'FINALIZE_GIFT_AUTHORITY',
        'MarcommRequest',
        request.id,
        `Requested: ${request.giftTier || '-'} • Qty ${request.quantity || 0}`,
        `Approved: ${approvedGiftTier} • Qty ${approvedQuantity}`,
        notes,
        'Final authority by Department Head Marketing Communication; Marketing cannot appeal.'
      );
    }

    this.addAuditLog(
      'MARCOMM',
      approved
        ? isRevision
          ? 'APPROVE_REVISION_REQUEST'
          : 'APPROVE_INITIAL'
        : isRevision
          ? 'REJECT_REVISION_REQUEST'
          : 'REJECT_INITIAL',
      'MarcommRequest',
      request.id,
      request.status,
      approved
        ? 'APPROVED_WAITING_KARINA'
        : isRevision
          ? 'PUBLISHED_WAITING_MARKETING'
          : 'REJECTED_BY_ANDI',
      notes,
      isGiftAuthorityRequest &&
      approved
        ? `Final ${approvedGiftTier} • Qty ${approvedQuantity}`
        : undefined
    );

    this.notify();
  }

  public startMarcommRequestByKarina(
    requestId:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isKarinaMarcommOperator(
        currentUser
      )
    ) {
      throw new Error(
        'Eksekusi request Marcomm hanya dapat dilakukan oleh Karina Malik.'
      );
    }

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    if (
      request.status !==
      'APPROVED_WAITING_KARINA'
    ) {
      throw new Error(
        'Request belum siap dieksekusi Karina.'
      );
    }

    const now =
      new Date().toISOString();

    requests[
      index
    ] = {
      ...request,
      status:
        'IN_PROGRESS',
      startedAt:
        request.startedAt ||
        now,
      assignedToUserId:
        currentUser.id,
      assignedToName:
        currentUser.name,
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addAuditLog(
      'MARCOMM',
      'START_EXECUTION',
      'MarcommRequest',
      request.id,
      request.status,
      'IN_PROGRESS',
      undefined,
      `${currentUser.name} mulai mengerjakan request.`
    );

    this.notify();
  }

  public submitMarcommDeliverableByKarina(
    requestId:
      string,
    documents:
      MarcommRequestDocument[],
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isKarinaMarcommOperator(
        currentUser
      )
    ) {
      throw new Error(
        'Hasil/evidence Marcomm hanya dapat di-upload oleh Karina Malik.'
      );
    }

    if (
      documents.length ===
      0
    ) {
      throw new Error(
        'Minimal satu file hasil/evidence wajib di-upload.'
      );
    }

    if (
      documents.length >
      10
    ) {
      throw new Error(
        'Maksimal 10 file per submission.'
      );
    }

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    if (
      request.status !==
        'IN_PROGRESS' &&
      request.status !==
        'APPROVED_WAITING_KARINA'
    ) {
      throw new Error(
        'Status request tidak menerima upload hasil dari Karina.'
      );
    }

    const nextVersion =
      (
        request.deliverables?.length ||
        0
      ) +
      1;

    const now =
      new Date().toISOString();

    const version:
      MarcommDeliverableVersion = {
      id:
        `MCV-${request.id}-V${nextVersion}`,
      version:
        nextVersion,
      submittedAt:
        now,
      submittedByUserId:
        currentUser.id,
      submittedByName:
        currentUser.name,
      notes:
        notes?.trim() ||
        undefined,
      documents,
      status:
        'PENDING_ANDI_APPROVAL',
    };

    requests[
      index
    ] = {
      ...request,
      status:
        'PENDING_ANDI_FINAL_REVIEW',
      deliverables: [
        ...(
          request.deliverables ||
          []
        ),
        version,
      ],
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        this.getEffectiveApproverUserId(
          'USR-000030'
        ),
      title:
        `Hasil Marcomm V${nextVersion} Menunggu Approval`,
      message:
        `${request.id} telah di-upload Karina dan menunggu final review Department Head Marketing Communication.`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'MARCOMM',
      'SUBMIT_DELIVERABLE',
      'MarcommRequest',
      request.id,
      request.status,
      'PENDING_ANDI_FINAL_REVIEW',
      notes,
      `V${nextVersion} • ${documents.length} file hasil/evidence`
    );

    this.notify();
  }

  public approveMarcommDeliverableByAndi(
    requestId:
      string,
    approved:
      boolean,
    notes?:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    if (
      !this.isAndiMarcommHead(
        currentUser
      )
    ) {
      throw new Error(
        'Final review hasil Marcomm hanya dapat dilakukan oleh Department Head Marketing Communication.'
      );
    }

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    const deliverables =
      [
        ...(
          request.deliverables ||
          []
        ),
      ];

    if (
      deliverables.length ===
      0
    ) {
      throw new Error(
        'Belum ada hasil/evidence yang dapat direview.'
      );
    }

    const latestIndex =
      deliverables.length -
      1;

    const latest =
      deliverables[
        latestIndex
      ];

    if (
      latest.status !==
      'PENDING_ANDI_APPROVAL'
    ) {
      throw new Error(
        'Versi terbaru tidak sedang menunggu approval.'
      );
    }

    const now =
      new Date().toISOString();

    deliverables[
      latestIndex
    ] = {
      ...latest,
      status:
        approved
          ? 'PUBLISHED'
          : 'REJECTED',
      approvedByUserId:
        currentUser.id,
      approvedByName:
        currentUser.name,
      approvedAt:
        now,
      approvalNotes:
        notes?.trim() ||
        undefined,
    };

    const isDigital =
      request.requestGroup ===
        'DESIGN' ||
      (
        request.requestType ===
          'KARANGAN_BUNGA_UCAPAN' &&
        request.flowerOption ===
          'DESIGN_UCAPAN_SAJA'
      ) ||
      // Backward compatibility for older UAT requests.
      (
        !request.requestGroup &&
        (
          request.requestType ===
            'MARKETING_TOOL' ||
          request.requestType ===
            'MATERI_BROADCAST'
        )
      );

    const isStockControlledGift =
      request.requestType ===
      'SOUVENIR';

    if (
      approved &&
      isStockControlledGift
    ) {
      const finalQuantity =
        Number(
          request.approvedQuantity ||
          0
        );

      const finalGiftTier =
        request.approvedGiftTier;

      if (
        finalQuantity <=
          0 ||
        (
          finalGiftTier !==
            'VIP' &&
          finalGiftTier !==
            'REGULER'
        )
      ) {
        throw new Error(
          'Data final Souvenir/Hampers belum valid untuk stock out.'
        );
      }

      const stockSnapshot =
        this.getMarcommStockSnapshot(
          'SOUVENIR',
          finalGiftTier,
          request.id
        );

      if (
        finalQuantity >
        stockSnapshot.onHand
      ) {
        throw new Error(
          `Stock on hand ${finalGiftTier} tidak mencukupi untuk penyelesaian. On Hand ${stockSnapshot.onHand}, kebutuhan ${finalQuantity}.`
        );
      }

      this.appendMarcommStockTransaction({
        id:
          `MCSTK-OUT-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
        stockCategory:
          'SOUVENIR',
        giftTier:
          finalGiftTier,
        transactionType:
          'STOCK_OUT',
        quantity:
          finalQuantity,
        requestId:
          request.id,
        notes:
          `Auto stock out setelah final approval Department Head Marketing Communication untuk ${request.clientName}.`,
        createdAt:
          now,
        createdByUserId:
          currentUser.id,
        createdByName:
          currentUser.name,
      });

      this.addAuditLog(
        'MARCOMM_STOCK',
        'AUTO_STOCK_OUT',
        'MarcommRequest',
        request.id,
        undefined,
        `-${finalQuantity}`,
        `${request.requestType} ${finalGiftTier}`,
        'Stock keluar otomatis saat request dinyatakan selesai.'
      );
    }

    requests[
      index
    ] = {
      ...request,
      deliverables,
      status:
        approved
          ? isDigital
            ? 'PUBLISHED_WAITING_MARKETING'
            : 'COMPLETED'
          : 'APPROVED_WAITING_KARINA',
      completedAt:
        approved &&
        !isDigital
          ? now
          : request.completedAt,
      completedByUserId:
        approved &&
        !isDigital
          ? currentUser.id
          : request.completedByUserId,
      completedByName:
        approved &&
        !isDigital
          ? currentUser.name
          : request.completedByName,
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    // Custom Design request outputs are requester-specific.
    // They are NOT promoted automatically into the global Standard
    // Marketing Tools catalog. Standard catalog documents continue
    // to use saveServiceDocument() -> DH Marcomm approval.

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        approved
          ? request.requesterUserId
          : 'USR-000031',
      title:
        approved
          ? `Hasil ${request.id} Disetujui`
          : `Hasil ${request.id} Perlu Revisi Karina`,
      message:
        approved
          ? `${request.id} V${latest.version} telah disetujui Department Head Marketing Communication dan tersedia untuk requester.`
          : `${request.id} V${latest.version} ditolak Department Head Marketing Communication.${notes ? ` Catatan: ${notes}` : ''}`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'MARCOMM',
      approved
        ? 'APPROVE_FINAL_DELIVERABLE'
        : 'REJECT_FINAL_DELIVERABLE',
      'MarcommRequest',
      request.id,
      request.status,
      approved
        ? isDigital
          ? 'PUBLISHED_WAITING_MARKETING'
          : 'COMPLETED'
        : 'APPROVED_WAITING_KARINA',
      notes,
      `Review V${latest.version}`
    );

    this.notify();
  }

  public requestMarcommRevisionByMarketing(
    requestId:
      string,
    notes:
      string,
    attachments:
      MarcommRequestDocument[] = []
  ) {
    const currentUser =
      this.getCurrentUser();

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    if (
      request.requesterUserId !==
      currentUser.id
    ) {
      throw new Error(
        'Revisi hasil hanya dapat diminta oleh requester.'
      );
    }

    if (
      request.status !==
      'PUBLISHED_WAITING_MARKETING'
    ) {
      throw new Error(
        'Hasil belum berada pada tahap review requester.'
      );
    }

    if (
      !notes.trim()
    ) {
      throw new Error(
        'Catatan revisi wajib diisi.'
      );
    }

    const now =
      new Date().toISOString();

    const targetVersion =
      (
        request.deliverables?.length ||
        0
      ) +
      1;

    requests[
      index
    ] = {
      ...request,
      status:
        'REVISION_REQUESTED_PENDING_ANDI',
      revisionHistory: [
        ...(
          request.revisionHistory ||
          []
        ),
        {
          id:
            `MCR-${request.id}-${Date.now()}`,
          requestedAt:
            now,
          requestedByUserId:
            currentUser.id,
          requestedByName:
            currentUser.name,
          notes:
            notes.trim(),
          attachments,
          targetVersion,
        },
      ],
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addNotification({
      id:
        'NOTIF-' +
        Date.now() +
        '-' +
        Math.random()
          .toString(36)
          .slice(2, 6),
      recipientUserId:
        this.getEffectiveApproverUserId(
          'USR-000030'
        ),
      title:
        `Permintaan Revisi ${request.id}`,
      message:
        `${currentUser.name} meminta revisi V${targetVersion}.`,
      linkPath:
        '/dokumen-pendukung?area=marcomm-requests',
      isRead:
        false,
      createdAt:
        now,
    });

    this.addAuditLog(
      'MARCOMM',
      'REQUEST_REVISION',
      'MarcommRequest',
      request.id,
      request.status,
      'REVISION_REQUESTED_PENDING_ANDI',
      notes,
      `Target V${targetVersion} • ${attachments.length} lampiran revisi`
    );

    this.notify();
  }

  public acceptMarcommResultByMarketing(
    requestId:
      string
  ) {
    const currentUser =
      this.getCurrentUser();

    const requests =
      this.getMarcommRequests();

    const index =
      requests.findIndex(
        item =>
          item.id ===
          requestId
      );

    if (
      index <
      0
    ) {
      throw new Error(
        'Request Marcomm tidak ditemukan.'
      );
    }

    const request =
      requests[
        index
      ];

    if (
      request.requesterUserId !==
      currentUser.id
    ) {
      throw new Error(
        'Hanya requester yang dapat menyelesaikan request digital.'
      );
    }

    if (
      request.status !==
      'PUBLISHED_WAITING_MARKETING'
    ) {
      throw new Error(
        'Hasil belum siap diterima requester.'
      );
    }

    const now =
      new Date().toISOString();

    requests[
      index
    ] = {
      ...request,
      status:
        'COMPLETED',
      completedAt:
        now,
      completedByUserId:
        currentUser.id,
      completedByName:
        currentUser.name,
      lastUpdatedAt:
        now,
    };

    localStorage.setItem(
      STORAGE_KEYS.MARCOMM_REQUESTS,
      JSON.stringify(
        requests
      )
    );

    this.addAuditLog(
      'MARCOMM',
      'ACCEPT_RESULT_COMPLETE',
      'MarcommRequest',
      request.id,
      request.status,
      'COMPLETED',
      undefined,
      `${currentUser.name} menerima hasil dan menutup request.`
    );

    this.notify();
  }

  // ============================================================
  // SUPPORTING DOCUMENTS
  // ============================================================
  public getSupportingDocuments(): SupportingDocument[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUPPORTING_DOCS) || '[]');
  }

  public saveSupportingDocument(doc: SupportingDocument) {
    const docs = this.getSupportingDocuments();
    const idx = docs.findIndex(d => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.unshift(doc);
    }
    localStorage.setItem(STORAGE_KEYS.SUPPORTING_DOCS, JSON.stringify(docs));
    this.notify();
  }

  // ============================================================
  // TANDA TERIMA DOKUMEN / PHYSICAL DOCUMENT HANDOVER
  // ============================================================

  private isMarketingBusinessRole(role: User['role']): boolean {
    return [
      'DIRECTOR_MARKETING',
      'ADVISOR_MARKETING_DIRECTOR',
      'VP_CAPTIVE_MARKETING',
      'VP_CORPORATE_RETAIL_MARKETING',
      'DEPARTMENT_HEAD_MARKETING',
      'SUPERVISOR_MARKETING',
      'STAFF_MARKETING',
    ].includes(role);
  }

  private isMarketingAdministrationRole(role: User['role']): boolean {
    return [
      'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION',
      'SUPERVISOR_MARKETING_ADMINISTRATION',
      'STAFF_MARKETING_ADMINISTRATION',
    ].includes(role);
  }

  public canCreateDocumentHandover(user: User = this.getCurrentUser()): boolean {
    return this.isMarketingBusinessRole(user.role) || this.isMarketingAdministrationRole(user.role);
  }

  public getDocumentHandovers(): DocumentHandover[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DOCUMENT_HANDOVERS) || '[]');
  }

  public getVisibleDocumentHandovers(user: User = this.getCurrentUser()): DocumentHandover[] {
    if (user.role === 'SYSTEM_ADMIN') return [];

    const records = this.getDocumentHandovers();

    if (
      user.role === 'TEAM_LEADER_MARKETING_SUPPORT' ||
      user.role === 'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION' ||
      user.role === 'SUPERVISOR_MARKETING_ADMINISTRATION'
    ) {
      return records;
    }

    return records.filter(receipt => {
      if (receipt.senderUserId === user.id || receipt.receiverUserId === user.id) return true;

      if (this.isMarketingBusinessRole(user.role)) {
        return (
          this.isUserInScope(user, receipt.senderUserId) ||
          this.isUserInScope(user, receipt.receiverUserId)
        );
      }

      return false;
    });
  }

  public getNextDocumentHandoverId(
    handoverDate: string = new Date().toISOString().slice(0, 10)
  ): string {
    const [year, month] = handoverDate.split('-');
    const prefix = `TRM-${year}-${month}-`;
    const maxSequence = this.getDocumentHandovers()
      .map(item => item.id)
      .filter(id => id.startsWith(prefix))
      .map(id => Number(id.slice(prefix.length)))
      .filter(value => Number.isFinite(value))
      .reduce((max, value) => Math.max(max, value), 0);

    return `${prefix}${String(maxSequence + 1).padStart(5, '0')}`;
  }

  public getEligibleDocumentHandoverReceivers(sender: User = this.getCurrentUser()): User[] {
    const users = this.getUsers().filter(user => user.status === 'Active' && user.id !== sender.id);

    if (this.isMarketingBusinessRole(sender.role)) {
      return users.filter(user => this.isMarketingAdministrationRole(user.role));
    }

    if (this.isMarketingAdministrationRole(sender.role)) {
      return users.filter(user => this.isMarketingBusinessRole(user.role));
    }

    return [];
  }

  public createDocumentHandover(input: {
    handoverType: DocumentHandover['handoverType'];
    handoverDate: string;
    receiverUserId: string;
    relatedModule: DocumentHandover['relatedModule'];
    relatedTransactionId?: string;
    relatedDescription?: string;
    relatedReceiptId?: string;

    // Dipakai UI untuk reserve nomor TRM sebelum upload evidence.
    receiptId?: string;

    submissionPhotoFileId?: string;
    submissionPhotoFileName?: string;
    submissionPhotoFileSize?: number;

    items: Omit<DocumentHandoverItem, 'id' | 'receivedQuantity' | 'receiverNotes'>[];
  }): DocumentHandover {
    const sender = this.getCurrentUser();

    if (!this.canCreateDocumentHandover(sender)) {
      throw new Error('Tanda Terima hanya dapat dibuat oleh Marketing atau Marketing Administration.');
    }

    if (!input.handoverDate) throw new Error('Tanggal penyerahan wajib diisi.');

    const receiver = this.getUsers().find(user => user.id === input.receiverUserId && user.status === 'Active');
    if (!receiver) throw new Error('Penerima tidak valid / tidak aktif.');

    const eligibleReceiverIds = this.getEligibleDocumentHandoverReceivers(sender).map(user => user.id);
    if (!eligibleReceiverIds.includes(receiver.id)) {
      throw new Error('Penerima harus berasal dari fungsi lawan: Marketing ↔ Marketing Administration.');
    }

    if (input.handoverType === 'PENGEMBALIAN DOKUMEN') {
      throw new Error(
        'Pengembalian dokumen harus dicatat sebagai riwayat pada Tanda Terima sebelumnya.'
      );
    }

    if (input.items.length < 1) throw new Error('Minimal terdapat 1 dokumen pada Tanda Terima.');
    if (input.items.some(item => !item.description.trim() || item.quantity < 1)) {
      throw new Error('Deskripsi dokumen dan jumlah wajib diisi dengan benar.');
    }

    if (!input.submissionPhotoFileId || !input.submissionPhotoFileName) {
      throw new Error('Foto bukti penyerahan wajib diupload oleh pengirim.');
    }

    const now = new Date().toISOString();
    const receiptId =
      input.receiptId ||
      this.getNextDocumentHandoverId(input.handoverDate);

    if (this.getDocumentHandovers().some(item => item.id === receiptId)) {
      throw new Error(
        `Nomor ${receiptId} sudah digunakan. Muat ulang halaman lalu coba kembali.`
      );
    }

    const receipt: DocumentHandover = {
      id: receiptId,
      handoverType: input.handoverType,
      handoverDate: input.handoverDate,
      senderUserId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      senderUnit: sender.unit,
      senderDepartment: sender.department,
      receiverUserId: receiver.id,
      receiverName: receiver.name,
      receiverRole: receiver.role,
      receiverUnit: receiver.unit,
      receiverDepartment: receiver.department,
      relatedModule: input.relatedModule,
      relatedTransactionId: input.relatedTransactionId,
      relatedDescription: input.relatedDescription,
      relatedReceiptId: input.relatedReceiptId,
      items: input.items.map((item, index) => ({
        ...item,
        id: `${receiptId}-ITEM-${String(index + 1).padStart(2, '0')}`,
      })),
      status: 'MENUNGGU PENERIMAAN',
      submittedAt: now,
      submittedByUserId: sender.id,
      submittedByName: sender.name,

      submissionPhotoFileId: input.submissionPhotoFileId,
      submissionPhotoFileName: input.submissionPhotoFileName,
      submissionPhotoFileSize: input.submissionPhotoFileSize,
    };

    const records = this.getDocumentHandovers();
    records.unshift(receipt);
    localStorage.setItem(STORAGE_KEYS.DOCUMENT_HANDOVERS, JSON.stringify(records));

    this.addAuditLog(
      'TANDA_TERIMA',
      'SUBMIT_HANDOVER',
      'DocumentHandover',
      receipt.id,
      undefined,
      receipt.status,
      undefined,
      `${receipt.handoverType} dari ${sender.name} kepada ${receiver.name}; ${receipt.items.length} item dokumen`,
      {
        fileId: receipt.submissionPhotoFileId,
        fileName: receipt.submissionPhotoFileName,
        fileSize: receipt.submissionPhotoFileSize,
      }
    );

    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId: receiver.id,
      title: 'Dokumen Menunggu Penerimaan',
      message: `${sender.name} menyerahkan ${receipt.items.length} item dokumen kepada Anda (${receipt.id}).`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });

    this.notify();
    return receipt;
  }

  public returnDocumentHandover(
    receiptId: string,
    input: {
      handoverDate: string;
      items: Array<{
        sourceItemId?: string;
        description: string;
        quantity: number;
        notes?: string;
      }>;

      photoFileId?: string;
      photoFileName?: string;
      photoFileSize?: number;
    }
  ): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(item => item.id === receiptId);

    if (index < 0) {
      throw new Error('Tanda Terima sebelumnya tidak ditemukan.');
    }

    const receipt = records[index];

    if (receipt.receiverUserId !== currentUser.id) {
      throw new Error(
        'Hanya penerima dokumen sebelumnya yang dapat mengembalikan dokumen.'
      );
    }

    if (
      receipt.status !== 'DITERIMA' &&
      receipt.status !== 'SELISIH DOKUMEN'
    ) {
      throw new Error(
        'Pengembalian hanya dapat dilakukan setelah dokumen diterima.'
      );
    }

    if (!input.handoverDate) {
      throw new Error('Tanggal pengembalian wajib diisi.');
    }

    if (input.items.length < 1) {
      throw new Error('Minimal terdapat 1 dokumen yang dikembalikan.');
    }

    if (
      input.items.some(
        item =>
          !item.description.trim() ||
          Number(item.quantity) < 1
      )
    ) {
      throw new Error(
        'Deskripsi dan jumlah dokumen pengembalian wajib diisi dengan benar.'
      );
    }

    if (!input.photoFileId || !input.photoFileName) {
      throw new Error(
        'Foto bukti pengembalian wajib diupload oleh pihak yang mengembalikan.'
      );
    }

    const now = new Date().toISOString();

    const returnItems = input.items.map(
      (item, index) => ({
        id: `${receipt.id}-RETURN-${Date.now()}-${String(index + 1).padStart(2, '0')}`,
        sourceItemId: item.sourceItemId,
        description: item.description.trim(),
        quantity: Number(item.quantity),
        notes: item.notes?.trim() || undefined,
      })
    );

    const previousStatus = receipt.status;

    const updated: DocumentHandover = {
      ...receipt,
      status: 'MENUNGGU KONFIRMASI PENGEMBALIAN',
      returnItems,
      returnSubmittedAt: now,
      returnSubmittedByUserId: currentUser.id,
      returnSubmittedByName: currentUser.name,
      returnPhotoFileId: input.photoFileId,
      returnPhotoFileName: input.photoFileName,
      returnPhotoFileSize: input.photoFileSize,

      // Reset acknowledgement lama bila suatu saat registry
      // kembali menjalani siklus custody baru.
      returnReceiverDecisionAt: undefined,
      returnReceiverDecisionByUserId: undefined,
      returnReceiverDecisionByName: undefined,
      returnReceiverDecisionNotes: undefined,
      returnReceiptPhotoFileId: undefined,
      returnReceiptPhotoFileName: undefined,
      returnReceiptPhotoFileSize: undefined,
    };

    records[index] = updated;

    localStorage.setItem(
      STORAGE_KEYS.DOCUMENT_HANDOVERS,
      JSON.stringify(records)
    );

    const itemSummary = returnItems
      .map(
        item =>
          `${item.description} (Qty ${item.quantity})`
      )
      .join('; ');

    this.addAuditLog(
      'TANDA_TERIMA',
      'RETURN_HANDOVER_SUBMITTED',
      'DocumentHandover',
      updated.id,
      previousStatus,
      updated.status,
      `Pengembalian tanggal ${input.handoverDate} oleh ${currentUser.name} kepada ${receipt.senderName}.`,
      itemSummary,
      {
        fileId: input.photoFileId,
        fileName: input.photoFileName,
        fileSize: input.photoFileSize,
      }
    );

    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId: receipt.senderUserId,
      title: 'Pengembalian Dokumen Menunggu Konfirmasi',
      message:
        `${currentUser.name} mengembalikan dokumen untuk ${receipt.id}. ` +
        `Mohon konfirmasi penerimaan kembali.`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });

    this.notify();

    return updated;
  }

  public confirmDocumentReturn(
    receiptId: string,
    input: {
      status: 'DIKEMBALIKAN' | 'SELISIH PENGEMBALIAN';
      items: Array<{
        itemId: string;
        receivedQuantity: number;
        receiverNotes?: string;
      }>;

      photoFileId?: string;
      photoFileName?: string;
      photoFileSize?: number;
      notes?: string;
    }
  ): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(item => item.id === receiptId);

    if (index < 0) {
      throw new Error('Tanda Terima tidak ditemukan.');
    }

    const receipt = records[index];

    if (receipt.status !== 'MENUNGGU KONFIRMASI PENGEMBALIAN') {
      throw new Error(
        'Tanda Terima ini tidak sedang menunggu konfirmasi pengembalian.'
      );
    }

    if (receipt.senderUserId !== currentUser.id) {
      throw new Error(
        'Hanya pengirim awal yang dapat mengonfirmasi penerimaan kembali.'
      );
    }

    if (!receipt.returnItems?.length) {
      throw new Error('Daftar dokumen pengembalian tidak ditemukan.');
    }

    const decisionMap = new Map(
      input.items.map(item => [item.itemId, item])
    );

    const updatedReturnItems = receipt.returnItems.map(item => {
      const decision = decisionMap.get(item.id);

      return {
        ...item,
        receivedQuantity: Math.max(
          0,
          Number(decision?.receivedQuantity ?? 0)
        ),
        receiverNotes:
          decision?.receiverNotes?.trim() ||
          undefined,
      };
    });

    if (
      input.status === 'DIKEMBALIKAN' &&
      updatedReturnItems.some(
        item =>
          item.receivedQuantity !== item.quantity
      )
    ) {
      throw new Error(
        'Status DIKEMBALIKAN hanya dapat dipilih jika seluruh dokumen pengembalian diterima lengkap.'
      );
    }

    const now = new Date().toISOString();

    const updated: DocumentHandover = {
      ...receipt,
      status: input.status,
      returnItems: updatedReturnItems,
      returnReceiverDecisionAt: now,
      returnReceiverDecisionByUserId: currentUser.id,
      returnReceiverDecisionByName: currentUser.name,
      returnReceiverDecisionNotes:
        input.notes?.trim() || undefined,
      returnReceiptPhotoFileId: input.photoFileId,
      returnReceiptPhotoFileName: input.photoFileName,
      returnReceiptPhotoFileSize: input.photoFileSize,
    };

    records[index] = updated;

    localStorage.setItem(
      STORAGE_KEYS.DOCUMENT_HANDOVERS,
      JSON.stringify(records)
    );

    this.addAuditLog(
      'TANDA_TERIMA',
      input.status === 'DIKEMBALIKAN'
        ? 'RETURN_HANDOVER_CONFIRMED'
        : 'RETURN_HANDOVER_DISCREPANCY',
      'DocumentHandover',
      updated.id,
      receipt.status,
      updated.status,
      input.notes,
      input.photoFileName,
      input.photoFileId
        ? {
            fileId: input.photoFileId,
            fileName: input.photoFileName,
            fileSize: input.photoFileSize,
          }
        : undefined
    );

    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId:
        receipt.returnSubmittedByUserId ||
        receipt.receiverUserId,
      title:
        input.status === 'DIKEMBALIKAN'
          ? 'Pengembalian Dokumen Dikonfirmasi'
          : 'Selisih Pengembalian Dilaporkan',
      message:
        `${currentUser.name} memproses pengembalian ${updated.id} ` +
        `dengan status ${updated.status}.`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });

    this.notify();

    return updated;
  }

  public resolveDocumentHandoverDiscrepancy(
    receiptId: string,
    notes: string
  ): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(
      item => item.id === receiptId
    );

    if (index < 0) {
      throw new Error('Tanda Terima tidak ditemukan.');
    }

    const receipt = records[index];
    const resolutionNotes = notes.trim();

    if (!resolutionNotes) {
      throw new Error(
        'Catatan penyelesaian selisih wajib diisi.'
      );
    }

    const now = new Date().toISOString();

    if (receipt.status === 'SELISIH DOKUMEN') {
      if (receipt.receiverUserId !== currentUser.id) {
        throw new Error(
          'Hanya penerima dokumen yang dapat menyelesaikan selisih penerimaan.'
        );
      }

      const snapshot =
        receipt.initialDiscrepancyItems?.length
          ? receipt.initialDiscrepancyItems
          : receipt.items.map(item => ({
              itemId: item.id,
              expectedQuantity: Number(item.quantity),
              receivedQuantity: Number(
                item.receivedQuantity ?? 0
              ),
              receiverNotes:
                item.receiverNotes || undefined,
            }));

      const updated: DocumentHandover = {
        ...receipt,
        status: 'DITERIMA',
        initialDiscrepancyItems: snapshot,
        initialDiscrepancyResolvedAt: now,
        initialDiscrepancyResolvedByUserId:
          currentUser.id,
        initialDiscrepancyResolvedByName:
          currentUser.name,
        initialDiscrepancyResolutionNotes:
          resolutionNotes,
        items: receipt.items.map(item => ({
          ...item,
          receivedQuantity: Number(item.quantity),
        })),
      };

      records[index] = updated;

      localStorage.setItem(
        STORAGE_KEYS.DOCUMENT_HANDOVERS,
        JSON.stringify(records)
      );

      this.addAuditLog(
        'TANDA_TERIMA',
        'RESOLVE_DOCUMENT_DISCREPANCY',
        'DocumentHandover',
        updated.id,
        receipt.status,
        updated.status,
        resolutionNotes
      );

      this.addNotification({
        id: `NTF-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        recipientUserId: receipt.senderUserId,
        title: 'Selisih Dokumen Diselesaikan',
        message:
          `${currentUser.name} menyelesaikan selisih pada ${updated.id}. ` +
          `Status dokumen kini DITERIMA.`,
        linkPath: '/tanda-terima',
        isRead: false,
        createdAt: now,
      });

      this.notify();
      return updated;
    }

    if (receipt.status === 'SELISIH PENGEMBALIAN') {
      if (receipt.senderUserId !== currentUser.id) {
        throw new Error(
          'Hanya penerima kembali / pengirim awal yang dapat menyelesaikan selisih pengembalian.'
        );
      }

      if (!receipt.returnItems?.length) {
        throw new Error(
          'Daftar dokumen pengembalian tidak ditemukan.'
        );
      }

      const snapshot =
        receipt.returnDiscrepancyItems?.length
          ? receipt.returnDiscrepancyItems
          : receipt.returnItems.map(item => ({
              itemId: item.id,
              expectedQuantity: Number(item.quantity),
              receivedQuantity: Number(
                item.receivedQuantity ?? 0
              ),
              receiverNotes:
                item.receiverNotes || undefined,
            }));

      const updated: DocumentHandover = {
        ...receipt,
        status: 'DIKEMBALIKAN',
        returnDiscrepancyItems: snapshot,
        returnDiscrepancyResolvedAt: now,
        returnDiscrepancyResolvedByUserId:
          currentUser.id,
        returnDiscrepancyResolvedByName:
          currentUser.name,
        returnDiscrepancyResolutionNotes:
          resolutionNotes,
        returnItems: receipt.returnItems.map(item => ({
          ...item,
          receivedQuantity: Number(item.quantity),
        })),
      };

      records[index] = updated;

      localStorage.setItem(
        STORAGE_KEYS.DOCUMENT_HANDOVERS,
        JSON.stringify(records)
      );

      this.addAuditLog(
        'TANDA_TERIMA',
        'RESOLVE_RETURN_DISCREPANCY',
        'DocumentHandover',
        updated.id,
        receipt.status,
        updated.status,
        resolutionNotes
      );

      this.addNotification({
        id: `NTF-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        recipientUserId:
          receipt.returnSubmittedByUserId ||
          receipt.receiverUserId,
        title: 'Selisih Pengembalian Diselesaikan',
        message:
          `${currentUser.name} menyelesaikan selisih pengembalian pada ${updated.id}. ` +
          `Status dokumen kini DIKEMBALIKAN.`,
        linkPath: '/tanda-terima',
        isRead: false,
        createdAt: now,
      });

      this.notify();
      return updated;
    }

    throw new Error(
      'Tanda Terima ini tidak memiliki selisih yang perlu diselesaikan.'
    );
  }

  public confirmDocumentHandover(
    receiptId: string,
    input: {
      status: 'DITERIMA' | 'SELISIH DOKUMEN';
      items: Array<{ itemId: string; receivedQuantity: number; receiverNotes?: string }>;
      photoFileId?: string;
      photoFileName?: string;
      photoFileSize?: number;
      notes?: string;
    }
  ): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(item => item.id === receiptId);
    if (index < 0) throw new Error('Tanda Terima tidak ditemukan.');

    const receipt = records[index];
    if (receipt.status !== 'MENUNGGU PENERIMAAN') {
      throw new Error('Tanda Terima ini sudah memiliki keputusan penerimaan.');
    }
    if (receipt.receiverUserId !== currentUser.id) {
      throw new Error('Hanya penerima yang ditunjuk yang dapat mengonfirmasi penerimaan.');
    }
    const decisionMap = new Map(input.items.map(item => [item.itemId, item]));
    const updatedItems = receipt.items.map(item => {
      const decision = decisionMap.get(item.id);
      return {
        ...item,
        receivedQuantity: Math.max(0, Number(decision?.receivedQuantity ?? 0)),
        receiverNotes: decision?.receiverNotes?.trim() || undefined,
      };
    });

    if (input.status === 'DITERIMA' && updatedItems.some(item => item.receivedQuantity !== item.quantity)) {
      throw new Error('Status DITERIMA hanya dapat dipilih jika seluruh jumlah dokumen diterima lengkap.');
    }

    const now = new Date().toISOString();
    const updated: DocumentHandover = {
      ...receipt,
      items: updatedItems,
      status: input.status,
      receiverDecisionAt: now,
      receiverDecisionByUserId: currentUser.id,
      receiverDecisionByName: currentUser.name,
      receiverDecisionNotes: input.notes?.trim() || undefined,
      receiptPhotoFileId: input.photoFileId,
      receiptPhotoFileName: input.photoFileName,
      receiptPhotoFileSize: input.photoFileSize,
    };

    records[index] = updated;
    localStorage.setItem(STORAGE_KEYS.DOCUMENT_HANDOVERS, JSON.stringify(records));

    this.addAuditLog(
      'TANDA_TERIMA',
      input.status === 'DITERIMA' ? 'CONFIRM_RECEIVED' : 'REPORT_DISCREPANCY',
      'DocumentHandover',
      updated.id,
      receipt.status,
      updated.status,
      input.notes,
      input.photoFileName,
      input.photoFileId
        ? {
            fileId: input.photoFileId,
            fileName: input.photoFileName,
            fileSize: input.photoFileSize,
          }
        : undefined
    );

    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId: updated.senderUserId,
      title: input.status === 'DITERIMA' ? 'Dokumen Telah Diterima' : 'Selisih Dokumen Dilaporkan',
      message: `${currentUser.name} memproses ${updated.id} dengan status ${updated.status}.`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });

    this.notify();
    return updated;
  }

  public rejectDocumentHandover(receiptId: string, reason: string): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(item => item.id === receiptId);
    if (index < 0) throw new Error('Tanda Terima tidak ditemukan.');

    const receipt = records[index];
    if (receipt.status !== 'MENUNGGU PENERIMAAN' || receipt.receiverUserId !== currentUser.id) {
      throw new Error('Tanda Terima tidak dapat ditolak oleh akun ini.');
    }
    if (!reason.trim()) throw new Error('Alasan penolakan wajib diisi.');

    const now = new Date().toISOString();
    const updated: DocumentHandover = {
      ...receipt,
      status: 'DITOLAK',
      receiverDecisionAt: now,
      receiverDecisionByUserId: currentUser.id,
      receiverDecisionByName: currentUser.name,
      receiverDecisionNotes: reason.trim(),
    };

    records[index] = updated;
    localStorage.setItem(STORAGE_KEYS.DOCUMENT_HANDOVERS, JSON.stringify(records));
    this.addAuditLog('TANDA_TERIMA', 'REJECT_HANDOVER', 'DocumentHandover', updated.id, receipt.status, updated.status, reason.trim());
    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId: updated.senderUserId,
      title: 'Penerimaan Dokumen Ditolak',
      message: `${currentUser.name} menolak ${updated.id}. Alasan: ${reason.trim()}`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });
    this.notify();
    return updated;
  }

  public cancelDocumentHandover(receiptId: string, reason: string): DocumentHandover {
    const currentUser = this.getCurrentUser();
    const records = this.getDocumentHandovers();
    const index = records.findIndex(item => item.id === receiptId);
    if (index < 0) throw new Error('Tanda Terima tidak ditemukan.');

    const receipt = records[index];
    if (receipt.status !== 'MENUNGGU PENERIMAAN' || receipt.senderUserId !== currentUser.id) {
      throw new Error('Hanya pengirim yang dapat membatalkan Tanda Terima sebelum ada keputusan penerima.');
    }
    if (!reason.trim()) throw new Error('Alasan pembatalan wajib diisi.');

    const now = new Date().toISOString();
    const updated: DocumentHandover = {
      ...receipt,
      status: 'DIBATALKAN',
      cancelledAt: now,
      cancelledByUserId: currentUser.id,
      cancelledByName: currentUser.name,
      cancellationReason: reason.trim(),
    };

    records[index] = updated;
    localStorage.setItem(STORAGE_KEYS.DOCUMENT_HANDOVERS, JSON.stringify(records));
    this.addAuditLog('TANDA_TERIMA', 'CANCEL_HANDOVER', 'DocumentHandover', updated.id, receipt.status, updated.status, reason.trim());
    this.addNotification({
      id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      recipientUserId: updated.receiverUserId,
      title: 'Tanda Terima Dibatalkan',
      message: `${currentUser.name} membatalkan ${updated.id}.`,
      linkPath: '/tanda-terima',
      isRead: false,
      createdAt: now,
    });
    this.notify();
    return updated;
  }


  // ============================================================
  // AUDIT & NOTIFICATIONS
  // ============================================================
  public getAuditLogs(): AuditLog[] {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || '[]');
  }

  public addAuditLog(
    module: string,
    action: string,
    recordType: string,
    recordId: string,
    previousValue?: string,
    newValue?: string,
    reason?: string,
    notes?: string,
    evidence?: {
      fileId?: string;
      fileName?: string;
      fileSize?: number;
    }
  ) {
    const currentUser = this.getCurrentUser();
    const log: AuditLog = {
      id: 'AUD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      module,
      action,
      recordType,
      recordId,
      previousValue,
      newValue,
      reason,
      fileReference: notes,
      evidenceFileId: evidence?.fileId,
      evidenceFileName: evidence?.fileName,
      evidenceFileSize: evidence?.fileSize
    };
    const logs = this.getAuditLogs();
    logs.unshift(log);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  }

  public getNotifications(userId: string): AppNotification[] {
    const all: AppNotification[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
    return all.filter(n => n.recipientUserId === userId);
  }

  public addNotification(notif: AppNotification) {
    const all: AppNotification[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
    all.unshift(notif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
    this.notify();
  }

  public markNotificationAsRead(id: string) {
    const all: AppNotification[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS) || '[]');
    const idx = all.findIndex(n => n.id === id);
    if (idx >= 0) {
      all[idx].isRead = true;
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(all));
      this.notify();
    }
  }


  // ============================================================
  // UAT DUMMY DATA GENERATOR & RESET
  // ============================================================
  public generateDummyData() {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    const isoDaysAgo = (days: number) =>
      new Date(now.getTime() - days * dayMs).toISOString();

    const dateOnlyDaysAgo = (days: number) =>
      isoDaysAgo(days).split('T')[0];

    const dateOnlyDaysFromNow = (days: number) =>
      new Date(now.getTime() + days * dayMs).toISOString().split('T')[0];

    const users = this.getUsers();
    const products = this.getProducts();

    const userById = (userId: string) => {
      const user = users.find(u => u.id === userId);
      if (!user) {
        throw new Error(`UAT generator: User ${userId} tidak ditemukan.`);
      }
      return user;
    };

    const productById = (productId: string) => {
      const product = products.find(p => p.id === productId);
      if (!product) {
        throw new Error(`UAT generator: Product ${productId} tidak ditemukan.`);
      }
      return product;
    };

    const spreadMonthlyExact = (total: number): number[] => {
      const base = Math.floor(total / 12);
      let remainder = total - base * 12;

      return Array.from({ length: 12 }, () => {
        if (remainder > 0) {
          remainder -= 1;
          return base + 1;
        }
        return base;
      });
    };

    // ==========================================================
    // UAT GENERATOR PREFLIGHT
    // Validate master references BEFORE dummy transaction writes.
    // ==========================================================
    const requiredDummyProductIds = [
      'PRD-KK-01',
      'PRD-KK-02',
      'PRD-JK-03',
      'PRD-JK-05',
      'PRD-JK-06',
      'PRD-JK-07',
      'PRD-JK-09',
      'PRD-KI-01',
      'PRD-JI-04'
    ];

    const missingDummyProductIds =
      requiredDummyProductIds.filter(
        productId =>
          !products.some(
            product =>
              product.id ===
              productId
          )
      );

    if (
      missingDummyProductIds.length >
      0
    ) {
      throw new Error(
        `UAT generator dihentikan. Product Master tidak memiliki: ${missingDummyProductIds.join(', ')}.`
      );
    }

    // ==========================================================
    // 1. TARGETS
    // Preserve target yang sudah pernah dipublish/upload.
    // Kalau belum ada target sama sekali, baru generate fallback UAT
    // Rp800 Miliar dengan split NB/RN non-70/30.
    // ==========================================================

    const existingTargets = this.getTargets();

    if (existingTargets.length === 0) {
      const personalTargetMap: Record<
        string,
        {
          total: number;
          nb: number;
          rn: number;
        }
      > = {
        'USR-000001': { total: 0, nb: 0, rn: 0 },
        'USR-000002': { total: 20000000000, nb: 12000000000, rn: 8000000000 },

        // VP tidak wajib punya target pribadi
        'USR-000003': { total: 0, nb: 0, rn: 0 },

        'USR-000004': { total: 20000000000, nb: 8000000000, rn: 12000000000 },
        'USR-000005': { total: 80000000000, nb: 30000000000, rn: 50000000000 },
        'USR-000006': { total: 70000000000, nb: 35000000000, rn: 35000000000 },

        'USR-000007': { total: 20000000000, nb: 10000000000, rn: 10000000000 },
        'USR-000008': { total: 30000000000, nb: 15000000000, rn: 15000000000 },
        'USR-000009': { total: 100000000000, nb: 40000000000, rn: 60000000000 },

        'USR-000010': { total: 20000000000, nb: 10000000000, rn: 10000000000 },
        'USR-000011': { total: 60000000000, nb: 25000000000, rn: 35000000000 },
        'USR-000012': { total: 20000000000, nb: 10000000000, rn: 10000000000 },
        'USR-000013': { total: 60000000000, nb: 30000000000, rn: 30000000000 },

        // VP tidak wajib punya target pribadi
        'USR-000014': { total: 0, nb: 0, rn: 0 },

        'USR-000015': { total: 10000000000, nb: 6000000000, rn: 4000000000 },
        'USR-000016': { total: 55000000000, nb: 35000000000, rn: 20000000000 },
        'USR-000017': { total: 45000000000, nb: 25000000000, rn: 20000000000 },

        'USR-000018': { total: 10000000000, nb: 5000000000, rn: 5000000000 },
        'USR-000019': { total: 45000000000, nb: 25000000000, rn: 20000000000 },
        'USR-000020': { total: 40000000000, nb: 20000000000, rn: 20000000000 },

        'USR-000021': { total: 10000000000, nb: 5000000000, rn: 5000000000 },
        'USR-000022': { total: 50000000000, nb: 30000000000, rn: 20000000000 },
        'USR-000023': { total: 35000000000, nb: 20000000000, rn: 15000000000 }
      };

      const targetUsers = users.filter(
        u =>
          u.role !== 'SYSTEM_ADMIN' &&
          u.unit !== 'Marketing Support'
      );

      const childrenMap: Record<string, string[]> = {};

      targetUsers.forEach(u => {
        childrenMap[u.id] = [];
      });

      targetUsers.forEach(u => {
        if (
          u.superiorId &&
          childrenMap[u.superiorId]
        ) {
          childrenMap[u.superiorId].push(u.id);
        }
      });

      const annualCache: Record<
        string,
        {
          total: number;
          nb: number;
          rn: number;
        }
      > = {};

      const calculateAnnual = (
        userId: string
      ): {
        total: number;
        nb: number;
        rn: number;
      } => {
        if (annualCache[userId]) {
          return annualCache[userId];
        }

        const personal =
          personalTargetMap[userId] || {
            total: 0,
            nb: 0,
            rn: 0
          };

        const children =
          childrenMap[userId] || [];

        const childAnnual =
          children.map(childId =>
            calculateAnnual(childId)
          );

        const result = {
          total:
            personal.total +
            childAnnual.reduce(
              (sum, value) =>
                sum + value.total,
              0
            ),
          nb:
            personal.nb +
            childAnnual.reduce(
              (sum, value) =>
                sum + value.nb,
              0
            ),
          rn:
            personal.rn +
            childAnnual.reduce(
              (sum, value) =>
                sum + value.rn,
              0
            )
        };

        annualCache[userId] = result;
        return result;
      };

      targetUsers.forEach(u =>
        calculateAnnual(u.id)
      );

      const fallbackTargets: any[] =
        targetUsers.map(u => {
          const personal =
            personalTargetMap[u.id] || {
              total: 0,
              nb: 0,
              rn: 0
            };

          const annual =
            annualCache[u.id];

          return {
            id: `TRG-2026-${u.id}`,
            year: 2026,
            userId: u.id,
            userName: u.name,
            position: u.position,
            unit: u.unit,
            department: u.department,

            annualTargetTotal:
              annual.total,
            annualTargetNewBusiness:
              annual.nb,
            annualTargetRenewal:
              annual.rn,

            personalTargetTotal:
              personal.total,
            personalTargetNewBusiness:
              personal.nb,
            personalTargetRenewal:
              personal.rn,

            monthlyNewBusiness:
              spreadMonthlyExact(
                personal.nb
              ),
            monthlyRenewal:
              spreadMonthlyExact(
                personal.rn
              ),

            notes:
              'Fallback UAT Target Rp800 Miliar',
            publishedAt:
              isoDaysAgo(10),
            publishedBy:
              'Arianie Fajarwati'
          };
        });

      localStorage.setItem(
        STORAGE_KEYS.TARGETS,
        JSON.stringify(
          fallbackTargets
        )
      );

      localStorage.setItem(
        STORAGE_KEYS.TARGET_BATCHES,
        JSON.stringify([
          {
            id:
              'BATCH-TRG-UAT-2026',
            year:
              2026,
            filename:
              'UAT_Fallback_Target_2026.csv',
            uploadedBy:
              'Arianie Fajarwati',
            uploadedAt:
              isoDaysAgo(10),
            recordCount:
              fallbackTargets.length,
            status:
              'Published'
          }
        ])
      );
    }

    // ==========================================================
    // 2. BOOKING CASE
    // Shared queue MS: Submitted, Claimed, Final Approval,
    // Approved, dan Rejected.
    // ==========================================================

    const makeBooking = (
      index: number,
      picUserId: string,
      customerName: string,
      productId: string,
      estimatedPremium: number,
      status: string,
      createdDaysAgo: number,
      options: {
        isTender?: boolean;
        channel?: string;
        claimedBy?: string;
        claimedByName?: string;
        claimedAtDaysAgo?: number;
        verificationRecommendation?: string;
        verificationNotes?: string;
        finalDecisionBy?: string;
        finalDecisionByName?: string;
        finalDecisionAtDaysAgo?: number;
        pipelineId?: string;
      } = {}
    ) => {
      const pic = userById(picUserId);
      const product = productById(productId);

      return {
        id:
          `BC-2026-${String(index).padStart(5, '0')}`,
        customerName,
        insuranceType:
          product.insuranceType,
        customerCategory:
          product.customerCategory,
        productId:
          product.id,
        productName:
          product.productName,
        estimatedPremium,
        targetClosingDate:
          dateOnlyDaysFromNow(30 + index),
        isTender:
          options.isTender ?? false,
        channel:
          options.channel || 'Direct Selling',
        picUserId:
          pic.id,
        picName:
          pic.name,
        unit:
          pic.unit,
        department:
          pic.department,
        status,
        claimedBy:
          options.claimedBy,
        claimedByName:
          options.claimedByName,
        claimedAt:
          options.claimedAtDaysAgo !== undefined
            ? isoDaysAgo(
                options.claimedAtDaysAgo
              )
            : undefined,
        verificationRecommendation:
          options.verificationRecommendation,
        verificationNotes:
          options.verificationNotes,
        finalDecisionBy:
          options.finalDecisionBy,
        finalDecisionByName:
          options.finalDecisionByName,
        finalDecisionAt:
          options.finalDecisionAtDaysAgo !== undefined
            ? isoDaysAgo(
                options.finalDecisionAtDaysAgo
              )
            : undefined,
        pipelineId:
          options.pipelineId,
        createdAt:
          isoDaysAgo(createdDaysAgo),
        createdBy:
          pic.name
      };
    };

    const dummyBookings: any[] = [
      makeBooking(
        1,
        'USR-000005',
        'PT Nusantara Energi Sejahtera',
        'PRD-KK-01',
        18000000000,
        'Submitted',
        4,
        {
          isTender: true,
          channel: 'Direct Selling'
        }
      ),
      makeBooking(
        2,
        'USR-000009',
        'PT Borneo Infrastruktur Utama',
        'PRD-JK-05',
        12000000000,
        'Submitted',
        2,
        {
          isTender: true,
          channel: 'Broker'
        }
      ),
      makeBooking(
        3,
        'USR-000016',
        'PT Metro Logistik Nasional',
        'PRD-KK-02',
        9000000000,
        'Submitted',
        1,
        {
          channel: 'Direct Selling'
        }
      ),
      makeBooking(
        4,
        'USR-000019',
        'PT Cakrawala Retail Indonesia',
        'PRD-JK-03',
        6500000000,
        'Submitted',
        6,
        {
          channel: 'Agent'
        }
      ),
      makeBooking(
        5,
        'USR-000013',
        'PT Samudera Gas Teknologi',
        'PRD-KK-01',
        15000000000,
        'Claimed',
        5,
        {
          claimedBy:
            'USR-000026',
          claimedByName:
            'Ayu Evarinanty',
          claimedAtDaysAgo:
            3
        }
      ),
      makeBooking(
        6,
        'USR-000022',
        'PT Prima Solusi Digital',
        'PRD-JK-07',
        8500000000,
        'Claimed',
        3,
        {
          claimedBy:
            'USR-000027',
          claimedByName:
            'Ulfia Hegrina',
          claimedAtDaysAgo:
            2
        }
      ),
      makeBooking(
        7,
        'USR-000006',
        'PT Karya Migas Mandiri',
        'PRD-JK-06',
        11000000000,
        'Claimed',
        7,
        {
          claimedBy:
            'USR-000025',
          claimedByName:
            'Suci Yumarlia',
          claimedAtDaysAgo:
            4,
          verificationRecommendation:
            'VALID',
          verificationNotes:
            'Dokumen lengkap dan data peserta sesuai.'
        }
      ),
      makeBooking(
        8,
        'USR-000023',
        'PT Arunika Industri',
        'PRD-KK-02',
        7000000000,
        'Claimed',
        4,
        {
          claimedBy:
            'USR-000026',
          claimedByName:
            'Ayu Evarinanty',
          claimedAtDaysAgo:
            2,
          verificationRecommendation:
            'REKOMENDASI TOLAK',
          verificationNotes:
            'Dokumen legal belum lengkap.'
        }
      ),
      makeBooking(
        9,
        'USR-000017',
        'PT Garda Mineral Indonesia',
        'PRD-JK-09',
        5000000000,
        'Approved',
        12,
        {
          finalDecisionBy:
            'USR-000028',
          finalDecisionByName:
            'RR Endah Wasis Wuwuh Mumpuni',
          finalDecisionAtDaysAgo:
            10,
          pipelineId:
            'PL-2026-00039'
        }
      ),
      makeBooking(
        10,
        'USR-000020',
        'PT Sentra Pangan Sejahtera',
        'PRD-KK-02',
        4000000000,
        'Rejected',
        10,
        {
          finalDecisionBy:
            'USR-000028',
          finalDecisionByName:
            'RR Endah Wasis Wuwuh Mumpuni',
          finalDecisionAtDaysAgo:
            8
        }
      )
    ];

    localStorage.setItem(
      STORAGE_KEYS.BOOKINGS,
      JSON.stringify(
        dummyBookings
      )
    );

    // ==========================================================
    // 3. PIPELINE
    // Sebar across Captive I/II/III, CRM I/II/III, Advisor.
    // Cover semua bucket handler, NB/RN, WIN, LOSE,
    // normal/warning/critical lapse.
    // ==========================================================

    const pipelineDefinitions: Array<{
      picUserId: string;
      customerName: string;
      productId: string;
      businessType:
        | 'New Business'
        | 'Renewal Business';
      value: number;
      status: PipelineCanonicalStatus;
      lapseDays: number;
      isTender?: boolean;
      channel?: string;
      source?: 'BOOKING_CASE' | 'RKAP_BULK';
      loseReason?: string;
      loseNotes?: string;
      winPending?: boolean;
    }> = [
      {
        picUserId: 'USR-000005',
        customerName: 'PT Pertamina Marine Services',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 28000000000,
        status: 'On Process Teknik',
        lapseDays: 12,
        isTender: true
      },
      {
        picUserId: 'USR-000006',
        customerName: 'PT Patra Terminal Energi',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 22000000000,
        status: 'Menunggu Feedback / Konfirmasi Klien',
        lapseDays: 34
      },
      {
        picUserId: 'USR-000005',
        customerName: 'PT Delta Services Indonesia',
        productId: 'PRD-JK-05',
        businessType: 'New Business',
        value: 16000000000,
        status: 'Dokumen Diajukan oleh Marketing',
        lapseDays: 3,
        isTender: true
      },
      {
        picUserId: 'USR-000006',
        customerName: 'PT Krakatau Facility Management',
        productId: 'PRD-KK-02',
        businessType: 'Renewal Business',
        value: 14000000000,
        status: 'Perlu Perbaikan Dokumen Marketing',
        lapseDays: 7
      },

      {
        picUserId: 'USR-000009',
        customerName: 'PT Nusantara Aviation Services',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 30000000000,
        status: 'Penawaran Telah Terbit',
        lapseDays: 18,
        isTender: true
      },
      {
        picUserId: 'USR-000008',
        customerName: 'PT Bumi Trans Energi',
        productId: 'PRD-JK-07',
        businessType: 'Renewal Business',
        value: 18000000000,
        status: 'On Progress Marketing Support',
        lapseDays: 2
      },
      {
        picUserId: 'USR-000009',
        customerName: 'PT Sentosa Konstruksi Nasional',
        productId: 'PRD-JK-03',
        businessType: 'New Business',
        value: 12000000000,
        status: 'Menunggu Upload Dokumen Marketing',
        lapseDays: 1
      },
      {
        picUserId: 'USR-000009',
        customerName: 'PT Energi Ritel Indonesia',
        productId: 'PRD-KK-02',
        businessType: 'Renewal Business',
        value: 20000000000,
        status: 'Menunggu Final Approval Team Leader Marketing Support',
        lapseDays: 4
      },

      {
        picUserId: 'USR-000013',
        customerName: 'PT Pertamina Offshore Services',
        productId: 'PRD-KK-01',
        businessType: 'Renewal Business',
        value: 24000000000,
        status: 'On Process Teknik',
        lapseDays: 65,
        isTender: true
      },
      {
        picUserId: 'USR-000011',
        customerName: 'PT Kalimantan Energi Prima',
        productId: 'PRD-JK-05',
        businessType: 'New Business',
        value: 18000000000,
        status: 'Menunggu Feedback / Konfirmasi Klien',
        lapseDays: 41
      },
      {
        picUserId: 'USR-000012',
        customerName: 'PT Manajemen Aset Sejahtera',
        productId: 'PRD-JK-07',
        businessType: 'Renewal Business',
        value: 16000000000,
        status: 'Dalam Verifikasi Marketing Support',
        lapseDays: 3
      },
      {
        picUserId: 'USR-000013',
        customerName: 'PT Global Travel Energi',
        productId: 'PRD-JK-09',
        businessType: 'New Business',
        value: 8000000000,
        status: 'Dokumen Closing Diajukan',
        lapseDays: 2
      },

      {
        picUserId: 'USR-000016',
        customerName: 'PT Mandala Telekom Indonesia',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 26000000000,
        status: 'Penawaran Telah Terbit',
        lapseDays: 9
      },
      {
        picUserId: 'USR-000017',
        customerName: 'PT Mitra Petrochem Nasional',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 20000000000,
        status: 'Menunggu Feedback / Konfirmasi Klien',
        lapseDays: 36
      },
      {
        picUserId: 'USR-000016',
        customerName: 'PT Aero Infrastruktur Persada',
        productId: 'PRD-JK-05',
        businessType: 'New Business',
        value: 15000000000,
        status: 'On Progress Marketing Support',
        lapseDays: 5
      },

      {
        picUserId: 'USR-000019',
        customerName: 'PT Metro Health Services',
        productId: 'PRD-KK-02',
        businessType: 'Renewal Business',
        value: 21000000000,
        status: 'On Process Teknik',
        lapseDays: 22
      },
      {
        picUserId: 'USR-000020',
        customerName: 'PT Tunas Industri Nasional',
        productId: 'PRD-JK-03',
        businessType: 'New Business',
        value: 17000000000,
        status: 'Dokumen Diajukan oleh Marketing',
        lapseDays: 2
      },
      {
        picUserId: 'USR-000019',
        customerName: 'PT Sehat Bersama Indonesia',
        productId: 'PRD-KK-02',
        businessType: 'Renewal Business',
        value: 13000000000,
        status: 'Menunggu Upload Dokumen Closing',
        lapseDays: 8
      },

      {
        picUserId: 'USR-000022',
        customerName: 'PT Artha Media Nusantara',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 25000000000,
        status: 'Penawaran Telah Terbit',
        lapseDays: 11
      },
      {
        picUserId: 'USR-000023',
        customerName: 'PT Prima Tambang Indonesia',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 19000000000,
        status: 'Menunggu Feedback / Konfirmasi Klien',
        lapseDays: 62
      },
      {
        picUserId: 'USR-000022',
        customerName: 'PT Karya Sumber Daya',
        productId: 'PRD-JK-07',
        businessType: 'New Business',
        value: 14000000000,
        status: 'Menunggu Final Approval Team Leader Marketing Support',
        lapseDays: 3
      },

      {
        picUserId: 'USR-000002',
        customerName: 'PT Advisory Health Partner',
        productId: 'PRD-KI-01',
        businessType: 'New Business',
        value: 5000000000,
        status: 'Menunggu Feedback / Konfirmasi Klien',
        lapseDays: 6
      },

      // WIN - sebagian sudah punya invoice, sebagian pending invoice
      {
        picUserId: 'USR-000005',
        customerName: 'PT Elnusa Services UAT',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 35000000000,
        status: 'WIN',
        lapseDays: 5
      },
      {
        picUserId: 'USR-000006',
        customerName: 'PT Kilang Jasa UAT',
        productId: 'PRD-JK-05',
        businessType: 'New Business',
        value: 20000000000,
        status: 'WIN',
        lapseDays: 4
      },
      {
        picUserId: 'USR-000009',
        customerName: 'PT Penerbangan Energi UAT',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 28000000000,
        status: 'WIN',
        lapseDays: 6
      },
      {
        picUserId: 'USR-000013',
        customerName: 'PT Offshore Benefit UAT',
        productId: 'PRD-KK-02',
        businessType: 'Renewal Business',
        value: 32000000000,
        status: 'WIN',
        lapseDays: 7
      },
      {
        picUserId: 'USR-000016',
        customerName: 'PT Digital Network UAT',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 25000000000,
        status: 'WIN',
        lapseDays: 3
      },
      {
        picUserId: 'USR-000017',
        customerName: 'PT Petrochemical Benefit UAT',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 18000000000,
        status: 'WIN',
        lapseDays: 8
      },
      {
        picUserId: 'USR-000019',
        customerName: 'PT Healthcare Partner UAT',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 24000000000,
        status: 'WIN',
        lapseDays: 4
      },
      {
        picUserId: 'USR-000020',
        customerName: 'PT Industrial Benefit UAT',
        productId: 'PRD-JK-06',
        businessType: 'Renewal Business',
        value: 16000000000,
        status: 'WIN',
        lapseDays: 9
      },
      {
        picUserId: 'USR-000022',
        customerName: 'PT Media Protection UAT',
        productId: 'PRD-JK-05',
        businessType: 'New Business',
        value: 22000000000,
        status: 'WIN',
        lapseDays: 5,
        winPending: true
      },
      {
        picUserId: 'USR-000002',
        customerName: 'PT Strategic Advisory UAT',
        productId: 'PRD-KI-01',
        businessType: 'Renewal Business',
        value: 4000000000,
        status: 'WIN',
        lapseDays: 3
      },
      {
        picUserId: 'USR-000002',
        customerName: 'PT Advisor Prospect UAT',
        productId: 'PRD-JI-04',
        businessType: 'New Business',
        value: 3000000000,
        status: 'WIN',
        lapseDays: 2,
        winPending: true
      },

      // LOSE
      {
        picUserId: 'USR-000005',
        customerName: 'PT Price Sensitive UAT',
        productId: 'PRD-KK-01',
        businessType: 'New Business',
        value: 12000000000,
        status: 'LOSE',
        lapseDays: 20,
        loseReason: 'Premi terlalu mahal / kalah price',
        loseNotes: 'Kompetitor memberikan harga lebih rendah.'
      },
      {
        picUserId: 'USR-000009',
        customerName: 'PT Tender Loss UAT',
        productId: 'PRD-JK-05',
        businessType: 'Renewal Business',
        value: 10000000000,
        status: 'LOSE',
        lapseDays: 30,
        loseReason: 'Kompetitor lebih unggul',
        loseNotes: 'Nilai teknis dan harga kompetitor lebih unggul.'
      },
      {
        picUserId: 'USR-000016',
        customerName: 'PT Benefit Mismatch UAT',
        productId: 'PRD-KK-02',
        businessType: 'New Business',
        value: 14000000000,
        status: 'LOSE',
        lapseDays: 18,
        loseReason: 'Keterbatasan coverage / benefit',
        loseNotes: 'Struktur benefit final tidak sesuai kebutuhan klien.'
      },
      {
        picUserId: 'USR-000019',
        customerName: 'PT Document Issue UAT',
        productId: 'PRD-JK-03',
        businessType: 'Renewal Business',
        value: 9000000000,
        status: 'LOSE',
        lapseDays: 24,
        loseReason: 'Gagal kualifikasi tender',
        loseNotes: 'Dokumen tender tidak dapat dilengkapi sesuai deadline.'
      },
      {
        picUserId: 'USR-000023',
        customerName: 'PT Priority Change UAT',
        productId: 'PRD-JK-07',
        businessType: 'New Business',
        value: 11000000000,
        status: 'LOSE',
        lapseDays: 16,
        loseReason: 'Anggaran klien dibatalkan',
        loseNotes: 'Klien menunda program proteksi ke tahun berikutnya.'
      }
    ];

    const dummyPipelines: any[] =
      pipelineDefinitions.map(
        (
          definition,
          index
        ) => {
          const pic =
            userById(
              definition.picUserId
            );

          const product =
            productById(
              definition.productId
            );

          const id =
            `PL-2026-${String(
              index + 1
            ).padStart(5, '0')}`;

          const base: any = {
            id,
            source:
              definition.source ||
              (
                index % 2 === 0
                  ? 'RKAP_BULK'
                  : 'BOOKING_CASE'
              ),
            businessType:
              definition.businessType,
            customerName:
              definition.customerName,
            insuranceType:
              product.insuranceType,
            customerCategory:
              product.customerCategory,
            productId:
              product.id,
            productName:
              product.productName,
            estimatedPremium:
              definition.value,
            currentCommercialValue:
              definition.value,
            originalTargetClosingDate:
              dateOnlyDaysFromNow(
                15 + index
              ),
            currentTargetClosingDate:
              dateOnlyDaysFromNow(
                15 + index
              ),
            isTender:
              definition.isTender ??
              (index % 3 === 0),
            channel:
              definition.channel ||
              (
                index % 4 === 0
                  ? 'Broker'
                  : 'Direct Selling'
              ),
            picUserId:
              pic.id,
            picName:
              pic.name,
            unit:
              pic.unit,
            department:
              pic.department,
            status:
              definition.status,
            currentHandler:
              this.deriveCurrentHandler(
                definition.status
              ),
            lastProgressAt:
              isoDaysAgo(
                definition.lapseDays
              ),
            dayLapse:
              definition.lapseDays,
            documents:
              [],
            quotations:
              definition.status ===
                'Penawaran Telah Terbit' ||
              definition.status ===
                'Menunggu Feedback / Konfirmasi Klien' ||
              definition.status ===
                'WIN'
                ? [
                    {
                      id:
                        `QT-${String(index + 1).padStart(3, '0')}`,
                      version:
                        1,
                      quotationDate:
                        dateOnlyDaysAgo(
                          definition.lapseDays + 2
                        ),
                      amount:
                        definition.value,
                      fileName:
                        `Quotation_${id}_v1.pdf`,
                      uploadedBy:
                        'Suci Yumarlia',
                      uploadedAt:
                        isoDaysAgo(
                          definition.lapseDays + 2
                        )
                    }
                  ]
                : [],
            createdAt:
              isoDaysAgo(
                definition.lapseDays + 20
              ),
            createdBy:
              pic.name
          };

          if (
            definition.status ===
            'Dalam Verifikasi Marketing Support'
          ) {
            base.outcomeRequest =
              index % 2 === 0
                ? 'WIN'
                : 'LOSE';
            base.outcomeWorkflowStatus =
              'PENDING_MS_VERIFICATION';
            base.outcomePreviousStatus =
              'Menunggu Feedback / Konfirmasi Klien';
            base.outcomeSubmittedBy =
              pic.id;
            base.outcomeSubmittedByName =
              pic.name;
            base.outcomeSubmittedAt =
              isoDaysAgo(
                Math.max(
                  0,
                  definition.lapseDays - 1
                )
              );
            base.outcomeWinningAmount =
              base.outcomeRequest === 'WIN'
                ? definition.value
                : undefined;
            base.outcomeLoseReason =
              base.outcomeRequest === 'LOSE'
                ? 'Premi terlalu mahal / kalah price'
                : undefined;
            base.outcomeLoseNotes =
              base.outcomeRequest === 'LOSE'
                ? 'UAT pending LOSE verification.'
                : undefined;
          }

          if (
            definition.status ===
            'Menunggu Final Approval Team Leader Marketing Support'
          ) {
            base.outcomeRequest =
              index % 2 === 0
                ? 'WIN'
                : 'LOSE';
            base.outcomeWorkflowStatus =
              'PENDING_TLMS_APPROVAL';
            base.outcomePreviousStatus =
              'Menunggu Feedback / Konfirmasi Klien';
            base.outcomeSubmittedBy =
              pic.id;
            base.outcomeSubmittedByName =
              pic.name;
            base.outcomeSubmittedAt =
              isoDaysAgo(
                Math.max(
                  0,
                  definition.lapseDays - 2
                )
              );
            base.outcomeWinningAmount =
              base.outcomeRequest === 'WIN'
                ? definition.value
                : undefined;
            base.outcomeLoseReason =
              base.outcomeRequest === 'LOSE'
                ? 'Premi terlalu mahal / kalah price'
                : undefined;
            base.outcomeLoseNotes =
              base.outcomeRequest === 'LOSE'
                ? 'UAT pending final LOSE approval.'
                : undefined;
            base.outcomeVerifiedBy =
              'USR-000025';
            base.outcomeVerifiedByName =
              'Suci Yumarlia';
            base.outcomeVerifiedAt =
              isoDaysAgo(
                Math.max(
                  0,
                  definition.lapseDays - 1
                )
              );
          }

          if (
            definition.status ===
            'WIN'
          ) {
            base.actualClosingDate =
              dateOnlyDaysAgo(
                definition.lapseDays
              );
            base.winDate =
              dateOnlyDaysAgo(
                definition.lapseDays
              );
            base.winningQuotationAmount =
              definition.value;
            base.winApprovedBy =
              'RR Endah Wasis Wuwuh Mumpuni';
            base.winApprovedAt =
              isoDaysAgo(
                Math.max(
                  0,
                  definition.lapseDays - 1
                )
              );
          }

          if (
            definition.status ===
            'LOSE'
          ) {
            base.loseDate =
              dateOnlyDaysAgo(
                definition.lapseDays
              );
            base.loseReason =
              definition.loseReason;
            base.loseEvaluationNotes =
              definition.loseNotes;
            base.loseLastStage =
              'Menunggu Feedback / Konfirmasi Klien';
            base.loseLastHandler =
              'CLIENT';
          }

          return base;
        }
      );

    localStorage.setItem(
      STORAGE_KEYS.PIPELINES,
      JSON.stringify(
        dummyPipelines
      )
    );

    // ==========================================================
    // 4. PRODUCTION
    // POSTED untuk executive dashboard + Pending Checker untuk MS.
    // ==========================================================

    const winPipelines =
      dummyPipelines.filter(
        pipeline =>
          pipeline.status === 'WIN'
      );

    const postedWinPipelines =
      winPipelines.filter(
        pipeline =>
          pipeline.customerName !==
            'PT Media Protection UAT' &&
          pipeline.customerName !==
            'PT Advisor Prospect UAT'
      );

    const dummyProductions: any[] =
      postedWinPipelines.map(
        (
          pipeline,
          index
        ) => ({
          id:
            `PTX-2026-${String(index + 1).padStart(5, '0')}`,
          pipelineId:
            pipeline.id,
          customerName:
            pipeline.customerName,
          productName:
            pipeline.productName,
          picUserId:
            pipeline.picUserId,
          picName:
            pipeline.picName,
          unit:
            pipeline.unit,
          department:
            pipeline.department,
          businessType:
            pipeline.businessType,
          corePolicyNumber:
            `POL/2026/UAT/${String(index + 1).padStart(5, '0')}`,
          coreInvoiceNumber:
            `INV/2026/UAT/${String(index + 1).padStart(5, '0')}`,
          invoiceDate:
            dateOnlyDaysAgo(
              20 - index
            ),
          productionMonth:
            Math.max(
              1,
              Math.min(
                12,
                now.getMonth() + 1
              )
            ),
          productionYear:
            2026,
          invoiceAmount:
            pipeline.winningQuotationAmount ||
            pipeline.currentCommercialValue,
          transactionType:
            pipeline.businessType ===
              'Renewal Business'
              ? 'Regular Renewal'
              : 'Initial Premium',
          makerUserId:
            index % 2 === 0
              ? 'USR-000026'
              : 'USR-000027',
          makerUserName:
            index % 2 === 0
              ? 'Ayu Evarinanty'
              : 'Ulfia Hegrina',
          makerTimestamp:
            isoDaysAgo(
              20 - index
            ),
          checkerUserId:
            'USR-000025',
          checkerUserName:
            'Suci Yumarlia',
          checkerTimestamp:
            isoDaysAgo(
              19 - index
            ),
          status:
            'POSTED',
          isDummy:
            true
        })
      );

    const pendingCheckerSeeds = [
      {
        customerName:
          'PT Pending Invoice Captive I',
        productName:
          'TM GROUP MEDICARE PLAN',
        picUserId:
          'USR-000005',
        picName:
          'Faisal Mahdi',
        unit:
          'Captive Marketing',
        department:
          'Captive I',
        businessType:
          'New Business',
        amount:
          7500000000,
        makerUserId:
          'USR-000026',
        makerUserName:
          'Ayu Evarinanty',
        age:
          2
      },
      {
        customerName:
          'PT Pending Invoice Captive III',
        productName:
          'TM GROUP TERM LIFE',
        picUserId:
          'USR-000013',
        picName:
          'Prisko Ginting',
        unit:
          'Captive Marketing',
        department:
          'Captive III',
        businessType:
          'Renewal Business',
        amount:
          6000000000,
        makerUserId:
          'USR-000027',
        makerUserName:
          'Ulfia Hegrina',
        age:
          3
      },
      {
        customerName:
          'PT Pending Invoice CRM I',
        productName:
          'TM GROUP MANAGED HEALTH CARE PLAN',
        picUserId:
          'USR-000016',
        picName:
          'Nadya Astriani Putri',
        unit:
          'Corporate & Retail Marketing',
        department:
          'CRM I',
        businessType:
          'New Business',
        amount:
          5500000000,
        makerUserId:
          'USR-000026',
        makerUserName:
          'Ayu Evarinanty',
        age:
          1
      },
      {
        customerName:
          'PT Pending Invoice CRM III',
        productName:
          'TM EXECUTIVE SEVERANCE PROGRAM',
        picUserId:
          'USR-000022',
        picName:
          'Anissa Faradina Razak',
        unit:
          'Corporate & Retail Marketing',
        department:
          'CRM III',
        businessType:
          'Renewal Business',
        amount:
          6500000000,
        makerUserId:
          'USR-000027',
        makerUserName:
          'Ulfia Hegrina',
        age:
          4
      }
    ];

    pendingCheckerSeeds.forEach(
      (
        seed,
        index
      ) => {
        dummyProductions.push({
          id:
            `PTX-2026-${String(
              postedWinPipelines.length +
              index +
              1
            ).padStart(5, '0')}`,
          pipelineId:
            `UAT-PENDING-${index + 1}`,
          customerName:
            seed.customerName,
          productName:
            seed.productName,
          picUserId:
            seed.picUserId,
          picName:
            seed.picName,
          unit:
            seed.unit,
          department:
            seed.department,
          businessType:
            seed.businessType,
          corePolicyNumber:
            `POL/2026/PENDING/${index + 1}`,
          coreInvoiceNumber:
            `INV/2026/PENDING/${index + 1}`,
          invoiceDate:
            dateOnlyDaysAgo(
              seed.age
            ),
          productionMonth:
            now.getMonth() + 1,
          productionYear:
            2026,
          invoiceAmount:
            seed.amount,
          transactionType:
            seed.businessType ===
              'Renewal Business'
              ? 'Regular Renewal'
              : 'Initial Premium',
          makerUserId:
            seed.makerUserId,
          makerUserName:
            seed.makerUserName,
          makerTimestamp:
            isoDaysAgo(
              seed.age
            ),
          status:
            'Pending Checker',
          isDummy:
            true
        });
      }
    );

    localStorage.setItem(
      STORAGE_KEYS.PRODUCTIONS,
      JSON.stringify(
        dummyProductions
      )
    );

    // ==========================================================
    // 5. PARTICIPANT ADDITION
    // Pending Verification, Needs Revision, Verified.
    // ==========================================================

    const dummyParticipants: any[] = [
      {
        id: 'PAR-2026-00001',
        customerName: 'PT Pertamina Marine Services',
        corePolicyNumber: 'POL/2026/UAT/00001',
        fileName: 'Peserta_Tambahan_PMS_Agustus.xlsx',
        participantCount: 24,
        uploadedBy: 'Ayu Evarinanty',
        uploadedAt: isoDaysAgo(3),
        status: 'Pending Verification'
      },
      {
        id: 'PAR-2026-00002',
        customerName: 'PT Nusantara Aviation Services',
        corePolicyNumber: 'POL/2026/UAT/00002',
        fileName: 'Mutasi_Peserta_NAS.xlsx',
        participantCount: 13,
        uploadedBy: 'Ulfia Hegrina',
        uploadedAt: isoDaysAgo(2),
        status: 'Pending Verification'
      },
      {
        id: 'PAR-2026-00003',
        customerName: 'PT Mandala Telekom Indonesia',
        corePolicyNumber: 'POL/2026/UAT/00003',
        fileName: 'Add_Peserta_Mandala.xlsx',
        participantCount: 9,
        uploadedBy: 'Ayu Evarinanty',
        uploadedAt: isoDaysAgo(1),
        status: 'Pending Verification'
      },
      {
        id: 'PAR-2026-00004',
        customerName: 'PT Metro Health Services',
        corePolicyNumber: 'POL/2026/UAT/00004',
        fileName: 'Mutasi_Metro_Rev.xlsx',
        participantCount: 17,
        uploadedBy: 'Ulfia Hegrina',
        uploadedAt: isoDaysAgo(5),
        status: 'Needs Revision',
        verificationNotes: 'Tanggal lahir beberapa peserta belum sesuai.'
      },
      {
        id: 'PAR-2026-00005',
        customerName: 'PT Artha Media Nusantara',
        corePolicyNumber: 'POL/2026/UAT/00005',
        fileName: 'Peserta_Artha_Rev.xlsx',
        participantCount: 8,
        uploadedBy: 'Ayu Evarinanty',
        uploadedAt: isoDaysAgo(4),
        status: 'Needs Revision',
        verificationNotes: 'Nomor identitas peserta belum lengkap.'
      },
      {
        id: 'PAR-2026-00006',
        customerName: 'PT Elnusa Services UAT',
        corePolicyNumber: 'POL/2026/UAT/00006',
        fileName: 'Peserta_Elnusa_Final.xlsx',
        participantCount: 31,
        uploadedBy: 'Ulfia Hegrina',
        uploadedAt: isoDaysAgo(8),
        verifiedBy: 'Suci Yumarlia',
        verifiedAt: isoDaysAgo(7),
        status: 'Verified'
      }
    ];

    localStorage.setItem(
      STORAGE_KEYS.PARTICIPANTS,
      JSON.stringify(
        dummyParticipants
      )
    );

    // ==========================================================
    // 6. ACTIVITIES
    // Banyak PIC + berbagai interaction + expense.
    // ==========================================================

    const activitySeeds = [
      ['USR-000005', 'PT Pertamina Marine Services', 'Meeting', 'In-Person / Offline', 450000, 'TM GROUP MEDICARE PLAN'],
      ['USR-000006', 'PT Patra Terminal Energi', 'Courtesy Call', 'Online Meeting', 0, 'TM EXECUTIVE SEVERANCE PROGRAM'],
      ['USR-000009', 'PT Nusantara Aviation Services', 'Presentation', 'In-Person / Offline', 625000, 'TM GROUP MEDICARE PLAN'],
      ['USR-000013', 'PT Pertamina Offshore Services', 'Meeting', 'In-Person / Offline', 380000, 'TM GROUP MEDICARE PLAN'],
      ['USR-000016', 'PT Mandala Telekom Indonesia', 'Presentation', 'Online Meeting', 0, 'TM GROUP MEDICARE PLAN'],
      ['USR-000017', 'PT Mitra Petrochem Nasional', 'Courtesy Call', 'Phone Call', 0, 'TM EXECUTIVE SEVERANCE PROGRAM'],
      ['USR-000019', 'PT Metro Health Services', 'Meeting', 'In-Person / Offline', 520000, 'TM GROUP MANAGED HEALTH CARE PLAN'],
      ['USR-000020', 'PT Tunas Industri Nasional', 'Presentation', 'In-Person / Offline', 475000, 'TM GROUP PERSONAL ACCIDENT'],
      ['USR-000022', 'PT Artha Media Nusantara', 'Meeting', 'Online Meeting', 0, 'TM GROUP MEDICARE PLAN'],
      ['USR-000023', 'PT Prima Tambang Indonesia', 'Courtesy Call', 'Phone Call', 0, 'TM EXECUTIVE SEVERANCE PROGRAM'],
      ['USR-000002', 'PT Advisory Health Partner', 'Meeting', 'In-Person / Offline', 350000, 'TM HEALTH GUARD'],
      ['USR-000005', 'PT Price Sensitive UAT', 'Other', 'Online Meeting', 0, 'TM GROUP MEDICARE PLAN'],
      ['USR-000009', 'PT Tender Loss UAT', 'Other', 'In-Person / Offline', 275000, 'TM GROUP TERM LIFE'],
      ['USR-000016', 'PT Benefit Mismatch UAT', 'Other', 'Online Meeting', 0, 'TM GROUP MANAGED HEALTH CARE PLAN'],
      ['USR-000019', 'PT Document Issue UAT', 'Meeting', 'In-Person / Offline', 425000, 'TM GROUP PERSONAL ACCIDENT'],
      ['USR-000022', 'PT Karya Sumber Daya', 'Courtesy Call', 'Phone Call', 0, 'MANDIRI ASURANSI PESANGON SEJAHTERA']
    ] as const;

    const dummyActivities: any[] =
      activitySeeds.map(
        (
          seed,
          index
        ) => {
          const [
            ownerUserId,
            companyName,
            activityType,
            interactionMethod,
            expenseAmount,
            discussedProduct
          ] = seed;

          const owner =
            userById(
              ownerUserId
            );

          return {
            id:
              `ACT-2026-${String(index + 1).padStart(5, '0')}`,
            activityDate:
              dateOnlyDaysAgo(
                index % 12
              ),
            startTime:
              index % 2 === 0
                ? '09:00'
                : '14:00',
            endTime:
              index % 2 === 0
                ? '11:00'
                : '16:00',
            activityType,
            interactionMethod,
            companyName,
            personMet:
              index % 2 === 0
                ? 'Bpk. Hendra'
                : 'Ibu Rina',
            positionMet:
              index % 3 === 0
                ? 'VP Human Capital'
                : 'Manager HR & GA',
            location:
              interactionMethod ===
                'In-Person / Offline'
                ? 'Jakarta'
                : 'Online',
            purpose:
              'Follow up kebutuhan proteksi, benefit, pricing, dan next action.',
            discussedProduct,
            relatedPipelineId:
              dummyPipelines[
                index %
                dummyPipelines.length
              ]?.id,
            agenda:
              'Pembahasan kebutuhan nasabah, status penawaran, dan tindak lanjut.',
            hasExpense:
              expenseAmount > 0,
            expenseAmount,
            status:
              'Completed',
            ownerUserId:
              owner.id,
            ownerName:
              owner.name,
            unit:
              owner.unit,
            department:
              owner.department,
            taggedUserIds:
              owner.unit ===
                'Captive Marketing'
                ? ['USR-000025']
                : ['USR-000026'],
            createdAt:
              isoDaysAgo(
                index % 12
              )
          };
        }
      );

    localStorage.setItem(
      STORAGE_KEYS.ACTIVITIES,
      JSON.stringify(
        dummyActivities
      )
    );

    const dummyActivityComments: ActivityComment[] = [
      {
        id: 'ACTC-001',
        activityId: 'ACT-2026-00001',
        authorId: 'USR-000004',
        authorName: 'Diyaul Miqdas',
        authorRole: userById('USR-000004').role,
        commentText: 'Mohon follow up quotation maksimal minggu ini.',
        timestamp: isoDaysAgo(1)
      },
      {
        id: 'ACTC-002',
        activityId: 'ACT-2026-00003',
        authorId: 'USR-000007',
        authorName: 'Resty Irma Aria',
        authorRole: userById('USR-000007').role,
        commentText: 'Benefit sudah sesuai, fokuskan pada closing date.',
        timestamp: isoDaysAgo(2)
      },
      {
        id: 'ACTC-003',
        activityId: 'ACT-2026-00007',
        authorId: 'USR-000018',
        authorName: 'Larmo',
        authorRole: userById('USR-000018').role,
        commentText: 'Pastikan catatan meeting dilengkapi sebelum reimbursement.',
        timestamp: isoDaysAgo(3)
      }
    ];

    localStorage.setItem(
      STORAGE_KEYS.ACTIVITY_COMMENTS,
      JSON.stringify(
        dummyActivityComments
      )
    );

    // ==========================================================
    // 7. REIMBURSEMENT
    // Cover queue Marketing Support & final approval TL MS.
    // ==========================================================

    const reimbursementSeeds: Array<{
      userId: string;
      activityId: string;
      companyName: string;
      amount: number;
      status: Reimbursement['status'];
      age: number;
    }> = [
      {
        userId: 'USR-000005',
        activityId: 'ACT-2026-00001',
        companyName: 'PT Pertamina Marine Services',
        amount: 450000,
        status: 'Submitted',
        age: 3
      },
      {
        userId: 'USR-000009',
        activityId: 'ACT-2026-00003',
        companyName: 'PT Nusantara Aviation Services',
        amount: 625000,
        status: 'Approved Superior',
        age: 4
      },
      {
        userId: 'USR-000013',
        activityId: 'ACT-2026-00004',
        companyName: 'PT Pertamina Offshore Services',
        amount: 380000,
        status: 'Verified MS',
        age: 5
      },
      {
        userId: 'USR-000019',
        activityId: 'ACT-2026-00007',
        companyName: 'PT Metro Health Services',
        amount: 520000,
        status: 'Submitted',
        age: 2
      },
      {
        userId: 'USR-000020',
        activityId: 'ACT-2026-00008',
        companyName: 'PT Tunas Industri Nasional',
        amount: 475000,
        status: 'Approved Superior',
        age: 3
      },
      {
        userId: 'USR-000002',
        activityId: 'ACT-2026-00011',
        companyName: 'PT Advisory Health Partner',
        amount: 350000,
        status: 'Verified MS',
        age: 6
      },
      {
        userId: 'USR-000009',
        activityId: 'ACT-2026-00013',
        companyName: 'PT Tender Loss UAT',
        amount: 275000,
        status: 'Paid Finance',
        age: 12
      },
      {
        userId: 'USR-000019',
        activityId: 'ACT-2026-00015',
        companyName: 'PT Document Issue UAT',
        amount: 425000,
        status: 'Rejected',
        age: 10
      }
    ];

    const dummyReimbursements: Reimbursement[] =
      reimbursementSeeds.map(
        (
          seed,
          index
        ) => {
          const user =
            userById(
              seed.userId
            );

          const relatedActivity =
            dummyActivities.find(
              activity =>
                activity.id ===
                seed.activityId
            );

          return {
            id:
              `RMB-2026-${String(index + 1).padStart(5, '0')}`,
            activityId:
              seed.activityId,
            activityDate:
              relatedActivity?.activityDate ||
              dateOnlyDaysAgo(
                seed.age
              ),
            companyName:
              seed.companyName,
            userId:
              user.id,
            userName:
              user.name,
            unit:
              user.unit,
            reimbursementType:
              index % 2 === 0
                ? 'Transport / Taxi / Online Transport'
                : 'Konsumsi',
            amount:
              seed.amount,
            description:
              'Biaya aktivitas marketing UAT',
            receiptFileName:
              `Receipt_RMB_${index + 1}.pdf`,
            status:
              seed.status,
            superiorApprovedBy:
              seed.status !==
                'Submitted'
                ? user.superiorId ||
                  undefined
                : undefined,
            superiorApprovedAt:
              seed.status !==
                'Submitted'
                ? isoDaysAgo(
                    Math.max(
                      0,
                      seed.age - 1
                    )
                  )
                : undefined,
            msVerifiedBy:
              seed.status ===
                'Verified MS' ||
              seed.status ===
                'Approved TL MS' ||
              seed.status ===
                'Paid Finance'
                ? 'Suci Yumarlia'
                : undefined,
            msVerifiedAt:
              seed.status ===
                'Verified MS' ||
              seed.status ===
                'Approved TL MS' ||
              seed.status ===
                'Paid Finance'
                ? isoDaysAgo(
                    Math.max(
                      0,
                      seed.age - 2
                    )
                  )
                : undefined,
            tlApprovedBy:
              seed.status ===
                'Approved TL MS' ||
              seed.status ===
                'Paid Finance'
                ? 'Arianie Fajarwati'
                : undefined,
            tlApprovedAt:
              seed.status ===
                'Approved TL MS' ||
              seed.status ===
                'Paid Finance'
                ? isoDaysAgo(
                    Math.max(
                      0,
                      seed.age - 3
                    )
                  )
                : undefined,
            financePaidBy:
              seed.status ===
                'Paid Finance'
                ? 'Finance Offline'
                : undefined,
            financePaidAt:
              seed.status ===
                'Paid Finance'
                ? isoDaysAgo(
                    Math.max(
                      0,
                      seed.age - 4
                    )
                  )
                : undefined,
            createdAt:
              isoDaysAgo(
                seed.age
              )
          };
        }
      );

    localStorage.setItem(
      STORAGE_KEYS.REIMBURSEMENTS,
      JSON.stringify(
        dummyReimbursements
      )
    );

    // ==========================================================
    // 8. APPEALS
    // ==========================================================

    const dummyAppeals: any[] = [
      {
        id: 'APL-2026-00001',
        pipelineId: 'PL-2026-00034',
        submittedByUserId: 'USR-000005',
        submittedByName: 'Faisal Mahdi',
        reason: 'Nasabah membuka kembali pembahasan setelah revisi harga.',
        attachmentFileName: 'Reopen_Request_001.pdf',
        status: 'Pending',
        createdAt: isoDaysAgo(3)
      },
      {
        id: 'APL-2026-00002',
        pipelineId: 'PL-2026-00036',
        submittedByUserId: 'USR-000016',
        submittedByName: 'Nadya Astriani Putri',
        reason: 'Benefit alternatif sudah disetujui untuk dibahas ulang.',
        attachmentFileName: 'Reopen_Request_002.pdf',
        status: 'Approved',
        createdAt: isoDaysAgo(8)
      }
    ];

    localStorage.setItem(
      STORAGE_KEYS.APPEALS,
      JSON.stringify(
        dummyAppeals
      )
    );

    // ==========================================================
    // 9. HISTORICAL PRODUCTION
    // Seed 2022-2025 untuk future Historical / YoY.
    // ==========================================================

    const historicalUnits = [
      {
        unit: 'Captive Marketing',
        department: 'Captive I',
        base: 115000000000
      },
      {
        unit: 'Captive Marketing',
        department: 'Captive II',
        base: 105000000000
      },
      {
        unit: 'Captive Marketing',
        department: 'Captive III',
        base: 120000000000
      },
      {
        unit: 'Corporate & Retail Marketing',
        department: 'CRM I',
        base: 85000000000
      },
      {
        unit: 'Corporate & Retail Marketing',
        department: 'CRM II',
        base: 76000000000
      },
      {
        unit: 'Corporate & Retail Marketing',
        department: 'CRM III',
        base: 80000000000
      },
      {
        unit: 'Advisor Pemasaran',
        department: 'None',
        base: 12000000000
      }
    ];

    const dummyHistorical: any[] = [];

    [2022, 2023, 2024, 2025].forEach(
      (
        year,
        yearIndex
      ) => {
        historicalUnits.forEach(
          (
            item,
            unitIndex
          ) => {
            const annualValue =
              Math.round(
                item.base *
                (
                  0.78 +
                  yearIndex * 0.07 +
                  unitIndex * 0.005
                )
              );

            dummyHistorical.push({
              id:
                `HIST-${year}-${String(unitIndex + 1).padStart(2, '0')}`,
              batchId:
                `BATCH-HIST-UAT-${year}`,
              year,
              productionYear:
                year,
              month:
                12,
              productionMonth:
                12,
              unit:
                item.unit,
              department:
                item.department,
              businessType:
                'OVERALL',
              premiumAmount:
                annualValue,
              productionAmount:
                annualValue,
              invoiceAmount:
                annualValue,
              sourceFile:
                `Historical_UAT_${year}.xlsx`,
              uploadedBy:
                'Arianie Fajarwati',
              uploadedAt:
                isoDaysAgo(
                  20 + yearIndex
                )
            });
          }
        );
      }
    );

    localStorage.setItem(
      STORAGE_KEYS.HISTORICAL,
      JSON.stringify(
        dummyHistorical
      )
    );

    // ==========================================================
    // 10. NOTIFICATIONS
    // ==========================================================

    const dummyNotifications: any[] = [
      {
        id: 'NOTIF-UAT-001',
        recipientUserId: this.getEffectiveApproverUserId('USR-000028'),
        title: 'Final Approval Booking',
        message: '3 Booking Case memerlukan final approval Department Head Marketing Administration.',
        linkPath: '/booking-pipeline?tab=verifier',
        isRead: false,
        createdAt: isoDaysAgo(0)
      },
      {
        id: 'NOTIF-UAT-002',
        recipientUserId: 'USR-000025',
        title: 'Pending Checker Produksi',
        message: '4 transaksi produksi menunggu proses checker.',
        linkPath: '/produksi?tab=maker_checker',
        isRead: false,
        createdAt: isoDaysAgo(0)
      },
      {
        id: 'NOTIF-UAT-003',
        recipientUserId: 'USR-000026',
        title: 'Shared Booking Queue',
        message: 'Terdapat Booking Case baru yang belum di-claim.',
        linkPath: '/booking-pipeline?tab=verifier',
        isRead: false,
        createdAt: isoDaysAgo(1)
      },
      {
        id: 'NOTIF-UAT-004',
        recipientUserId: 'USR-000027',
        title: 'Peserta Tambahan',
        message: 'Berkas peserta tambahan menunggu verifikasi.',
        linkPath: '/produksi',
        isRead: false,
        createdAt: isoDaysAgo(1)
      },
      {
        id: 'NOTIF-UAT-005',
        recipientUserId: 'USR-000005',
        title: 'Pipeline Perlu Follow-Up',
        message: 'Terdapat pipeline dengan day lapse lebih dari 30 hari.',
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: false,
        createdAt: isoDaysAgo(1)
      },
      {
        id: 'NOTIF-UAT-006',
        recipientUserId: 'USR-000016',
        title: 'Quotation Terbit',
        message: 'Quotation UAT telah terbit dan siap disampaikan ke calon nasabah.',
        linkPath: '/booking-pipeline?tab=pipeline',
        isRead: true,
        createdAt: isoDaysAgo(2)
      }
    ];

    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(
        dummyNotifications
      )
    );

    // ==========================================================
    // 11. AUDIT LOG
    // Supaya menu Admin > Audit Log juga langsung ramai.
    // ==========================================================

    const auditActors = [
      userById('USR-000024'),
      userById('USR-000028'),
      userById('USR-000025'),
      userById('USR-000026'),
      userById('USR-000027'),
      userById('USR-000005'),
      userById('USR-000016')
    ];

    const auditModules = [
      'BOOKING',
      'PIPELINE',
      'PRODUCTION',
      'ACTIVITY',
      'REIMBURSEMENT',
      'PARTICIPANT'
    ];

    const dummyAuditLogs: any[] =
      Array.from(
        { length: 24 },
        (
          _,
          index
        ) => {
          const actor =
            auditActors[
              index %
              auditActors.length
            ];

          const module =
            auditModules[
              index %
              auditModules.length
            ];

          return {
            id:
              `AUD-UAT-${String(index + 1).padStart(4, '0')}`,
            timestamp:
              isoDaysAgo(
                index % 10
              ),
            userId:
              actor.id,
            userName:
              actor.name,
            userRole:
              actor.role,
            module,
            action:
              index % 3 === 0
                ? 'CREATE'
                : index % 3 === 1
                ? 'UPDATE_STATUS'
                : 'VERIFY',
            recordType:
              module,
            recordId:
              `UAT-${module}-${index + 1}`,
            previousValue:
              index % 3 === 1
                ? 'Previous Status'
                : undefined,
            newValue:
              'UAT Sample',
            reason:
              'UAT scenario testing',
            fileReference:
              'Generated by UAT dummy generator'
          };
        }
      );

    localStorage.setItem(
      STORAGE_KEYS.AUDIT_LOGS,
      JSON.stringify(
        dummyAuditLogs
      )
    );

    this.addAuditLog(
      'SYSTEM',
      'GENERATE_DUMMY',
      'System',
      'ALL',
      undefined,
      'Generated',
      undefined,
      `Generated expanded UAT dataset: ${dummyBookings.length} bookings, ${dummyPipelines.length} pipelines, ${dummyProductions.length} productions, ${dummyParticipants.length} participant files, ${dummyActivities.length} activities, ${dummyReimbursements.length} reimbursements. Existing published target preserved.`
    );

    this.notify();
  }

  private async clearPrototypeFileStorage(): Promise<void> {
    if (
      typeof indexedDB ===
      'undefined'
    ) {
      return;
    }

    const databaseNames = [
      'pertalife_marketing_os_files',
      'pertalife_pipeline_files',
      'pertalife_document_handover_files',
    ];

    for (
      const databaseName of
      databaseNames
    ) {
      await new Promise<void>(
        (
          resolve,
          reject
        ) => {
          const request =
            indexedDB.deleteDatabase(
              databaseName
            );

          request.onsuccess =
            () =>
              resolve();

          request.onerror =
            () =>
              reject(
                request.error ||
                  new Error(
                    `Gagal menghapus file prototype dari IndexedDB ${databaseName}.`
                  )
              );

          request.onblocked =
            () =>
              reject(
                new Error(
                  `Reset file prototype terblokir pada ${databaseName}. Tutup tab Dashboard lain lalu coba Reset kembali.`
                )
              );
        }
      );
    }
  }

  public async resetDataDummy(): Promise<void> {
    // ============================================================
    // PROTOTYPE FACTORY RESET
    // ============================================================
    // Hanya mempertahankan / merestore canonical master:
    // 1. User Master + User Master version
    // 2. Product Master + version
    // 3. Broker Master + version
    // 4. Agent Master + version
    // 5. Current login session agar Admin tidak langsung logout.
    //
    // Seluruh data UAT/setup bisnis, upload, aktivitas, notification,
    // per-user local state, dan audit trail dihapus sampai kondisi 0.
    //
    // Supporting Document binary file juga dihapus dari IndexedDB.
    // ============================================================

    await this.clearPrototypeFileStorage();

    const preservedKeys =
      new Set<string>([
        STORAGE_KEYS.CURRENT_USER_ID,
        STORAGE_KEYS.USERS,
        STORAGE_KEYS.USER_MASTER_VERSION,
        STORAGE_KEYS.PRODUCTS,
        STORAGE_KEYS.PRODUCT_MASTER_VERSION,
        STORAGE_KEYS.BROKERS,
        STORAGE_KEYS.BROKER_MASTER_VERSION,
        STORAGE_KEYS.AGENTS,
        STORAGE_KEYS.AGENT_MASTER_VERSION,
      ]);

    const keysToRemove:
      string[] = [];

    for (
      let index = 0;
      index <
      localStorage.length;
      index += 1
    ) {
      const key =
        localStorage.key(
          index
        );

      if (
        key &&
        key.startsWith(
          'pertalife_'
        ) &&
        !preservedKeys.has(
          key
        )
      ) {
        keysToRemove.push(
          key
        );
      }
    }

    keysToRemove.forEach(
      key =>
        localStorage.removeItem(
          key
        )
    );

    // Restore only canonical master data.
    localStorage.setItem(
      STORAGE_KEYS.USERS,
      JSON.stringify(
        BASELINE_USERS
      )
    );

    localStorage.setItem(
      STORAGE_KEYS.USER_MASTER_VERSION,
      USER_MASTER_VERSION
    );


    localStorage.setItem(
      STORAGE_KEYS.PRODUCTS,
      JSON.stringify(
        BASELINE_PRODUCTS
      )
    );

    localStorage.setItem(
      STORAGE_KEYS.BROKERS,
      JSON.stringify(
        BASELINE_BROKERS
      )
    );

    localStorage.setItem(
      STORAGE_KEYS.BROKER_MASTER_VERSION,
      BROKER_MASTER_VERSION
    );

    localStorage.setItem(
      STORAGE_KEYS.AGENTS,
      JSON.stringify(
        BASELINE_AGENTS
      )
    );

    localStorage.setItem(
      STORAGE_KEYS.AGENT_MASTER_VERSION,
      AGENT_MASTER_VERSION
    );

    // IMPORTANT:
    // Jangan membuat Audit Log RESET_DUMMY baru.
    // Tujuan tombol ini adalah mengembalikan prototype ke kondisi 0,
    // sehingga Audit Trail setelah reset harus benar-benar kosong.

    this.notify();
  }

}

export const store = new StoreService();