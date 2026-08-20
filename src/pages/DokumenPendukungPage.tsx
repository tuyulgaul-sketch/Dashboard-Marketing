import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useSearchParams,
} from 'react-router-dom';
import {
  AppLayout,
} from '@/components/layout/AppLayout';
import {
  ManagedServiceDocument,
  MarcommRequest,
  MarcommRequestDocument,
  MarcommRequestType,
  MarcommStockCategory,
  MarcommStockOpname,
  MarcommStockTier,
  MarketingToolCategory,
  OfficialPolicyRecord,
  ServiceDocumentCategory,
  store,
} from '@/services/store';
import {
  ProductMaster,
  User,
} from '@/types';
import {
  deleteMarketingSupportFile,
  downloadMarketingSupportFile,
  saveMarketingSupportFile,
} from '@/services/marketingSupportFileStorage';
import {
  formatDateKeyId,
  getMinimumMarcommNeedDateKey,
  isValidMarcommNeedDate,
} from '@/utils/businessDay';
import {
  ActionHistoryModal,
  ActionHistoryEntry,
} from '@/components/common/ActionHistoryModal';
import { SlaBadge } from '@/components/common/SlaBadge';
import {
  Badge,
} from '@/components/ui/badge';
import {
  Button,
} from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Input,
} from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Textarea,
} from '@/components/ui/textarea';
import {
  Boxes,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  FilePlus2,
  FileText,
  History,
  Megaphone,
  PackageCheck,
  PackagePlus,
  Search,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';

type PageArea =
  | 'administration'
  | 'marketing-tools'
  | 'marcomm-requests';

type DecisionContext =
  | {
      kind:
        'SERVICE_DOCUMENT';
      document:
        ManagedServiceDocument;
    }
  | {
      kind:
        'MARCOMM_INITIAL';
      request:
        MarcommRequest;
    }
  | {
      kind:
        'MARCOMM_FINAL';
      request:
        MarcommRequest;
    };

const ADMIN_CATEGORIES:
  Array<{
    value:
      ServiceDocumentCategory;
    label:
      string;
  }> = [
    {
      value:
        'SPAJ',
      label:
        'SPAJ',
    },
    {
      value:
        'SPAK',
      label:
        'SPAK',
    },
  ];

const MARKETING_TOOL_CATEGORIES:
  Array<{
    value:
      MarketingToolCategory;
    label:
      string;
  }> = [
    {
      value:
        'PROPOSAL_PENAWARAN_STANDAR',
      label:
        'Proposal Produk Standar',
    },
    {
      value:
        'MATERI_PRESENTASI',
      label:
        'Materi Presentasi Produk Standar',
    },
    {
      value:
        'BROSUR',
      label:
        'Brosur Produk Standar',
    },
  ];

type MarcommRequestGroup =
  | 'DESIGN'
  | 'GOODS_SERVICES';

type DesignRequestType =
  | 'BROADCAST'
  | 'FLYER'
  | 'PROPOSAL_PENAWARAN'
  | 'MATERI_PRESENTASI'
  | 'MATERI_SOSIALISASI'
  | 'BROSUR';

type FlowerRequestOption =
  | 'BUNGA_MEJA'
  | 'BUNGA_PAPAN'
  | 'DESIGN_UCAPAN_SAJA';

const DESIGN_REQUEST_OPTIONS:
  Array<{
    value:
      DesignRequestType;
    label:
      string;
  }> = [
    {
      value:
        'BROADCAST',
      label:
        'Broadcast',
    },
    {
      value:
        'FLYER',
      label:
        'Flyer',
    },
    {
      value:
        'PROPOSAL_PENAWARAN',
      label:
        'Proposal Penawaran',
    },
    {
      value:
        'MATERI_PRESENTASI',
      label:
        'Materi Presentasi',
    },
    {
      value:
        'MATERI_SOSIALISASI',
      label:
        'Materi Sosialisasi',
    },
    {
      value:
        'BROSUR',
      label:
        'Brosur',
    },
  ];

const GOODS_SERVICE_OPTIONS:
  Array<{
    value:
      MarcommRequestType;
    label:
      string;
  }> = [
    {
      value:
        'SOUVENIR',
      label:
        'Souvenir',
    },
    {
      value:
        'HAMPERS_HARI_RAYA',
      label:
        'Hampers Hari Raya',
    },
    {
      value:
        'OPEN_BOOTH',
      label:
        'Open Booth',
    },
    {
      value:
        'KARANGAN_BUNGA_UCAPAN',
      label:
        'Karangan Bunga dan Ucapan',
    },
    {
      value:
        'LITERASI_KEUANGAN',
      label:
        'Literasi Keuangan',
    },
  ];

const MARCOMM_REQUEST_TYPES:
  Array<{
    value:
      MarcommRequestType;
    label:
      string;
    description:
      string;
  }> = [
    {
      value:
        'MATERI_BROADCAST',
      label:
        'Broadcast',
      description:
        'Permintaan design materi broadcast.',
    },
    {
      value:
        'SOUVENIR',
      label:
        'Souvenir',
      description:
        'Permintaan barang souvenir.',
    },
    {
      value:
        'OPEN_BOOTH',
      label:
        'Open Booth',
      description:
        'Permintaan dukungan booth.',
    },
    {
      value:
        'KARANGAN_BUNGA_UCAPAN',
      label:
        'Karangan Bunga dan Ucapan',
      description:
        'Permintaan bunga fisik atau design ucapan.',
    },
    {
      value:
        'HAMPERS_HARI_RAYA',
      label:
        'Hampers Hari Raya',
      description:
        'Permintaan hampers tanpa stock opname.',
    },
    {
      value:
        'LITERASI_KEUANGAN',
      label:
        'Literasi Keuangan',
      description:
        'Permintaan pengadaan aktivitas literasi keuangan.',
    },
  ];

const MARCOMM_STOCK_POOLS:
  Array<{
    stockCategory:
      MarcommStockCategory;
    giftTier:
      MarcommStockTier;
    label:
      string;
  }> = [
    {
      stockCategory:
        'SOUVENIR',
      giftTier:
        'VIP',
      label:
        'Souvenir VIP',
    },
    {
      stockCategory:
        'SOUVENIR',
      giftTier:
        'REGULER',
      label:
        'Souvenir Reguler',
    },
  ];

const MARKETING_ACTION_ROLES = [
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
] as const;

const formatRupiah =
  (
    value?:
      number
  ) =>
    new Intl.NumberFormat(
      'id-ID',
      {
        style:
          'currency',
        currency:
          'IDR',
        maximumFractionDigits:
          0,
      }
    ).format(
      Number(
        value ||
        0
      )
    );

const formatDateTime =
  (
    value?:
      string
  ) => {
    if (
      !value
    ) {
      return '-';
    }

    const date =
      new Date(
        value
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString(
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
  };

const formatFileSize =
  (
    value:
      number
  ) => {
    if (
      value >=
      1024 *
        1024
    ) {
      return `${(
        value /
        1024 /
        1024
      ).toFixed(
        2
      )} MB`;
    }

    return `${Math.max(
      1,
      Math.round(
        value /
        1024
      )
    )} KB`;
  };

const serviceCategoryLabel =
  (
    value:
      ServiceDocumentCategory
  ) =>
    [
      ...ADMIN_CATEGORIES,
      ...MARKETING_TOOL_CATEGORIES,
    ].find(
      item =>
        item.value ===
        value
    )?.label ||
    value;

const requestTypeLabel =
  (
    value:
      MarcommRequestType
  ) => {
    if (
      value ===
      'MARKETING_TOOL'
    ) {
      return 'Permintaan Design';
    }

    return (
      MARCOMM_REQUEST_TYPES.find(
        item =>
          item.value ===
          value
      )?.label ||
      value
    );
  };

const designRequestLabel =
  (
    value?:
      string
  ) =>
    DESIGN_REQUEST_OPTIONS.find(
      option =>
        option.value ===
        value
    )?.label ||
    value ||
    'Design';

const flowerOptionLabel =
  (
    value?:
      string
  ) =>
    value ===
      'BUNGA_MEJA'
      ? 'Bunga Meja'
      : value ===
          'BUNGA_PAPAN'
        ? 'Bunga Papan'
        : value ===
            'DESIGN_UCAPAN_SAJA'
          ? 'Design Ucapan Saja'
          : value ||
            '-';

const marcommRequestLabel =
  (
    request:
      MarcommRequest
  ) => {
    if (
      request.requestGroup ===
      'DESIGN'
    ) {
      return `Design • ${designRequestLabel(
        request.designType
      )}`;
    }

    if (
      request.requestGroup ===
      'GOODS_SERVICES'
    ) {
      return `Barang & Jasa • ${requestTypeLabel(
        request.requestType
      )}`;
    }

    // Backward compatibility for old UAT request records.
    return requestTypeLabel(
      request.requestType
    );
  };

export const DokumenPendukungPage:
  React.FC = () => {
    const [
      searchParams,
      setSearchParams,
    ] =
      useSearchParams();

    const [
      currentUser,
      setCurrentUser,
    ] =
      useState<User>(
        store.getCurrentUser()
      );

    const [
      users,
      setUsers,
    ] =
      useState<User[]>(
        store.getUsers()
      );

    const [
      products,
      setProducts,
    ] =
      useState<ProductMaster[]>(
        store.getProducts()
      );

    const [
      serviceDocs,
      setServiceDocs,
    ] =
      useState<
        ManagedServiceDocument[]
      >(
        store.getServiceDocuments()
      );

    const [
      requests,
      setRequests,
    ] =
      useState<
        MarcommRequest[]
      >(
        store.getMarcommRequests()
      );

    const [
      policies,
      setPolicies,
    ] =
      useState<
        OfficialPolicyRecord[]
      >(
        store.getOfficialPolicyDirectory()
      );

    const [
      search,
      setSearch,
    ] =
      useState('');

    const [
      marcommViewTab,
      setMarcommViewTab,
    ] =
      useState<
        | 'SERVICES'
        | 'REQUESTS'
        | 'STOCK'
      >(
        'SERVICES'
      );

    const [
      productFilter,
      setProductFilter,
    ] =
      useState<
        string
      >(
        'ALL'
      );

    const [
      toolCategoryFilter,
      setToolCategoryFilter,
    ] =
      useState<
        string
      >(
        'ALL'
      );

    const [
      stockTransactions,
      setStockTransactions,
    ] =
      useState(
        store.getMarcommStockTransactions()
      );

    const [
      stockOpnames,
      setStockOpnames,
    ] =
      useState<
        MarcommStockOpname[]
      >(
        store.getMarcommStockOpnames()
      );

    const [
      stockInOpen,
      setStockInOpen,
    ] =
      useState(
        false
      );

    const [
      stockInCategory,
      setStockInCategory,
    ] =
      useState<
        MarcommStockCategory
      >(
        'SOUVENIR'
      );

    const [
      stockInTier,
      setStockInTier,
    ] =
      useState<
        MarcommStockTier
      >(
        'REGULER'
      );

    const [
      stockInQuantity,
      setStockInQuantity,
    ] =
      useState('');

    const [
      stockInNotes,
      setStockInNotes,
    ] =
      useState('');

    const [
      stockInFile,
      setStockInFile,
    ] =
      useState<
        File | null
      >(
        null
      );

    const [
      stockOpnameOpen,
      setStockOpnameOpen,
    ] =
      useState(
        false
      );

    const [
      stockOpnameCategory,
      setStockOpnameCategory,
    ] =
      useState<
        MarcommStockCategory
      >(
        'SOUVENIR'
      );

    const [
      stockOpnameTier,
      setStockOpnameTier,
    ] =
      useState<
        MarcommStockTier
      >(
        'REGULER'
      );

    const [
      stockPhysicalQuantity,
      setStockPhysicalQuantity,
    ] =
      useState('');

    const [
      stockOpnameNotes,
      setStockOpnameNotes,
    ] =
      useState('');

    const [
      stockOpnameFile,
      setStockOpnameFile,
    ] =
      useState<
        File | null
      >(
        null
      );

    const [
      stockOpnameDecision,
      setStockOpnameDecision,
    ] =
      useState<
        MarcommStockOpname | null
      >(
        null
      );

    const [
      stockOpnameDecisionNotes,
      setStockOpnameDecisionNotes,
    ] =
      useState('');

    const [
      uploadOpen,
      setUploadOpen,
    ] =
      useState(
        false
      );

    const [
      uploadCategory,
      setUploadCategory,
    ] =
      useState<
        ServiceDocumentCategory
      >(
        'SPAJ'
      );

    const [
      uploadProduct,
      setUploadProduct,
    ] =
      useState('');

    const [
      uploadTitle,
      setUploadTitle,
    ] =
      useState('');

    const [
      uploadFile,
      setUploadFile,
    ] =
      useState<
        File | null
      >(
        null
      );

    const [
      uploadNotes,
      setUploadNotes,
    ] =
      useState('');

    const [
      uploadBusy,
      setUploadBusy,
    ] =
      useState(
        false
      );

    const [
      requestOpen,
      setRequestOpen,
    ] =
      useState(
        false
      );

    const [
      requestGroup,
      setRequestGroup,
    ] =
      useState<
        MarcommRequestGroup
      >(
        'DESIGN'
      );

    const [
      designRequestType,
      setDesignRequestType,
    ] =
      useState<
        DesignRequestType
      >(
        'BROADCAST'
      );

    const [
      requestType,
      setRequestType,
    ] =
      useState<
        MarcommRequestType
      >(
        'MATERI_BROADCAST'
      );

    const [
      requestToolCategory,
      setRequestToolCategory,
    ] =
      useState<
        MarketingToolCategory
      >(
        'PROPOSAL_PENAWARAN_STANDAR'
      );

    const [
      clientType,
      setClientType,
    ] =
      useState<
        'EXISTING'
        | 'PROSPECT'
      >(
        'EXISTING'
      );

    const [
      selectedPolicy,
      setSelectedPolicy,
    ] =
      useState<
        OfficialPolicyRecord | null
      >(
        null
      );

    const [
      policySearch,
      setPolicySearch,
    ] =
      useState('');

    const [
      policyPickerOpen,
      setPolicyPickerOpen,
    ] =
      useState(
        false
      );

    const [
      prospectiveClient,
      setProspectiveClient,
    ] =
      useState('');

    const [
      requestProduct,
      setRequestProduct,
    ] =
      useState('');

    const [
      needDate,
      setNeedDate,
    ] =
      useState('');

    const minimumMarcommNeedDate =
      getMinimumMarcommNeedDateKey();

    const [
      locationValue,
      setLocationValue,
    ] =
      useState('');

    const [
      quantity,
      setQuantity,
    ] =
      useState('');

    const [
      giftTier,
      setGiftTier,
    ] =
      useState<
        'VIP'
        | 'REGULER'
      >(
        'REGULER'
      );

    const [
      flowerOption,
      setFlowerOption,
    ] =
      useState<
        FlowerRequestOption
      >(
        'BUNGA_PAPAN'
      );

    const [
      greetingText,
      setGreetingText,
    ] =
      useState('');

    const [
      participantEstimate,
      setParticipantEstimate,
    ] =
      useState('');

    const [
      estimatedBudget,
      setEstimatedBudget,
    ] =
      useState('');

    const [
      brief,
      setBrief,
    ] =
      useState('');

    const [
      requestFiles,
      setRequestFiles,
    ] =
      useState<
        File[]
      >([]);

    const [
      decisionContext,
      setDecisionContext,
    ] =
      useState<
        DecisionContext | null
      >(
        null
      );

    const [
      decisionNotes,
      setDecisionNotes,
    ] =
      useState('');

    const [
      andiFinalQuantity,
      setAndiFinalQuantity,
    ] =
      useState('');

    const [
      andiFinalGiftTier,
      setAndiFinalGiftTier,
    ] =
      useState<
        'VIP'
        | 'REGULER'
      >(
        'REGULER'
      );

    const [
      executionRequest,
      setExecutionRequest,
    ] =
      useState<
        MarcommRequest | null
      >(
        null
      );

    const [
      executionFiles,
      setExecutionFiles,
    ] =
      useState<
        File[]
      >([]);

    const [
      executionNotes,
      setExecutionNotes,
    ] =
      useState('');

    const [
      revisionRequest,
      setRevisionRequest,
    ] =
      useState<
        MarcommRequest | null
      >(
        null
      );

    const [
      historyMarcommRequest,
      setHistoryMarcommRequest,
    ] =
      useState<
        MarcommRequest | null
      >(
        null
      );

    const [
      historyServiceDocument,
      setHistoryServiceDocument,
    ] =
      useState<
        ManagedServiceDocument | null
      >(
        null
      );

    const [
      revisionNotes,
      setRevisionNotes,
    ] =
      useState('');

    const [
      revisionFiles,
      setRevisionFiles,
    ] =
      useState<
        File[]
      >([]);

    useEffect(
      () => {
        const refresh =
          () => {
            setCurrentUser(
              store.getCurrentUser()
            );

            setUsers(
              store.getUsers()
            );

            setProducts(
              store.getProducts()
            );

            setServiceDocs(
              store.getServiceDocuments()
            );

            setRequests(
              store.getMarcommRequests()
            );

            setStockTransactions(
              store.getMarcommStockTransactions()
            );

            setStockOpnames(
              store.getMarcommStockOpnames()
            );

            setPolicies(
              store.getOfficialPolicyDirectory()
            );
          };

        refresh();

        return store.subscribe(
          refresh
        );
      },
      []
    );

    const rawArea =
      searchParams.get(
        'area'
      );

    const area:
      PageArea =
      rawArea ===
        'marketing-tools' ||
      rawArea ===
        'marcomm-requests' ||
      rawArea ===
        'administration'
        ? rawArea
        : 'administration';

    const dashboardFilter =
      searchParams.get(
        'filter'
      ) ||
      '';

    const focusRequestId =
      searchParams.get(
        'requestId'
      ) ||
      '';

    const focusDocumentId =
      searchParams.get(
        'documentId'
      ) ||
      '';

    const focusOpnameId =
      searchParams.get(
        'opnameId'
      ) ||
      '';

    useEffect(
      () => {
        if (
          rawArea !==
          area
        ) {
          setSearchParams({
            area,
          });
        }
      },
      [
        rawArea,
        area,
        setSearchParams,
      ]
    );

    useEffect(
      () => {
        const hash =
          window.location.hash.replace(
            '#',
            ''
          );

        if (
          !hash
        ) {
          return;
        }

        const timer =
          window.setTimeout(
            () => {
              document
                .getElementById(
                  hash
                )
                ?.scrollIntoView({
                  behavior:
                    'smooth',
                  block:
                    'start',
                });
            },
            80
          );

        return () =>
          window.clearTimeout(
            timer
          );
      },
      [
        area,
        dashboardFilter,
        focusRequestId,
        focusDocumentId,
        focusOpnameId,
      ]
    );

    const isMarketing =
      MARKETING_ACTION_ROLES.includes(
        currentUser.role as
          (
            typeof MARKETING_ACTION_ROLES
          )[number]
      );

    const isArianie =
      currentUser.id ===
      'USR-000024';

    const isEndah =
      store.canActAsMarketingAdministrationHead(
        currentUser.id
      );

    const isAdminOperator =
      [
        'USR-000025',
        'USR-000026',
        'USR-000027',
        'USR-000029',
      ].includes(
        currentUser.id
      );

    const isAndi =
      store.canActAsMarketingCommunicationHead(
        currentUser.id
      );

    const isKarina =
      currentUser.id ===
      'USR-000031';

    const canManageMarcommStock =
      isArianie ||
      isAndi ||
      isKarina;

    const pendingStockOpnames =
      stockOpnames.filter(
        opname =>
          opname.status ===
          'PENDING_ANDI_APPROVAL'
      );

    useEffect(
      () => {
        if (
          area !==
          'marcomm-requests'
        ) {
          return;
        }

        if (
          focusOpnameId ||
          dashboardFilter ===
            'ANDI_OPNAME' ||
          window.location.hash ===
            '#stock-control'
        ) {
          setMarcommViewTab(
            'STOCK'
          );

          return;
        }

        if (
          focusRequestId ||
          dashboardFilter ||
          window.location.hash ===
            '#activity-request'
        ) {
          setMarcommViewTab(
            'REQUESTS'
          );

          return;
        }

        if (
          isAndi ||
          isKarina
        ) {
          setMarcommViewTab(
            'REQUESTS'
          );

          return;
        }

        setMarcommViewTab(
          'SERVICES'
        );
      },
      [
        area,
        dashboardFilter,
        focusRequestId,
        focusOpnameId,
        isAndi,
        isKarina,
      ]
    );

    const activeProducts =
      useMemo(
        () =>
          products
            .filter(
              product =>
                product.status ===
                'Active'
            )
            .sort(
              (
                first,
                second
              ) =>
                first.productName.localeCompare(
                  second.productName,
                  'id'
                )
            ),
        [
          products,
        ]
      );

    const getUserById =
      (
        userId:
          string
      ) =>
        users.find(
          user =>
            user.id ===
            userId
        );

    const isAncestor =
      (
        ancestorId:
          string,
        userId:
          string
      ) => {
        let cursor =
          getUserById(
            userId
          );

        const visited =
          new Set<
            string
          >();

        while (
          cursor?.superiorId &&
          !visited.has(
            cursor.id
          )
        ) {
          visited.add(
            cursor.id
          );

          if (
            cursor.superiorId ===
            ancestorId
          ) {
            return true;
          }

          cursor =
            getUserById(
              cursor.superiorId
            );
        }

        return false;
      };

    const canSeeRequest =
      (
        request:
          MarcommRequest
      ) => {
        if (
          isArianie ||
          isAndi ||
          isKarina
        ) {
          return true;
        }

        if (
          !isMarketing
        ) {
          return false;
        }

        if (
          request.requesterUserId ===
          currentUser.id
        ) {
          return true;
        }

        const requester =
          getUserById(
            request.requesterUserId
          );

        if (
          !requester
        ) {
          return false;
        }

        const sameTeam =
          requester.unit ===
            currentUser.unit &&
          requester.department ===
            currentUser.department;

        return (
          sameTeam ||
          isAncestor(
            currentUser.id,
            requester.id
          ) ||
          isAncestor(
            requester.id,
            currentUser.id
          )
        );
      };

    const visibleRequests =
      useMemo(
        () =>
          requests.filter(
            request =>
              canSeeRequest(
                request
              )
          ),
        [
          requests,
          currentUser.id,
          users,
        ]
      );

    const dashboardFilteredRequests =
      useMemo(
        () => {
          const base =
            visibleRequests;

          if (
            focusRequestId
          ) {
            return base.filter(
              request =>
                request.id ===
                focusRequestId
            );
          }

          if (
            !dashboardFilter ||
            dashboardFilter ===
              'ALL'
          ) {
            return base;
          }

          return base.filter(
            request => {
              if (
                dashboardFilter ===
                'ANDI_INITIAL'
              ) {
                return (
                  request.status ===
                    'PENDING_ANDI_APPROVAL' ||
                  request.status ===
                    'REVISION_REQUESTED_PENDING_ANDI'
                );
              }

              if (
                dashboardFilter ===
                'ANDI_FINAL'
              ) {
                return (
                  request.status ===
                  'PENDING_ANDI_FINAL_REVIEW'
                );
              }

              if (
                dashboardFilter ===
                'KARINA_READY'
              ) {
                return (
                  request.status ===
                  'APPROVED_WAITING_KARINA'
                );
              }

              if (
                dashboardFilter ===
                'KARINA_IN_PROGRESS'
              ) {
                return (
                  request.status ===
                  'IN_PROGRESS'
                );
              }

              if (
                dashboardFilter ===
                'KARINA_WAITING_REVIEW'
              ) {
                return (
                  request.status ===
                  'PENDING_ANDI_FINAL_REVIEW'
                );
              }

              if (
                dashboardFilter ===
                'OVERDUE'
              ) {
                const terminal =
                  request.status ===
                    'COMPLETED' ||
                  request.status ===
                    'REJECTED_BY_ANDI';

                return (
                  !terminal &&
                  requestDaysRemaining(
                    request
                  ) <
                    0
                );
              }

              return true;
            }
          );
        },
        [
          visibleRequests,
          dashboardFilter,
          focusRequestId,
        ]
      );

    const dashboardFilterLabel =
      focusRequestId
        ? `Request ${focusRequestId}`
        : {
            ANDI_INITIAL:
              'Approval Awal Andi',
            ANDI_FINAL:
              'Final Review Department Head Marketing Communication',
            KARINA_READY:
              'Siap Dikerjakan Karina',
            KARINA_IN_PROGRESS:
              'Sedang Dikerjakan Karina',
            KARINA_WAITING_REVIEW:
              'Menunggu Review Department Head Marketing Communication',
            OVERDUE:
              'Request Overdue',
            ANDI_OPNAME:
              'Stock Opname Souvenir Menunggu Approval',
          }[
            dashboardFilter
          ] ||
          '';

    const filteredPolicies =
      useMemo(
        () => {
          const query =
            policySearch
              .trim()
              .toLowerCase();

          const base =
            policies.filter(
              policy => {
                if (
                  !isMarketing
                ) {
                  return true;
                }

                const policyPic =
                  policy.picUserId
                    ? getUserById(
                        policy.picUserId
                      )
                    : undefined;

                if (
                  !policyPic
                ) {
                  return true;
                }

                return (
                  policy.picUserId ===
                    currentUser.id ||
                  (
                    policyPic.unit ===
                      currentUser.unit &&
                    policyPic.department ===
                      currentUser.department
                  ) ||
                  isAncestor(
                    currentUser.id,
                    policyPic.id
                  )
                );
              }
            );

          if (
            !query
          ) {
            return base.slice(
              0,
              50
            );
          }

          return base
            .filter(
              policy =>
                [
                  policy.policyNumber,
                  policy.customerName,
                  policy.productName,
                  policy.picName,
                ]
                  .join(
                    ' '
                  )
                  .toLowerCase()
                  .includes(
                    query
                  )
            )
            .slice(
              0,
              50
            );
        },
        [
          policies,
          policySearch,
          currentUser.id,
          users,
        ]
      );

    const publishedDocs =
      useMemo(
        () =>
          serviceDocs.filter(
            document =>
              document.status ===
              'PUBLISHED'
          ),
        [
          serviceDocs,
        ]
      );

    const pendingAdminDocs =
      serviceDocs.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.status ===
            'PENDING_APPROVAL'
      );

    const standardMarketingToolCategorySet =
      new Set(
        MARKETING_TOOL_CATEGORIES.map(
          category =>
            category.value
        )
      );

    const pendingMarcommDocs =
      serviceDocs.filter(
        document =>
          document.ownerArea ===
            'MARKETING_COMMUNICATION' &&
          document.status ===
            'PENDING_APPROVAL' &&
          standardMarketingToolCategorySet.has(
            document.category as
              MarketingToolCategory
          )
      );

    const getStockSnapshot =
      (
        stockCategory:
          MarcommStockCategory,
        tier:
          MarcommStockTier
      ) =>
        store.getMarcommStockSnapshot(
          stockCategory,
          tier
        );

    const selectedGiftStockSnapshot =
      requestType ===
        'SOUVENIR'
        ? getStockSnapshot(
            'SOUVENIR',
            giftTier
          )
        : null;

    const andiGiftStockSnapshot =
      decisionContext?.kind ===
        'MARCOMM_INITIAL' &&
      decisionContext.request.requestType ===
        'SOUVENIR'
        ? getStockSnapshot(
            'SOUVENIR',
            andiFinalGiftTier
          )
        : null;

    const openUpload =
      (
        category?:
          ServiceDocumentCategory
      ) => {
        if (
          category
        ) {
          setUploadCategory(
            category
          );
        } else if (
          area ===
          'marketing-tools'
        ) {
          setUploadCategory(
            'PROPOSAL_PENAWARAN_STANDAR'
          );
        } else {
          setUploadCategory(
            'SPAJ'
          );
        }

        setUploadProduct('');
        setUploadTitle('');
        setUploadFile(
          null
        );
        setUploadNotes('');
        setUploadOpen(
          true
        );
      };

    const getNextDocumentVersion =
      (
        category:
          ServiceDocumentCategory,
        productName:
          string
      ) => {
        const versions =
          serviceDocs
            .filter(
              document =>
                document.category ===
                  category &&
                (
                  document.productName ||
                  ''
                ) ===
                  productName
            )
            .map(
              document =>
                Number(
                  document.version ||
                  0
                )
            );

        return (
          Math.max(
            0,
            ...versions
          ) +
          1
        );
      };

    const handleUploadServiceDocument =
      async () => {
        const ownerArea =
          area ===
          'administration'
            ? 'MARKETING_ADMINISTRATION'
            : 'MARKETING_COMMUNICATION';

        const allowed =
          ownerArea ===
            'MARKETING_ADMINISTRATION'
            ? isAdminOperator
            : isKarina;

        if (
          !allowed
        ) {
          alert(
            'User ini tidak memiliki kewenangan upload pada service owner tersebut.'
          );

          return;
        }

        if (
          !uploadProduct ||
          !uploadTitle.trim() ||
          !uploadFile
        ) {
          alert(
            'Produk, judul, dan file wajib diisi.'
          );

          return;
        }

        if (
          uploadFile.size >
          25 *
            1024 *
            1024
        ) {
          alert(
            'Ukuran file maksimum 25 MB untuk UAT browser storage.'
          );

          return;
        }

        const product =
          activeProducts.find(
            item =>
              item.productName ===
              uploadProduct
          );

        if (
          !product
        ) {
          alert(
            'Produk tidak ditemukan pada Product Master.'
          );

          return;
        }

        setUploadBusy(
          true
        );

        const version =
          getNextDocumentVersion(
            uploadCategory,
            uploadProduct
          );

        const id =
          `MSDOC-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)
            .toUpperCase()}`;

        try {
          await saveMarketingSupportFile(
            id,
            uploadFile
          );

          store.saveServiceDocument({
            id,
            ownerArea,
            category:
              uploadCategory,
            productName:
              product.productName,
            insuranceType:
              product.insuranceType,
            customerCategory:
              product.customerCategory,
            title:
              uploadTitle.trim(),
            version,
            versionLabel:
              `V${version}`,
            fileName:
              uploadFile.name,
            fileSize:
              uploadFile.size,
            status:
              'PENDING_APPROVAL',
            uploadedByUserId:
              currentUser.id,
            uploadedByName:
              currentUser.name,
            uploadedAt:
              new Date().toISOString(),
            notes:
              uploadNotes.trim() ||
              undefined,
          });

          setUploadOpen(
            false
          );

          alert(
            ownerArea ===
            'MARKETING_ADMINISTRATION'
              ? `Dokumen berhasil dikirim untuk approval Endah Wasis.`
              : `Dokumen berhasil dikirim untuk approval Department Head Marketing Communication.`
          );
        } catch (
          error
        ) {
          try {
            await deleteMarketingSupportFile(
              id
            );
          } catch {
            // Best effort cleanup.
          }

          alert(
            error instanceof
              Error
              ? error.message
              : 'Upload dokumen gagal.'
          );
        } finally {
          setUploadBusy(
            false
          );
        }
      };

    const handleDownload =
      async (
        id:
          string,
        fileName:
          string
      ) => {
        try {
          await downloadMarketingSupportFile(
            id,
            fileName
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'File tidak dapat diunduh.'
          );
        }
      };

    const applyDesignRequestType =
      (
        value:
          DesignRequestType
      ) => {
        setDesignRequestType(
          value
        );

        if (
          value ===
          'BROADCAST'
        ) {
          setRequestType(
            'MATERI_BROADCAST'
          );

          return;
        }

        setRequestType(
          'MARKETING_TOOL'
        );

        const category:
          MarketingToolCategory =
          value ===
            'FLYER'
            ? 'FLYER'
            : value ===
                'PROPOSAL_PENAWARAN'
              ? 'PROPOSAL_PENAWARAN_STANDAR'
              : value ===
                  'MATERI_PRESENTASI'
                ? 'MATERI_PRESENTASI'
                : value ===
                    'MATERI_SOSIALISASI'
                  ? 'MATERI_SOSIALISASI'
                  : 'BROSUR';

        setRequestToolCategory(
          category
        );
      };

    const openRequest =
      () => {
        setRequestGroup(
          'DESIGN'
        );
        applyDesignRequestType(
          'BROADCAST'
        );
        setClientType(
          'EXISTING'
        );
        setSelectedPolicy(
          null
        );
        setPolicySearch('');
        setProspectiveClient('');
        setRequestProduct('');
        setNeedDate('');
        setLocationValue('');
        setQuantity('');
        setGiftTier(
          'REGULER'
        );
        setFlowerOption(
          'BUNGA_PAPAN'
        );
        setGreetingText('');
        setParticipantEstimate('');
        setEstimatedBudget('');
        setBrief('');
        setRequestFiles([]);
        setRequestOpen(
          true
        );
      };

    const saveFilesAsRequestDocuments =
      async (
        files:
          File[],
        documentRole:
          MarcommRequestDocument['documentRole'],
        prefix:
          string
      ): Promise<
        MarcommRequestDocument[]
      > => {
        const now =
          new Date().toISOString();

        const documents =
          files.map(
            (
              file,
              index
            ) => ({
              id:
                `${prefix}-${Date.now()}-${index + 1}-${Math.random()
                  .toString(36)
                  .slice(2, 5)}`,
              fileName:
                file.name,
              fileSize:
                file.size,
              uploadedByUserId:
                currentUser.id,
              uploadedByName:
                currentUser.name,
              uploadedAt:
                now,
              documentRole,
            })
          );

        await Promise.all(
          files.map(
            (
              file,
              index
            ) =>
              saveMarketingSupportFile(
                documents[
                  index
                ].id,
                file
              )
          )
        );

        return documents;
      };

    const handleSubmitRequest =
      async () => {
        if (
          !isMarketing
        ) {
          alert(
            'Request hanya dapat dibuat oleh user Marketing.'
          );

          return;
        }

        const clientName =
          clientType ===
            'EXISTING'
            ? selectedPolicy?.customerName
            : prospectiveClient.trim();

        if (
          !clientName
        ) {
          alert(
            clientType ===
              'EXISTING'
              ? 'Pilih nomor polis existing.'
              : 'Nama calon klien wajib diisi.'
          );

          return;
        }

        if (
          !needDate ||
          !brief.trim()
        ) {
          alert(
            'Tanggal kebutuhan dan brief wajib diisi.'
          );

          return;
        }

        if (
          !isValidMarcommNeedDate(
            needDate
          )
        ) {
          alert(
            `Tanggal dibutuhkan minimal 3 hari kerja dari tanggal sistem. Tanggal paling awal yang dapat dipilih adalah ${formatDateKeyId(
              minimumMarcommNeedDate
            )}. Hari kerja dihitung Senin sampai Jumat dan hari pengajuan tidak dihitung.`
          );

          return;
        }

        const isDesignRequest =
          requestGroup ===
          'DESIGN';

        const isGiftRequest =
          requestType ===
            'SOUVENIR' ||
          requestType ===
            'HAMPERS_HARI_RAYA';

        if (
          isDesignRequest &&
          !requestProduct
        ) {
          alert(
            'Permintaan Design wajib dikaitkan dengan produk.'
          );

          return;
        }

        if (
          isGiftRequest &&
          (
            !quantity ||
            Number(
              quantity
            ) <=
              0
          )
        ) {
          alert(
            'Jumlah Souvenir/Hampers wajib diisi dan harus lebih dari 0.'
          );

          return;
        }

        if (
          (
            requestType ===
              'OPEN_BOOTH' ||
            requestType ===
              'LITERASI_KEUANGAN'
          ) &&
          (
            !participantEstimate ||
            Number(
              participantEstimate
            ) <=
              0
          )
        ) {
          alert(
            'Estimasi jumlah peserta wajib diisi untuk Open Booth / Literasi Keuangan.'
          );

          return;
        }

        if (
          requestType ===
          'KARANGAN_BUNGA_UCAPAN'
        ) {
          if (
            !greetingText.trim()
          ) {
            alert(
              'Tulisan/ucapan yang diminta wajib diisi.'
            );

            return;
          }

          if (
            flowerOption !==
              'DESIGN_UCAPAN_SAJA' &&
            !locationValue.trim()
          ) {
            alert(
              'Alamat/lokasi pengiriman wajib diisi untuk bunga meja atau bunga papan.'
            );

            return;
          }
        }

        if (
          requestFiles.length >
          10
        ) {
          alert(
            'Maksimal 10 lampiran request.'
          );

          return;
        }

        try {
          const attachments =
            await saveFilesAsRequestDocuments(
              requestFiles,
              'REQUEST_ATTACHMENT',
              'MCREQ'
            );

          const now =
            new Date().toISOString();

          const requestId =
            `MCR-${new Date().getFullYear()}-${Date.now()
              .toString()
              .slice(-7)}`;

          store.createMarcommRequest({
            id:
              requestId,
            requestType,
            marketingToolCategory:
              requestType ===
                'MARKETING_TOOL'
                ? requestToolCategory
                : undefined,
            requestGroup,
            designType:
              requestGroup ===
                'DESIGN'
                ? designRequestType
                : undefined,
            flowerOption:
              requestType ===
                'KARANGAN_BUNGA_UCAPAN'
                ? flowerOption
                : undefined,
            greetingText:
              requestType ===
                'KARANGAN_BUNGA_UCAPAN'
                ? greetingText.trim()
                : undefined,
            participantEstimate:
              (
                requestType ===
                  'OPEN_BOOTH' ||
                requestType ===
                  'LITERASI_KEUANGAN'
              )
                ? Number(
                    participantEstimate
                  )
                : undefined,
            requesterUserId:
              currentUser.id,
            requesterName:
              currentUser.name,
            requesterUnit:
              currentUser.unit,
            requesterDepartment:
              currentUser.department,
            requesterPosition:
              currentUser.position,
            clientType,
            policyNumber:
              clientType ===
                'EXISTING'
                ? selectedPolicy?.policyNumber
                : undefined,
            clientName:
              clientName as
                string,
            productName:
              requestProduct ||
              selectedPolicy?.productName ||
              undefined,
            requestedAt:
              now,
            needDate,
            location:
              locationValue.trim() ||
              undefined,
            quantity:
              quantity
                ? Number(
                    quantity
                  )
                : undefined,
            giftTier:
              isGiftRequest
                ? giftTier
                : undefined,
            estimatedBudget:
              estimatedBudget
                ? Number(
                    estimatedBudget
                      .replace(
                        /[^0-9.-]/g,
                        ''
                      )
                  )
                : undefined,
            brief:
              brief.trim(),
            requestAttachments:
              attachments,
            status:
              'PENDING_ANDI_APPROVAL',
            deliverables:
              [],
            revisionHistory:
              [],
            lastUpdatedAt:
              now,
          });

          setRequestOpen(
            false
          );

          alert(
            'Request berhasil dikirim ke Department Head Marketing Communication untuk approval awal.'
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Request gagal disubmit.'
          );
        }
      };

    const handleDecision =
      (
        approved:
          boolean
      ) => {
        if (
          !decisionContext
        ) {
          return;
        }

        try {
          if (
            decisionContext.kind ===
            'SERVICE_DOCUMENT'
          ) {
            store.approveServiceDocument(
              decisionContext.document.id,
              approved,
              decisionNotes
            );
          } else if (
            decisionContext.kind ===
            'MARCOMM_INITIAL'
          ) {
            const isGiftAuthorityRequest =
              decisionContext.request.requestType ===
                'SOUVENIR' ||
              decisionContext.request.requestType ===
                'HAMPERS_HARI_RAYA';

            store.decideMarcommRequestByAndi(
              decisionContext.request.id,
              approved,
              decisionNotes,
              isGiftAuthorityRequest &&
              approved
                ? {
                    quantity:
                      Number(
                        andiFinalQuantity
                      ),
                    giftTier:
                      andiFinalGiftTier,
                  }
                : undefined
            );
          } else {
            store.approveMarcommDeliverableByAndi(
              decisionContext.request.id,
              approved,
              decisionNotes
            );
          }

          setDecisionContext(
            null
          );

          setDecisionNotes('');
          setAndiFinalQuantity('');
          setAndiFinalGiftTier(
            'REGULER'
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Keputusan gagal disimpan.'
          );
        }
      };

    const handleStartRequest =
      (
        request:
          MarcommRequest
      ) => {
        if (
          !window.confirm(
            `Mulai kerjakan ${request.id}?`
          )
        ) {
          return;
        }

        try {
          store.startMarcommRequestByKarina(
            request.id
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Gagal memulai request.'
          );
        }
      };

    const handleSubmitExecution =
      async () => {
        if (
          !executionRequest
        ) {
          return;
        }

        if (
          executionFiles.length ===
          0
        ) {
          alert(
            'Upload minimal satu file hasil/evidence.'
          );

          return;
        }

        if (
          executionFiles.length >
          10
        ) {
          alert(
            'Maksimal 10 file.'
          );

          return;
        }

        try {
          const isDigital =
            executionRequest.requestGroup ===
              'DESIGN' ||
            (
              executionRequest.requestType ===
                'KARANGAN_BUNGA_UCAPAN' &&
              executionRequest.flowerOption ===
                'DESIGN_UCAPAN_SAJA'
            ) ||
            (
              !executionRequest.requestGroup &&
              (
                executionRequest.requestType ===
                  'MARKETING_TOOL' ||
                executionRequest.requestType ===
                  'MATERI_BROADCAST'
              )
            );

          const documents =
            await saveFilesAsRequestDocuments(
              executionFiles,
              isDigital
                ? 'DELIVERABLE'
                : 'EVIDENCE',
              'MCOUT'
            );

          store.submitMarcommDeliverableByKarina(
            executionRequest.id,
            documents,
            executionNotes
          );

          setExecutionRequest(
            null
          );

          setExecutionFiles([]);
          setExecutionNotes('');
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Upload hasil/evidence gagal.'
          );
        }
      };

    const handleSubmitRevision =
      async () => {
        if (
          !revisionRequest
        ) {
          return;
        }

        if (
          !revisionNotes.trim()
        ) {
          alert(
            'Catatan revisi wajib diisi.'
          );

          return;
        }

        try {
          const attachments =
            await saveFilesAsRequestDocuments(
              revisionFiles,
              'REVISION_ATTACHMENT',
              'MCREV'
            );

          store.requestMarcommRevisionByMarketing(
            revisionRequest.id,
            revisionNotes,
            attachments
          );

          setRevisionRequest(
            null
          );

          setRevisionNotes('');
          setRevisionFiles([]);
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Permintaan revisi gagal.'
          );
        }
      };

    const buildOptionalStockAttachment =
      async (
        file:
          File | null,
        prefix:
          string
      ): Promise<
        MarcommRequestDocument | undefined
      > => {
        if (
          !file
        ) {
          return undefined;
        }

        const id =
          `${prefix}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

        await saveMarketingSupportFile(
          id,
          file
        );

        return {
          id,
          fileName:
            file.name,
          fileSize:
            file.size,
          uploadedByUserId:
            currentUser.id,
          uploadedByName:
            currentUser.name,
          uploadedAt:
            new Date().toISOString(),
          documentRole:
            'EVIDENCE',
        };
      };

    const handleStockIn =
      async () => {
        if (
          !isKarina
        ) {
          return;
        }

        const normalized =
          Number(
            stockInQuantity
          );

        if (
          !Number.isFinite(
            normalized
          ) ||
          normalized <=
            0
        ) {
          alert(
            'Jumlah stock masuk harus lebih dari 0.'
          );

          return;
        }

        try {
          const attachment =
            await buildOptionalStockAttachment(
              stockInFile,
              'MCSTK-IN'
            );

          store.recordMarcommStockIn(
            stockInCategory,
            stockInTier,
            normalized,
            stockInNotes,
            attachment
          );

          setStockInOpen(
            false
          );
          setStockInQuantity('');
          setStockInNotes('');
          setStockInFile(
            null
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Gagal mencatat stock masuk.'
          );
        }
      };

    const handleSubmitStockOpname =
      async () => {
        if (
          !isKarina
        ) {
          return;
        }

        const normalized =
          Number(
            stockPhysicalQuantity
          );

        if (
          !Number.isFinite(
            normalized
          ) ||
          normalized <
            0
        ) {
          alert(
            'Stock fisik harus 0 atau lebih.'
          );

          return;
        }

        try {
          const attachment =
            await buildOptionalStockAttachment(
              stockOpnameFile,
              'MCOP'
            );

          store.submitMarcommStockOpname(
            stockOpnameCategory,
            stockOpnameTier,
            normalized,
            stockOpnameNotes,
            attachment
          );

          setStockOpnameOpen(
            false
          );
          setStockPhysicalQuantity('');
          setStockOpnameNotes('');
          setStockOpnameFile(
            null
          );
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Gagal submit stock opname.'
          );
        }
      };

    const handleDecideStockOpname =
      (
        approved:
          boolean
      ) => {
        if (
          !stockOpnameDecision
        ) {
          return;
        }

        try {
          store.decideMarcommStockOpname(
            stockOpnameDecision.id,
            approved,
            stockOpnameDecisionNotes
          );

          setStockOpnameDecision(
            null
          );
          setStockOpnameDecisionNotes('');
        } catch (
          error
        ) {
          alert(
            error instanceof
              Error
              ? error.message
              : 'Keputusan stock opname gagal disimpan.'
          );
        }
      };

    const stockCategoryLabel =
      (
        category:
          MarcommStockCategory
      ) =>
        'Souvenir';

    const requestDaysRemaining =
      (
        request:
          MarcommRequest
      ) => {
        const today =
          new Date();

        const todayStart =
          new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate()
          );

        const due =
          new Date(
            `${request.needDate}T00:00:00`
          );

        return Math.ceil(
          (
            due.getTime() -
            todayStart.getTime()
          ) /
          (
            24 *
            60 *
            60 *
            1000
          )
        );
      };

    const statusLabel =
      (
        status:
          MarcommRequest['status']
      ) => {
        const labels:
          Record<
            MarcommRequest['status'],
            string
          > = {
            PENDING_ANDI_APPROVAL:
              'Menunggu Approval Department Head Marketing Communication',
            REJECTED_BY_ANDI:
              'Ditolak Department Head Marketing Communication',
            APPROVED_WAITING_KARINA:
              'Menunggu Eksekusi Karina',
            IN_PROGRESS:
              'Dikerjakan Karina',
            PENDING_ANDI_FINAL_REVIEW:
              'Menunggu Final Review Department Head Marketing Communication',
            PUBLISHED_WAITING_MARKETING:
              'Hasil Tersedia / Review Marketing',
            REVISION_REQUESTED_PENDING_ANDI:
              'Revisi Menunggu Approval Department Head Marketing Communication',
            COMPLETED:
              'Selesai',
          };

        return labels[
          status
        ];
      };

    const getMarcommSlaStartedAt =
      (
        request:
          MarcommRequest
      ): string | undefined => {
        if (
          request.status ===
            'PENDING_ANDI_APPROVAL'
        ) {
          return request.requestedAt;
        }

        if (
          request.status ===
            'APPROVED_WAITING_KARINA'
        ) {
          return (
            request.andiDecisionAt ||
            request.requestedAt
          );
        }

        if (
          request.status ===
            'IN_PROGRESS'
        ) {
          return (
            request.startedAt ||
            request.andiDecisionAt ||
            request.requestedAt
          );
        }

        if (
          request.status ===
            'PENDING_ANDI_FINAL_REVIEW'
        ) {
          const latest =
            (
              request.deliverables ||
              []
            ).slice(-1)[0];

          return (
            latest?.submittedAt ||
            request.lastUpdatedAt
          );
        }

        if (
          request.status ===
            'PUBLISHED_WAITING_MARKETING'
        ) {
          const latest =
            (
              request.deliverables ||
              []
            ).slice(-1)[0];

          return (
            latest?.approvedAt ||
            request.lastUpdatedAt
          );
        }

        if (
          request.status ===
            'REVISION_REQUESTED_PENDING_ANDI'
        ) {
          const latest =
            (
              request.revisionHistory ||
              []
            ).slice(-1)[0];

          return (
            latest?.requestedAt ||
            request.lastUpdatedAt
          );
        }

        return undefined;
      };

    const resolveUserPosition =
      (
        userId?:
          string,
        userName?:
          string
      ) =>
        users.find(
          user =>
            (
              userId &&
              user.id ===
                userId
            ) ||
            (
              userName &&
              user.name ===
                userName
            )
        )?.position;

    const marcommAuditActionLabel =
      (
        action:
          string
      ) => {
        const labels:
          Record<
            string,
            string
          > = {
            CREATE_REQUEST:
              'Request Marcomm Disubmit',
            APPROVE_INITIAL:
              'Approval Awal Disetujui',
            REJECT_INITIAL:
              'Approval Awal Ditolak',
            APPROVE_REVISION_REQUEST:
              'Permintaan Revisi Disetujui',
            REJECT_REVISION_REQUEST:
              'Permintaan Revisi Ditolak',
            FINALIZE_GIFT_AUTHORITY:
              'Tier / Qty Final Ditetapkan',
            START_EXECUTION:
              'Eksekusi Dimulai',
            SUBMIT_DELIVERABLE:
              'Hasil / Evidence Disubmit',
            APPROVE_FINAL_DELIVERABLE:
              'Final Review Hasil Disetujui',
            REJECT_FINAL_DELIVERABLE:
              'Final Review Hasil Ditolak',
            REQUEST_REVISION:
              'Marketing Meminta Revisi',
            ACCEPT_RESULT_COMPLETE:
              'Hasil Diterima & Request Selesai',
          };

        return (
          labels[
            action
          ] ||
          action
            .replace(
              /_/g,
              ' '
            )
        );
      };

    const buildMarcommRequestHistory =
      (
        request:
          MarcommRequest
      ):
        ActionHistoryEntry[] => {
      const auditLogs =
        store
          .getAuditLogs()
          .filter(
            log =>
              log.module ===
                'MARCOMM' &&
              log.recordId ===
                request.id
          );

      const entries:
        ActionHistoryEntry[] =
        auditLogs.map(
          log => ({
            id:
              log.id,
            timestamp:
              log.timestamp,
            actorName:
              log.userName,
            actorRole:
              resolveUserPosition(
                log.userId,
                log.userName
              ) ||
              log.userRole,
            action:
              marcommAuditActionLabel(
                log.action
              ),
            status:
              log.newValue,
            description:
              log.fileReference,
            notes:
              log.reason,
          })
        );

      const auditActions =
        new Set(
          auditLogs.map(
            log =>
              log.action
          )
        );

      // Legacy fallback: old UAT records predate the full audit trail.
      if (
        !auditActions.has(
          'CREATE_REQUEST'
        )
      ) {
        entries.push({
          id:
            `${request.id}-LEGACY-SUBMIT`,
          timestamp:
            request.requestedAt,
          actorName:
            request.requesterName,
          actorRole:
            resolveUserPosition(
              request.requesterUserId,
              request.requesterName
            ) ||
            'Marketing',
          action:
            'Request Marcomm Disubmit',
          status:
            'PENDING_ANDI_APPROVAL',
          description:
            `${marcommRequestLabel(
              request
            )} • ${request.clientName}${request.productName ? ` • ${request.productName}` : ''}`,
          notes:
            request.brief,
        });
      }

      if (
        request.andiDecisionAt &&
        ![
          'APPROVE_INITIAL',
          'REJECT_INITIAL',
          'APPROVE_REVISION_REQUEST',
          'REJECT_REVISION_REQUEST',
        ].some(
          action =>
            auditActions.has(
              action
            )
        )
      ) {
        entries.push({
          id:
            `${request.id}-LEGACY-ANDI`,
          timestamp:
            request.andiDecisionAt,
          actorName:
            'Andi Rita Anastasya Baso',
          actorRole:
            'Department Head Marketing Communication',
          action:
            request.andiDecision ===
              'APPROVED'
              ? 'Approval / Review Disetujui'
              : 'Approval / Review Ditolak',
          status:
            request.andiDecision ===
              'APPROVED'
              ? 'APPROVED'
              : 'REJECTED',
          description:
            request.approvedGiftTier
              ? `Final ${request.approvedGiftTier} • Qty ${request.approvedQuantity || 0}`
              : undefined,
          notes:
            request.andiDecisionNotes,
        });
      }

      if (
        request.startedAt &&
        !auditActions.has(
          'START_EXECUTION'
        )
      ) {
        entries.push({
          id:
            `${request.id}-LEGACY-START`,
          timestamp:
            request.startedAt,
          actorName:
            request.assignedToName ||
            'Karina Malik',
          actorRole:
            'Staff Marketing Communication',
          action:
            'Eksekusi Dimulai',
          status:
            'IN_PROGRESS',
        });
      }

      (
        request.deliverables ||
        []
      ).forEach(
        deliverable => {
          const hasSubmitAudit =
            auditLogs.some(
              log =>
                log.action ===
                  'SUBMIT_DELIVERABLE' &&
                (
                  log.fileReference ||
                  ''
                ).includes(
                  `V${deliverable.version}`
                )
            );

          if (
            !hasSubmitAudit
          ) {
            entries.push({
              id:
                `${deliverable.id}-SUBMIT`,
              timestamp:
                deliverable.submittedAt,
              actorName:
                deliverable.submittedByName,
              actorRole:
                resolveUserPosition(
                  deliverable.submittedByUserId,
                  deliverable.submittedByName
                ) ||
                'Staff Marketing Communication',
              action:
                `Hasil / Evidence V${deliverable.version} Disubmit`,
              status:
                'PENDING_ANDI_FINAL_REVIEW',
              description:
                `${deliverable.documents.length} file`,
              notes:
                deliverable.notes,
            });
          }

          if (
            deliverable.approvedAt
          ) {
            const hasFinalAudit =
              auditLogs.some(
                log =>
                  (
                    log.action ===
                      'APPROVE_FINAL_DELIVERABLE' ||
                    log.action ===
                      'REJECT_FINAL_DELIVERABLE'
                  ) &&
                  (
                    log.fileReference ||
                    ''
                  ).includes(
                    `V${deliverable.version}`
                  )
              );

            if (
              !hasFinalAudit
            ) {
              entries.push({
                id:
                  `${deliverable.id}-FINAL`,
                timestamp:
                  deliverable.approvedAt,
                actorName:
                  deliverable.approvedByName ||
                  'Andi Rita Anastasya Baso',
                actorRole:
                  'Department Head Marketing Communication',
                action:
                  deliverable.status ===
                    'PUBLISHED'
                    ? `Final Review V${deliverable.version} Disetujui`
                    : `Final Review V${deliverable.version} Ditolak`,
                status:
                  deliverable.status,
                notes:
                  deliverable.approvalNotes,
              });
            }
          }
        }
      );

      (
        request.revisionHistory ||
        []
      ).forEach(
        revision => {
          const hasAudit =
            auditLogs.some(
              log =>
                log.action ===
                  'REQUEST_REVISION' &&
                (
                  log.fileReference ||
                  ''
                ).includes(
                  `V${revision.targetVersion}`
                )
            );

          if (
            !hasAudit
          ) {
            entries.push({
              id:
                `${revision.id}-REQUEST`,
              timestamp:
                revision.requestedAt,
              actorName:
                revision.requestedByName,
              actorRole:
                resolveUserPosition(
                  revision.requestedByUserId,
                  revision.requestedByName
                ) ||
                'Marketing',
              action:
                `Marketing Meminta Revisi V${revision.targetVersion}`,
              status:
                'REVISION_REQUESTED_PENDING_ANDI',
              description:
                `${revision.attachments.length} lampiran revisi`,
              notes:
                revision.notes,
            });
          }
        }
      );

      if (
        request.completedAt &&
        !auditActions.has(
          'ACCEPT_RESULT_COMPLETE'
        ) &&
        request.completedByName
      ) {
        entries.push({
          id:
            `${request.id}-LEGACY-COMPLETE`,
          timestamp:
            request.completedAt,
          actorName:
            request.completedByName,
          actorRole:
            resolveUserPosition(
              request.completedByUserId,
              request.completedByName
            ),
          action:
            'Request Selesai',
          status:
            'COMPLETED',
          description:
            'Workflow request Marketing Communication telah selesai.',
        });
      }

      return entries;
    };

    const buildServiceDocumentHistory =
      (
        document:
          ManagedServiceDocument
      ):
        ActionHistoryEntry[] => {
      const entries:
        ActionHistoryEntry[] = [
          {
            id:
              `${document.id}-UPLOAD`,
            timestamp:
              document.uploadedAt,
            actorName:
              document.uploadedByName,
            actorRole:
              resolveUserPosition(
                document.uploadedByUserId,
                document.uploadedByName
              ),
            action:
              document.ownerArea ===
                'MARKETING_ADMINISTRATION'
                ? 'Dokumen Administrasi Di-upload'
                : 'Marketing Tool Di-upload',
            status:
              'PENDING_APPROVAL',
            description:
              `${serviceCategoryLabel(
                document.category
              )} • ${document.versionLabel} • ${document.fileName}`,
            notes:
              document.notes,
          },
        ];

      if (
        document.approvedAt
      ) {
        entries.push({
          id:
            `${document.id}-APPROVAL`,
          timestamp:
            document.approvedAt,
          actorName:
            document.approvedByName ||
            (
              document.ownerArea ===
                'MARKETING_ADMINISTRATION'
                ? 'RR Endah Wasis Wuwuh Mumpuni'
                : 'Andi Rita Anastasya Baso'
            ),
          actorRole:
            document.ownerArea ===
              'MARKETING_ADMINISTRATION'
              ? 'Department Head Marketing Administration'
              : 'Department Head Marketing Communication',
          action:
            document.status ===
              'REJECTED'
              ? 'Dokumen Ditolak'
              : 'Dokumen Disetujui & Dipublikasikan',
          status:
            document.status,
          notes:
            document.approvalNotes,
        });
      }

      store
        .getAuditLogs()
        .filter(
          log =>
            log.module ===
              'SERVICE_DOCUMENT' &&
            log.recordId ===
              document.id &&
            log.action ===
              'DEACTIVATE'
        )
        .forEach(
          log =>
            entries.push({
              id:
                log.id,
              timestamp:
                log.timestamp,
              actorName:
                log.userName,
              actorRole:
                resolveUserPosition(
                  log.userId,
                  log.userName
                ) ||
                log.userRole,
              action:
                'Dokumen Dinonaktifkan',
              status:
                'INACTIVE',
              description:
                log.fileReference,
              notes:
                log.reason,
            })
        );

      return entries;
    };

    const renderDocumentCard =
      (
        document:
          ManagedServiceDocument
      ) => (
        <Card
          key={
            document.id
          }
          className="border-gray-200"
        >
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="text-[9px] font-bold"
                  >
                    {serviceCategoryLabel(
                      document.category
                    )}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-[9px] font-bold text-blue-700"
                  >
                    {document.versionLabel}
                  </Badge>

                  {document.status !==
                    'PUBLISHED' && (
                    <Badge
                      variant="outline"
                      className="text-[9px]"
                    >
                      {document.status}
                    </Badge>
                  )}
                </div>

                <h3 className="mt-2 text-sm font-black text-gray-900">
                  {document.title}
                </h3>

                <p className="mt-1 text-[10px] text-gray-500">
                  {document.productName ||
                    'General'}
                  {' • '}
                  {document.fileName}
                  {' • '}
                  {formatFileSize(
                    document.fileSize
                  )}
                </p>

                <p className="mt-1 text-[9px] text-gray-400">
                  Upload {document.uploadedByName} • {formatDateTime(document.uploadedAt)}
                  {document.approvedByName
                    ? ` • Approve ${document.approvedByName}`
                    : ''}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setHistoryServiceDocument(
                      document
                    )
                  }
                  className="h-8 gap-1 text-[10px] font-bold"
                >
                  <History className="h-3.5 w-3.5" />
                  Riwayat
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleDownload(
                      document.id,
                      document.fileName
                    )
                  }
                  className="h-8 gap-1 text-[10px]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>

                {document.status ===
                  'PENDING_APPROVAL' &&
                  (
                    (
                      document.ownerArea ===
                        'MARKETING_ADMINISTRATION' &&
                      isEndah
                    ) ||
                    (
                      document.ownerArea ===
                        'MARKETING_COMMUNICATION' &&
                      isAndi
                    )
                  ) && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setDecisionContext({
                        kind:
                          'SERVICE_DOCUMENT',
                        document,
                      });

                      setDecisionNotes('');
                    }}
                    className="h-8 bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-700"
                  >
                    Review & Approve
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );

    const pageTitle =
      area ===
        'administration'
        ? 'Dokumen Administrasi'
        : area ===
          'marketing-tools'
          ? 'Marketing Tools'
          : 'Permintaan Marcomm';

    const pageDescription =
      area ===
        'administration'
        ? 'Repository SPAJ dan SPAK. Suci/Ayu/Ulfia/Raydinda upload, Endah Wasis final approve, lalu tersedia untuk seluruh Marketing.'
        : area ===
          'marketing-tools'
          ? 'Katalog approved yang bisa langsung di-download: Proposal Produk Standar, Materi Presentasi Produk Standar, dan Brosur Produk Standar.'
          : 'Service desk Marketing Communication. Gunakan tab Layanan Marcomm untuk membuat request Design atau Barang & Jasa, lalu pantau progresnya di Request & Aktivitas.';

    return (
      <AppLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {area ===
                'marcomm-requests' ? (
                  <Megaphone className="h-5 w-5 text-blue-600" />
                ) : (
                  <FileText className="h-5 w-5 text-blue-600" />
                )}

                <h1 className="text-xl font-black text-gray-900">
                  {pageTitle}
                </h1>
              </div>

              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-gray-500">
                {pageDescription}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {area ===
                'administration' &&
                isAdminOperator && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    openUpload(
                      'SPAJ'
                    )
                  }
                  className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload SPAJ / SPAK
                </Button>
              )}

              {area ===
                'marketing-tools' &&
                isKarina && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    openUpload(
                      'PROPOSAL_PENAWARAN_STANDAR'
                    )
                  }
                  className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4" />
                  Upload Marketing Tool
                </Button>
              )}

            </div>
          </div>

          {area ===
            'administration' && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                {ADMIN_CATEGORIES.map(
                  category => {
                    const count =
                      publishedDocs.filter(
                        document =>
                          document.ownerArea ===
                            'MARKETING_ADMINISTRATION' &&
                          document.category ===
                            category.value
                      ).length;

                    return (
                      <Card
                        key={
                          category.value
                        }
                        className="border-blue-100 bg-blue-50/30"
                      >
                        <CardContent className="flex items-center justify-between p-4">
                          <div>
                            <div className="text-sm font-black text-gray-900">
                              {category.label}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-500">
                              {count} dokumen published
                            </div>
                          </div>

                          {isAdminOperator && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                openUpload(
                                  category.value
                                )
                              }
                              className="text-[10px]"
                            >
                              Upload
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }
                )}
              </div>

              {isEndah &&
                pendingAdminDocs.length >
                  0 && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-black text-amber-950">
                      Menunggu Approval Endah Wasis
                    </CardTitle>

                    <CardDescription className="text-xs text-amber-800">
                      {pendingAdminDocs.length} dokumen administrasi perlu direview sebelum dipublikasikan.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {pendingAdminDocs.map(
                      renderDocumentCard
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <Input
                    value={
                      search
                    }
                    onChange={
                      event =>
                        setSearch(
                          event.target.value
                        )
                    }
                    placeholder="Cari judul, produk, file..."
                    className="pl-9 text-xs"
                  />
                </div>

                <Select
                  value={
                    productFilter
                  }
                  onValueChange={
                    setProductFilter
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="z-[120]">
                    <SelectItem value="ALL">
                      Semua Produk
                    </SelectItem>

                    {activeProducts.map(
                      product => (
                        <SelectItem
                          key={
                            product.id
                          }
                          value={
                            product.productName
                          }
                        >
                          {product.productName}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {publishedDocs
                  .filter(
                    document =>
                      document.ownerArea ===
                      'MARKETING_ADMINISTRATION'
                  )
                  .filter(
                    document =>
                      productFilter ===
                        'ALL' ||
                      document.productName ===
                        productFilter
                  )
                  .filter(
                    document =>
                      [
                        document.title,
                        document.productName,
                        document.fileName,
                        serviceCategoryLabel(
                          document.category
                        ),
                      ]
                        .join(
                          ' '
                        )
                        .toLowerCase()
                        .includes(
                          search
                            .trim()
                            .toLowerCase()
                        )
                  )
                  .map(
                    renderDocumentCard
                  )}
              </div>
            </>
          )}

          {area ===
            'marketing-tools' && (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                {MARKETING_TOOL_CATEGORIES.map(
                  category => (
                    <button
                      key={
                        category.value
                      }
                      type="button"
                      onClick={() =>
                        setToolCategoryFilter(
                          toolCategoryFilter ===
                            category.value
                            ? 'ALL'
                            : category.value
                        )
                      }
                      className={`rounded-xl border p-4 text-left transition ${
                        toolCategoryFilter ===
                        category.value
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="text-xs font-black text-gray-900">
                        {category.label}
                      </div>

                      <div className="mt-1 text-[10px] text-gray-500">
                        {
                          publishedDocs.filter(
                            document =>
                              document.ownerArea ===
                                'MARKETING_COMMUNICATION' &&
                              document.category ===
                                category.value
                          ).length
                        }{' '}
                        published
                      </div>
                    </button>
                  )
                )}
              </div>

              {isAndi &&
                pendingMarcommDocs.length >
                  0 && (
                <Card className="border-amber-300 bg-amber-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-black text-amber-950">
                      Menunggu Approval Department Head Marketing Communication
                    </CardTitle>

                    <CardDescription className="text-xs text-amber-800">
                      Dokumen yang di-upload Karina belum tersedia ke Marketing sampai Department Head Marketing Communication approve.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {pendingMarcommDocs
                      .filter(
                        document =>
                          !focusDocumentId ||
                          document.id ===
                            focusDocumentId
                      )
                      .map(
                        renderDocumentCard
                      )}
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <Input
                    value={
                      search
                    }
                    onChange={
                      event =>
                        setSearch(
                          event.target.value
                        )
                    }
                    placeholder="Cari marketing tool..."
                    className="pl-9 text-xs"
                  />
                </div>

                <Select
                  value={
                    productFilter
                  }
                  onValueChange={
                    setProductFilter
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent className="z-[120]">
                    <SelectItem value="ALL">
                      Semua Produk
                    </SelectItem>

                    {activeProducts.map(
                      product => (
                        <SelectItem
                          key={
                            product.id
                          }
                          value={
                            product.productName
                          }
                        >
                          {product.productName}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                {publishedDocs
                  .filter(
                    document =>
                      document.ownerArea ===
                        'MARKETING_COMMUNICATION' &&
                      standardMarketingToolCategorySet.has(
                        document.category as
                          MarketingToolCategory
                      )
                  )
                  .filter(
                    document =>
                      toolCategoryFilter ===
                        'ALL' ||
                      document.category ===
                        toolCategoryFilter
                  )
                  .filter(
                    document =>
                      productFilter ===
                        'ALL' ||
                      document.productName ===
                        productFilter
                  )
                  .filter(
                    document =>
                      [
                        document.title,
                        document.productName,
                        document.fileName,
                        serviceCategoryLabel(
                          document.category
                        ),
                      ]
                        .join(
                          ' '
                        )
                        .toLowerCase()
                        .includes(
                          search
                            .trim()
                            .toLowerCase()
                        )
                  )
                  .map(
                    document => (
                      <div
                        key={
                          document.id
                        }
                        className="relative"
                      >
                        {renderDocumentCard(
                          document
                        )}


                      </div>
                    )
                  )}
              </div>
            </>
          )}

          {area ===
            'marcomm-requests' && (
            <>

              <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-gray-50/95 px-1 pb-2 pt-1 backdrop-blur">
                <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                  {!isAndi &&
                    !isKarina && (
                    <button
                      type="button"
                      onClick={() =>
                        setMarcommViewTab(
                          'SERVICES'
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${
                        marcommViewTab ===
                        'SERVICES'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      Layanan Marcomm
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setMarcommViewTab(
                        'REQUESTS'
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${
                      marcommViewTab ===
                      'REQUESTS'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Request & Aktivitas
                    {visibleRequests.length >
                      0 && (
                      <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[8px] ${
                        marcommViewTab ===
                        'REQUESTS'
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {visibleRequests.length}
                      </span>
                    )}
                  </button>

                  {canManageMarcommStock && (
                    <button
                      type="button"
                      onClick={() =>
                        setMarcommViewTab(
                          'STOCK'
                        )
                      }
                      className={`rounded-lg px-4 py-2 text-[10px] font-black transition ${
                        marcommViewTab ===
                        'STOCK'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      Stock Souvenir
                      {pendingStockOpnames.length >
                        0 && (
                        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[8px] ${
                          marcommViewTab ===
                          'STOCK'
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {pendingStockOpnames.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
              {marcommViewTab ===
                'SERVICES' &&
                !isAndi &&
                !isKarina && (
                <Card className="overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="max-w-2xl">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-blue-600">
                          Marketing Communication Service Desk
                        </div>

                        <h2 className="mt-1 text-lg font-black text-gray-950">
                          Ajukan Permintaan Marcomm
                        </h2>

                        <p className="mt-2 text-xs leading-relaxed text-gray-600">
                          Pilih Permintaan Design atau Permintaan Barang & Jasa. Setiap request akan direview Department Head Marketing Communication sebelum dieksekusi oleh Karina.
                        </p>
                      </div>

                      {isMarketing && (
                        <Button
                          type="button"
                          onClick={
                            openRequest
                          }
                          className="shrink-0 gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          <FilePlus2 className="h-4 w-4" />
                          Buat Permintaan
                        </Button>
                      )}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-blue-100 bg-white p-4">
                        <div className="text-xs font-black text-gray-900">
                          Permintaan Design
                        </div>

                        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                          Broadcast, Flyer, Proposal Penawaran, Materi Presentasi, Materi Sosialisasi, dan Brosur.
                        </p>
                      </div>

                      <div className="rounded-xl border border-indigo-100 bg-white p-4">
                        <div className="text-xs font-black text-gray-900">
                          Permintaan Barang & Jasa
                        </div>

                        <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                          Souvenir, Hampers Hari Raya, Open Booth, Karangan Bunga dan Ucapan, serta Literasi Keuangan.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canManageMarcommStock &&
                marcommViewTab ===
                  'STOCK' && (
                <Card
                  id="stock-control"
                  className="scroll-mt-24 border-indigo-200 bg-indigo-50/30"
                >
                  <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-black text-indigo-950">
                          <Boxes className="h-4 w-4" />
                          Stock Souvenir
                        </CardTitle>

                        <CardDescription className="mt-1 max-w-3xl text-xs text-indigo-800">
                          On Hand = stock fisik Souvenir di sistem. Reserved = request Souvenir yang sudah disetujui dan belum selesai. Available = On Hand - Reserved. Hampers Hari Raya tidak menggunakan stock opname.
                        </CardDescription>
                      </div>

                      {isKarina && (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setStockInCategory(
                                'SOUVENIR'
                              );
                              setStockInTier(
                                'REGULER'
                              );
                              setStockInQuantity('');
                              setStockInNotes('');
                              setStockInFile(
                                null
                              );
                              setStockInOpen(
                                true
                              );
                            }}
                            className="h-8 gap-1 border-indigo-300 bg-white text-[10px] font-bold text-indigo-800"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Stock Masuk Souvenir
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setStockOpnameCategory(
                                'SOUVENIR'
                              );
                              setStockOpnameTier(
                                'REGULER'
                              );
                              setStockPhysicalQuantity('');
                              setStockOpnameNotes('');
                              setStockOpnameFile(
                                null
                              );
                              setStockOpnameOpen(
                                true
                              );
                            }}
                            className="h-8 gap-1 bg-indigo-600 text-[10px] font-bold text-white hover:bg-indigo-700"
                          >
                            <ClipboardCheck className="h-3.5 w-3.5" />
                            Stock Opname Souvenir
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {MARCOMM_STOCK_POOLS.map(
                        pool => {
                          const snapshot =
                            getStockSnapshot(
                              pool.stockCategory,
                              pool.giftTier
                            );

                          return (
                            <div
                              key={`${pool.stockCategory}-${pool.giftTier}`}
                              className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-wide text-indigo-700">
                                    {pool.label}
                                  </div>

                                  <div className={`mt-2 text-2xl font-black ${
                                    snapshot.available ===
                                    0
                                      ? 'text-rose-700'
                                      : snapshot.available <=
                                        10
                                        ? 'text-amber-700'
                                        : 'text-gray-950'
                                  }`}>
                                    {snapshot.available}
                                  </div>

                                  <div className="text-[9px] text-gray-500">
                                    Available
                                  </div>
                                </div>

                                <Badge
                                  variant="outline"
                                  className={
                                    snapshot.available ===
                                    0
                                      ? 'border-rose-200 bg-rose-50 text-[9px] font-bold text-rose-700'
                                      : snapshot.available <=
                                        10
                                        ? 'border-amber-200 bg-amber-50 text-[9px] font-bold text-amber-700'
                                        : 'border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700'
                                  }
                                >
                                  {snapshot.available ===
                                  0
                                    ? 'Habis'
                                    : snapshot.available <=
                                      10
                                      ? 'Low Stock'
                                      : 'Aman'}
                                </Badge>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 text-[9px] text-gray-600">
                                <div>
                                  On Hand
                                  <div className="font-black text-gray-900">
                                    {snapshot.onHand}
                                  </div>
                                </div>

                                <div>
                                  Reserved
                                  <div className="font-black text-gray-900">
                                    {snapshot.reserved}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-2 text-[8px] text-gray-400">
                                Last Opname: {snapshot.lastOpnameAt ? formatDateTime(snapshot.lastOpnameAt) : 'Belum ada'}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-black text-gray-900">
                            Stock Opname Souvenir
                          </div>

                          <Badge variant="outline" className="text-[9px]">
                            {
                              stockOpnames.filter(
                                opname =>
                                  opname.status ===
                                  'PENDING_ANDI_APPROVAL'
                              ).length
                            } pending
                          </Badge>
                        </div>

                        <div className="mt-3 space-y-2">
                          {stockOpnames.length ===
                          0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-[10px] text-gray-400">
                              Belum ada stock opname.
                            </div>
                          ) : (
                            stockOpnames
                              .filter(
                                opname => {
                                  if (
                                    focusOpnameId
                                  ) {
                                    return (
                                      opname.id ===
                                      focusOpnameId
                                    );
                                  }

                                  if (
                                    dashboardFilter ===
                                    'ANDI_OPNAME'
                                  ) {
                                    return (
                                      opname.status ===
                                      'PENDING_ANDI_APPROVAL'
                                    );
                                  }

                                  return true;
                                }
                              )
                              .slice(
                                0,
                                8
                              ).map(
                              opname => (
                                <div
                                  key={
                                    opname.id
                                  }
                                  className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <div className="text-[10px] font-black text-gray-900">
                                        {stockCategoryLabel(opname.stockCategory)} {opname.giftTier}
                                      </div>

                                      <div className="mt-0.5 text-[9px] text-gray-500">
                                        Sistem {opname.systemOnHandAtSubmission} → Fisik {opname.physicalQuantity} • Selisih {opname.differenceAtSubmission >= 0 ? '+' : ''}{opname.differenceAtSubmission}
                                      </div>
                                    </div>

                                    <Badge
                                      variant="outline"
                                      className={
                                        opname.status ===
                                        'PENDING_ANDI_APPROVAL'
                                          ? 'border-amber-200 bg-amber-50 text-[8px] font-bold text-amber-700'
                                          : opname.status ===
                                            'APPROVED'
                                            ? 'border-emerald-200 bg-emerald-50 text-[8px] font-bold text-emerald-700'
                                            : 'border-rose-200 bg-rose-50 text-[8px] font-bold text-rose-700'
                                      }
                                    >
                                      {opname.status}
                                    </Badge>
                                  </div>

                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {opname.attachment && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          void handleDownload(
                                            opname.attachment!.id,
                                            opname.attachment!.fileName
                                          )
                                        }
                                        className="h-6 text-[8px]"
                                      >
                                        <Download className="mr-1 h-3 w-3" />
                                        Bukti
                                      </Button>
                                    )}

                                    {isAndi &&
                                      opname.status ===
                                        'PENDING_ANDI_APPROVAL' && (
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          setStockOpnameDecision(
                                            opname
                                          );
                                          setStockOpnameDecisionNotes('');
                                        }}
                                        className="h-6 bg-indigo-600 text-[8px] font-bold text-white hover:bg-indigo-700"
                                      >
                                        Review Adjustment
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="text-xs font-black text-gray-900">
                          Mutasi Stock Terbaru
                        </div>

                        <div className="mt-3 space-y-2">
                          {stockTransactions.length ===
                          0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-[10px] text-gray-400">
                              Belum ada mutasi stock. Karina dapat input Stock Masuk Souvenir sebagai saldo awal UAT.
                            </div>
                          ) : (
                            stockTransactions.slice(
                              0,
                              10
                            ).map(
                              transaction => (
                                <div
                                  key={
                                    transaction.id
                                  }
                                  className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
                                >
                                  <div>
                                    <div className="text-[10px] font-black text-gray-900">
                                      {stockCategoryLabel(transaction.stockCategory)} {transaction.giftTier}
                                    </div>

                                    <div className="mt-0.5 text-[9px] text-gray-500">
                                      {transaction.transactionType.replace(/_/g, ' ')}
                                      {transaction.requestId
                                        ? ` • ${transaction.requestId}`
                                        : ''}
                                      {' • '}
                                      {formatDateTime(transaction.createdAt)}
                                    </div>

                                    {transaction.notes && (
                                      <div className="mt-1 text-[8px] text-gray-400">
                                        {transaction.notes}
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    className={`shrink-0 text-sm font-black ${
                                      transaction.transactionType ===
                                      'STOCK_OUT' ||
                                      (
                                        transaction.transactionType ===
                                          'ADJUSTMENT' &&
                                        transaction.quantity <
                                          0
                                      )
                                        ? 'text-rose-700'
                                        : 'text-emerald-700'
                                    }`}
                                  >
                                    {transaction.transactionType ===
                                      'STOCK_OUT'
                                      ? '-'
                                      : transaction.quantity >=
                                        0
                                        ? '+'
                                        : ''}
                                    {Math.abs(transaction.quantity)}
                                  </div>
                                </div>
                              )
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {marcommViewTab ===
                'REQUESTS' && (
                <Card id="activity-request" className="scroll-mt-24 border-gray-200">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-sm font-black">
                        Aktivitas Request
                      </CardTitle>

                      <CardDescription className="text-xs">
                        Marketing hanya melihat request milik sendiri/tim satu garis organisasi. Marcomm dapat melihat seluruh antrean.
                      </CardDescription>
                    </div>

                    <Badge
                      variant="outline"
                      className="w-fit"
                    >
                      {dashboardFilteredRequests.length} request
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {dashboardFilterLabel && (
                    <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-[10px] font-bold text-blue-800">
                        Filter dari Dashboard: {dashboardFilterLabel}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const next =
                            new URLSearchParams(
                              searchParams
                            );

                          next.delete(
                            'filter'
                          );
                          next.delete(
                            'requestId'
                          );
                          next.delete(
                            'opnameId'
                          );

                          setSearchParams(
                            next
                          );
                        }}
                        className="h-7 w-fit border-blue-300 bg-white text-[9px] font-bold text-blue-700"
                      >
                        Tampilkan Semua
                      </Button>
                    </div>
                  )}

                  
                  {dashboardFilteredRequests.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center text-xs text-gray-500">
                      Belum ada request yang dapat dilihat pada scope akun ini.
                    </div>
                  ) : (
                    dashboardFilteredRequests.map(
                      request => {
                        const days =
                          requestDaysRemaining(
                            request
                          );

                        const latestDeliverable =
                          request.deliverables[
                            request.deliverables.length -
                              1
                          ];

                        return (
                          <div
                            key={
                              request.id
                            }
                            className={`rounded-xl border bg-white p-4 transition ${
                              focusRequestId ===
                              request.id
                                ? 'border-blue-500 ring-2 ring-blue-100'
                                : 'border-gray-200'
                            }`}
                          >
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="font-mono text-[9px]"
                                  >
                                    {request.id}
                                  </Badge>

                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-bold"
                                  >
                                    {marcommRequestLabel(
                                      request
                                    )}
                                  </Badge>

                                  <Badge
                                    variant="outline"
                                    className={
                                      request.status ===
                                      'COMPLETED'
                                        ? 'border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-700'
                                        : 'border-blue-200 bg-blue-50 text-[9px] font-bold text-blue-700'
                                    }
                                  >
                                    {statusLabel(
                                      request.status
                                    )}
                                  </Badge>

                                  <SlaBadge
                                    startedAt={
                                      getMarcommSlaStartedAt(
                                        request
                                      )
                                    }
                                    compact
                                  />

                                  <Badge
                                    variant="outline"
                                    className={
                                      days <
                                      0
                                        ? 'border-rose-300 bg-rose-50 text-[9px] font-bold text-rose-700'
                                        : days <=
                                          3
                                          ? 'border-amber-300 bg-amber-50 text-[9px] font-bold text-amber-700'
                                          : 'border-gray-200 bg-gray-50 text-[9px] text-gray-600'
                                    }
                                  >
                                    {days <
                                    0
                                      ? `Overdue ${Math.abs(days)} hari`
                                      : days ===
                                        0
                                        ? 'Due hari ini'
                                        : `H-${days}`}
                                  </Badge>
                                </div>

                                <h3 className="mt-2 text-sm font-black text-gray-900">
                                  {request.clientName}
                                  {request.productName
                                    ? ` • ${request.productName}`
                                    : ''}
                                </h3>

                                <p className="mt-1 text-[10px] text-gray-500">
                                  Requester: {request.requesterName} • Need Date: {request.needDate}
                                  {request.policyNumber
                                    ? ` • Polis: ${request.policyNumber}`
                                    : ''}
                                </p>

                                <p className="mt-2 max-w-4xl text-[11px] leading-relaxed text-gray-700">
                                  {request.brief}
                                </p>

                                {request.requestGroup ===
                                  'DESIGN' && (
                                  <div className="mt-2 text-[10px] font-semibold text-blue-700">
                                    Design: {designRequestLabel(request.designType)}
                                  </div>
                                )}

                                {request.requestType ===
                                  'KARANGAN_BUNGA_UCAPAN' && (
                                  <div className="mt-2 rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-2 text-[10px] text-fuchsia-800">
                                    <b>{flowerOptionLabel(request.flowerOption)}</b>
                                    {request.greetingText
                                      ? ` • Tulisan: ${request.greetingText}`
                                      : ''}
                                  </div>
                                )}

                                {request.participantEstimate !==
                                  undefined && (
                                  <div className="mt-2 text-[10px] text-gray-500">
                                    Estimasi peserta: <b>{request.participantEstimate}</b>
                                  </div>
                                )}

                                {(request.location ||
                                  request.quantity ||
                                  request.estimatedBudget) && (
                                  <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-gray-500">
                                    {request.location && (
                                      <span>
                                        Lokasi: {request.location}
                                      </span>
                                    )}

                                    {request.quantity && (
                                      <span>
                                        Qty Request: {request.quantity}
                                      </span>
                                    )}

                                    {request.giftTier && (
                                      <span>
                                        Jenis Request: {request.giftTier}
                                      </span>
                                    )}

                                    {request.approvedQuantity && (
                                      <span className="font-bold text-indigo-700">
                                        Qty Final Andi: {request.approvedQuantity}
                                      </span>
                                    )}

                                    {request.approvedGiftTier && (
                                      <span className="font-bold text-indigo-700">
                                        Jenis Final Andi: {request.approvedGiftTier}
                                      </span>
                                    )}

                                    {request.estimatedBudget !==
                                      undefined && (
                                      <span>
                                        Est. Budget: {formatRupiah(request.estimatedBudget)}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {request.requestAttachments.length >
                                  0 && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {request.requestAttachments.map(
                                      document => (
                                        <Button
                                          key={
                                            document.id
                                          }
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() =>
                                            void handleDownload(
                                              document.id,
                                              document.fileName
                                            )
                                          }
                                          className="h-7 text-[9px]"
                                        >
                                          <Download className="mr-1 h-3 w-3" />
                                          {document.fileName}
                                        </Button>
                                      )
                                    )}
                                  </div>
                                )}

                                {latestDeliverable &&
                                  latestDeliverable.status ===
                                    'PUBLISHED' && (
                                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                    <div className="text-[9px] font-black uppercase text-emerald-700">
                                      Hasil V{latestDeliverable.version}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {latestDeliverable.documents.map(
                                        document => (
                                          <Button
                                            key={
                                              document.id
                                            }
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              void handleDownload(
                                                document.id,
                                                document.fileName
                                              )
                                            }
                                            className="h-7 border-emerald-300 bg-white text-[9px] text-emerald-800"
                                          >
                                            <Download className="mr-1 h-3 w-3" />
                                            {document.fileName}
                                          </Button>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex shrink-0 flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setHistoryMarcommRequest(
                                      request
                                    )
                                  }
                                  className="h-8 gap-1 text-[10px] font-bold"
                                >
                                  <History className="h-3.5 w-3.5" />
                                  Riwayat
                                </Button>

                                {isAndi &&
                                  (
                                    request.status ===
                                      'PENDING_ANDI_APPROVAL' ||
                                    request.status ===
                                      'REVISION_REQUESTED_PENDING_ANDI'
                                  ) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setDecisionContext({
                                        kind:
                                          'MARCOMM_INITIAL',
                                        request,
                                      });

                                      setDecisionNotes('');

                                      setAndiFinalQuantity(
                                        String(
                                          request.approvedQuantity ??
                                          request.quantity ??
                                          ''
                                        )
                                      );

                                      setAndiFinalGiftTier(
                                        request.approvedGiftTier ||
                                        request.giftTier ||
                                        'REGULER'
                                      );
                                    }}
                                    className="h-8 bg-indigo-600 text-[10px] font-bold text-white hover:bg-indigo-700"
                                  >
                                    Review Awal
                                  </Button>
                                )}

                                {isKarina &&
                                  request.status ===
                                    'APPROVED_WAITING_KARINA' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      handleStartRequest(
                                        request
                                      )
                                    }
                                    className="h-8 bg-blue-600 text-[10px] font-bold text-white hover:bg-blue-700"
                                  >
                                    Mulai Kerjakan
                                  </Button>
                                )}

                                {isKarina &&
                                  (
                                    request.status ===
                                      'IN_PROGRESS' ||
                                    request.status ===
                                      'APPROVED_WAITING_KARINA'
                                  ) && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setExecutionRequest(
                                        request
                                      );

                                      setExecutionFiles([]);
                                      setExecutionNotes('');
                                    }}
                                    className="h-8 text-[10px] font-bold"
                                  >
                                    Upload Hasil / Evidence
                                  </Button>
                                )}

                                {isAndi &&
                                  request.status ===
                                    'PENDING_ANDI_FINAL_REVIEW' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                      setDecisionContext({
                                        kind:
                                          'MARCOMM_FINAL',
                                        request,
                                      });

                                      setDecisionNotes('');
                                    }}
                                    className="h-8 bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-700"
                                  >
                                    Review Final
                                  </Button>
                                )}

                                {request.requesterUserId ===
                                  currentUser.id &&
                                  request.status ===
                                    'PUBLISHED_WAITING_MARKETING' && (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setRevisionRequest(
                                          request
                                        );

                                        setRevisionNotes('');
                                        setRevisionFiles([]);
                                      }}
                                      className="h-8 border-amber-300 text-[10px] font-bold text-amber-800"
                                    >
                                      Minta Revisi
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() => {
                                        if (
                                          window.confirm(
                                            `Terima hasil ${request.id} dan tandai selesai?`
                                          )
                                        ) {
                                          try {
                                            store.acceptMarcommResultByMarketing(
                                              request.id
                                            );
                                          } catch (
                                            error
                                          ) {
                                            alert(
                                              error instanceof
                                                Error
                                                ? error.message
                                                : 'Gagal menyelesaikan request.'
                                            );
                                          }
                                        }
                                      }}
                                      className="h-8 bg-emerald-700 text-[10px] font-bold text-white hover:bg-emerald-800"
                                    >
                                      Terima & Selesai
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )
                  )}
                </CardContent>
              </Card>
              )}
            </>
          )}

          <ActionHistoryModal
            open={
              Boolean(
                historyMarcommRequest
              )
            }
            onClose={() =>
              setHistoryMarcommRequest(
                null
              )
            }
            title={
              historyMarcommRequest
                ? `Riwayat Aksi • ${historyMarcommRequest.id}`
                : 'Riwayat Aksi Marcomm'
            }
            subtitle={
              historyMarcommRequest
                ? `${marcommRequestLabel(historyMarcommRequest)} • ${historyMarcommRequest.clientName}`
                : undefined
            }
            entries={
              historyMarcommRequest
                ? buildMarcommRequestHistory(
                    historyMarcommRequest
                  )
                : []
            }
          />

          <ActionHistoryModal
            open={
              Boolean(
                historyServiceDocument
              )
            }
            onClose={() =>
              setHistoryServiceDocument(
                null
              )
            }
            title={
              historyServiceDocument
                ? `Riwayat Aksi • ${historyServiceDocument.title}`
                : 'Riwayat Aksi Dokumen'
            }
            subtitle={
              historyServiceDocument
                ? `${serviceCategoryLabel(historyServiceDocument.category)} • ${historyServiceDocument.versionLabel}`
                : undefined
            }
            entries={
              historyServiceDocument
                ? buildServiceDocumentHistory(
                    historyServiceDocument
                  )
                : []
            }
          />

          {/* ====================================================
              UPLOAD SERVICE DOCUMENT MODAL
          ==================================================== */}
          {uploadOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setUploadOpen(
                  false
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Upload {area === 'administration' ? 'Dokumen Administrasi' : 'Marketing Tool'}
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      {area ===
                      'administration'
                        ? 'Setelah upload, Endah Wasis harus approve sebelum published.'
                        : 'Setelah upload, Department Head Marketing Communication harus approve sebelum published.'}
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setUploadOpen(
                        false
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Kategori *
                    </label>

                    <Select
                      value={
                        uploadCategory
                      }
                      onValueChange={
                        value =>
                          setUploadCategory(
                            value as
                              ServiceDocumentCategory
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[140]"
                      >
                        {(area ===
                        'administration'
                          ? ADMIN_CATEGORIES
                          : MARKETING_TOOL_CATEGORIES
                        ).map(
                          category => (
                            <SelectItem
                              key={
                                category.value
                              }
                              value={
                                category.value
                              }
                            >
                              {category.label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Produk *
                    </label>

                    <Select
                      value={
                        uploadProduct
                      }
                      onValueChange={
                        setUploadProduct
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Pilih produk..." />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[140] max-h-72"
                      >
                        {activeProducts.map(
                          product => (
                            <SelectItem
                              key={
                                product.id
                              }
                              value={
                                product.productName
                              }
                            >
                              {product.productName}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Judul Dokumen *
                    </label>

                    <Input
                      value={
                        uploadTitle
                      }
                      onChange={
                        event =>
                          setUploadTitle(
                            event.target.value
                          )
                      }
                      placeholder="Contoh: SPAJ Group Term Life 2026"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      File *
                    </label>

                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                      onChange={
                        event =>
                          setUploadFile(
                            event.target.files?.[0] ||
                            null
                          )
                      }
                      className="text-xs"
                    />

                    {uploadFile && (
                      <p className="mt-1 text-[10px] text-gray-500">
                        {uploadFile.name} • {formatFileSize(uploadFile.size)}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan
                    </label>

                    <Textarea
                      value={
                        uploadNotes
                      }
                      onChange={
                        event =>
                          setUploadNotes(
                            event.target.value
                          )
                      }
                      placeholder="Opsional"
                      className="min-h-24 text-xs"
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setUploadOpen(
                        false
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      uploadBusy ||
                      !uploadProduct ||
                      !uploadTitle.trim() ||
                      !uploadFile
                    }
                    onClick={() =>
                      void handleUploadServiceDocument()
                    }
                    className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    {uploadBusy
                      ? 'Menyimpan...'
                      : 'Upload untuk Approval'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              MARCOMM STOCK IN MODAL
          ==================================================== */}
          {stockInOpen && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setStockInOpen(
                  false
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Catat Stock Masuk Souvenir
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Digunakan juga untuk input saldo awal UAT. Stock langsung menambah On Hand.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStockInOpen(
                        false
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Jenis Stock *
                    </label>

                    <Select
                      value={
                        stockInCategory
                      }
                      onValueChange={
                        value =>
                          setStockInCategory(
                            value as
                              MarcommStockCategory
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[150]"
                      >
                        <SelectItem value="SOUVENIR">
                          Souvenir
                        </SelectItem>

                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Tier *
                    </label>

                    <Select
                      value={
                        stockInTier
                      }
                      onValueChange={
                        value =>
                          setStockInTier(
                            value as
                              MarcommStockTier
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[150]"
                      >
                        <SelectItem value="VIP">
                          VIP
                        </SelectItem>

                        <SelectItem value="REGULER">
                          Reguler
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Qty Masuk *
                    </label>

                    <Input
                      type="number"
                      min="1"
                      value={
                        stockInQuantity
                      }
                      onChange={
                        event =>
                          setStockInQuantity(
                            event.target.value
                          )
                      }
                      className="text-xs"
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[9px] font-black uppercase text-gray-500">
                      Stock Sebelum Input
                    </div>

                    <div className="mt-1 text-xl font-black text-gray-900">
                      {
                        getStockSnapshot(
                          stockInCategory,
                          stockInTier
                        ).onHand
                      }
                    </div>

                    <div className="text-[9px] text-gray-500">
                      On Hand
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan
                    </label>

                    <Textarea
                      value={
                        stockInNotes
                      }
                      onChange={
                        event =>
                          setStockInNotes(
                            event.target.value
                          )
                      }
                      placeholder="Contoh: Pengadaan souvenir Agustus 2026 / saldo awal UAT"
                      className="min-h-20 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Bukti / Dokumen
                    </label>

                    <Input
                      type="file"
                      onChange={
                        event =>
                          setStockInFile(
                            event.target.files?.[0] ||
                            null
                          )
                      }
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStockInOpen(
                        false
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !stockInQuantity ||
                      Number(
                        stockInQuantity
                      ) <=
                        0
                    }
                    onClick={() =>
                      void handleStockIn()
                    }
                    className="bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Catat Stock Masuk Souvenir
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              MARCOMM STOCK OPNAME MODAL
          ==================================================== */}
          {stockOpnameOpen && (
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setStockOpnameOpen(
                  false
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Stock Opname Souvenir
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Karina input stock fisik. Selisih baru mengubah saldo sistem setelah approval Department Head Marketing Communication.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStockOpnameOpen(
                        false
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Jenis Stock *
                    </label>

                    <Select
                      value={
                        stockOpnameCategory
                      }
                      onValueChange={
                        value =>
                          setStockOpnameCategory(
                            value as
                              MarcommStockCategory
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[150]"
                      >
                        <SelectItem value="SOUVENIR">
                          Souvenir
                        </SelectItem>

                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Tier *
                    </label>

                    <Select
                      value={
                        stockOpnameTier
                      }
                      onValueChange={
                        value =>
                          setStockOpnameTier(
                            value as
                              MarcommStockTier
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[150]"
                      >
                        <SelectItem value="VIP">
                          VIP
                        </SelectItem>

                        <SelectItem value="REGULER">
                          Reguler
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[9px] font-black uppercase text-gray-500">
                      Stock Sistem
                    </div>

                    <div className="mt-1 text-xl font-black text-gray-900">
                      {
                        getStockSnapshot(
                          stockOpnameCategory,
                          stockOpnameTier
                        ).onHand
                      }
                    </div>

                    <div className="text-[9px] text-gray-500">
                      On Hand sebelum opname
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Stock Fisik *
                    </label>

                    <Input
                      type="number"
                      min="0"
                      value={
                        stockPhysicalQuantity
                      }
                      onChange={
                        event =>
                          setStockPhysicalQuantity(
                            event.target.value
                          )
                      }
                      className="text-xs"
                    />

                    {stockPhysicalQuantity !==
                      '' && (
                      <div className="mt-2 text-[10px] font-bold text-gray-600">
                        Selisih: {
                          Number(
                            stockPhysicalQuantity
                          ) -
                          getStockSnapshot(
                            stockOpnameCategory,
                            stockOpnameTier
                          ).onHand >=
                          0
                            ? '+'
                            : ''
                        }{
                          Number(
                            stockPhysicalQuantity
                          ) -
                          getStockSnapshot(
                            stockOpnameCategory,
                            stockOpnameTier
                          ).onHand
                        }
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan Opname
                    </label>

                    <Textarea
                      value={
                        stockOpnameNotes
                      }
                      onChange={
                        event =>
                          setStockOpnameNotes(
                            event.target.value
                          )
                      }
                      placeholder="Tanggal/lokasi opname atau penjelasan selisih..."
                      className="min-h-20 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Bukti Opname
                    </label>

                    <Input
                      type="file"
                      onChange={
                        event =>
                          setStockOpnameFile(
                            event.target.files?.[0] ||
                            null
                          )
                      }
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setStockOpnameOpen(
                        false
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      stockPhysicalQuantity ===
                      ''
                    }
                    onClick={() =>
                      void handleSubmitStockOpname()
                    }
                    className="bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Submit Opname ke Andi
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              MARCOMM STOCK OPNAME APPROVAL MODAL
          ==================================================== */}
          {stockOpnameDecision && (
            <div
              className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setStockOpnameDecision(
                  null
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Review Stock Opname Souvenir
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Approval akan membuat adjustment supaya On Hand sama dengan stock fisik terbaru.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStockOpnameDecision(
                        null
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 p-5">
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                    <div className="text-xs font-black text-indigo-950">
                      {stockCategoryLabel(stockOpnameDecision.stockCategory)} {stockOpnameDecision.giftTier}
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[8px] font-bold uppercase text-gray-500">
                          Sistem Saat Submit
                        </div>

                        <div className="mt-1 text-xl font-black text-gray-900">
                          {stockOpnameDecision.systemOnHandAtSubmission}
                        </div>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[8px] font-bold uppercase text-gray-500">
                          Sistem Sekarang
                        </div>

                        <div className="mt-1 text-xl font-black text-gray-900">
                          {
                            getStockSnapshot(
                              stockOpnameDecision.stockCategory,
                              stockOpnameDecision.giftTier
                            ).onHand
                          }
                        </div>
                      </div>

                      <div className="rounded-lg bg-white p-3">
                        <div className="text-[8px] font-bold uppercase text-gray-500">
                          Fisik
                        </div>

                        <div className="mt-1 text-xl font-black text-indigo-700">
                          {stockOpnameDecision.physicalQuantity}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-indigo-100 bg-white p-3 text-[10px] text-gray-700">
                      Adjustment saat approve: <b>{
                        stockOpnameDecision.physicalQuantity -
                        getStockSnapshot(
                          stockOpnameDecision.stockCategory,
                          stockOpnameDecision.giftTier
                        ).onHand >=
                        0
                          ? '+'
                          : ''
                      }{
                        stockOpnameDecision.physicalQuantity -
                        getStockSnapshot(
                          stockOpnameDecision.stockCategory,
                          stockOpnameDecision.giftTier
                        ).onHand
                      }</b>
                    </div>
                  </div>

                  {stockOpnameDecision.attachment && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void handleDownload(
                          stockOpnameDecision.attachment!.id,
                          stockOpnameDecision.attachment!.fileName
                        )
                      }
                      className="gap-2 text-xs"
                    >
                      <Download className="h-4 w-4" />
                      Download Bukti Opname
                    </Button>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan Keputusan
                    </label>

                    <Textarea
                      value={
                        stockOpnameDecisionNotes
                      }
                      onChange={
                        event =>
                          setStockOpnameDecisionNotes(
                            event.target.value
                          )
                      }
                      placeholder="Opsional"
                      className="min-h-20 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleDecideStockOpname(
                        false
                      )
                    }
                    className="border-rose-300 text-xs font-bold text-rose-700"
                  >
                    Reject
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleDecideStockOpname(
                        true
                      )
                    }
                    className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Approve Adjustment
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              CREATE MARCOMM REQUEST MODAL
          ==================================================== */}
          {requestOpen && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setRequestOpen(
                  false
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Ajukan Permintaan Marcomm
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Marketing Submit → Approval Department Head Marketing Communication → Karina Execute → Final Review Department Head Marketing Communication.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setRequestOpen(
                        false
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Jenis Permintaan *
                    </label>

                    <Select
                      value={
                        requestGroup
                      }
                      onValueChange={
                        value => {
                          const next =
                            value as
                              MarcommRequestGroup;

                          setRequestGroup(
                            next
                          );

                          if (
                            next ===
                            'DESIGN'
                          ) {
                            applyDesignRequestType(
                              'BROADCAST'
                            );
                          } else {
                            setRequestType(
                              'SOUVENIR'
                            );
                            setGiftTier(
                              'REGULER'
                            );
                          }
                        }
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[140]"
                      >
                        <SelectItem value="DESIGN">
                          Permintaan Design
                        </SelectItem>

                        <SelectItem value="GOODS_SERVICES">
                          Permintaan Barang & Jasa
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {requestGroup ===
                  'DESIGN' ? (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        Jenis Design *
                      </label>

                      <Select
                        value={
                          designRequestType
                        }
                        onValueChange={
                          value =>
                            applyDesignRequestType(
                              value as
                                DesignRequestType
                            )
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent
                          position="popper"
                          className="z-[140]"
                        >
                          {DESIGN_REQUEST_OPTIONS.map(
                            option => (
                              <SelectItem
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {option.label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        Barang / Jasa *
                      </label>

                      <Select
                        value={
                          requestType
                        }
                        onValueChange={
                          value => {
                            setRequestType(
                              value as
                                MarcommRequestType
                            );

                            setGiftTier(
                              'REGULER'
                            );
                            setFlowerOption(
                              'BUNGA_PAPAN'
                            );
                            setGreetingText('');
                            setParticipantEstimate('');
                          }
                        }
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent
                          position="popper"
                          className="z-[140]"
                        >
                          {GOODS_SERVICE_OPTIONS.map(
                            option => (
                              <SelectItem
                                key={
                                  option.value
                                }
                                value={
                                  option.value
                                }
                              >
                                {option.label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Perusahaan *
                    </label>

                    <Select
                      value={
                        clientType
                      }
                      onValueChange={
                        value => {
                          setClientType(
                            value as
                              | 'EXISTING'
                              | 'PROSPECT'
                          );

                          setSelectedPolicy(
                            null
                          );
                          setPolicySearch('');
                          setProspectiveClient('');
                        }
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[140]"
                      >
                        <SelectItem value="EXISTING">
                          Existing Client — pilih nomor polis
                        </SelectItem>

                        <SelectItem value="PROSPECT">
                          Calon Klien
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {clientType ===
                  'EXISTING' ? (
                    <div className="relative">
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        Nomor Polis *
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          setPolicyPickerOpen(
                            previous =>
                              !previous
                          )
                        }
                        className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-left text-xs"
                      >
                        <span
                          className={
                            selectedPolicy
                              ? 'font-semibold text-gray-900'
                              : 'text-gray-400'
                          }
                        >
                          {selectedPolicy
                            ? `${selectedPolicy.policyNumber} • ${selectedPolicy.customerName}`
                            : 'Cari / pilih nomor polis...'}
                        </span>

                        <Search className="h-4 w-4 text-gray-400" />
                      </button>

                      {policyPickerOpen && (
                        <div className="absolute z-[145] mt-1 w-full min-w-[520px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
                          <div className="border-b border-gray-100 p-2">
                            <Input
                              autoFocus
                              value={
                                policySearch
                              }
                              onChange={
                                event =>
                                  setPolicySearch(
                                    event.target.value
                                  )
                              }
                              placeholder="Ketik nomor polis, client, produk, PIC..."
                              className="text-xs"
                            />
                          </div>

                          <div className="max-h-72 overflow-y-auto p-1">
                            {filteredPolicies.length ===
                            0 ? (
                              <div className="p-8 text-center text-xs text-gray-400">
                                Policy tidak ditemukan.
                              </div>
                            ) : (
                              filteredPolicies.map(
                                policy => (
                                  <button
                                    key={
                                      policy.id
                                    }
                                    type="button"
                                    onClick={() => {
                                      setSelectedPolicy(
                                        policy
                                      );

                                      setRequestProduct(
                                        policy.productName
                                      );

                                      setPolicyPickerOpen(
                                        false
                                      );
                                    }}
                                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50"
                                  >
                                    <div className="text-xs font-black text-gray-900">
                                      {policy.policyNumber}
                                    </div>

                                    <div className="mt-0.5 text-[10px] text-gray-600">
                                      {policy.customerName} • {policy.productName}
                                    </div>

                                    <div className="mt-0.5 text-[9px] text-gray-400">
                                      PIC: {policy.picName}
                                      {policy.isDummyPolicyNumber
                                        ? ' • Dummy UAT'
                                        : ''}
                                    </div>
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        Nama Calon Klien *
                      </label>

                      <Input
                        value={
                          prospectiveClient
                        }
                        onChange={
                          event =>
                            setProspectiveClient(
                              event.target.value
                            )
                        }
                        placeholder="PT / instansi / individu calon klien"
                        className="text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Tanggal Dibutuhkan *
                    </label>

                    <Input
                      type="date"
                      value={
                        needDate
                      }
                      onChange={
                        event =>
                          setNeedDate(
                            event.target.value
                          )
                      }
                      min={
                        minimumMarcommNeedDate
                      }
                      className="text-xs"
                    />

                    <p className="mt-1 text-[9px] leading-relaxed text-blue-700">
                      Minimal 3 hari kerja dari tanggal sistem (Senin–Jumat, hari pengajuan tidak dihitung). Tanggal paling awal: <b>{formatDateKeyId(minimumMarcommNeedDate)}</b>.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Produk {requestGroup === 'DESIGN' ? '*' : '(opsional)'}
                    </label>

                    <Select
                      value={
                        requestProduct ||
                        'NONE'
                      }
                      onValueChange={
                        value =>
                          setRequestProduct(
                            value ===
                              'NONE'
                              ? ''
                              : value
                          )
                      }
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent
                        position="popper"
                        className="z-[140] max-h-72"
                      >
                        {requestGroup !==
                          'DESIGN' && (
                          <SelectItem value="NONE">
                            Tidak terkait produk tertentu
                          </SelectItem>
                        )}

                        {activeProducts.map(
                          product => (
                            <SelectItem
                              key={
                                product.id
                              }
                              value={
                                product.productName
                              }
                            >
                              {product.productName}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {requestGroup ===
                    'GOODS_SERVICES' &&
                    (
                      requestType ===
                        'SOUVENIR' ||
                      requestType ===
                        'HAMPERS_HARI_RAYA'
                    ) && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Tier *
                        </label>

                        <Select
                          value={
                            giftTier
                          }
                          onValueChange={
                            value =>
                              setGiftTier(
                                value as
                                  | 'VIP'
                                  | 'REGULER'
                              )
                          }
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent
                            position="popper"
                            className="z-[140]"
                          >
                            <SelectItem value="VIP">
                              VIP
                            </SelectItem>

                            <SelectItem value="REGULER">
                              Reguler
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Qty / Jumlah *
                        </label>

                        <Input
                          type="number"
                          min="1"
                          value={
                            quantity
                          }
                          onChange={
                            event =>
                              setQuantity(
                                event.target.value
                              )
                          }
                          placeholder="Jumlah yang diajukan"
                          className="text-xs"
                        />
                      </div>

                      {requestType ===
                        'SOUVENIR' &&
                        selectedGiftStockSnapshot && (
                        <div
                          className={`md:col-span-2 rounded-xl border p-3 ${
                            selectedGiftStockSnapshot.available ===
                              0
                              ? 'border-rose-300 bg-rose-50'
                              : quantity &&
                                Number(
                                  quantity
                                ) >
                                  selectedGiftStockSnapshot.available
                                ? 'border-amber-300 bg-amber-50'
                                : 'border-emerald-200 bg-emerald-50'
                          }`}
                        >
                          <div className="text-[10px] font-black text-gray-900">
                            Awareness Stock Souvenir {giftTier}
                          </div>

                          <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-gray-700">
                            <span>
                              On Hand: <b>{selectedGiftStockSnapshot.onHand}</b>
                            </span>

                            <span>
                              Reserved: <b>{selectedGiftStockSnapshot.reserved}</b>
                            </span>

                            <span>
                              Available: <b>{selectedGiftStockSnapshot.available}</b>
                            </span>
                          </div>

                          {quantity &&
                            Number(
                              quantity
                            ) >
                              selectedGiftStockSnapshot.available && (
                            <p className="mt-2 text-[9px] font-bold leading-relaxed text-amber-800">
                              Qty request melebihi stock available. Request tetap boleh disubmit sebagai awareness; Department Head Marketing Communication dapat mengubah tier atau jumlah final.
                            </p>
                          )}
                        </div>
                      )}

                      {requestType ===
                        'HAMPERS_HARI_RAYA' && (
                        <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] text-slate-600">
                          Hampers tetap menggunakan tier VIP/Reguler, tetapi tidak dikelola sebagai stock. Tidak ada stock opname untuk Hampers Hari Raya.
                        </div>
                      )}
                    </>
                  )}

                  {requestGroup ===
                    'GOODS_SERVICES' &&
                    requestType ===
                      'KARANGAN_BUNGA_UCAPAN' && (
                    <>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Bentuk Permintaan *
                        </label>

                        <Select
                          value={
                            flowerOption
                          }
                          onValueChange={
                            value =>
                              setFlowerOption(
                                value as
                                  FlowerRequestOption
                              )
                          }
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent
                            position="popper"
                            className="z-[140]"
                          >
                            <SelectItem value="BUNGA_MEJA">
                              Bunga Meja
                            </SelectItem>

                            <SelectItem value="BUNGA_PAPAN">
                              Bunga Papan
                            </SelectItem>

                            <SelectItem value="DESIGN_UCAPAN_SAJA">
                              Design Ucapan Saja
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-bold text-gray-700">
                          Tulisan / Ucapan *
                        </label>

                        <Input
                          value={
                            greetingText
                          }
                          onChange={
                            event =>
                              setGreetingText(
                                event.target.value
                              )
                          }
                          placeholder="Contoh: Selamat atas kenaikan jabatan..."
                          className="text-xs"
                        />
                      </div>
                    </>
                  )}

                  {requestGroup ===
                    'GOODS_SERVICES' &&
                    (
                      requestType ===
                        'OPEN_BOOTH' ||
                      requestType ===
                        'LITERASI_KEUANGAN'
                    ) && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        Estimasi Jumlah Peserta *
                      </label>

                      <Input
                        type="number"
                        min="1"
                        value={
                          participantEstimate
                        }
                        onChange={
                          event =>
                            setParticipantEstimate(
                              event.target.value
                            )
                        }
                        placeholder="Jumlah peserta"
                        className="text-xs"
                      />
                    </div>
                  )}

                  {requestGroup ===
                    'GOODS_SERVICES' && (
                    <div>
                      <label className="mb-1 block text-xs font-bold text-gray-700">
                        {requestType ===
                          'KARANGAN_BUNGA_UCAPAN' &&
                        flowerOption ===
                          'DESIGN_UCAPAN_SAJA'
                          ? 'Lokasi / Alamat (opsional)'
                          : 'Lokasi / Alamat'}
                      </label>

                      <Input
                        value={
                          locationValue
                        }
                        onChange={
                          event =>
                            setLocationValue(
                              event.target.value
                            )
                        }
                        placeholder="Lokasi kegiatan atau alamat pengiriman"
                        className="text-xs"
                      />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Brief / Kebutuhan *
                    </label>

                    <Textarea
                      value={
                        brief
                      }
                      onChange={
                        event =>
                          setBrief(
                            event.target.value
                          )
                      }
                      placeholder={
                        requestGroup ===
                          'DESIGN'
                          ? 'Jelaskan objective, audience, pesan utama, ukuran/format, referensi, atau detail design lainnya...'
                          : 'Jelaskan underlying kebutuhan, detail kegiatan, spesifikasi barang/jasa, atau catatan operasional...'
                      }
                      className="min-h-28 text-xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Lampiran Brief
                    </label>

                    <Input
                      type="file"
                      multiple
                      onChange={
                        event =>
                          setRequestFiles(
                            Array.from(
                              event.target.files ||
                                []
                            ).slice(
                              0,
                              10
                            )
                          )
                      }
                      className="text-xs"
                    />

                    <p className="mt-1 text-[10px] text-gray-500">
                      Opsional, maksimal 10 file.
                    </p>
                  </div>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRequestOpen(
                        false
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void handleSubmitRequest()
                    }
                    className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Submit untuk Approval
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              APPROVAL / REVIEW MODAL
          ==================================================== */}
          {decisionContext && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setDecisionContext(
                  null
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      {decisionContext.kind === 'SERVICE_DOCUMENT'
                        ? 'Review Dokumen'
                        : decisionContext.kind === 'MARCOMM_INITIAL'
                          ? 'Review Awal Request Marcomm'
                          : 'Final Review Hasil Marcomm'}
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Approve atau reject setelah dokumen/detail direview.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDecisionContext(
                        null
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 p-5">
                  {decisionContext.kind ===
                  'SERVICE_DOCUMENT' ? (
                    <>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-sm font-black text-gray-900">
                          {decisionContext.document.title}
                        </div>

                        <div className="mt-1 text-[10px] text-gray-500">
                          {serviceCategoryLabel(decisionContext.document.category)} • {decisionContext.document.productName} • {decisionContext.document.versionLabel}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          void handleDownload(
                            decisionContext.document.id,
                            decisionContext.document.fileName
                          )
                        }
                        className="gap-2 text-xs"
                      >
                        <Download className="h-4 w-4" />
                        Download & Review File
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <div className="text-xs font-black text-gray-900">
                          {decisionContext.request.id} • {marcommRequestLabel(decisionContext.request)}
                        </div>

                        <div className="mt-1 text-sm font-black text-gray-900">
                          {decisionContext.request.clientName}
                        </div>

                        <p className="mt-2 text-[11px] leading-relaxed text-gray-700">
                          {decisionContext.request.brief}
                        </p>

                        <div className="mt-2 text-[10px] text-gray-500">
                          Need Date: {decisionContext.request.needDate}
                          {decisionContext.request.productName
                            ? ` • ${decisionContext.request.productName}`
                            : ''}
                        </div>
                      </div>

                      {decisionContext.kind ===
                        'MARCOMM_INITIAL' &&
                        (
                          decisionContext.request.requestType ===
                            'SOUVENIR' ||
                          decisionContext.request.requestType ===
                            'HAMPERS_HARI_RAYA'
                        ) && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                          <div className="text-[10px] font-black uppercase tracking-wide text-indigo-800">
                            Kewenangan Final Andi Rita
                          </div>

                          <p className="mt-1 text-[10px] leading-relaxed text-indigo-700">
                            Marketing mengajukan {decisionContext.request.giftTier || '-'} • Qty {decisionContext.request.quantity || 0}. Department Head Marketing Communication dapat mengubah tier dan jumlah sebelum request diteruskan ke Karina. Keputusan ini final dan tidak memiliki proses appeal dari Marketing.
                          </p>
                          {decisionContext.request.requestType ===
                            'HAMPERS_HARI_RAYA' && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2 text-[9px] text-slate-600">
                              Hampers Hari Raya tidak menggunakan stock opname. Tier VIP/Reguler dan Qty final tetap ditetapkan oleh Department Head Marketing Communication.
                            </div>
                          )}


                          {andiGiftStockSnapshot && (
                            <div className="mt-3 rounded-lg border border-indigo-200 bg-white p-3">
                              <div className="text-[9px] font-black uppercase tracking-wide text-indigo-700">
                                Stock {andiFinalGiftTier} Saat Ini
                              </div>

                              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-700">
                                <span>
                                  On Hand <b>{andiGiftStockSnapshot.onHand}</b>
                                </span>

                                <span>
                                  Reserved <b>{andiGiftStockSnapshot.reserved}</b>
                                </span>

                                <span>
                                  Available <b>{andiGiftStockSnapshot.available}</b>
                                </span>
                              </div>

                              {andiFinalQuantity &&
                                Number(
                                  andiFinalQuantity
                                ) >
                                  andiGiftStockSnapshot.available && (
                                <p className="mt-2 text-[9px] font-bold text-rose-700">
                                  Jumlah final melebihi stock available. Approval akan ditolak sistem sampai jumlah atau jenis disesuaikan.
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-gray-700">
                                Jenis Final *
                              </label>

                              <Select
                                value={
                                  andiFinalGiftTier
                                }
                                onValueChange={
                                  value =>
                                    setAndiFinalGiftTier(
                                      value as
                                        | 'VIP'
                                        | 'REGULER'
                                    )
                                }
                              >
                                <SelectTrigger className="bg-white text-xs">
                                  <SelectValue />
                                </SelectTrigger>

                                <SelectContent
                                  position="popper"
                                  className="z-[140]"
                                >
                                  <SelectItem value="VIP">
                                    VIP
                                  </SelectItem>

                                  <SelectItem value="REGULER">
                                    Reguler
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div>
                              <label className="mb-1 block text-[10px] font-bold text-gray-700">
                                Jumlah Final *
                              </label>

                              <Input
                                type="number"
                                min="1"
                                value={
                                  andiFinalQuantity
                                }
                                onChange={
                                  event =>
                                    setAndiFinalQuantity(
                                      event.target.value
                                    )
                                }
                                className="bg-white text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {decisionContext.kind ===
                        'MARCOMM_INITIAL' &&
                        decisionContext.request.requestAttachments.length >
                          0 && (
                        <div>
                          <div className="mb-2 text-[10px] font-black uppercase text-gray-500">
                            Lampiran Request
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {decisionContext.request.requestAttachments.map(
                              document => (
                                <Button
                                  key={
                                    document.id
                                  }
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleDownload(
                                      document.id,
                                      document.fileName
                                    )
                                  }
                                  className="text-[9px]"
                                >
                                  <Download className="mr-1 h-3 w-3" />
                                  {document.fileName}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {decisionContext.kind ===
                        'MARCOMM_FINAL' && (
                        <div>
                          <div className="mb-2 text-[10px] font-black uppercase text-gray-500">
                            File Hasil / Evidence Terbaru
                          </div>

                          <div className="space-y-2">
                            {decisionContext.request.deliverables[
                              decisionContext.request.deliverables.length -
                                1
                            ]?.documents.map(
                              document => (
                                <Button
                                  key={
                                    document.id
                                  }
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleDownload(
                                      document.id,
                                      document.fileName
                                    )
                                  }
                                  className="w-full justify-start text-[10px]"
                                >
                                  <Download className="mr-2 h-3.5 w-3.5" />
                                  {document.fileName}
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan Keputusan
                    </label>

                    <Textarea
                      value={
                        decisionNotes
                      }
                      onChange={
                        event =>
                          setDecisionNotes(
                            event.target.value
                          )
                      }
                      placeholder="Opsional untuk approve, disarankan diisi jika reject."
                      className="min-h-24 text-xs"
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleDecision(
                        false
                      )
                    }
                    className="border-rose-300 text-xs font-bold text-rose-700"
                  >
                    Reject
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      decisionContext.kind ===
                        'MARCOMM_INITIAL' &&
                      (
                        decisionContext.request.requestType ===
                          'SOUVENIR' ||
                        decisionContext.request.requestType ===
                          'HAMPERS_HARI_RAYA'
                      ) &&
                      (
                        !andiFinalQuantity ||
                        Number(
                          andiFinalQuantity
                        ) <=
                          0 ||
                        (
                          decisionContext.request.requestType ===
                            'SOUVENIR' &&
                          (
                            !andiGiftStockSnapshot ||
                            Number(
                              andiFinalQuantity
                            ) >
                              andiGiftStockSnapshot.available
                          )
                        )
                      )
                    }
                    onClick={() =>
                      handleDecision(
                        true
                      )
                    }
                    className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {decisionContext.kind ===
                      'MARCOMM_INITIAL' &&
                    (
                      decisionContext.request.requestType ===
                        'SOUVENIR' ||
                      decisionContext.request.requestType ===
                        'HAMPERS_HARI_RAYA'
                    )
                      ? 'Approve & Tetapkan Final'
                      : 'Approve'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              KARINA EXECUTION MODAL
          ==================================================== */}
          {executionRequest && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setExecutionRequest(
                  null
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Upload Hasil / Evidence
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      {executionRequest.id} • berikutnya masuk final review Department Head Marketing Communication.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setExecutionRequest(
                        null
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 p-5">
                  <Input
                    type="file"
                    multiple
                    onChange={
                      event =>
                        setExecutionFiles(
                          Array.from(
                            event.target.files ||
                              []
                          ).slice(
                            0,
                            10
                          )
                        )
                    }
                    className="text-xs"
                  />

                  <Textarea
                    value={
                      executionNotes
                    }
                    onChange={
                      event =>
                        setExecutionNotes(
                          event.target.value
                        )
                    }
                    placeholder="Catatan hasil/evidence..."
                    className="min-h-24 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setExecutionRequest(
                        null
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      executionFiles.length ===
                      0
                    }
                    onClick={() =>
                      void handleSubmitExecution()
                    }
                    className="bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Submit untuk Final Review
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================
              MARKETING REVISION MODAL
          ==================================================== */}
          {revisionRequest && (
            <div
              className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4"
              onClick={() =>
                setRevisionRequest(
                  null
                )
              }
            >
              <div
                className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                onClick={
                  event =>
                    event.stopPropagation()
                }
              >
                <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      Minta Revisi Hasil
                    </h2>

                    <p className="mt-1 text-[10px] text-gray-500">
                      Revisi V{(revisionRequest.deliverables?.length || 0) + 1} akan kembali meminta approval awal Department Head Marketing Communication.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setRevisionRequest(
                        null
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan Revisi *
                    </label>

                    <Textarea
                      value={
                        revisionNotes
                      }
                      onChange={
                        event =>
                          setRevisionNotes(
                            event.target.value
                          )
                      }
                      placeholder="Jelaskan perubahan yang diminta..."
                      className="min-h-32 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Lampiran Revisi
                    </label>

                    <Input
                      type="file"
                      multiple
                      onChange={
                        event =>
                          setRevisionFiles(
                            Array.from(
                              event.target.files ||
                                []
                            ).slice(
                              0,
                              10
                            )
                          )
                      }
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setRevisionRequest(
                        null
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !revisionNotes.trim()
                    }
                    onClick={() =>
                      void handleSubmitRevision()
                    }
                    className="bg-amber-600 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Submit Revisi
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  };

export default DokumenPendukungPage;
