import React, { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { store } from '@/services/store';
import {
  BookingCase,
  BusinessType,
  CustomerCategory,
  DistributionChannel,
  InsuranceType,
  LoseReason,
  Pipeline,
  PipelineCanonicalStatus,
  PipelineDocument,
  User,
} from '@/types';
import { formatRupiah } from '@/utils/formatters';
import {
  formatRupiahInput,
  sanitizeRupiahInput,
} from '@/utils/currencyInput';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileUp,
  History,
  Layers,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BrokerCombobox } from '@/components/common/BrokerCombobox';
import { BrokerMaster } from '@/data/brokerMasterData';
import { AgentCombobox } from '@/components/common/AgentCombobox';
import { AgentMaster } from '@/data/agentMasterData';
import {
  downloadOutcomeDocumentFile,
  downloadQuotationFile,
  saveOutcomeDocumentFile,
  saveQuotationFile,
  saveQuotationRevisionFile,
  downloadQuotationRevisionFile,
} from '@/services/pipelineFileStorage';

const MARKETING_ACTION_ROLES = [
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
] as const;

const OUTCOME_ELIGIBLE_STATUSES: PipelineCanonicalStatus[] = [
  'Menunggu Feedback / Konfirmasi Klien',
  'Menunggu Upload Dokumen Closing',
];

type RenewalTypeValue =
  | 'Regular Renewal'
  | 'Salary / Exposure Adjustment'
  | 'Benefit Adjustment'
  | 'Other Renewal';

interface BrokerBookingMetadata {
  brokerId?: string;
  brokerName?: string;
  brokerLicenseNumber?: string;
}

interface AgentBookingMetadata {
  agentId?: string;
  agentName?: string;
  agentCode?: string;
  agentLicenseNumber?: string;
}

type BookingWithIntermediary =
  BookingCase &
  BrokerBookingMetadata &
  AgentBookingMetadata;

type PipelineWithIntermediary =
  Pipeline &
  BrokerBookingMetadata &
  AgentBookingMetadata;

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

type PipelineTimelineEntry = {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole?: string;
  title: string;
  description?: string;
  previousValue?: string;
  newValue?: string;
  category:
    | 'BOOKING'
    | 'PIPELINE'
    | 'DOCUMENT'
    | 'QUOTATION'
    | 'OUTCOME';
  downloadableDocument?: {
    kind:
      | 'MARKETING_DOCUMENT'
      | 'QUOTATION'
      | 'QUOTATION_REVISION'
      | 'OUTCOME_DOCUMENT';
    documentId: string;
    fileName: string;
    quotationId?: string;
  };
};

const BOOKING_STEPS = [
  {
    number: 1,
    label: 'Jenis',
  },
  {
    number: 2,
    label: 'Kategori',
  },
  {
    number: 3,
    label: 'Produk & Bisnis',
  },
  {
    number: 4,
    label: 'Detail Penawaran',
  },
  {
    number: 5,
    label: 'Review',
  },
] as const;

export const BookingPipelinePage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(
    store.getCurrentUser()
  );

  const [bookings, setBookings] = useState<BookingCase[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);

  // Booking Wizard State
  const [bookingModalOpen, setBookingModalOpen] =
    useState(false);

  const [bookingStep, setBookingStep] =
    useState(1);

  const [insuranceType, setInsuranceType] =
    useState<InsuranceType | ''>('');

  const [customerCategory, setCustomerCategory] =
    useState<CustomerCategory | ''>('');

  const [selectedProductId, setSelectedProductId] =
    useState('');

  const [businessType, setBusinessType] =
    useState<BusinessType | ''>('');

  const [customerName, setCustomerName] =
    useState('');

  const [estimatedPremium, setEstimatedPremium] =
    useState('');

  const [targetClosingDate, setTargetClosingDate] =
    useState('');

  const [isTender, setIsTender] =
    useState(false);

  const [channel, setChannel] =
    useState<DistributionChannel>(
      'Direct Selling'
    );

  const [
    selectedBroker,
    setSelectedBroker,
  ] = useState<
    BrokerMaster | null
  >(null);

  const [
    selectedAgent,
    setSelectedAgent,
  ] = useState<
    AgentMaster | null
  >(null);

  const [bookingNotes, setBookingNotes] =
    useState('');

  const [existingPolicyNumber, setExistingPolicyNumber] =
    useState('');

  const [originalPolicyYear, setOriginalPolicyYear] =
    useState('');

  const [coverageStart, setCoverageStart] =
    useState('');

  const [coverageEnd, setCoverageEnd] =
    useState('');

  const [renewalType, setRenewalType] =
    useState<RenewalTypeValue>(
      'Regular Renewal'
    );

  const [dupWarning, setDupWarning] =
    useState(false);

  // Initial Marketing Document Upload
  const [selectedDocumentPipeline, setSelectedDocumentPipeline] =
    useState<Pipeline | null>(null);

  const [documentFiles, setDocumentFiles] =
    useState<File[]>([]);

  // Quotation issuance by Marketing Support
  const [selectedQuotationPipeline, setSelectedQuotationPipeline] =
    useState<Pipeline | null>(null);

  const [quotationFile, setQuotationFile] =
    useState<File | null>(null);

  const [quotationAmount, setQuotationAmount] =
    useState('');

  const [quotationNotes, setQuotationNotes] =
    useState('');

  const [selectedQuotationViewPipeline, setSelectedQuotationViewPipeline] =
    useState<Pipeline | null>(null);

  const [
    selectedQuotationRevisionPipeline,
    setSelectedQuotationRevisionPipeline,
  ] = useState<Pipeline | null>(null);

  const [
    quotationRevisionNotes,
    setQuotationRevisionNotes,
  ] = useState('');

  const [
    quotationRevisionFiles,
    setQuotationRevisionFiles,
  ] = useState<File[]>([]);

  // Outcome Submission Panel
  const [selectedOutcomePipeline, setSelectedOutcomePipeline] =
    useState<Pipeline | null>(null);

  const [selectedOutcomeType, setSelectedOutcomeType] =
    useState<'WIN' | 'LOSE' | null>(null);

  const [loseReason, setLoseReason] = useState<LoseReason>(
    'Premi terlalu mahal / kalah price'
  );

  const [loseNotes, setLoseNotes] = useState('');

  const [outcomeNotes, setOutcomeNotes] = useState('');

  const [outcomeFiles, setOutcomeFiles] =
    useState<File[]>([]);

  const [selectedOutcomeReviewPipeline, setSelectedOutcomeReviewPipeline] =
    useState<Pipeline | null>(null);

  const [outcomeReviewMode, setOutcomeReviewMode] =
    useState<'MS' | 'TLMS' | null>(null);

  const [
    selectedHistoryPipeline,
    setSelectedHistoryPipeline,
  ] = useState<Pipeline | null>(null);

  // List Focus & Sorting
  const [pipelineViewMode, setPipelineViewMode] =
    useState<'ALL' | 'ACTION_ONLY'>('ALL');

  const [pipelineSortMode, setPipelineSortMode] =
    useState<
      | 'ACTION_PRIORITY'
      | 'DAY_LAPSE'
      | 'COMMERCIAL_VALUE'
      | 'NEWEST'
    >('ACTION_PRIORITY');

  const [bookingViewMode, setBookingViewMode] =
    useState<'ALL' | 'ACTION_ONLY'>('ALL');

  const [bookingSortMode, setBookingSortMode] =
    useState<
      | 'ACTION_PRIORITY'
      | 'PREMIUM'
      | 'NEWEST'
    >('ACTION_PRIORITY');

  const [brokers, setBrokers] =
    useState<BrokerMaster[]>([]);

  const [brokerSearch, setBrokerSearch] =
    useState('');

  const [brokerStatusFilter, setBrokerStatusFilter] =
    useState<'ALL' | 'Active' | 'Inactive'>('ALL');

  const [editingBroker, setEditingBroker] =
    useState<BrokerMaster | null>(null);

  const [brokerFormOpen, setBrokerFormOpen] =
    useState(false);

  const [agents, setAgents] =
    useState<AgentMaster[]>([]);

  const [agentSearch, setAgentSearch] =
    useState('');

  const [agentStatusFilter, setAgentStatusFilter] =
    useState<'ALL' | 'Active' | 'Inactive'>('ALL');

  const [editingAgent, setEditingAgent] =
    useState<AgentMaster | null>(null);

  const [agentFormOpen, setAgentFormOpen] =
    useState(false);

  useEffect(() => {
    const refresh = () => {
      setCurrentUser(store.getCurrentUser());
      setBookings(store.getBookings());
      setPipelines(store.getPipelines());
      setBrokers(store.getBrokers());
      setAgents(store.getAgents());
    };

    refresh();

    return store.subscribe(refresh);
  }, []);

  // ============================================================
  // ROLE GOVERNANCE
  // ============================================================

  const isMarketingActionUser =
    MARKETING_ACTION_ROLES.includes(
      currentUser.role as
        (typeof MARKETING_ACTION_ROLES)[number]
    );

  const isMSVerifier =
    [
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029',
    ].includes(
      currentUser.id
    );

  // Compatibility variable name retained to minimize workflow churn.
  // Final Booking + WIN/LOSE approval now belongs to
  // RR Endah Wasis Wuwuh Mumpuni — DH Marketing Administration.
  const isTLMS =
    currentUser.id ===
    'USR-000028';

  const isMarketingSupportViewer =
    currentUser.unit ===
    'Marketing Support';

  const isSysAdmin =
    currentUser.role ===
    'SYSTEM_ADMIN';

  const emptyBrokerForm =
    (): BrokerMaster => ({
      id:
        `BRK-MANUAL-${Date.now()}`,
      companyName:
        '',
      licenseNumber:
        '',
      licenseDate:
        '',
      address:
        '',
      city:
        '',
      postalCode:
        '',
      phone1:
        '',
      phone2:
        '',
      fax:
        '',
      email:
        '',
      website:
        '',
      status:
        'Active',
      sourcePeriod:
        'Manual Update',
      sourceName:
        'Marketing Support Dashboard',
    });

  const filteredBrokers =
    brokers
      .filter(
        broker =>
          brokerStatusFilter ===
            'ALL' ||
          broker.status ===
            brokerStatusFilter
      )
      .filter(
        broker => {
          const query =
            brokerSearch
              .trim()
              .toLowerCase();

          if (!query) {
            return true;
          }

          return [
            broker.companyName,
            broker.licenseNumber,
            broker.city,
            broker.email,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        }
      );

  const openAddBroker =
    () => {
      setEditingBroker(
        emptyBrokerForm()
      );
      setBrokerFormOpen(
        true
      );
    };

  const openEditBroker =
    (broker: BrokerMaster) => {
      setEditingBroker({
        ...broker,
      });
      setBrokerFormOpen(
        true
      );
    };

  const handleSaveBroker =
    () => {
      if (
        !isMarketingSupportViewer
      ) {
        alert(
          'Master Broker hanya dapat dikelola oleh akun Marketing Support.'
        );
        return;
      }

      if (
        !editingBroker
      ) {
        return;
      }

      if (
        !editingBroker.companyName.trim()
      ) {
        alert(
          'Nama perusahaan broker wajib diisi.'
        );
        return;
      }

      try {
        const exists =
          brokers.some(
            broker =>
              broker.id ===
              editingBroker.id
          );

        if (exists) {
          store.updateBroker(
            editingBroker
          );
        } else {
          store.addBroker(
            editingBroker
          );
        }

        setBrokerFormOpen(
          false
        );
        setEditingBroker(
          null
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan Master Broker.'
        );
      }
    };

  const emptyAgentForm =
    (): AgentMaster => ({
      id:
        `AGT-MANUAL-${Date.now()}`,
      agentCode:
        '',
      agentName:
        '',
      insuranceCompany:
        'PT Perta Life Insurance',
      licenseNumber:
        '',
      licenseDate:
        '',
      licenseExpiryDate:
        '',
      email:
        '',
      status:
        'Active',
      sourcePeriod:
        'Manual Update',
      sourceName:
        'Marketing Support Dashboard',
    });

  const filteredAgents =
    agents
      .filter(
        agent =>
          agentStatusFilter ===
            'ALL' ||
          agent.status ===
            agentStatusFilter
      )
      .filter(
        agent => {
          const query =
            agentSearch
              .trim()
              .toLowerCase();

          if (!query) {
            return true;
          }

          return [
            agent.agentName,
            agent.agentCode,
            agent.licenseNumber,
            agent.email,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query);
        }
      );

  const agentLicenseReminders =
    isMarketingSupportViewer
      ? store.getAgentLicenseReminders(
          14
        )
      : [];

  const openAddAgent = () => {
    setEditingAgent(
      emptyAgentForm()
    );

    setAgentFormOpen(
      true
    );
  };

  const openEditAgent =
    (agent: AgentMaster) => {
      setEditingAgent({
        ...agent,
      });

      setAgentFormOpen(
        true
      );
    };

  const handleSaveAgent = () => {
    if (
      !isMarketingSupportViewer
    ) {
      alert(
        'Master Agent hanya dapat dikelola oleh akun Marketing Support.'
      );
      return;
    }

    if (!editingAgent) {
      return;
    }

    if (
      !editingAgent.agentCode.trim() ||
      !editingAgent.agentName.trim()
    ) {
      alert(
        'Kode Agent dan Nama Agent wajib diisi.'
      );
      return;
    }

    try {
      const exists =
        agents.some(
          agent =>
            agent.id ===
            editingAgent.id
        );

      if (exists) {
        store.updateAgent(
          editingAgent
        );
      } else {
        store.addAgent(
          editingAgent
        );
      }

      setAgentFormOpen(
        false
      );

      setEditingAgent(
        null
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan Master Agent.'
      );
    }
  };

  const visiblePipelines =
    useMemo(
      () =>
        pipelines.filter(
          (pipeline) =>
            isSysAdmin ||
            isMarketingSupportViewer ||
            store.isUserInScope(
              currentUser,
              pipeline.picUserId
            )
        ),
      [
        pipelines,
        currentUser,
        isSysAdmin,
        isMarketingSupportViewer,
      ]
    );

  const visibleBookings =
    useMemo(
      () =>
        bookings.filter(
          (booking) =>
            isSysAdmin ||
            isMarketingSupportViewer ||
            store.isUserInScope(
              currentUser,
              booking.picUserId
            )
        ),
      [
        bookings,
        currentUser,
        isSysAdmin,
        isMarketingSupportViewer,
      ]
    );

  // ============================================================
  // BOOKING WIZARD DATA & DUPLICATE CHECK
  // ============================================================

  const activeProducts =
    store
      .getProducts()
      .filter(
        (product) =>
          product.status ===
            'Active' &&
          (
            !insuranceType ||
            product.insuranceType ===
              insuranceType
          ) &&
          (
            !customerCategory ||
            product.customerCategory ===
              customerCategory
          )
      );

  const selectedProduct =
    store
      .getProducts()
      .find(
        (product) =>
          product.id ===
          selectedProductId
      );

  const normalizeOpportunityName = (
    value: string
  ) =>
    value
      .toLowerCase()
      .replace(
        /\b(pt|persero|tbk|cv)\b/g,
        ' '
      )
      .replace(
        /[^a-z0-9]+/g,
        ' '
      )
      .trim()
      .replace(
        /\s+/g,
        ' '
      );

  const evaluateBookingDuplicate = (
    name: string,
    productId:
      string = selectedProductId
  ) => {
    const normalized =
      normalizeOpportunityName(
        name
      );

    if (
      normalized.length <
        4 ||
      !productId
    ) {
      setDupWarning(
        false
      );

      return;
    }

    const exactDuplicate =
      pipelines.some(
        (pipeline) =>
          pipeline.productId ===
            productId &&
          normalizeOpportunityName(
            pipeline.customerName
          ) ===
            normalized
      ) ||
      bookings.some(
        (booking) =>
          booking.status !==
            'Rejected' &&
          booking.productId ===
            productId &&
          normalizeOpportunityName(
            booking.customerName
          ) ===
            normalized
      );

    setDupWarning(
      exactDuplicate
    );
  };

  const handleCustomerNameChange = (
    value: string
  ) => {
    setCustomerName(
      value
    );

    evaluateBookingDuplicate(
      value
    );
  };

  const resetBookingWizard =
    () => {
      setBookingStep(
        1
      );

      setInsuranceType(
        ''
      );

      setCustomerCategory(
        ''
      );

      setSelectedProductId(
        ''
      );

      setBusinessType(
        ''
      );

      setCustomerName(
        ''
      );

      setEstimatedPremium(
        ''
      );

      setTargetClosingDate(
        ''
      );

      setIsTender(
        false
      );

      setChannel(
        'Direct Selling'
      );

      setSelectedBroker(
        null
      );

      setSelectedAgent(
        null
      );

      setBookingNotes(
        ''
      );

      setExistingPolicyNumber(
        ''
      );

      setOriginalPolicyYear(
        ''
      );

      setCoverageStart(
        ''
      );

      setCoverageEnd(
        ''
      );

      setRenewalType(
        'Regular Renewal'
      );

      setDupWarning(
        false
      );
    };

  const openBookingWizard =
    () => {
      resetBookingWizard();
      setBookingModalOpen(
        true
      );
    };

  const closeBookingWizard =
    () => {
      setBookingModalOpen(
        false
      );
      resetBookingWizard();
    };

  const validateBookingStep =
    (
      step:
        number
    ) => {
      if (
        step === 1 &&
        !insuranceType
      ) {
        alert(
          'Pilih Jenis Asuransi terlebih dahulu.'
        );

        return false;
      }

      if (
        step === 2 &&
        !customerCategory
      ) {
        alert(
          'Pilih Kategori Nasabah terlebih dahulu.'
        );

        return false;
      }

      if (
        step === 3
      ) {
        if (
          !selectedProductId
        ) {
          alert(
            'Pilih Produk terlebih dahulu.'
          );

          return false;
        }

        if (
          !businessType
        ) {
          alert(
            'Pilih Jenis Bisnis New Business atau Renewal.'
          );

          return false;
        }
      }

      if (
        step === 4
      ) {
        if (
          !customerName.trim()
        ) {
          alert(
            'Nama Calon Nasabah wajib diisi.'
          );

          return false;
        }

        if (
          Number(
            estimatedPremium
          ) <= 0
        ) {
          alert(
            'Estimasi Premi harus lebih dari 0.'
          );

          return false;
        }

        if (
          !targetClosingDate
        ) {
          alert(
            'Target Closing wajib diisi.'
          );

          return false;
        }

        if (
          channel ===
          'Broker'
        ) {
          if (
            !selectedBroker
          ) {
            alert(
              'Pilih Broker dari Master Broker OJK terlebih dahulu.'
            );

            return false;
          }

          const latestBroker =
            store
              .getBrokers()
              .find(
                broker =>
                  broker.id ===
                    selectedBroker.id &&
                  broker.status ===
                    'Active'
              );

          if (
            !latestBroker
          ) {
            alert(
              'Broker yang dipilih sudah tidak aktif / tidak tersedia di Master Broker. Pilih broker aktif lainnya.'
            );

            return false;
          }
        }

        if (
          channel ===
          'Agent'
        ) {
          if (!selectedAgent) {
            alert(
              'Pilih Agent aktif terlebih dahulu.'
            );
            return false;
          }

          const latestAgent =
            store
              .getAgents()
              .find(
                agent =>
                  agent.id ===
                    selectedAgent.id &&
                  agent.status ===
                    'Active'
              );

          if (!latestAgent) {
            alert(
              'Agent yang dipilih sudah tidak aktif / tidak tersedia di Master Agent.'
            );
            return false;
          }
        }

        if (
          businessType ===
          'Renewal Business'
        ) {
          if (
            !existingPolicyNumber.trim()
          ) {
            alert(
              'Existing Policy Number wajib diisi untuk Renewal.'
            );

            return false;
          }

          if (
            !originalPolicyYear ||
            !coverageStart ||
            !coverageEnd ||
            !renewalType
          ) {
            alert(
              'Informasi polis existing dan coverage wajib dilengkapi untuk Renewal.'
            );

            return false;
          }

          if (
            coverageEnd <
            coverageStart
          ) {
            alert(
              'Coverage End tidak boleh lebih awal dari Coverage Start.'
            );

            return false;
          }
        }
      }

      return true;
    };

  const handleNextBookingStep =
    () => {
      if (
        !validateBookingStep(
          bookingStep
        )
      ) {
        return;
      }

      setBookingStep(
        (
          current
        ) =>
          Math.min(
            5,
            current + 1
          )
      );
    };

  const handlePreviousBookingStep =
    () => {
      setBookingStep(
        (
          current
        ) =>
          Math.max(
            1,
            current - 1
          )
      );
    };

  // ============================================================
  // CREATE BOOKING
  // ============================================================

  const handleCreateBooking =
    () => {
      if (
        !isMarketingActionUser
      ) {
        alert(
          'Booking Case hanya dapat dibuat oleh user Marketing operasional.'
        );

        return;
      }

      if (
        !validateBookingStep(
          4
        ) ||
        !insuranceType ||
        !customerCategory ||
        !selectedProduct ||
        !businessType
      ) {
        return;
      }

      if (
        dupWarning
      ) {
        const proceed =
          window.confirm(
            'Terdapat indikasi exact duplicate untuk kombinasi calon nasabah + produk. Tetap submit Booking Case untuk direview Marketing Support?'
          );

        if (
          !proceed
        ) {
          return;
        }
      }

      const newBooking:
        BookingWithIntermediary = {
        id:
          'BC-2026-' +
          Math.floor(
            10000 +
              Math.random() *
                90000
          ),

        customerName:
          customerName.trim(),

        insuranceType,

        customerCategory,

        productId:
          selectedProduct.id,

        productName:
          selectedProduct.productName,

        businessType,

        estimatedPremium:
          Number(
            estimatedPremium
          ),

        targetClosingDate,

        isTender,

        channel,

        brokerId:
          channel ===
            'Broker'
            ? selectedBroker?.id
            : undefined,

        brokerName:
          channel ===
            'Broker'
            ? selectedBroker?.companyName
            : undefined,

        brokerLicenseNumber:
          channel ===
            'Broker'
            ? selectedBroker?.licenseNumber
            : undefined,

        agentId:
          channel ===
            'Agent'
            ? selectedAgent?.id
            : undefined,

        agentName:
          channel ===
            'Agent'
            ? selectedAgent?.agentName
            : undefined,

        agentCode:
          channel ===
            'Agent'
            ? selectedAgent?.agentCode
            : undefined,

        agentLicenseNumber:
          channel ===
            'Agent'
            ? selectedAgent?.licenseNumber
            : undefined,

        picUserId:
          currentUser.id,

        picName:
          currentUser.name,

        unit:
          currentUser.unit,

        department:
          currentUser.department,

        notes:
          bookingNotes.trim() ||
          undefined,

        existingPolicyNumber:
          businessType ===
          'Renewal Business'
            ? existingPolicyNumber.trim()
            : undefined,

        originalPolicyYear:
          businessType ===
          'Renewal Business'
            ? Number(
                originalPolicyYear
              )
            : undefined,

        coverageStart:
          businessType ===
          'Renewal Business'
            ? coverageStart
            : undefined,

        coverageEnd:
          businessType ===
          'Renewal Business'
            ? coverageEnd
            : undefined,

        renewalType:
          businessType ===
          'Renewal Business'
            ? renewalType
            : undefined,

        status:
          'Submitted',

        createdAt:
          new Date().toISOString(),

        createdBy:
          currentUser.name,
      };

      store.addBooking(
        newBooking
      );

      closeBookingWizard();

      alert(
        `Booking Case ${newBooking.id} berhasil disubmit untuk verifikasi Marketing Support.`
      );
    };

  // ============================================================
  // BOOKING VERIFICATION — FIRST ACTION WINS
  // ============================================================

  const handleBookingRecommendation = (
    booking: BookingCase,
    recommendation:
      | 'VALID'
      | 'REKOMENDASI TOLAK'
  ) => {
    if (!isMSVerifier) {
      alert(
        'Verifikasi Booking Case hanya dapat dilakukan oleh Staff/Supervisor Marketing Administration.'
      );
      return;
    }

    const confirmed =
      window.confirm(
        recommendation === 'VALID'
          ? `Tetapkan ${booking.id} sebagai VALID? First Action Wins akan mencatat keputusan ini atas nama ${currentUser.name}.`
          : `Berikan REKOMENDASI TOLAK untuk ${booking.id}? First Action Wins akan mencatat keputusan ini atas nama ${currentUser.name}.`
      );

    if (!confirmed) {
      return;
    }

    try {
      store.verifyBookingFirstActionWins(
        booking.id,
        recommendation,
        recommendation === 'VALID'
          ? 'Dokumen dan reservasi bisnis dinyatakan valid oleh verifier pertama.'
          : 'Verifier pertama merekomendasikan penolakan Booking Case.'
      );

      alert(
        `First Action Wins tercatat: ${recommendation} oleh ${currentUser.name}.`
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Verifikasi Booking Case gagal.'
      );
    }
  };

  const handleFinalDecisionBooking = (
    booking: BookingCase,
    approved: boolean
  ) => {
    if (!isTLMS) {
      alert(
        'Final decision Booking hanya dapat dilakukan oleh Department Head Marketing Administration.'
      );
      return;
    }

    if (
      !booking.verificationRecommendation
    ) {
      alert(
        'Booking belum memiliki rekomendasi verifier Marketing Support.'
      );
      return;
    }

    if (approved) {
      const bookingWithIntermediary =
        booking as
          BookingWithIntermediary;

      const pipelineId =
        'PL-2026-' +
        Math.floor(
          10000 +
            Math.random() *
              90000
        );

      const finalDecisionAt =
        new Date().toISOString();

      const updatedBooking: BookingCase = {
        ...booking,

        status:
          'Approved',

        finalDecisionBy:
          currentUser.id,

        finalDecisionByName:
          currentUser.name,

        finalDecisionAt,

        finalDecisionReason:
          'Booking Case disetujui final oleh Department Head Marketing Administration.',

        pipelineId,

        verificationHistory: [
          ...(booking.verificationHistory || []),
          {
            id:
              'BKH-' +
              Date.now() +
              '-' +
              Math.random()
                .toString(36)
                .slice(2, 7),
            action:
              'FINAL_APPROVED',
            recommendation:
              booking.verificationRecommendation,
            actorUserId:
              currentUser.id,
            actorName:
              currentUser.name,
            actorRole:
              currentUser.role,
            timestamp:
              finalDecisionAt,
            notes:
              'Booking Case disetujui final dan diterbitkan menjadi Active Pipeline.',
          },
        ],
      };

      store.updateBooking(
        updatedBooking
      );

      const newPipeline:
        PipelineWithIntermediary = {
        id:
          pipelineId,

        source:
          'BOOKING_CASE',

        businessType:
          booking.businessType ||
          'New Business',

        customerName:
          booking.customerName,

        insuranceType:
          booking.insuranceType,

        customerCategory:
          booking.customerCategory,

        productId:
          booking.productId,

        productName:
          booking.productName,

        estimatedPremium:
          booking.estimatedPremium,

        currentCommercialValue:
          booking.estimatedPremium,

        originalTargetClosingDate:
          booking.targetClosingDate,

        currentTargetClosingDate:
          booking.targetClosingDate,

        isTender:
          booking.isTender,

        channel:
          booking.channel,

        brokerId:
          bookingWithIntermediary.brokerId,

        brokerName:
          bookingWithIntermediary.brokerName,

        brokerLicenseNumber:
          bookingWithIntermediary.brokerLicenseNumber,

        agentId:
          bookingWithIntermediary.agentId,

        agentName:
          bookingWithIntermediary.agentName,

        agentCode:
          bookingWithIntermediary.agentCode,

        agentLicenseNumber:
          bookingWithIntermediary.agentLicenseNumber,

        picUserId:
          booking.picUserId,

        picName:
          booking.picName,

        unit:
          booking.unit,

        department:
          booking.department,

        status:
          'Menunggu Upload Dokumen Marketing',

        currentHandler:
          'MARKETING',

        lastProgressAt:
          new Date().toISOString(),

        dayLapse:
          0,

        documents:
          [],

        quotations:
          [],

        existingPolicyNumber:
          booking.existingPolicyNumber,

        originalPolicyYear:
          booking.originalPolicyYear,

        coverageStart:
          booking.coverageStart,

        coverageEnd:
          booking.coverageEnd,

        renewalType:
          booking.renewalType,

        createdAt:
          new Date().toISOString(),

        createdBy:
          booking.createdBy,
      };

      store.addPipeline(
        newPipeline
      );

      alert(
        `Booking disetujui. Active Pipeline ${pipelineId} diterbitkan dan sekarang menunggu upload dokumen oleh PIC Marketing.`
      );
    } else {
      const finalDecisionAt =
        new Date().toISOString();

      const updatedBooking: BookingCase = {
        ...booking,

        status:
          'Rejected',

        finalDecisionBy:
          currentUser.id,

        finalDecisionByName:
          currentUser.name,

        finalDecisionAt,

        finalDecisionReason:
          booking.verificationRecommendation ===
          'REKOMENDASI TOLAK'
            ? 'Booking Case ditolak final berdasarkan rekomendasi verifier Marketing Support.'
            : 'Booking Case ditolak final oleh Department Head Marketing Administration.',

        verificationHistory: [
          ...(booking.verificationHistory || []),
          {
            id:
              'BKH-' +
              Date.now() +
              '-' +
              Math.random()
                .toString(36)
                .slice(2, 7),
            action:
              'FINAL_REJECTED',
            recommendation:
              booking.verificationRecommendation,
            actorUserId:
              currentUser.id,
            actorName:
              currentUser.name,
            actorRole:
              currentUser.role,
            timestamp:
              finalDecisionAt,
            notes:
              booking.verificationRecommendation ===
              'REKOMENDASI TOLAK'
                ? 'Booking Case ditolak final berdasarkan rekomendasi verifier.'
                : 'Booking Case ditolak final oleh Department Head Marketing Administration.',
          },
        ],
      };

      store.updateBooking(
        updatedBooking
      );

      alert(
        'Booking ditolak.'
      );
    }
  };

  // ============================================================
  // MARKETING DOCUMENT UPLOAD
  // ============================================================

  const openDocumentUpload = (
    pipeline: Pipeline
  ) => {
    setSelectedDocumentPipeline(
      pipeline
    );

    setDocumentFiles([]);

    setSelectedOutcomePipeline(
      null
    );

    setSelectedOutcomeType(
      null
    );
  };

  const handleSubmitMarketingDocuments =
    () => {
      if (
        !selectedDocumentPipeline
      ) {
        return;
      }

      if (
        documentFiles.length ===
        0
      ) {
        alert(
          'Pilih minimal satu dokumen.'
        );
        return;
      }

      const now =
        new Date().toISOString();

      const documents:
        PipelineDocument[] =
        documentFiles.map(
          (
            file,
            index
          ) => ({
            id:
              `DOC-${Date.now()}-${index + 1}`,
            category:
              'Dokumen Marketing',
            fileName:
              file.name,
            fileSize:
              file.size,
            uploadedBy:
              currentUser.name,
            uploadedAt:
              now,
            notes:
              'Metadata dokumen UAT. File binary tidak disimpan di localStorage.',
          })
        );

      try {
        store.submitMarketingDocuments(
          selectedDocumentPipeline.id,
          documents
        );

        setSelectedDocumentPipeline(
          null
        );

        setDocumentFiles(
          []
        );

        alert(
          'Dokumen berhasil diajukan ke Marketing Support.'
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Gagal mengajukan dokumen.'
        );
      }
    };

  // ============================================================
  // MARKETING SUPPORT PIPELINE MOVEMENT
  // ============================================================

  const handleMSMove = (
    pipeline: Pipeline,
    nextStatus:
      PipelineCanonicalStatus
  ) => {
    try {
      store.movePipelineByMarketingSupport(
        pipeline.id,
        nextStatus
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Perubahan status gagal.'
      );
    }
  };

  // ============================================================
  // QUOTATION ISSUANCE — MARKETING SUPPORT
  // ============================================================

  const openQuotationIssue = (
    pipeline: Pipeline
  ) => {
    setSelectedQuotationPipeline(
      pipeline
    );

    setQuotationFile(
      null
    );

    setQuotationAmount(
      String(
        pipeline.currentCommercialValue ||
        pipeline.estimatedPremium ||
        ''
      )
    );

    setQuotationNotes('');

    setSelectedDocumentPipeline(
      null
    );

    setSelectedOutcomePipeline(
      null
    );
  };

  const handleSubmitQuotation =
    async () => {
      if (
        !selectedQuotationPipeline
      ) {
        return;
      }

      if (
        !quotationFile
      ) {
        alert(
          'Upload file penawaran terlebih dahulu.'
        );
        return;
      }

      const amount =
        Number(
          quotationAmount
            .replace(/[^0-9]/g, '')
        );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        alert(
          'Nilai penawaran harus lebih besar dari 0.'
        );
        return;
      }

      const quotationId =
        `QT-${selectedQuotationPipeline.id}-${Date.now()}`;

      try {
        await saveQuotationFile(
          quotationId,
          quotationFile
        );

        store.submitQuotationByMarketingSupport(
          selectedQuotationPipeline.id,
          {
            id:
              quotationId,
            fileName:
              quotationFile.name,
            fileSize:
              quotationFile.size,
            mimeType:
              quotationFile.type,
            amount,
            notes:
              quotationNotes.trim() ||
              undefined,
          }
        );

        setSelectedQuotationPipeline(
          null
        );
        setQuotationFile(
          null
        );
        setQuotationAmount('');
        setQuotationNotes('');

        alert(
          'Penawaran berhasil diterbitkan dan dikirim ke PIC Marketing beserta lampirannya.'
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Gagal menerbitkan penawaran.'
        );
      }
    };

  const handleQuotationDelivered = (
    pipeline: Pipeline
  ) => {
    const confirmed =
      window.confirm(
        'Konfirmasi bahwa file penawaran sudah disampaikan ke klien?'
      );

    if (!confirmed) {
      return;
    }

    try {
      store.confirmQuotationDeliveredByMarketing(
        pipeline.id
      );
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Gagal mengonfirmasi penyampaian penawaran.'
      );
    }
  };

  const openQuotationRevision = (
    pipeline: Pipeline
  ) => {
    setSelectedQuotationRevisionPipeline(
      pipeline
    );

    setQuotationRevisionNotes(
      ''
    );

    setQuotationRevisionFiles(
      []
    );

    setSelectedOutcomePipeline(
      null
    );

    setSelectedQuotationViewPipeline(
      null
    );
  };

  const handleRequestQuotationRevision =
    async () => {
      if (
        !selectedQuotationRevisionPipeline
      ) {
        return;
      }

      if (
        !quotationRevisionNotes.trim()
      ) {
        alert(
          'Catatan revisi penawaran wajib diisi.'
        );

        return;
      }

      if (
        quotationRevisionFiles.length >
        10
      ) {
        alert(
          'Maksimal 10 lampiran untuk satu permintaan revisi penawaran.'
        );

        return;
      }

      const nextVersion =
        (
          selectedQuotationRevisionPipeline.quotations?.length ||
          0
        ) +
        1;

      const now =
        new Date().toISOString();

      const documents:
        PipelineDocument[] =
        quotationRevisionFiles.map(
          (
            file,
            index
          ) => ({
            id:
              `QREV-DOC-${selectedQuotationRevisionPipeline.id}-V${nextVersion}-${Date.now()}-${index + 1}`,
            category:
              `Lampiran Revisi Penawaran V${nextVersion}`,
            fileName:
              file.name,
            fileSize:
              file.size,
            uploadedBy:
              currentUser.name,
            uploadedAt:
              now,
            notes:
              `Lampiran dari Marketing untuk permintaan revisi Penawaran V${nextVersion}.`,
          })
        );

      try {
        await Promise.all(
          quotationRevisionFiles.map(
            (
              file,
              index
            ) =>
              saveQuotationRevisionFile(
                documents[
                  index
                ].id,
                file
              )
          )
        );

        store.requestQuotationRevisionByMarketing(
          selectedQuotationRevisionPipeline.id,
          quotationRevisionNotes,
          documents
        );

        alert(
          `Permintaan revisi berhasil dikirim ke Marketing Support${documents.length ? ` dengan ${documents.length} lampiran` : ''}. Penawaran berikutnya akan menjadi V${nextVersion}.`
        );

        setSelectedQuotationRevisionPipeline(
          null
        );

        setQuotationRevisionNotes(
          ''
        );

        setQuotationRevisionFiles(
          []
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Gagal meminta revisi penawaran.'
        );
      }
    };

  const handleDownloadQuotationRevisionDocument =
    async (
      document:
        PipelineDocument
    ) => {
      try {
        await downloadQuotationRevisionFile(
          document.id,
          document.fileName
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Lampiran revisi penawaran tidak dapat diunduh.'
        );
      }
    };

  const handleDownloadQuotation =
    async (
      quotation: any
    ) => {
      try {
        await downloadQuotationFile(
          quotation.id,
          quotation.fileName
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'File penawaran tidak dapat diunduh.'
        );
      }
    };

  // ============================================================
  // OUTCOME WIN / LOSE REQUEST
  // ============================================================

  const openOutcomePanel = (
    pipeline: Pipeline,
    outcome:
      | 'WIN'
      | 'LOSE'
  ) => {
    setSelectedOutcomePipeline(
      pipeline
    );

    setSelectedOutcomeType(
      outcome
    );

    setLoseReason(
      'Premi terlalu mahal / kalah price'
    );

    setLoseNotes('');

    setOutcomeNotes('');

    setOutcomeFiles(
      []
    );

    setSelectedDocumentPipeline(
      null
    );
  };

  const handleSubmitOutcome =
    async () => {
      if (
        !selectedOutcomePipeline ||
        !selectedOutcomeType
      ) {
        return;
      }

      if (
        outcomeFiles.length ===
        0
      ) {
        alert(
          `Upload minimal satu dokumen pendukung untuk usulan ${selectedOutcomeType}.`
        );
        return;
      }

      if (
        outcomeFiles.length >
        10
      ) {
        alert(
          'Maksimal 10 dokumen pendukung untuk satu usulan WIN/LOSE.'
        );
        return;
      }

      const now =
        new Date().toISOString();

      const documents:
        PipelineDocument[] =
        outcomeFiles.map(
          (
            file,
            index
          ) => ({
            id:
              `OUTCOME-DOC-${selectedOutcomePipeline.id}-${Date.now()}-${index + 1}`,
            category:
              `Dokumen Usulan ${selectedOutcomeType}`,
            fileName:
              file.name,
            fileSize:
              file.size,
            uploadedBy:
              currentUser.name,
            uploadedAt:
              now,
            notes:
              `Dokumen pendukung usulan ${selectedOutcomeType} untuk review Marketing Support.`,
          })
        );

      try {
        await Promise.all(
          outcomeFiles.map(
            (
              file,
              index
            ) =>
              saveOutcomeDocumentFile(
                documents[
                  index
                ].id,
                file
              )
          )
        );

        store.submitPipelineOutcome(
          selectedOutcomePipeline.id,
          selectedOutcomeType,
          {
            winningAmount:
              selectedOutcomePipeline.currentCommercialValue,
            loseReason:
              selectedOutcomeType ===
              'LOSE'
                ? loseReason
                : undefined,
            loseNotes:
              selectedOutcomeType ===
              'LOSE'
                ? loseNotes
                : undefined,
            notes:
              outcomeNotes,
            documents,
          }
        );

        alert(
          `Usulan ${selectedOutcomeType} beserta ${documents.length} dokumen berhasil dikirim ke Marketing Support untuk direview. Status belum final.`
        );

        setSelectedOutcomePipeline(
          null
        );

        setSelectedOutcomeType(
          null
        );

        setLoseNotes('');

        setOutcomeNotes('');

        setOutcomeFiles(
          []
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Gagal mengajukan outcome dan dokumen pendukung.'
        );
      }
    };

  const handleDownloadOutcomeDocument =
    async (
      document:
        PipelineDocument
    ) => {
      try {
        await downloadOutcomeDocumentFile(
          document.id,
          document.fileName
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Dokumen outcome tidak dapat diunduh.'
        );
      }
    };

  const openOutcomeReview = (
    pipeline: Pipeline,
    mode:
      | 'MS'
      | 'TLMS'
  ) => {
    setSelectedOutcomeReviewPipeline(
      pipeline
    );

    setOutcomeReviewMode(
      mode
    );
  };

  const closeOutcomeReview = () => {
    setSelectedOutcomeReviewPipeline(
      null
    );

    setOutcomeReviewMode(
      null
    );
  };

  const handleVerifyOutcome = (
    pipeline: Pipeline,
    approved: boolean
  ) => {
    const confirmed =
      window.confirm(
        approved
          ? `Verifikasi usulan ${pipeline.outcomeRequest} dan teruskan ke Department Head Marketing Administration?`
          : `Kembalikan usulan ${pipeline.outcomeRequest} ke PIC Marketing?`
      );

    if (!confirmed) {
      return;
    }

    try {
      store.verifyPipelineOutcome(
        pipeline.id,
        approved,
        approved
          ? 'Outcome diverifikasi Marketing Support.'
          : 'Outcome perlu ditindaklanjuti kembali oleh PIC Marketing.'
      );

      closeOutcomeReview();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Verifikasi outcome gagal.'
      );
    }
  };

  const handleFinalizeOutcome = (
    pipeline: Pipeline,
    approved: boolean
  ) => {
    const confirmed =
      window.confirm(
        approved
          ? `Setujui final ${pipeline.outcomeRequest} untuk Pipeline ${pipeline.id}?`
          : `Tolak final ${pipeline.outcomeRequest} dan kembalikan ke status sebelumnya?`
      );

    if (!confirmed) {
      return;
    }

    try {
      store.finalizePipelineOutcome(
        pipeline.id,
        approved,
        approved
          ? `Final ${pipeline.outcomeRequest} approved by Department Head Marketing Administration.`
          : `Final ${pipeline.outcomeRequest} rejected by Department Head Marketing Administration.`
      );

      closeOutcomeReview();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : 'Final approval outcome gagal.'
      );
    }
  };

  // ============================================================
  // ATTENTION COUNTS, FILTERING & SORTING — POV CURRENT LOGIN
  // ============================================================

  const activeBookings =
    visibleBookings.filter(
      booking =>
        booking.status !== 'Approved' &&
        booking.status !== 'Rejected'
    );

  const rejectedBookings =
    visibleBookings.filter(
      booking =>
        booking.status === 'Rejected'
    );

  const bookingNeedsAttention = (
    booking: BookingCase
  ) => {
    if (isSysAdmin) {
      return false;
    }

    if (isMSVerifier) {
      return (
        booking.status !== 'Approved' &&
        booking.status !== 'Rejected' &&
        !booking.verificationRecommendation
      );
    }

    if (isTLMS) {
      return (
        booking.status !== 'Approved' &&
        booking.status !== 'Rejected' &&
        Boolean(
          booking.verificationRecommendation
        )
      );
    }

    if (isMarketingActionUser) {
      return (
        booking.status === 'Rejected' &&
        booking.picUserId ===
          currentUser.id
      );
    }

    return false;
  };

  const bookingAttentionCount =
    visibleBookings.filter(
      bookingNeedsAttention
    ).length;

  const pipelineNeedsAction = (
    pipeline: Pipeline
  ) => {
    if (isSysAdmin) {
      return false;
    }

    const isOwnPipeline =
      pipeline.picUserId ===
      currentUser.id;

    if (
      isMarketingActionUser &&
      isOwnPipeline
    ) {
      const needsUpload =
        pipeline.status ===
          'Menunggu Upload Dokumen Marketing' ||
        pipeline.status ===
          'Perlu Perbaikan Dokumen Marketing';

      const canSubmitOutcome =
        OUTCOME_ELIGIBLE_STATUSES.includes(
          pipeline.status
        ) &&
        pipeline.outcomeWorkflowStatus !==
          'PENDING_MS_VERIFICATION' &&
        pipeline.outcomeWorkflowStatus !==
          'PENDING_TLMS_APPROVAL';

      const needsQuotationDelivery =
        pipeline.status ===
        'Penawaran Telah Terbit';

      return (
        needsUpload ||
        needsQuotationDelivery ||
        canSubmitOutcome
      );
    }

    if (isMSVerifier) {
      return (
        pipeline.status ===
          'Dokumen Diajukan oleh Marketing' ||
        pipeline.status ===
          'On Progress Marketing Support' ||
        pipeline.status ===
          'On Process Teknik' ||
        (
          pipeline.status ===
            'Dalam Verifikasi Marketing Support' &&
          pipeline.outcomeRequest &&
          pipeline.outcomeWorkflowStatus ===
            'PENDING_MS_VERIFICATION'
        )
      );
    }

    if (isTLMS) {
      return (
        pipeline.status ===
          'Menunggu Final Approval Team Leader Marketing Support' &&
        Boolean(
          pipeline.outcomeRequest
        ) &&
        pipeline.outcomeWorkflowStatus ===
          'PENDING_TLMS_APPROVAL'
      );
    }

    return false;
  };

  const pipelineAttentionCount =
    visiblePipelines.filter(
      pipelineNeedsAction
    ).length;

  const pipelineAttentionRank = (
    pipeline: Pipeline
  ) => {
    if (pipelineNeedsAction(pipeline)) {
      return 0;
    }

    if (
      pipeline.outcomeWorkflowStatus ===
        'PENDING_MS_VERIFICATION' ||
      pipeline.outcomeWorkflowStatus ===
        'PENDING_TLMS_APPROVAL'
    ) {
      return 1;
    }

    if (
      pipeline.status === 'WIN' ||
      pipeline.status === 'LOSE'
    ) {
      return 3;
    }

    return 2;
  };

  const sortedVisiblePipelines =
    [...visiblePipelines]
      .filter(
        pipeline =>
          pipelineViewMode === 'ALL' ||
          pipelineNeedsAction(pipeline)
      )
      .sort(
        (first, second) => {
          if (
            pipelineSortMode ===
            'ACTION_PRIORITY'
          ) {
            const rankDiff =
              pipelineAttentionRank(first) -
              pipelineAttentionRank(second);

            if (rankDiff !== 0) {
              return rankDiff;
            }

            const lapseDiff =
              second.dayLapse -
              first.dayLapse;

            if (lapseDiff !== 0) {
              return lapseDiff;
            }

            return (
              second.currentCommercialValue -
              first.currentCommercialValue
            );
          }

          if (
            pipelineSortMode ===
            'DAY_LAPSE'
          ) {
            return (
              second.dayLapse -
              first.dayLapse
            );
          }

          if (
            pipelineSortMode ===
            'COMMERCIAL_VALUE'
          ) {
            return (
              second.currentCommercialValue -
              first.currentCommercialValue
            );
          }

          return (
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
          );
        }
      );

  const sortedActiveBookings =
    [...activeBookings]
      .filter(
        booking =>
          bookingViewMode === 'ALL' ||
          bookingNeedsAttention(booking)
      )
      .sort(
        (first, second) => {
          if (
            bookingSortMode ===
            'ACTION_PRIORITY'
          ) {
            const attentionDiff =
              Number(
                bookingNeedsAttention(second)
              ) -
              Number(
                bookingNeedsAttention(first)
              );

            if (attentionDiff !== 0) {
              return attentionDiff;
            }

            return (
              new Date(
                second.createdAt
              ).getTime() -
              new Date(
                first.createdAt
              ).getTime()
            );
          }

          if (
            bookingSortMode ===
            'PREMIUM'
          ) {
            return (
              second.estimatedPremium -
              first.estimatedPremium
            );
          }

          return (
            new Date(
              second.createdAt
            ).getTime() -
            new Date(
              first.createdAt
            ).getTime()
          );
        }
      );

  const sortedRejectedBookings =
    [...rejectedBookings].sort(
      (first, second) =>
        new Date(
          second.finalDecisionAt ||
          second.createdAt
        ).getTime() -
        new Date(
          first.finalDecisionAt ||
          first.createdAt
        ).getTime()
    );

  // ============================================================
  // PIPELINE TIMELINE / HISTORY
  // ============================================================

  const getPipelineTimeline =
    (
      pipeline:
        Pipeline
    ): PipelineTimelineEntry[] => {
      const entries:
        PipelineTimelineEntry[] = [];

      const sourceBooking =
        bookings.find(
          booking =>
            booking.pipelineId ===
            pipeline.id
        );

      if (
        sourceBooking
      ) {
        entries.push({
          id:
            `BOOKING-CREATED-${sourceBooking.id}`,
          timestamp:
            sourceBooking.createdAt,
          actorName:
            sourceBooking.createdBy ||
            sourceBooking.picName ||
            'Marketing',
          actorRole:
            'MARKETING',
          title:
            'Booking Case Disubmit',
          description:
            `${sourceBooking.id} dibuat untuk ${sourceBooking.customerName}.`,
          newValue:
            sourceBooking.status,
          category:
            'BOOKING',
        });

        const bookingHistory =
          (
            (
              sourceBooking as
                any
            ).verificationHistory ||
            []
          ) as any[];

        bookingHistory.forEach(
          history => {
            const action =
              String(
                history.action ||
                ''
              );

            const title =
              action ===
                'FIRST_ACTION_VALID'
                ? 'Marketing Support Memverifikasi Booking — VALID'
                : action ===
                  'FIRST_ACTION_REKOMENDASI_TOLAK'
                  ? 'Marketing Support Memberi Rekomendasi Tolak'
                  : action ===
                    'FINAL_APPROVED'
                    ? 'Department Head Marketing Administration Final Approve Booking'
                    : action ===
                      'FINAL_REJECTED'
                      ? 'Department Head Marketing Administration Final Reject Booking'
                      : 'Riwayat Booking Case';

            entries.push({
              id:
                history.id ||
                `BOOKING-HISTORY-${sourceBooking.id}-${history.timestamp}`,
              timestamp:
                history.timestamp ||
                sourceBooking.createdAt,
              actorName:
                history.actorName ||
                'Unknown User',
              actorRole:
                history.actorRole,
              title,
              description:
                history.notes,
              newValue:
                history.recommendation,
              category:
                'BOOKING',
            });
          }
        );
      }

      const auditLogs =
        store
          .getAuditLogs()
          .filter(
            log =>
              log.recordType ===
                'Pipeline' &&
              log.recordId ===
                pipeline.id
          );

      auditLogs.forEach(
        log => {
          const nextStatus =
            log.newValue;

          let title =
            log.action ===
            'CREATE'
              ? 'Active Pipeline Dibuat'
              : 'Status Pipeline Diperbarui';

          if (
            log.action ===
            'UPDATE_STATUS'
          ) {
            switch (
              nextStatus
            ) {
              case 'Dokumen Diajukan oleh Marketing':
                title =
                  'Marketing Mengajukan Dokumen';
                break;

              case 'On Progress Marketing Support':
                title =
                  'Marketing Support Memulai Proses';
                break;

              case 'Perlu Perbaikan Dokumen Marketing':
                title =
                  'Marketing Support Meminta Perbaikan Dokumen';
                break;

              case 'On Process Teknik':
                title =
                  log.reason?.includes(
                    'requested quotation revision'
                  )
                    ? 'Marketing Meminta Revisi Penawaran'
                    : 'Marketing Support Meneruskan ke Teknik';
                break;

              case 'Penawaran Telah Terbit':
                title =
                  'Marketing Support Menerbitkan Penawaran';
                break;

              case 'Menunggu Feedback / Konfirmasi Klien':
                title =
                  'Marketing Mengonfirmasi Penawaran Disampaikan ke Klien';
                break;

              case 'Dalam Verifikasi Marketing Support':
                title =
                  pipeline.outcomeRequest
                    ? `Marketing Mengajukan ${pipeline.outcomeRequest}`
                    : 'Masuk Verifikasi Marketing Support';
                break;

              case 'Menunggu Final Approval Team Leader Marketing Support':
                title =
                  pipeline.outcomeRequest
                    ? `Marketing Support Memverifikasi ${pipeline.outcomeRequest}`
                    : 'Menunggu Final Approval DH Marketing Administration';
                break;

              case 'WIN':
                title =
                  'Department Head Marketing Administration Final Approve WIN';
                break;

              case 'LOSE':
                title =
                  'Department Head Marketing Administration Final Approve LOSE';
                break;

              default:
                title =
                  'Status Pipeline Diperbarui';
            }
          }

          entries.push({
            id:
              log.id,
            timestamp:
              log.timestamp,
            actorName:
              log.userName,
            actorRole:
              log.userRole,
            title,
            description:
              log.reason ||
              log.fileReference,
            previousValue:
              log.previousValue,
            newValue:
              log.newValue,
            category:
              nextStatus ===
                'Dalam Verifikasi Marketing Support' ||
              nextStatus ===
                'Menunggu Final Approval Team Leader Marketing Support' ||
              nextStatus ===
                'WIN' ||
              nextStatus ===
                'LOSE'
                ? 'OUTCOME'
                : 'PIPELINE',
          });
        }
      );

      (
        pipeline.documents ||
        []
      ).forEach(
        document => {
          if (
            !document.uploadedAt
          ) {
            return;
          }

          entries.push({
            id:
              `DOCUMENT-${document.id}`,
            timestamp:
              document.uploadedAt,
            actorName:
              document.uploadedBy ||
              pipeline.picName,
            actorRole:
              'MARKETING',
            title:
              'Lampiran Dokumen Marketing Diupload',
            description:
              document.fileName,
            category:
              'DOCUMENT',
            downloadableDocument: {
              kind:
                'MARKETING_DOCUMENT',
              documentId:
                document.id,
              fileName:
                document.fileName,
            },
          });
        }
      );

      const revisionRequests =
        (
          pipeline as
            PipelineWithQuotationRevision
        ).quotationRevisionRequests ||
        [];

      revisionRequests.forEach(
        request => {
          entries.push({
            id:
              `QUOTATION-REVISION-${request.id}`,
            timestamp:
              request.requestedAt,
            actorName:
              request.requestedByName,
            actorRole:
              'MARKETING',
            title:
              `Marketing Meminta Revisi Penawaran V${request.targetVersion}`,
            description:
              request.notes,
            previousValue:
              'Menunggu Feedback / Konfirmasi Klien',
            newValue:
              'On Process Teknik',
            category:
              'QUOTATION',
          });

          request.documents.forEach(
            document => {
              if (
                !document.uploadedAt
              ) {
                return;
              }

              entries.push({
                id:
                  `QUOTATION-REVISION-DOC-${document.id}`,
                timestamp:
                  document.uploadedAt,
                actorName:
                  document.uploadedBy ||
                  request.requestedByName,
                actorRole:
                  'MARKETING',
                title:
                  `Lampiran Revisi Penawaran V${request.targetVersion} Diupload`,
                description:
                  document.fileName,
                category:
                  'DOCUMENT',
                downloadableDocument: {
                  kind:
                    'QUOTATION_REVISION',
                  documentId:
                    document.id,
                  fileName:
                    document.fileName,
                },
              });
            }
          );
        }
      );

      (
        pipeline.quotations ||
        []
      ).forEach(
        (
          quotation:
            any
        ) => {
          if (
            !quotation.uploadedAt
          ) {
            return;
          }

          entries.push({
            id:
              `QUOTATION-${quotation.id}`,
            timestamp:
              quotation.uploadedAt,
            actorName:
              quotation.uploadedBy ||
              'Marketing Support',
            actorRole:
              'MARKETING SUPPORT',
            title:
              `Lampiran Penawaran v${quotation.version || 1} Diupload`,
            description:
              `${quotation.fileName}${quotation.amount ? ` • ${formatRupiah(quotation.amount)}` : ''}`,
            category:
              'QUOTATION',
            downloadableDocument: {
              kind:
                'QUOTATION',
              documentId:
                quotation.id,
              fileName:
                quotation.fileName,
              quotationId:
                quotation.id,
            },
          });
        }
      );

      (
        (
          pipeline as
            PipelineWithOutcomeDocuments
        ).outcomeDocuments ||
        []
      ).forEach(
        document => {
          if (
            !document.uploadedAt
          ) {
            return;
          }

          entries.push({
            id:
              `OUTCOME-DOCUMENT-${document.id}`,
            timestamp:
              document.uploadedAt,
            actorName:
              document.uploadedBy ||
              pipeline.picName,
            actorRole:
              'MARKETING',
            title:
              `Dokumen Pendukung ${pipeline.outcomeRequest || 'Outcome'} Diupload`,
            description:
              document.fileName,
            category:
              'OUTCOME',
            downloadableDocument: {
              kind:
                'OUTCOME_DOCUMENT',
              documentId:
                document.id,
              fileName:
                document.fileName,
            },
          });
        }
      );

      return entries
        .filter(
          entry =>
            Boolean(
              entry.timestamp
            )
        )
        .sort(
          (
            first,
            second
          ) =>
            new Date(
              first.timestamp
            ).getTime() -
            new Date(
              second.timestamp
            ).getTime()
        );
    };

  const formatTimelineDate =
    (
      timestamp:
        string
    ) =>
      new Date(
        timestamp
      ).toLocaleString(
        'id-ID',
        {
          day:
            '2-digit',
          month:
            'short',
          year:
            'numeric',
          hour:
            '2-digit',
          minute:
            '2-digit',
        }
      );

  const displayPipelineStatus =
    (
      value?:
        string
    ) =>
      value ===
      'Menunggu Final Approval Team Leader Marketing Support'
        ? 'Menunggu Final Approval DH Marketing Administration'
        : value ||
          '-';

  const renderPipelineStatus =
    (
      status:
        Pipeline['status']
    ) =>
      status ===
      'Menunggu Final Approval Team Leader Marketing Support'
        ? (
          <Badge
            variant="outline"
            className="border-violet-200 bg-violet-50 text-[10px] font-bold text-violet-700"
          >
            Menunggu Final Approval DH Marketing Administration
          </Badge>
        )
        : (
          <StatusBadge
            status={
              status
            }
          />
        );

  const handleDownloadTimelineDocument =
    async (
      entry:
        PipelineTimelineEntry
    ) => {
      const document =
        entry.downloadableDocument;

      if (!document) {
        return;
      }

      try {
        switch (
          document.kind
        ) {
          case 'QUOTATION':
            await downloadQuotationFile(
              document.documentId,
              document.fileName
            );
            break;

          case 'QUOTATION_REVISION':
            await downloadQuotationRevisionFile(
              document.documentId,
              document.fileName
            );
            break;

          case 'OUTCOME_DOCUMENT':
            await downloadOutcomeDocumentFile(
              document.documentId,
              document.fileName
            );
            break;

          case 'MARKETING_DOCUMENT':
            alert(
              'File binary dokumen Marketing lama hanya tersedia jika sebelumnya memang disimpan pada browser ini. Metadata dokumennya tetap tercatat di Riwayat Pipeline.'
            );
            break;
        }
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : 'Dokumen tidak dapat diunduh dari browser ini.'
        );
      }
    };

  // ============================================================
  // ACTION RENDERING
  // ============================================================

  const renderPipelineActions = (
    pipeline: Pipeline
  ) => {
    const isOwnPipeline =
      pipeline.picUserId ===
      currentUser.id;

    const canMarketingAct =
      isMarketingActionUser &&
      isOwnPipeline;

    const actionItems:
      React.ReactNode[] = [];

    if (
      canMarketingAct &&
      (
        pipeline.status ===
          'Menunggu Upload Dokumen Marketing' ||
        pipeline.status ===
          'Perlu Perbaikan Dokumen Marketing'
      )
    ) {
      actionItems.push(
        <Button
          key="upload-doc"
          size="sm"
          onClick={() =>
            openDocumentUpload(
              pipeline
            )
          }
          className="h-7 whitespace-nowrap bg-blue-600 px-2 text-[10px] text-white hover:bg-blue-700"
        >
          <FileUp className="mr-1 h-3 w-3" />
          Upload Dokumen
        </Button>
      );
    }

    if (
      canMarketingAct &&
      pipeline.status ===
        'Menunggu Feedback / Konfirmasi Klien' &&
      pipeline.outcomeWorkflowStatus !==
        'PENDING_MS_VERIFICATION' &&
      pipeline.outcomeWorkflowStatus !==
        'PENDING_TLMS_APPROVAL'
    ) {
      actionItems.push(
        <Button
          key="request-quotation-revision"
          size="sm"
          variant="outline"
          onClick={() =>
            openQuotationRevision(
              pipeline
            )
          }
          className="h-7 whitespace-nowrap border-amber-300 px-2 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
        >
          Revisi Penawaran
        </Button>
      );
    }

    if (
      canMarketingAct &&
      OUTCOME_ELIGIBLE_STATUSES.includes(
        pipeline.status
      ) &&
      pipeline.outcomeWorkflowStatus !==
        'PENDING_MS_VERIFICATION' &&
      pipeline.outcomeWorkflowStatus !==
        'PENDING_TLMS_APPROVAL'
    ) {
      actionItems.push(
        <Button
          key="submit-win"
          size="sm"
          onClick={() =>
            openOutcomePanel(
              pipeline,
              'WIN'
            )
          }
          className="h-7 whitespace-nowrap bg-emerald-600 px-2 text-[10px] text-white hover:bg-emerald-700"
        >
          Ajukan WIN
        </Button>
      );

      actionItems.push(
        <Button
          key="submit-lose"
          size="sm"
          variant="outline"
          onClick={() =>
            openOutcomePanel(
              pipeline,
              'LOSE'
            )
          }
          className="h-7 whitespace-nowrap border-rose-300 px-2 text-[10px] text-rose-800 hover:bg-rose-50"
        >
          Ajukan LOSE
        </Button>
      );
    }

    if (
      isMSVerifier &&
      pipeline.status ===
        'Dokumen Diajukan oleh Marketing'
    ) {
      actionItems.push(
        <Button
          key="start-ms"
          size="sm"
          onClick={() =>
            handleMSMove(
              pipeline,
              'On Progress Marketing Support'
            )
          }
          className="h-7 whitespace-nowrap bg-indigo-600 px-2 text-[10px] text-white hover:bg-indigo-700"
        >
          Mulai Proses MS
        </Button>
      );
    }

    if (
      isMSVerifier &&
      pipeline.status ===
        'On Progress Marketing Support'
    ) {
      actionItems.push(
        <Button
          key="revision"
          size="sm"
          variant="outline"
          onClick={() =>
            handleMSMove(
              pipeline,
              'Perlu Perbaikan Dokumen Marketing'
            )
          }
          className="h-7 whitespace-nowrap border-amber-300 px-2 text-[10px] text-amber-800 hover:bg-amber-50"
        >
          Minta Perbaikan
        </Button>
      );

      actionItems.push(
        <Button
          key="to-tech"
          size="sm"
          onClick={() =>
            handleMSMove(
              pipeline,
              'On Process Teknik'
            )
          }
          className="h-7 whitespace-nowrap bg-blue-600 px-2 text-[10px] text-white hover:bg-blue-700"
        >
          Ke Teknik
        </Button>
      );
    }

    if (
      isMSVerifier &&
      pipeline.status ===
        'On Process Teknik'
    ) {
      actionItems.push(
        <Button
          key="quotation-issued"
          size="sm"
          onClick={() =>
            openQuotationIssue(
              pipeline
            )
          }
          className="h-7 whitespace-nowrap bg-cyan-600 px-2 text-[10px] text-white hover:bg-cyan-700"
        >
          <FileUp className="mr-1 h-3 w-3" />
          Upload & Terbitkan Penawaran
        </Button>
      );
    }

    if (
      canMarketingAct &&
      pipeline.status ===
        'Penawaran Telah Terbit'
    ) {
      actionItems.push(
        <Button
          key="view-quotation"
          size="sm"
          variant="outline"
          onClick={() =>
            setSelectedQuotationViewPipeline(
              pipeline
            )
          }
          className="h-7 whitespace-nowrap border-cyan-300 px-2 text-[10px] text-cyan-800 hover:bg-cyan-50"
        >
          Lihat Penawaran
        </Button>
      );

      actionItems.push(
        <Button
          key="quotation-delivered"
          size="sm"
          onClick={() =>
            handleQuotationDelivered(
              pipeline
            )
          }
          className="h-7 whitespace-nowrap bg-violet-600 px-2 text-[10px] text-white hover:bg-violet-700"
        >
          Sudah Disampaikan ke Klien
        </Button>
      );
    }

    if (
      isMSVerifier &&
      pipeline.status ===
        'Dalam Verifikasi Marketing Support' &&
      pipeline.outcomeRequest &&
      pipeline.outcomeWorkflowStatus ===
        'PENDING_MS_VERIFICATION'
    ) {
      actionItems.push(
        <Button
          key="review-outcome-ms"
          size="sm"
          onClick={() =>
            openOutcomeReview(
              pipeline,
              'MS'
            )
          }
          className="h-7 whitespace-nowrap bg-indigo-600 px-2 text-[10px] text-white hover:bg-indigo-700"
        >
          Review {pipeline.outcomeRequest}
        </Button>
      );
    }

    if (
      isTLMS &&
      pipeline.status ===
        'Menunggu Final Approval Team Leader Marketing Support' &&
      pipeline.outcomeRequest &&
      pipeline.outcomeWorkflowStatus ===
        'PENDING_TLMS_APPROVAL'
    ) {
      actionItems.push(
        <Button
          key="review-outcome-tlms"
          size="sm"
          onClick={() =>
            openOutcomeReview(
              pipeline,
              'TLMS'
            )
          }
          className="h-7 whitespace-nowrap bg-indigo-700 px-2 text-[10px] text-white hover:bg-indigo-800"
        >
          Review & Final {pipeline.outcomeRequest}
        </Button>
      );
    }

    const historyButton = (
      <Button
        key="pipeline-history"
        type="button"
        size="sm"
        variant="outline"
        onClick={() =>
          setSelectedHistoryPipeline(
            pipeline
          )
        }
        className="h-7 whitespace-nowrap border-slate-300 px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
      >
        <History className="mr-1 h-3 w-3" />
        Riwayat
      </Button>
    );

    if (
      actionItems.length ===
      0
    ) {
      const waitingText =
        pipeline.status ===
          'Dalam Verifikasi Marketing Support' &&
        pipeline.outcomeRequest
          ? `Menunggu Verifikasi MS (${pipeline.outcomeRequest})`
          : pipeline.status ===
              'Menunggu Final Approval Team Leader Marketing Support' &&
            pipeline.outcomeRequest
          ? `Menunggu Final TLMS (${pipeline.outcomeRequest})`
          : pipeline.status ===
              'WIN' ||
            pipeline.status ===
              'LOSE'
          ? 'Final'
          : 'Monitoring';

      return (
        <div className="flex min-w-max flex-nowrap items-center justify-end gap-1.5">
          <Badge
            variant="outline"
            className="whitespace-nowrap border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-600"
          >
            {waitingText}
          </Badge>

          {historyButton}
        </div>
      );
    }

    return (
      <div className="flex min-w-max flex-nowrap items-center justify-end gap-1.5">
        {actionItems}
        {historyButton}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">

          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Booking Case & Pipeline Active
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Reservasi bisnis baru, shared verification queue, workflow role-based, dan monitoring siklus pipeline
            </p>
          </div>

        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-[11px] text-blue-900">
          <span className="font-bold">
            Workflow Governance:
          </span>{' '}
          PIC Marketing hanya dapat upload dokumen awal serta mengajukan WIN/LOSE. Booking Case memakai First Action Wins tanpa proses claim: action VALID/Rekomendasi Tolak pertama langsung tercatat siapa dan kapan. Verifier Marketing Support mengendalikan status operasional dan verifikasi outcome. Department Head Marketing Administration adalah final approver. System Admin hanya monitoring.
        </div>

        {isMarketingSupportViewer &&
          agentLicenseReminders.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-amber-950">
                    Reminder Perpanjangan Lisensi Agent — H-14
                  </p>

                  <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
                    Reminder ini tidak dapat di-dismiss dan akan terus muncul di seluruh akun Marketing Support sampai Tanggal Masa Berlaku Lisensi diperbarui.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {agentLicenseReminders.map(
                      agent => (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            setEditingAgent({
                              ...agent,
                            });
                            setAgentFormOpen(true);
                          }}
                          className={
                            agent.daysRemaining <= 0
                              ? 'rounded-lg border border-rose-300 bg-white px-3 py-2 text-left text-[10px] text-rose-800 hover:bg-rose-50'
                              : 'rounded-lg border border-amber-300 bg-white px-3 py-2 text-left text-[10px] text-amber-900 hover:bg-amber-100'
                          }
                        >
                          <span className="block font-black">
                            {agent.agentName}
                          </span>

                          <span className="mt-0.5 block">
                            {agent.daysRemaining < 0
                              ? `Lewat ${Math.abs(agent.daysRemaining)} hari`
                              : agent.daysRemaining === 0
                                ? 'Berakhir hari ini'
                                : `H-${agent.daysRemaining}`}
                            {' • '}
                            {agent.licenseExpiryDate}
                          </span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          defaultValue="pipeline"
          className="w-full"
        >

          <TabsList
            className={`grid w-full rounded-xl border border-gray-200 bg-white p-1 shadow-sm ${
              isMarketingSupportViewer
                ? 'max-w-4xl grid-cols-4'
                : 'max-w-md grid-cols-2'
            }`}
          >

            <TabsTrigger
              value="pipeline"
              className="gap-2 text-xs font-bold"
            >
              <span>
                Active Pipeline
              </span>

              <Badge
                variant="outline"
                className={
                  pipelineAttentionCount > 0
                    ? 'border-rose-200 bg-rose-50 px-1.5 py-0 text-[9px] font-black text-rose-700'
                    : 'border-gray-200 bg-gray-50 px-1.5 py-0 text-[9px] font-bold text-gray-500'
                }
              >
                {pipelineAttentionCount}
              </Badge>
            </TabsTrigger>

            <TabsTrigger
              value="booking"
              className="gap-2 text-xs font-bold"
            >
              <span>
                Booking Case
              </span>

              <Badge
                variant="outline"
                className={
                  bookingAttentionCount > 0
                    ? 'border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-black text-amber-700'
                    : 'border-gray-200 bg-gray-50 px-1.5 py-0 text-[9px] font-bold text-gray-500'
                }
              >
                {bookingAttentionCount}
              </Badge>
            </TabsTrigger>

            {isMarketingSupportViewer && (
              <TabsTrigger
                value="broker-master"
                className="gap-2 text-xs font-bold"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Master Broker</span>
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[9px] font-bold text-blue-700"
                >
                  {brokers.filter(
                    broker =>
                      broker.status ===
                      'Active'
                  ).length}
                </Badge>
              </TabsTrigger>
            )}

            {isMarketingSupportViewer && (
              <TabsTrigger
                value="agent-master"
                className="gap-2 text-xs font-bold"
              >
                <span>Master Agent</span>
                <Badge
                  variant="outline"
                  className={
                    agentLicenseReminders.length > 0
                      ? 'border-rose-300 bg-rose-50 px-1.5 py-0 text-[9px] font-bold text-rose-700'
                      : 'border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[9px] font-bold text-emerald-700'
                  }
                >
                  {agentLicenseReminders.length > 0
                    ? `${agentLicenseReminders.length} reminder`
                    : `${agents.filter(agent => agent.status === 'Active').length} active`}
                </Badge>
              </TabsTrigger>
            )}

          </TabsList>

          {/* =====================================================
              TAB 1 — ACTIVE PIPELINE
          ====================================================== */}

          <TabsContent
            value="pipeline"
            className="mt-4 space-y-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold">
                      Daftar Pipeline & Workflow Role-Based
                    </CardTitle>

                    <CardDescription className="mt-1 text-xs">
                      Default diurutkan berdasarkan kebutuhan aksi akun login, lalu Day Lapse tertinggi.
                    </CardDescription>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        pipelineViewMode ===
                        'ACTION_ONLY'
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() =>
                        setPipelineViewMode(
                          pipelineViewMode ===
                          'ACTION_ONLY'
                            ? 'ALL'
                            : 'ACTION_ONLY'
                        )
                      }
                      className={
                        pipelineViewMode ===
                        'ACTION_ONLY'
                          ? 'h-8 whitespace-nowrap bg-rose-600 px-3 text-[10px] font-bold text-white hover:bg-rose-700'
                          : 'h-8 whitespace-nowrap border-rose-200 px-3 text-[10px] font-bold text-rose-700 hover:bg-rose-50'
                      }
                    >
                      Butuh Aksi Saya ({pipelineAttentionCount})
                    </Button>

                    <Select
                      value={pipelineSortMode}
                      onValueChange={(value) =>
                        setPipelineSortMode(
                          value as
                            | 'ACTION_PRIORITY'
                            | 'DAY_LAPSE'
                            | 'COMMERCIAL_VALUE'
                            | 'NEWEST'
                        )
                      }
                    >

                      <SelectTrigger className="h-8 w-[190px] bg-white text-[10px]">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="ACTION_PRIORITY">
                          Prioritas Aksi
                        </SelectItem>

                        <SelectItem value="DAY_LAPSE">
                          Day Lapse Tertinggi
                        </SelectItem>

                        <SelectItem value="COMMERCIAL_VALUE">
                          Commercial Value
                        </SelectItem>

                        <SelectItem value="NEWEST">
                          Terbaru
                        </SelectItem>

                      </SelectContent>

                    </Select>

                  </div>

                </div>

              </CardHeader>

              <CardContent>

                {sortedVisiblePipelines.length ===
                0 ? (

                  <div className="p-12 text-center text-xs text-gray-400">
                    Belum ada pipeline dalam scope user ini.
                  </div>

                ) : (

                  <>

                    <div className="mb-3 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">

                      <span>
                        Menampilkan <span className="font-black text-slate-800">{sortedVisiblePipelines.length}</span> dari {visiblePipelines.length} pipeline.
                      </span>

                      <span>
                        <span className="font-black text-rose-700">{pipelineAttentionCount}</span> membutuhkan aksi akun ini.
                      </span>

                    </div>

                    <div className="overflow-x-auto">

                    <table className="min-w-[1520px] w-full text-left text-xs">

                      <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">

                        <tr>

                          <th className="p-3">
                            ID Pipeline
                          </th>

                          <th className="p-3">
                            Calon Nasabah
                          </th>

                          <th className="p-3">
                            Produk
                          </th>

                          <th className="p-3">
                            Commercial Value
                          </th>

                          <th className="p-3">
                            Channel / Intermediary
                          </th>

                          <th className="p-3">
                            PIC
                          </th>

                          <th className="p-3">
                            Canonical Status
                          </th>

                          <th className="p-3">
                            Current Handler
                          </th>

                          <th className="p-3">
                            Day Lapse
                          </th>

                          <th className="min-w-[360px] p-3 text-right">
                            Aksi Workflow
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {sortedVisiblePipelines.map(
                          (pipeline) => {

                            const isWarning =
                              pipeline.dayLapse >
                                30 &&
                              pipeline.dayLapse <=
                                60;

                            const isCritical =
                              pipeline.dayLapse >
                              60;

                            const rowBg =
                              pipeline.status ===
                              'WIN'
                                ? 'bg-emerald-50/50'
                                : pipeline.status ===
                                  'LOSE'
                                ? 'bg-rose-50/50'
                                : isCritical
                                ? 'bg-rose-50/80'
                                : isWarning
                                ? 'bg-amber-50/80'
                                : 'hover:bg-gray-50';

                            return (

                              <tr
                                key={
                                  pipeline.id
                                }
                                className={`${rowBg} transition-colors`}
                              >

                                <td className="p-3">

                                  <div className="font-mono font-bold text-blue-700">
                                    {pipeline.id}
                                  </div>

                                  {pipelineNeedsAction(pipeline) && (

                                    <Badge
                                      variant="outline"
                                      className="mt-1 border-rose-200 bg-rose-50 px-1.5 py-0 text-[9px] font-black text-rose-700"
                                    >
                                      BUTUH AKSI
                                    </Badge>

                                  )}

                                </td>

                                <td className="max-w-[230px] p-3 font-semibold text-gray-900">
                                  {pipeline.customerName}
                                </td>

                                <td className="p-3 text-gray-600">
                                  {pipeline.productName}
                                </td>

                                <td className="p-3 font-bold text-gray-900">
                                  {formatRupiah(
                                    pipeline.currentCommercialValue
                                  )}
                                </td>

                                <td className="p-3">
                                  <div className="text-[10px] font-bold text-gray-800">
                                    {pipeline.channel}
                                  </div>
                                  {pipeline.channel ===
                                    'Broker' && (
                                    <div className="mt-0.5 max-w-[220px] text-[9px] text-blue-700">
                                      {(pipeline as PipelineWithIntermediary).brokerName ||
                                        'Broker belum teridentifikasi'}
                                    </div>
                                  )}
                                  {pipeline.channel ===
                                    'Agent' && (
                                    <div className="mt-0.5 max-w-[220px] text-[9px] text-blue-700">
                                      {(pipeline as PipelineWithIntermediary).agentName ||
                                        'Agent belum teridentifikasi'}
                                    </div>
                                  )}
                                </td>

                                <td className="p-3 text-gray-700">
                                  {pipeline.picName}
                                </td>

                                <td className="p-3">
                                  <div className="space-y-1">
                                    {renderPipelineStatus(
                                      pipeline.status
                                    )}

                                    {pipeline.outcomeRequest &&
                                      (
                                        pipeline.outcomeWorkflowStatus ===
                                          'PENDING_MS_VERIFICATION' ||
                                        pipeline.outcomeWorkflowStatus ===
                                          'PENDING_TLMS_APPROVAL'
                                      ) && (

                                        <div className="text-[9px] font-semibold text-violet-700">
                                          Outcome Request: {pipeline.outcomeRequest}
                                        </div>

                                      )}

                                  </div>
                                </td>

                                <td className="p-3 font-semibold text-gray-700">
                                  {pipeline.currentHandler}
                                </td>

                                <td className="p-3">

                                  <span
                                    className={`whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-bold ${
                                      isCritical
                                        ? 'bg-rose-600 text-white'
                                        : isWarning
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    Lapse {pipeline.dayLapse} H
                                  </span>

                                </td>

                                <td className="min-w-[360px] p-3 text-right">
                                  {renderPipelineActions(
                                    pipeline
                                  )}
                                </td>

                              </tr>

                            );
                          }
                        )}

                      </tbody>

                    </table>

                    </div>

                  </>

                )}

              </CardContent>

            </Card>

            {/* ==================================================
                MODAL UPLOAD DOKUMEN MARKETING
            =================================================== */}

            {selectedDocumentPipeline && (

              <div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4"
                onClick={() => {
                  setSelectedDocumentPipeline(
                    null
                  );

                  setDocumentFiles(
                    []
                  );
                }}
              >

                <div
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-200 bg-white shadow-2xl"
                  onClick={event =>
                    event.stopPropagation()
                  }
                >

                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">

                    <div>

                      <h3 className="text-sm font-black text-gray-900">
                        Upload Dokumen Marketing — {selectedDocumentPipeline.id}
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        {selectedDocumentPipeline.customerName}
                      </p>

                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedDocumentPipeline(
                          null
                        );

                        setDocumentFiles(
                          []
                        );
                      }}
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>

                  </div>

                  <div className="space-y-4 p-5">

                    <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] leading-relaxed text-blue-900">
                      Setelah submit, status berubah menjadi <strong>Dokumen Diajukan oleh Marketing</strong> dan masuk ke antrean Marketing Support.
                    </div>

                    <div>

                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Dokumen Pipeline *
                      </label>

                      <Input
                        type="file"
                        multiple
                        onChange={event =>
                          setDocumentFiles(
                            Array.from(
                              event.target.files ||
                                []
                            )
                          )
                        }
                        className="bg-white text-xs"
                      />

                      <p className="mt-1 text-[10px] text-gray-500">
                        Mode UAT menyimpan metadata nama dan ukuran file. File binary tidak disimpan di localStorage.
                      </p>

                    </div>

                    {documentFiles.length > 0 && (

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">

                        <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-gray-600">
                          File dipilih ({documentFiles.length})
                        </div>

                        <div className="space-y-2">

                          {documentFiles.map(
                            (
                              file,
                              index
                            ) => (

                              <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >

                                <span className="min-w-0 truncate text-[11px] font-semibold text-gray-800">
                                  {file.name}
                                </span>

                                <span className="shrink-0 text-[10px] text-gray-500">
                                  {(
                                    file.size /
                                    1024 /
                                    1024
                                  ).toFixed(2)} MB
                                </span>

                              </div>

                            )
                          )}

                        </div>

                      </div>

                    )}

                  </div>

                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedDocumentPipeline(
                          null
                        );

                        setDocumentFiles(
                          []
                        );
                      }}
                      className="text-xs"
                    >
                      Batal
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={
                        handleSubmitMarketingDocuments
                      }
                      disabled={
                        documentFiles.length ===
                        0
                      }
                      className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FileUp className="mr-1 h-4 w-4" />
                      Submit Dokumen
                    </Button>

                  </div>

                </div>

              </div>

            )}

            {selectedQuotationRevisionPipeline && (

              <div
                className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 p-4"
                onClick={() => {
                  setSelectedQuotationRevisionPipeline(
                    null
                  );

                  setQuotationRevisionNotes(
                    ''
                  );

                  setQuotationRevisionFiles(
                    []
                  );
                }}
              >

                <div
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-amber-200 bg-white shadow-2xl"
                  onClick={
                    event =>
                      event.stopPropagation()
                  }
                >

                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-amber-200 bg-amber-50 px-5 py-4">

                    <div>

                      <h3 className="text-sm font-black text-amber-950">
                        Minta Revisi Penawaran
                      </h3>

                      <p className="mt-1 text-xs text-amber-800">
                        {selectedQuotationRevisionPipeline.id} • {selectedQuotationRevisionPipeline.customerName}
                      </p>

                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedQuotationRevisionPipeline(
                          null
                        );

                        setQuotationRevisionNotes(
                          ''
                        );

                        setQuotationRevisionFiles(
                          []
                        );
                      }}
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>

                  </div>

                  <div className="space-y-4 p-5">

                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-relaxed text-amber-900">
                      Penawaran terakhir adalah <strong>V{selectedQuotationRevisionPipeline.quotations?.length || 1}</strong>. Setelah permintaan ini diproses dan Marketing Support meng-upload penawaran baru, sistem otomatis menerbitkan <strong>V{(selectedQuotationRevisionPipeline.quotations?.length || 1) + 1}</strong>.
                    </div>

                    <div>

                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Lampiran Revisi dari Klien / Marketing
                      </label>

                      <Input
                        type="file"
                        multiple
                        onChange={
                          event => {
                            const files =
                              Array.from(
                                event.target.files ||
                                  []
                              );

                            if (
                              files.length >
                              10
                            ) {
                              alert(
                                'Maksimal 10 lampiran untuk satu permintaan revisi.'
                              );

                              event.currentTarget.value =
                                '';

                              setQuotationRevisionFiles(
                                []
                              );

                              return;
                            }

                            setQuotationRevisionFiles(
                              files
                            );
                          }
                        }
                        className="bg-white text-xs"
                      />

                      <p className="mt-1 text-[10px] text-gray-500">
                        Opsional, maksimal 10 file. Gunakan untuk mengirim marked-up proposal, email/brief klien, tabel benefit, TOR, atau dokumen pendukung revisi lainnya.
                      </p>

                      {quotationRevisionFiles.length >
                        0 && (

                        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">

                          <div className="text-[9px] font-black uppercase tracking-wide text-gray-500">
                            Lampiran dipilih ({quotationRevisionFiles.length})
                          </div>

                          {quotationRevisionFiles.map(
                            (
                              file,
                              index
                            ) => (

                              <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >

                                <span className="min-w-0 truncate text-[11px] font-semibold text-gray-800">
                                  {file.name}
                                </span>

                                <span className="shrink-0 text-[10px] text-gray-500">
                                  {(
                                    file.size /
                                    1024 /
                                    1024
                                  ).toFixed(2)} MB
                                </span>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                    <div>

                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Catatan Revisi dari Klien / Marketing *
                      </label>

                      <Textarea
                        value={
                          quotationRevisionNotes
                        }
                        onChange={
                          event =>
                            setQuotationRevisionNotes(
                              event.target.value
                            )
                        }
                        placeholder="Contoh: klien meminta revisi premi, benefit, limit, wording, atau scope coverage..."
                        className="min-h-32 bg-white text-xs"
                      />

                      <p className="mt-1 text-[10px] text-gray-500">
                        Catatan ini akan diteruskan ke Marketing Support dan tercatat pada Riwayat Pipeline.
                      </p>

                    </div>

                  </div>

                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedQuotationRevisionPipeline(
                          null
                        );

                        setQuotationRevisionNotes(
                          ''
                        );

                        setQuotationRevisionFiles(
                          []
                        );
                      }}
                      className="text-xs"
                    >
                      Batal
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        !quotationRevisionNotes.trim()
                      }
                      onClick={
                        handleRequestQuotationRevision
                      }
                      className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Kirim Permintaan Revisi
                    </Button>

                  </div>

                </div>

              </div>

            )}

            {/* ==================================================
                PANEL AJUKAN WIN / LOSE
            =================================================== */}

            {/* ==================================================
                MODAL TERBITKAN PENAWARAN — MARKETING SUPPORT
            =================================================== */}

            {selectedQuotationPipeline && (
              <div
                className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4"
                onClick={() => {
                  setSelectedQuotationPipeline(
                    null
                  );
                  setQuotationFile(
                    null
                  );
                  setQuotationAmount('');
                  setQuotationNotes('');
                }}
              >
                <div
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-200 bg-white shadow-2xl"
                  onClick={event =>
                    event.stopPropagation()
                  }
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
                    <div>
                      <h3 className="text-sm font-black text-gray-900">
                        Upload & Terbitkan Penawaran
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        {selectedQuotationPipeline.id} • {selectedQuotationPipeline.customerName}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedQuotationPipeline(
                          null
                        );
                        setQuotationFile(
                          null
                        );
                        setQuotationAmount('');
                        setQuotationNotes('');
                      }}
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] leading-relaxed text-cyan-950">
                      Status <strong>Penawaran Telah Terbit</strong> baru akan terbentuk setelah file penawaran berhasil di-upload. Setelah submit, PIC Marketing menerima penawaran beserta lampirannya untuk disampaikan ke klien.
                    </div>


                    {(
                      selectedQuotationPipeline as
                        PipelineWithQuotationRevision
                    ).quotationRevisionNotes && (

                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3">

                        <div className="text-[10px] font-black uppercase tracking-wide text-amber-800">
                          Permintaan Revisi Penawaran
                        </div>

                        <div className="mt-1 text-xs font-bold text-amber-950">
                          Target Penawaran V{(
                            selectedQuotationPipeline as
                              PipelineWithQuotationRevision
                          ).quotationRevisionTargetVersion ||
                            (
                              selectedQuotationPipeline.quotations?.length ||
                              0
                            ) +
                              1}
                        </div>

                        <p className="mt-2 text-[11px] leading-relaxed text-amber-900">
                          {(
                            selectedQuotationPipeline as
                              PipelineWithQuotationRevision
                          ).quotationRevisionNotes}
                        </p>

                        <div className="mt-2 text-[9px] text-amber-700">
                          Diminta oleh{' '}
                          {(
                            selectedQuotationPipeline as
                              PipelineWithQuotationRevision
                          ).quotationRevisionRequestedByName ||
                            selectedQuotationPipeline.picName}
                          {(
                            selectedQuotationPipeline as
                              PipelineWithQuotationRevision
                          ).quotationRevisionRequestedAt
                            ? ` • ${new Date(
                                (
                                  selectedQuotationPipeline as
                                    PipelineWithQuotationRevision
                                ).quotationRevisionRequestedAt!
                              ).toLocaleString(
                                'id-ID'
                              )}`
                            : ''}
                        </div>

                        {(
                          selectedQuotationPipeline as
                            PipelineWithQuotationRevision
                        ).quotationRevisionDocuments?.length ? (

                          <div className="mt-3 space-y-2 border-t border-amber-200 pt-3">

                            <div className="text-[9px] font-black uppercase tracking-wide text-amber-800">
                              Lampiran dari Marketing
                            </div>

                            {(
                              selectedQuotationPipeline as
                                PipelineWithQuotationRevision
                            ).quotationRevisionDocuments!.map(
                              document => (

                                <div
                                  key={
                                    document.id
                                  }
                                  className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >

                                  <div className="min-w-0">

                                    <div className="truncate text-[10px] font-bold text-gray-900">
                                      {document.fileName}
                                    </div>

                                    <div className="mt-0.5 text-[9px] text-gray-500">
                                      {document.fileSize
                                        ? `${(
                                            document.fileSize /
                                            1024 /
                                            1024
                                          ).toFixed(
                                            2
                                          )} MB`
                                        : '-'}
                                      {' • '}
                                      {document.uploadedBy}
                                    </div>

                                  </div>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleDownloadQuotationRevisionDocument(
                                        document
                                      )
                                    }
                                    className="shrink-0 border-amber-300 text-[9px] font-bold text-amber-800 hover:bg-amber-50"
                                  >
                                    Download Lampiran
                                  </Button>

                                </div>

                              )
                            )}

                          </div>

                        ) : (

                          <div className="mt-3 border-t border-amber-200 pt-2 text-[9px] italic text-amber-700">
                            Permintaan revisi ini tidak memiliki lampiran.
                          </div>

                        )}

                      </div>

                    )}

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        File Penawaran *
                      </label>

                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={event =>
                          setQuotationFile(
                            event.target.files?.[0] ||
                            null
                          )
                        }
                        className="bg-white text-xs"
                      />

                      {quotationFile && (
                        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[10px] text-gray-700">
                          <strong>{quotationFile.name}</strong>
                          {' • '}
                          {(quotationFile.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Nilai Penawaran (Rp) *
                      </label>

                      <Input
                        type="text"
                        inputMode="numeric"
                        value={
                          formatRupiahInput(
                            quotationAmount
                          )
                        }
                        onChange={event =>
                          setQuotationAmount(
                            sanitizeRupiahInput(
                              event.target.value
                            )
                          )
                        }
                        placeholder="Rp0"
                        className="font-mono text-xs"
                      />

                      {quotationAmount && (
                        <p className="mt-1 text-[10px] font-semibold text-blue-700">
                          {formatRupiah(Number(quotationAmount || 0))}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Catatan Penawaran
                      </label>

                      <Textarea
                        value={quotationNotes}
                        onChange={event =>
                          setQuotationNotes(
                            event.target.value
                          )
                        }
                        placeholder="Opsional — catatan dari Marketing Support untuk PIC Marketing"
                        className="min-h-24 text-xs"
                      />
                    </div>
                  </div>

                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedQuotationPipeline(
                          null
                        );
                        setQuotationFile(
                          null
                        );
                        setQuotationAmount('');
                        setQuotationNotes('');
                      }}
                      className="text-xs"
                    >
                      Batal
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSubmitQuotation}
                      disabled={!quotationFile || !quotationAmount}
                      className="bg-cyan-600 text-xs font-bold text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FileUp className="mr-1 h-4 w-4" />
                      Upload & Terbitkan
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================
                MODAL DETAIL PENAWARAN — PIC MARKETING
            =================================================== */}

            {selectedQuotationViewPipeline && (
              <div
                className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4"
                onClick={() =>
                  setSelectedQuotationViewPipeline(
                    null
                  )
                }
              >
                <div
                  className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl"
                  onClick={event =>
                    event.stopPropagation()
                  }
                >
                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4">
                    <div>
                      <h3 className="text-sm font-black text-gray-900">
                        Lampiran Penawaran
                      </h3>

                      <p className="mt-1 text-xs text-gray-500">
                        {selectedQuotationViewPipeline.id} • {selectedQuotationViewPipeline.customerName}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedQuotationViewPipeline(
                          null
                        )
                      }
                      className="text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>
                  </div>

                  <div className="space-y-3 p-5">
                    {(selectedQuotationViewPipeline.quotations || [])
                      .slice()
                      .reverse()
                      .map((quotation: any) => (
                        <div
                          key={quotation.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-black text-gray-900">
                                Penawaran v{quotation.version}
                              </p>

                              <p className="mt-1 text-[10px] text-gray-500">
                                {quotation.fileName}
                              </p>

                              <p className="mt-1 text-[10px] text-gray-500">
                                {quotation.quotationDate} • {quotation.uploadedBy}
                              </p>

                              <p className="mt-2 text-xs font-bold text-blue-700">
                                {formatRupiah(quotation.amount)}
                              </p>

                              {quotation.notes && (
                                <p className="mt-2 text-[10px] leading-relaxed text-gray-600">
                                  {quotation.notes}
                                </p>
                              )}
                            </div>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleDownloadQuotation(
                                  quotation
                                )
                              }
                              className="shrink-0 border-blue-200 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                            >
                              Download Lampiran
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {selectedOutcomePipeline &&
              selectedOutcomeType && (

              <div
                className="fixed inset-0 z-[96] flex items-center justify-center bg-black/40 p-4"
                onClick={() => {
                  setSelectedOutcomePipeline(
                    null
                  );

                  setSelectedOutcomeType(
                    null
                  );

                  setLoseNotes(
                    ''
                  );

                  setOutcomeNotes(
                    ''
                  );
                }}
              >

                <div
                  className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-white shadow-2xl ${
                    selectedOutcomeType ===
                    'WIN'
                      ? 'border-emerald-200'
                      : 'border-rose-200'
                  }`}
                  onClick={
                    event =>
                      event.stopPropagation()
                  }
                >

                  <div
                    className={`sticky top-0 z-10 flex items-start justify-between gap-4 border-b px-5 py-4 ${
                      selectedOutcomeType ===
                      'WIN'
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-rose-200 bg-rose-50'
                    }`}
                  >

                    <div>

                      <h3
                        className={`text-sm font-black ${
                          selectedOutcomeType ===
                          'WIN'
                            ? 'text-emerald-950'
                            : 'text-rose-950'
                        }`}
                      >
                        Ajukan {selectedOutcomeType}
                      </h3>

                      <p
                        className={`mt-1 text-xs ${
                          selectedOutcomeType ===
                          'WIN'
                            ? 'text-emerald-800'
                            : 'text-rose-800'
                        }`}
                      >
                        {selectedOutcomePipeline.id} • {selectedOutcomePipeline.customerName}
                      </p>

                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedOutcomePipeline(
                          null
                        );

                        setSelectedOutcomeType(
                          null
                        );

                        setLoseNotes(
                          ''
                        );

                        setOutcomeNotes(
                          ''
                        );
                      }}
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>

                  </div>

                  <div className="space-y-4 p-5">

                    <div
                      className={`rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
                        selectedOutcomeType ===
                        'WIN'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                          : 'border-rose-200 bg-rose-50 text-rose-900'
                      }`}
                    >
                      Ini adalah usulan dari PIC Marketing. Status {selectedOutcomeType} belum final sampai diverifikasi Marketing Support dan disetujui Department Head Marketing Administration.
                    </div>

                    {selectedOutcomeType ===
                      'WIN' && (

                      <div className="rounded-lg border border-emerald-200 bg-white p-3">

                        <div className="text-[10px] font-bold uppercase text-emerald-700">
                          Nilai WIN yang diajukan
                        </div>

                        <div className="mt-1 text-lg font-black text-emerald-900">
                          {formatRupiah(
                            selectedOutcomePipeline.currentCommercialValue
                          )}
                        </div>

                      </div>

                    )}

                    {selectedOutcomeType ===
                      'LOSE' && (

                      <>

                        <div>

                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Alasan Kekalahan Baku *
                          </label>

                          <Select
                            value={
                              loseReason
                            }
                            onValueChange={(
                              value
                            ) =>
                              setLoseReason(
                                value as LoseReason
                              )
                            }
                          >

                            <SelectTrigger className="bg-white text-xs">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent
                              position="popper"
                              className="z-[120]"
                            >

                              <SelectItem value="Premi terlalu mahal / kalah price">
                                Premi terlalu mahal / kalah price
                              </SelectItem>

                              <SelectItem value="Kompetitor lebih unggul">
                                Kompetitor lebih unggul
                              </SelectItem>

                              <SelectItem value="Keterbatasan coverage / benefit">
                                Keterbatasan coverage / benefit
                              </SelectItem>

                              <SelectItem value="Anggaran klien dibatalkan">
                                Anggaran klien dibatalkan
                              </SelectItem>

                              <SelectItem value="Gagal kualifikasi tender">
                                Gagal kualifikasi tender
                              </SelectItem>

                            </SelectContent>

                          </Select>

                        </div>

                        <div>

                          <label className="mb-1 block text-xs font-semibold text-gray-700">
                            Catatan Evaluasi Kekalahan *
                          </label>

                          <Textarea
                            placeholder="Jelaskan faktor penyebab, komparasi harga, benefit, atau hasil tender..."
                            value={
                              loseNotes
                            }
                            onChange={(
                              event
                            ) =>
                              setLoseNotes(
                                event.target.value
                              )
                            }
                            className="h-24 bg-white text-xs"
                          />

                        </div>

                      </>

                    )}

                    <div>

                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Dokumen Pendukung {selectedOutcomeType} *
                      </label>

                      <Input
                        type="file"
                        multiple
                        onChange={
                          event => {
                            const files =
                              Array.from(
                                event.target.files ||
                                  []
                              );

                            if (
                              files.length >
                              10
                            ) {
                              alert(
                                'Maksimal 10 dokumen pendukung.'
                              );

                              event.currentTarget.value =
                                '';

                              setOutcomeFiles(
                                []
                              );

                              return;
                            }

                            setOutcomeFiles(
                              files
                            );
                          }
                        }
                        className="bg-white text-xs"
                      />

                      <p className="mt-1 text-[10px] text-gray-500">
                        Wajib minimal 1 file, maksimal 10 file. Dokumen dibawa ke Marketing Support untuk direview sebelum outcome diteruskan.
                      </p>

                      {outcomeFiles.length >
                        0 && (

                        <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">

                          {outcomeFiles.map(
                            (
                              file,
                              index
                            ) => (

                              <div
                                key={`${file.name}-${index}`}
                                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2"
                              >

                                <span className="min-w-0 truncate text-[11px] font-semibold text-gray-800">
                                  {file.name}
                                </span>

                                <span className="shrink-0 text-[10px] text-gray-500">
                                  {(
                                    file.size /
                                    1024 /
                                    1024
                                  ).toFixed(2)} MB
                                </span>

                              </div>

                            )
                          )}

                        </div>

                      )}

                    </div>

                    <div>

                      <label className="mb-1 block text-xs font-semibold text-gray-700">
                        Catatan Pengajuan
                      </label>

                      <Textarea
                        placeholder="Opsional: konteks tambahan untuk Marketing Support..."
                        value={
                          outcomeNotes
                        }
                        onChange={(
                          event
                        ) =>
                          setOutcomeNotes(
                            event.target.value
                          )
                        }
                        className="h-20 bg-white text-xs"
                      />

                    </div>

                  </div>

                  <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedOutcomePipeline(
                          null
                        );

                        setSelectedOutcomeType(
                          null
                        );

                        setLoseNotes(
                          ''
                        );

                        setOutcomeNotes(
                          ''
                        );
                      }}
                      className="text-xs"
                    >
                      Batal
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      onClick={
                        handleSubmitOutcome
                      }
                      disabled={
                        outcomeFiles.length ===
                        0
                      }
                      className={
                        selectedOutcomeType ===
                        'WIN'
                          ? 'bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700'
                          : 'bg-rose-600 text-xs font-bold text-white hover:bg-rose-700'
                      }
                    >
                      Submit Usulan {selectedOutcomeType}
                    </Button>

                  </div>

                </div>

              </div>

            )}

            {selectedOutcomeReviewPipeline &&
              outcomeReviewMode && (

              <div
                className="fixed inset-0 z-[97] flex items-center justify-center bg-black/40 p-4"
                onClick={
                  closeOutcomeReview
                }
              >

                <div
                  className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-indigo-200 bg-white shadow-2xl"
                  onClick={
                    event =>
                      event.stopPropagation()
                  }
                >

                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-indigo-100 bg-indigo-50 px-5 py-4">

                    <div>

                      <h3 className="text-sm font-black text-indigo-950">
                        Review Usulan {selectedOutcomeReviewPipeline.outcomeRequest}
                      </h3>

                      <p className="mt-1 text-xs text-indigo-700">
                        {selectedOutcomeReviewPipeline.id} • {selectedOutcomeReviewPipeline.customerName}
                      </p>

                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={
                        closeOutcomeReview
                      }
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>

                  </div>

                  <div className="space-y-4 p-5">

                    <div className="grid gap-3 md:grid-cols-2">

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[10px] font-bold uppercase text-gray-500">
                          Diajukan Oleh
                        </div>

                        <div className="mt-1 text-xs font-bold text-gray-900">
                          {selectedOutcomeReviewPipeline.outcomeSubmittedByName || '-'}
                        </div>

                        <div className="mt-1 text-[10px] text-gray-500">
                          {selectedOutcomeReviewPipeline.outcomeSubmittedAt
                            ? new Date(
                                selectedOutcomeReviewPipeline.outcomeSubmittedAt
                              ).toLocaleString(
                                'id-ID'
                              )
                            : '-'}
                        </div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[10px] font-bold uppercase text-gray-500">
                          Nilai Commercial
                        </div>

                        <div className="mt-1 text-xs font-black text-gray-900">
                          {formatRupiah(
                            selectedOutcomeReviewPipeline.outcomeWinningAmount ||
                              selectedOutcomeReviewPipeline.currentCommercialValue
                          )}
                        </div>
                      </div>

                    </div>

                    {selectedOutcomeReviewPipeline.outcomeRequest ===
                      'LOSE' && (

                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">

                        <div className="text-[10px] font-bold uppercase text-rose-700">
                          Evaluasi LOSE
                        </div>

                        <div className="mt-1 text-xs font-bold text-rose-950">
                          {selectedOutcomeReviewPipeline.outcomeLoseReason || '-'}
                        </div>

                        <div className="mt-1 text-[11px] leading-relaxed text-rose-800">
                          {selectedOutcomeReviewPipeline.outcomeLoseNotes || '-'}
                        </div>

                      </div>

                    )}

                    <div className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="text-[10px] font-bold uppercase text-gray-500">
                        Catatan Pengajuan Marketing
                      </div>

                      <div className="mt-1 text-[11px] leading-relaxed text-gray-700">
                        {selectedOutcomeReviewPipeline.outcomeSubmissionNotes || '-'}
                      </div>
                    </div>

                    <div>

                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-gray-900">
                            Dokumen Pendukung
                          </div>

                          <div className="mt-0.5 text-[10px] text-gray-500">
                            Download dan review dokumen sebelum mengambil keputusan.
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="border-indigo-200 bg-indigo-50 text-[9px] font-bold text-indigo-700"
                        >
                          {(
                            selectedOutcomeReviewPipeline as
                              PipelineWithOutcomeDocuments
                          ).outcomeDocuments?.length ||
                            0}{' '}
                          file
                        </Badge>
                      </div>

                      <div className="space-y-2">

                        {(
                          selectedOutcomeReviewPipeline as
                            PipelineWithOutcomeDocuments
                        ).outcomeDocuments?.length ? (

                          (
                            selectedOutcomeReviewPipeline as
                              PipelineWithOutcomeDocuments
                          ).outcomeDocuments!.map(
                            document => (

                              <div
                                key={
                                  document.id
                                }
                                className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                              >

                                <div className="min-w-0">
                                  <div className="truncate text-[11px] font-bold text-gray-900">
                                    {document.fileName}
                                  </div>

                                  <div className="mt-1 text-[9px] text-gray-500">
                                    {document.fileSize
                                      ? `${(
                                          document.fileSize /
                                          1024 /
                                          1024
                                        ).toFixed(
                                          2
                                        )} MB`
                                      : '-'}
                                    {' • '}
                                    {document.uploadedBy}
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleDownloadOutcomeDocument(
                                      document
                                    )
                                  }
                                  className="shrink-0 text-[10px]"
                                >
                                  Download & Review
                                </Button>

                              </div>

                            )
                          )

                        ) : (

                          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-[11px] font-semibold text-rose-700">
                            Dokumen pendukung tidak ditemukan. Approval tidak dapat dilanjutkan.
                          </div>

                        )}

                      </div>

                    </div>

                    {outcomeReviewMode ===
                      'TLMS' &&
                      selectedOutcomeReviewPipeline.outcomeVerifiedByName && (

                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="text-[10px] font-bold uppercase text-emerald-700">
                          Verifikasi Marketing Support
                        </div>

                        <div className="mt-1 text-xs font-bold text-emerald-950">
                          {selectedOutcomeReviewPipeline.outcomeVerifiedByName}
                        </div>

                        <div className="mt-1 text-[10px] text-emerald-800">
                          {selectedOutcomeReviewPipeline.outcomeVerificationNotes || '-'}
                        </div>
                      </div>

                    )}

                  </div>

                  <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={
                        closeOutcomeReview
                      }
                      className="text-xs"
                    >
                      Tutup
                    </Button>

                    {outcomeReviewMode ===
                      'MS' && (

                      <>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleVerifyOutcome(
                              selectedOutcomeReviewPipeline,
                              false
                            )
                          }
                          className="border-rose-300 text-xs font-bold text-rose-800 hover:bg-rose-50"
                        >
                          Kembalikan ke Marketing
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !(
                              selectedOutcomeReviewPipeline as
                                PipelineWithOutcomeDocuments
                            ).outcomeDocuments?.length
                          }
                          onClick={() =>
                            handleVerifyOutcome(
                              selectedOutcomeReviewPipeline,
                              true
                            )
                          }
                          className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Verifikasi & Teruskan ke TLMS
                        </Button>

                      </>

                    )}

                    {outcomeReviewMode ===
                      'TLMS' && (

                      <>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleFinalizeOutcome(
                              selectedOutcomeReviewPipeline,
                              false
                            )
                          }
                          className="border-rose-300 text-xs font-bold text-rose-800 hover:bg-rose-50"
                        >
                          Reject Final
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            !(
                              selectedOutcomeReviewPipeline as
                                PipelineWithOutcomeDocuments
                            ).outcomeDocuments?.length
                          }
                          onClick={() =>
                            handleFinalizeOutcome(
                              selectedOutcomeReviewPipeline,
                              true
                            )
                          }
                          className="bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Final Approve {selectedOutcomeReviewPipeline.outcomeRequest}
                        </Button>

                      </>

                    )}

                  </div>

                </div>

              </div>

            )}

            {selectedHistoryPipeline && (

              <div
                className="fixed inset-0 z-[98] flex items-center justify-center bg-black/40 p-4"
                onClick={() =>
                  setSelectedHistoryPipeline(
                    null
                  )
                }
              >

                <div
                  className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
                  onClick={
                    event =>
                      event.stopPropagation()
                  }
                >

                  <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">

                    <div>

                      <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-slate-700" />

                        <h3 className="text-sm font-black text-gray-900">
                          Riwayat Pipeline
                        </h3>
                      </div>

                      <p className="mt-1 text-xs text-gray-500">
                        {selectedHistoryPipeline.id} • {selectedHistoryPipeline.customerName}
                      </p>

                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setSelectedHistoryPipeline(
                          null
                        )
                      }
                      className="shrink-0 text-xs"
                    >
                      <X className="mr-1 h-4 w-4" />
                      Tutup
                    </Button>

                  </div>

                  <div className="p-5">

                    <div className="mb-5 grid gap-3 md:grid-cols-4">

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[9px] font-bold uppercase text-gray-500">
                          PIC
                        </div>

                        <div className="mt-1 text-xs font-black text-gray-900">
                          {selectedHistoryPipeline.picName}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[9px] font-bold uppercase text-gray-500">
                          Produk
                        </div>

                        <div className="mt-1 text-xs font-black text-gray-900">
                          {selectedHistoryPipeline.productName}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[9px] font-bold uppercase text-gray-500">
                          Status Saat Ini
                        </div>

                        <div className="mt-1">
                          {renderPipelineStatus(
                            selectedHistoryPipeline.status
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                        <div className="text-[9px] font-bold uppercase text-gray-500">
                          Current Handler
                        </div>

                        <div className="mt-1 text-xs font-black text-gray-900">
                          {selectedHistoryPipeline.currentHandler}
                        </div>
                      </div>

                    </div>

                    {getPipelineTimeline(
                      selectedHistoryPipeline
                    ).length ===
                    0 ? (

                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">

                        <div className="text-xs font-black text-amber-900">
                          Belum ada riwayat detail yang tercatat
                        </div>

                        <p className="mt-1 text-[10px] leading-relaxed text-amber-700">
                          Pipeline dummy/legacy yang dibuat sebelum audit workflow diterapkan dapat memiliki history terbatas. Aktivitas baru setelah fitur audit aktif akan tercatat otomatis.
                        </p>

                      </div>

                    ) : (

                      <div className="relative">

                        <div className="absolute bottom-0 left-[7px] top-1 w-px bg-gray-200" />

                        <div className="space-y-4">

                          {getPipelineTimeline(
                            selectedHistoryPipeline
                          ).map(
                            (
                              entry,
                              index
                            ) => (

                              <div
                                key={
                                  entry.id
                                }
                                className="relative pl-8"
                              >

                                <div
                                  className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-white ring-1 ${
                                    entry.category ===
                                    'OUTCOME'
                                      ? 'bg-violet-500 ring-violet-200'
                                      : entry.category ===
                                        'QUOTATION'
                                      ? 'bg-cyan-500 ring-cyan-200'
                                      : entry.category ===
                                        'DOCUMENT'
                                      ? 'bg-blue-500 ring-blue-200'
                                      : entry.category ===
                                        'BOOKING'
                                      ? 'bg-amber-500 ring-amber-200'
                                      : 'bg-slate-500 ring-slate-200'
                                  }`}
                                />

                                <div className="rounded-xl border border-gray-200 bg-white p-4">

                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                                    <div className="min-w-0">

                                      <div className="flex flex-wrap items-center gap-2">

                                        <span className="text-xs font-black text-gray-900">
                                          {entry.title}
                                        </span>

                                        <Badge
                                          variant="outline"
                                          className="text-[8px] font-bold"
                                        >
                                          {entry.category}
                                        </Badge>

                                      </div>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-gray-500">
                                        <span className="font-bold text-gray-700">
                                          {entry.actorName}
                                        </span>

                                        {entry.actorRole && (
                                          <>
                                            <span>•</span>
                                            <span>
                                              {entry.actorRole}
                                            </span>
                                          </>
                                        )}
                                      </div>

                                    </div>

                                    <div className="shrink-0 text-[10px] font-semibold text-gray-500">
                                      {formatTimelineDate(
                                        entry.timestamp
                                      )}
                                    </div>

                                  </div>

                                  {(entry.previousValue ||
                                    entry.newValue) && (

                                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">

                                      {entry.previousValue && (
                                        <Badge
                                          variant="outline"
                                          className="border-gray-200 bg-gray-50 text-gray-600"
                                        >
                                          {displayPipelineStatus(entry.previousValue)}
                                        </Badge>
                                      )}

                                      {entry.previousValue &&
                                        entry.newValue && (
                                        <span className="font-bold text-gray-400">
                                          →
                                        </span>
                                      )}

                                      {entry.newValue && (
                                        <Badge
                                          variant="outline"
                                          className="border-blue-200 bg-blue-50 text-blue-700"
                                        >
                                          {displayPipelineStatus(entry.newValue)}
                                        </Badge>
                                      )}

                                    </div>

                                  )}

                                  {entry.description && (

                                    <p className="mt-3 text-[10px] leading-relaxed text-gray-600">
                                      {entry.description}
                                    </p>

                                  )}

                                  {entry.downloadableDocument && (

                                    <div className="mt-3">

                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleDownloadTimelineDocument(
                                            entry
                                          )
                                        }
                                        className="h-7 border-blue-200 bg-blue-50 px-2 text-[9px] font-bold text-blue-700 hover:bg-blue-100"
                                      >
                                        Download Dokumen
                                      </Button>

                                    </div>

                                  )}

                                </div>

                              </div>

                            )
                          )}

                        </div>

                      </div>

                    )}

                  </div>

                </div>

              </div>

            )}

          </TabsContent>

          {/* =====================================================
              TAB 2 — BOOKING CASE
          ====================================================== */}

          <TabsContent
            value="booking"
            className="mt-4 space-y-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold">
                      Booking Case
                    </CardTitle>

                    <CardDescription className="mt-1 text-xs">
                      Booking aktif diverifikasi dengan First Action Wins. Tidak ada proses claim. Hanya Booking yang ditolak final dipisahkan ke tab Ditolak Marketing Support.
                    </CardDescription>

                  </div>

                  {isMarketingActionUser && (

                    <Button
                      size="sm"
                      onClick={openBookingWizard}
                      className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                    >

                      <Plus className="h-4 w-4" />
                      Booking Case Baru

                    </Button>

                  )}

                </div>

              </CardHeader>

              <CardContent>

                <Tabs defaultValue="active-booking" className="w-full">

                  <TabsList className="mb-4 grid w-full max-w-xl grid-cols-2 rounded-lg border border-gray-200 bg-gray-50 p-1">

                    <TabsTrigger value="active-booking" className="gap-2 text-[11px] font-bold">
                      <span>Aktif & Perlu Perhatian</span>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[9px] text-blue-700">
                        {activeBookings.length}
                      </Badge>
                    </TabsTrigger>

                    <TabsTrigger value="rejected-booking" className="gap-2 text-[11px] font-bold">
                      <span>Ditolak Marketing Support</span>
                      <Badge variant="outline" className="border-rose-200 bg-rose-50 px-1.5 py-0 text-[9px] text-rose-700">
                        {rejectedBookings.length}
                      </Badge>
                    </TabsTrigger>

                  </TabsList>

                  <TabsContent value="active-booking" className="mt-0">

                    {(isMSVerifier || isTLMS) && (

                      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:flex-row sm:items-center sm:justify-between">

                        <div className="text-[10px] text-slate-600">
                          Prioritas otomatis menempatkan Booking yang membutuhkan aksi akun ini di paling atas.
                        </div>

                        <div className="flex flex-wrap items-center gap-2">

                          <Button
                            type="button"
                            size="sm"
                            variant={
                              bookingViewMode ===
                              'ACTION_ONLY'
                                ? 'default'
                                : 'outline'
                            }
                            onClick={() =>
                              setBookingViewMode(
                                bookingViewMode ===
                                'ACTION_ONLY'
                                  ? 'ALL'
                                  : 'ACTION_ONLY'
                              )
                            }
                            className={
                              bookingViewMode ===
                              'ACTION_ONLY'
                                ? 'h-7 whitespace-nowrap bg-amber-600 px-2 text-[10px] font-bold text-white hover:bg-amber-700'
                                : 'h-7 whitespace-nowrap border-amber-200 px-2 text-[10px] font-bold text-amber-700 hover:bg-amber-50'
                            }
                          >
                            Butuh Aksi Saya ({bookingAttentionCount})
                          </Button>

                          <Select
                            value={bookingSortMode}
                            onValueChange={(value) =>
                              setBookingSortMode(
                                value as
                                  | 'ACTION_PRIORITY'
                                  | 'PREMIUM'
                                  | 'NEWEST'
                              )
                            }
                          >

                            <SelectTrigger className="h-7 w-[170px] bg-white text-[10px]">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent>

                              <SelectItem value="ACTION_PRIORITY">
                                Prioritas Aksi
                              </SelectItem>

                              <SelectItem value="PREMIUM">
                                Estimasi Premi
                              </SelectItem>

                              <SelectItem value="NEWEST">
                                Terbaru
                              </SelectItem>

                            </SelectContent>

                          </Select>

                        </div>

                      </div>

                    )}

                    {sortedActiveBookings.length === 0 ? (

                      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center">
                        <div className="text-xs font-semibold text-gray-500">
                          Tidak ada Booking Case aktif yang memerlukan proses.
                        </div>
                        {isMarketingActionUser && (
                          <Button size="sm" variant="outline" onClick={openBookingWizard} className="mt-3 text-xs">
                            Buat Booking Case Baru
                          </Button>
                        )}
                      </div>

                    ) : (

                      <div className="overflow-x-auto">
                        <table className="min-w-[1520px] w-full text-left text-xs">

                          <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">
                            <tr>
                              <th className="p-3">ID Booking</th>
                              <th className="p-3">Calon Nasabah</th>
                              <th className="p-3">Produk</th>
                              <th className="p-3">Jenis Bisnis</th>
                              <th className="p-3">Channel / Intermediary</th>
                              <th className="p-3">Estimasi Premi</th>
                              <th className="p-3">PIC</th>
                              <th className="p-3">Rekomendasi</th>
                              <th className="p-3">First Action</th>
                              <th className="min-w-[260px] p-3 text-right">Aksi</th>
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-gray-100">

                            {sortedActiveBookings.map(booking => {
                              const hasRecommendation = Boolean(booking.verificationRecommendation);
                              const firstActionName =
                                booking.verificationFirstActionByName ||
                                (booking.claimedByName && booking.verificationRecommendation
                                  ? booking.claimedByName
                                  : undefined);

                              return (
                                <tr key={booking.id} className="hover:bg-gray-50">
                                  <td className="p-3">

                                    <div className="font-mono font-bold text-blue-700">
                                      {booking.id}
                                    </div>

                                    {bookingNeedsAttention(booking) && (

                                      <Badge
                                        variant="outline"
                                        className="mt-1 border-amber-200 bg-amber-50 px-1.5 py-0 text-[9px] font-black text-amber-700"
                                      >
                                        BUTUH AKSI
                                      </Badge>

                                    )}

                                  </td>
                                  <td className="p-3 font-semibold text-gray-900">{booking.customerName}</td>
                                  <td className="p-3 text-gray-600">{booking.productName}</td>
                                  <td className="p-3">
                                    <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                                      {booking.businessType || 'New Business'}
                                    </Badge>
                                  </td>
                                  <td className="p-3">
                                    <div className="text-[10px] font-bold text-gray-800">
                                      {booking.channel}
                                    </div>
                                    {booking.channel ===
                                      'Broker' && (
                                      <div className="mt-0.5 max-w-[220px] text-[9px] text-blue-700">
                                        {(booking as BookingWithIntermediary).brokerName ||
                                          'Broker belum teridentifikasi'}
                                      </div>
                                    )}
                                    {booking.channel ===
                                      'Agent' && (
                                      <div className="mt-0.5 max-w-[220px] text-[9px] text-blue-700">
                                        {(booking as BookingWithIntermediary).agentName ||
                                          'Agent belum teridentifikasi'}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 font-bold text-gray-900">{formatRupiah(booking.estimatedPremium)}</td>
                                  <td className="p-3 text-gray-700">{booking.picName}</td>
                                  <td className="p-3">
                                    {booking.verificationRecommendation ? (
                                      <Badge
                                        variant="outline"
                                        className={
                                          booking.verificationRecommendation === 'VALID'
                                            ? 'border-emerald-300 bg-emerald-50 text-[10px] font-bold text-emerald-800'
                                            : 'border-rose-300 bg-rose-50 text-[10px] font-bold text-rose-800'
                                        }
                                      >
                                        {booking.verificationRecommendation}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-700">
                                        Menunggu First Action MS
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {hasRecommendation ? (
                                      <div>
                                        <div className="text-[10px] font-bold text-gray-800">
                                          {firstActionName || 'Marketing Support'}
                                        </div>
                                        <div className="mt-0.5 text-[9px] text-gray-500">
                                          {booking.verificationFirstActionAt
                                            ? new Date(booking.verificationFirstActionAt).toLocaleString('id-ID')
                                            : 'History legacy UAT'}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-[10px] text-gray-400">Belum ada action</span>
                                    )}
                                  </td>
                                  <td className="min-w-[260px] p-3">
                                    <div className="flex min-w-max flex-nowrap items-center justify-end gap-1.5">
                                      {isMSVerifier && !hasRecommendation && (
                                        <>
                                          <Button
                                            size="sm"
                                            onClick={() => handleBookingRecommendation(booking, 'VALID')}
                                            className="h-7 whitespace-nowrap bg-emerald-600 text-[10px] text-white hover:bg-emerald-700"
                                          >
                                            VALID
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleBookingRecommendation(booking, 'REKOMENDASI TOLAK')}
                                            className="h-7 whitespace-nowrap border-rose-300 text-[10px] text-rose-800 hover:bg-rose-50"
                                          >
                                            Rekom. Tolak
                                          </Button>
                                        </>
                                      )}

                                      {isTLMS && hasRecommendation && (
                                        <>
                                          <Button
                                            size="sm"
                                            onClick={() => handleFinalDecisionBooking(booking, true)}
                                            className="h-7 whitespace-nowrap bg-emerald-700 text-[10px] text-white hover:bg-emerald-800"
                                          >
                                            Final Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleFinalDecisionBooking(booking, false)}
                                            className="h-7 whitespace-nowrap border-rose-300 text-[10px] text-rose-800 hover:bg-rose-50"
                                          >
                                            Final Reject
                                          </Button>
                                        </>
                                      )}

                                      {!isMSVerifier && !isTLMS && (
                                        <Badge variant="outline" className="whitespace-nowrap border-gray-200 bg-gray-50 text-[10px] text-gray-600">
                                          Monitoring
                                        </Badge>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                          </tbody>
                        </table>
                      </div>

                    )}

                  </TabsContent>

                  <TabsContent value="rejected-booking" className="mt-0">

                    {rejectedBookings.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-gray-200 p-10 text-center text-xs text-gray-500">
                        Tidak ada Booking Case yang ditolak Marketing Support.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-[1120px] w-full text-left text-xs">
                          <thead className="border-b border-gray-200 bg-rose-50/60 text-[10px] uppercase text-gray-600">
                            <tr>
                              <th className="p-3">ID Booking</th>
                              <th className="p-3">Calon Nasabah</th>
                              <th className="p-3">Produk</th>
                              <th className="p-3">PIC</th>
                              <th className="p-3">Rekomendasi</th>
                              <th className="p-3">Alasan / Catatan</th>
                              <th className="p-3">Final Decision</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sortedRejectedBookings.map(booking => (
                              <tr key={booking.id} className="bg-rose-50/20">
                                <td className="p-3 font-mono font-bold text-rose-700">{booking.id}</td>
                                <td className="p-3 font-semibold text-gray-900">{booking.customerName}</td>
                                <td className="p-3 text-gray-600">{booking.productName}</td>
                                <td className="p-3 text-gray-700">{booking.picName}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="border-rose-300 bg-rose-50 text-[10px] text-rose-800">
                                    {booking.verificationRecommendation || 'Rejected'}
                                  </Badge>
                                </td>
                                <td className="max-w-[320px] p-3 text-[10px] text-gray-600">
                                  {booking.finalDecisionReason || booking.verifierNotes || 'Tidak ada catatan tambahan.'}
                                </td>
                                <td className="p-3">
                                  <div className="text-[10px] font-bold text-gray-800">
                                    {booking.finalDecisionByName || 'Marketing Support'}
                                  </div>
                                  <div className="mt-0.5 text-[9px] text-gray-500">
                                    {booking.finalDecisionAt
                                      ? new Date(booking.finalDecisionAt).toLocaleString('id-ID')
                                      : '-'}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </TabsContent>

                </Tabs>

              </CardContent>

            </Card>

            {/* ==================================================
                BOOKING CASE 5-STEP WIZARD
            =================================================== */}

            {bookingModalOpen && (

              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">

                <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

                  <div className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-5">

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <div className="flex items-center gap-2">

                          <Plus className="h-5 w-5 text-blue-600" />

                          <h2 className="text-lg font-black text-gray-900">
                            Form Pendaftaran Booking Case
                          </h2>

                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Pendaftaran opportunity bisnis baru ke dalam Dashboard Marketing Operating System PertaLife.
                        </p>

                      </div>

                      <div className="flex items-center gap-3">

                        <Badge
                          variant="outline"
                          className="border-sky-300 bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700"
                        >
                          Tahap {bookingStep} dari 5
                        </Badge>

                        <button
                          type="button"
                          onClick={
                            closeBookingWizard
                          }
                          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <X className="h-5 w-5" />
                        </button>

                      </div>

                    </div>

                    <div className="mt-5 grid grid-cols-5 gap-2">

                      {BOOKING_STEPS.map(
                        (
                          step
                        ) => {

                          const isActive =
                            bookingStep ===
                            step.number;

                          const isDone =
                            bookingStep >
                            step.number;

                          return (

                            <div
                              key={
                                step.number
                              }
                              className="flex items-center gap-2"
                            >

                              <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                  isActive
                                    ? 'bg-sky-600 text-white'
                                    : isDone
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {isDone ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  step.number
                                )}
                              </div>

                              <div
                                className={`hidden text-[11px] font-semibold md:block ${
                                  isActive
                                    ? 'text-gray-900'
                                    : isDone
                                    ? 'text-emerald-700'
                                    : 'text-gray-500'
                                }`}
                              >
                                {step.label}
                              </div>

                            </div>

                          );
                        }
                      )}

                    </div>

                  </div>

                  <div className="px-6 py-6">

                    {/* STEP 1 */}

                    {bookingStep ===
                      1 && (

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">

                        <div className="text-sm font-black text-gray-900">
                          1. Pilih Jenis Asuransi *
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Klik salah satu pilihan untuk langsung lanjut ke tahap berikutnya.
                        </p>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">

                          {[
                            'Asuransi Jiwa',
                            'Asuransi Kesehatan',
                          ].map(
                            (
                              value
                            ) => {

                              const selected =
                                insuranceType ===
                                value;

                              return (

                                <button
                                  key={
                                    value
                                  }
                                  type="button"
                                  onClick={() => {
                                    setInsuranceType(
                                      value as InsuranceType
                                    );
                                    setCustomerCategory(
                                      ''
                                    );
                                    setSelectedProductId(
                                      ''
                                    );
                                    setBusinessType(
                                      ''
                                    );
                                    setDupWarning(
                                      false
                                    );

                                    // Auto-advance ke Tahap 2.
                                    setBookingStep(
                                      2
                                    );
                                  }}
                                  className={`rounded-2xl border p-7 text-center transition ${
                                    selected
                                      ? 'border-sky-500 bg-sky-50 shadow-sm'
                                      : 'border-slate-200 bg-white hover:border-sky-300'
                                  }`}
                                >

                                  <Layers
                                    className={`mx-auto h-8 w-8 ${
                                      selected
                                        ? 'text-sky-600'
                                        : 'text-slate-400'
                                    }`}
                                  />

                                  <div
                                    className={`mt-3 text-sm font-bold ${
                                      selected
                                        ? 'text-sky-950'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {value}
                                  </div>

                                </button>

                              );
                            }
                          )}

                        </div>

                      </div>

                    )}

                    {/* STEP 2 */}

                    {bookingStep ===
                      2 && (

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">

                        <div className="text-sm font-black text-gray-900">
                          2. Pilih Kategori Nasabah *
                        </div>

                        <p className="mt-1 text-xs text-gray-500">
                          Jenis Asuransi: <span className="font-bold text-gray-700">{insuranceType}</span>. Klik kategori untuk langsung lanjut.
                        </p>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">

                          {[
                            'Individu',
                            'Kumpulan',
                          ].map(
                            (
                              value
                            ) => {

                              const selected =
                                customerCategory ===
                                value;

                              return (

                                <button
                                  key={
                                    value
                                  }
                                  type="button"
                                  onClick={() => {
                                    setCustomerCategory(
                                      value as CustomerCategory
                                    );
                                    setSelectedProductId(
                                      ''
                                    );
                                    setBusinessType(
                                      ''
                                    );
                                    setDupWarning(
                                      false
                                    );

                                    // Auto-advance ke Tahap 3.
                                    setBookingStep(
                                      3
                                    );
                                  }}
                                  className={`rounded-2xl border p-7 text-center transition ${
                                    selected
                                      ? 'border-sky-500 bg-sky-50 shadow-sm'
                                      : 'border-slate-200 bg-white hover:border-sky-300'
                                  }`}
                                >

                                  <div
                                    className={`text-base font-black ${
                                      selected
                                        ? 'text-sky-950'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {value}
                                  </div>

                                  <p className="mt-2 text-[11px] text-gray-500">
                                    {value ===
                                    'Kumpulan'
                                      ? 'Perusahaan / institusi / group policy'
                                      : 'Prospek nasabah individual'}
                                  </p>

                                </button>

                              );
                            }
                          )}

                        </div>

                      </div>

                    )}

                    {/* STEP 3 */}

                    {bookingStep ===
                      3 && (

                      <div className="space-y-5">

                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
                          Pilih Produk dan Jenis Bisnis. Setelah keduanya terisi, sistem otomatis masuk ke Detail Penawaran.
                        </div>

                        <div>

                          <label className="mb-1 block text-xs font-bold text-gray-700">
                            3A. Produk *
                          </label>

                          <Select
                            value={
                              selectedProductId
                            }
                            onValueChange={(
                              value
                            ) => {
                              setSelectedProductId(
                                value
                              );
                              evaluateBookingDuplicate(
                                customerName,
                                value
                              );

                              // Tahap 3 baru lengkap jika Produk + Jenis Bisnis sudah dipilih.
                              if (
                                businessType
                              ) {
                                setBookingStep(
                                  4
                                );
                              }
                            }}
                          >

                            <SelectTrigger className="h-11 bg-white text-xs">
                              <SelectValue placeholder="Pilih produk sesuai Jenis Asuransi & Kategori" />
                            </SelectTrigger>

                            <SelectContent>

                              {activeProducts.map(
                                (
                                  product
                                ) => (

                                  <SelectItem
                                    key={
                                      product.id
                                    }
                                    value={
                                      product.id
                                    }
                                  >
                                    {product.productName}
                                  </SelectItem>

                                )
                              )}

                            </SelectContent>

                          </Select>

                          {activeProducts.length ===
                            0 && (

                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                              Tidak ada produk aktif untuk kombinasi Jenis Asuransi dan Kategori ini.
                            </div>

                          )}

                        </div>

                        <div>

                          <label className="mb-2 block text-xs font-bold text-gray-700">
                            3B. Jenis Bisnis *
                          </label>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                            {[
                              {
                                value:
                                  'New Business',
                                title:
                                  'New Business',
                                description:
                                  'Opportunity baru / belum memiliki polis existing.',
                              },
                              {
                                value:
                                  'Renewal Business',
                                title:
                                  'Renewal',
                                description:
                                  'Perpanjangan / kelanjutan polis existing.',
                              },
                            ].map(
                              (
                                option
                              ) => {

                                const selected =
                                  businessType ===
                                  option.value;

                                return (

                                  <button
                                    key={
                                      option.value
                                    }
                                    type="button"
                                    onClick={() => {
                                      const nextBusinessType =
                                        option.value as BusinessType;

                                      setBusinessType(
                                        nextBusinessType
                                      );

                                      // Produk + Jenis Bisnis = Tahap 3 selesai.
                                      // Langsung masuk ke Detail Penawaran.
                                      if (
                                        selectedProductId
                                      ) {
                                        setBookingStep(
                                          4
                                        );
                                      }
                                    }}
                                    className={`rounded-xl border p-4 text-left transition ${
                                      selected
                                        ? 'border-sky-500 bg-sky-50'
                                        : 'border-gray-200 bg-white hover:border-sky-300'
                                    }`}
                                  >

                                    <div className="text-sm font-black text-gray-900">
                                      {option.title}
                                    </div>

                                    <div className="mt-1 text-[11px] text-gray-500">
                                      {option.description}
                                    </div>

                                  </button>

                                );
                              }
                            )}

                          </div>

                        </div>

                      </div>

                    )}

                    {/* STEP 4 */}

                    {bookingStep ===
                      4 && (

                      <div className="space-y-5">

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                          <div className="md:col-span-2">

                            <label className="mb-1 block text-xs font-bold text-gray-700">
                              Nama Calon Nasabah *
                            </label>

                            <Input
                              value={
                                customerName
                              }
                              onChange={(
                                event
                              ) =>
                                handleCustomerNameChange(
                                  event.target.value
                                )
                              }
                              placeholder="Contoh: PT Badak NGL"
                              className="h-11 text-xs"
                            />

                            {dupWarning && (

                              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-[11px] font-medium text-amber-900">

                                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                                <span>
                                  Indikasi duplicate: kombinasi calon nasabah + produk sudah ada pada Booking/Pipeline existing. Submission tetap dapat diteruskan untuk review Marketing Support, namun wajib mendapat perhatian verifier.
                                </span>

                              </div>

                            )}

                          </div>

                          <div>

                            <label className="mb-1 block text-xs font-bold text-gray-700">
                              Estimasi Premi (Rp) *
                            </label>

                            <Input
                              type="text"
                              inputMode="numeric"
                              value={
                                formatRupiahInput(
                                  estimatedPremium
                                )
                              }
                              onChange={(
                                event
                              ) =>
                                setEstimatedPremium(
                                  sanitizeRupiahInput(
                                    event.target.value
                                  )
                                )
                              }
                              placeholder="Rp3.500.000.000"
                              className="h-11 font-mono text-xs"
                            />

                            {Number(
                              estimatedPremium
                            ) > 0 && (

                              <div className="mt-1 text-[10px] font-semibold text-blue-700">
                                {formatRupiah(
                                  Number(
                                    estimatedPremium
                                  )
                                )}
                              </div>

                            )}

                          </div>

                          <div>

                            <label className="mb-1 block text-xs font-bold text-gray-700">
                              Target Closing *
                            </label>

                            <Input
                              type="date"
                              value={
                                targetClosingDate
                              }
                              onChange={(
                                event
                              ) =>
                                setTargetClosingDate(
                                  event.target.value
                                )
                              }
                              className="h-11 text-xs"
                            />

                          </div>

                          <div>

                            <label className="mb-1 block text-xs font-bold text-gray-700">
                              Metode Pengadaan *
                            </label>

                            <Select
                              value={
                                isTender
                                  ? 'Tender'
                                  : 'Non-Tender'
                              }
                              onValueChange={(
                                value
                              ) =>
                                setIsTender(
                                  value ===
                                    'Tender'
                                )
                              }
                            >

                              <SelectTrigger className="h-11 text-xs">
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>

                                <SelectItem value="Non-Tender">
                                  Non-Tender
                                </SelectItem>

                                <SelectItem value="Tender">
                                  Tender / Lelang
                                </SelectItem>

                              </SelectContent>

                            </Select>

                          </div>

                          <div>

                            <label className="mb-1 block text-xs font-bold text-gray-700">
                              Distribution Channel *
                            </label>

                            <Select
                              value={
                                channel
                              }
                              onValueChange={(
                                value
                              ) => {
                                const nextChannel =
                                  value as DistributionChannel;

                                setChannel(
                                  nextChannel
                                );

                                if (
                                  nextChannel !==
                                  'Broker'
                                ) {
                                  setSelectedBroker(
                                    null
                                  );
                                }

                                if (
                                  nextChannel !==
                                  'Agent'
                                ) {
                                  setSelectedAgent(
                                    null
                                  );
                                }
                              }}
                            >

                              <SelectTrigger className="h-11 text-xs">
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>

                                <SelectItem value="Direct Selling">
                                  Direct Selling
                                </SelectItem>

                                <SelectItem value="Agent">
                                  Agent
                                </SelectItem>

                                <SelectItem value="Broker">
                                  Broker
                                </SelectItem>

                                <SelectItem value="BUSB">
                                  BUSB
                                </SelectItem>

                              </SelectContent>

                            </Select>

                          </div>

                          {channel ===
                            'Broker' && (

                            <div className="md:col-span-2">

                              <label className="mb-1 block text-xs font-bold text-gray-700">
                                Broker / Pialang Asuransi *
                              </label>

                              <BrokerCombobox
                                value={
                                  selectedBroker?.id
                                }
                                onChange={
                                  broker =>
                                    setSelectedBroker(
                                      broker
                                    )
                                }
                                placeholder="Ketik atau pilih nama broker..."
                              />

                              {selectedBroker && (

                                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">

                                  <div className="text-[10px] font-bold text-blue-900">
                                    {selectedBroker.companyName}
                                  </div>

                                  <div className="mt-0.5 text-[10px] text-blue-700">
                                    Izin Usaha: {selectedBroker.licenseNumber || '-'}
                                    {selectedBroker.city
                                      ? ` • ${selectedBroker.city}`
                                      : ''}
                                  </div>

                                </div>

                              )}

                              <p className="mt-1 text-[10px] text-gray-500">
                                Daftar hanya menampilkan broker berstatus Active pada Master Broker yang dikelola System Admin.
                              </p>

                            </div>

                          )}

                          {channel ===
                            'Agent' && (

                            <div className="md:col-span-2">
                              <label className="mb-1 block text-xs font-bold text-gray-700">
                                Agent *
                              </label>

                              <AgentCombobox
                                value={
                                  selectedAgent?.id
                                }
                                onChange={
                                  agent =>
                                    setSelectedAgent(
                                      agent
                                    )
                                }
                                placeholder="Ketik atau pilih nama agent..."
                              />

                              {selectedAgent && (
                                <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2">
                                  <div className="text-[10px] font-bold text-blue-900">
                                    {selectedAgent.agentName}
                                  </div>

                                  <div className="mt-0.5 text-[10px] text-blue-700">
                                    Kode: {selectedAgent.agentCode || '-'}
                                    {' • '}
                                    Lisensi: {selectedAgent.licenseNumber || '-'}
                                    {' • '}
                                    Berlaku s.d. {selectedAgent.licenseExpiryDate || '-'}
                                  </div>
                                </div>
                              )}

                              <p className="mt-1 text-[10px] text-gray-500">
                                Hanya agent berstatus Active yang dapat dipilih.
                              </p>
                            </div>

                          )}

                        </div>

                        {businessType ===
                          'Renewal Business' && (

                          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">

                            <div className="text-xs font-black text-violet-900">
                              Informasi Polis Existing — Renewal
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

                              <div>

                                <label className="mb-1 block text-xs font-semibold text-gray-700">
                                  Existing Policy Number *
                                </label>

                                <Input
                                  value={
                                    existingPolicyNumber
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setExistingPolicyNumber(
                                      event.target.value
                                    )
                                  }
                                  placeholder="Contoh: POL/2025/00123"
                                  className="h-10 text-xs"
                                />

                              </div>

                              <div>

                                <label className="mb-1 block text-xs font-semibold text-gray-700">
                                  Original Policy Year *
                                </label>

                                <Input
                                  type="number"
                                  min="2000"
                                  max="2100"
                                  value={
                                    originalPolicyYear
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setOriginalPolicyYear(
                                      event.target.value
                                    )
                                  }
                                  placeholder="2025"
                                  className="h-10 text-xs"
                                />

                              </div>

                              <div>

                                <label className="mb-1 block text-xs font-semibold text-gray-700">
                                  Coverage Start *
                                </label>

                                <Input
                                  type="date"
                                  value={
                                    coverageStart
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setCoverageStart(
                                      event.target.value
                                    )
                                  }
                                  className="h-10 text-xs"
                                />

                              </div>

                              <div>

                                <label className="mb-1 block text-xs font-semibold text-gray-700">
                                  Coverage End *
                                </label>

                                <Input
                                  type="date"
                                  value={
                                    coverageEnd
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    setCoverageEnd(
                                      event.target.value
                                    )
                                  }
                                  className="h-10 text-xs"
                                />

                              </div>

                              <div className="md:col-span-2">

                                <label className="mb-1 block text-xs font-semibold text-gray-700">
                                  Renewal Type *
                                </label>

                                <Select
                                  value={
                                    renewalType
                                  }
                                  onValueChange={(
                                    value
                                  ) =>
                                    setRenewalType(
                                      value as RenewalTypeValue
                                    )
                                  }
                                >

                                  <SelectTrigger className="h-10 bg-white text-xs">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent>

                                    <SelectItem value="Regular Renewal">
                                      Regular Renewal
                                    </SelectItem>

                                    <SelectItem value="Salary / Exposure Adjustment">
                                      Salary / Exposure Adjustment
                                    </SelectItem>

                                    <SelectItem value="Benefit Adjustment">
                                      Benefit Adjustment
                                    </SelectItem>

                                    <SelectItem value="Other Renewal">
                                      Other Renewal
                                    </SelectItem>

                                  </SelectContent>

                                </Select>

                              </div>

                            </div>

                          </div>

                        )}

                        <div>

                          <label className="mb-1 block text-xs font-bold text-gray-700">
                            Catatan Opportunity
                          </label>

                          <Textarea
                            value={
                              bookingNotes
                            }
                            onChange={(
                              event
                            ) =>
                              setBookingNotes(
                                event.target.value
                              )
                            }
                            placeholder="Konteks tender, kebutuhan klien, broker/agent, atau catatan awal lainnya..."
                            className="h-20 text-xs"
                          />

                        </div>

                      </div>

                    )}

                    {/* STEP 5 */}

                    {bookingStep ===
                      5 && (

                      <div className="space-y-5">

                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">

                          <div className="flex items-center gap-2">

                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />

                            <div className="text-sm font-black text-emerald-950">
                              Review Booking Case
                            </div>

                          </div>

                          <p className="mt-1 text-[11px] text-emerald-800">
                            Periksa kembali data sebelum submit. Setelah submit, Booking masuk shared queue Marketing Support untuk diverifikasi.
                          </p>

                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                          {[
                            [
                              'Jenis Asuransi',
                              insuranceType,
                            ],
                            [
                              'Kategori Nasabah',
                              customerCategory,
                            ],
                            [
                              'Produk',
                              selectedProduct?.productName ||
                                '-',
                            ],
                            [
                              'Jenis Bisnis',
                              businessType,
                            ],
                            [
                              'Nama Calon Nasabah',
                              customerName,
                            ],
                            [
                              'Estimasi Premi',
                              Number(
                                estimatedPremium
                              ) > 0
                                ? formatRupiah(
                                    Number(
                                      estimatedPremium
                                    )
                                  )
                                : '-',
                            ],
                            [
                              'Target Closing',
                              targetClosingDate ||
                                '-',
                            ],
                            [
                              'Metode Pengadaan',
                              isTender
                                ? 'Tender / Lelang'
                                : 'Non-Tender',
                            ],
                            [
                              'Distribution Channel',
                              channel,
                            ],
                            ...(channel ===
                              'Broker'
                              ? [[
                                  'Broker',
                                  selectedBroker
                                    ? `${selectedBroker.companyName}${selectedBroker.licenseNumber ? ` • ${selectedBroker.licenseNumber}` : ''}`
                                    : '-',
                                ]]
                              : []),
                            ...(channel ===
                              'Agent'
                              ? [[
                                  'Agent',
                                  selectedAgent
                                    ? `${selectedAgent.agentName} • ${selectedAgent.agentCode}${selectedAgent.licenseNumber ? ` • ${selectedAgent.licenseNumber}` : ''}`
                                    : '-',
                                ]]
                              : []),
                            [
                              'PIC Marketing',
                              `${currentUser.name} • ${currentUser.position}`,
                            ],
                          ].map(
                            (
                              [
                                label,
                                value,
                              ]
                            ) => (

                              <div
                                key={
                                  label
                                }
                                className="rounded-xl border border-gray-200 bg-white p-3"
                              >

                                <div className="text-[10px] font-bold uppercase text-gray-400">
                                  {label}
                                </div>

                                <div className="mt-1 text-xs font-bold text-gray-900">
                                  {value ||
                                    '-'}
                                </div>

                              </div>

                            )
                          )}

                        </div>

                        {businessType ===
                          'Renewal Business' && (

                          <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">

                            <div className="text-[10px] font-bold uppercase text-violet-700">
                              Renewal Reference
                            </div>

                            <div className="mt-2 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">

                              <div>
                                Policy: <span className="font-bold">{existingPolicyNumber}</span>
                              </div>

                              <div>
                                Original Year: <span className="font-bold">{originalPolicyYear}</span>
                              </div>

                              <div>
                                Coverage: <span className="font-bold">{coverageStart} s.d. {coverageEnd}</span>
                              </div>

                              <div>
                                Renewal Type: <span className="font-bold">{renewalType}</span>
                              </div>

                            </div>

                          </div>

                        )}

                        {dupWarning && (

                          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[11px] text-amber-900">

                            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />

                            <div>
                              <div className="font-black">
                                Duplicate Warning
                              </div>
                              Kombinasi calon nasabah + produk terindikasi sudah ada. Marketing Support wajib melakukan review ownership sebelum final approval.
                            </div>

                          </div>

                        )}

                      </div>

                    )}

                  </div>

                  <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-100 bg-white px-6 py-4">

                    <div>

                      {bookingStep >
                        1 && (

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={
                            handlePreviousBookingStep
                          }
                          className="gap-1 text-xs"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          Kembali
                        </Button>

                      )}

                    </div>

                    <div className="flex items-center gap-2">

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={
                          closeBookingWizard
                        }
                        className="text-xs"
                      >
                        Batal
                      </Button>

                      {bookingStep ===
                        4 && (

                        <Button
                          type="button"
                          size="sm"
                          onClick={
                            handleNextBookingStep
                          }
                          className="gap-1 bg-sky-600 text-xs font-bold text-white hover:bg-sky-700"
                        >
                          Review Data
                          <ArrowRight className="h-4 w-4" />
                        </Button>

                      )}

                      {bookingStep ===
                        5 && (

                        <Button
                          type="button"
                          size="sm"
                          onClick={
                            handleCreateBooking
                          }
                          className="gap-1 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Submit Booking Case
                        </Button>

                      )}

                    </div>

                  </div>

                </div>

              </div>

            )}

          </TabsContent>

          {isMarketingSupportViewer && (
            <TabsContent
              value="broker-master"
              className="mt-4 space-y-4"
            >
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-sm font-bold">
                          Master Broker / Pialang Asuransi
                        </CardTitle>
                      </div>

                      <CardDescription className="mt-1 text-xs">
                        Dikelola bersama oleh seluruh akun Marketing Support. Baseline awal berasal dari Direktori Perusahaan Pialang Asuransi OJK Triwulan III 2025.
                      </CardDescription>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={openAddBroker}
                      className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Broker
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={brokerSearch}
                        onChange={event =>
                          setBrokerSearch(
                            event.target.value
                          )
                        }
                        placeholder="Cari nama broker, nomor izin, kota, email..."
                        className="pl-9 text-xs"
                      />
                    </div>

                    <select
                      value={brokerStatusFilter}
                      onChange={event =>
                        setBrokerStatusFilter(
                          event.target.value as
                            | 'ALL'
                            | 'Active'
                            | 'Inactive'
                        )
                      }
                      className="h-10 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                    <Badge variant="outline">
                      {filteredBrokers.length} tampil
                    </Badge>
                    <span>
                      {brokers.filter(
                        broker =>
                          broker.status ===
                          'Active'
                      ).length} Active
                    </span>
                    <span>•</span>
                    <span>
                      {brokers.filter(
                        broker =>
                          broker.status ===
                          'Inactive'
                      ).length} Inactive
                    </span>
                  </div>

                  <div className="max-h-[620px] overflow-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[1250px] text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">Nama Perusahaan</th>
                          <th className="p-3">Nomor Izin Usaha</th>
                          <th className="p-3">Tanggal Izin</th>
                          <th className="p-3">Kota</th>
                          <th className="p-3">Telepon</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {filteredBrokers.map(
                          broker => (
                            <tr
                              key={broker.id}
                              className="hover:bg-gray-50"
                            >
                              <td className="p-3">
                                <p className="font-bold text-gray-900">
                                  {broker.companyName}
                                </p>
                                <p className="mt-0.5 text-[10px] text-gray-500">
                                  {broker.address || '-'}
                                </p>
                              </td>

                              <td className="p-3 font-mono text-[11px] text-blue-700">
                                {broker.licenseNumber || '-'}
                              </td>

                              <td className="p-3 text-gray-600">
                                {broker.licenseDate || '-'}
                              </td>

                              <td className="p-3 text-gray-700">
                                {broker.city || '-'}
                              </td>

                              <td className="p-3 text-gray-600">
                                {broker.phone1 || '-'}
                              </td>

                              <td className="p-3 text-gray-600">
                                {broker.email || '-'}
                              </td>

                              <td className="p-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    broker.status ===
                                    'Active'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : 'border-gray-300 bg-gray-100 text-gray-600'
                                  }
                                >
                                  {broker.status}
                                </Badge>
                              </td>

                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      openEditBroker(
                                        broker
                                      )
                                    }
                                    className="h-7 gap-1 text-[10px]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      store.setBrokerStatus(
                                        broker.id,
                                        broker.status ===
                                          'Active'
                                          ? 'Inactive'
                                          : 'Active'
                                      )
                                    }
                                    className="h-7 text-[10px]"
                                  >
                                    {broker.status ===
                                    'Active'
                                      ? 'Nonaktifkan'
                                      : 'Aktifkan'}
                                  </Button>

                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Hapus ${broker.companyName} dari Master Broker?`
                                        )
                                      ) {
                                        store.deleteBroker(
                                          broker.id
                                        );
                                      }
                                    }}
                                    className="h-7 border-rose-200 text-[10px] text-rose-700 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-[10px] text-blue-900">
                    Perubahan Master Broker tercatat pada Audit Trail. Booking Case hanya menampilkan broker berstatus Active.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {isMarketingSupportViewer && (
            <TabsContent
              value="agent-master"
              className="mt-4 space-y-4"
            >
              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">
                        Master Agent
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Dikelola bersama oleh seluruh akun Marketing Support. Booking Case hanya menampilkan agent berstatus Active.
                      </CardDescription>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={openAddAgent}
                      className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Tambah Agent
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {agentLicenseReminders.length > 0 && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                      <p className="text-xs font-black text-amber-950">
                        {agentLicenseReminders.length} agent perlu perpanjangan lisensi
                      </p>
                      <p className="mt-1 text-[10px] text-amber-800">
                        Reminder aktif sejak H-14 dan hilang otomatis setelah Tanggal Masa Berlaku Lisensi diperbarui.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        value={agentSearch}
                        onChange={event => setAgentSearch(event.target.value)}
                        placeholder="Cari nama, kode agent, nomor lisensi, email..."
                        className="pl-9 text-xs"
                      />
                    </div>

                    <select
                      value={agentStatusFilter}
                      onChange={event =>
                        setAgentStatusFilter(
                          event.target.value as 'ALL' | 'Active' | 'Inactive'
                        )
                      }
                      className="h-10 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="max-h-[620px] overflow-auto rounded-xl border border-gray-200">
                    <table className="w-full min-w-[1200px] text-left text-xs">
                      <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 uppercase text-[10px] text-gray-600">
                        <tr>
                          <th className="p-3">Kode Agent</th>
                          <th className="p-3">Nama Agent</th>
                          <th className="p-3">Nomor Lisensi</th>
                          <th className="p-3">Tanggal Lisensi</th>
                          <th className="p-3">Masa Berlaku Lisensi</th>
                          <th className="p-3">Email</th>
                          <th className="p-3">Status</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-100">
                        {filteredAgents.map(agent => {
                          const reminder =
                            agentLicenseReminders.find(
                              item => item.id === agent.id
                            );

                          return (
                            <tr
                              key={agent.id}
                              className={
                                reminder
                                  ? 'bg-amber-50/50 hover:bg-amber-50'
                                  : 'hover:bg-gray-50'
                              }
                            >
                              <td className="p-3 font-mono font-bold text-blue-700">
                                {agent.agentCode}
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-gray-900">
                                  {agent.agentName}
                                </p>
                                <p className="mt-0.5 text-[10px] text-gray-500">
                                  {agent.insuranceCompany}
                                </p>
                              </td>
                              <td className="p-3 font-mono text-gray-700">
                                {agent.licenseNumber || '-'}
                              </td>
                              <td className="p-3 text-gray-600">
                                {agent.licenseDate || '-'}
                              </td>
                              <td className="p-3">
                                <p className={reminder ? 'font-bold text-amber-800' : 'text-gray-700'}>
                                  {agent.licenseExpiryDate || '-'}
                                </p>
                                {reminder && (
                                  <Badge
                                    variant="outline"
                                    className={
                                      reminder.daysRemaining <= 0
                                        ? 'mt-1 border-rose-300 bg-rose-50 text-[9px] font-bold text-rose-700'
                                        : 'mt-1 border-amber-300 bg-amber-50 text-[9px] font-bold text-amber-800'
                                    }
                                  >
                                    {reminder.daysRemaining < 0
                                      ? `Expired +${Math.abs(reminder.daysRemaining)} hari`
                                      : reminder.daysRemaining === 0
                                        ? 'Berakhir hari ini'
                                        : `H-${reminder.daysRemaining}`}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-3 text-gray-600">
                                {agent.email || '-'}
                              </td>
                              <td className="p-3">
                                <Badge
                                  variant="outline"
                                  className={
                                    agent.status === 'Active'
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                      : 'border-gray-300 bg-gray-100 text-gray-600'
                                  }
                                >
                                  {agent.status}
                                </Badge>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditAgent(agent)}
                                    className="h-7 gap-1 text-[10px]"
                                  >
                                    <Pencil className="h-3 w-3" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      try {
                                        store.setAgentStatus(
                                          agent.id,
                                          agent.status === 'Active' ? 'Inactive' : 'Active'
                                        );
                                      } catch (error) {
                                        alert(
                                          error instanceof Error
                                            ? error.message
                                            : 'Gagal mengubah status Agent.'
                                        );
                                      }
                                    }}
                                    className="h-7 text-[10px]"
                                  >
                                    {agent.status === 'Active' ? 'Nonaktifkan' : 'Aktifkan'}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Hapus ${agent.agentName} dari Master Agent?`)) {
                                        store.deleteAgent(agent.id);
                                      }
                                    }}
                                    className="h-7 border-rose-200 text-[10px] text-rose-700 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>

        {brokerFormOpen &&
          editingBroker &&
          isMarketingSupportViewer && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
                <div>
                  <h3 className="text-sm font-black text-gray-900">
                    {brokers.some(
                      broker =>
                        broker.id ===
                        editingBroker.id
                    )
                      ? 'Edit Broker'
                      : 'Tambah Broker'}
                  </h3>

                  <p className="mt-1 text-[11px] text-gray-500">
                    Seluruh akun Marketing Support dapat memelihara Master Broker.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setBrokerFormOpen(false);
                    setEditingBroker(null);
                  }}
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                {[
                  ['Nama Perusahaan', 'companyName'],
                  ['Nomor Izin Usaha', 'licenseNumber'],
                  ['Tanggal Izin Usaha', 'licenseDate'],
                  ['Kota', 'city'],
                  ['Kode Pos', 'postalCode'],
                  ['Nomor Telepon 1', 'phone1'],
                  ['Nomor Telepon 2', 'phone2'],
                  ['Nomor Fax', 'fax'],
                  ['Alamat Email', 'email'],
                  ['Website', 'website'],
                ].map(
                  ([label, field]) => (
                    <div key={field}>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        {label}
                      </label>

                      <Input
                        type={
                          field ===
                          'licenseDate'
                            ? 'date'
                            : 'text'
                        }
                        value={
                          String(
                            (editingBroker as any)[field] ||
                            ''
                          )
                        }
                        onChange={event =>
                          setEditingBroker(
                            previous =>
                              previous
                                ? {
                                    ...previous,
                                    [field]:
                                      event.target.value,
                                  }
                                : previous
                          )
                        }
                        className="text-xs"
                      />
                    </div>
                  )
                )}

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Alamat
                  </label>

                  <Textarea
                    value={editingBroker.address}
                    onChange={event =>
                      setEditingBroker(
                        previous =>
                          previous
                            ? {
                                ...previous,
                                address:
                                  event.target.value,
                              }
                            : previous
                      )
                    }
                    className="min-h-24 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Status
                  </label>

                  <select
                    value={editingBroker.status}
                    onChange={event =>
                      setEditingBroker(
                        previous =>
                          previous
                            ? {
                                ...previous,
                                status:
                                  event.target.value as
                                    | 'Active'
                                    | 'Inactive',
                              }
                            : previous
                      )
                    }
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-xs"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Sumber / Periode
                  </label>

                  <Input
                    value={editingBroker.sourcePeriod}
                    onChange={event =>
                      setEditingBroker(
                        previous =>
                          previous
                            ? {
                                ...previous,
                                sourcePeriod:
                                  event.target.value,
                              }
                            : previous
                      )
                    }
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setBrokerFormOpen(false);
                    setEditingBroker(null);
                  }}
                  className="text-xs"
                >
                  Batal
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveBroker}
                  className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Simpan Broker
                </Button>
              </div>
            </div>
          </div>
        )}

        {agentFormOpen &&
          editingAgent &&
          isMarketingSupportViewer && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
                <div>
                  <h3 className="text-sm font-black text-gray-900">
                    {agents.some(
                      agent =>
                        agent.id === editingAgent.id
                    )
                      ? 'Edit Agent'
                      : 'Tambah Agent'}
                  </h3>
                  <p className="mt-1 text-[11px] text-gray-500">
                    Tanggal Masa Berlaku Lisensi tidak boleh kurang dari tanggal hari berjalan.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAgentFormOpen(false);
                    setEditingAgent(null);
                  }}
                >
                  Tutup
                </Button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                {[
                  ['Kode Agent', 'agentCode'],
                  ['Nama Agen Asuransi', 'agentName'],
                  ['Perusahaan Asuransi', 'insuranceCompany'],
                  ['Nomor Lisensi', 'licenseNumber'],
                  ['Tanggal Lisensi', 'licenseDate'],
                  ['Tanggal Masa Berlaku Lisensi', 'licenseExpiryDate'],
                  ['Email', 'email'],
                ].map(([label, field]) => (
                  <div key={field}>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      {label}
                    </label>
                    <Input
                      type={
                        field === 'licenseDate' ||
                        field === 'licenseExpiryDate'
                          ? 'date'
                          : field === 'email'
                            ? 'email'
                            : 'text'
                      }
                      min={
                        field === 'licenseExpiryDate'
                          ? new Date().toLocaleDateString('en-CA')
                          : undefined
                      }
                      value={
                        String(
                          (editingAgent as any)[field] || ''
                        )
                      }
                      onChange={event =>
                        setEditingAgent(
                          previous =>
                            previous
                              ? {
                                  ...previous,
                                  [field]:
                                    event.target.value,
                                }
                              : previous
                        )
                      }
                      className="text-xs"
                    />
                  </div>
                ))}

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Status
                  </label>
                  <select
                    value={editingAgent.status}
                    onChange={event =>
                      setEditingAgent(
                        previous =>
                          previous
                            ? {
                                ...previous,
                                status:
                                  event.target.value as 'Active' | 'Inactive',
                              }
                            : previous
                      )
                    }
                    className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-xs"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAgentFormOpen(false);
                    setEditingAgent(null);
                  }}
                  className="text-xs"
                >
                  Batal
                </Button>

                <Button
                  type="button"
                  onClick={handleSaveAgent}
                  className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Simpan Agent
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
};

export default BookingPipelinePage;
