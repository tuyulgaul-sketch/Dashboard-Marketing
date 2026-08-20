import React, { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { store, OfficialProductionSummary } from '@/services/store';
import {
  Pipeline,
  ProductMaster,
  ProductionTransaction,
  TargetEntry,
  TargetUploadBatch,
  User,
} from '@/types';
import { formatRupiah } from '@/utils/formatters';
import { ExcelExportButton } from '@/components/common/ExcelExportButton';
import {
  exportToExcel,
  getRowValue,
  parseExcelOrCsvFile,
} from '@/utils/excelExport';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  ShieldCheck,
  Target as TargetIcon,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface TargetValidationRow {
  userId: string;
  userName: string;
  position: string;
  department: string;

  annualTargetTotal: number;
  annualTargetNewBusiness: number;
  annualTargetRenewal: number;

  personalTargetTotal: number;
  personalTargetNewBusiness: number;
  personalTargetRenewal: number;

  monthlyTotal: number;
  monthlyNewBusinessTotal: number;
  monthlyRenewalTotal: number;

  subordinateTargetTotal: number;
  subordinateTargetNewBusiness: number;
  subordinateTargetRenewal: number;

  expectedAnnualTarget: number;
  diff: number;

  isAnnualSplitValid: boolean;
  isPersonalSplitValid: boolean;
  isMonthlyNewBusinessValid: boolean;
  isMonthlyRenewalValid: boolean;
  isMonthlyTotalValid: boolean;
  isAnnualValid: boolean;
  isAnnualNewBusinessValid: boolean;
  isAnnualRenewalValid: boolean;

  isValid: boolean;
  messages: string[];

  monthlyNewBusiness: number[];
  monthlyRenewal: number[];
  notes?: string;
}

interface BulkPipelineValidationRow {
  rowNum: number;
  year: number;
  businessType: 'New Business' | 'Renewal Business';
  insuranceType: 'Asuransi Jiwa' | 'Asuransi Kesehatan';
  customerCategory: 'Individu' | 'Kumpulan';
  productName: string;
  productId: string;
  customerName: string;
  estimatedPremium: number;
  pipelineMonth: number;
  targetClosingDate: string;
  isTender: boolean;
  channel: 'Direct Selling' | 'Agent' | 'Broker' | 'BUSB';
  picUserId: string;
  picName: string;
  unit: string;
  department: string;
  notes?: string;
  existingPolicyNumber?: string;
  duplicateStatus: 'CLEAR' | 'REVIEW' | 'BLOCK';
  duplicateSummary?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  messages: string[];
}

const TARGET_HOLDER_ROLES = new Set([
  'DIRECTOR_MARKETING',
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
]);

const normalizeUserId = (value: string): string => {
  return String(value || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .trim()
    .toUpperCase();
};

const PIPELINE_MONTH_LABELS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const parsePipelineMonth = (
  value: string
): number => {
  const raw =
    String(value || '')
      .trim()
      .toLowerCase();

  if (!raw) {
    return 0;
  }

  const numeric =
    Number(raw);

  if (
    Number.isInteger(
      numeric
    ) &&
    numeric >= 1 &&
    numeric <= 12
  ) {
    return numeric;
  }

  const normalized =
    raw
      .replace(/\./g, '')
      .replace(/\s+/g, '');

  const aliases:
    Record<string, number> = {
      januari: 1,
      jan: 1,
      februari: 2,
      feb: 2,
      maret: 3,
      mar: 3,
      april: 4,
      apr: 4,
      mei: 5,
      may: 5,
      juni: 6,
      jun: 6,
      juli: 7,
      jul: 7,
      agustus: 8,
      agu: 8,
      ags: 8,
      aug: 8,
      september: 9,
      sep: 9,
      oktober: 10,
      okt: 10,
      oct: 10,
      november: 11,
      nov: 11,
      desember: 12,
      des: 12,
      dec: 12,
    };

  return aliases[
    normalized
  ] || 0;
};

const getPlanningDateYear = (
  value?: string
): number => {
  if (!value) {
    return 0;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return date.getFullYear();
};

const getPlanningDateMonth = (
  value?: string
): number => {
  if (!value) {
    return 0;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return (
    date.getMonth() + 1
  );
};

const getPipelinePlanningYear = (
  pipeline: Pipeline
): number => {
  const explicitYear =
    Number(
      (pipeline as any)
        .pipelineYear
    );

  if (
    Number.isInteger(
      explicitYear
    ) &&
    explicitYear > 0
  ) {
    return explicitYear;
  }

  return getPlanningDateYear(
    pipeline.currentTargetClosingDate ||
      pipeline.originalTargetClosingDate
  );
};

const getPipelinePlanningMonth = (
  pipeline: Pipeline
): number => {
  const explicitMonth =
    Number(
      (pipeline as any)
        .pipelineMonth
    );

  if (
    Number.isInteger(
      explicitMonth
    ) &&
    explicitMonth >= 1 &&
    explicitMonth <= 12
  ) {
    return explicitMonth;
  }

  return getPlanningDateMonth(
    pipeline.currentTargetClosingDate ||
      pipeline.originalTargetClosingDate
  );
};

const parseTargetClosingYearMonth = (
  value: string
): {
  year: number;
  month: number;
} | null => {
  const match =
    String(value || '')
      .trim()
      .match(
        /^(\d{4})-(\d{2})-(\d{2})$/
      );

  if (!match) {
    return null;
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return {
    year,
    month,
  };
};

const parseMoney = (value: string): number => {
  const cleaned = String(value || '')
    .replace(/\u00A0/g, '')
    .replace(/\s/g, '')
    .replace(/Rp/gi, '');

  if (!cleaned) return 0;

  // Common Indonesian formats:
  // 1.000.000
  // 1.000.000,50
  // 1000000
  let normalized = cleaned;

  if (
    normalized.includes('.') &&
    normalized.includes(',')
  ) {
    normalized = normalized
      .replace(/\./g, '')
      .replace(',', '.');
  } else if (
    normalized.includes('.') &&
    !normalized.includes(',')
  ) {
    const dotParts = normalized.split('.');

    if (
      dotParts.length > 2 ||
      dotParts.slice(1).every(part => part.length === 3)
    ) {
      normalized = dotParts.join('');
    }
  } else if (
    normalized.includes(',') &&
    !normalized.includes('.')
  ) {
    const commaParts = normalized.split(',');

    if (
      commaParts.length > 2 ||
      commaParts.slice(1).every(part => part.length === 3)
    ) {
      normalized = commaParts.join('');
    } else {
      normalized = normalized.replace(',', '.');
    }
  }

  normalized = normalized.replace(/[^0-9.-]+/g, '');

  const parsed = Number(normalized);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const normalizeComparableText = (value: string): string => {
  return String(value || '')
    .toLowerCase()
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\bpt\b/g, '')
    .replace(/\bpersero\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const normalizeCustomerIdentity = (value: string): string => {
  const legalEntityWords = new Set([
    'pt',
    'persero',
    'perseroan',
    'terbatas',
    'tbk',
    'cv',
  ]);

  return String(value || '')
    .toLowerCase()
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map(token => token.trim())
    .filter(
      token =>
        token.length > 0 &&
        !legalEntityWords.has(token)
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const calculateLevenshteinDistance = (
  firstValue: string,
  secondValue: string
): number => {
  const first = firstValue || '';
  const second = secondValue || '';

  if (first === second) return 0;
  if (first.length === 0) return second.length;
  if (second.length === 0) return first.length;

  const previousRow =
    Array.from(
      { length: second.length + 1 },
      (_, index) => index
    );

  for (
    let firstIndex = 1;
    firstIndex <= first.length;
    firstIndex++
  ) {
    const currentRow: number[] =
      [firstIndex];

    for (
      let secondIndex = 1;
      secondIndex <= second.length;
      secondIndex++
    ) {
      const substitutionCost =
        first[firstIndex - 1] ===
        second[secondIndex - 1]
          ? 0
          : 1;

      currentRow[secondIndex] =
        Math.min(
          currentRow[
            secondIndex - 1
          ] + 1,
          previousRow[
            secondIndex
          ] + 1,
          previousRow[
            secondIndex - 1
          ] +
            substitutionCost
        );
    }

    for (
      let index = 0;
      index < currentRow.length;
      index++
    ) {
      previousRow[index] =
        currentRow[index];
    }
  }

  return previousRow[
    second.length
  ];
};

const calculateCustomerSimilarity = (
  firstValue: string,
  secondValue: string
): number => {
  const first =
    normalizeCustomerIdentity(
      firstValue
    );

  const second =
    normalizeCustomerIdentity(
      secondValue
    );

  if (!first || !second) return 0;
  if (first === second) return 1;

  const firstCompact =
    first.replace(/\s+/g, '');

  const secondCompact =
    second.replace(/\s+/g, '');

  const maxLength =
    Math.max(
      firstCompact.length,
      secondCompact.length
    );

  const characterScore =
    maxLength === 0
      ? 0
      : 1 -
        (
          calculateLevenshteinDistance(
            firstCompact,
            secondCompact
          ) /
          maxLength
        );

  const firstTokens =
    new Set(
      first.split(' ')
    );

  const secondTokens =
    new Set(
      second.split(' ')
    );

  const intersectionCount =
    Array.from(
      firstTokens
    ).filter(token =>
      secondTokens.has(token)
    ).length;

  const unionCount =
    new Set([
      ...Array.from(
        firstTokens
      ),
      ...Array.from(
        secondTokens
      ),
    ]).size;

  const tokenScore =
    unionCount === 0
      ? 0
      : intersectionCount /
        unionCount;

  return Math.max(
    characterScore,
    tokenScore
  );
};

const extractRecordYear = (
  recordId?: string,
  targetDate?: string
): number | null => {
  const dateYear =
    Number(
      String(
        targetDate || ''
      ).slice(0, 4)
    );

  if (
    Number.isInteger(
      dateYear
    ) &&
    dateYear >= 2000 &&
    dateYear <= 2100
  ) {
    return dateYear;
  }

  const idMatch =
    String(
      recordId || ''
    ).match(
      /-(20\d{2})-/
    );

  return idMatch
    ? Number(
        idMatch[1]
      )
    : null;
};

// Target validation uses exact Rupiah equality.
// Math.round prevents floating-point artifacts such as
// 99,999,999.99999998 being treated as different from Rp100,000,000,
// while a real Rp1+ difference still fails validation.
const isSameRupiah = (
  firstValue: number,
  secondValue: number
): boolean => {
  return Math.round(firstValue) === Math.round(secondValue);
};

const getRupiahDifference = (
  firstValue: number,
  secondValue: number
): number => {
  return Math.abs(
    Math.round(firstValue) -
    Math.round(secondValue)
  );
};

export const TargetRkapPage: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(
    store.getCurrentUser()
  );

  const [targets, setTargets] =
    useState<TargetEntry[]>([]);

  const [users, setUsers] =
    useState<User[]>([]);

  const [products, setProducts] =
    useState<ProductMaster[]>([]);

  const [pipelines, setPipelines] =
    useState<Pipeline[]>([]);

  const [productions, setProductions] =
    useState<ProductionTransaction[]>([]);

  const [
    officialProductions,
    setOfficialProductions,
  ] = useState<
    OfficialProductionSummary[]
  >([]);

  // ============================================================
  // MASTER TARGET STATE
  // ============================================================

  const [
    selectedTargetYear,
    setSelectedTargetYear,
  ] = useState<number>(2026);

  const [
    targetFile,
    setTargetFile,
  ] = useState<File | null>(null);

  const [
    targetValidationRows,
    setTargetValidationRows,
  ] = useState<TargetValidationRow[]>([]);

  const [
    targetValidationExecuted,
    setTargetValidationExecuted,
  ] = useState<boolean>(false);

  const [
    directorTargetValue,
    setDirectorTargetValue,
  ] = useState<number>(0);

  const [
    cascadeDiffValue,
    setCascadeDiffValue,
  ] = useState<number>(0);

  // ============================================================
  // BULK PIPELINE STATE
  // ============================================================

  const [
    selectedBulkYear,
    setSelectedBulkYear,
  ] = useState<number>(2026);

  const [
    bulkFile,
    setBulkFile,
  ] = useState<File | null>(null);

  const [
    bulkValidationRows,
    setBulkValidationRows,
  ] = useState<BulkPipelineValidationRow[]>([]);

  const [
    bulkValidationExecuted,
    setBulkValidationExecuted,
  ] = useState<boolean>(false);

  // ============================================================
  // READ-ONLY TARGET KINERJA STATE
  // ============================================================

  const [
    readonlyBusinessFilter,
    setReadonlyBusinessFilter,
  ] = useState<
    'OVERALL' |
    'New Business' |
    'Renewal Business'
  >('OVERALL');

  useEffect(() => {
    const refresh = () => {
      setCurrentUser(
        store.getCurrentUser()
      );

      setTargets(
        store.getTargets()
      );

      setUsers(
        store.getUsers()
      );

      setProducts(
        store.getProducts()
      );

      setPipelines(
        store.getPipelines()
      );

      setProductions(
        store.getProductions()
      );

      setOfficialProductions(
        store.getOfficialProductionSummaries()
      );
    };

    refresh();

    return store.subscribe(refresh);
  }, []);

  const isTLMS =
    currentUser.role ===
    'TEAM_LEADER_MARKETING_SUPPORT';

  const isMarketingTargetUser =
    TARGET_HOLDER_ROLES.has(
      currentUser.role
    );

  const targetHolders =
    users.filter(
      user =>
        user.status ===
          'Active' &&
        TARGET_HOLDER_ROLES.has(
          user.role
        )
    );

  // ============================================================
  // TARGET KINERJA — PERFORMANCE COCKPIT READ ONLY
  // ============================================================

  const scopeUserIds =
    isMarketingTargetUser
      ? store.getSubordinateUserIds(
          currentUser.id
        )
      : [];

  const scopeUserIdSet =
    new Set(
      scopeUserIds
    );

  const selectedYearTargets =
    targets.filter(
      target =>
        target.year ===
        selectedTargetYear
    );

  const currentTarget =
    selectedYearTargets.find(
      target =>
        target.userId ===
        currentUser.id
    );

  const scopeTargets =
    selectedYearTargets.filter(
      target =>
        scopeUserIdSet.has(
          target.userId
        )
    );

  const directTargetChildren =
    targetHolders.filter(
      user =>
        user.superiorId ===
        currentUser.id
    );

  const getAnnualByFilter = (
    target?: TargetEntry
  ): number => {
    if (!target) {
      return 0;
    }

    if (
      readonlyBusinessFilter ===
      'New Business'
    ) {
      return Number(
        target.annualTargetNewBusiness ||
        0
      );
    }

    if (
      readonlyBusinessFilter ===
      'Renewal Business'
    ) {
      return Number(
        target.annualTargetRenewal ||
        0
      );
    }

    return Number(
      target.annualTargetTotal ||
      0
    );
  };

  const getPersonalByFilter = (
    target?: TargetEntry
  ): number => {
    if (!target) {
      return 0;
    }

    if (
      readonlyBusinessFilter ===
      'New Business'
    ) {
      return Number(
        target.personalTargetNewBusiness ||
        0
      );
    }

    if (
      readonlyBusinessFilter ===
      'Renewal Business'
    ) {
      return Number(
        target.personalTargetRenewal ||
        0
      );
    }

    return Number(
      target.personalTargetTotal ||
      0
    );
  };

  const matchesBusinessFilter = (
    businessType:
      | 'New Business'
      | 'Renewal Business'
  ) =>
    readonlyBusinessFilter ===
      'OVERALL' ||
    businessType ===
      readonlyBusinessFilter;

  const getDateYear = (
    value?: string
  ): number | null => {
    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date.getFullYear();
  };

  const getDateMonth = (
    value?: string
  ): number | null => {
    if (!value) {
      return null;
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return (
      date.getMonth() + 1
    );
  };

  const annualScopeTarget =
    getAnnualByFilter(
      currentTarget
    );

  const personalScopeTarget =
    getPersonalByFilter(
      currentTarget
    );

  const subordinateScopeTarget =
    Math.max(
      0,
      annualScopeTarget -
      personalScopeTarget
    );

  const officialProductionRows =
    officialProductions.filter(
      production => {
        if (
          production.productionYear !==
          selectedTargetYear
        ) {
          return false;
        }

        if (
          !matchesBusinessFilter(
            production.businessType
          )
        ) {
          return false;
        }

        if (
          currentUser.role ===
          'DIRECTOR_MARKETING'
        ) {
          return true;
        }

        if (
          currentUser.role ===
          'VP_CAPTIVE_MARKETING'
        ) {
          return (
            production.marketingFunction ===
            'Captive Marketing'
          );
        }

        if (
          currentUser.role ===
          'VP_CORPORATE_RETAIL_MARKETING'
        ) {
          return (
            production.marketingFunction ===
            'Corporate & Retail Marketing'
          );
        }

        return Boolean(
          production.picUserId &&
          scopeUserIdSet.has(
            production.picUserId
          )
        );
      }
    );

  const realizedProduction =
    officialProductionRows.reduce(
      (
        accumulator,
        production
      ) =>
        accumulator +
        Number(
          production.productionAmount ||
          0
        ),
      0
    );

  const activePipelines =
    pipelines.filter(
      pipeline =>
        scopeUserIdSet.has(
          pipeline.picUserId
        ) &&
        matchesBusinessFilter(
          pipeline.businessType
        ) &&
        pipeline.status !==
          'WIN' &&
        pipeline.status !==
          'LOSE' &&
        getPipelinePlanningYear(
          pipeline
        ) ===
          selectedTargetYear
    );

  const activePipelineValue =
    activePipelines.reduce(
      (
        accumulator,
        pipeline
      ) =>
        accumulator +
        Number(
          pipeline.currentCommercialValue ||
          0
        ),
      0
    );

  const postedPipelineIds =
    new Set(
      productions
        .filter(
          production =>
            production.status ===
            'POSTED'
        )
        .map(
          production =>
            production.pipelineId
        )
        .filter(Boolean)
    );

  const winPendingProduction =
    pipelines.filter(
      pipeline => {
        if (
          pipeline.status !==
          'WIN'
        ) {
          return false;
        }

        if (
          !scopeUserIdSet.has(
            pipeline.picUserId
          )
        ) {
          return false;
        }

        if (
          !matchesBusinessFilter(
            pipeline.businessType
          )
        ) {
          return false;
        }

        if (
          postedPipelineIds.has(
            pipeline.id
          )
        ) {
          return false;
        }

        const referenceDate =
          pipeline.winDate ||
          pipeline.actualClosingDate ||
          pipeline.currentTargetClosingDate;

        return (
          getDateYear(
            referenceDate
          ) ===
          selectedTargetYear
        );
      }
    );

  const winPendingValue =
    winPendingProduction.reduce(
      (
        accumulator,
        pipeline
      ) =>
        accumulator +
        Number(
          pipeline.winningQuotationAmount ||
          pipeline.currentCommercialValue ||
          0
        ),
      0
    );

  const performanceGap =
    Math.max(
      0,
      annualScopeTarget -
      realizedProduction
    );

  const achievementPercentage =
    annualScopeTarget > 0
      ? (
          realizedProduction /
          annualScopeTarget
        ) *
        100
      : 0;

  const potentialValue =
    realizedProduction +
    winPendingValue +
    activePipelineValue;

  const potentialCoveragePercentage =
    annualScopeTarget > 0
      ? (
          potentialValue /
          annualScopeTarget
        ) *
        100
      : 0;

  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];

  const monthlyPerformanceData =
    monthLabels.map(
      (
        month,
        monthIndex
      ) => {
        const monthNumber =
          monthIndex + 1;

        const target =
          scopeTargets.reduce(
            (
              accumulator,
              targetEntry
            ) => {
              const nb =
                Number(
                  targetEntry
                    .monthlyNewBusiness?.[
                    monthIndex
                  ] || 0
                );

              const rn =
                Number(
                  targetEntry
                    .monthlyRenewal?.[
                    monthIndex
                  ] || 0
                );

              if (
                readonlyBusinessFilter ===
                'New Business'
              ) {
                return (
                  accumulator +
                  nb
                );
              }

              if (
                readonlyBusinessFilter ===
                'Renewal Business'
              ) {
                return (
                  accumulator +
                  rn
                );
              }

              return (
                accumulator +
                nb +
                rn
              );
            },
            0
          );

        const productionRows =
          officialProductionRows.filter(
            production =>
              production.productionMonth ===
              monthNumber
          );

        const realisasi =
          productionRows.reduce(
            (
              accumulator,
              production
            ) =>
              accumulator +
              Number(
                production.productionAmount ||
                0
              ),
            0
          );

        const pipelineRows =
          activePipelines.filter(
            pipeline =>
              getPipelinePlanningMonth(
                pipeline
              ) ===
              monthNumber
          );

        const pipeline =
          pipelineRows.reduce(
            (
              accumulator,
              pipelineRow
            ) =>
              accumulator +
              Number(
                pipelineRow.currentCommercialValue ||
                0
              ),
            0
          );

        const winRows =
          winPendingProduction.filter(
            pipeline => {
              const referenceDate =
                pipeline.winDate ||
                pipeline.actualClosingDate ||
                pipeline.currentTargetClosingDate;

              return (
                getDateMonth(
                  referenceDate
                ) ===
                monthNumber
              );
            }
          );

        const winPending =
          winRows.reduce(
            (
              accumulator,
              pipeline
            ) =>
              accumulator +
              Number(
                pipeline.winningQuotationAmount ||
                pipeline.currentCommercialValue ||
                0
              ),
            0
          );

        const achievement =
          target > 0
            ? (
                realisasi /
                target
              ) *
              100
            : 0;

        const potentialCoverage =
          target > 0
            ? (
                (
                  realisasi +
                  winPending +
                  pipeline
                ) /
                target
              ) *
              100
            : 0;

        return {
          month,
          monthNumber,
          target,
          realisasi,
          winPending,
          pipeline,
          productionCount:
            productionRows.length,
          winCount:
            winRows.length,
          pipelineCount:
            pipelineRows.length,
          achievement,
          potentialCoverage,
        };
      }
    );

  const monthlyTargetTotal =
    monthlyPerformanceData.reduce(
      (
        accumulator,
        row
      ) =>
        accumulator +
        row.target,
      0
    );

  const hasMonthlyTarget =
    monthlyPerformanceData.some(
      row =>
        row.target > 0
    );

  const monthlyTargetMatchesAnnual =
    Math.round(
      monthlyTargetTotal
    ) ===
    Math.round(
      annualScopeTarget
    );

  const formatCompactRupiah =
    (value: number): string => {
      const abs =
        Math.abs(value);

      if (
        abs >=
        1_000_000_000_000
      ) {
        return `${(
          value /
          1_000_000_000_000
        ).toFixed(
          abs >=
          10_000_000_000_000
            ? 0
            : 1
        )} T`;
      }

      if (
        abs >=
        1_000_000_000
      ) {
        return `${(
          value /
          1_000_000_000
        ).toFixed(
          abs >=
          10_000_000_000
            ? 0
            : 1
        )} M`;
      }

      if (
        abs >=
        1_000_000
      ) {
        return `${(
          value /
          1_000_000
        ).toFixed(
          abs >=
          10_000_000
            ? 0
            : 1
        )} Jt`;
      }

      return String(
        Math.round(value)
      );
    };

  const targetScopeLabel =
    currentUser.role ===
      'DIRECTOR_MARKETING'
      ? 'Direktorat Marketing'
      : currentUser.role ===
          'VP_CAPTIVE_MARKETING'
      ? 'Captive Marketing'
      : currentUser.role ===
          'VP_CORPORATE_RETAIL_MARKETING'
      ? 'Corporate & Retail Marketing'
      : currentUser.role ===
          'ADVISOR_MARKETING_DIRECTOR'
      ? 'Advisor Pemasaran'
      : currentUser.department !==
        'None'
      ? currentUser.department
      : currentUser.unit;

  const breakdownUsers =
    directTargetChildren.length > 0
      ? directTargetChildren
      : [currentUser];

  const targetPerformanceRows =
    breakdownUsers.map(
      user => {
        const userScopeIds =
          new Set(
            store.getSubordinateUserIds(
              user.id
            )
          );

        const userTarget =
          selectedYearTargets.find(
            target =>
              target.userId ===
              user.id
          );

        const target =
          getAnnualByFilter(
            userTarget
          );

        const production =
          productions
            .filter(
              row =>
                row.status ===
                  'POSTED' &&
                row.productionYear ===
                  selectedTargetYear &&
                userScopeIds.has(
                  row.picUserId
                ) &&
                matchesBusinessFilter(
                  row.businessType
                )
            )
            .reduce(
              (
                accumulator,
                row
              ) =>
                accumulator +
                Number(
                  row.invoiceAmount ||
                  0
                ),
              0
            );

        const activePipelineRows =
          pipelines.filter(
            row =>
              userScopeIds.has(
                row.picUserId
              ) &&
              matchesBusinessFilter(
                row.businessType
              ) &&
              row.status !==
                'WIN' &&
              row.status !==
                'LOSE' &&
              getDateYear(
                row.currentTargetClosingDate
              ) ===
                selectedTargetYear
          );

        const pipeline =
          activePipelineRows.reduce(
            (
              accumulator,
              row
            ) =>
              accumulator +
              Number(
                row.currentCommercialValue ||
                0
              ),
            0
          );

        const winPending =
          pipelines
            .filter(
              row => {
                if (
                  row.status !==
                  'WIN' ||
                  !userScopeIds.has(
                    row.picUserId
                  ) ||
                  !matchesBusinessFilter(
                    row.businessType
                  ) ||
                  postedPipelineIds.has(
                    row.id
                  )
                ) {
                  return false;
                }

                const referenceDate =
                  row.winDate ||
                  row.actualClosingDate ||
                  row.currentTargetClosingDate;

                return (
                  getDateYear(
                    referenceDate
                  ) ===
                  selectedTargetYear
                );
              }
            )
            .reduce(
              (
                accumulator,
                row
              ) =>
                accumulator +
                Number(
                  row.winningQuotationAmount ||
                  row.currentCommercialValue ||
                  0
                ),
              0
            );

        const achievement =
          target > 0
            ? (
                production /
                target
              ) *
              100
            : 0;

        const forecast =
          target > 0
            ? (
                (
                  production +
                  winPending +
                  pipeline
                ) /
                target
              ) *
              100
            : 0;

        return {
          user,
          target,
          production,
          winPending,
          pipeline,
          achievement,
          forecast,
        };
      }
    );

  const renderMonthlyPerformanceTooltip = ({
    active,
    payload,
    label,
  }: any) => {
    if (
      !active ||
      !payload ||
      payload.length === 0
    ) {
      return null;
    }

    const data =
      payload[0]?.payload;

    if (!data) {
      return null;
    }

    return (
      <div className="min-w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">

        <div className="text-xs font-black text-gray-900">
          {label} {selectedTargetYear}
        </div>

        <div className="mt-2 space-y-1.5 text-[11px]">

          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              Target
            </span>
            <span className="font-bold text-gray-900">
              {formatRupiah(
                data.target
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              Realisasi Produksi
            </span>
            <span className="font-bold text-emerald-700">
              {formatRupiah(
                data.realisasi
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              WIN Belum Produksi
            </span>
            <span className="font-bold text-cyan-700">
              {formatRupiah(
                data.winPending
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-gray-500">
              Pipeline Aktif
            </span>
            <span className="font-bold text-violet-700">
              {formatRupiah(
                data.pipeline
              )}
            </span>
          </div>

          <div className="border-t border-gray-100 pt-1.5">

            <div className="flex items-center justify-between gap-6">
              <span className="text-gray-500">
                Achievement
              </span>
              <span className="font-black text-gray-900">
                {data.achievement.toFixed(1)}%
              </span>
            </div>

            <div className="mt-1 flex items-center justify-between gap-6">
              <span className="text-gray-500">
                Potential Coverage
              </span>
              <span className="font-black text-blue-700">
                {data.potentialCoverage.toFixed(1)}%
              </span>
            </div>

          </div>

        </div>

      </div>
    );
  };

  // ============================================================
  // 1. MASTER TARGET RKAP
  // ============================================================

  const handleDownloadTargetTemplate =
    () => {
      const templateData =
        targetHolders.map(
          user => ({
            Tahun:
              selectedTargetYear,

            'User ID Penerima':
              user.id,

            'Nama Penerima':
              user.name,

            Jabatan:
              user.position,

            'Department Umum':
              user.unit,

            'Department Sub':
              user.department,

            'Target Tahunan':
              '',

            'Target Tahunan NB':
              '',

            'Target Tahunan RN':
              '',

            'Target Pribadi':
              '',

            'Target Pribadi NB':
              '',

            'Target Pribadi RN':
              '',

            'Januari NB':
              '',

            'Januari RN':
              '',

            'Februari NB':
              '',

            'Februari RN':
              '',

            'Maret NB':
              '',

            'Maret RN':
              '',

            'April NB':
              '',

            'April RN':
              '',

            'Mei NB':
              '',

            'Mei RN':
              '',

            'Juni NB':
              '',

            'Juni RN':
              '',

            'Juli NB':
              '',

            'Juli RN':
              '',

            'Agustus NB':
              '',

            'Agustus RN':
              '',

            'September NB':
              '',

            'September RN':
              '',

            'Oktober NB':
              '',

            'Oktober RN':
              '',

            'November NB':
              '',

            'November RN':
              '',

            'Desember NB':
              '',

            'Desember RN':
              '',

            Catatan:
              '',
          })
        );

      exportToExcel(
        templateData,
        `Template_Target_${selectedTargetYear}`
      );
    };

  const handleTargetFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (
      event.target.files &&
      event.target.files[0]
    ) {
      setTargetFile(
        event.target.files[0]
      );

      setTargetValidationExecuted(
        false
      );

      setTargetValidationRows(
        []
      );
    }
  };

  const handleValidateTargetFile =
    async () => {
      if (!targetFile) {
        alert(
          'Pilih file CSV Target terlebih dahulu.'
        );

        return;
      }

      try {
        const parsed =
          await parseExcelOrCsvFile(
            targetFile
          );

        if (
          parsed.length === 0
        ) {
          alert(
            'File kosong atau format tidak dapat dibaca.'
          );

          return;
        }

        const rawRows =
          parsed.map(row => {
            const userId =
              normalizeUserId(
                getRowValue(
                  row,
                  'User ID Penerima',
                  'User ID',
                  'UserID',
                  'ID'
                )
              );

            const rowYear =
              Number(
                getRowValue(
                  row,
                  'Tahun',
                  'Year'
                )
              ) ||
              selectedTargetYear;

            const annualTarget =
              parseMoney(
                getRowValue(
                  row,
                  'Target Tahunan',
                  'TargetTahunan',
                  'AnnualTarget'
                )
              );

            const annualTargetNewBusiness =
              parseMoney(
                getRowValue(
                  row,
                  'Target Tahunan NB',
                  'Target Tahunan New Business',
                  'Annual Target NB',
                  'AnnualTargetNB'
                )
              );

            const annualTargetRenewal =
              parseMoney(
                getRowValue(
                  row,
                  'Target Tahunan RN',
                  'Target Tahunan Renewal',
                  'Annual Target RN',
                  'AnnualTargetRenewal'
                )
              );

            const personalTarget =
              parseMoney(
                getRowValue(
                  row,
                  'Target Pribadi',
                  'TargetPribadi',
                  'PersonalTarget'
                )
              );

            const personalTargetNewBusiness =
              parseMoney(
                getRowValue(
                  row,
                  'Target Pribadi NB',
                  'Target Pribadi New Business',
                  'Personal Target NB',
                  'PersonalTargetNB'
                )
              );

            const personalTargetRenewal =
              parseMoney(
                getRowValue(
                  row,
                  'Target Pribadi RN',
                  'Target Pribadi Renewal',
                  'Personal Target RN',
                  'PersonalTargetRenewal'
                )
              );

            const monthNames = [
              ['Januari', 'Jan'],
              ['Februari', 'Feb'],
              ['Maret', 'Mar'],
              ['April', 'Apr'],
              ['Mei', 'May'],
              ['Juni', 'Jun'],
              ['Juli', 'Jul'],
              ['Agustus', 'Aug'],
              ['September', 'Sep'],
              ['Oktober', 'Oct'],
              ['November', 'Nov'],
              ['Desember', 'Dec'],
            ];

            const monthlyNewBusiness =
              monthNames.map(
                ([monthId, monthEn]) =>
                  parseMoney(
                    getRowValue(
                      row,
                      `${monthId} NB`,
                      `${monthId} New Business`,
                      `${monthEn} NB`,
                      `${monthEn} New Business`
                    )
                  )
              );

            const monthlyRenewal =
              monthNames.map(
                ([monthId, monthEn]) =>
                  parseMoney(
                    getRowValue(
                      row,
                      `${monthId} RN`,
                      `${monthId} Renewal`,
                      `${monthEn} RN`,
                      `${monthEn} Renewal`
                    )
                  )
              );

            const monthlyNewBusinessTotal =
              monthlyNewBusiness.reduce(
                (accumulator, amount) =>
                  accumulator + amount,
                0
              );

            const monthlyRenewalTotal =
              monthlyRenewal.reduce(
                (accumulator, amount) =>
                  accumulator + amount,
                0
              );

            const monthlySum =
              monthlyNewBusinessTotal +
              monthlyRenewalTotal;

            return {
              userId,
              rowYear,
              annualTarget,
              annualTargetNewBusiness,
              annualTargetRenewal,
              personalTarget,
              personalTargetNewBusiness,
              personalTargetRenewal,
              monthlyNewBusiness,
              monthlyRenewal,
              monthlyNewBusinessTotal,
              monthlyRenewalTotal,
              monthlySum,
              notes:
                getRowValue(
                  row,
                  'Catatan',
                  'Notes'
                ),
            };
          });

        const duplicateUserIds =
          new Set<string>();

        const seenUserIds =
          new Set<string>();

        rawRows.forEach(row => {
          if (!row.userId) return;

          if (
            seenUserIds.has(
              row.userId
            )
          ) {
            duplicateUserIds.add(
              row.userId
            );
          }

          seenUserIds.add(
            row.userId
          );
        });

        const validationList:
          TargetValidationRow[] =
          [];

        let directorAnnual =
          0;

        targetHolders.forEach(
          user => {
            const normalizedMasterId =
              normalizeUserId(
                user.id
              );

            const fileRow =
              rawRows.find(
                row =>
                  row.userId ===
                  normalizedMasterId
              );

            const annualTargetTotal =
              fileRow
                ? fileRow.annualTarget
                : 0;

            const annualTargetNewBusiness =
              fileRow
                ? fileRow.annualTargetNewBusiness
                : 0;

            const annualTargetRenewal =
              fileRow
                ? fileRow.annualTargetRenewal
                : 0;

            const personalTargetTotal =
              fileRow
                ? fileRow.personalTarget
                : 0;

            const personalTargetNewBusiness =
              fileRow
                ? fileRow.personalTargetNewBusiness
                : 0;

            const personalTargetRenewal =
              fileRow
                ? fileRow.personalTargetRenewal
                : 0;

            const monthlyNewBusiness =
              fileRow
                ? fileRow.monthlyNewBusiness
                : Array(12).fill(0);

            const monthlyRenewal =
              fileRow
                ? fileRow.monthlyRenewal
                : Array(12).fill(0);

            const monthlyNewBusinessTotal =
              fileRow
                ? fileRow.monthlyNewBusinessTotal
                : 0;

            const monthlyRenewalTotal =
              fileRow
                ? fileRow.monthlyRenewalTotal
                : 0;

            const monthlyTotal =
              fileRow
                ? fileRow.monthlySum
                : 0;

            if (
              user.role ===
              'DIRECTOR_MARKETING'
            ) {
              directorAnnual =
                annualTargetTotal;
            }

            const directSubs =
              targetHolders.filter(
                subordinate =>
                  subordinate.superiorId ===
                  user.id
              );

            const subordinateTargetTotal =
              directSubs.reduce(
                (
                  accumulator,
                  subordinate
                ) => {
                  const subordinateFileRow =
                    rawRows.find(
                      row =>
                        row.userId ===
                        normalizeUserId(
                          subordinate.id
                        )
                    );

                  return (
                    accumulator +
                    (
                      subordinateFileRow
                        ? subordinateFileRow.annualTarget
                        : 0
                    )
                  );
                },
                0
              );

            const subordinateTargetNewBusiness =
              directSubs.reduce(
                (
                  accumulator,
                  subordinate
                ) => {
                  const subordinateFileRow =
                    rawRows.find(
                      row =>
                        row.userId ===
                        normalizeUserId(
                          subordinate.id
                        )
                    );

                  return (
                    accumulator +
                    (
                      subordinateFileRow
                        ? subordinateFileRow.annualTargetNewBusiness
                        : 0
                    )
                  );
                },
                0
              );

            const subordinateTargetRenewal =
              directSubs.reduce(
                (
                  accumulator,
                  subordinate
                ) => {
                  const subordinateFileRow =
                    rawRows.find(
                      row =>
                        row.userId ===
                        normalizeUserId(
                          subordinate.id
                        )
                    );

                  return (
                    accumulator +
                    (
                      subordinateFileRow
                        ? subordinateFileRow.annualTargetRenewal
                        : 0
                    )
                  );
                },
                0
              );

            const expectedAnnualTarget =
              personalTargetTotal +
              subordinateTargetTotal;

            const expectedAnnualNewBusiness =
              personalTargetNewBusiness +
              subordinateTargetNewBusiness;

            const expectedAnnualRenewal =
              personalTargetRenewal +
              subordinateTargetRenewal;

            const diff =
              getRupiahDifference(
                annualTargetTotal,
                expectedAnnualTarget
              );

            const annualNewBusinessDiff =
              getRupiahDifference(
                annualTargetNewBusiness,
                expectedAnnualNewBusiness
              );

            const annualRenewalDiff =
              getRupiahDifference(
                annualTargetRenewal,
                expectedAnnualRenewal
              );

            const monthlyNewBusinessDiff =
              getRupiahDifference(
                monthlyNewBusinessTotal,
                personalTargetNewBusiness
              );

            const monthlyRenewalDiff =
              getRupiahDifference(
                monthlyRenewalTotal,
                personalTargetRenewal
              );

            const monthlyTotalDiff =
              getRupiahDifference(
                monthlyTotal,
                personalTargetTotal
              );

            const annualSplitDiff =
              getRupiahDifference(
                annualTargetTotal,
                annualTargetNewBusiness +
                  annualTargetRenewal
              );

            const personalSplitDiff =
              getRupiahDifference(
                personalTargetTotal,
                personalTargetNewBusiness +
                  personalTargetRenewal
              );

            const messages:
              string[] =
              [];

            const isAnnualSplitValid =
              isSameRupiah(
                annualTargetTotal,
                annualTargetNewBusiness +
                  annualTargetRenewal
              );

            const isPersonalSplitValid =
              isSameRupiah(
                personalTargetTotal,
                personalTargetNewBusiness +
                  personalTargetRenewal
              );

            const isMonthlyNewBusinessValid =
              isSameRupiah(
                monthlyNewBusinessTotal,
                personalTargetNewBusiness
              );

            const isMonthlyRenewalValid =
              isSameRupiah(
                monthlyRenewalTotal,
                personalTargetRenewal
              );

            const isMonthlyTotalValid =
              isSameRupiah(
                monthlyTotal,
                personalTargetTotal
              );

            const isAnnualValid =
              isSameRupiah(
                annualTargetTotal,
                expectedAnnualTarget
              );

            const isAnnualNewBusinessValid =
              isSameRupiah(
                annualTargetNewBusiness,
                expectedAnnualNewBusiness
              );

            const isAnnualRenewalValid =
              isSameRupiah(
                annualTargetRenewal,
                expectedAnnualRenewal
              );

            let fileAndMasterValid =
              true;

            if (!fileRow) {
              messages.push(
                `User ID ${user.id} tidak ditemukan dalam file`
              );

              fileAndMasterValid =
                false;
            }

            if (
              fileRow &&
              fileRow.rowYear !==
                selectedTargetYear
            ) {
              messages.push(
                `Tahun pada file (${fileRow.rowYear}) tidak sesuai dengan tahun target ${selectedTargetYear}`
              );

              fileAndMasterValid =
                false;
            }

            if (
              duplicateUserIds.has(
                normalizedMasterId
              )
            ) {
              messages.push(
                'User ID muncul lebih dari satu kali dalam file'
              );

              fileAndMasterValid =
                false;
            }

            if (
              !isAnnualSplitValid
            ) {
              messages.push(
                `Target Tahunan Total ${formatRupiah(annualTargetTotal)} tidak sama dengan NB ${formatRupiah(annualTargetNewBusiness)} + RN ${formatRupiah(annualTargetRenewal)}. Selisih ${formatRupiah(annualSplitDiff)}`
              );
            }

            if (
              !isPersonalSplitValid
            ) {
              messages.push(
                `Target Pribadi Total ${formatRupiah(personalTargetTotal)} tidak sama dengan NB ${formatRupiah(personalTargetNewBusiness)} + RN ${formatRupiah(personalTargetRenewal)}. Selisih ${formatRupiah(personalSplitDiff)}`
              );
            }

            if (
              !isMonthlyNewBusinessValid
            ) {
              messages.push(
                `Total bulanan NB ${formatRupiah(monthlyNewBusinessTotal)} tidak sama dengan Target Pribadi NB ${formatRupiah(personalTargetNewBusiness)}. Selisih ${formatRupiah(monthlyNewBusinessDiff)}`
              );
            }

            if (
              !isMonthlyRenewalValid
            ) {
              messages.push(
                `Total bulanan RN ${formatRupiah(monthlyRenewalTotal)} tidak sama dengan Target Pribadi RN ${formatRupiah(personalTargetRenewal)}. Selisih ${formatRupiah(monthlyRenewalDiff)}`
              );
            }

            if (
              !isMonthlyTotalValid
            ) {
              messages.push(
                `Total seluruh target bulanan ${formatRupiah(monthlyTotal)} tidak sama dengan Target Pribadi Total ${formatRupiah(personalTargetTotal)}. Selisih ${formatRupiah(monthlyTotalDiff)}`
              );
            }

            if (
              !isAnnualValid
            ) {
              messages.push(
                `Cascading Total tidak balance: Target Tahunan ${formatRupiah(annualTargetTotal)} tidak sama dengan Target Pribadi ${formatRupiah(personalTargetTotal)} + Target Bawahan ${formatRupiah(subordinateTargetTotal)}. Selisih ${formatRupiah(diff)}`
              );
            }

            if (
              !isAnnualNewBusinessValid
            ) {
              messages.push(
                `Cascading NB tidak balance: Target Tahunan NB ${formatRupiah(annualTargetNewBusiness)} tidak sama dengan Target Pribadi NB ${formatRupiah(personalTargetNewBusiness)} + Target Bawahan NB ${formatRupiah(subordinateTargetNewBusiness)}. Selisih ${formatRupiah(annualNewBusinessDiff)}`
              );
            }

            if (
              !isAnnualRenewalValid
            ) {
              messages.push(
                `Cascading RN tidak balance: Target Tahunan RN ${formatRupiah(annualTargetRenewal)} tidak sama dengan Target Pribadi RN ${formatRupiah(personalTargetRenewal)} + Target Bawahan RN ${formatRupiah(subordinateTargetRenewal)}. Selisih ${formatRupiah(annualRenewalDiff)}`
              );
            }

            const isValid =
              fileAndMasterValid &&
              isAnnualSplitValid &&
              isPersonalSplitValid &&
              isMonthlyNewBusinessValid &&
              isMonthlyRenewalValid &&
              isMonthlyTotalValid &&
              isAnnualValid &&
              isAnnualNewBusinessValid &&
              isAnnualRenewalValid;

            validationList.push({
              userId:
                user.id,

              userName:
                user.name,

              position:
                user.position,

              department:
                user.department !==
                'None'
                  ? user.department
                  : user.unit,

              annualTargetTotal,
              annualTargetNewBusiness,
              annualTargetRenewal,

              personalTargetTotal,
              personalTargetNewBusiness,
              personalTargetRenewal,

              monthlyTotal,
              monthlyNewBusinessTotal,
              monthlyRenewalTotal,

              subordinateTargetTotal,
              subordinateTargetNewBusiness,
              subordinateTargetRenewal,

              expectedAnnualTarget,
              diff,

              isAnnualSplitValid,
              isPersonalSplitValid,
              isMonthlyNewBusinessValid,
              isMonthlyRenewalValid,
              isMonthlyTotalValid,
              isAnnualValid,
              isAnnualNewBusinessValid,
              isAnnualRenewalValid,

              isValid,
              messages,

              monthlyNewBusiness,
              monthlyRenewal,

              notes:
                fileRow?.notes,
            });
          }
        );

        const directorUser =
          targetHolders.find(
            user =>
              user.role ===
              'DIRECTOR_MARKETING'
          );

        const directorRow =
          directorUser
            ? validationList.find(
                row =>
                  row.userId ===
                  directorUser.id
              )
            : undefined;

        const directReportsDirector =
          directorUser
            ? targetHolders.filter(
                user =>
                  user.superiorId ===
                  directorUser.id
              )
            : [];

        const sumDirectDirector =
          directReportsDirector.reduce(
            (
              accumulator,
              directReport
            ) => {
              const row =
                validationList.find(
                  validation =>
                    validation.userId ===
                    directReport.id
                );

              return (
                accumulator +
                (
                  row
                    ? row.annualTargetTotal
                    : 0
                )
              );
            },
            0
          );

        const directorPersonal =
          directorRow
            ? directorRow.personalTargetTotal
            : 0;

        const calculatedDirectorCascade =
          directorPersonal +
          sumDirectDirector;

        setDirectorTargetValue(
          directorAnnual
        );

        setCascadeDiffValue(
          getRupiahDifference(
            directorAnnual,
            calculatedDirectorCascade
          )
        );

        setTargetValidationRows(
          validationList
        );

        setTargetValidationExecuted(
          true
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal membaca file CSV Target.';

        alert(message);
      }
    };

  const hasTargetBlockingErrors =
    targetValidationRows.some(
      row => !row.isValid
    ) ||
    Math.round(cascadeDiffValue) !== 0;

  const handlePublishTarget =
    () => {
      if (
        hasTargetBlockingErrors
      ) {
        alert(
          'Tidak dapat mempublikasikan Target RKAP karena masih terdapat error validasi.'
        );

        return;
      }

      if (
        !confirm(
          `Konfirmasi Publish Target RKAP Tahun ${selectedTargetYear}?\nTotal Target Direktorat: ${formatRupiah(
            directorTargetValue
          )}`
        )
      ) {
        return;
      }

      const batchId =
        'BATCH-TRG-' +
        Date.now();

      const newEntries:
        TargetEntry[] =
        targetValidationRows.map(
          row => {
            const user =
              users.find(
                item =>
                  item.id ===
                  row.userId
              );

            return {
              id:
                `TRG-${selectedTargetYear}-${row.userId}`,

              year:
                selectedTargetYear,

              userId:
                row.userId,

              userName:
                row.userName,

              position:
                row.position,

              unit:
                user?.unit ||
                'Captive Marketing',

              department:
                user?.department ||
                'None',

              annualTargetTotal:
                row.annualTargetTotal,

              annualTargetNewBusiness:
                row.annualTargetNewBusiness,

              annualTargetRenewal:
                row.annualTargetRenewal,

              personalTargetTotal:
                row.personalTargetTotal,

              personalTargetNewBusiness:
                row.personalTargetNewBusiness,

              personalTargetRenewal:
                row.personalTargetRenewal,

              monthlyNewBusiness:
                row.monthlyNewBusiness,

              monthlyRenewal:
                row.monthlyRenewal,

              notes:
                row.notes ||
                'Published via CSV import',

              publishedAt:
                new Date().toISOString(),

              publishedBy:
                currentUser.name,
            };
          }
        );

      const batch:
        TargetUploadBatch = {
          id:
            batchId,

          year:
            selectedTargetYear,

          filename:
            targetFile?.name ||
            `Target_${selectedTargetYear}.csv`,

          uploadedBy:
            currentUser.name,

          uploadedAt:
            new Date().toISOString(),

          recordCount:
            newEntries.length,

          status:
            'Published',
        };

      store.publishTargetBatch(
        batch,
        newEntries
      );

      setTargetFile(
        null
      );

      setTargetValidationExecuted(
        false
      );

      setTargetValidationRows(
        []
      );

      alert(
        `Target RKAP Tahun ${selectedTargetYear} berhasil ter-publish secara resmi!`
      );
    };

  // ============================================================
  // 2. BULK PIPELINE RKAP
  // ============================================================

  const handleDownloadBulkPipelineTemplate =
    () => {
      const eligiblePic =
        targetHolders.find(
          user =>
            user.role ===
            'STAFF_MARKETING'
        ) ||
        targetHolders[0] ||
        currentUser;

      const superior =
        users.find(
          user =>
            user.id ===
            eligiblePic.superiorId
        );

      const templateData = [
        {
          Tahun:
            selectedBulkYear,

          'Bulan Pipeline':
            'Januari',

          'Jenis Bisnis':
            'New Business',

          'Jenis Asuransi':
            'Asuransi Kesehatan',

          'Kategori Nasabah':
            'Kumpulan',

          Produk:
            'TM GROUP MEDICARE PLAN',

          'Nama Calon Nasabah':
            '',

          'Estimasi Premi':
            '',

          'Target Closing':
            `${selectedBulkYear}-01-20`,

          'Metode Pengadaan':
            'Non-Tender',

          'Distribution Channel':
            'Direct Selling',

          'PIC User ID':
            eligiblePic.id,

          'PIC Marketing':
            eligiblePic.name,

          Unit:
            eligiblePic.unit,

          Department:
            eligiblePic.department,

          'Direct Superior':
            superior?.name || '',

          Catatan:
            '',

          'Existing Policy Number':
            '',

          'Original Policy Year':
            '',

          'Coverage Start':
            '',

          'Coverage End':
            '',

          'Renewal Type':
            '',
        },
      ];

      exportToExcel(
        templateData,
        `Template_Bulk_Pipeline_${selectedBulkYear}`
      );
    };

  const handleBulkFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (
      event.target.files &&
      event.target.files[0]
    ) {
      setBulkFile(
        event.target.files[0]
      );

      setBulkValidationExecuted(
        false
      );

      setBulkValidationRows(
        []
      );
    }
  };

  const handleValidateBulkFile =
    async () => {
      if (!bulkFile) {
        alert(
          'Pilih file CSV Bulk Pipeline terlebih dahulu.'
        );

        return;
      }

      try {
        const parsed =
          await parseExcelOrCsvFile(
            bulkFile
          );

        if (
          parsed.length === 0
        ) {
          alert(
            'File kosong atau format tidak dapat dibaca.'
          );

          return;
        }

        const existingPipelines =
          store.getPipelines();

        const existingBookings =
          store.getBookings();

        const duplicateCandidatesFromFile =
          parsed.map(
            (
              row,
              index
            ) => ({
              rowNum:
                index + 1,

              customerName:
                getRowValue(
                  row,
                  'Nama Calon Nasabah',
                  'Customer Name',
                  'Customer'
                ),

              productName:
                getRowValue(
                  row,
                  'Produk',
                  'Product'
                ),

              picUserId:
                normalizeUserId(
                  getRowValue(
                    row,
                    'PIC User ID',
                    'PIC User',
                    'PIC ID'
                  )
                ),

              picName:
                getRowValue(
                  row,
                  'PIC Marketing',
                  'PIC'
                ),
            })
          );

        const validationList:
          BulkPipelineValidationRow[] =
          parsed.map(
            (row, index) => {
              const messages:
                string[] =
                [];

              let status:
                | 'VALID'
                | 'WARNING'
                | 'ERROR' =
                'VALID';

              const year =
                Number(
                  getRowValue(
                    row,
                    'Tahun',
                    'Year'
                  )
                ) ||
                selectedBulkYear;

              const rawPipelineMonth =
                getRowValue(
                  row,
                  'Bulan Pipeline',
                  'Pipeline Month',
                  'Bulan'
                );

              const pipelineMonth =
                parsePipelineMonth(
                  rawPipelineMonth
                );

              const rawBusinessType =
                getRowValue(
                  row,
                  'Jenis Bisnis',
                  'Business Type'
                ) ||
                'New Business';

              const businessType =
                rawBusinessType.toLowerCase() ===
                'renewal'
                  ? 'Renewal Business'
                  : rawBusinessType ===
                    'Renewal Business'
                  ? 'Renewal Business'
                  : 'New Business';

              const insuranceType =
                (
                  getRowValue(
                    row,
                    'Jenis Asuransi',
                    'Insurance Type'
                  ) ||
                  'Asuransi Kesehatan'
                ) as
                  | 'Asuransi Jiwa'
                  | 'Asuransi Kesehatan';

              const customerCategory =
                (
                  getRowValue(
                    row,
                    'Kategori Nasabah',
                    'Customer Category'
                  ) ||
                  'Kumpulan'
                ) as
                  | 'Individu'
                  | 'Kumpulan';

              const productName =
                getRowValue(
                  row,
                  'Produk',
                  'Product'
                );

              const customerName =
                getRowValue(
                  row,
                  'Nama Calon Nasabah',
                  'Customer Name',
                  'Customer'
                );

              const estimatedPremium =
                parseMoney(
                  getRowValue(
                    row,
                    'Estimasi Premi',
                    'Estimated Premium'
                  )
                );

              const targetClosingDate =
                getRowValue(
                  row,
                  'Target Closing',
                  'Target Closing Date'
                );

              const procurementMethod =
                getRowValue(
                  row,
                  'Metode Pengadaan',
                  'Tender'
                );

              const isTender =
                procurementMethod
                  .trim()
                  .toLowerCase() ===
                'tender';

              const channel =
                (
                  getRowValue(
                    row,
                    'Distribution Channel',
                    'Channel'
                  ) ||
                  'Direct Selling'
                ) as
                  | 'Direct Selling'
                  | 'Agent'
                  | 'Broker'
                  | 'BUSB';

              const picUserId =
                normalizeUserId(
                  getRowValue(
                    row,
                    'PIC User ID',
                    'PIC User',
                    'PIC ID'
                  )
                );

              const inputPicName =
                getRowValue(
                  row,
                  'PIC Marketing',
                  'PIC'
                );

              const inputUnit =
                getRowValue(
                  row,
                  'Unit'
                );

              const inputDepartment =
                getRowValue(
                  row,
                  'Department'
                );

              const notes =
                getRowValue(
                  row,
                  'Catatan',
                  'Notes'
                );

              const picUser =
                users.find(
                  user =>
                    normalizeUserId(
                      user.id
                    ) ===
                    picUserId
                );

              if (
                year !==
                selectedBulkYear
              ) {
                messages.push(
                  `Tahun ${year} tidak sesuai dengan tahun Bulk Pipeline ${selectedBulkYear}`
                );

                status =
                  'ERROR';
              }

              if (
                pipelineMonth < 1 ||
                pipelineMonth > 12
              ) {
                messages.push(
                  'Bulan Pipeline wajib diisi Januari–Desember atau angka 1–12'
                );

                status =
                  'ERROR';
              }

              if (
                targetClosingDate
              ) {
                const closingYearMonth =
                  parseTargetClosingYearMonth(
                    targetClosingDate
                  );

                if (
                  !closingYearMonth
                ) {
                  messages.push(
                    'Target Closing harus menggunakan format YYYY-MM-DD'
                  );

                  status =
                    'ERROR';
                } else {
                  if (
                    closingYearMonth.year !==
                    year
                  ) {
                    messages.push(
                      `Tahun Target Closing ${closingYearMonth.year} tidak sama dengan Tahun ${year}`
                    );

                    status =
                      'ERROR';
                  }

                  if (
                    pipelineMonth > 0 &&
                    closingYearMonth.month !==
                    pipelineMonth
                  ) {
                    messages.push(
                      `Bulan Pipeline ${PIPELINE_MONTH_LABELS[pipelineMonth - 1]} tidak sama dengan bulan pada Target Closing ${targetClosingDate}`
                    );

                    status =
                      'ERROR';
                  }
                }
              }

              if (
                !picUser
              ) {
                messages.push(
                  `PIC User ID '${picUserId}' tidak terdaftar di database`
                );

                status =
                  'ERROR';
              } else {
                if (
                  !TARGET_HOLDER_ROLES.has(
                    picUser.role
                  )
                ) {
                  messages.push(
                    'PIC Pipeline harus merupakan user Marketing yang berhak memiliki Pipeline'
                  );

                  status =
                    'ERROR';
                }

                if (
                  picUser.status !==
                  'Active'
                ) {
                  messages.push(
                    'PIC Marketing tidak aktif'
                  );

                  status =
                    'ERROR';
                }

                if (
                  inputPicName &&
                  normalizeComparableText(
                    inputPicName
                  ) !==
                    normalizeComparableText(
                      picUser.name
                    )
                ) {
                  messages.push(
                    `Nama PIC tidak sesuai User Master. Seharusnya ${picUser.name}`
                  );

                  status =
                    'ERROR';
                }

                if (
                  inputUnit &&
                  normalizeComparableText(
                    inputUnit
                  ) !==
                    normalizeComparableText(
                      picUser.unit
                    )
                ) {
                  messages.push(
                    `Unit PIC tidak sesuai User Master. Seharusnya ${picUser.unit}`
                  );

                  status =
                    'ERROR';
                }

                if (
                  inputDepartment &&
                  normalizeComparableText(
                    inputDepartment
                  ) !==
                    normalizeComparableText(
                      picUser.department
                    )
                ) {
                  messages.push(
                    `Department PIC tidak sesuai User Master. Seharusnya ${picUser.department}`
                  );

                  status =
                    'ERROR';
                }
              }

              const product =
                products.find(
                  item =>
                    normalizeComparableText(
                      item.productName
                    ) ===
                      normalizeComparableText(
                        productName
                      ) &&
                    item.status ===
                      'Active'
                );

              if (!product) {
                messages.push(
                  `Produk '${productName}' tidak terdaftar atau tidak aktif dalam Master Produk`
                );

                status =
                  'ERROR';
              } else {
                if (
                  product.insuranceType !==
                  insuranceType
                ) {
                  messages.push(
                    `Jenis Asuransi tidak sesuai dengan Master Produk ${product.productName}`
                  );

                  status =
                    'ERROR';
                }

                if (
                  product.customerCategory !==
                  customerCategory
                ) {
                  messages.push(
                    `Kategori Nasabah tidak sesuai dengan Master Produk ${product.productName}`
                  );

                  status =
                    'ERROR';
                }
              }

              if (
                !customerName ||
                customerName.length < 3
              ) {
                messages.push(
                  'Nama Calon Nasabah tidak boleh kosong'
                );

                status =
                  'ERROR';
              }

              if (
                estimatedPremium <= 0
              ) {
                messages.push(
                  'Estimasi Premi harus bernilai positif'
                );

                status =
                  'ERROR';
              }

              if (
                !targetClosingDate
              ) {
                messages.push(
                  'Target Closing wajib diisi'
                );

                status =
                  'ERROR';
              }

              const validChannels = [
                'Direct Selling',
                'Agent',
                'Broker',
                'BUSB',
              ];

              if (
                !validChannels.includes(
                  channel
                )
              ) {
                messages.push(
                  'Distribution Channel tidak valid'
                );

                status =
                  'ERROR';
              }

              const normalizedCustomer =
                normalizeCustomerIdentity(
                  customerName
                );

              const normalizedProduct =
                normalizeComparableText(
                  productName
                );

              let duplicateStatus:
                | 'CLEAR'
                | 'REVIEW'
                | 'BLOCK' =
                'CLEAR';

              let duplicateSummary =
                'Tidak ditemukan indikasi duplikasi';

              // ------------------------------------------------
              // A. BLOCKING DUPLICATE - FILE YANG SAMA
              // Governance key:
              // Tahun + normalized customer + product.
              // PIC tidak menjadi pembeda karena satu opportunity
              // tidak boleh dimiliki oleh dua Marketing berbeda.
              // ------------------------------------------------

              const exactFileDuplicates =
                duplicateCandidatesFromFile.filter(
                  candidate =>
                    candidate.rowNum !==
                      index + 1 &&
                    normalizeCustomerIdentity(
                      candidate.customerName
                    ) ===
                      normalizedCustomer &&
                    normalizeComparableText(
                      candidate.productName
                    ) ===
                      normalizedProduct
                );

              if (
                normalizedCustomer &&
                normalizedProduct &&
                exactFileDuplicates.length >
                  0
              ) {
                const firstDuplicate =
                  exactFileDuplicates[0];

                const otherPic =
                  users.find(
                    user =>
                      normalizeUserId(
                        user.id
                      ) ===
                      firstDuplicate.picUserId
                  );

                const currentPicName =
                  picUser?.name ||
                  inputPicName ||
                  picUserId;

                const otherPicName =
                  otherPic?.name ||
                  firstDuplicate.picName ||
                  firstDuplicate.picUserId;

                messages.push(
                  `DUPLIKAT BLOCKING: Row ${index + 1} memiliki kombinasi Calon Nasabah + Produk yang sama dengan Row ${firstDuplicate.rowNum}. PIC saat ini: ${currentPicName}; PIC pembanding: ${otherPicName}. Satu opportunity pada tahun yang sama hanya boleh memiliki satu PIC Marketing.`
                );

                duplicateStatus =
                  'BLOCK';

                duplicateSummary =
                  `Duplikat exact dengan Row ${firstDuplicate.rowNum}`;

                status =
                  'ERROR';
              }

              // ------------------------------------------------
              // B. BLOCKING DUPLICATE - PIPELINE EXISTING
              // Hanya record pada tahun yang sama.
              // WIN/LOSE tetap dianggap existing opportunity;
              // reopening LOSE harus melalui proses reopening,
              // bukan membuat pipeline bulk baru.
              // ------------------------------------------------

              const exactExistingPipeline =
                existingPipelines.find(
                  pipeline => {
                    const recordYear =
                      extractRecordYear(
                        pipeline.id,
                        pipeline.currentTargetClosingDate ||
                          pipeline.originalTargetClosingDate
                      );

                    return (
                      recordYear ===
                        selectedBulkYear &&
                      normalizeCustomerIdentity(
                        pipeline.customerName
                      ) ===
                        normalizedCustomer &&
                      normalizeComparableText(
                        pipeline.productName
                      ) ===
                        normalizedProduct
                    );
                  }
                );

              if (
                exactExistingPipeline
              ) {
                messages.push(
                  `DUPLIKAT BLOCKING: Kombinasi Calon Nasabah + Produk sudah terdaftar pada Pipeline ${exactExistingPipeline.id} dengan PIC ${exactExistingPipeline.picName}. Pipeline existing berstatus ${exactExistingPipeline.status}.`
                );

                duplicateStatus =
                  'BLOCK';

                duplicateSummary =
                  `Sudah ada di ${exactExistingPipeline.id}`;

                status =
                  'ERROR';
              }

              // ------------------------------------------------
              // C. BLOCKING DUPLICATE - BOOKING EXISTING
              // Booking Rejected tidak mengunci opportunity.
              // ------------------------------------------------

              const exactExistingBooking =
                !exactExistingPipeline
                  ? existingBookings.find(
                      booking => {
                        const recordYear =
                          extractRecordYear(
                            booking.id,
                            (booking as any)
                              .targetClosingDate
                          );

                        return (
                          recordYear ===
                            selectedBulkYear &&
                          String(
                            (booking as any)
                              .status ||
                              ''
                          ).toLowerCase() !==
                            'rejected' &&
                          normalizeCustomerIdentity(
                            booking.customerName
                          ) ===
                            normalizedCustomer &&
                          normalizeComparableText(
                            booking.productName
                          ) ===
                            normalizedProduct
                        );
                      }
                    )
                  : undefined;

              if (
                exactExistingBooking
              ) {
                messages.push(
                  `DUPLIKAT BLOCKING: Kombinasi Calon Nasabah + Produk sudah terdapat pada Booking Case ${exactExistingBooking.id} dengan PIC ${exactExistingBooking.picName}.`
                );

                duplicateStatus =
                  'BLOCK';

                duplicateSummary =
                  `Sudah ada di ${exactExistingBooking.id}`;

                status =
                  'ERROR';
              }

              // ------------------------------------------------
              // D. POTENTIAL DUPLICATE - FUZZY CUSTOMER NAME
              // Tidak blocking. Hanya REVIEW karena similarity
              // tidak cukup kuat untuk keputusan otomatis.
              // Product harus sama dan score nama minimal 88%.
              // ------------------------------------------------

              if (
                duplicateStatus !==
                'BLOCK' &&
                normalizedCustomer &&
                normalizedProduct
              ) {
                const fuzzyCandidates: Array<{
                  source: string;
                  customerName: string;
                  picName: string;
                  score: number;
                }> = [];

                duplicateCandidatesFromFile.forEach(
                  candidate => {
                    if (
                      candidate.rowNum ===
                        index + 1 ||
                      normalizeComparableText(
                        candidate.productName
                      ) !==
                        normalizedProduct ||
                      normalizeCustomerIdentity(
                        candidate.customerName
                      ) ===
                        normalizedCustomer
                    ) {
                      return;
                    }

                    const score =
                      calculateCustomerSimilarity(
                        customerName,
                        candidate.customerName
                      );

                    if (
                      score >= 0.88
                    ) {
                      fuzzyCandidates.push({
                        source:
                          `Row ${candidate.rowNum}`,
                        customerName:
                          candidate.customerName,
                        picName:
                          users.find(
                            user =>
                              normalizeUserId(
                                user.id
                              ) ===
                                candidate.picUserId
                          )?.name ||
                          candidate.picName ||
                          candidate.picUserId,
                        score,
                      });
                    }
                  }
                );

                existingPipelines.forEach(
                  pipeline => {
                    const recordYear =
                      extractRecordYear(
                        pipeline.id,
                        pipeline.currentTargetClosingDate ||
                          pipeline.originalTargetClosingDate
                      );

                    if (
                      recordYear !==
                        selectedBulkYear ||
                      normalizeComparableText(
                        pipeline.productName
                      ) !==
                        normalizedProduct ||
                      normalizeCustomerIdentity(
                        pipeline.customerName
                      ) ===
                        normalizedCustomer
                    ) {
                      return;
                    }

                    const score =
                      calculateCustomerSimilarity(
                        customerName,
                        pipeline.customerName
                      );

                    if (
                      score >= 0.88
                    ) {
                      fuzzyCandidates.push({
                        source:
                          `Pipeline ${pipeline.id}`,
                        customerName:
                          pipeline.customerName,
                        picName:
                          pipeline.picName,
                        score,
                      });
                    }
                  }
                );

                existingBookings.forEach(
                  booking => {
                    const recordYear =
                      extractRecordYear(
                        booking.id,
                        (booking as any)
                          .targetClosingDate
                      );

                    if (
                      recordYear !==
                        selectedBulkYear ||
                      String(
                        (booking as any)
                          .status ||
                          ''
                      ).toLowerCase() ===
                        'rejected' ||
                      normalizeComparableText(
                        booking.productName
                      ) !==
                        normalizedProduct ||
                      normalizeCustomerIdentity(
                        booking.customerName
                      ) ===
                        normalizedCustomer
                    ) {
                      return;
                    }

                    const score =
                      calculateCustomerSimilarity(
                        customerName,
                        booking.customerName
                      );

                    if (
                      score >= 0.88
                    ) {
                      fuzzyCandidates.push({
                        source:
                          `Booking ${booking.id}`,
                        customerName:
                          booking.customerName,
                        picName:
                          booking.picName,
                        score,
                      });
                    }
                  }
                );

                const bestFuzzyMatch =
                  fuzzyCandidates.sort(
                    (
                      first,
                      second
                    ) =>
                      second.score -
                      first.score
                  )[0];

                if (
                  bestFuzzyMatch
                ) {
                  const similarityPct =
                    (
                      bestFuzzyMatch.score *
                      100
                    ).toFixed(1);

                  messages.push(
                    `REVIEW DUPLIKASI: Nama calon nasabah memiliki kemiripan ${similarityPct}% dengan ${bestFuzzyMatch.source} (${bestFuzzyMatch.customerName}) pada produk yang sama. PIC pembanding: ${bestFuzzyMatch.picName}. Mohon verifikasi manual sebelum publish.`
                  );

                  duplicateStatus =
                    'REVIEW';

                  duplicateSummary =
                    `${similarityPct}% mirip dengan ${bestFuzzyMatch.source}`;

                  if (
                    status !==
                    'ERROR'
                  ) {
                    status =
                      'WARNING';
                  }
                }
              }

              return {
                rowNum:
                  index + 1,

                year,

                businessType,

                insuranceType,

                customerCategory,

                productName:
                  product
                    ? product.productName
                    : productName,

                productId:
                  product
                    ? product.id
                    : '',

                customerName,

                estimatedPremium,

                pipelineMonth,

                targetClosingDate,

                isTender,

                channel,

                picUserId:
                  picUser
                    ? picUser.id
                    : picUserId,

                picName:
                  picUser
                    ? picUser.name
                    : inputPicName,

                unit:
                  picUser
                    ? picUser.unit
                    : inputUnit,

                department:
                  picUser
                    ? picUser.department
                    : inputDepartment,

                notes,

                existingPolicyNumber:
                  getRowValue(
                    row,
                    'Existing Policy Number'
                  ),

                duplicateStatus,

                duplicateSummary,

                status,

                messages,
              };
            }
          );

        setBulkValidationRows(
          validationList
        );

        setBulkValidationExecuted(
          true
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Gagal membaca file CSV Bulk Pipeline.';

        alert(message);
      }
    };

  const hasBulkBlockingErrors =
    bulkValidationRows.some(
      row =>
        row.status ===
        'ERROR'
    );

  const handlePublishBulkPipeline =
    () => {
      if (
        hasBulkBlockingErrors
      ) {
        alert(
          'Tidak dapat mempublikasikan Bulk Pipeline karena terdapat error validasi.'
        );

        return;
      }

      const validRows =
        bulkValidationRows.filter(
          row =>
            row.status !==
            'ERROR'
        );

      if (
        validRows.length === 0
      ) {
        alert(
          'Tidak ada baris valid untuk dipublikasikan.'
        );

        return;
      }

      if (
        !confirm(
          `Konfirmasi Publish ${validRows.length} Bulk Pipeline RKAP Tahun ${selectedBulkYear}?`
        )
      ) {
        return;
      }

      validRows.forEach(
        (row, index) => {
          const pipelineId =
            `PL-${row.year}-${Math.floor(
              10000 +
                Math.random() *
                  90000 +
                index
            )}`;

          const newPipeline:
            Pipeline & {
              pipelineYear: number;
              pipelineMonth: number;
            } = {
              id:
                pipelineId,

              pipelineYear:
                row.year,

              pipelineMonth:
                row.pipelineMonth,

              source:
                'RKAP_BULK',

              businessType:
                row.businessType,

              customerName:
                row.customerName,

              insuranceType:
                row.insuranceType,

              customerCategory:
                row.customerCategory,

              productId:
                row.productId,

              productName:
                row.productName,

              estimatedPremium:
                row.estimatedPremium,

              currentCommercialValue:
                row.estimatedPremium,

              originalTargetClosingDate:
                row.targetClosingDate,

              currentTargetClosingDate:
                row.targetClosingDate,

              isTender:
                row.isTender,

              channel:
                row.channel,

              picUserId:
                row.picUserId,

              picName:
                row.picName,

              unit:
                row.unit as any,

              department:
                row.department as any,

              status:
                'Menunggu Upload Dokumen Marketing',

              currentHandler:
                'MARKETING',

              lastProgressAt:
                new Date().toISOString(),

              dayLapse:
                0,

              existingPolicyNumber:
                row.existingPolicyNumber,

              documents:
                [],

              quotations:
                [],

              createdAt:
                new Date().toISOString(),

              createdBy:
                currentUser.name,
            };

          store.addPipeline(
            newPipeline
          );
        }
      );

      setBulkFile(
        null
      );

      setBulkValidationExecuted(
        false
      );

      setBulkValidationRows(
        []
      );

      alert(
        `Berhasil mempublikasikan ${validRows.length} Pipeline RKAP secara terpusat!`
      );
    };

  // ============================================================
  // MARKETING VIEW — TARGET KINERJA / PERFORMANCE COCKPIT
  // ============================================================

  if (
    isMarketingTargetUser
  ) {
    return (
      <AppLayout>

        <div className="space-y-6">

          {/* HEADER */}

          <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">

            <div>

              <div className="flex items-center gap-2">

                <TargetIcon className="h-5 w-5 text-blue-600" />

                <h1 className="text-xl font-bold text-gray-900">
                  Target Kinerja
                </h1>

                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700"
                >
                  READ ONLY
                </Badge>

              </div>

              <p className="mt-1 text-xs text-gray-500">
                Target vs Realisasi Produksi, WIN yang belum menjadi produksi, Active Pipeline, dan forecast pencapaian dalam scope hierarchy user login.
              </p>

            </div>

            <div className="flex flex-wrap items-center gap-2">

              <Select
                value={
                  String(
                    selectedTargetYear
                  )
                }
                onValueChange={
                  value =>
                    setSelectedTargetYear(
                      Number(value)
                    )
                }
              >

                <SelectTrigger className="h-9 w-28 bg-white text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="2026">
                    2026
                  </SelectItem>

                  <SelectItem value="2027">
                    2027
                  </SelectItem>

                </SelectContent>

              </Select>

              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 text-[10px] font-bold">

                <button
                  type="button"
                  onClick={() =>
                    setReadonlyBusinessFilter(
                      'OVERALL'
                    )
                  }
                  className={`rounded-md px-2.5 py-1.5 transition-all ${
                    readonlyBusinessFilter ===
                    'OVERALL'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  OVERALL
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReadonlyBusinessFilter(
                      'New Business'
                    )
                  }
                  className={`rounded-md px-2.5 py-1.5 transition-all ${
                    readonlyBusinessFilter ===
                    'New Business'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  NEW BUSINESS
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReadonlyBusinessFilter(
                      'Renewal Business'
                    )
                  }
                  className={`rounded-md px-2.5 py-1.5 transition-all ${
                    readonlyBusinessFilter ===
                    'Renewal Business'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  RENEWAL
                </button>

              </div>

            </div>

          </div>

          {!currentTarget ? (

            <Card className="border-amber-200 bg-amber-50/40">

              <CardContent className="p-8 text-center">

                <AlertCircle className="mx-auto h-7 w-7 text-amber-600" />

                <div className="mt-2 text-sm font-bold text-amber-900">
                  Target {selectedTargetYear} belum tersedia
                </div>

                <p className="mt-1 text-xs text-amber-700">
                  Target Kinerja akan tampil setelah Target RKAP tahun {selectedTargetYear} dipublikasikan oleh Team Leader Marketing Support.
                </p>

              </CardContent>

            </Card>

          ) : (

            <>

              {/* PERFORMANCE KPI */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

                <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-blue-700">

                      <span>
                        Target {targetScopeLabel}
                      </span>

                      <TargetIcon className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="whitespace-nowrap text-[clamp(17px,1.7vw,24px)] leading-none font-black tracking-[-0.03em] text-blue-950">
                      {formatRupiah(
                        annualScopeTarget
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">

                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-white text-blue-700"
                      >
                        Pribadi {formatCompactRupiah(personalScopeTarget)}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-white text-blue-700"
                      >
                        Bawahan {formatCompactRupiah(subordinateScopeTarget)}
                      </Badge>

                    </div>

                  </CardContent>

                </Card>

                <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-emerald-700">

                      <span>
                        Realisasi Produksi
                      </span>

                      <TrendingUp className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="whitespace-nowrap text-[clamp(17px,1.7vw,24px)] leading-none font-black tracking-[-0.03em] text-emerald-950">
                      {formatRupiah(
                        realizedProduction
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-bold text-emerald-700">
                      Achievement {achievementPercentage.toFixed(1)}%
                    </p>

                  </CardContent>

                </Card>

                <Card className="border-cyan-200 bg-gradient-to-br from-cyan-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-cyan-700">

                      <span>
                        WIN Belum Produksi
                      </span>

                      <Trophy className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="text-2xl font-black text-cyan-950">
                      {formatRupiah(
                        winPendingValue
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-medium text-cyan-700">
                      {winPendingProduction.length} case WIN belum memiliki Realisasi Produksi
                    </p>

                  </CardContent>

                </Card>

                <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-violet-700">

                      <span>
                        Active Pipeline
                      </span>

                      <Briefcase className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="whitespace-nowrap text-[clamp(17px,1.7vw,24px)] leading-none font-black tracking-[-0.03em] text-violet-950">
                      {formatRupiah(
                        activePipelineValue
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-medium text-violet-700">
                      {activePipelines.length} pipeline aktif dengan target closing {selectedTargetYear}
                    </p>

                  </CardContent>

                </Card>

                <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-rose-700">

                      <span>
                        Gap ke Target
                      </span>

                      <AlertCircle className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="text-2xl font-black text-rose-950">
                      {formatRupiah(
                        performanceGap
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-medium text-rose-700">
                      Sisa target setelah Realisasi Produksi
                    </p>

                  </CardContent>

                </Card>

                <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-white shadow-sm">

                  <CardHeader className="pb-1 pt-4">

                    <CardDescription className="flex items-center justify-between text-xs font-bold uppercase text-slate-700">

                      <span>
                        Potential Coverage
                      </span>

                      <BarChart3 className="h-4 w-4" />

                    </CardDescription>

                  </CardHeader>

                  <CardContent className="pb-4">

                    <div className="whitespace-nowrap text-[clamp(17px,1.7vw,24px)] leading-none font-black tracking-[-0.03em] text-slate-950">
                      {potentialCoveragePercentage.toFixed(1)}%
                    </div>

                    <p className="mt-1 text-[10px] font-medium text-slate-600">
                      Production + WIN belum produksi + Active Pipeline = {formatCompactRupiah(potentialValue)}
                    </p>

                  </CardContent>

                </Card>

              </div>

              {/* MONTHLY PERFORMANCE */}

              <Card className="border-gray-200">

                <CardHeader>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                    <div>

                      <CardTitle className="text-sm font-bold text-gray-900">
                        Monthly Target & Performance Outlook
                      </CardTitle>

                      <CardDescription className="mt-1 text-xs">
                        Target bulanan vs Realisasi Produksi, WIN belum produksi, dan Active Pipeline berdasarkan Bulan Pipeline. Data lama tetap menggunakan Current Target Closing Date sebagai fallback.
                      </CardDescription>

                    </div>

                    <div className="flex flex-wrap gap-2">

                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-700"
                      >
                        Distribusi Target {formatCompactRupiah(monthlyTargetTotal)}
                      </Badge>

                      <Badge
                        variant="outline"
                        className={
                          monthlyTargetMatchesAnnual
                            ? 'border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-700'
                        }
                      >
                        {monthlyTargetMatchesAnnual
                          ? 'Monthly = Annual ✓'
                          : 'Monthly ≠ Annual'}
                      </Badge>

                    </div>

                  </div>

                </CardHeader>

                <CardContent className="pt-2">

                  {!hasMonthlyTarget ? (

                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-6 text-center">

                      <AlertCircle className="mx-auto h-6 w-6 text-amber-600" />

                      <div className="mt-2 text-xs font-bold text-amber-900">
                        Distribusi target bulanan bernilai 0
                      </div>

                      <p className="mt-1 text-[10px] text-amber-700">
                        Sistem tidak akan membuat angka bulanan secara otomatis. Pastikan kolom Jan–Des pada Target RKAP sudah terisi dan ter-publish.
                      </p>

                    </div>

                  ) : (

                    <div className="h-[380px] w-full min-w-0">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >

                        <BarChart
                          data={
                            monthlyPerformanceData
                          }
                          margin={{
                            top: 16,
                            right: 16,
                            left: 8,
                            bottom: 12,
                          }}
                          barCategoryGap="20%"
                        >

                          <XAxis
                            dataKey="month"
                            interval={0}
                            tick={{
                              fontSize: 10,
                            }}
                          />

                          <YAxis
                            tick={{
                              fontSize: 10,
                            }}
                            tickFormatter={value =>
                              formatCompactRupiah(
                                Number(value)
                              )
                            }
                            width={60}
                          />

                          <Tooltip
                            content={
                              renderMonthlyPerformanceTooltip
                            }
                          />

                          <Legend
                            formatter={value =>
                              value ===
                              'target'
                                ? 'Target Bulanan'
                                : value ===
                                  'realisasi'
                                ? 'Realisasi Produksi'
                                : value ===
                                  'winPending'
                                ? 'WIN Belum Produksi'
                                : 'Active Pipeline'
                            }
                          />

                          <Bar
                            dataKey="target"
                            name="target"
                            fill="#2563eb"
                            radius={[
                              4,
                              4,
                              0,
                              0,
                            ]}
                            minPointSize={2}
                          />

                          <Bar
                            dataKey="realisasi"
                            name="realisasi"
                            fill="#059669"
                            radius={[
                              4,
                              4,
                              0,
                              0,
                            ]}
                            minPointSize={2}
                          />

                          <Bar
                            dataKey="winPending"
                            name="winPending"
                            fill="#0891b2"
                            radius={[
                              4,
                              4,
                              0,
                              0,
                            ]}
                            minPointSize={2}
                          />

                          <Bar
                            dataKey="pipeline"
                            name="pipeline"
                            fill="#7c3aed"
                            radius={[
                              4,
                              4,
                              0,
                              0,
                            ]}
                            minPointSize={2}
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>

                  )}

                </CardContent>

              </Card>

              {/* HIERARCHY BREAKDOWN */}

              <Card className="border-gray-200">

                <CardHeader>

                  <CardTitle className="text-sm font-bold text-gray-900">
                    Performance Breakdown
                  </CardTitle>

                  <CardDescription className="text-xs">
                    {directTargetChildren.length > 0
                      ? 'Perbandingan target dan outlook berdasarkan direct subordinate. Nilai manager mencakup subtree di bawahnya.'
                      : 'Detail performance pribadi karena user ini tidak memiliki subordinate target holder.'}
                  </CardDescription>

                </CardHeader>

                <CardContent>

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[1180px] text-left text-xs">

                      <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">

                        <tr>

                          <th className="p-3">
                            Nama / Scope
                          </th>

                          <th className="p-3">
                            Target
                          </th>

                          <th className="p-3">
                            Production
                          </th>

                          <th className="p-3">
                            WIN Belum Produksi
                          </th>

                          <th className="p-3">
                            Active Pipeline
                          </th>

                          <th className="p-3">
                            Achievement
                          </th>

                          <th className="p-3">
                            Potential Coverage
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {targetPerformanceRows.map(
                          row => (

                            <tr
                              key={
                                row.user.id
                              }
                              className="hover:bg-gray-50"
                            >

                              <td className="p-3">

                                <div className="font-bold text-gray-900">
                                  {row.user.name}
                                </div>

                                <div className="mt-0.5 text-[10px] text-gray-500">
                                  {row.user.position}
                                </div>

                              </td>

                              <td className="p-3 font-black text-blue-900">
                                {formatRupiah(
                                  row.target
                                )}
                              </td>

                              <td className="p-3 font-bold text-emerald-700">
                                {formatRupiah(
                                  row.production
                                )}
                              </td>

                              <td className="p-3 font-bold text-cyan-700">
                                {formatRupiah(
                                  row.winPending
                                )}
                              </td>

                              <td className="p-3 font-bold text-violet-700">
                                {formatRupiah(
                                  row.pipeline
                                )}
                              </td>

                              <td className="p-3">

                                <Badge
                                  variant="outline"
                                  className={
                                    row.achievement >=
                                    100
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                      : 'border-amber-200 bg-amber-50 text-amber-700'
                                  }
                                >
                                  {row.achievement.toFixed(1)}%
                                </Badge>

                              </td>

                              <td className="p-3">

                                <Badge
                                  variant="outline"
                                  className={
                                    row.forecast >=
                                    100
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                      : row.forecast >
                                        80
                                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                                      : 'border-rose-300 bg-rose-50 text-rose-700'
                                  }
                                >
                                  {row.forecast.toFixed(1)}%
                                </Badge>

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                </CardContent>

              </Card>

              {/* SOURCE / DEFINITION */}

              <div className="rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-[10px] text-blue-800">

                <span className="font-bold">
                  Definisi:
                </span>{' '}

                Realisasi menggunakan snapshot Official Production yang dipublish oleh Arianie. WIN Belum Produksi adalah pipeline WIN yang belum memiliki Realisasi Produksi. Active Pipeline mengecualikan WIN/LOSE. Potential Coverage = Production + WIN Belum Produksi + Active Pipeline.

                <span className="ml-1">
                  Target {selectedTargetYear} dipublikasikan oleh {currentTarget.publishedBy || 'Marketing Support'}
                  {currentTarget.publishedAt
                    ? ` pada ${new Date(
                        currentTarget.publishedAt
                      ).toLocaleString(
                        'id-ID'
                      )}`
                    : ''}.
                </span>

              </div>

            </>

          )}

        </div>

      </AppLayout>
    );
  }

  // ============================================================
  // NON-MARKETING / NON-TLMS DIRECT ACCESS
  // ============================================================

  if (
    !isTLMS
  ) {
    return (
      <AppLayout>

        <Card className="border-gray-200">

          <CardContent className="p-10 text-center">

            <AlertCircle className="mx-auto h-7 w-7 text-gray-400" />

            <div className="mt-2 text-sm font-bold text-gray-800">
              Menu Target & RKAP tidak tersedia untuk role ini
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Administrasi Target & RKAP hanya dapat dilakukan oleh Team Leader Marketing Support.
            </p>

          </CardContent>

        </Card>

      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">

          <div>

            <h1 className="text-xl font-bold text-gray-900">
              Target & RKAP Directorate Marketing
            </h1>

            <p className="text-xs text-gray-500 mt-1">
              Pengelolaan Target RKAP, Cascading Hierarchy Validation, dan Bulk Import Pipeline RKAP
            </p>

          </div>

          <ExcelExportButton
            data={
              targets.map(
                target => ({
                  Tahun:
                    target.year,

                  User:
                    target.userName,

                  Jabatan:
                    target.position,

                  Department:
                    target.department !==
                    'None'
                      ? target.department
                      : target.unit,

                  TargetTahunan:
                    target.annualTargetTotal,

                  TargetTahunanNB:
                    target.annualTargetNewBusiness,

                  TargetTahunanRN:
                    target.annualTargetRenewal,

                  TargetPribadi:
                    target.personalTargetTotal,

                  TargetPribadiNB:
                    target.personalTargetNewBusiness,

                  TargetPribadiRN:
                    target.personalTargetRenewal,
                })
              )
            }
            filename={`Master_Target_Published_${selectedTargetYear}`}
            label="Export Target Published"
          />

        </div>

        <Tabs
          defaultValue="targets"
          className="w-full"
        >

          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm grid grid-cols-2 w-full max-w-md">

            <TabsTrigger
              value="targets"
              className="text-xs font-bold"
            >
              Master Target RKAP
            </TabsTrigger>

            <TabsTrigger
              value="bulk"
              className="text-xs font-bold"
            >
              Bulk Pipeline RKAP
            </TabsTrigger>

          </TabsList>

          {/* ==================================================
              MASTER TARGET RKAP
          =================================================== */}

          <TabsContent
            value="targets"
            className="space-y-6 mt-4"
          >

            <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-white">

              <CardHeader className="pb-3">

                <div className="flex items-center justify-between">

                  <div className="flex items-center gap-2">

                    <FileSpreadsheet className="w-5 h-5 text-blue-600" />

                    <CardTitle className="text-sm font-bold text-gray-900">
                      Workflow Setup Target RKAP (Excel-Compatible CSV)
                    </CardTitle>

                  </div>

                  <Badge
                    variant="outline"
                    className="bg-blue-100 text-blue-800 text-[10px] font-bold"
                  >
                    Otoritas: Team Leader Marketing Support
                  </Badge>

                </div>

                <CardDescription className="text-xs">
                  Proses 6 Langkah: Pilih Tahun, Download Template CSV, Isi melalui Microsoft Excel, Upload CSV, Validasi Cascading, lalu Publish
                </CardDescription>

              </CardHeader>

              <CardContent className="space-y-4">

                {isTLMS ? (

                  <div className="space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-gray-200">

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Step 1: Pilih Tahun Target
                        </label>

                        <Select
                          value={
                            String(
                              selectedTargetYear
                            )
                          }
                          onValueChange={
                            value =>
                              setSelectedTargetYear(
                                Number(
                                  value
                                )
                              )
                          }
                        >

                          <SelectTrigger className="h-9 text-xs font-bold bg-white">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>

                            <SelectItem value="2026">
                              Tahun 2026
                            </SelectItem>

                            <SelectItem value="2027">
                              Tahun 2027
                            </SelectItem>

                          </SelectContent>

                        </Select>

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Step 2: Download Template
                        </label>

                        <Button
                          onClick={
                            handleDownloadTargetTemplate
                          }
                          variant="outline"
                          className="w-full h-9 text-xs font-bold border-blue-300 text-blue-800 hover:bg-blue-50 gap-1.5"
                        >

                          <Download className="w-4 h-4 text-blue-600" />

                          <span>
                            Download Template Target (.csv)
                          </span>

                        </Button>

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Step 3: Upload CSV Target
                        </label>

                        <Input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={
                            handleTargetFileChange
                          }
                          className="h-9 text-xs bg-white cursor-pointer"
                        />

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Step 4: Validasi File
                        </label>

                        <Button
                          onClick={
                            handleValidateTargetFile
                          }
                          disabled={
                            !targetFile
                          }
                          className="w-full h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        >

                          <ShieldCheck className="w-4 h-4" />

                          <span>
                            Validasi Cascading
                          </span>

                        </Button>

                      </div>

                    </div>

                    {targetFile && (

                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">

                        File dipilih: <span className="font-semibold">{targetFile.name}</span>

                      </div>

                    )}

                    {targetValidationExecuted && (

                      <Card className="border-indigo-200 bg-indigo-50/30">

                        <CardHeader className="pb-2">

                          <div className="flex items-center justify-between gap-3">

                            <CardTitle className="text-sm font-bold text-indigo-950">
                              Hasil Validasi Cascading & Spreadsheet Target {selectedTargetYear}
                            </CardTitle>

                            <Button
                              onClick={
                                handlePublishTarget
                              }
                              disabled={
                                hasTargetBlockingErrors
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                            >

                              <CheckCircle2 className="w-4 h-4" />

                              <span>
                                Publish Target RKAP {selectedTargetYear}
                              </span>

                            </Button>

                          </div>

                        </CardHeader>

                        <CardContent className="space-y-4">

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Target Direktur
                              </span>

                              <span className="text-sm font-black text-indigo-900">
                                {formatRupiah(
                                  directorTargetValue
                                )}
                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Total Target Holder
                              </span>

                              <span className="text-sm font-black text-indigo-900">
                                {targetValidationRows.length} User
                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Row Valid / Error
                              </span>

                              <span className="text-sm font-black text-indigo-900">

                                <span className="text-emerald-700">
                                  {targetValidationRows.filter(
                                    row =>
                                      row.isValid
                                  ).length} Valid
                                </span>

                                {' / '}

                                <span className="text-rose-700">
                                  {targetValidationRows.filter(
                                    row =>
                                      !row.isValid
                                  ).length} Error
                                </span>

                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Selisih Cascading
                              </span>

                              <span
                                className={`text-sm font-black ${
                                  cascadeDiffValue ===
                                  0
                                    ? 'text-emerald-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {formatRupiah(
                                  cascadeDiffValue
                                )}
                              </span>

                            </div>

                          </div>

                          <div className="overflow-x-auto max-h-72">

                            <table className="w-full text-left text-xs bg-white rounded-lg border border-gray-200">

                              <thead className="bg-gray-100 border-b border-gray-200 text-gray-600 uppercase text-[10px]">

                                <tr>

                                  <th className="p-2.5">
                                    User ID
                                  </th>

                                  <th className="p-2.5">
                                    Nama Pegawai
                                  </th>

                                  <th className="p-2.5">
                                    Target Tahunan
                                  </th>

                                  <th className="p-2.5">
                                    Tahunan NB
                                  </th>

                                  <th className="p-2.5">
                                    Tahunan RN
                                  </th>

                                  <th className="p-2.5">
                                    Target Pribadi
                                  </th>

                                  <th className="p-2.5">
                                    Pribadi NB
                                  </th>

                                  <th className="p-2.5">
                                    Pribadi RN
                                  </th>

                                  <th className="p-2.5">
                                    Target Bawahan
                                  </th>

                                  <th className="p-2.5">
                                    Sum Monthly NB
                                  </th>

                                  <th className="p-2.5">
                                    Sum Monthly RN
                                  </th>

                                  <th className="p-2.5">
                                    Status
                                  </th>

                                  <th className="p-2.5">
                                    Catatan Validasi
                                  </th>

                                </tr>

                              </thead>

                              <tbody className="divide-y divide-gray-100">

                                {targetValidationRows.map(
                                  row => (

                                    <tr
                                      key={
                                        row.userId
                                      }
                                      className={
                                        !row.isValid
                                          ? 'bg-rose-50/80'
                                          : 'hover:bg-gray-50'
                                      }
                                    >

                                      <td className="p-2.5 font-mono font-bold text-blue-700">
                                        {row.userId}
                                      </td>

                                      <td className="p-2.5 font-semibold text-gray-900">
                                        {row.userName}
                                      </td>

                                      <td className="p-2.5 font-bold text-gray-900">
                                        {formatRupiah(
                                          row.annualTargetTotal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-blue-700 font-semibold">
                                        {formatRupiah(
                                          row.annualTargetNewBusiness
                                        )}
                                      </td>

                                      <td className="p-2.5 text-violet-700 font-semibold">
                                        {formatRupiah(
                                          row.annualTargetRenewal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-emerald-800 font-semibold">
                                        {formatRupiah(
                                          row.personalTargetTotal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-blue-700">
                                        {formatRupiah(
                                          row.personalTargetNewBusiness
                                        )}
                                      </td>

                                      <td className="p-2.5 text-violet-700">
                                        {formatRupiah(
                                          row.personalTargetRenewal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-blue-800">
                                        {formatRupiah(
                                          row.subordinateTargetTotal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-blue-700">
                                        {formatRupiah(
                                          row.monthlyNewBusinessTotal
                                        )}
                                      </td>

                                      <td className="p-2.5 text-violet-700">
                                        {formatRupiah(
                                          row.monthlyRenewalTotal
                                        )}
                                      </td>

                                      <td className="p-2.5">

                                        {row.isValid ? (

                                          <Badge
                                            variant="outline"
                                            className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"
                                          >
                                            VALID
                                          </Badge>

                                        ) : (

                                          <Badge
                                            variant="outline"
                                            className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]"
                                          >
                                            ERROR
                                          </Badge>

                                        )}

                                      </td>

                                      <td className="p-2.5 text-[11px] text-gray-600">

                                        {row.messages.length ===
                                        0
                                          ? 'Cascading & Bulanan Balance'
                                          : row.messages.join(
                                              '; '
                                            )}

                                      </td>

                                    </tr>

                                  )
                                )}

                              </tbody>

                            </table>

                          </div>

                        </CardContent>

                      </Card>

                    )}

                  </div>

                ) : (

                  <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 font-medium">

                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />

                    <span>
                      Hanya Team Leader Marketing Support yang berwenang mempublikasikan Target RKAP.
                    </span>

                  </div>

                )}

              </CardContent>

            </Card>

            <Card className="border-gray-200">

              <CardHeader>

                <CardTitle className="text-sm font-bold">
                  Daftar Target RKAP Terpublikasi
                </CardTitle>

                <CardDescription className="text-xs">
                  Target Total, New Business, dan Renewal per Account Officer / Manager
                </CardDescription>

              </CardHeader>

              <CardContent>

                {targets.length ===
                0 ? (

                  <div className="p-12 text-center text-xs text-gray-400">
                    Belum ada Target RKAP terpublikasi untuk tahun ini.
                  </div>

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full text-left text-xs">

                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">

                        <tr>

                          <th className="p-3">
                            Nama Pegawai
                          </th>

                          <th className="p-3">
                            Jabatan
                          </th>

                          <th className="p-3">
                            Unit / Dept
                          </th>

                          <th className="p-3">
                            Target Pribadi
                          </th>

                          <th className="p-3">
                            Pribadi NB
                          </th>

                          <th className="p-3">
                            Pribadi RN
                          </th>

                          <th className="p-3">
                            Target Tahunan
                          </th>

                          <th className="p-3">
                            Tahunan NB
                          </th>

                          <th className="p-3">
                            Tahunan RN
                          </th>

                          <th className="p-3">
                            Status
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {targets.map(
                          target => (

                            <tr
                              key={
                                target.id
                              }
                              className="hover:bg-gray-50"
                            >

                              <td className="p-3 font-semibold text-gray-900">
                                {target.userName}
                              </td>

                              <td className="p-3 text-gray-600">
                                {target.position}
                              </td>

                              <td className="p-3 text-gray-600">
                                {target.department !==
                                'None'
                                  ? target.department
                                  : target.unit}
                              </td>

                              <td className="p-3 font-medium text-emerald-700">
                                {formatRupiah(
                                  target.personalTargetTotal
                                )}
                              </td>

                              <td className="p-3 text-blue-700">
                                {formatRupiah(
                                  target.personalTargetNewBusiness
                                )}
                              </td>

                              <td className="p-3 text-violet-700">
                                {formatRupiah(
                                  target.personalTargetRenewal
                                )}
                              </td>

                              <td className="p-3 font-bold text-gray-900">
                                {formatRupiah(
                                  target.annualTargetTotal
                                )}
                              </td>

                              <td className="p-3 text-blue-700">
                                {formatRupiah(
                                  target.annualTargetNewBusiness
                                )}
                              </td>

                              <td className="p-3 text-violet-700">
                                {formatRupiah(
                                  target.annualTargetRenewal
                                )}
                              </td>

                              <td className="p-3">

                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                                >
                                  Published
                                </Badge>

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              BULK PIPELINE RKAP
          =================================================== */}

          <TabsContent
            value="bulk"
            className="space-y-6 mt-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <CardTitle className="text-sm font-bold">
                  Import Bulk Pipeline RKAP Terpusat
                </CardTitle>

                <CardDescription className="text-xs">
                  Pipeline yang telah disepakati saat RKAP dipublikasikan serentak tanpa melalui Booking Case
                </CardDescription>

              </CardHeader>

              <CardContent className="space-y-4">

                {isTLMS ? (

                  <div className="space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-white p-4 rounded-xl border border-gray-200">

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Tahun Bulk Pipeline
                        </label>

                        <Select
                          value={
                            String(
                              selectedBulkYear
                            )
                          }
                          onValueChange={
                            value =>
                              setSelectedBulkYear(
                                Number(
                                  value
                                )
                              )
                          }
                        >

                          <SelectTrigger className="h-9 text-xs font-bold bg-white">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent>

                            <SelectItem value="2026">
                              Tahun 2026
                            </SelectItem>

                            <SelectItem value="2027">
                              Tahun 2027
                            </SelectItem>

                          </SelectContent>

                        </Select>

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Template Bulk Pipeline
                        </label>

                        <Button
                          onClick={
                            handleDownloadBulkPipelineTemplate
                          }
                          variant="outline"
                          className="w-full h-9 text-xs font-bold border-blue-300 text-blue-800 hover:bg-blue-50 gap-1.5"
                        >

                          <Download className="w-4 h-4 text-blue-600" />

                          <span>
                            Download Template (.csv)
                          </span>

                        </Button>

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Upload CSV Pipeline
                        </label>

                        <Input
                          type="file"
                          accept=".csv,text/csv"
                          onChange={
                            handleBulkFileChange
                          }
                          className="h-9 text-xs bg-white cursor-pointer"
                        />

                      </div>

                      <div>

                        <label className="text-[11px] font-bold text-gray-700 block mb-1">
                          Validasi & Check
                        </label>

                        <Button
                          onClick={
                            handleValidateBulkFile
                          }
                          disabled={
                            !bulkFile
                          }
                          className="w-full h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                        >

                          <ShieldCheck className="w-4 h-4" />

                          <span>
                            Validasi File
                          </span>

                        </Button>

                      </div>

                    </div>

                    {bulkFile && (

                      <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">

                        File dipilih: <span className="font-semibold">{bulkFile.name}</span>

                      </div>

                    )}

                    {bulkValidationExecuted && (

                      <Card className="border-indigo-200 bg-indigo-50/30">

                        <CardHeader className="pb-2">

                          <div className="flex items-center justify-between gap-3">

                            <CardTitle className="text-sm font-bold text-indigo-950">
                              Preview Validasi Bulk Pipeline {selectedBulkYear}
                            </CardTitle>

                            <Button
                              onClick={
                                handlePublishBulkPipeline
                              }
                              disabled={
                                hasBulkBlockingErrors
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                            >

                              <CheckCircle2 className="w-4 h-4" />

                              <span>
                                Publish Bulk Pipeline
                              </span>

                            </Button>

                          </div>

                        </CardHeader>

                        <CardContent className="space-y-3">

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Total Row
                              </span>

                              <span className="text-sm font-black text-indigo-900">
                                {bulkValidationRows.length}
                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Valid
                              </span>

                              <span className="text-sm font-black text-emerald-700">
                                {bulkValidationRows.filter(
                                  row =>
                                    row.status ===
                                    'VALID'
                                ).length}
                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Warning
                              </span>

                              <span className="text-sm font-black text-amber-700">
                                {bulkValidationRows.filter(
                                  row =>
                                    row.status ===
                                    'WARNING'
                                ).length}
                              </span>

                            </div>

                            <div className="p-3 bg-white rounded-lg border border-indigo-100">

                              <span className="text-[10px] text-gray-500 uppercase block font-semibold">
                                Error
                              </span>

                              <span className="text-sm font-black text-rose-700">
                                {bulkValidationRows.filter(
                                  row =>
                                    row.status ===
                                    'ERROR'
                                ).length}
                              </span>

                            </div>

                          </div>

                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                            <span className="font-bold">Duplicate Governance:</span>{' '}
                            <span className="font-semibold text-rose-700">BLOCK</span> jika Tahun + Calon Nasabah ter-normalisasi + Produk sama persis, baik di file upload maupun data existing.{' '}
                            <span className="font-semibold text-amber-700">REVIEW</span> jika produk sama dan kemiripan nama nasabah minimal 88%. REVIEW tidak otomatis memblokir publish; BLOCK selalu memblokir.
                          </div>

                          <div className="overflow-x-auto max-h-72">

                            <table className="w-full text-left text-xs bg-white rounded-lg border border-gray-200">

                              <thead className="bg-gray-100 border-b border-gray-200 text-gray-600 uppercase text-[10px]">

                                <tr>

                                  <th className="p-2.5">
                                    Row
                                  </th>

                                  <th className="p-2.5">
                                    Calon Nasabah
                                  </th>

                                  <th className="p-2.5">
                                    Jenis Bisnis
                                  </th>

                                  <th className="p-2.5">
                                    Produk
                                  </th>

                                  <th className="p-2.5">
                                    Estimasi Premi
                                  </th>

                                  <th className="p-2.5">
                                    PIC Marketing
                                  </th>

                                  <th className="p-2.5">
                                    Duplicate Check
                                  </th>

                                  <th className="p-2.5">
                                    Status
                                  </th>

                                  <th className="p-2.5">
                                    Pesan Validasi
                                  </th>

                                </tr>

                              </thead>

                              <tbody className="divide-y divide-gray-100">

                                {bulkValidationRows.map(
                                  row => (

                                    <tr
                                      key={
                                        row.rowNum
                                      }
                                      className={
                                        row.status ===
                                        'ERROR'
                                          ? 'bg-rose-50/80'
                                          : row.status ===
                                            'WARNING'
                                          ? 'bg-amber-50/80'
                                          : 'hover:bg-gray-50'
                                      }
                                    >

                                      <td className="p-2.5 font-mono font-bold text-gray-600">
                                        {row.rowNum}
                                      </td>

                                      <td className="p-2.5 font-semibold text-gray-900">
                                        {row.customerName}
                                      </td>

                                      <td className="p-2.5 text-gray-700">
                                        {row.businessType}
                                      </td>

                                      <td className="p-2.5 text-gray-700">
                                        {row.productName}
                                      </td>

                                      <td className="p-2.5 font-bold text-gray-900">
                                        {formatRupiah(
                                          row.estimatedPremium
                                        )}
                                      </td>

                                      <td className="p-2.5 text-gray-700">
                                        {row.picName}
                                      </td>

                                      <td className="p-2.5 min-w-[180px]">

                                        {row.duplicateStatus ===
                                          'CLEAR' && (

                                          <div className="space-y-1">

                                            <Badge
                                              variant="outline"
                                              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px]"
                                            >
                                              CLEAR
                                            </Badge>

                                            <div className="text-[10px] text-gray-500">
                                              {row.duplicateSummary}
                                            </div>

                                          </div>

                                        )}

                                        {row.duplicateStatus ===
                                          'REVIEW' && (

                                          <div className="space-y-1">

                                            <Badge
                                              variant="outline"
                                              className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]"
                                            >
                                              REVIEW
                                            </Badge>

                                            <div className="text-[10px] text-amber-700">
                                              {row.duplicateSummary}
                                            </div>

                                          </div>

                                        )}

                                        {row.duplicateStatus ===
                                          'BLOCK' && (

                                          <div className="space-y-1">

                                            <Badge
                                              variant="outline"
                                              className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]"
                                            >
                                              BLOCK
                                            </Badge>

                                            <div className="text-[10px] text-rose-700">
                                              {row.duplicateSummary}
                                            </div>

                                          </div>

                                        )}

                                      </td>

                                      <td className="p-2.5">

                                        {row.status ===
                                          'VALID' && (

                                          <Badge
                                            variant="outline"
                                            className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]"
                                          >
                                            VALID
                                          </Badge>

                                        )}

                                        {row.status ===
                                          'WARNING' && (

                                          <Badge
                                            variant="outline"
                                            className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]"
                                          >
                                            WARNING
                                          </Badge>

                                        )}

                                        {row.status ===
                                          'ERROR' && (

                                          <Badge
                                            variant="outline"
                                            className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]"
                                          >
                                            ERROR
                                          </Badge>

                                        )}

                                      </td>

                                      <td className="p-2.5 text-[11px] text-gray-600">

                                        {row.messages.length ===
                                        0
                                          ? 'Data Valid'
                                          : row.messages.join(
                                              '; '
                                            )}

                                      </td>

                                    </tr>

                                  )
                                )}

                              </tbody>

                            </table>

                          </div>

                        </CardContent>

                      </Card>

                    )}

                  </div>

                ) : (

                  <div className="text-xs text-gray-500 italic">
                    Belum ada Bulk Pipeline RKAP yang dipublikasikan untuk tahun ini.
                  </div>

                )}

              </CardContent>

            </Card>

          </TabsContent>

        </Tabs>

      </div>
    </AppLayout>
  );
};

export default TargetRkapPage;
