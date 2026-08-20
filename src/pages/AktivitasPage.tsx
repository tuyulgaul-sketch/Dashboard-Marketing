import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useSearchParams,
} from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { store } from '@/services/store';
import {
  Activity,
  ActivityComment,
  ActivityStatus,
  ActivityType,
  InteractionMethod,
  Pipeline,
  Reimbursement,
  ReimbursementType,
  User,
} from '@/types';
import {
  formatDate,
  formatRupiah,
} from '@/utils/formatters';
import {
  formatRupiahInput,
  sanitizeRupiahInput,
} from '@/utils/currencyInput';
import {
  deleteMarketingSupportFile,
  downloadMarketingSupportFile,
  saveMarketingSupportFile,
} from '@/services/marketingSupportFileStorage';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  ActionHistoryModal,
  ActionHistoryEntry,
} from '@/components/common/ActionHistoryModal';
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
  Briefcase,
  CheckCircle2,
  Download,
  History,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Link2,
  MessageSquare,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Users,
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

const ACTIVITY_TYPES: ActivityType[] = [
  'Meeting',
  'Presentation',
  'Site Visit',
  'Courtesy Call',
  'Tender Clarification',
  'Negotiation',
  'Other',
];

const INTERACTION_METHODS: InteractionMethod[] = [
  'In-Person / Offline',
  'Online Meeting',
  'Phone Call',
  'Email / Letter',
];

const ACTIVITY_STATUSES: ActivityStatus[] = [
  'Planned',
  'On Progress',
  'Completed',
  'Cancelled',
  'Rescheduled',
  'Overdue',
];

const FINAL_ACTIVITY_STATUSES =
  new Set<ActivityStatus>([
    'Completed',
    'Cancelled',
    'Rescheduled',
  ]);

const MARKETING_ROLES = new Set([
  'DIRECTOR_MARKETING',
  'ADVISOR_MARKETING_DIRECTOR',
  'VP_CAPTIVE_MARKETING',
  'VP_CORPORATE_RETAIL_MARKETING',
  'DEPARTMENT_HEAD_MARKETING',
  'SUPERVISOR_MARKETING',
  'STAFF_MARKETING',
]);

const MS_ROLES = new Set([
  'TEAM_LEADER_MARKETING_SUPPORT',
  'DEPARTMENT_HEAD_MARKETING_ADMINISTRATION',
  'SUPERVISOR_MARKETING_ADMINISTRATION',
  'STAFF_MARKETING_ADMINISTRATION',
  'DEPARTMENT_HEAD_MARKETING_COMMUNICATION',
  'STAFF_MARKETING_COMMUNICATION',
]);

const REIMBURSEMENT_TYPES:
  ReimbursementType[] = [
    'Konsumsi',
    'Transport / Taxi / Online Transport',
    'Toll',
    'Parking',
    'Fuel',
    'Accommodation',
    'Ticket',
    'Event Registration',
    'Representation / Business Meal',
    'Supporting Supplies',
    'Other',
  ];

const REIMBURSEMENT_MS_VERIFIER_IDS =
  new Set([
    'USR-000025',
    'USR-000026',
    'USR-000027',
    'USR-000029',
  ]);

const pad = (
  value: number
): string =>
  String(value).padStart(
    2,
    '0'
  );

const toDateKey = (
  date: Date
): string =>
  `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;

const formatMonthTitle = (
  date: Date
): string =>
  date.toLocaleDateString(
    'id-ID',
    {
      month: 'long',
      year: 'numeric',
    }
  );

const formatDayTitle = (
  dateKey: string
): string =>
  new Date(
    `${dateKey}T00:00:00`
  ).toLocaleDateString(
    'id-ID',
    {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  );

const formatBlockingDate = (
  dateKey: string
): string =>
  new Date(
    `${dateKey}T00:00:00`
  ).toLocaleDateString(
    'id-ID',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  );

const buildCalendarDays = (
  monthDate: Date
): Array<{
  key: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}> => {
  const year =
    monthDate.getFullYear();

  const month =
    monthDate.getMonth();

  const firstDay =
    new Date(
      year,
      month,
      1
    );

  // JS: Sunday 0. Calendar: Monday 0.
  const mondayIndex =
    (
      firstDay.getDay() +
      6
    ) %
    7;

  const gridStart =
    new Date(
      year,
      month,
      1 - mondayIndex
    );

  return Array.from(
    {
      length: 42,
    },
    (
      _,
      index
    ) => {
      const date =
        new Date(
          gridStart
        );

      date.setDate(
        gridStart.getDate() +
          index
      );

      return {
        key:
          toDateKey(date),
        dayNumber:
          date.getDate(),
        inCurrentMonth:
          date.getMonth() ===
          month,
      };
    }
  );
};

export const AktivitasPage: React.FC = () => {
  const [
    searchParams,
    setSearchParams,
  ] =
    useSearchParams();

  const initialTab =
    searchParams.get(
      'tab'
    ) ===
    'reimbursement'
      ? 'reimbursement'
      : searchParams.get(
          'tab'
        ) ===
        'list'
        ? 'list'
        : 'calendar';

  const [
    activeMainTab,
    setActiveMainTab,
  ] =
    useState(
      initialTab
    );

  const [
    currentUser,
    setCurrentUser,
  ] = useState<User>(
    store.getCurrentUser()
  );

  const [
    activities,
    setActivities,
  ] = useState<Activity[]>([]);

  const [
    comments,
    setComments,
  ] = useState<ActivityComment[]>([]);

  const [
    reimbursements,
    setReimbursements,
  ] = useState<Reimbursement[]>([]);

  const [
    reimbursementFormOpen,
    setReimbursementFormOpen,
  ] =
    useState(
      false
    );

  const [
    reimbursementActivityId,
    setReimbursementActivityId,
  ] =
    useState('');

  const [
    reimbursementType,
    setReimbursementType,
  ] =
    useState<
      ReimbursementType
    >(
      'Konsumsi'
    );

  const [
    reimbursementAmount,
    setReimbursementAmount,
  ] =
    useState('');

  const [
    reimbursementExpenseDate,
    setReimbursementExpenseDate,
  ] =
    useState(
      new Date()
        .toISOString()
        .split(
          'T'
        )[0]
    );

  const [
    reimbursementDescription,
    setReimbursementDescription,
  ] =
    useState('');

  const [
    reimbursementReceipt,
    setReimbursementReceipt,
  ] =
    useState<
      File | null
    >(
      null
    );

  const [
    reimbursementBusy,
    setReimbursementBusy,
  ] =
    useState(
      false
    );

  const [
    selectedReimbursementReview,
    setSelectedReimbursementReview,
  ] =
    useState<
      Reimbursement | null
    >(
      null
    );

  const [
    historyReimbursement,
    setHistoryReimbursement,
  ] =
    useState<
      Reimbursement | null
    >(
      null
    );

  const [
    reimbursementReviewNotes,
    setReimbursementReviewNotes,
  ] =
    useState('');

  const [
    reimbursementListFilter,
    setReimbursementListFilter,
  ] =
    useState<
      'ALL' |
      'MY' |
      'ACTION' |
      'APPROVED'
    >(
      'ALL'
    );

  const [
    users,
    setUsers,
  ] = useState<User[]>([]);

  const [
    pipelines,
    setPipelines,
  ] = useState<Pipeline[]>([]);

  // ============================================================
  // FILTER / CALENDAR STATE
  // ============================================================

  const [
    selectedScope,
    setSelectedScope,
  ] = useState<string>('ALL');

  const [
    selectedDepartment,
    setSelectedDepartment,
  ] = useState<string>('ALL');

  const [
    selectedPic,
    setSelectedPic,
  ] = useState<string>('ALL');

  const [
    selectedActivityType,
    setSelectedActivityType,
  ] = useState<string>('ALL');

  const [
    searchQuery,
    setSearchQuery,
  ] = useState('');

  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    )
  );

  const [
    selectedDayKey,
    setSelectedDayKey,
  ] = useState<
    string | null
  >(null);

  const [
    dayDetailOpen,
    setDayDetailOpen,
  ] = useState(false);

  const [
    selectedActivityDetail,
    setSelectedActivityDetail,
  ] = useState<
    Activity | null
  >(null);

  // ============================================================
  // ACTIVITY ENTRY POPUP STATE
  // ============================================================

  const [
    activityFormOpen,
    setActivityFormOpen,
  ] = useState(false);

  const [
    activityDate,
    setActivityDate,
  ] = useState(
    new Date()
      .toISOString()
      .split('T')[0]
  );

  const [
    startTime,
    setStartTime,
  ] = useState('09:00');

  const [
    endTime,
    setEndTime,
  ] = useState('11:00');

  const [
    activityType,
    setActivityType,
  ] = useState<ActivityType>(
    'Meeting'
  );

  const [
    interactionMethod,
    setInteractionMethod,
  ] = useState<InteractionMethod>(
    'In-Person / Offline'
  );

  const [
    activityStatus,
    setActivityStatus,
  ] = useState<ActivityStatus>(
    'Planned'
  );

  const [
    companyName,
    setCompanyName,
  ] = useState('');

  const [
    personMet,
    setPersonMet,
  ] = useState('');

  const [
    positionMet,
    setPositionMet,
  ] = useState('');

  const [
    location,
    setLocation,
  ] = useState('');

  const [
    purpose,
    setPurpose,
  ] = useState('');

  const [
    agenda,
    setAgenda,
  ] = useState('');

  const [
    result,
    setResult,
  ] = useState('');

  const [
    followUp,
    setFollowUp,
  ] = useState('');

  const [
    discussedProduct,
    setDiscussedProduct,
  ] = useState('');

  const [
    expenseAmount,
    setExpenseAmount,
  ] = useState('');

  const [
    relatedToPipeline,
    setRelatedToPipeline,
  ] = useState(false);

  const [
    relatedPipelineId,
    setRelatedPipelineId,
  ] = useState('');

  const [
    pipelineSearch,
    setPipelineSearch,
  ] = useState('');

  const [
    taggedUserIds,
    setTaggedUserIds,
  ] = useState<string[]>(
    []
  );

  const [
    inviteFunctionFilter,
    setInviteFunctionFilter,
  ] = useState<string>('ALL');

  const [
    inviteSearch,
    setInviteSearch,
  ] = useState('');

  const [
    commentTextMap,
    setCommentTextMap,
  ] = useState<
    Record<string, string>
  >({});

  const [
    commentHistoryOpen,
    setCommentHistoryOpen,
  ] = useState(false);

  const [
    commentReadMap,
    setCommentReadMap,
  ] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    const refresh = () => {
      const nextUser =
        store.getCurrentUser();

      setCurrentUser(
        nextUser
      );

      setActivities(
        store.getActivities()
      );

      setComments(
        store.getActivityComments()
      );

      setReimbursements(
        store.getReimbursements()
      );

      setUsers(
        store.getUsers()
      );

      setPipelines(
        store.getPipelines()
      );
    };

    refresh();

    return store.subscribe(
      refresh
    );
  }, []);

  useEffect(
    () => {
      const requestedTab =
        searchParams.get(
          'tab'
        );

      if (
        requestedTab ===
          'reimbursement' ||
        requestedTab ===
          'list' ||
        requestedTab ===
          'calendar'
      ) {
        setActiveMainTab(
          requestedTab
        );
      }

      const focusRmbId =
        searchParams.get(
          'rmbId'
        );

      if (
        focusRmbId
      ) {
        const target =
          store
            .getReimbursements()
            .find(
              item =>
                item.id ===
                focusRmbId
            );

        if (
          target
        ) {
          setActiveMainTab(
            'reimbursement'
          );

          window.setTimeout(
            () => {
              setSelectedReimbursementReview(
                target
              );

              setReimbursementReviewNotes('');
            },
            80
          );
        }
      }

      const requestedFilter =
        searchParams.get(
          'filter'
        );

      if (
        requestedFilter ===
          'ACTION'
      ) {
        setReimbursementListFilter(
          'ACTION'
        );
      }
    },
    [
      searchParams,
    ]
  );

  useEffect(() => {
    setSelectedScope(
      'ALL'
    );

    setSelectedDepartment(
      'ALL'
    );

    setSelectedPic(
      'ALL'
    );

    setSelectedActivityType(
      'ALL'
    );

    setSearchQuery('');

    setCommentHistoryOpen(
      false
    );

    try {
      const stored =
        localStorage.getItem(
          `pertalife_activity_comment_reads_${currentUser.id}`
        );

      setCommentReadMap(
        stored
          ? JSON.parse(
              stored
            )
          : {}
      );
    } catch {
      setCommentReadMap(
        {}
      );
    }
  }, [currentUser.id]);

  // ============================================================
  // HIERARCHY / VISIBILITY
  // ============================================================

  const activeUsers =
    users.filter(
      user =>
        user.status ===
        'Active'
    );

  const currentUserBroadVisibility =
    currentUser.role ===
      'SYSTEM_ADMIN' ||
    MS_ROLES.has(
      currentUser.role
    );

  const isMarketingUser =
    MARKETING_ROLES.has(
      currentUser.role
    );

  const isMarketingSupportUser =
    MS_ROLES.has(
      currentUser.role
    );

  const isMarketingAdministrationRmbVerifier =
    REIMBURSEMENT_MS_VERIFIER_IDS.has(
      currentUser.id
    );

  const isEndah =
    currentUser.id ===
    'USR-000028';

  const isArianie =
    currentUser.id ===
    'USR-000024';

  const canAccessReimbursementModule =
    isMarketingUser ||
    isMarketingSupportUser ||
    currentUser.role ===
      'SYSTEM_ADMIN';

  useEffect(
    () => {
      // User switching happens inside the same SPA session. Without resetting
      // this filter, a Marketing user's MY filter could remain active after
      // logging in as Marketing Support and make incoming reimbursements look empty.
      if (
        isMarketingSupportUser ||
        currentUser.role ===
          'SYSTEM_ADMIN'
      ) {
        setReimbursementListFilter(
          'ALL'
        );

        return;
      }

      if (
        isMarketingUser
      ) {
        const hasPendingSuperiorAction =
          store
            .getReimbursements()
            .some(
              reimbursement =>
                reimbursement.status ===
                  'Submitted' &&
                reimbursement.directSuperiorId ===
                  currentUser.id
            );

        setReimbursementListFilter(
          hasPendingSuperiorAction
            ? 'ACTION'
            : 'MY'
        );
      }
    },
    [
      currentUser.id,
      currentUser.role,
      isMarketingSupportUser,
      isMarketingUser,
    ]
  );

  const hierarchyOwnerIds =
    currentUserBroadVisibility
      ? activeUsers.map(
          user =>
            user.id
        )
      : store.getSubordinateUserIds(
          currentUser.id
        );

  const directScopeOptions =
    currentUserBroadVisibility
      ? activeUsers.filter(
          user =>
            MARKETING_ROLES.has(
              user.role
            ) &&
            (
              user.role ===
                'VP_CAPTIVE_MARKETING' ||
              user.role ===
                'VP_CORPORATE_RETAIL_MARKETING' ||
              user.role ===
                'ADVISOR_MARKETING_DIRECTOR'
            )
        )
      : activeUsers.filter(
          user =>
            user.superiorId ===
            currentUser.id
        );

  const scopedOwnerIds =
    selectedScope ===
    'ALL'
      ? hierarchyOwnerIds
      : store.getSubordinateUserIds(
          selectedScope
        );

  const scopedOwnerIdSet =
    new Set(
      scopedOwnerIds
    );

  const invitedActivities =
    activities.filter(
      activity =>
        activity.taggedUserIds?.includes(
          currentUser.id
        )
    );

  const baseVisibleActivities =
    activities.filter(
      activity =>
        scopedOwnerIdSet.has(
          activity.ownerUserId
        ) ||
        (
          selectedScope ===
            'ALL' &&
          activity.taggedUserIds?.includes(
            currentUser.id
          )
        )
    );

  const scopedUsers =
    activeUsers.filter(
      user =>
        scopedOwnerIdSet.has(
          user.id
        )
    );

  const departmentOptions =
    Array.from(
      new Set(
        scopedUsers
          .map(
            user =>
              user.department
          )
          .filter(
            value =>
              value &&
              value !==
                'None'
          )
      )
    ).sort();

  const picOptions =
    scopedUsers
      .filter(
        user =>
          selectedDepartment ===
            'ALL' ||
          user.department ===
            selectedDepartment
      )
      .sort(
        (
          first,
          second
        ) =>
          first.name.localeCompare(
            second.name
          )
      );

  const normalizedSearch =
    searchQuery
      .trim()
      .toLowerCase();

  const visibleActivities =
    baseVisibleActivities
      .filter(
        activity => {
          const matchDepartment =
            selectedDepartment ===
              'ALL' ||
            activity.department ===
              selectedDepartment;

          const matchPic =
            selectedPic ===
              'ALL' ||
            activity.ownerUserId ===
              selectedPic;

          const matchType =
            selectedActivityType ===
              'ALL' ||
            activity.activityType ===
              selectedActivityType;

          const linkedPipeline =
            activity.relatedPipelineId
              ? pipelines.find(
                  pipeline =>
                    pipeline.id ===
                    activity.relatedPipelineId
                )
              : undefined;

          const matchSearch =
            !normalizedSearch ||
            [
              activity.id,
              activity.companyName,
              activity.ownerName,
              activity.purpose,
              activity.discussedProduct,
              activity.relatedPipelineId,
              linkedPipeline?.productName,
            ].some(
              value =>
                String(
                  value || ''
                )
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
            );

          return (
            matchDepartment &&
            matchPic &&
            matchType &&
            matchSearch
          );
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          `${second.activityDate} ${second.startTime}`.localeCompare(
            `${first.activityDate} ${first.startTime}`
          )
      );

  // ============================================================
  // PIPELINE LINKING + COLLABORATOR SEARCH
  // ============================================================

  const activePipelines =
    pipelines
      .filter(
        pipeline =>
          pipeline.status !==
            'WIN' &&
          pipeline.status !==
            'LOSE' &&
          (
            store.isUserInScope(
              currentUser,
              pipeline.picUserId
            ) ||
            pipeline.picUserId ===
              currentUser.id
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          first.customerName.localeCompare(
            second.customerName
          )
      );

  const selectedPipeline =
    relatedPipelineId
      ? activePipelines.find(
          pipeline =>
            pipeline.id ===
            relatedPipelineId
        )
      : undefined;

  const normalizedPipelineSearch =
    pipelineSearch
      .trim()
      .toLowerCase();

  const pipelineSearchResults =
    normalizedPipelineSearch.length >=
    2
      ? activePipelines
          .filter(
            pipeline =>
              [
                pipeline.id,
                pipeline.customerName,
                pipeline.productName,
                pipeline.picName,
              ].some(
                value =>
                  String(
                    value || ''
                  )
                    .toLowerCase()
                    .includes(
                      normalizedPipelineSearch
                    )
              )
          )
          .slice(
            0,
            50
          )
      : [];

  const getUserFunctionLabel =
    (
      user: User
    ): string => {
      if (
        user.role ===
          'DIRECTOR_MARKETING' ||
        user.role ===
          'ADVISOR_MARKETING_DIRECTOR'
      ) {
        return 'Direktorat Marketing';
      }

      if (
        user.role ===
          'TEAM_LEADER_MARKETING_SUPPORT' ||
        user.role ===
          'SUPERVISOR_MARKETING_ADMINISTRATION' ||
        user.role ===
          'STAFF_MARKETING_ADMINISTRATION'
      ) {
        return 'Marketing Support';
      }

      if (
        user.role ===
          'VP_CAPTIVE_MARKETING' ||
        user.unit
          .toLowerCase()
          .includes(
            'captive'
          ) ||
        user.department
          .toLowerCase()
          .includes(
            'captive'
          )
      ) {
        return 'Captive Marketing';
      }

      if (
        user.role ===
          'VP_CORPORATE_RETAIL_MARKETING' ||
        user.unit
          .toLowerCase()
          .includes(
            'corporate'
          ) ||
        user.department
          .toLowerCase()
          .includes(
            'crm'
          ) ||
        user.department
          .toLowerCase()
          .includes(
            'corporate'
          )
      ) {
        return 'Corporate & Retail Marketing';
      }

      return (
        user.unit ||
        user.department ||
        'Lainnya'
      );
    };

  const inviteFunctionOptions =
    Array.from(
      new Set(
        activeUsers
          .filter(
            user =>
              user.id !==
                currentUser.id &&
              user.role !==
                'SYSTEM_ADMIN'
          )
          .map(
            user =>
              getUserFunctionLabel(
                user
              )
          )
      )
    ).sort();

  const inviteCandidates =
    activeUsers
      .filter(
        user =>
          user.id !==
            currentUser.id &&
          user.role !==
            'SYSTEM_ADMIN'
      )
      .filter(
        user =>
          inviteFunctionFilter ===
            'ALL' ||
          getUserFunctionLabel(
            user
          ) ===
            inviteFunctionFilter
      )
      .filter(
        user => {
          const query =
            inviteSearch
              .trim()
              .toLowerCase();

          if (!query) {
            return true;
          }

          return [
            user.name,
            user.position,
            user.department,
            user.unit,
          ].some(
            value =>
              String(
                value || ''
              )
                .toLowerCase()
                .includes(
                  query
                )
          );
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          first.name.localeCompare(
            second.name
          )
      );

  // ============================================================
  // CALENDAR
  // ============================================================

  const calendarDays =
    useMemo(
      () =>
        buildCalendarDays(
          calendarMonth
        ),
      [
        calendarMonth,
      ]
    );

  const activityMapByDate =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Activity[]
          >();

        visibleActivities.forEach(
          activity => {
            const existing =
              map.get(
                activity.activityDate
              ) ||
              [];

            existing.push(
              activity
            );

            map.set(
              activity.activityDate,
              existing
            );
          }
        );

        return map;
      },
      [
        visibleActivities,
      ]
    );

  const todayKey =
    toDateKey(
      new Date()
    );

  const pendingPastActivities =
    activities
      .filter(
        activity =>
          activity.ownerUserId ===
            currentUser.id &&
          activity.activityDate <
            todayKey &&
          !FINAL_ACTIVITY_STATUSES.has(
            activity.status
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          first.activityDate.localeCompare(
            second.activityDate
          )
      );

  const firstPendingPastActivity =
    pendingPastActivities[0];

  const selectedDayActivities =
    selectedDayKey
      ? activityMapByDate.get(
          selectedDayKey
        ) || []
      : [];

  const calendarActivityCount =
    visibleActivities.filter(
      activity =>
        activity.activityDate.startsWith(
          `${calendarMonth.getFullYear()}-${pad(
            calendarMonth.getMonth() +
              1
          )}`
        )
    ).length;

  // ============================================================
  // FORM HELPERS
  // ============================================================

  const resetActivityForm =
    (
      dateKey?: string
    ) => {
      setActivityDate(
        dateKey ||
          new Date()
            .toISOString()
            .split('T')[0]
      );

      setStartTime(
        '09:00'
      );

      setEndTime(
        '11:00'
      );

      setActivityType(
        'Meeting'
      );

      setInteractionMethod(
        'In-Person / Offline'
      );

      setActivityStatus(
        'Planned'
      );

      setCompanyName('');

      setPersonMet('');

      setPositionMet('');

      setLocation('');

      setPurpose('');

      setAgenda('');

      setResult('');

      setFollowUp('');

      setDiscussedProduct('');

      setExpenseAmount('');

      setRelatedToPipeline(
        false
      );

      setRelatedPipelineId('');

      setPipelineSearch('');

      setTaggedUserIds([]);

      setInviteFunctionFilter(
        'ALL'
      );

      setInviteSearch('');
    };

  const openCreateActivity =
    (
      dateKey?: string
    ) => {
      const requestedDate =
        dateKey ||
        todayKey;

      if (
        requestedDate <
        todayKey
      ) {
        alert(
          'Tanggal kegiatan sudah terlewat dan tidak dapat digunakan untuk menambahkan aktivitas baru.'
        );

        return;
      }

      if (
        firstPendingPastActivity
      ) {
        alert(
          `Aktifitas pada tanggal ${formatBlockingDate(
            firstPendingPastActivity.activityDate
          )} belum diupdate, update terlebih dahulu!`
        );

        setSelectedActivityDetail(
          firstPendingPastActivity
        );

        return;
      }

      resetActivityForm(
        requestedDate
      );

      setActivityFormOpen(
        true
      );
    };

  const handleCalendarDateClick =
    (
      dateKey: string
    ) => {
      const dayActivities =
        activityMapByDate.get(
          dateKey
        ) || [];

      setSelectedDayKey(
        dateKey
      );

      if (
        dayActivities.length ===
        0
      ) {
        if (
          dateKey <
          todayKey
        ) {
          return;
        }

        openCreateActivity(
          dateKey
        );

        return;
      }

      setDayDetailOpen(
        true
      );
    };

  const toggleTaggedUser =
    (
      userId: string
    ) => {
      setTaggedUserIds(
        current =>
          current.includes(
            userId
          )
            ? current.filter(
                id =>
                  id !==
                  userId
              )
            : [
                ...current,
                userId,
              ]
      );
    };

  const handlePipelineChange =
    (
      pipelineId: string
    ) => {
      setRelatedPipelineId(
        pipelineId
      );

      const pipeline =
        activePipelines.find(
          item =>
            item.id ===
            pipelineId
        );

      if (!pipeline) {
        return;
      }

      setCompanyName(
        pipeline.customerName
      );

      setDiscussedProduct(
        pipeline.productName
      );

      setPipelineSearch('');
    };

  const handleCreateActivity =
    (
      event:
        React.FormEvent
    ) => {
      event.preventDefault();

      if (
        !activityDate ||
        !companyName.trim() ||
        !purpose.trim()
      ) {
        alert(
          'Tanggal, Nama Perusahaan, dan Tujuan Aktivitas wajib diisi.'
        );

        return;
      }

      if (
        activityDate <
        todayKey
      ) {
        alert(
          'Tanggal kegiatan sudah terlewat dan tidak dapat digunakan untuk menambahkan aktivitas baru.'
        );

        return;
      }

      if (
        firstPendingPastActivity
      ) {
        alert(
          `Aktifitas pada tanggal ${formatBlockingDate(
            firstPendingPastActivity.activityDate
          )} belum diupdate, update terlebih dahulu!`
        );

        setActivityFormOpen(
          false
        );

        setSelectedActivityDetail(
          firstPendingPastActivity
        );

        return;
      }

      if (
        endTime &&
        startTime &&
        endTime <=
          startTime
      ) {
        alert(
          'Jam selesai harus setelah jam mulai.'
        );

        return;
      }

      if (
        relatedToPipeline &&
        !relatedPipelineId
      ) {
        alert(
          'Pilih Pipeline Aktif yang terkait.'
        );

        return;
      }

      const numericExpense =
        Number(
          expenseAmount ||
            0
        );

      const newActivity:
        Activity = {
          id:
            `ACT-${new Date(
              activityDate
            ).getFullYear()}-${Date.now()
              .toString()
              .slice(-5)}`,
          activityDate,
          startTime,
          endTime,
          activityType,
          interactionMethod,
          companyName:
            companyName.trim(),
          personMet:
            personMet.trim() ||
            '-',
          positionMet:
            positionMet.trim() ||
            '-',
          location:
            location.trim() ||
            '-',
          purpose:
            purpose.trim(),
          discussedProduct:
            discussedProduct.trim() ||
            selectedPipeline?.productName ||
            '-',
          relatedPipelineId:
            relatedToPipeline
              ? relatedPipelineId
              : undefined,
          agenda:
            agenda.trim() ||
            purpose.trim(),
          result:
            result.trim() ||
            undefined,
          followUp:
            followUp.trim() ||
            undefined,
          hasExpense:
            numericExpense >
            0,
          expenseAmount:
            numericExpense >
            0
              ? numericExpense
              : 0,
          status:
            activityStatus,
          ownerUserId:
            currentUser.id,
          ownerName:
            currentUser.name,
          unit:
            currentUser.unit,
          department:
            currentUser.department,
          taggedUserIds,
          createdAt:
            new Date().toISOString(),
        };

      store.addActivity(
        newActivity
      );

      setActivityFormOpen(
        false
      );

      setDayDetailOpen(
        false
      );

      setSelectedDayKey(
        activityDate
      );

      setCalendarMonth(
        new Date(
          Number(
            activityDate.slice(
              0,
              4
            )
          ),
          Number(
            activityDate.slice(
              5,
              7
            )
          ) -
            1,
          1
        )
      );

      alert(
        'Aktivitas pemasaran berhasil dicatat.'
      );
    };

  const handleFinalizeActivity =
    (
      activity: Activity,
      finalStatus:
        | 'Completed'
        | 'Cancelled'
        | 'Rescheduled'
    ) => {
      if (
        activity.ownerUserId !==
        currentUser.id
      ) {
        alert(
          'Final status hanya dapat diberikan oleh PIC / owner aktivitas.'
        );

        return;
      }

      const updatedActivity:
        Activity = {
          ...activity,
          status:
            finalStatus,
        };

      store.updateActivity(
        updatedActivity
      );

      setSelectedActivityDetail(
        updatedActivity
      );

      alert(
        `Final status aktivitas berhasil diupdate menjadi ${finalStatus}.`
      );
    };

  // ============================================================
  // COMMENTS / REIMBURSEMENT
  // ============================================================

  const commentsByActivity =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            ActivityComment[]
          >();

        comments.forEach(
          comment => {
            const existing =
              map.get(
                comment.activityId
              ) ||
              [];

            existing.push(
              comment
            );

            map.set(
              comment.activityId,
              existing
            );
          }
        );

        map.forEach(
          activityComments =>
            activityComments.sort(
              (
                first,
                second
              ) =>
                first.timestamp.localeCompare(
                  second.timestamp
                )
            )
        );

        return map;
      },
      [
        comments,
      ]
    );

  const getUnreadCommentCount =
    (
      activityId: string
    ): number => {
      const readAt =
        commentReadMap[
          activityId
        ] ||
        '';

      return (
        commentsByActivity.get(
          activityId
        ) ||
        []
      ).filter(
        comment =>
          comment.authorId !==
            currentUser.id &&
          comment.timestamp >
            readAt
      ).length;
    };

  const markActivityCommentsRead =
    (
      activityId: string
    ) => {
      const activityComments =
        commentsByActivity.get(
          activityId
        ) ||
        [];

      const latestTimestamp =
        activityComments.length >
        0
          ? activityComments[
              activityComments.length -
                1
            ].timestamp
          : new Date().toISOString();

      const nextReadMap = {
        ...commentReadMap,
        [activityId]:
          latestTimestamp,
      };

      setCommentReadMap(
        nextReadMap
      );

      try {
        localStorage.setItem(
          `pertalife_activity_comment_reads_${currentUser.id}`,
          JSON.stringify(
            nextReadMap
          )
        );
      } catch {
        // UAT browser storage may be unavailable in restricted mode.
      }
    };


  const handleAddComment =
    (
      activityId: string
    ) => {
      const text =
        commentTextMap[
          activityId
        ];

      if (
        !text?.trim()
      ) {
        return;
      }

      const newComment:
        ActivityComment = {
          id:
            'CMT-' +
            Date.now(),
          activityId,
          authorId:
            currentUser.id,
          authorName:
            currentUser.name,
          authorRole:
            currentUser.role,
          commentText:
            text.trim(),
          timestamp:
            new Date().toISOString(),
        };

      store.addActivityComment(
        newComment
      );

      const nextReadMap = {
        ...commentReadMap,
        [activityId]:
          newComment.timestamp,
      };

      setCommentReadMap(
        nextReadMap
      );

      try {
        localStorage.setItem(
          `pertalife_activity_comment_reads_${currentUser.id}`,
          JSON.stringify(
            nextReadMap
          )
        );
      } catch {
        // Ignore local storage errors in restricted browser mode.
      }

      setCommentTextMap(
        previous => ({
          ...previous,
          [activityId]:
            '',
        })
      );
    };

  const openReimbursementForm =
    (
      activity?:
        Activity
    ) => {
      if (
        !isMarketingUser
      ) {
        alert(
          'Pengajuan reimbursement hanya tersedia untuk akun Marketing.'
        );

        return;
      }

      if (
        activity &&
        activity.ownerUserId !==
          currentUser.id
      ) {
        alert(
          'Reimbursement hanya dapat diajukan untuk aktivitas milik user login.'
        );

        return;
      }

      if (
        activity &&
        reimbursements.some(
          reimbursement =>
            reimbursement.activityId ===
              activity.id &&
            reimbursement.status !==
              'Rejected'
        )
      ) {
        alert(
          'Aktivitas ini sudah memiliki pengajuan reimbursement aktif.'
        );

        return;
      }

      setReimbursementActivityId(
        activity?.id ||
        ''
      );

      setReimbursementType(
        'Konsumsi'
      );

      setReimbursementAmount(
        activity?.expenseAmount
          ? String(
              activity.expenseAmount
            )
          : ''
      );

      setReimbursementExpenseDate(
        activity?.activityDate ||
        new Date()
          .toISOString()
          .split(
            'T'
          )[0]
      );

      setReimbursementDescription(
        activity
          ? `Klaim biaya aktivitas dengan ${activity.companyName}`
          : ''
      );

      setReimbursementReceipt(
        null
      );

      setReimbursementFormOpen(
        true
      );
    };

  const handleSelectReimbursementActivity =
    (
      activityId:
        string
    ) => {
      setReimbursementActivityId(
        activityId
      );

      const activity =
        activities.find(
          item =>
            item.id ===
            activityId
        );

      if (
        !activity
      ) {
        return;
      }

      setReimbursementExpenseDate(
        activity.activityDate
      );

      setReimbursementAmount(
        activity.expenseAmount
          ? String(
              activity.expenseAmount
            )
          : ''
      );

      setReimbursementDescription(
        `Klaim biaya aktivitas dengan ${activity.companyName}`
      );
    };

  const handleSubmitReimbursement =
    async () => {
      const activity =
        activities.find(
          item =>
            item.id ===
            reimbursementActivityId
        );

      if (
        !activity ||
        activity.ownerUserId !==
          currentUser.id
      ) {
        alert(
          'Pilih aktivitas milik Anda.'
        );

        return;
      }

      const alreadySubmitted =
        reimbursements.some(
          reimbursement =>
            reimbursement.activityId ===
              activity.id &&
            reimbursement.status !==
              'Rejected'
        );

      if (
        alreadySubmitted
      ) {
        alert(
          'Aktivitas ini sudah memiliki pengajuan reimbursement aktif.'
        );

        return;
      }

      const amount =
        Number(
          reimbursementAmount
            .replace(
              /[^0-9.-]/g,
              ''
            )
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <=
          0
      ) {
        alert(
          'Nominal reimbursement wajib lebih dari 0.'
        );

        return;
      }

      if (
        !reimbursementExpenseDate
      ) {
        alert(
          'Tanggal pengeluaran wajib diisi.'
        );

        return;
      }

      if (
        !reimbursementDescription.trim()
      ) {
        alert(
          'Deskripsi reimbursement wajib diisi.'
        );

        return;
      }

      if (
        !reimbursementReceipt
      ) {
        alert(
          'Upload bukti / receipt reimbursement.'
        );

        return;
      }

      if (
        reimbursementReceipt.size >
        25 *
          1024 *
          1024
      ) {
        alert(
          'Ukuran receipt maksimum 25 MB pada prototype browser.'
        );

        return;
      }

      setReimbursementBusy(
        true
      );

      const now =
        new Date();

      const reimbursementId =
        `RMB-${now.getFullYear()}-${Date.now()
          .toString()
          .slice(-7)}`;

      const receiptFileId =
        `RMBFILE-${reimbursementId}`;

      try {
        await saveMarketingSupportFile(
          receiptFileId,
          reimbursementReceipt
        );

        const newReimbursement:
          Reimbursement = {
          id:
            reimbursementId,
          activityId:
            activity.id,
          activityDate:
            activity.activityDate,
          expenseDate:
            reimbursementExpenseDate,
          companyName:
            activity.companyName,
          userId:
            currentUser.id,
          userName:
            currentUser.name,
          unit:
            currentUser.unit,
          reimbursementType,
          amount,
          description:
            reimbursementDescription.trim(),
          receiptFileId,
          receiptFileName:
            reimbursementReceipt.name,
          receiptFileSize:
            reimbursementReceipt.size,
          status:
            'Submitted',
          createdAt:
            new Date().toISOString(),
        };

        store.submitReimbursement(
          newReimbursement
        );

        setReimbursementFormOpen(
          false
        );
        setActiveMainTab(
          'reimbursement'
        );
        setReimbursementListFilter(
          'MY'
        );

        setSearchParams({
          tab:
            'reimbursement',
        });

        alert(
          'Pengajuan reimbursement berhasil disubmit.'
        );
      } catch (
        error
      ) {
        try {
          await deleteMarketingSupportFile(
            receiptFileId
          );
        } catch {
          // Best effort cleanup.
        }

        alert(
          error instanceof
            Error
            ? error.message
            : 'Pengajuan reimbursement gagal.'
        );
      } finally {
        setReimbursementBusy(
          false
        );
      }
    };

  const handleDownloadReceipt =
    async (
      reimbursement:
        Reimbursement
    ) => {
      if (
        !reimbursement.receiptFileId
      ) {
        alert(
          'File receipt legacy tidak tersimpan pada repository browser ini.'
        );

        return;
      }

      try {
        await downloadMarketingSupportFile(
          reimbursement.receiptFileId,
          reimbursement.receiptFileName
        );
      } catch (
        error
      ) {
        alert(
          error instanceof
            Error
            ? error.message
            : 'Receipt tidak dapat diunduh.'
        );
      }
    };

  const canTakeReimbursementAction =
    (
      reimbursement:
        Reimbursement
    ) =>
      (
        reimbursement.status ===
          'Submitted' &&
        reimbursement.directSuperiorId ===
          currentUser.id
      ) ||
      (
        reimbursement.status ===
          'Approved Superior' &&
        isMarketingAdministrationRmbVerifier
      ) ||
      (
        (
          reimbursement.status ===
            'Verified Marketing Administration' ||
          reimbursement.status ===
            'Verified MS'
        ) &&
        isEndah
      );

  const reimbursementActionLabel =
    (
      reimbursement:
        Reimbursement
    ) => {
      if (
        reimbursement.status ===
          'Submitted' &&
        reimbursement.directSuperiorId ===
          currentUser.id
      ) {
        return 'Review Atasan';
      }

      if (
        reimbursement.status ===
          'Approved Superior' &&
        isMarketingAdministrationRmbVerifier
      ) {
        return 'Verifikasi';
      }

      if (
        (
          reimbursement.status ===
            'Verified Marketing Administration' ||
          reimbursement.status ===
            'Verified MS'
        ) &&
        isEndah
      ) {
        return 'Final Review';
      }

      return 'Lihat Detail';
    };

  const handleReimbursementDecision =
    (
      approved:
        boolean
    ) => {
      if (
        !selectedReimbursementReview
      ) {
        return;
      }

      const reimbursement =
        selectedReimbursementReview;

      if (
        !approved &&
        !reimbursementReviewNotes.trim()
      ) {
        alert(
          'Catatan wajib diisi jika menolak reimbursement.'
        );

        return;
      }

      try {
        if (
          reimbursement.status ===
            'Submitted' &&
          reimbursement.directSuperiorId ===
            currentUser.id
        ) {
          store.decideReimbursementBySuperior(
            reimbursement.id,
            approved,
            reimbursementReviewNotes
          );
        } else if (
          reimbursement.status ===
            'Approved Superior' &&
          isMarketingAdministrationRmbVerifier
        ) {
          store.verifyReimbursementByMarketingAdministration(
            reimbursement.id,
            approved,
            reimbursementReviewNotes
          );
        } else if (
          (
            reimbursement.status ===
              'Verified Marketing Administration' ||
            reimbursement.status ===
              'Verified MS'
          ) &&
          isEndah
        ) {
          store.finalizeReimbursementByEndah(
            reimbursement.id,
            approved,
            reimbursementReviewNotes
          );
        } else {
          throw new Error(
            'Tidak ada action workflow yang tersedia untuk akun ini.'
          );
        }

        setSelectedReimbursementReview(
          null
        );
        setReimbursementReviewNotes('');
      } catch (
        error
      ) {
        alert(
          error instanceof
            Error
            ? error.message
            : 'Keputusan reimbursement gagal disimpan.'
        );
      }
    };


  const resetFilters =
    () => {
      setSelectedScope(
        'ALL'
      );

      setSelectedDepartment(
        'ALL'
      );

      setSelectedPic(
        'ALL'
      );

      setSelectedActivityType(
        'ALL'
      );

      setSearchQuery('');
    };

  const linkedPipelineForActivity =
    (
      activity: Activity
    ) =>
      activity.relatedPipelineId
        ? pipelines.find(
            pipeline =>
              pipeline.id ===
              activity.relatedPipelineId
          )
        : undefined;

  const taggedUsersForActivity =
    (
      activity: Activity
    ) =>
      activeUsers.filter(
        user =>
          activity.taggedUserIds?.includes(
            user.id
          )
      );

  const activityHasActiveReimbursement =
    (
      activityId: string
    ) =>
      reimbursements.some(
        reimbursement =>
          reimbursement.activityId ===
            activityId &&
          reimbursement.status !==
            'Rejected'
      );

  const ownReimbursementActivities =
    activities
      .filter(
        activity =>
          activity.ownerUserId ===
            currentUser.id &&
          !activityHasActiveReimbursement(
            activity.id
          )
      )
      .sort(
        (
          first,
          second
        ) =>
          second.activityDate.localeCompare(
            first.activityDate
          )
      );

  const subordinateIds =
    new Set(
      store.getSubordinateUserIds(
        currentUser.id
      )
    );

  const visibleReimbursements =
    reimbursements
      .filter(
        reimbursement => {
          if (
            currentUser.role ===
              'SYSTEM_ADMIN' ||
            isMarketingSupportUser
          ) {
            // Marketing Support gets end-to-end monitoring visibility from
            // the moment Marketing submits, even before direct-superior approval.
            return true;
          }

          if (
            isMarketingUser
          ) {
            return (
              reimbursement.userId ===
                currentUser.id ||
              reimbursement.directSuperiorId ===
                currentUser.id ||
              subordinateIds.has(
                reimbursement.userId
              )
            );
          }

          return false;
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          new Date(
            second.createdAt
          ).getTime() -
          new Date(
            first.createdAt
          ).getTime()
      );

  const actionReimbursements =
    visibleReimbursements.filter(
      canTakeReimbursementAction
    );

  const filteredReimbursements =
    visibleReimbursements.filter(
      reimbursement => {
        if (
          reimbursementListFilter ===
          'MY'
        ) {
          return (
            reimbursement.userId ===
            currentUser.id
          );
        }

        if (
          reimbursementListFilter ===
          'ACTION'
        ) {
          return canTakeReimbursementAction(
            reimbursement
          );
        }

        if (
          reimbursementListFilter ===
          'APPROVED'
        ) {
          return (
            reimbursement.status ===
              'Approved for Payment' ||
            reimbursement.status ===
              'Approved TL MS' ||
            reimbursement.status ===
              'Paid Finance'
          );
        }

        return true;
      }
    );

  const getReimbursementWorkflowLabel =
    (
      reimbursement:
        Reimbursement
    ) => {
      if (
        reimbursement.status ===
        'Submitted'
      ) {
        return 'Menunggu Approval Atasan Langsung';
      }

      if (
        reimbursement.status ===
        'Approved Superior'
      ) {
        return 'Menunggu Verifikasi Marketing Administration';
      }

      if (
        reimbursement.status ===
          'Verified Marketing Administration' ||
        reimbursement.status ===
          'Verified MS'
      ) {
        return 'Menunggu Final Approval Department Head Marketing Administration';
      }

      if (
        reimbursement.status ===
          'Approved for Payment' ||
        reimbursement.status ===
          'Approved TL MS'
      ) {
        return 'Approved for Payment';
      }

      if (
        reimbursement.status ===
        'Paid Finance'
      ) {
        return 'Paid Finance';
      }

      return reimbursement.status;
    };

  const getUserPosition =
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

  const buildReimbursementHistory =
    (
      reimbursement:
        Reimbursement
    ):
      ActionHistoryEntry[] => {
      const entries:
        ActionHistoryEntry[] = [
          {
            id:
              `${reimbursement.id}-SUBMIT`,
            timestamp:
              reimbursement.createdAt,
            actorName:
              reimbursement.userName,
            actorRole:
              getUserPosition(
                reimbursement.userId,
                reimbursement.userName
              ) ||
              'Marketing',
            action:
              'Pengajuan Reimbursement Disubmit',
            status:
              'Submitted',
            description:
              `${reimbursement.reimbursementType} • ${formatRupiah(
                reimbursement.amount
              )} • Aktivitas ${reimbursement.activityId} • ${reimbursement.companyName}`,
            notes:
              reimbursement.receiptFileName
                ? `Bukti: ${reimbursement.receiptFileName}`
                : undefined,
          },
        ];

      if (
        reimbursement.superiorApprovedAt
      ) {
        const rejectedHere =
          reimbursement.rejectionStage ===
          'DIRECT_SUPERIOR';

        entries.push({
          id:
            `${reimbursement.id}-SUPERIOR`,
          timestamp:
            reimbursement.superiorApprovedAt,
          actorName:
            reimbursement.superiorApprovedByName ||
            reimbursement.superiorApprovedBy ||
            reimbursement.directSuperiorName ||
            'Atasan Langsung',
          actorRole:
            getUserPosition(
              reimbursement.superiorApprovedBy,
              reimbursement.superiorApprovedByName
            ) ||
            'Atasan Langsung',
          action:
            rejectedHere
              ? 'Pengajuan Ditolak Atasan Langsung'
              : 'Pengajuan Disetujui Atasan Langsung',
          status:
            rejectedHere
              ? 'Rejected'
              : 'Approved Superior',
          description:
            rejectedHere
              ? 'Workflow berhenti pada approval atasan langsung.'
              : 'Pengajuan diteruskan ke Marketing Administration.',
          notes:
            reimbursement.superiorDecisionNotes ||
            (
              rejectedHere
                ? reimbursement.rejectionReason
                : undefined
            ),
        });
      }

      if (
        reimbursement.marketingAdminVerifiedAt ||
        reimbursement.msVerifiedAt
      ) {
        const rejectedHere =
          reimbursement.rejectionStage ===
          'MARKETING_ADMINISTRATION';

        entries.push({
          id:
            `${reimbursement.id}-MARKETING-ADMIN`,
          timestamp:
            reimbursement.marketingAdminVerifiedAt ||
            reimbursement.msVerifiedAt ||
            reimbursement.updatedAt ||
            reimbursement.createdAt,
          actorName:
            reimbursement.marketingAdminVerifiedByName ||
            reimbursement.msVerifiedBy ||
            'Marketing Administration',
          actorRole:
            getUserPosition(
              reimbursement.marketingAdminVerifiedBy,
              reimbursement.marketingAdminVerifiedByName
            ) ||
            'Marketing Administration',
          action:
            rejectedHere
              ? 'Pengajuan Ditolak Marketing Administration'
              : 'Pengajuan Diverifikasi Marketing Administration',
          status:
            rejectedHere
              ? 'Rejected'
              : 'Verified Marketing Administration',
          description:
            rejectedHere
              ? 'Workflow berhenti pada verifikasi Marketing Administration.'
              : 'Pengajuan diteruskan ke Department Head Marketing Administration.',
          notes:
            reimbursement.marketingAdminVerificationNotes ||
            (
              rejectedHere
                ? reimbursement.rejectionReason
                : undefined
            ),
        });
      }

      if (
        reimbursement.finalApprovedAt ||
        reimbursement.tlApprovedAt
      ) {
        const rejectedHere =
          reimbursement.rejectionStage ===
          'DH_MARKETING_ADMINISTRATION';

        entries.push({
          id:
            `${reimbursement.id}-FINAL`,
          timestamp:
            reimbursement.finalApprovedAt ||
            reimbursement.tlApprovedAt ||
            reimbursement.updatedAt ||
            reimbursement.createdAt,
          actorName:
            reimbursement.finalApprovedByName ||
            reimbursement.tlApprovedBy ||
            'Department Head Marketing Administration',
          actorRole:
            'Department Head Marketing Administration',
          action:
            rejectedHere
              ? 'Pengajuan Ditolak Final'
              : 'Final Approval Reimbursement',
          status:
            rejectedHere
              ? 'Rejected'
              : 'Approved for Payment',
          description:
            rejectedHere
              ? 'Pengajuan reimbursement ditolak pada final approval.'
              : 'Pengajuan dinyatakan Approved for Payment dan siap diproses di luar Dashboard Marketing.',
          notes:
            reimbursement.finalApprovalNotes ||
            (
              rejectedHere
                ? reimbursement.rejectionReason
                : undefined
            ),
        });
      }

      if (
        reimbursement.financePaidAt
      ) {
        entries.push({
          id:
            `${reimbursement.id}-PAID`,
          timestamp:
            reimbursement.financePaidAt,
          actorName:
            reimbursement.financePaidBy ||
            'Finance',
          actorRole:
            'Finance',
          action:
            'Pembayaran Dicatat',
          status:
            'Paid Finance',
          description:
            'Status pembayaran legacy dicatat pada transaksi reimbursement.',
        });
      }

      return entries;
    };

  const selectedActivityComments =
    selectedActivityDetail
      ? commentsByActivity.get(
          selectedActivityDetail.id
        ) || []
      : [];

  const selectedActivityUnreadCount =
    selectedActivityDetail
      ? getUnreadCommentCount(
          selectedActivityDetail.id
        )
      : 0;

  return (
    <AppLayout>

      <div className="space-y-6">

        {/* ==================================================
            HEADER
        =================================================== */}

        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">

          <div>

            <h1 className="text-xl font-bold text-gray-900">
              Aktivitas Pemasaran & Calendar
            </h1>

            <p className="mt-1 text-xs text-gray-500">
              Kalender kegiatan, monitoring hierarchy, kolaborasi antar-akun, relasi pipeline, feedback atasan, dan reimbursement.
            </p>

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <Button
              type="button"
              onClick={() =>
                openCreateActivity()
              }
              className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Tambah Aktivitas
            </Button>


          </div>

        </div>

        {/* ==================================================
            HIERARCHY FILTER
        =================================================== */}

        <Card className="border-gray-200">

          <CardContent className="p-4">

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[220px_190px_220px_190px_minmax(220px,1fr)_auto]">

              <Select
                value={
                  selectedScope
                }
                onValueChange={
                  value => {
                    setSelectedScope(
                      value
                    );

                    setSelectedDepartment(
                      'ALL'
                    );

                    setSelectedPic(
                      'ALL'
                    );
                  }
                }
              >

                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Scope Hierarchy" />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="ALL">
                    Scope: Semua yang Bisa Dilihat
                  </SelectItem>

                  {directScopeOptions.map(
                    user => (

                      <SelectItem
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        Tim: {user.name}
                      </SelectItem>

                    )
                  )}

                </SelectContent>

              </Select>

              <Select
                value={
                  selectedDepartment
                }
                onValueChange={
                  value => {
                    setSelectedDepartment(
                      value
                    );

                    setSelectedPic(
                      'ALL'
                    );
                  }
                }
              >

                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="ALL">
                    Semua Department
                  </SelectItem>

                  {departmentOptions.map(
                    department => (

                      <SelectItem
                        key={
                          department
                        }
                        value={
                          department
                        }
                      >
                        {department}
                      </SelectItem>

                    )
                  )}

                </SelectContent>

              </Select>

              <Select
                value={
                  selectedPic
                }
                onValueChange={
                  setSelectedPic
                }
              >

                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="PIC / Owner" />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="ALL">
                    Semua PIC
                  </SelectItem>

                  {picOptions.map(
                    user => (

                      <SelectItem
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {user.name} — {user.position}
                      </SelectItem>

                    )
                  )}

                </SelectContent>

              </Select>

              <Select
                value={
                  selectedActivityType
                }
                onValueChange={
                  setSelectedActivityType
                }
              >

                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Jenis Aktivitas" />
                </SelectTrigger>

                <SelectContent>

                  <SelectItem value="ALL">
                    Semua Jenis
                  </SelectItem>

                  {ACTIVITY_TYPES.map(
                    type => (

                      <SelectItem
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type}
                      </SelectItem>

                    )
                  )}

                </SelectContent>

              </Select>

              <div className="relative">

                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <Input
                  value={
                    searchQuery
                  }
                  onChange={
                    event =>
                      setSearchQuery(
                        event.target.value
                      )
                  }
                  placeholder="Cari perusahaan, PIC, produk, pipeline..."
                  className="h-9 pl-9 text-xs"
                />

              </div>

              <Button
                type="button"
                variant="outline"
                onClick={
                  resetFilters
                }
                className="h-9 text-xs"
              >
                Reset
              </Button>

            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">

              <span>
                Visibility mengikuti hierarchy akun login. Aktivitas yang men-tag akun login tetap ikut terlihat.
                {pendingPastActivities.length >
                  0 && (
                  <span className="ml-2 font-black text-rose-700">
                    • {pendingPastActivities.length} aktivitas lampau belum final
                  </span>
                )}
              </span>

              <span>
                <strong className="text-gray-800">
                  {visibleActivities.length}
                </strong>{' '}
                aktivitas tampil
                {invitedActivities.length >
                0
                  ? ` • ${invitedActivities.length} aktivitas mengundang Anda`
                  : ''}
              </span>

            </div>

          </CardContent>

        </Card>

        <Tabs
          value={
            activeMainTab
          }
          onValueChange={
            value => {
              setActiveMainTab(
                value
              );

              setSearchParams({
                tab:
                  value,
              });
            }
          }
          className="w-full"
        >

          <TabsList className={`grid w-full rounded-xl border border-gray-200 bg-white p-1 shadow-sm ${
            canAccessReimbursementModule
              ? 'max-w-md grid-cols-3'
              : 'max-w-sm grid-cols-2'
          }`}>

            <TabsTrigger
              value="calendar"
              className="gap-1.5 text-xs font-bold"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </TabsTrigger>

            <TabsTrigger
              value="list"
              className="gap-1.5 text-xs font-bold"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Daftar
            </TabsTrigger>

            {canAccessReimbursementModule && (
              <TabsTrigger
                value="reimbursement"
                className="gap-1.5 text-xs font-bold"
              >
                <Receipt className="h-3.5 w-3.5" />
                Reimbursement
                {actionReimbursements.length >
                  0 && (
                  <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black text-white">
                    {actionReimbursements.length}
                  </span>
                )}
              </TabsTrigger>
            )}

          </TabsList>

          {/* ==================================================
              TAB 1 — CALENDAR
          =================================================== */}

          <TabsContent
            value="calendar"
            className="mt-4 space-y-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold">
                      Calendar Aktivitas
                    </CardTitle>

                    <CardDescription className="mt-1 text-xs">
                      Klik tanggal kosong untuk membuat aktivitas. Klik tanggal yang memiliki aktivitas untuk membuka detail harian.
                    </CardDescription>

                  </div>

                  <div className="flex items-center gap-2">

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() -
                              1,
                            1
                          )
                        )
                      }
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="min-w-36 text-center text-xs font-black text-gray-900">
                      {formatMonthTitle(
                        calendarMonth
                      )}
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            calendarMonth.getFullYear(),
                            calendarMonth.getMonth() +
                              1,
                            1
                          )
                        )
                      }
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCalendarMonth(
                          new Date(
                            new Date().getFullYear(),
                            new Date().getMonth(),
                            1
                          )
                        )
                      }
                      className="h-8 text-[10px]"
                    >
                      Bulan Ini
                    </Button>

                  </div>

                </div>

              </CardHeader>

              <CardContent>

                <div className="mb-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-[10px] text-blue-700">

                  <span>
                    {calendarActivityCount} aktivitas pada {formatMonthTitle(calendarMonth)}
                  </span>

                  <span>
                    Dot biru = aktivitas tersedia
                  </span>

                </div>

                <div className="grid grid-cols-7 border-l border-t border-gray-200">

                  {[
                    'Sen',
                    'Sel',
                    'Rab',
                    'Kam',
                    'Jum',
                    'Sab',
                    'Min',
                  ].map(
                    day => (

                      <div
                        key={
                          day
                        }
                        className="border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-center text-[10px] font-bold uppercase text-gray-500"
                      >
                        {day}
                      </div>

                    )
                  )}

                  {calendarDays.map(
                    day => {
                      const dayActivities =
                        activityMapByDate.get(
                          day.key
                        ) || [];

                      const isToday =
                        day.key ===
                        todayKey;

                      const isPastDate =
                        day.key <
                        todayKey;

                      const pastDateWithoutActivity =
                        isPastDate &&
                        dayActivities.length ===
                          0;

                      return (

                        <button
                          key={
                            day.key
                          }
                          type="button"
                          disabled={
                            pastDateWithoutActivity
                          }
                          onClick={() =>
                            handleCalendarDateClick(
                              day.key
                            )
                          }
                          className={`min-h-[112px] border-b border-r border-gray-200 p-2 text-left align-top transition ${
                            pastDateWithoutActivity
                              ? 'cursor-not-allowed bg-gray-100/80 text-gray-300'
                              : day.inCurrentMonth
                              ? 'bg-white hover:bg-blue-50/40'
                              : 'bg-gray-50/60 text-gray-400'
                          } ${
                            isToday
                              ? 'ring-2 ring-inset ring-blue-300'
                              : ''
                          }`}
                        >

                          <div className="flex items-center justify-between">

                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                isToday
                                  ? 'bg-blue-600 text-white'
                                  : day.inCurrentMonth
                                  ? 'text-gray-700'
                                  : 'text-gray-400'
                              }`}
                            >
                              {day.dayNumber}
                            </span>

                            {dayActivities.length >
                              0 && (

                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 px-1.5 py-0 text-[9px] font-black text-blue-700"
                              >
                                {dayActivities.length}
                              </Badge>

                            )}

                          </div>

                          <div className="mt-2 space-y-1">

                            {dayActivities
                              .slice(
                                0,
                                2
                              )
                              .map(
                                activity => (

                                  <div
                                    key={
                                      activity.id
                                    }
                                    className="truncate rounded bg-blue-50 px-1.5 py-1 text-[9px] font-semibold text-blue-800"
                                    title={`${activity.ownerName} — ${activity.companyName}`}
                                  >
                                    {activity.startTime} • {activity.companyName}
                                  </div>

                                )
                              )}

                            {dayActivities.length >
                              2 && (

                              <div className="px-1 text-[9px] font-bold text-gray-500">
                                +{dayActivities.length - 2} lainnya
                              </div>

                            )}

                          </div>

                        </button>

                      );
                    }
                  )}

                </div>

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              TAB 2 — LIST
          =================================================== */}

          <TabsContent
            value="list"
            className="mt-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <CardTitle className="text-sm font-bold">
                  Daftar Aktivitas Pemasaran
                </CardTitle>

                <CardDescription className="text-xs">
                  List mengikuti filter hierarchy, department, PIC, jenis aktivitas, dan pencarian di atas.
                </CardDescription>

              </CardHeader>

              <CardContent>

                {visibleActivities.length ===
                0 ? (

                  <div className="p-12 text-center text-xs text-gray-400">
                    Tidak ada aktivitas yang sesuai filter.
                  </div>

                ) : (

                  <div className="space-y-3">

                    {visibleActivities.map(
                      activity => {
                        const linkedPipeline =
                          linkedPipelineForActivity(
                            activity
                          );

                        const taggedUsers =
                          taggedUsersForActivity(
                            activity
                          );

                        const canSubmitRmb =
                          isMarketingUser &&
                          activity.ownerUserId ===
                            currentUser.id &&
                          !activityHasActiveReimbursement(
                            activity.id
                          );

                        const activityComments =
                          commentsByActivity.get(
                            activity.id
                          ) ||
                          [];

                        const unreadCommentCount =
                          getUnreadCommentCount(
                            activity.id
                          );

                        return (

                          <div
                            key={
                              activity.id
                            }
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              setSelectedActivityDetail(
                                activity
                              );

                              setCommentHistoryOpen(
                                false
                              );
                            }}
                            onKeyDown={
                              event => {
                                if (
                                  event.key ===
                                    'Enter' ||
                                  event.key ===
                                    ' '
                                ) {
                                  event.preventDefault();

                                  setSelectedActivityDetail(
                                    activity
                                  );

                                  setCommentHistoryOpen(
                                    false
                                  );
                                }
                              }
                            }
                            className="cursor-pointer rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-blue-300 hover:bg-blue-50/20 focus:outline-none focus:ring-2 focus:ring-blue-200"
                          >

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                              <div className="min-w-0 text-left">

                                <div className="flex flex-wrap items-center gap-2">

                                  <span className="font-mono text-xs font-bold text-blue-700">
                                    {activity.id}
                                  </span>

                                  <span className="text-xs font-bold text-gray-900">
                                    {activity.companyName}
                                  </span>

                                  <StatusBadge
                                    status={
                                      activity.status
                                    }
                                  />

                                  {linkedPipeline && (

                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-violet-200 bg-violet-50 text-[9px] text-violet-700"
                                    >
                                      <Link2 className="h-3 w-3" />
                                      {linkedPipeline.id}
                                    </Badge>

                                  )}

                                  {taggedUsers.length >
                                    0 && (

                                    <Badge
                                      variant="outline"
                                      className="gap-1 border-cyan-200 bg-cyan-50 text-[9px] text-cyan-700"
                                    >
                                      <Users className="h-3 w-3" />
                                      {taggedUsers.length} rekan
                                    </Badge>

                                  )}

                                </div>

                                <p className="mt-2 line-clamp-2 text-xs text-gray-600">
                                  {activity.purpose}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-500">

                                  <span>
                                    PIC:{' '}
                                    <strong className="text-gray-800">
                                      {activity.ownerName}
                                    </strong>
                                  </span>

                                  <span>
                                    Department:{' '}
                                    <strong className="text-gray-800">
                                      {activity.department}
                                    </strong>
                                  </span>

                                  <span>
                                    {formatDate(
                                      activity.activityDate
                                    )}{' '}
                                    • {activity.startTime}-{activity.endTime}
                                  </span>

                                  <span>
                                    {activity.activityType}
                                  </span>

                                  {linkedPipeline && (

                                    <span className="text-violet-700">
                                      {linkedPipeline.productName}
                                    </span>

                                  )}

                                </div>

                              </div>

                              <div className="flex shrink-0 flex-wrap items-center gap-2">

                                <Badge
                                  variant="outline"
                                  className={`gap-1.5 text-[9px] font-bold ${
                                    unreadCommentCount >
                                    0
                                      ? 'border-rose-300 bg-rose-50 text-rose-800'
                                      : 'border-blue-200 bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  {activityComments.length}{' '}
                                  komentar

                                  {unreadCommentCount >
                                    0 && (
                                    <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black text-white">
                                      {unreadCommentCount}{' '}
                                      baru
                                    </span>
                                  )}
                                </Badge>

                                {canSubmitRmb && (

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={
                                      event => {
                                        event.stopPropagation();

                                        openReimbursementForm(
                                          activity
                                        );
                                      }
                                    }
                                    className="h-8 shrink-0 gap-1 border-emerald-300 text-[10px] font-bold text-emerald-800 hover:bg-emerald-50"
                                  >
                                    <Receipt className="h-3 w-3" />
                                    {activity.expenseAmount
                                      ? `Ajukan RMB (${formatRupiah(activity.expenseAmount)})`
                                      : 'Ajukan RMB'}
                                  </Button>

                                )}

                              </div>

                            </div>

                          </div>

                        );
                      }
                    )}

                  </div>

                )}

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              TAB 3 — REIMBURSEMENT
          =================================================== */}

          {canAccessReimbursementModule && (
            <TabsContent
              value="reimbursement"
              className="mt-4 space-y-4"
            >
              <div className="grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setReimbursementListFilter(
                      isMarketingSupportUser ||
                      currentUser.role ===
                        'SYSTEM_ADMIN'
                        ? 'ALL'
                        : 'MY'
                    )
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    (
                      isMarketingSupportUser ||
                      currentUser.role ===
                        'SYSTEM_ADMIN'
                    )
                      ? reimbursementListFilter ===
                          'ALL'
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                      : reimbursementListFilter ===
                          'MY'
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="text-[9px] font-black uppercase tracking-wide text-blue-600">
                    {isMarketingSupportUser ||
                    currentUser.role ===
                      'SYSTEM_ADMIN'
                      ? 'Seluruh Pengajuan'
                      : 'Pengajuan Saya'}
                  </div>

                  <div className="mt-1 text-xl font-black text-gray-950">
                    {isMarketingSupportUser ||
                    currentUser.role ===
                      'SYSTEM_ADMIN'
                      ? visibleReimbursements.length
                      : visibleReimbursements.filter(
                          item =>
                            item.userId ===
                            currentUser.id
                        ).length}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReimbursementListFilter(
                      'ACTION'
                    )
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    reimbursementListFilter ===
                    'ACTION'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-gray-200 bg-white hover:border-amber-200'
                  }`}
                >
                  <div className="text-[9px] font-black uppercase tracking-wide text-amber-700">
                    Menunggu Action Saya
                  </div>

                  <div className="mt-1 text-xl font-black text-gray-950">
                    {actionReimbursements.length}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setReimbursementListFilter(
                      'APPROVED'
                    )
                  }
                  className={`rounded-xl border p-4 text-left transition ${
                    reimbursementListFilter ===
                    'APPROVED'
                      ? 'border-emerald-400 bg-emerald-50'
                      : 'border-gray-200 bg-white hover:border-emerald-200'
                  }`}
                >
                  <div className="text-[9px] font-black uppercase tracking-wide text-emerald-700">
                    Approved for Payment
                  </div>

                  <div className="mt-1 text-xl font-black text-gray-950">
                    {
                      visibleReimbursements.filter(
                        item =>
                          item.status ===
                            'Approved for Payment' ||
                          item.status ===
                            'Approved TL MS' ||
                          item.status ===
                            'Paid Finance'
                      ).length
                    }
                  </div>
                </button>
              </div>

              <Card className="border-gray-200">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold">
                        Reimbursement Aktivitas Marketing
                      </CardTitle>

                      <CardDescription className="mt-1 text-xs">
                        Submitter → Atasan Langsung → Marketing Administration → Department Head Marketing Administration → Approved for Payment.
                      </CardDescription>

                      {isMarketingSupportUser ? (
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-800">
                          <b>Monitoring Marketing Support:</b> seluruh pengajuan Marketing terlihat sejak status Submitted. Action tetap mengikuti kewenangan workflow: Atasan Langsung → Marketing Administration → Department Head Marketing Administration.
                        </div>
                      ) : (
                        <p className="mt-2 text-[10px] text-gray-500">
                          Reimbursement tetap bisa diajukan walaupun Estimasi/Biaya Aktivitas sebelumnya kosong.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {reimbursementListFilter !==
                        'ALL' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setReimbursementListFilter(
                              'ALL'
                            )
                          }
                          className="h-8 text-[10px]"
                        >
                          Tampilkan Semua
                        </Button>
                      )}

                      {isMarketingUser && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            openReimbursementForm()
                          }
                          className="h-8 gap-1.5 bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-700"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Ajukan Reimbursement
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {filteredReimbursements.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center text-xs text-gray-400">
                      {isMarketingSupportUser
                        ? 'Belum ada reimbursement Marketing pada filter ini.'
                        : 'Tidak ada reimbursement pada filter ini.'}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1120px] text-left text-xs">
                        <thead className="border-b border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">
                          <tr>
                            <th className="p-3">
                              ID RMB
                            </th>

                            <th className="p-3">
                              Aktivitas
                            </th>

                            <th className="p-3">
                              Pegawai
                            </th>

                            <th className="p-3">
                              Klien
                            </th>

                            <th className="p-3">
                              Jenis Biaya
                            </th>

                            <th className="p-3">
                              Nominal
                            </th>

                            <th className="p-3">
                              Workflow
                            </th>

                            <th className="p-3">
                              Bukti
                            </th>

                            <th className="p-3 text-right">
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-100">
                          {filteredReimbursements.map(
                            reimbursement => (
                              <tr
                                key={
                                  reimbursement.id
                                }
                                className="hover:bg-gray-50"
                              >
                                <td className="p-3 font-mono font-bold text-blue-700">
                                  {reimbursement.id}
                                </td>

                                <td className="p-3">
                                  <div className="font-mono text-[10px] font-bold text-gray-800">
                                    {reimbursement.activityId}
                                  </div>

                                  <div className="mt-1 text-[9px] text-gray-400">
                                    {formatDate(
                                      reimbursement.activityDate
                                    )}
                                  </div>
                                </td>

                                <td className="p-3 font-semibold text-gray-900">
                                  {reimbursement.userName}
                                </td>

                                <td className="p-3 text-gray-700">
                                  {reimbursement.companyName}
                                </td>

                                <td className="p-3 text-gray-600">
                                  {reimbursement.reimbursementType}
                                </td>

                                <td className="p-3 font-bold text-gray-900">
                                  {formatRupiah(
                                    reimbursement.amount
                                  )}
                                </td>

                                <td className="p-3">
                                  <div className="max-w-[240px]">
                                    <StatusBadge
                                      status={
                                        reimbursement.status
                                      }
                                    />

                                    <div className="mt-1 text-[9px] leading-relaxed text-gray-500">
                                      {getReimbursementWorkflowLabel(
                                        reimbursement
                                      )}
                                    </div>

                                    {isMarketingSupportUser &&
                                      reimbursement.status ===
                                        'Submitted' && (
                                      <div className="mt-1 text-[9px] font-semibold leading-relaxed text-amber-700">
                                        Sudah masuk monitoring Marketing Support; menunggu keputusan atasan langsung sebelum dapat diverifikasi Marketing Administration.
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="p-3">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                      !reimbursement.receiptFileId
                                    }
                                    onClick={() =>
                                      void handleDownloadReceipt(
                                        reimbursement
                                      )
                                    }
                                    className="h-7 gap-1 text-[9px]"
                                  >
                                    <Download className="h-3 w-3" />
                                    Receipt
                                  </Button>
                                </td>

                                <td className="p-3 text-right">
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setHistoryReimbursement(
                                          reimbursement
                                        )
                                      }
                                      className="h-8 gap-1 text-[9px] font-bold"
                                    >
                                      <History className="h-3 w-3" />
                                      Riwayat
                                    </Button>

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={
                                        canTakeReimbursementAction(
                                          reimbursement
                                        )
                                          ? 'default'
                                          : 'outline'
                                      }
                                      onClick={() => {
                                        setSelectedReimbursementReview(
                                          reimbursement
                                        );

                                        setReimbursementReviewNotes('');
                                      }}
                                      className={`h-8 text-[9px] font-bold ${
                                        canTakeReimbursementAction(
                                          reimbursement
                                        )
                                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                                          : ''
                                      }`}
                                    >
                                      {reimbursementActionLabel(
                                        reimbursement
                                      )}
                                    </Button>
                                  </div>
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
          )}

        </Tabs>

        {/* ==================================================
            POPUP — AJUKAN REIMBURSEMENT
        =================================================== */}
        {reimbursementFormOpen && (
          <div
            className="fixed inset-0 z-[105] flex items-center justify-center bg-black/45 p-4"
            onClick={() =>
              setReimbursementFormOpen(
                false
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
                    Ajukan Reimbursement
                  </h2>

                  <p className="mt-1 text-[10px] text-gray-500">
                    Pilih salah satu aktivitas Anda. Estimasi biaya pada aktivitas tidak wajib untuk mengajukan reimbursement.
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setReimbursementFormOpen(
                      false
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 p-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Aktivitas *
                  </label>

                  <Select
                    value={
                      reimbursementActivityId
                    }
                    onValueChange={
                      handleSelectReimbursementActivity
                    }
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="Pilih aktivitas milik Anda..." />
                    </SelectTrigger>

                    <SelectContent
                      position="popper"
                      className="z-[140] max-h-72"
                    >
                      {ownReimbursementActivities.map(
                        activity => (
                          <SelectItem
                            key={
                              activity.id
                            }
                            value={
                              activity.id
                            }
                          >
                            {activity.id} • {activity.companyName} • {formatDate(activity.activityDate)}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>

                  {ownReimbursementActivities.length ===
                    0 && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      Tidak ada aktivitas yang tersedia. Aktivitas dengan reimbursement aktif tidak dapat diajukan ulang kecuali pengajuan sebelumnya Rejected.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Jenis Biaya *
                  </label>

                  <Select
                    value={
                      reimbursementType
                    }
                    onValueChange={
                      value =>
                        setReimbursementType(
                          value as
                            ReimbursementType
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
                      {REIMBURSEMENT_TYPES.map(
                        type => (
                          <SelectItem
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Tanggal Pengeluaran *
                  </label>

                  <Input
                    type="date"
                    value={
                      reimbursementExpenseDate
                    }
                    onChange={
                      event =>
                        setReimbursementExpenseDate(
                          event.target.value
                        )
                    }
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Nominal Reimbursement (Rp) *
                  </label>

                  <Input
                    type="text"
                    inputMode="numeric"
                    value={
                      formatRupiahInput(
                        reimbursementAmount
                      )
                    }
                    onChange={
                      event =>
                        setReimbursementAmount(
                          sanitizeRupiahInput(
                            event.target.value
                          )
                        )
                    }
                    placeholder="Rp250.000"
                    className="font-mono text-xs"
                  />

                  {reimbursementActivityId &&
                    activities.find(
                      item =>
                        item.id ===
                        reimbursementActivityId
                    )?.expenseAmount ? (
                    <p className="mt-1 text-[9px] text-gray-500">
                      Estimasi biaya pada aktivitas: {formatRupiah(
                        activities.find(
                          item =>
                            item.id ===
                            reimbursementActivityId
                        )?.expenseAmount ||
                        0
                      )}. Nominal reimbursement tetap dapat disesuaikan dengan bukti aktual.
                    </p>
                  ) : (
                    <p className="mt-1 text-[9px] text-blue-600">
                      Aktivitas ini tidak memiliki estimasi biaya. Silakan isi nominal aktual sesuai bukti.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Bukti / Receipt *
                  </label>

                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={
                      event =>
                        setReimbursementReceipt(
                          event.target.files?.[0] ||
                          null
                        )
                    }
                    className="text-xs"
                  />

                  {reimbursementReceipt && (
                    <p className="mt-1 text-[9px] text-gray-500">
                      {reimbursementReceipt.name} • {Math.max(
                        1,
                        Math.round(
                          reimbursementReceipt.size /
                          1024
                        )
                      )} KB
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-gray-700">
                    Deskripsi *
                  </label>

                  <Textarea
                    value={
                      reimbursementDescription
                    }
                    onChange={
                      event =>
                        setReimbursementDescription(
                          event.target.value
                        )
                    }
                    placeholder="Jelaskan pengeluaran yang diklaim..."
                    className="min-h-28 text-xs"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setReimbursementFormOpen(
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
                    reimbursementBusy ||
                    !reimbursementActivityId ||
                    !reimbursementAmount ||
                    !reimbursementDescription.trim() ||
                    !reimbursementReceipt
                  }
                  onClick={() =>
                    void handleSubmitReimbursement()
                  }
                  className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  {reimbursementBusy
                    ? 'Menyimpan...'
                    : 'Submit Reimbursement'}
                </Button>
              </div>
            </div>
          </div>
        )}

        <ActionHistoryModal
          open={
            Boolean(
              historyReimbursement
            )
          }
          onClose={() =>
            setHistoryReimbursement(
              null
            )
          }
          title={
            historyReimbursement
              ? `Riwayat Aksi • ${historyReimbursement.id}`
              : 'Riwayat Aksi Reimbursement'
          }
          subtitle={
            historyReimbursement
              ? `${historyReimbursement.userName} • ${historyReimbursement.companyName} • ${formatRupiah(historyReimbursement.amount)}`
              : undefined
          }
          entries={
            historyReimbursement
              ? buildReimbursementHistory(
                  historyReimbursement
                )
              : []
          }
        />

        {/* ==================================================
            POPUP — REVIEW REIMBURSEMENT
        =================================================== */}
        {selectedReimbursementReview && (
          <div
            className="fixed inset-0 z-[108] flex items-center justify-center bg-black/45 p-4"
            onClick={() =>
              setSelectedReimbursementReview(
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
                    {reimbursementActionLabel(
                      selectedReimbursementReview
                    )} • {selectedReimbursementReview.id}
                  </h2>

                  <p className="mt-1 text-[10px] text-gray-500">
                    {getReimbursementWorkflowLabel(
                      selectedReimbursementReview
                    )}
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSelectedReimbursementReview(
                      null
                    )
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[9px] font-black uppercase text-gray-400">
                      Submitter
                    </div>

                    <div className="mt-1 text-xs font-black text-gray-900">
                      {selectedReimbursementReview.userName}
                    </div>

                    <div className="mt-1 text-[10px] text-gray-500">
                      {selectedReimbursementReview.activityId} • {selectedReimbursementReview.companyName}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-[9px] font-black uppercase text-emerald-600">
                      Nominal
                    </div>

                    <div className="mt-1 text-lg font-black text-emerald-950">
                      {formatRupiah(
                        selectedReimbursementReview.amount
                      )}
                    </div>

                    <div className="mt-1 text-[10px] text-emerald-700">
                      {selectedReimbursementReview.reimbursementType}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="grid gap-3 text-[10px] sm:grid-cols-2">
                    <div>
                      <span className="font-bold text-gray-500">
                        Tanggal Aktivitas:
                      </span>{' '}
                      {formatDate(
                        selectedReimbursementReview.activityDate
                      )}
                    </div>

                    <div>
                      <span className="font-bold text-gray-500">
                        Tanggal Pengeluaran:
                      </span>{' '}
                      {selectedReimbursementReview.expenseDate
                        ? formatDate(
                            selectedReimbursementReview.expenseDate
                          )
                        : '-'}
                    </div>

                    <div>
                      <span className="font-bold text-gray-500">
                        Atasan Langsung:
                      </span>{' '}
                      {selectedReimbursementReview.directSuperiorName ||
                        '-'}
                    </div>

                    <div>
                      <span className="font-bold text-gray-500">
                        Dibuat:
                      </span>{' '}
                      {new Date(
                        selectedReimbursementReview.createdAt
                      ).toLocaleString(
                        'id-ID'
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-[9px] font-black uppercase text-gray-400">
                      Deskripsi
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-gray-700">
                      {selectedReimbursementReview.description}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[10px] font-black uppercase text-gray-500">
                    Bukti / Receipt
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !selectedReimbursementReview.receiptFileId
                    }
                    onClick={() =>
                      void handleDownloadReceipt(
                        selectedReimbursementReview
                      )
                    }
                    className="gap-2 text-xs"
                  >
                    <Download className="h-4 w-4" />
                    {selectedReimbursementReview.receiptFileName ||
                      'Receipt'}
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className={`rounded-lg border p-3 ${
                    selectedReimbursementReview.superiorApprovedAt
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="text-[9px] font-black uppercase text-gray-500">
                      1. Atasan Langsung
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-gray-800">
                      {selectedReimbursementReview.superiorApprovedByName ||
                        selectedReimbursementReview.superiorApprovedBy ||
                        'Menunggu'}
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${
                    selectedReimbursementReview.marketingAdminVerifiedAt ||
                    selectedReimbursementReview.msVerifiedAt
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="text-[9px] font-black uppercase text-gray-500">
                      2. Marketing Administration
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-gray-800">
                      {selectedReimbursementReview.marketingAdminVerifiedByName ||
                        selectedReimbursementReview.msVerifiedBy ||
                        'Menunggu'}
                    </div>
                  </div>

                  <div className={`rounded-lg border p-3 ${
                    selectedReimbursementReview.finalApprovedAt ||
                    selectedReimbursementReview.tlApprovedAt
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="text-[9px] font-black uppercase text-gray-500">
                      3. DH Marketing Administration
                    </div>

                    <div className="mt-1 text-[10px] font-semibold text-gray-800">
                      {selectedReimbursementReview.finalApprovedByName ||
                        selectedReimbursementReview.tlApprovedBy ||
                        'Menunggu'}
                    </div>
                  </div>
                </div>

                {selectedReimbursementReview.rejectionReason && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <b>Alasan Reject:</b>{' '}
                    {selectedReimbursementReview.rejectionReason}
                  </div>
                )}

                {canTakeReimbursementAction(
                  selectedReimbursementReview
                ) && (
                  <div>
                    <label className="mb-1 block text-xs font-bold text-gray-700">
                      Catatan Review
                    </label>

                    <Textarea
                      value={
                        reimbursementReviewNotes
                      }
                      onChange={
                        event =>
                          setReimbursementReviewNotes(
                            event.target.value
                          )
                      }
                      placeholder="Opsional untuk approve, wajib jika reject."
                      className="min-h-24 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setSelectedReimbursementReview(
                      null
                    )
                  }
                  className="text-xs"
                >
                  Tutup
                </Button>

                {canTakeReimbursementAction(
                  selectedReimbursementReview
                ) && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleReimbursementDecision(
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
                        handleReimbursementDecision(
                          true
                        )
                      }
                      className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Approve & Lanjutkan
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================
            POPUP — CREATE ACTIVITY
        =================================================== */}

        {activityFormOpen && (

          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">

            <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">

                <div>

                  <div className="flex items-center gap-2">

                    <CalendarCheck className="h-5 w-5 text-blue-600" />

                    <h2 className="text-lg font-black text-gray-900">
                      Form Aktivitas Pemasaran
                    </h2>

                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    Owner aktivitas: {currentUser.name} • {currentUser.department}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActivityFormOpen(
                      false
                    )
                  }
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <form
                onSubmit={
                  handleCreateActivity
                }
              >

                <div className="space-y-5 px-6 py-5">

                  {/* BASIC SCHEDULE */}

                  <div>

                    <div className="mb-3 text-xs font-black uppercase tracking-wide text-gray-700">
                      Jadwal & Jenis Kegiatan
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Tanggal *
                        </label>

                        <Input
                          type="date"
                          min={
                            todayKey
                          }
                          value={
                            activityDate
                          }
                          onChange={
                            event =>
                              setActivityDate(
                                event.target.value
                              )
                          }
                          className="text-xs"
                          required
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Mulai
                        </label>

                        <Input
                          type="time"
                          value={
                            startTime
                          }
                          onChange={
                            event =>
                              setStartTime(
                                event.target.value
                              )
                          }
                          className="text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Selesai
                        </label>

                        <Input
                          type="time"
                          value={
                            endTime
                          }
                          onChange={
                            event =>
                              setEndTime(
                                event.target.value
                              )
                          }
                          className="text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Jenis Aktivitas
                        </label>

                        <Select
                          value={
                            activityType
                          }
                          onValueChange={
                            value =>
                              setActivityType(
                                value as ActivityType
                              )
                          }
                        >

                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="z-[120]">

                            {ACTIVITY_TYPES.map(
                              type => (

                                <SelectItem
                                  key={
                                    type
                                  }
                                  value={
                                    type
                                  }
                                >
                                  {type}
                                </SelectItem>

                              )
                            )}

                          </SelectContent>

                        </Select>

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Status
                        </label>

                        <Select
                          value={
                            activityStatus
                          }
                          onValueChange={
                            value =>
                              setActivityStatus(
                                value as ActivityStatus
                              )
                          }
                        >

                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="z-[120]">

                            {ACTIVITY_STATUSES.map(
                              status => (

                                <SelectItem
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {status}
                                </SelectItem>

                              )
                            )}

                          </SelectContent>

                        </Select>

                      </div>

                    </div>

                  </div>

                  {/* PIPELINE LINK */}

                  <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <div className="flex items-center gap-2 text-xs font-black text-violet-900">

                          <Briefcase className="h-4 w-4" />

                          Terkait Pipeline Aktif?
                        </div>

                        <p className="mt-1 text-[10px] text-violet-700">
                          Jika Ya, perusahaan dan produk otomatis mengikuti pipeline.
                        </p>

                      </div>

                      <div className="flex gap-2">

                        <Button
                          type="button"
                          size="sm"
                          variant={
                            relatedToPipeline
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() =>
                            setRelatedToPipeline(
                              true
                            )
                          }
                          className="h-8 text-[10px]"
                        >
                          Ya
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant={
                            !relatedToPipeline
                              ? 'default'
                              : 'outline'
                          }
                          onClick={() => {
                            setRelatedToPipeline(
                              false
                            );

                            setRelatedPipelineId(
                              ''
                            );

                            setPipelineSearch('');
                          }}
                          className="h-8 text-[10px]"
                        >
                          Tidak
                        </Button>

                      </div>

                    </div>

                    {relatedToPipeline && (

                      <div className="mt-3">

                        <label className="mb-1 block text-[11px] font-bold text-violet-900">
                          Cari Pipeline Aktif *
                        </label>

                        {selectedPipeline ? (

                          <div className="rounded-xl border border-violet-200 bg-white p-3">

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                              <div className="min-w-0">

                                <div className="font-mono text-[10px] font-black text-violet-700">
                                  {selectedPipeline.id}
                                </div>

                                <div className="mt-0.5 text-xs font-black text-gray-900">
                                  {selectedPipeline.customerName}
                                </div>

                                <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-500">

                                  <span>
                                    {selectedPipeline.productName}
                                  </span>

                                  <span>
                                    •
                                  </span>

                                  <span>
                                    PIC: {selectedPipeline.picName}
                                  </span>

                                  <span>
                                    •
                                  </span>

                                  <span>
                                    {formatRupiah(
                                      selectedPipeline.currentCommercialValue
                                    )}
                                  </span>

                                </div>

                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRelatedPipelineId('');
                                  setPipelineSearch('');
                                }}
                                className="h-8 shrink-0 text-[10px]"
                              >
                                Ganti Pipeline
                              </Button>

                            </div>

                          </div>

                        ) : (

                          <>

                            <div className="relative">

                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                              <Input
                                value={
                                  pipelineSearch
                                }
                                onChange={
                                  event =>
                                    setPipelineSearch(
                                      event.target.value
                                    )
                                }
                                placeholder="Cari ID pipeline, perusahaan, produk, atau PIC..."
                                className="bg-white pl-9 text-xs"
                                autoFocus
                              />

                            </div>

                            {normalizedPipelineSearch.length <
                            2 ? (

                              <div className="mt-2 rounded-lg border border-dashed border-violet-200 bg-white/70 px-3 py-3 text-[10px] text-violet-700">
                                Ketik minimal 2 karakter. Sistem tidak menampilkan seluruh pipeline sekaligus supaya tetap cepat walaupun pipeline berjumlah ribuan.
                              </div>

                            ) : pipelineSearchResults.length ===
                            0 ? (

                              <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-[10px] text-gray-400">
                                Pipeline aktif tidak ditemukan.
                              </div>

                            ) : (

                              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-violet-100 bg-white">

                                {pipelineSearchResults.map(
                                  pipeline => (

                                    <button
                                      key={
                                        pipeline.id
                                      }
                                      type="button"
                                      onClick={() =>
                                        handlePipelineChange(
                                          pipeline.id
                                        )
                                      }
                                      className="flex w-full items-start justify-between gap-3 border-b border-gray-100 px-3 py-3 text-left last:border-b-0 hover:bg-violet-50"
                                    >

                                      <div className="min-w-0">

                                        <div className="font-mono text-[10px] font-black text-violet-700">
                                          {pipeline.id}
                                        </div>

                                        <div className="mt-0.5 truncate text-[11px] font-bold text-gray-900">
                                          {pipeline.customerName}
                                        </div>

                                        <div className="mt-0.5 truncate text-[9px] text-gray-500">
                                          {pipeline.productName} • PIC {pipeline.picName}
                                        </div>

                                      </div>

                                      <div className="shrink-0 text-right text-[9px] font-bold text-gray-600">
                                        {formatRupiah(
                                          pipeline.currentCommercialValue
                                        )}
                                      </div>

                                    </button>

                                  )
                                )}

                                {pipelineSearchResults.length >=
                                  50 && (

                                  <div className="bg-gray-50 px-3 py-2 text-center text-[9px] text-gray-500">
                                    Maksimum 50 hasil ditampilkan. Persempit kata pencarian untuk hasil lebih spesifik.
                                  </div>

                                )}

                              </div>

                            )}

                          </>

                        )}

                      </div>

                    )}

                  </div>

                  {/* CLIENT / ACTIVITY DETAIL */}

                  <div>

                    <div className="mb-3 text-xs font-black uppercase tracking-wide text-gray-700">
                      Detail Kegiatan
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Nama Perusahaan *
                        </label>

                        <Input
                          value={
                            companyName
                          }
                          onChange={
                            event =>
                              setCompanyName(
                                event.target.value
                              )
                          }
                          disabled={
                            relatedToPipeline &&
                            Boolean(
                              relatedPipelineId
                            )
                          }
                          placeholder="Contoh: PT Pertamina Hulu Rokan"
                          className="text-xs"
                          required
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Produk Dibahas
                        </label>

                        <Input
                          value={
                            discussedProduct
                          }
                          onChange={
                            event =>
                              setDiscussedProduct(
                                event.target.value
                              )
                          }
                          disabled={
                            relatedToPipeline &&
                            Boolean(
                              relatedPipelineId
                            )
                          }
                          placeholder="Nama produk"
                          className="text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Orang yang Ditemui
                        </label>

                        <Input
                          value={
                            personMet
                          }
                          onChange={
                            event =>
                              setPersonMet(
                                event.target.value
                              )
                          }
                          placeholder="Nama PIC Klien"
                          className="text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Jabatan
                        </label>

                        <Input
                          value={
                            positionMet
                          }
                          onChange={
                            event =>
                              setPositionMet(
                                event.target.value
                              )
                          }
                          placeholder="Contoh: VP Human Capital"
                          className="text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Metode Interaksi
                        </label>

                        <Select
                          value={
                            interactionMethod
                          }
                          onValueChange={
                            value =>
                              setInteractionMethod(
                                value as InteractionMethod
                              )
                          }
                        >

                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="z-[120]">

                            {INTERACTION_METHODS.map(
                              method => (

                                <SelectItem
                                  key={
                                    method
                                  }
                                  value={
                                    method
                                  }
                                >
                                  {method}
                                </SelectItem>

                              )
                            )}

                          </SelectContent>

                        </Select>

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Lokasi
                        </label>

                        <Input
                          value={
                            location
                          }
                          onChange={
                            event =>
                              setLocation(
                                event.target.value
                              )
                          }
                          placeholder="Kantor klien / Teams / Zoom"
                          className="text-xs"
                        />

                      </div>

                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Tujuan *
                        </label>

                        <Textarea
                          value={
                            purpose
                          }
                          onChange={
                            event =>
                              setPurpose(
                                event.target.value
                              )
                          }
                          placeholder="Tujuan utama kegiatan..."
                          className="min-h-24 text-xs"
                          required
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Agenda
                        </label>

                        <Textarea
                          value={
                            agenda
                          }
                          onChange={
                            event =>
                              setAgenda(
                                event.target.value
                              )
                          }
                          placeholder="Agenda pembahasan..."
                          className="min-h-24 text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Hasil / Outcome
                        </label>

                        <Textarea
                          value={
                            result
                          }
                          onChange={
                            event =>
                              setResult(
                                event.target.value
                              )
                          }
                          placeholder="Hasil kegiatan..."
                          className="min-h-20 text-xs"
                        />

                      </div>

                      <div>

                        <label className="mb-1 block text-[11px] font-bold text-gray-700">
                          Follow Up
                        </label>

                        <Textarea
                          value={
                            followUp
                          }
                          onChange={
                            event =>
                              setFollowUp(
                                event.target.value
                              )
                          }
                          placeholder="Tindak lanjut berikutnya..."
                          className="min-h-20 text-xs"
                        />

                      </div>

                    </div>

                  </div>

                  {/* INVITE INTERNAL USERS */}

                  <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">

                    <div className="flex items-center gap-2 text-xs font-black text-cyan-900">

                      <Users className="h-4 w-4" />

                      Ajak Rekan / Participant Internal
                    </div>

                    <p className="mt-1 text-[10px] text-cyan-700">
                      Akun yang dipilih akan memperoleh shared visibility terhadap aktivitas ini.
                    </p>

                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[240px_minmax(0,1fr)]">

                      <Select
                        value={
                          inviteFunctionFilter
                        }
                        onValueChange={
                          value => {
                            setInviteFunctionFilter(
                              value
                            );

                            setInviteSearch('');
                          }
                        }
                      >

                        <SelectTrigger className="bg-white text-xs">
                          <SelectValue placeholder="Pilih Fungsi / Unit" />
                        </SelectTrigger>

                        <SelectContent className="z-[120]">

                          <SelectItem value="ALL">
                            Semua Fungsi
                          </SelectItem>

                          {inviteFunctionOptions.map(
                            functionName => (

                              <SelectItem
                                key={
                                  functionName
                                }
                                value={
                                  functionName
                                }
                              >
                                {functionName}
                              </SelectItem>

                            )
                          )}

                        </SelectContent>

                      </Select>

                      <div className="relative">

                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                        <Input
                          value={
                            inviteSearch
                          }
                          onChange={
                            event =>
                              setInviteSearch(
                                event.target.value
                              )
                          }
                          placeholder={
                            inviteFunctionFilter ===
                            'ALL'
                              ? 'Cari nama, jabatan, department...'
                              : `Cari di ${inviteFunctionFilter}...`
                          }
                          className="bg-white pl-9 text-xs"
                        />

                      </div>

                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-cyan-700">

                      <span>
                        Filter fungsi dulu untuk mempersempit daftar akun, lalu cari nama bila diperlukan.
                      </span>

                      <span className="font-bold">
                        {inviteCandidates.length} akun ditemukan
                      </span>

                    </div>

                    <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-cyan-100 bg-white">

                      {inviteCandidates.length ===
                      0 ? (

                        <div className="px-3 py-6 text-center text-[10px] text-gray-400">
                          Tidak ada akun yang sesuai filter.
                        </div>

                      ) : inviteCandidates.map(
                        user => {

                          const checked =
                            taggedUserIds.includes(
                              user.id
                            );

                          return (

                            <label
                              key={
                                user.id
                              }
                              className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 last:border-b-0 hover:bg-cyan-50/40"
                            >

                              <div className="min-w-0">

                                <div className="truncate text-[11px] font-bold text-gray-900">
                                  {user.name}
                                </div>

                                <div className="truncate text-[9px] text-gray-500">
                                  {user.position} • {user.department !== 'None' ? user.department : user.unit}
                                </div>

                                <div className="mt-0.5 text-[9px] font-semibold text-cyan-700">
                                  {getUserFunctionLabel(
                                    user
                                  )}
                                </div>

                              </div>

                              <input
                                type="checkbox"
                                checked={
                                  checked
                                }
                                onChange={() =>
                                  toggleTaggedUser(
                                    user.id
                                  )
                                }
                                className="h-4 w-4 shrink-0"
                              />

                            </label>

                          );
                        }
                      )}

                    </div>

                    {taggedUserIds.length >
                      0 && (

                      <div className="mt-2 text-[10px] font-bold text-cyan-800">
                        {taggedUserIds.length} akun diundang
                      </div>

                    )}

                  </div>

                  {/* EXPENSE */}

                  <div>

                    <label className="mb-1 block text-[11px] font-bold text-gray-700">
                      Estimasi / Biaya Aktivitas (Rp)
                    </label>

                    <Input
                      type="text"
                      inputMode="numeric"
                      value={
                        formatRupiahInput(
                          expenseAmount
                        )
                      }
                      onChange={
                        event =>
                          setExpenseAmount(
                            sanitizeRupiahInput(
                              event.target.value
                            )
                          )
                      }
                      placeholder="Rp0"
                      className="max-w-sm font-mono text-xs"
                    />

                    <p className="mt-1 text-[10px] text-gray-400">
                      Reimbursement tetap diajukan terpisah setelah aktivitas tercatat.
                    </p>

                  </div>

                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-6 py-4">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setActivityFormOpen(
                        false
                      )
                    }
                    className="text-xs"
                  >
                    Batal
                  </Button>

                  <Button
                    type="submit"
                    className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Simpan Aktivitas
                  </Button>

                </div>

              </form>

            </div>

          </div>

        )}

        {/* ==================================================
            POPUP — DAY DETAIL
        =================================================== */}

        {dayDetailOpen &&
          selectedDayKey && (

          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 p-4">

            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">

                <div>

                  <h2 className="text-base font-black text-gray-900">
                    {formatDayTitle(
                      selectedDayKey
                    )}
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    {selectedDayActivities.length} aktivitas terdaftar
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setDayDetailOpen(
                      false
                    )
                  }
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <div className="space-y-3 px-6 py-5">

                {selectedDayActivities.map(
                  activity => {

                    const linkedPipeline =
                      linkedPipelineForActivity(
                        activity
                      );

                    return (

                      <button
                        key={
                          activity.id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedActivityDetail(
                            activity
                          )
                        }
                        className="w-full rounded-xl border border-gray-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50/20"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div>

                            <div className="text-xs font-black text-gray-900">
                              {activity.startTime}-{activity.endTime} • {activity.companyName}
                            </div>

                            <div className="mt-1 text-[10px] text-gray-500">
                              {activity.ownerName} • {activity.department} • {activity.activityType}
                            </div>

                          </div>

                          <StatusBadge
                            status={
                              activity.status
                            }
                          />

                        </div>

                        <p className="mt-2 text-xs text-gray-600">
                          {activity.purpose}
                        </p>

                        {linkedPipeline && (

                          <div className="mt-2 text-[10px] font-bold text-violet-700">
                            {linkedPipeline.id} • {linkedPipeline.productName}
                          </div>

                        )}

                      </button>

                    );
                  }
                )}

              </div>

              <div className="sticky bottom-0 flex justify-end border-t border-gray-100 bg-white px-6 py-4">

                {selectedDayKey >=
                  todayKey && (

                  <Button
                    type="button"
                    onClick={() => {
                      setDayDetailOpen(
                        false
                      );

                      openCreateActivity(
                        selectedDayKey
                      );
                    }}
                    className="gap-2 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Aktivitas Tanggal Ini
                  </Button>

                )}

              </div>

            </div>

          </div>

        )}

        {/* ==================================================
            POPUP — ACTIVITY DETAIL
        =================================================== */}

        {selectedActivityDetail && (

          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">

            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-100 bg-white px-6 py-5">

                <div>

                  <div className="flex flex-wrap items-center gap-2">

                    <span className="font-mono text-xs font-black text-blue-700">
                      {selectedActivityDetail.id}
                    </span>

                    <StatusBadge
                      status={
                        selectedActivityDetail.status
                      }
                    />

                  </div>

                  <h2 className="mt-1 text-base font-black text-gray-900">
                    {selectedActivityDetail.companyName}
                  </h2>

                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(selectedActivityDetail.activityDate)} • {selectedActivityDetail.startTime}-{selectedActivityDetail.endTime}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedActivityDetail(
                      null
                    );

                    setCommentHistoryOpen(
                      false
                    );
                  }}
                  className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>

              <div className="space-y-5 px-6 py-5">

                {selectedActivityDetail.ownerUserId ===
                  currentUser.id &&
                  selectedActivityDetail.activityDate <=
                    todayKey &&
                  !FINAL_ACTIVITY_STATUSES.has(
                    selectedActivityDetail.status
                  ) && (

                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">

                    <div className="text-xs font-black text-rose-900">
                      Final status belum diberikan
                    </div>

                    <p className="mt-1 text-[10px] leading-relaxed text-rose-700">
                      Aktivitas ini wajib ditutup dengan final status. Selama masih belum final dan tanggalnya sudah terlewat, PIC tidak dapat menambahkan aktivitas baru.
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">

                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          handleFinalizeActivity(
                            selectedActivityDetail,
                            'Completed'
                          )
                        }
                        className="h-8 bg-emerald-600 text-[10px] font-bold text-white hover:bg-emerald-700"
                      >
                        Completed
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleFinalizeActivity(
                            selectedActivityDetail,
                            'Rescheduled'
                          )
                        }
                        className="h-8 border-amber-300 text-[10px] font-bold text-amber-800 hover:bg-amber-50"
                      >
                        Rescheduled
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleFinalizeActivity(
                            selectedActivityDetail,
                            'Cancelled'
                          )
                        }
                        className="h-8 border-rose-300 text-[10px] font-bold text-rose-800 hover:bg-rose-50"
                      >
                        Cancelled
                      </Button>

                    </div>

                  </div>

                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">

                    <div className="text-[9px] font-bold uppercase text-gray-500">
                      Owner
                    </div>

                    <div className="mt-1 text-xs font-black text-gray-900">
                      {selectedActivityDetail.ownerName}
                    </div>

                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {selectedActivityDetail.department}
                    </div>

                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">

                    <div className="text-[9px] font-bold uppercase text-gray-500">
                      Jenis / Metode
                    </div>

                    <div className="mt-1 text-xs font-black text-gray-900">
                      {selectedActivityDetail.activityType}
                    </div>

                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {selectedActivityDetail.interactionMethod}
                    </div>

                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">

                    <div className="text-[9px] font-bold uppercase text-gray-500">
                      Lokasi
                    </div>

                    <div className="mt-1 text-xs font-black text-gray-900">
                      {selectedActivityDetail.location}
                    </div>

                  </div>

                </div>

                {selectedActivityDetail.relatedPipelineId && (

                  <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">

                    <div className="flex items-center gap-2 text-xs font-black text-violet-900">

                      <Link2 className="h-4 w-4" />
                      Pipeline Terkait
                    </div>

                    <div className="mt-2 text-xs font-bold text-violet-800">
                      {selectedActivityDetail.relatedPipelineId}
                    </div>

                    <div className="mt-0.5 text-[10px] text-violet-700">
                      {linkedPipelineForActivity(selectedActivityDetail)?.customerName || selectedActivityDetail.companyName} • {linkedPipelineForActivity(selectedActivityDetail)?.productName || selectedActivityDetail.discussedProduct}
                    </div>

                  </div>

                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  <div>

                    <div className="text-[10px] font-bold uppercase text-gray-500">
                      Tujuan
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-gray-700">
                      {selectedActivityDetail.purpose}
                    </p>

                  </div>

                  <div>

                    <div className="text-[10px] font-bold uppercase text-gray-500">
                      Agenda
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-gray-700">
                      {selectedActivityDetail.agenda || '-'}
                    </p>

                  </div>

                  <div>

                    <div className="text-[10px] font-bold uppercase text-gray-500">
                      Hasil
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-gray-700">
                      {selectedActivityDetail.result || '-'}
                    </p>

                  </div>

                  <div>

                    <div className="text-[10px] font-bold uppercase text-gray-500">
                      Follow Up
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-gray-700">
                      {selectedActivityDetail.followUp || '-'}
                    </p>

                  </div>

                </div>

                <div>

                  <div className="text-[10px] font-bold uppercase text-gray-500">
                    Rekan Internal yang Diundang
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">

                    {taggedUsersForActivity(
                      selectedActivityDetail
                    ).length ===
                    0 ? (

                      <span className="text-xs text-gray-400">
                        Tidak ada participant internal.
                      </span>

                    ) : (

                      taggedUsersForActivity(
                        selectedActivityDetail
                      ).map(
                        user => (

                          <Badge
                            key={
                              user.id
                            }
                            variant="outline"
                            className="border-cyan-200 bg-cyan-50 text-[10px] text-cyan-800"
                          >
                            {user.name} • {getUserFunctionLabel(user)}
                          </Badge>

                        )
                      )

                    )}

                  </div>

                </div>

                {selectedActivityDetail.hasExpense &&
                  selectedActivityDetail.expenseAmount ? (

                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    Biaya Aktivitas: <strong>{formatRupiah(selectedActivityDetail.expenseAmount)}</strong>
                  </div>

                ) : null}

                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">

                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <div className="flex items-center gap-2 text-xs font-black text-gray-900">
                        <MessageSquare className="h-4 w-4 text-blue-600" />
                        Feedback & Diskusi
                      </div>

                      <p className="mt-1 text-[10px] text-gray-500">
                        Atasan, PIC, bawahan, dan user yang memiliki visibility aktivitas dapat saling memberi komentar atau membalas.
                      </p>

                    </div>

                    {selectedActivityUnreadCount >
                      0 && (

                      <Badge
                        variant="outline"
                        className="border-rose-300 bg-rose-50 text-[9px] font-bold text-rose-700"
                      >
                        {selectedActivityUnreadCount}{' '}
                        komentar baru
                      </Badge>

                    )}

                  </div>

                  <div className="mt-4 flex gap-2">

                    <Input
                      placeholder="Tulis feedback atau balasan..."
                      value={
                        commentTextMap[
                          selectedActivityDetail.id
                        ] ||
                        ''
                      }
                      onChange={
                        event =>
                          setCommentTextMap(
                            previous => ({
                              ...previous,
                              [selectedActivityDetail.id]:
                                event.target.value,
                            })
                          )
                      }
                      onKeyDown={
                        event => {
                          if (
                            event.key ===
                              'Enter' &&
                            !event.shiftKey
                          ) {
                            event.preventDefault();

                            handleAddComment(
                              selectedActivityDetail.id
                            );
                          }
                        }
                      }
                      className="bg-white text-xs"
                    />

                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        handleAddComment(
                          selectedActivityDetail.id
                        )
                      }
                      className="shrink-0 bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Kirim
                    </Button>

                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen =
                        !commentHistoryOpen;

                      setCommentHistoryOpen(
                        nextOpen
                      );

                      if (
                        nextOpen
                      ) {
                        markActivityCommentsRead(
                          selectedActivityDetail.id
                        );
                      }
                    }}
                    className="mt-4 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-[10px] font-bold text-gray-700 transition hover:bg-gray-50"
                  >
                    <span>
                      {commentHistoryOpen
                        ? 'Sembunyikan history komentar'
                        : `Lihat history komentar (${selectedActivityComments.length})`}
                    </span>

                    <span className="text-gray-400">
                      {commentHistoryOpen
                        ? '▲'
                        : '▼'}
                    </span>
                  </button>

                  {commentHistoryOpen && (

                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-white p-3">

                      {selectedActivityComments.length ===
                      0 ? (

                        <div className="py-5 text-center text-[10px] italic text-gray-400">
                          Belum ada komentar pada aktivitas ini.
                        </div>

                      ) : (

                        selectedActivityComments.map(
                          comment => {
                            const isMine =
                              comment.authorId ===
                              currentUser.id;

                            return (

                              <div
                                key={
                                  comment.id
                                }
                                className={`rounded-lg border p-3 ${
                                  isMine
                                    ? 'ml-8 border-blue-100 bg-blue-50'
                                    : 'mr-8 border-gray-100 bg-gray-50'
                                }`}
                              >

                                <div className="flex flex-wrap items-center justify-between gap-2">

                                  <div>

                                    <span className="text-[10px] font-black text-gray-900">
                                      {comment.authorName}
                                    </span>

                                    <span className="ml-2 text-[9px] text-gray-400">
                                      {comment.authorRole}
                                    </span>

                                  </div>

                                  <span className="text-[9px] text-gray-400">
                                    {new Date(comment.timestamp).toLocaleString('id-ID')}
                                  </span>

                                </div>

                                <p className="mt-1.5 text-[11px] leading-relaxed text-gray-700">
                                  {comment.commentText}
                                </p>

                              </div>

                            );
                          }
                        )

                      )}

                    </div>

                  )}

                </div>

              </div>

            </div>

          </div>

        )}

      </div>

    </AppLayout>
  );
};

export default AktivitasPage;
