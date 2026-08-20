import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { store, OfficialProductionSummary } from '@/services/store';
import {
  Pipeline,
  ProductionTransaction,
  Reimbursement,
  TargetEntry,
  User,
} from '@/types';
import { formatRupiah } from '@/utils/formatters';
import { DashboardTransactionExport } from '@/components/common/DashboardTransactionExport';
import { StatusBadge } from '@/components/common/StatusBadge';
import { MarketingSupportDashboard } from '@/components/dashboard/MarketingSupportDashboard';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  Filter,
  Layers,
  Megaphone,
  Package,
  PieChart as PieIcon,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const Index: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(
    store.getCurrentUser()
  );

  const [selectedYear, setSelectedYear] = useState<number>(2026);

  const [selectedScope, setSelectedScope] =
    useState<string>('ALL');

  const [businessTypeFilter, setBusinessTypeFilter] =
    useState<
      'OVERALL' | 'New Business' | 'Renewal Business'
    >('OVERALL');

  const [activeTab, setActiveTab] =
    useState<string>('overview');

  const [loseMetricMode, setLoseMetricMode] =
    useState<'COUNT' | 'VALUE'>('COUNT');

  const [
    productMixMode,
    setProductMixMode,
  ] = useState<
    'PIPELINE' | 'REALISASI'
  >('PIPELINE');

  const [adminViewMode, setAdminViewMode] =
    useState<
      'AUTO' | 'MARKETING' | 'SUPPORT'
    >('AUTO');

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

  const [targets, setTargets] =
    useState<TargetEntry[]>([]);

  const [
    reimbursements,
    setReimbursements,
  ] =
    useState<
      Reimbursement[]
    >([]);

  // ============================================================
  // PIPELINE MONITORING — LOCAL SEARCH / FILTER
  // ============================================================

  const [
    pipelineSearchQuery,
    setPipelineSearchQuery,
  ] = useState<string>('');

  const [
    pipelinePicFilter,
    setPipelinePicFilter,
  ] = useState<string>('ALL');

  const [
    pipelineProductFilter,
    setPipelineProductFilter,
  ] = useState<string>('ALL');

  const [
    procurementSummaryMode,
    setProcurementSummaryMode,
  ] = useState<
    'NON_TENDER' | 'TENDER'
  >('NON_TENDER');

  useEffect(() => {
    const refresh = () => {
      const user = store.getCurrentUser();

      setCurrentUser(user);

      setPipelines(
        store.getPipelines()
      );

      setProductions(
        store
          .getProductions()
          .filter(
            (production) =>
              production.status === 'POSTED'
          )
      );

      setOfficialProductions(
        store.getOfficialProductionSummaries()
      );

      setTargets(
        store.getTargets()
      );

      setReimbursements(
        store.getReimbursements()
      );
    };

    refresh();

    return store.subscribe(refresh);
  }, []);

  useEffect(() => {
    // Prevent stale hierarchy scope / local pipeline filter
    // when switching login account.
    setSelectedScope('ALL');
    setPipelineSearchQuery('');
    setPipelinePicFilter('ALL');
    setPipelineProductFilter('ALL');
  }, [currentUser.id]);

  // ============================================================
  // ROLE-AWARE DASHBOARD
  // ============================================================

  const isMarketingSupportRole =
    currentUser.unit ===
    'Marketing Support';

  const isSysAdmin =
    currentUser.role === 'SYSTEM_ADMIN';

  const isArianie =
    currentUser.id ===
    'USR-000024';

  const isEndah =
    currentUser.id ===
    'USR-000028';

  const isMarketingAdministrationOperator =
    [
      'USR-000025',
      'USR-000026',
      'USR-000027',
      'USR-000029',
    ].includes(
      currentUser.id
    );

  const isAndi =
    currentUser.id ===
    'USR-000030';

  const isKarina =
    currentUser.id ===
    'USR-000031';

  const pendingDirectSuperiorReimbursements =
    reimbursements.filter(
      reimbursement =>
        reimbursement.status ===
          'Submitted' &&
        reimbursement.directSuperiorId ===
          currentUser.id
    );

  // ============================================================
  // SPECIALIZED MARKETING SUPPORT DASHBOARDS
  // ============================================================
  // Endah, Andi Rita, and Karina intentionally do NOT inherit
  // Marketing premium target cards. Their landing dashboards show
  // only the queues / operational responsibilities owned by them.

  const serviceDocuments =
    (
      isArianie ||
      isEndah ||
      isMarketingAdministrationOperator ||
      isAndi ||
      isKarina
    )
      ? store.getServiceDocuments()
      : [];

  const marcommRequests =
    (
      isAndi ||
      isKarina
    )
      ? store.getMarcommRequests()
      : [];

  const marcommStockOpnames =
    (
      isAndi ||
      isKarina
    )
      ? store.getMarcommStockOpnames()
      : [];

  const bookings =
    (
      isArianie ||
      isEndah ||
      isMarketingAdministrationOperator
    )
      ? store.getBookings()
      : [];

  const activeStatusSet =
    new Set([
      'PENDING_ANDI_APPROVAL',
      'APPROVED_WAITING_KARINA',
      'IN_PROGRESS',
      'PENDING_ANDI_FINAL_REVIEW',
      'PUBLISHED_WAITING_MARKETING',
      'REVISION_REQUESTED_PENDING_ANDI',
    ]);

  const isRequestOverdue =
    (
      request:
        ReturnType<
          typeof store.getMarcommRequests
        >[number]
    ) => {
      if (
        !activeStatusSet.has(
          request.status
        ) ||
        !request.needDate
      ) {
        return false;
      }

      const due =
        new Date(
          `${request.needDate}T23:59:59`
        ).getTime();

      return (
        Number.isFinite(
          due
        ) &&
        due <
          Date.now()
      );
    };

  const serviceMetricCard =
    (
      title:
        string,
      value:
        number | string,
      description:
        string,
      tone:
        'BLUE' |
        'AMBER' |
        'EMERALD' |
        'VIOLET' |
        'ROSE' =
        'BLUE',
      icon?:
        React.ReactNode,
      to?:
        string
    ) => {
      const toneClass = {
        BLUE:
          'border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-900',
        AMBER:
          'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-900',
        EMERALD:
          'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-900',
        VIOLET:
          'border-violet-200 bg-gradient-to-br from-violet-50 to-white text-violet-900',
        ROSE:
          'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-900',
      }[
        tone
      ];

      const card = (
        <Card
          className={`min-w-0 overflow-hidden shadow-sm transition-all ${toneClass} ${
            to
              ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-400'
              : ''
          }`}
        >
          <CardContent className="p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.08em] opacity-70">
                  {title}
                </div>

                <div className="mt-2 whitespace-nowrap text-[clamp(20px,2vw,30px)] leading-none font-black tracking-[-0.035em]">
                  {value}
                </div>

                <div className="mt-2 text-[10px] leading-relaxed opacity-70">
                  {description}
                </div>

                {to && (
                  <div className="mt-3 text-[9px] font-black uppercase tracking-wide opacity-60">
                    Klik untuk proses →
                  </div>
                )}
              </div>

              {icon && (
                <div className={`shrink-0 rounded-xl bg-white/70 p-2 shadow-sm ${
                  to
                    ? 'ring-1 ring-current/10'
                    : ''
                }`}>
                  {icon}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );

      if (
        !to
      ) {
        return card;
      }

      return (
        <Link
          to={
            to
          }
          className="block rounded-xl focus:outline-none"
          title={`Buka proses ${title}`}
        >
          {card}
        </Link>
      );
    };

  const servicePageHeader =
    (
      title:
        string,
      subtitle:
        string,
      unit:
        string
    ) => (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
              {unit}
            </div>

            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              {title}
            </h1>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              {subtitle}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <DashboardTransactionExport />

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-right">
              <div className="text-[9px] font-bold uppercase text-slate-400">
                Login sebagai
              </div>

              <div className="mt-0.5 text-xs font-black text-slate-800">
                {currentUser.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    );

  if (isArianie) {
    const targetBatches =
      store.getTargetBatches();

    const productionBatches =
      store.getOfficialProductionBatches();

    const currentYear =
      new Date().getFullYear();

    const currentYearTargetBatches =
      targetBatches.filter(
        batch =>
          batch.year ===
          currentYear
      ).length;

    const currentYearProductionBatches =
      productionBatches.filter(
        batch =>
          batch.publishedPeriodKeys.some(
            period =>
              period.startsWith(
                `${currentYear}-`
              )
          )
      ).length;

    const activePipelineCount =
      pipelines.filter(
        pipeline =>
          pipeline.status !==
            'WIN' &&
          pipeline.status !==
            'LOSE'
      ).length;

    return (
      <AppLayout>
        <div className="space-y-5">
          {servicePageHeader(
            'Dashboard Team Leader Marketing Support',
            'Fokus pada governance data Marketing: Target RKAP, Realisasi Produksi, dan Bulk Pipeline. Card yang memiliki proses lanjutan dapat diklik langsung.',
            'Marketing Support'
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {serviceMetricCard(
              'Target & RKAP',
              currentYearTargetBatches,
              `Batch Target RKAP ${currentYear}. Kelola upload dan publikasi target Marketing.`,
              'BLUE',
              <Target className="h-5 w-5" />,
              '/target-rkap'
            )}

            {serviceMetricCard(
              'Realisasi Produksi',
              currentYearProductionBatches,
              `Batch Official Production ${currentYear}. Upload dan publish realisasi.`,
              'EMERALD',
              <TrendingUp className="h-5 w-5" />,
              '/produksi'
            )}

            {serviceMetricCard(
              'Bulk Pipeline',
              activePipelineCount,
              'Active Pipeline pada dashboard. Kelola bulk upload Pipeline dari Booking & Pipeline.',
              'VIOLET',
              <Briefcase className="h-5 w-5" />,
              '/booking-pipeline'
            )}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-black text-slate-950">
                Quick Access Governance
              </CardTitle>

              <CardDescription className="text-[10px]">
                Arianie berperan pada pengelolaan data pusat, bukan final approval Booking/WIN/LOSE.
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-3">
              <Link
                to="/target-rkap"
                className="rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-blue-950">
                  Upload Target RKAP
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-blue-700">
                  Buka halaman Target & RKAP.
                </div>
              </Link>

              <Link
                to="/produksi"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-emerald-950">
                  Publish Realisasi
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-emerald-700">
                  Buka halaman Produksi.
                </div>
              </Link>

              <Link
                to="/booking-pipeline"
                className="rounded-xl border border-violet-200 bg-violet-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-violet-950">
                  Bulk Upload Pipeline
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-violet-700">
                  Buka Booking & Pipeline.
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isMarketingAdministrationOperator) {
    const pendingBookingVerification =
      bookings.filter(
        booking =>
          booking.status ===
            'Submitted' &&
          !booking.verificationRecommendation
      );

    const operationalPipelineQueue =
      pipelines.filter(
        pipeline =>
          pipeline.currentHandler ===
            'MARKETING SUPPORT' &&
          pipeline.status !==
            'WIN' &&
          pipeline.status !==
            'LOSE'
      );

    const pendingOwnAdminDocuments =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.status ===
            'PENDING_APPROVAL' &&
          document.uploadedByUserId ===
            currentUser.id
      );

    const publishedAdminDocuments =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.status ===
            'PUBLISHED'
      ).length;

    const pendingReimbursementVerification =
      reimbursements.filter(
        reimbursement =>
          reimbursement.status ===
          'Approved Superior'
      );

    return (
      <AppLayout>
        <div className="space-y-5">
          {servicePageHeader(
            'Dashboard Operasional Marketing Administration',
            'Fokus pada First Action Wins Booking Case, operasional Pipeline Marketing Support, serta upload SPAJ/SPAK. Target premi Marketing tidak ditampilkan.',
            'Marketing Support • Marketing Administration'
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {serviceMetricCard(
              'Booking Belum Diverifikasi',
              pendingBookingVerification.length,
              'Booking Case yang masih tersedia untuk First Action Wins.',
              'AMBER',
              <ShieldCheck className="h-5 w-5" />,
              '/booking-pipeline'
            )}

            {serviceMetricCard(
              'Pipeline Operasional MS',
              operationalPipelineQueue.length,
              'Active Pipeline yang handler-nya sedang berada di Marketing Support.',
              'BLUE',
              <Briefcase className="h-5 w-5" />,
              '/booking-pipeline'
            )}

            {serviceMetricCard(
              'Dokumen Saya Pending',
              pendingOwnAdminDocuments.length,
              'SPAJ/SPAK yang sudah di-upload dan masih menunggu approval Endah.',
              'VIOLET',
              <FileCheck2 className="h-5 w-5" />,
              '/dokumen-pendukung?area=administration'
            )}

            {serviceMetricCard(
              'Reimbursement Verification',
              pendingReimbursementVerification.length,
              'Pengajuan yang sudah disetujui atasan langsung dan menunggu First Action Wins Marketing Administration.',
              'EMERALD',
              <Receipt className="h-5 w-5" />,
              '/aktivitas?tab=reimbursement&filter=ACTION'
            )}
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-black text-slate-950">
                    Pekerjaan Utama
                  </CardTitle>

                  <CardDescription className="text-[10px]">
                    Hanya shortcut yang memang memiliki halaman proses yang dibuat clickable.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid gap-3 md:grid-cols-3">
              <Link
                to="/booking-pipeline"
                className="rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-blue-950">
                  Verifikasi Booking & Proses Pipeline
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-blue-700">
                  Buka antrean Booking Case dan Active Pipeline.
                </div>
              </Link>

              <Link
                to="/dokumen-pendukung?area=administration"
                className="rounded-xl border border-violet-200 bg-violet-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-violet-950">
                  Upload SPAJ / SPAK
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-violet-700">
                  Buka repository Dokumen Administrasi.
                </div>
              </Link>

              <Link
                to="/aktivitas?tab=reimbursement&filter=ACTION"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-black text-emerald-950">
                  Verifikasi Reimbursement
                </div>

                <div className="mt-1 text-[10px] leading-relaxed text-emerald-700">
                  Buka antrean reimbursement yang sudah disetujui atasan langsung.
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isEndah) {
    const pendingBookingVerification =
      bookings.filter(
        booking =>
          booking.status ===
            'Submitted' &&
          !booking.verificationRecommendation
      );

    const pendingBookingFinal =
      bookings.filter(
        booking =>
          booking.status ===
            'Submitted' &&
          Boolean(
            booking.verificationRecommendation
          ) &&
          !booking.finalDecisionAt
      );

    const pendingOutcomeFinal =
      pipelines.filter(
        pipeline =>
          pipeline.outcomeWorkflowStatus ===
            'PENDING_TLMS_APPROVAL' ||
          pipeline.status ===
            'Menunggu Final Approval Team Leader Marketing Support'
      );

    const adminPipelineQueue =
      pipelines.filter(
        pipeline =>
          pipeline.currentHandler ===
            'MARKETING SUPPORT' &&
          pipeline.status !==
            'WIN' &&
          pipeline.status !==
            'LOSE'
      );

    const pendingAdminDocuments =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.status ===
            'PENDING_APPROVAL'
      );

    const publishedSpaj =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.category ===
            'SPAJ' &&
          document.status ===
            'PUBLISHED'
      ).length;

    const publishedSpak =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_ADMINISTRATION' &&
          document.category ===
            'SPAK' &&
          document.status ===
            'PUBLISHED'
      ).length;

    const pendingReimbursementFinal =
      reimbursements.filter(
        reimbursement =>
          reimbursement.status ===
            'Verified Marketing Administration' ||
          reimbursement.status ===
            'Verified MS'
      );

    return (
      <AppLayout>
        <div className="space-y-5">
          {servicePageHeader(
            'Dashboard Marketing Administration',
            'Fokus pada final approval Booking Case, governance Pipeline, WIN/LOSE, serta repository SPAJ dan SPAK. Target premi Marketing tidak ditampilkan pada dashboard ini.',
            'Marketing Support • Marketing Administration'
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {serviceMetricCard(
              'Booking Final Approval',
              pendingBookingFinal.length,
              'Sudah diverifikasi Suci/Ayu/Ulfia/Raydinda dan menunggu keputusan Endah.',
              'AMBER',
              <ShieldCheck className="h-5 w-5" />,
              '/booking-pipeline'
            )}

            {serviceMetricCard(
              'WIN / LOSE Final',
              pendingOutcomeFinal.length,
              'Outcome Pipeline yang menunggu final approval DH Marketing Administration.',
              'VIOLET',
              <CheckCircle2 className="h-5 w-5" />,
              '/booking-pipeline'
            )}

            {serviceMetricCard(
              'Pipeline di Marketing Admin',
              adminPipelineQueue.length,
              'Active Pipeline yang handler-nya sedang berada di Marketing Support.',
              'BLUE',
              <Briefcase className="h-5 w-5" />,
              '/booking-pipeline'
            )}

            {serviceMetricCard(
              'Dokumen Menunggu Approval',
              pendingAdminDocuments.length,
              'SPAJ/SPAK yang telah di-upload tim dan belum dipublikasikan.',
              'ROSE',
              <FileCheck2 className="h-5 w-5" />,
              '/dokumen-pendukung?area=administration'
            )}

            {serviceMetricCard(
              'Reimbursement Final',
              pendingReimbursementFinal.length,
              'Reimbursement yang sudah diverifikasi Marketing Administration dan menunggu final approval.',
              'EMERALD',
              <Receipt className="h-5 w-5" />,
              '/aktivitas?tab=reimbursement&filter=ACTION'
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-black text-slate-950">
                      Action Queue Endah
                    </CardTitle>

                    <CardDescription className="text-[10px]">
                      Prioritas pekerjaan yang membutuhkan kewenangan Department Head Marketing Administration.
                    </CardDescription>
                  </div>

                  <Link to="/booking-pipeline">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] font-bold"
                    >
                      Buka Booking & Pipeline
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {[
                  ...pendingBookingFinal.map(
                    booking => ({
                      id:
                        booking.id,
                      title:
                        `${booking.id} • ${booking.customerName}`,
                      detail:
                        `Booking Final • ${booking.verificationRecommendation || '-'}`,
                      time:
                        booking.verificationFirstActionAt ||
                        booking.createdAt,
                    })
                  ),
                  ...pendingOutcomeFinal.map(
                    pipeline => ({
                      id:
                        pipeline.id,
                      title:
                        `${pipeline.id} • ${pipeline.customerName}`,
                      detail:
                        `${pipeline.outcomeRequest || 'Outcome'} Final • ${pipeline.picName}`,
                      time:
                        pipeline.outcomeVerifiedAt ||
                        pipeline.lastProgressAt,
                    })
                  ),
                  ...pendingReimbursementFinal.map(
                    reimbursement => ({
                      id:
                        reimbursement.id,
                      title:
                        `${reimbursement.id} • ${reimbursement.userName}`,
                      detail:
                        `Final Reimbursement • ${reimbursement.companyName}`,
                      time:
                        reimbursement.marketingAdminVerifiedAt ||
                        reimbursement.msVerifiedAt ||
                        reimbursement.createdAt,
                      to:
                        `/aktivitas?tab=reimbursement&rmbId=${encodeURIComponent(reimbursement.id)}`,
                    })
                  ),
                ]
                  .sort(
                    (
                      first,
                      second
                    ) =>
                      new Date(
                        second.time
                      ).getTime() -
                      new Date(
                        first.time
                      ).getTime()
                  )
                  .slice(
                    0,
                    8
                  )
                  .map(
                    item =>
                      'to' in item &&
                      item.to ? (
                        <Link
                          key={
                            `${item.id}-${item.detail}`
                          }
                          to={
                            item.to
                          }
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-blue-300 hover:bg-blue-50/60"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-slate-900">
                              {item.title}
                            </div>

                            <div className="mt-1 text-[10px] text-slate-500">
                              {item.detail} • Klik untuk proses
                            </div>
                          </div>

                          <div className="shrink-0 text-[9px] font-semibold text-slate-400">
                            {new Date(
                              item.time
                            ).toLocaleDateString(
                              'id-ID'
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div
                          key={
                            `${item.id}-${item.detail}`
                          }
                          className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-slate-900">
                              {item.title}
                            </div>

                            <div className="mt-1 text-[10px] text-slate-500">
                              {item.detail}
                            </div>
                          </div>

                          <div className="shrink-0 text-[9px] font-semibold text-slate-400">
                            {new Date(
                              item.time
                            ).toLocaleDateString(
                              'id-ID'
                            )}
                          </div>
                        </div>
                      )
                  )}

                {pendingBookingFinal.length +
                  pendingOutcomeFinal.length +
                  pendingReimbursementFinal.length ===
                  0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
                    Tidak ada final approval yang menunggu saat ini.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-black">
                    Booking Administration
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-[10px] font-semibold text-slate-500">
                      Belum diverifikasi tim
                    </span>

                    <span className="text-sm font-black text-slate-900">
                      {pendingBookingVerification.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2">
                    <span className="text-[10px] font-semibold text-amber-700">
                      Menunggu final Endah
                    </span>

                    <span className="text-sm font-black text-amber-900">
                      {pendingBookingFinal.length}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-black">
                      Dokumen Administrasi
                    </CardTitle>

                    <Link to="/dokumen-pendukung?area=administration">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[9px] font-bold text-blue-700"
                      >
                        Buka
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                      <div className="text-[9px] font-bold uppercase text-blue-500">
                        SPAJ Published
                      </div>

                      <div className="mt-1 text-xl font-black text-blue-950">
                        {publishedSpaj}
                      </div>
                    </div>

                    <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                      <div className="text-[9px] font-bold uppercase text-violet-500">
                        SPAK Published
                      </div>

                      <div className="mt-1 text-xl font-black text-violet-950">
                        {publishedSpak}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-[10px] font-semibold text-rose-700">
                    {pendingAdminDocuments.length} dokumen menunggu approval.
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isAndi || isKarina) {
    const pendingInitial =
      marcommRequests.filter(
        request =>
          request.status ===
            'PENDING_ANDI_APPROVAL' ||
          request.status ===
            'REVISION_REQUESTED_PENDING_ANDI'
      );

    const waitingKarina =
      marcommRequests.filter(
        request =>
          request.status ===
            'APPROVED_WAITING_KARINA'
      );

    const inProgress =
      marcommRequests.filter(
        request =>
          request.status ===
            'IN_PROGRESS'
      );

    const pendingFinal =
      marcommRequests.filter(
        request =>
          request.status ===
            'PENDING_ANDI_FINAL_REVIEW'
      );

    const overdue =
      marcommRequests.filter(
        isRequestOverdue
      );

    const standardToolCategories =
      new Set([
        'PROPOSAL_PENAWARAN_STANDAR',
        'MATERI_PRESENTASI',
        'BROSUR',
      ]);

    const pendingTools =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_COMMUNICATION' &&
          document.status ===
            'PENDING_APPROVAL' &&
          standardToolCategories.has(
            document.category
          )
      );

    const publishedTools =
      serviceDocuments.filter(
        document =>
          document.ownerArea ===
            'MARKETING_COMMUNICATION' &&
          document.status ===
            'PUBLISHED' &&
          standardToolCategories.has(
            document.category
          )
      ).length;

    const pendingOpnames =
      marcommStockOpnames.filter(
        opname =>
          opname.status ===
            'PENDING_ANDI_APPROVAL'
      );

    const stockSnapshots =
      [
        store.getMarcommStockSnapshot(
          'SOUVENIR',
          'VIP'
        ),
        store.getMarcommStockSnapshot(
          'SOUVENIR',
          'REGULER'
        ),
      ];

    const lowStock =
      stockSnapshots.filter(
        snapshot =>
          snapshot.available <=
          10
      );

    const actionQueue =
      isAndi
        ? [
            ...pendingInitial.map(
              request => ({
                id:
                  request.id,
                title:
                  `${request.id} • ${request.clientName}`,
                detail:
                  request.status ===
                  'REVISION_REQUESTED_PENDING_ANDI'
                    ? 'Approval Revisi'
                    : 'Approval Awal',
                time:
                  request.lastUpdatedAt,
                to:
                  `/dokumen-pendukung?area=marcomm-requests&requestId=${encodeURIComponent(request.id)}#activity-request`,
              })
            ),
            ...pendingFinal.map(
              request => ({
                id:
                  request.id,
                title:
                  `${request.id} • ${request.clientName}`,
                detail:
                  'Final Review Hasil / Evidence',
                time:
                  request.lastUpdatedAt,
                to:
                  `/dokumen-pendukung?area=marcomm-requests&requestId=${encodeURIComponent(request.id)}#activity-request`,
              })
            ),
            ...pendingTools.map(
              document => ({
                id:
                  document.id,
                title:
                  `${document.title} • ${document.versionLabel}`,
                detail:
                  'Approval Marketing Tool',
                time:
                  document.uploadedAt,
                to:
                  `/dokumen-pendukung?area=marketing-tools&documentId=${encodeURIComponent(document.id)}`,
              })
            ),
            ...pendingOpnames.map(
              opname => ({
                id:
                  opname.id,
                title:
                  `Souvenir • ${opname.giftTier}`,
                detail:
                  `Approval Stock Opname • Selisih ${opname.differenceAtSubmission}`,
                time:
                  opname.submittedAt,
                to:
                  `/dokumen-pendukung?area=marcomm-requests&filter=ANDI_OPNAME&opnameId=${encodeURIComponent(opname.id)}#stock-control`,
              })
            ),
          ]
        : [
            ...waitingKarina.map(
              request => ({
                id:
                  request.id,
                title:
                  `${request.id} • ${request.clientName}`,
                detail:
                  'Siap mulai dikerjakan',
                time:
                  request.lastUpdatedAt,
                to:
                  `/dokumen-pendukung?area=marcomm-requests&requestId=${encodeURIComponent(request.id)}#activity-request`,
              })
            ),
            ...inProgress.map(
              request => ({
                id:
                  request.id,
                title:
                  `${request.id} • ${request.clientName}`,
                detail:
                  'Sedang dikerjakan',
                time:
                  request.lastUpdatedAt,
                to:
                  `/dokumen-pendukung?area=marcomm-requests&requestId=${encodeURIComponent(request.id)}#activity-request`,
              })
            ),
          ];

    return (
      <AppLayout>
        <div className="space-y-5">
          {servicePageHeader(
            isAndi
              ? 'Dashboard Marketing Communication — Andi Rita'
              : 'Dashboard Marketing Communication — Karina',
            isAndi
              ? 'Fokus pada approval request Marcomm, final review hasil, governance Marketing Tools, dan kontrol stock Souvenir/Hampers. Target premi Marketing tidak ditampilkan.'
              : 'Fokus pada antrean eksekusi request, upload hasil/evidence, Marketing Tools, serta operasional stock Souvenir. Target premi Marketing tidak ditampilkan.',
            'Marketing Support • Marketing Communication'
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {isAndi
              ? serviceMetricCard(
                  'Approval Awal',
                  pendingInitial.length,
                  'Request baru dan permintaan revisi yang membutuhkan keputusan Andi.',
                  'AMBER',
                  <ShieldCheck className="h-5 w-5" />,
                  '/dokumen-pendukung?area=marcomm-requests&filter=ANDI_INITIAL#activity-request'
                )
              : serviceMetricCard(
                  'Siap Dikerjakan',
                  waitingKarina.length,
                  'Request yang sudah disetujui Andi dan menunggu eksekusi Karina.',
                  'BLUE',
                  <Briefcase className="h-5 w-5" />,
                  '/dokumen-pendukung?area=marcomm-requests&filter=KARINA_READY#activity-request'
                )}

            {isAndi
              ? serviceMetricCard(
                  'Final Review',
                  pendingFinal.length,
                  'Hasil/evidence dari Karina yang menunggu final review.',
                  'VIOLET',
                  <CheckCircle2 className="h-5 w-5" />,
                  '/dokumen-pendukung?area=marcomm-requests&filter=ANDI_FINAL#activity-request'
                )
              : serviceMetricCard(
                  'Sedang Dikerjakan',
                  inProgress.length,
                  'Request aktif yang sedang berada pada tahap eksekusi.',
                  'VIOLET',
                  <Clock3 className="h-5 w-5" />,
                  '/dokumen-pendukung?area=marcomm-requests&filter=KARINA_IN_PROGRESS#activity-request'
                )}

            {serviceMetricCard(
              'Overdue',
              overdue.length,
              'Request aktif yang melewati tanggal kebutuhan.',
              overdue.length >
                0
                ? 'ROSE'
                : 'EMERALD',
              <AlertTriangle className="h-5 w-5" />,
              '/dokumen-pendukung?area=marcomm-requests&filter=OVERDUE#activity-request'
            )}

            {serviceMetricCard(
              isAndi
                ? 'Approval Tools / Opname'
                : 'Menunggu Review Department Head Marketing Communication',
              isAndi
                ? pendingTools.length +
                    pendingOpnames.length
                : pendingFinal.length +
                    pendingTools.filter(
                      document =>
                        document.uploadedByUserId ===
                        currentUser.id
                    ).length,
              isAndi
                ? `${pendingTools.length} Marketing Tool + ${pendingOpnames.length} Stock Opname.`
                : 'Hasil/evidence dan Marketing Tool yang sudah di-submit untuk review Department Head Marketing Communication.',
              'EMERALD',
              <FileCheck2 className="h-5 w-5" />,
              isAndi
                ? (
                    pendingOpnames.length >
                    0
                      ? '/dokumen-pendukung?area=marcomm-requests&filter=ANDI_OPNAME#stock-control'
                      : '/dokumen-pendukung?area=marketing-tools'
                  )
                : '/dokumen-pendukung?area=marcomm-requests&filter=KARINA_WAITING_REVIEW#activity-request'
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-sm font-black text-slate-950">
                      {isAndi
                        ? 'Action Queue Andi Rita'
                        : 'Work Queue Karina'}
                    </CardTitle>

                    <CardDescription className="text-[10px]">
                      {isAndi
                        ? 'Hanya item yang membutuhkan review/approval Marketing Communication.'
                        : 'Request yang sudah menjadi tanggung jawab eksekusi Karina.'}
                    </CardDescription>
                  </div>

                  <Link to="/dokumen-pendukung?area=marcomm-requests">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-[10px] font-bold"
                    >
                      Buka Permintaan Marcomm
                    </Button>
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="space-y-2">
                {actionQueue
                  .sort(
                    (
                      first,
                      second
                    ) =>
                      new Date(
                        second.time
                      ).getTime() -
                      new Date(
                        first.time
                      ).getTime()
                  )
                  .slice(
                    0,
                    10
                  )
                  .map(
                    item => (
                      <Link
                        key={
                          `${item.id}-${item.detail}`
                        }
                        to={
                          item.to
                        }
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm"
                        title="Klik untuk buka item proses"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-slate-900">
                            {item.title}
                          </div>

                          <div className="mt-1 text-[10px] text-slate-500">
                            {item.detail} • Klik untuk proses
                          </div>
                        </div>

                        <div className="shrink-0 text-[9px] font-semibold text-slate-400">
                          {new Date(
                            item.time
                          ).toLocaleDateString(
                            'id-ID'
                          )}
                        </div>
                      </Link>
                    )
                  )}

                {actionQueue.length ===
                  0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
                    Tidak ada pekerjaan yang membutuhkan action saat ini.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-black text-slate-950">
                      Stock Souvenir
                    </CardTitle>

                    <Link to="/dokumen-pendukung?area=marcomm-requests">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[9px] font-bold text-blue-700"
                      >
                        Buka Stock
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {stockSnapshots.map(
                    snapshot => {
                      const label =
                        'Souvenir';

                      const stockTone =
                        snapshot.available <=
                        0
                          ? 'text-rose-700 bg-rose-50'
                          : snapshot.available <=
                            10
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-emerald-700 bg-emerald-50';

                      return (
                        <div
                          key={
                            `${snapshot.stockCategory}-${snapshot.giftTier}`
                          }
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                        >
                          <div>
                            <div className="text-[10px] font-black text-slate-800">
                              {label} {snapshot.giftTier}
                            </div>

                            <div className="mt-1 text-[9px] text-slate-400">
                              On Hand {snapshot.onHand} • Reserved {snapshot.reserved}
                            </div>
                          </div>

                          <div className={`rounded-lg px-2.5 py-1.5 text-right ${stockTone}`}>
                            <div className="text-[8px] font-bold uppercase">
                              Available
                            </div>

                            <div className="text-sm font-black">
                              {snapshot.available}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px]">
                    <span className="font-semibold text-slate-500">
                      Low / Habis
                    </span>

                    <span className="font-black text-slate-900">
                      {lowStock.length} pool
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-black">
                      Marketing Tools
                    </CardTitle>

                    <Link to="/dokumen-pendukung?area=marketing-tools">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[9px] font-bold text-blue-700"
                      >
                        Buka
                      </Button>
                    </Link>
                  </div>
                </CardHeader>

                <CardContent className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <div className="text-[9px] font-bold uppercase text-blue-500">
                      Published
                    </div>

                    <div className="mt-1 text-xl font-black text-blue-950">
                      {publishedTools}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <div className="text-[9px] font-bold uppercase text-amber-500">
                      Pending Approval
                    </div>

                    <div className="mt-1 text-xl font-black text-amber-950">
                      {pendingTools.length}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const shouldShowSupportDashboard =
    adminViewMode === 'SUPPORT' ||
    (
      isMarketingSupportRole &&
      adminViewMode !== 'MARKETING'
    );

  if (shouldShowSupportDashboard) {
    return (
      <AppLayout>
        <div className="space-y-4">

          {isSysAdmin && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs font-semibold text-amber-900">

              <span>
                Mode SysAdmin: Menampilkan Dashboard Operasional Marketing Support
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAdminViewMode(
                    'MARKETING'
                  )
                }
                className="h-6 text-[10px]"
              >
                Tampilkan Marketing Dashboard
              </Button>

            </div>
          )}

          <MarketingSupportDashboard />

        </div>
      </AppLayout>
    );
  }

  // ============================================================
  // MARKETING EXECUTIVE DASHBOARD
  // ============================================================

  const allUsers = store.getUsers();

  const isMarketingHierarchyUser = (
    user: User
  ) =>
    user.status === 'Active' &&
    user.role !== 'SYSTEM_ADMIN' &&
    user.unit !== 'Marketing Support' &&
    user.role !==
      'TEAM_LEADER_MARKETING_SUPPORT' &&
    user.role !==
      'SUPERVISOR_MARKETING_ADMINISTRATION' &&
    user.role !==
      'STAFF_MARKETING_ADMINISTRATION';

  const directScopeOptions =
    allUsers.filter(
      (user) =>
        user.superiorId ===
          currentUser.id &&
        isMarketingHierarchyUser(
          user
        )
    );

  const scopeRootUser =
    selectedScope === 'ALL'
      ? currentUser
      : allUsers.find(
          (user) =>
            user.id ===
            selectedScope
        ) || currentUser;

  const getTargetValue = (
    target: TargetEntry
  ) => {
    if (
      businessTypeFilter ===
      'New Business'
    ) {
      return (
        target.personalTargetNewBusiness
      );
    }

    if (
      businessTypeFilter ===
      'Renewal Business'
    ) {
      return (
        target.personalTargetRenewal
      );
    }

    return (
      target.personalTargetTotal
    );
  };

  const getOrganizationMetrics = (
    userIds: string[]
  ) => {
    const userIdSet =
      new Set(userIds);

    const targetValue =
      targets
        .filter(
          (target) =>
            target.year ===
              selectedYear &&
            userIdSet.has(
              target.userId
            )
        )
        .reduce(
          (
            accumulator,
            target
          ) =>
            accumulator +
            getTargetValue(
              target
            ),
          0
        );

    const realizationValue =
      officialProductions
        .filter(
          production => {
            if (
              production.productionYear !==
              selectedYear
            ) {
              return false;
            }

            if (
              businessTypeFilter !==
                'OVERALL' &&
              production.businessType !==
                businessTypeFilter
            ) {
              return false;
            }

            if (
              userIdSet.has(
                'USR-000001'
              )
            ) {
              return true;
            }

            if (
              userIdSet.has(
                'USR-000003'
              )
            ) {
              return (
                production.marketingFunction ===
                'Captive Marketing'
              );
            }

            if (
              userIdSet.has(
                'USR-000014'
              )
            ) {
              return (
                production.marketingFunction ===
                'Corporate & Retail Marketing'
              );
            }

            return Boolean(
              production.picUserId &&
              userIdSet.has(
                production.picUserId
              )
            );
          }
        )
        .reduce(
          (
            accumulator,
            production
          ) =>
            accumulator +
            production.productionAmount,
          0
        );

    const activePipelineRows =
      pipelines.filter(
        (pipeline) =>
          userIdSet.has(
            pipeline.picUserId
          ) &&
          (
            businessTypeFilter ===
              'OVERALL' ||
            pipeline.businessType ===
              businessTypeFilter
          ) &&
          pipeline.status !==
            'WIN' &&
          pipeline.status !==
            'LOSE'
      );

    const pipelineValue =
      activePipelineRows.reduce(
        (
          accumulator,
          pipeline
        ) =>
          accumulator +
          pipeline.currentCommercialValue,
        0
      );

    return {
      target:
        targetValue,

      realisasi:
        realizationValue,

      pipeline:
        pipelineValue,

      achievement:
        targetValue > 0
          ? (
              realizationValue /
              targetValue
            ) * 100
          : 0,

      pipelineCount:
        activePipelineRows.length,
    };
  };

  const getBranchLabel = (
    user: User
  ) => {
    if (
      user.role ===
      'VP_CAPTIVE_MARKETING'
    ) {
      return 'Captive Marketing';
    }

    if (
      user.role ===
      'VP_CORPORATE_RETAIL_MARKETING'
    ) {
      return 'Corporate & Retail';
    }

    if (
      user.role ===
      'ADVISOR_MARKETING_DIRECTOR'
    ) {
      return 'Advisor';
    }

    if (
      user.department &&
      user.department !==
        'None'
    ) {
      return user.department;
    }

    return user.name;
  };

  const directChildrenOfScope =
    allUsers.filter(
      (user) =>
        user.superiorId ===
          scopeRootUser.id &&
        isMarketingHierarchyUser(
          user
        )
    );

  const shouldShowBranchComparison =
    scopeRootUser.role ===
      'DIRECTOR_MARKETING' ||
    scopeRootUser.role ===
      'VP_CAPTIVE_MARKETING' ||
    scopeRootUser.role ===
      'VP_CORPORATE_RETAIL_MARKETING';

  const organizationChartUsers =
    shouldShowBranchComparison &&
    directChildrenOfScope.length > 0
      ? directChildrenOfScope
      : allUsers.filter(
          (user) =>
            isMarketingHierarchyUser(
              user
            ) &&
            store
              .getSubordinateUserIds(
                scopeRootUser.id
              )
              .includes(
                user.id
              )
        );

  const organizationPerformanceData =
    organizationChartUsers.map(
      (user) => {
        const metricUserIds =
          shouldShowBranchComparison &&
          directChildrenOfScope.length >
            0
            ? store.getSubordinateUserIds(
                user.id
              )
            : [user.id];

        const metrics =
          getOrganizationMetrics(
            metricUserIds
          );

        return {
          id:
            user.id,

          label:
            shouldShowBranchComparison &&
            directChildrenOfScope.length >
              0
              ? getBranchLabel(
                  user
                )
              : user.name,

          position:
            user.position,

          target:
            metrics.target,

          realisasi:
            metrics.realisasi,

          pipeline:
            metrics.pipeline,

          achievement:
            metrics.achievement,

          pipelineCount:
            metrics.pipelineCount,
        };
      }
    );

  const organizationChartTitle =
    scopeRootUser.role ===
      'DIRECTOR_MARKETING'
      ? 'Performance by Organization'
      : scopeRootUser.role ===
          'VP_CAPTIVE_MARKETING' ||
        scopeRootUser.role ===
          'VP_CORPORATE_RETAIL_MARKETING'
      ? `Performance Department - ${scopeRootUser.name}`
      : `Performance Tim - ${scopeRootUser.name}`;

  const organizationChartDescription =
    scopeRootUser.role ===
      'DIRECTOR_MARKETING'
      ? 'Perbandingan Captive Marketing, Corporate & Retail Marketing, dan Advisor'
      : shouldShowBranchComparison &&
        directChildrenOfScope.length >
          0
      ? 'Perbandingan performa seluruh department yang berada dalam scope terpilih'
      : 'Performa individual dalam hierarchy scope terpilih sampai level staf';

  const formatCompactRupiah = (
    value: number
  ) => {
    const absValue =
      Math.abs(value);

    if (
      absValue >=
      1_000_000_000_000
    ) {
      const trillion =
        value /
        1_000_000_000_000;

      return `${trillion.toFixed(
        trillion >= 10 ? 0 : 1
      )} T`;
    }

    if (
      absValue >=
      1_000_000_000
    ) {
      const billion =
        value /
        1_000_000_000;

      return `${billion.toFixed(
        billion >= 10 ? 0 : 1
      )} M`;
    }

    if (
      absValue >=
      1_000_000
    ) {
      const million =
        value /
        1_000_000;

      return `${million.toFixed(
        million >= 10 ? 0 : 1
      )} Jt`;
    }

    return String(
      Math.round(value)
    );
  };

  const getPipelinePlanningYear =
    (
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

      const referenceDate =
        pipeline.currentTargetClosingDate ||
        pipeline.originalTargetClosingDate;

      const match =
        String(
          referenceDate ||
          ''
        ).match(
          /^(\d{4})-(\d{2})-(\d{2})/
        );

      return match
        ? Number(match[1])
        : 0;
    };

  const getPipelinePlanningMonth =
    (
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

      const referenceDate =
        pipeline.currentTargetClosingDate ||
        pipeline.originalTargetClosingDate;

      const match =
        String(
          referenceDate ||
          ''
        ).match(
          /^(\d{4})-(\d{2})-(\d{2})/
        );

      return match
        ? Number(match[2])
        : 0;
    };

  const scopedUserIds =
    store.getSubordinateUserIds(
      selectedScope === 'ALL'
        ? currentUser.id
        : selectedScope
    );

  const filteredPipelines =
    pipelines.filter(
      (pipeline) => {
        const matchScope =
          store.isUserInScope(
            currentUser,
            pipeline.picUserId
          ) &&
          (
            selectedScope === 'ALL' ||
            scopedUserIds.includes(
              pipeline.picUserId
            )
          );

        const matchType =
          businessTypeFilter === 'OVERALL' ||
          pipeline.businessType ===
            businessTypeFilter;

        const matchYear =
          getPipelinePlanningYear(
            pipeline
          ) ===
          selectedYear;

        return (
          matchScope &&
          matchType &&
          matchYear
        );
      }
    );

  const filteredOfficialProductions =
    officialProductions.filter(
      production => {
        const scopeRoot =
          selectedScope ===
          'ALL'
            ? currentUser
            : scopeRootUser;

        let matchScope =
          false;

        if (
          isSysAdmin ||
          scopeRoot.role ===
            'DIRECTOR_MARKETING'
        ) {
          matchScope =
            true;
        } else if (
          scopeRoot.role ===
          'VP_CAPTIVE_MARKETING'
        ) {
          matchScope =
            production.marketingFunction ===
            'Captive Marketing';
        } else if (
          scopeRoot.role ===
          'VP_CORPORATE_RETAIL_MARKETING'
        ) {
          matchScope =
            production.marketingFunction ===
            'Corporate & Retail Marketing';
        } else {
          matchScope =
            Boolean(
              production.picUserId &&
              scopedUserIds.includes(
                production.picUserId
              )
            );
        }

        const matchType =
          businessTypeFilter ===
            'OVERALL' ||
          production.businessType ===
            businessTypeFilter;

        const matchYear =
          production.productionYear ===
          selectedYear;

        return (
          matchScope &&
          matchType &&
          matchYear
        );
      }
    );

  const filteredTargets =
    targets.filter(
      (target) => {
        const matchScope =
          store.isUserInScope(
            currentUser,
            target.userId
          ) &&
          (
            selectedScope === 'ALL' ||
            scopedUserIds.includes(
              target.userId
            )
          );

        const matchYear =
          target.year ===
          selectedYear;

        return (
          matchScope &&
          matchYear
        );
      }
    );

  // ============================================================
  // MONTHLY PERFORMANCE & PIPELINE OUTLOOK
  // ============================================================

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
        const target =
          filteredTargets.reduce(
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
                businessTypeFilter ===
                'New Business'
              ) {
                return (
                  accumulator +
                  nb
                );
              }

              if (
                businessTypeFilter ===
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
          filteredOfficialProductions.filter(
            (
              production
            ) =>
              production.productionMonth ===
              monthIndex + 1
          );

        const realisasi =
          productionRows.reduce(
            (
              accumulator,
              production
            ) =>
              accumulator +
              production.productionAmount,
            0
          );

        const pipelineRows =
          filteredPipelines.filter(
            (
              pipeline
            ) => {
              if (
                pipeline.status ===
                  'WIN' ||
                pipeline.status ===
                  'LOSE'
              ) {
                return false;
              }

              return (
                getPipelinePlanningYear(
                  pipeline
                ) ===
                  selectedYear &&
                getPipelinePlanningMonth(
                  pipeline
                ) ===
                  monthIndex + 1
              );
            }
          );

        const pipeline =
          pipelineRows.reduce(
            (
              accumulator,
              pipelineRow
            ) =>
              accumulator +
              pipelineRow.currentCommercialValue,
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
                  pipeline
                ) /
                target
              ) *
              100
            : 0;

        return {
          month,
          monthNumber:
            monthIndex + 1,
          target,
          realisasi,
          pipeline,
          productionCount:
            productionRows.length,
          pipelineCount:
            pipelineRows.length,
          achievement,
          potentialCoverage,
        };
      }
    );

  const renderMonthlyTooltip = ({
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
          {label} {selectedYear}
        </div>

        <div className="mt-2 space-y-1.5 text-[11px]">

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Target
            </span>
            <span className="font-bold text-blue-700">
              {formatRupiah(
                data.target
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Realisasi
            </span>
            <span className="font-bold text-emerald-700">
              {formatRupiah(
                data.realisasi
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Achievement
            </span>
            <span className="font-bold text-emerald-700">
              {data.achievement.toFixed(
                1
              )}%
            </span>
          </div>

          <div className="border-t border-gray-100 my-1.5" />

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Pipeline Aktif
            </span>
            <span className="font-bold text-violet-700">
              {formatRupiah(
                data.pipeline
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Pipeline Case
            </span>
            <span className="font-bold text-gray-800">
              {data.pipelineCount} Case
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-gray-500">
              Potential Coverage
            </span>
            <span className="font-black text-indigo-700">
              {data.potentialCoverage.toFixed(
                1
              )}%
            </span>
          </div>

        </div>

      </div>
    );
  };

  // ============================================================
  // KPI COMPUTATIONS
  // ============================================================

  const totalTarget =
    filteredTargets.reduce(
      (accumulator, target) => {
        if (
          businessTypeFilter ===
          'New Business'
        ) {
          return (
            accumulator +
            target.personalTargetNewBusiness
          );
        }

        if (
          businessTypeFilter ===
          'Renewal Business'
        ) {
          return (
            accumulator +
            target.personalTargetRenewal
          );
        }

        return (
          accumulator +
          target.personalTargetTotal
        );
      },
      0
    );

  const totalRealisasi =
    filteredOfficialProductions.reduce(
      (accumulator, production) =>
        accumulator +
        production.productionAmount,
      0
    );

  const achievementPct =
    totalTarget > 0
      ? (
          totalRealisasi /
          totalTarget
        ) * 100
      : 0;

  const gapTarget =
    totalTarget -
    totalRealisasi;

  const activePipelines =
    filteredPipelines.filter(
      (pipeline) =>
        pipeline.status !== 'WIN' &&
        pipeline.status !== 'LOSE'
    );

  const activePipelineValue =
    activePipelines.reduce(
      (accumulator, pipeline) =>
        accumulator +
        pipeline.currentCommercialValue,
      0
    );

  const pipelinePicOptions =
    Array.from(
      new Map(
        activePipelines.map(
          pipeline => [
            pipeline.picUserId,
            pipeline.picName,
          ]
        )
      ).entries()
    )
      .map(
        ([id, name]) => ({
          id,
          name,
        })
      )
      .sort(
        (first, second) =>
          String(
            first.name
          ).localeCompare(
            String(
              second.name
            )
          )
      );

  const pipelineProductOptions =
    Array.from(
      new Set(
        activePipelines.map(
          pipeline =>
            pipeline.productName
        )
      )
    ).sort(
      (first, second) =>
        String(
          first
        ).localeCompare(
          String(
            second
          )
        )
    );

  const normalizedPipelineSearch =
    pipelineSearchQuery
      .trim()
      .toLowerCase();

  const pipelineMonitorRows =
    activePipelines.filter(
      pipeline => {
        const matchesSearch =
          !normalizedPipelineSearch ||
          [
            pipeline.id,
            pipeline.customerName,
            pipeline.picName,
            pipeline.productName,
          ].some(
            value =>
              String(value || '')
                .toLowerCase()
                .includes(
                  normalizedPipelineSearch
                )
          );

        const matchesPic =
          pipelinePicFilter ===
            'ALL' ||
          pipeline.picUserId ===
            pipelinePicFilter;

        const matchesProduct =
          pipelineProductFilter ===
            'ALL' ||
          pipeline.productName ===
            pipelineProductFilter;

        return (
          matchesSearch &&
          matchesPic &&
          matchesProduct
        );
      }
    );

  const pipelineMonitorFilterActive =
    Boolean(
      normalizedPipelineSearch
    ) ||
    pipelinePicFilter !==
      'ALL' ||
    pipelineProductFilter !==
      'ALL';

  const resetPipelineMonitorFilters =
    () => {
      setPipelineSearchQuery('');
      setPipelinePicFilter('ALL');
      setPipelineProductFilter('ALL');
    };

  const winPipelines =
    filteredPipelines.filter(
      (pipeline) =>
        pipeline.status === 'WIN'
    );

  const winPendingInvoices =
    winPipelines.filter(
      (winPipeline) =>
        !productions.some(
          (production) =>
            production.pipelineId ===
            winPipeline.id
        )
    );

  const winPendingValue =
    winPendingInvoices.reduce(
      (accumulator, pipeline) =>
        accumulator +
        (
          pipeline.winningQuotationAmount ||
          pipeline.currentCommercialValue
        ),
      0
    );

  const lapseOver30 =
    activePipelines.filter(
      (pipeline) =>
        pipeline.dayLapse > 30
    );

  const lapseOver30Value =
    lapseOver30.reduce(
      (accumulator, pipeline) =>
        accumulator +
        pipeline.currentCommercialValue,
      0
    );

  // ============================================================
  // CURRENT HANDLER
  // ============================================================

  const handlerMarketing =
    activePipelines.filter(
      (pipeline) =>
        pipeline.currentHandler ===
        'MARKETING'
    );

  const handlerMS =
    activePipelines.filter(
      (pipeline) =>
        pipeline.currentHandler ===
        'MARKETING SUPPORT'
    );

  const handlerTeknik =
    activePipelines.filter(
      (pipeline) =>
        pipeline.currentHandler ===
        'TEKNIK'
    );

  const handlerClient =
    activePipelines.filter(
      (pipeline) =>
        pipeline.currentHandler ===
        'CLIENT'
    );

  // ============================================================
  // TENDER / NON-TENDER STATUS SUMMARY
  // ============================================================

  const tenderCount =
    filteredPipelines.filter(
      pipeline =>
        pipeline.isTender
    ).length;

  const nonTenderCount =
    filteredPipelines.filter(
      pipeline =>
        !pipeline.isTender
    ).length;

  const tenderValue =
    filteredPipelines
      .filter(
        pipeline =>
          pipeline.isTender
      )
      .reduce(
        (
          accumulator,
          pipeline
        ) =>
          accumulator +
          pipeline.currentCommercialValue,
        0
      );

  const nonTenderValue =
    filteredPipelines
      .filter(
        pipeline =>
          !pipeline.isTender
      )
      .reduce(
        (
          accumulator,
          pipeline
        ) =>
          accumulator +
          pipeline.currentCommercialValue,
        0
      );

  const procurementSummaryPipelines =
    filteredPipelines.filter(
      pipeline =>
        procurementSummaryMode ===
        'TENDER'
          ? pipeline.isTender
          : !pipeline.isTender
    );

  const procurementSummaryTotalCase =
    procurementSummaryPipelines.length;

  const procurementSummaryTotalValue =
    procurementSummaryPipelines.reduce(
      (
        accumulator,
        pipeline
      ) =>
        accumulator +
        pipeline.currentCommercialValue,
      0
    );

  const procurementSummaryShare =
    filteredPipelines.length > 0
      ? (
          procurementSummaryTotalCase /
          filteredPipelines.length
        ) *
        100
      : 0;

  const getProcurementStatusGroup = (
    pipeline: Pipeline
  ): string => {
    if (
      pipeline.status ===
      'WIN'
    ) {
      return 'Closing / WIN';
    }

    if (
      pipeline.status ===
      'LOSE'
    ) {
      return 'Cancel / LOSE';
    }

    if (
      pipeline.currentHandler ===
      'MARKETING'
    ) {
      return 'Marketing';
    }

    if (
      pipeline.currentHandler ===
      'MARKETING SUPPORT'
    ) {
      return 'Marketing Support';
    }

    if (
      pipeline.currentHandler ===
      'TEKNIK'
    ) {
      return 'Teknik';
    }

    if (
      pipeline.currentHandler ===
      'CLIENT'
    ) {
      return 'Client / Feedback';
    }

    return 'On Process';
  };

  const procurementStatusOrder = [
    'Closing / WIN',
    'Cancel / LOSE',
    'Marketing',
    'Marketing Support',
    'Teknik',
    'Client / Feedback',
    'On Process',
  ];

  const procurementStatusRows =
    procurementStatusOrder
      .map(
        statusLabel => {
          const rows =
            procurementSummaryPipelines.filter(
              pipeline =>
                getProcurementStatusGroup(
                  pipeline
                ) ===
                statusLabel
            );

          const caseCount =
            rows.length;

          const projectedPremium =
            rows.reduce(
              (
                accumulator,
                pipeline
              ) =>
                accumulator +
                pipeline.currentCommercialValue,
              0
            );

          const casePercentage =
            procurementSummaryTotalCase > 0
              ? (
                  caseCount /
                  procurementSummaryTotalCase
                ) *
                100
              : 0;

          const premiumPercentage =
            procurementSummaryTotalValue > 0
              ? (
                  projectedPremium /
                  procurementSummaryTotalValue
                ) *
                100
              : 0;

          return {
            statusLabel,
            caseCount,
            projectedPremium,
            casePercentage,
            premiumPercentage,
          };
        }
      )
      .filter(
        row =>
          row.caseCount > 0
      );

  // ============================================================
  // PRODUCT MIX — PIPELINE vs REALISASI PRODUKSI
  // Saat filter OVERALL, setiap produk ditampilkan sebagai
  // grouped bar: Captive Marketing vs Corporate & Retail Marketing.
  // ============================================================

  interface ProductMixRow {
    product: string;
    captive: number;
    crm: number;
    nilai: number;
  }

  const buildProductMixData = (
    source:
      | 'PIPELINE'
      | 'REALISASI'
  ): ProductMixRow[] => {
    const map:
      Record<
        string,
        {
          captive: number;
          crm: number;
        }
      > = {};

    if (
      source ===
      'PIPELINE'
    ) {
      activePipelines.forEach(
        pipeline => {
          const productName =
            pipeline.productName ||
            'Produk Tidak Teridentifikasi';

          if (
            !map[
              productName
            ]
          ) {
            map[
              productName
            ] = {
              captive: 0,
              crm: 0,
            };
          }

          const amount =
            Number(
              pipeline.currentCommercialValue ||
              0
            );

          if (
            pipeline.unit ===
            'Captive Marketing'
          ) {
            map[
              productName
            ].captive +=
              amount;
          } else if (
            pipeline.unit ===
            'Corporate & Retail Marketing'
          ) {
            map[
              productName
            ].crm +=
              amount;
          }
        }
      );
    } else {
      filteredOfficialProductions.forEach(
        production => {
          const productName =
            production.productName ||
            'Produk Tidak Teridentifikasi';

          if (
            !map[
              productName
            ]
          ) {
            map[
              productName
            ] = {
              captive: 0,
              crm: 0,
            };
          }

          const amount =
            Number(
              production.productionAmount ||
              0
            );

          if (
            production.marketingFunction ===
            'Captive Marketing'
          ) {
            map[
              productName
            ].captive +=
              amount;
          } else if (
            production.marketingFunction ===
            'Corporate & Retail Marketing'
          ) {
            map[
              productName
            ].crm +=
              amount;
          }
        }
      );
    }

    return Object.entries(
      map
    )
      .map(
        ([
          product,
          values,
        ]) => ({
          product,
          captive:
            values.captive,
          crm:
            values.crm,
          nilai:
            values.captive +
            values.crm,
        })
      )
      .sort(
        (
          first,
          second
        ) =>
          second.nilai -
          first.nilai
      );
  };

  const pipelineProductMixData =
    buildProductMixData(
      'PIPELINE'
    );

  const realizationProductMixData =
    buildProductMixData(
      'REALISASI'
    );

  const productMixData =
    productMixMode ===
    'REALISASI'
      ? realizationProductMixData
      : pipelineProductMixData;

  const productMixTotal =
    productMixData.reduce(
      (
        accumulator,
        row
      ) =>
        accumulator +
        Number(
          row.nilai ||
          0
        ),
      0
    );

  const productMixCaptiveTotal =
    productMixData.reduce(
      (
        accumulator,
        row
      ) =>
        accumulator +
        Number(
          row.captive ||
          0
        ),
      0
    );

  const productMixCrmTotal =
    productMixData.reduce(
      (
        accumulator,
        row
      ) =>
        accumulator +
        Number(
          row.crm ||
          0
        ),
      0
    );

  const showProductMixDivisionSplit =
    selectedScope ===
    'ALL';

  const productMixChartData =
    productMixData.map(
      (
        row,
        index
      ) => ({
        ...row,
        axisLabel:
          `P${index + 1}`,
        mixPercentage:
          productMixTotal !==
          0
            ? (
                Number(
                  row.nilai ||
                  0
                ) /
                productMixTotal
              ) *
              100
            : 0,
      })
    );

  // ============================================================
  // LOSE EXECUTIVE ANALYTICS
  // ============================================================

  const losePipelines =
    filteredPipelines.filter(
      (pipeline) =>
        pipeline.status ===
        'LOSE'
    );

  const totalLoseValue =
    losePipelines.reduce(
      (
        accumulator,
        pipeline
      ) =>
        accumulator +
        pipeline.currentCommercialValue,
      0
    );

  const getLoseReasonShortLabel = (
    reason?: string
  ) => {
    const normalized =
      String(reason || '')
        .toLowerCase();

    if (
      normalized.includes(
        'premi'
      ) ||
      normalized.includes(
        'price'
      )
    ) {
      return 'Premi terlalu mahal / kalah price';
    }

    if (
      normalized.includes(
        'tender'
      ) ||
      normalized.includes(
        'kompetitor'
      )
    ) {
      return 'Kalah tender / kompetitor';
    }

    if (
      normalized.includes(
        'benefit'
      ) ||
      normalized.includes(
        'ketentuan'
      )
    ) {
      return 'Benefit tidak sesuai kebutuhan';
    }

    if (
      normalized.includes(
        'dokumen'
      ) ||
      normalized.includes(
        'persyaratan'
      )
    ) {
      return 'Dokumen / persyaratan tidak terpenuhi';
    }

    if (
      normalized.includes(
        'prioritas'
      ) ||
      normalized.includes(
        'keputusan'
      )
    ) {
      return 'Keputusan / prioritas klien berubah';
    }

    return reason ||
      'Alasan belum diisi';
  };

  const loseReasonMap:
    Record<
      string,
      {
        label: string;
        count: number;
        value: number;
      }
    > = {};

  losePipelines.forEach(
    (pipeline) => {
      const label =
        getLoseReasonShortLabel(
          pipeline.loseReason
        );

      if (
        !loseReasonMap[
          label
        ]
      ) {
        loseReasonMap[
          label
        ] = {
          label,
          count: 0,
          value: 0,
        };
      }

      loseReasonMap[
        label
      ].count += 1;

      loseReasonMap[
        label
      ].value +=
        pipeline.currentCommercialValue;
    }
  );

  const loseReasonColors = [
    '#dc2626',
    '#f97316',
    '#eab308',
    '#8b5cf6',
    '#64748b',
  ];

  const loseReasonData =
    Object.values(
      loseReasonMap
    )
      .map(
        (
          item,
          index
        ) => ({
          ...item,

          percentage:
            losePipelines.length >
            0
              ? (
                  item.count /
                  losePipelines.length
                ) *
                100
              : 0,

          color:
            loseReasonColors[
              index %
              loseReasonColors.length
            ],
        })
      )
      .sort(
        (
          first,
          second
        ) =>
          second.count -
          first.count
      );

  const loseReasonChartData =
    [...loseReasonData].sort(
      (
        first,
        second
      ) =>
        loseMetricMode ===
        'COUNT'
          ? second.count -
            first.count
          : second.value -
            first.value
    );

  const topLoseReason =
    loseReasonData[0];

  const loseOrganizationData =
    organizationChartUsers.map(
      (user) => {
        const metricUserIds =
          shouldShowBranchComparison &&
          directChildrenOfScope.length >
            0
            ? store.getSubordinateUserIds(
                user.id
              )
            : [
                user.id,
              ];

        const metricUserIdSet =
          new Set(
            metricUserIds
          );

        const records =
          losePipelines.filter(
            (pipeline) =>
              metricUserIdSet.has(
                pipeline.picUserId
              )
          );

        return {
          id:
            user.id,

          label:
            shouldShowBranchComparison &&
            directChildrenOfScope.length >
              0
              ? getBranchLabel(
                  user
                )
              : user.name,

          position:
            user.position,

          count:
            records.length,

          value:
            records.reduce(
              (
                accumulator,
                pipeline
              ) =>
                accumulator +
                pipeline.currentCommercialValue,
              0
            ),
        };
      }
    );

  const topLoseOrganization =
    [...loseOrganizationData]
      .sort(
        (
          first,
          second
        ) =>
          second.value -
          first.value
      )[0];

  const loseOrganizationChartTitle =
    scopeRootUser.role ===
      'DIRECTOR_MARKETING'
      ? 'LOSE by Organization'
      : scopeRootUser.role ===
          'VP_CAPTIVE_MARKETING' ||
        scopeRootUser.role ===
          'VP_CORPORATE_RETAIL_MARKETING'
      ? `LOSE by Department - ${scopeRootUser.name}`
      : `LOSE by Team Member - ${scopeRootUser.name}`;

  const loseOrganizationChartDescription =
    scopeRootUser.role ===
      'DIRECTOR_MARKETING'
      ? 'Perbandingan LOSE Captive Marketing, Corporate & Retail Marketing, dan Advisor'
      : shouldShowBranchComparison &&
        directChildrenOfScope.length >
          0
      ? 'Perbandingan LOSE antar department dalam scope terpilih'
      : 'Perbandingan LOSE antar personel dalam hierarchy scope terpilih';


  return (
    <AppLayout>
      <div className="space-y-6">

        <Tabs
          value={activeTab}
          onValueChange={
            setActiveTab
          }
          className="w-full"
        >

          {/* =====================================================
              STICKY EXECUTIVE CONTROLS
              Filter + Dashboard Tabs stay visible while scrolling.
          ====================================================== */}

          <div className="sticky top-[76px] z-40 -mx-2 space-y-3 bg-slate-50/95 px-2 py-2 backdrop-blur-sm">

        {/* =====================================================
            FILTER EXECUTIVE
        ====================================================== */}

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex items-center gap-2">

              <Filter className="w-4 h-4 text-gray-500" />

              <span className="text-xs font-bold text-gray-700">
                Filter Executive:
              </span>

            </div>

            {/* YEAR */}

            <Select
              value={String(
                selectedYear
              )}
              onValueChange={(value) =>
                setSelectedYear(
                  Number(value)
                )
              }
            >

              <SelectTrigger className="w-28 h-8 text-xs font-semibold bg-gray-50">
                <SelectValue placeholder="Tahun" />
              </SelectTrigger>

              <SelectContent>

                <SelectItem value="2026">
                  2026
                </SelectItem>

                <SelectItem value="2025">
                  2025
                </SelectItem>

              </SelectContent>

            </Select>

            {/* SCOPE */}

            <Select
              value={selectedScope}
              onValueChange={
                setSelectedScope
              }
            >

              <SelectTrigger className="w-56 h-8 text-xs font-semibold bg-gray-50">
                <SelectValue placeholder="Scope Hierarchy" />
              </SelectTrigger>

              <SelectContent>

                <SelectItem value="ALL">
                  {currentUser.role ===
                  'DIRECTOR_MARKETING'
                    ? `Scope: Semua Marketing (${currentUser.name})`
                    : `Scope: Semua Tim (${currentUser.name})`}
                </SelectItem>

                {directScopeOptions.map(
                  (subordinate) => (

                    <SelectItem
                      key={
                        subordinate.id
                      }
                      value={
                        subordinate.id
                      }
                    >
                      Tim: {subordinate.name} ({subordinate.position})
                    </SelectItem>

                  )
                )}

              </SelectContent>

            </Select>

            {/* BUSINESS TYPE */}

            <div className="bg-gray-100 p-0.5 rounded-lg flex items-center gap-1 text-xs font-semibold">

              <button
                type="button"
                onClick={() =>
                  setBusinessTypeFilter(
                    'OVERALL'
                  )
                }
                className={`px-2.5 py-1 rounded-md transition-all ${
                  businessTypeFilter ===
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
                  setBusinessTypeFilter(
                    'New Business'
                  )
                }
                className={`px-2.5 py-1 rounded-md transition-all ${
                  businessTypeFilter ===
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
                  setBusinessTypeFilter(
                    'Renewal Business'
                  )
                }
                className={`px-2.5 py-1 rounded-md transition-all ${
                  businessTypeFilter ===
                  'Renewal Business'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                RENEWAL
              </button>

            </div>

          </div>

          <div className="flex items-center gap-2">

            {isSysAdmin && (

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAdminViewMode(
                    'SUPPORT'
                  )
                }
                className="h-8 text-xs font-bold border-indigo-300 text-indigo-800 hover:bg-indigo-50"
              >
                Switch to Support Dashboard
              </Button>

            )}
            <DashboardTransactionExport />

          </div>

        </div>

        {/* =====================================================
            DASHBOARD TABS
        ====================================================== */}

          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl shadow-sm grid grid-cols-5 w-full">

            <TabsTrigger
              value="overview"
              className="text-xs font-bold gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Executive Overview
            </TabsTrigger>

            <TabsTrigger
              value="pipeline"
              className="text-xs font-bold gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5" />
              Pipeline Monitoring
            </TabsTrigger>

            <TabsTrigger
              value="productmix"
              className="text-xs font-bold gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" />
              Portfolio & Mix
            </TabsTrigger>

            <TabsTrigger
              value="lose"
              className="text-xs font-bold gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              LOSE Analysis
            </TabsTrigger>

            <TabsTrigger
              value="historical"
              className="text-xs font-bold gap-1.5"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Historical YoY
            </TabsTrigger>

          </TabsList>

          </div>

          {/* ==================================================
              EXECUTIVE OVERVIEW
          =================================================== */}

          <TabsContent
            value="overview"
            className="space-y-6 mt-4"
          >

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* TARGET */}

              <Link
                to="/target-rkap"
                className="block rounded-xl focus:outline-none"
                title="Buka Target Kinerja"
              >
                <Card className="min-w-0 overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

                <CardHeader className="pb-1 pt-4">

                  <CardDescription className="text-xs font-bold text-blue-700 uppercase flex items-center justify-between">

                    <span>
                      Target Premi
                    </span>

                    <Target className="w-4 h-4 text-blue-600" />

                  </CardDescription>

                </CardHeader>

                <CardContent className="pb-4">

                  <div className="min-w-0 whitespace-nowrap text-[clamp(17px,1.45vw,26px)] leading-none font-black tracking-[-0.035em] text-blue-900">
                    {formatRupiah(
                      totalTarget
                    )}
                  </div>

                  <p className="text-[11px] text-blue-600 mt-1 font-medium">
                    Tahun {selectedYear} ({businessTypeFilter})
                  </p>

                  <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-blue-500">
                    Klik untuk detail →
                  </p>

                </CardContent>

              </Card>
              </Link>

              {/* REALISASI */}

              <Link
                to="/produksi"
                className="block rounded-xl focus:outline-none"
                title="Buka Produksi"
              >
                <Card className="min-w-0 overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

                <CardHeader className="pb-1 pt-4">

                  <CardDescription className="text-xs font-bold text-emerald-700 uppercase flex items-center justify-between">

                    <span>
                      Realisasi Produksi
                    </span>

                    <TrendingUp className="w-4 h-4 text-emerald-600" />

                  </CardDescription>

                </CardHeader>

                <CardContent className="pb-4">

                  <div className="min-w-0 whitespace-nowrap text-[clamp(17px,1.45vw,26px)] leading-none font-black tracking-[-0.035em] text-emerald-900">
                    {formatRupiah(
                      totalRealisasi
                    )}
                  </div>

                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">

                    <Badge
                      variant="outline"
                      className="bg-emerald-100 text-emerald-800 text-[10px] font-bold"
                    >
                      Ach: {achievementPct.toFixed(1)}%
                    </Badge>

                    <span className="text-[10px] text-emerald-700">
                      Posted Invoices
                    </span>

                  </div>

                  <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-emerald-500">
                    Klik untuk detail →
                  </p>

                </CardContent>

              </Card>
              </Link>

              {/* GAP */}

              <Link
                to="/target-rkap"
                className="block rounded-xl focus:outline-none"
                title="Buka Target Kinerja"
              >
                <Card className="min-w-0 overflow-hidden border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

                <CardHeader className="pb-1 pt-4">

                  <CardDescription className="text-xs font-bold text-amber-700 uppercase flex items-center justify-between">

                    <span>
                      Gap Target
                    </span>

                    <AlertTriangle className="w-4 h-4 text-amber-600" />

                  </CardDescription>

                </CardHeader>

                <CardContent className="pb-4">

                  <div className="min-w-0 whitespace-nowrap text-[clamp(17px,1.45vw,26px)] leading-none font-black tracking-[-0.035em] text-amber-900">
                    {formatRupiah(
                      Math.max(
                        0,
                        gapTarget
                      )
                    )}
                  </div>

                  <p className="text-[11px] text-amber-600 mt-1 font-medium">
                    Kekurangan pencapaian
                  </p>

                  <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-amber-500">
                    Klik untuk detail →
                  </p>

                </CardContent>

              </Card>
              </Link>

              {/* ACTIVE PIPELINE */}

              <Link
                to="/booking-pipeline"
                className="block rounded-xl focus:outline-none"
                title="Buka Booking & Pipeline"
              >
                <Card className="min-w-0 overflow-hidden border-indigo-200 bg-gradient-to-br from-indigo-50 to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">

                <CardHeader className="pb-1 pt-4">

                  <CardDescription className="text-xs font-bold text-indigo-700 uppercase flex items-center justify-between">

                    <span>
                      Pipeline Aktif
                    </span>

                    <Briefcase className="w-4 h-4 text-indigo-600" />

                  </CardDescription>

                </CardHeader>

                <CardContent className="pb-4">

                  <div className="min-w-0 whitespace-nowrap text-[clamp(17px,1.45vw,26px)] leading-none font-black tracking-[-0.035em] text-indigo-900">
                    {formatRupiah(
                      activePipelineValue
                    )}
                  </div>

                  <p className="text-[11px] text-indigo-600 mt-1 font-medium">
                    {activePipelines.length} Case On-Going
                  </p>

                  <p className="mt-2 text-[9px] font-black uppercase tracking-wide text-indigo-500">
                    Klik untuk proses →
                  </p>

                </CardContent>

              </Card>
              </Link>

            </div>

            {pendingDirectSuperiorReimbursements.length >
              0 && (
              <Link
                to="/aktivitas?tab=reimbursement&filter=ACTION"
                className="block rounded-xl"
              >
                <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
                        <Receipt className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="text-xs font-black text-amber-950">
                          Approval Reimbursement Bawahan
                        </div>

                        <div className="mt-1 text-[10px] text-amber-700">
                          {pendingDirectSuperiorReimbursements.length} pengajuan menunggu approval Anda sebagai atasan langsung.
                        </div>
                      </div>
                    </div>

                    <div className="text-[9px] font-black uppercase tracking-wide text-amber-700">
                      Klik untuk proses →
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* ==================================================
                PERFORMANCE BY ORGANIZATION
            =================================================== */}

            <Card className="border-gray-200">

              <CardHeader className="pb-2">

                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold text-gray-800">
                      {organizationChartTitle}
                    </CardTitle>

                    <CardDescription className="text-xs mt-1">
                      {organizationChartDescription}
                    </CardDescription>

                  </div>

                  <Badge
                    variant="outline"
                    className="w-fit bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-bold"
                  >
                    {businessTypeFilter ===
                    'OVERALL'
                      ? 'OVERALL'
                      : businessTypeFilter ===
                        'New Business'
                      ? 'NEW BUSINESS'
                      : 'RENEWAL'}
                  </Badge>

                </div>

              </CardHeader>

              <CardContent className="pt-2">

                {organizationPerformanceData.length ===
                0 ? (

                  <div className="h-72 flex items-center justify-center text-xs text-gray-400">
                    Belum ada hierarchy Marketing pada scope ini.
                  </div>

                ) : (

                  <div className="space-y-4">

                    <div className="h-80 w-full">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >

                        <BarChart
                          data={
                            organizationPerformanceData
                          }
                          margin={{
                            top: 16,
                            right: 16,
                            left: 8,
                            bottom: 20,
                          }}
                        >

                          <XAxis
                            dataKey="label"
                            tick={{
                              fontSize: 10,
                            }}
                            interval={0}
                            height={52}
                            tickMargin={8}
                          />

                          <YAxis
                            tick={{
                              fontSize: 10,
                            }}
                            tickFormatter={(
                              value
                            ) =>
                              formatCompactRupiah(
                                Number(
                                  value
                                )
                              )
                            }
                          />

                          <Tooltip
                            formatter={(
                              value,
                              name
                            ) => [
                              formatRupiah(
                                Number(
                                  value
                                )
                              ),
                              name ===
                                'target'
                                ? 'Target'
                                : name ===
                                  'realisasi'
                                ? 'Realisasi'
                                : 'Pipeline Aktif',
                            ]}
                            labelFormatter={(
                              label
                            ) =>
                              `Scope: ${label}`
                            }
                          />

                          <Legend
                            formatter={(
                              value
                            ) =>
                              value ===
                              'target'
                                ? 'Target'
                                : value ===
                                  'realisasi'
                                ? 'Realisasi'
                                : 'Pipeline Aktif'
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
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </div>

                    <div
                      className={`grid gap-3 ${
                        organizationPerformanceData.length ===
                        1
                          ? 'grid-cols-1 max-w-md'
                          : organizationPerformanceData.length ===
                            2
                          ? 'grid-cols-1 sm:grid-cols-2'
                          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      }`}
                    >

                      {organizationPerformanceData.map(
                        (item) => (

                          <div
                            key={
                              item.id
                            }
                            className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                          >

                            <div className="flex items-start justify-between gap-3">

                              <div>

                                <div className="text-xs font-bold text-gray-900">
                                  {item.label}
                                </div>

                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {item.position}
                                </div>

                              </div>

                              <Badge
                                variant="outline"
                                className="bg-white text-blue-700 border-blue-200 text-[10px] font-bold"
                              >
                                Ach {item.achievement.toFixed(1)}%
                              </Badge>

                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">

                              <div>

                                <div className="text-gray-500">
                                  Target
                                </div>

                                <div className="font-bold text-blue-800 mt-0.5">
                                  {formatCompactRupiah(
                                    item.target
                                  )}
                                </div>

                              </div>

                              <div>

                                <div className="text-gray-500">
                                  Realisasi
                                </div>

                                <div className="font-bold text-emerald-700 mt-0.5">
                                  {formatCompactRupiah(
                                    item.realisasi
                                  )}
                                </div>

                              </div>

                              <div>

                                <div className="text-gray-500">
                                  Pipeline
                                </div>

                                <div className="font-bold text-violet-700 mt-0.5">
                                  {formatCompactRupiah(
                                    item.pipeline
                                  )}
                                </div>

                                <div className="text-[9px] text-gray-400">
                                  {item.pipelineCount} Case
                                </div>

                              </div>

                            </div>

                          </div>

                        )
                      )}

                    </div>

                  </div>

                )}

              </CardContent>

            </Card>

            {/* ==================================================
                MONTHLY PERFORMANCE & PIPELINE OUTLOOK
            =================================================== */}

            <Card className="border-gray-200">

              <CardHeader className="pb-2">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold text-gray-800">
                      Monthly Performance & Pipeline Outlook
                    </CardTitle>

                    <CardDescription className="text-xs mt-1">
                      Target bulanan, realisasi produksi, dan pipeline aktif berdasarkan Current Target Closing Date
                    </CardDescription>

                  </div>

                  <div className="flex flex-wrap items-center gap-2">

                    <Badge
                      variant="outline"
                      className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-bold"
                    >
                      {selectedYear}
                    </Badge>

                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold"
                    >
                      {businessTypeFilter ===
                      'OVERALL'
                        ? 'OVERALL'
                        : businessTypeFilter ===
                          'New Business'
                        ? 'NEW BUSINESS'
                        : 'RENEWAL'}
                    </Badge>

                  </div>

                </div>

              </CardHeader>

              <CardContent className="pt-2">

                <div className="h-[360px] w-full">

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
                    >

                      <XAxis
                        dataKey="month"
                        tick={{
                          fontSize: 10,
                        }}
                        interval={0}
                      />

                      <YAxis
                        tick={{
                          fontSize: 10,
                        }}
                        tickFormatter={(
                          value
                        ) =>
                          formatCompactRupiah(
                            Number(
                              value
                            )
                          )
                        }
                      />

                      <Tooltip
                        content={
                          renderMonthlyTooltip
                        }
                      />

                      <Legend
                        formatter={(
                          value
                        ) =>
                          value ===
                          'target'
                            ? 'Target Bulanan'
                            : value ===
                              'realisasi'
                            ? 'Realisasi Produksi'
                            : 'Pipeline Aktif'
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
                      />

                    </BarChart>

                  </ResponsiveContainer>

                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">

                  <div className="text-[10px] text-slate-600">
                    Pipeline hanya menghitung case aktif dan dialokasikan ke bulan berdasarkan Current Target Closing Date.
                  </div>

                  <div className="text-[10px] font-semibold text-slate-700">
                    Hover bar untuk melihat Achievement dan Potential Coverage per bulan.
                  </div>

                </div>

              </CardContent>

            </Card>

            {/* ==================================================
                MANAGEMENT COVERAGE
            =================================================== */}

            <Card className="border-gray-200">

              <CardHeader className="pb-2">

                <CardTitle className="text-sm font-bold text-gray-800">
                  Management Coverage Forecast
                </CardTitle>

                <CardDescription className="text-xs">
                  Proyeksi ketahanan pencapaian target berdasarkan tahapan pipeline
                </CardDescription>

              </CardHeader>

              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">

                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">

                  <div className="text-xs font-bold text-slate-600 uppercase">
                    Actual Achievement
                  </div>

                  <div className="text-lg font-black text-slate-900 mt-1">
                    {achievementPct.toFixed(1)}%
                  </div>

                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Realisasi / Target
                  </div>

                </div>

                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">

                  <div className="text-xs font-bold text-emerald-800 uppercase">
                    Committed Coverage
                  </div>

                  <div className="text-lg font-black text-emerald-950 mt-1">
                    {totalTarget > 0
                      ? (
                          (
                            (
                              totalRealisasi +
                              winPendingValue
                            ) /
                            totalTarget
                          ) *
                          100
                        ).toFixed(1)
                      : '0'}
                    %
                  </div>

                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    (Realisasi + WIN Pending) / Target
                  </div>

                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">

                  <div className="text-xs font-bold text-blue-800 uppercase">
                    Potential Coverage
                  </div>

                  <div className="text-lg font-black text-blue-950 mt-1">
                    {totalTarget > 0
                      ? (
                          (
                            (
                              totalRealisasi +
                              winPendingValue +
                              activePipelineValue
                            ) /
                            totalTarget
                          ) *
                          100
                        ).toFixed(1)
                      : '0'}
                    %
                  </div>

                  <div className="text-[11px] text-blue-700 mt-0.5">
                    (Realisasi + WIN + Pipeline) / Target
                  </div>

                </div>

              </CardContent>

            </Card>

            {/* ==================================================
                TENDER VS NON-TENDER — STATUS SUMMARY TABLE
            =================================================== */}

            <Card className="border-gray-200">

              <CardHeader className="space-y-4">

                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold">
                      Ringkasan Status Pipeline: Tender vs Non-Tender
                    </CardTitle>

                    <CardDescription className="mt-1 text-xs">
                      Rekapitulasi total case dan total proyeksi premi per status. Mengikuti filter Year, Scope, dan Business Type di bagian atas dashboard.
                    </CardDescription>

                  </div>

                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-[10px] font-bold">

                    <button
                      type="button"
                      onClick={() =>
                        setProcurementSummaryMode(
                          'NON_TENDER'
                        )
                      }
                      className={`rounded-md px-3 py-1.5 transition ${
                        procurementSummaryMode ===
                        'NON_TENDER'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      NON-TENDER ({nonTenderCount})
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setProcurementSummaryMode(
                          'TENDER'
                        )
                      }
                      className={`rounded-md px-3 py-1.5 transition ${
                        procurementSummaryMode ===
                        'TENDER'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      TENDER ({tenderCount})
                    </button>

                  </div>

                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">

                    <div className="text-[10px] font-bold uppercase text-blue-600">
                      Total Case
                    </div>

                    <div className="mt-1 text-xl font-black text-blue-950">
                      {procurementSummaryTotalCase}
                    </div>

                    <div className="mt-0.5 text-[10px] text-blue-700">
                      Unique Pipeline ID
                    </div>

                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">

                    <div className="text-[10px] font-bold uppercase text-emerald-600">
                      Total Proyeksi Premi
                    </div>

                    <div className="mt-1 text-xl font-black text-emerald-950">
                      {formatRupiah(
                        procurementSummaryTotalValue
                      )}
                    </div>

                    <div className="mt-0.5 text-[10px] text-emerald-700">
                      Current Commercial Value
                    </div>

                  </div>

                  <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">

                    <div className="text-[10px] font-bold uppercase text-violet-600">
                      Share terhadap Pipeline
                    </div>

                    <div className="mt-1 text-xl font-black text-violet-950">
                      {procurementSummaryShare.toFixed(1)}%
                    </div>

                    <div className="mt-0.5 text-[10px] text-violet-700">
                      Berdasarkan total case dalam scope
                    </div>

                  </div>

                </div>

              </CardHeader>

              <CardContent>

                {procurementSummaryPipelines.length ===
                0 ? (

                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">

                    <Briefcase className="mx-auto h-6 w-6 text-gray-300" />

                    <div className="mt-2 text-xs font-bold text-gray-600">
                      Belum ada pipeline {procurementSummaryMode === 'TENDER' ? 'Tender' : 'Non-Tender'}
                    </div>

                    <p className="mt-1 text-[10px] text-gray-400">
                      Data akan muncul sesuai filter dashboard yang sedang aktif.
                    </p>

                  </div>

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[900px] text-left text-xs">

                      <thead className="border-y border-gray-200 bg-gray-50 text-[10px] uppercase text-gray-600">

                        <tr>

                          <th className="p-3">
                            Status
                          </th>

                          <th className="p-3 text-center">
                            Total Case
                          </th>

                          <th className="p-3 text-right">
                            Total Proyeksi Premi
                          </th>

                          <th className="p-3 text-center">
                            % Case
                          </th>

                          <th className="p-3 text-center">
                            % Premi
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {procurementStatusRows.map(
                          row => (

                            <tr
                              key={
                                row.statusLabel
                              }
                              className="hover:bg-gray-50"
                            >

                              <td className="p-3 font-bold text-gray-900">
                                {row.statusLabel}
                              </td>

                              <td className="p-3 text-center font-black text-gray-900">
                                {row.caseCount}
                              </td>

                              <td className="p-3 text-right font-black text-emerald-800">
                                {formatRupiah(
                                  row.projectedPremium
                                )}
                              </td>

                              <td className="p-3">

                                <div className="flex items-center justify-center gap-2">

                                  <span className="w-11 text-right font-bold text-gray-800">
                                    {row.casePercentage.toFixed(1)}%
                                  </span>

                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">

                                    <div
                                      className="h-full rounded-full bg-blue-600"
                                      style={{
                                        width: `${Math.min(
                                          row.casePercentage,
                                          100
                                        )}%`,
                                      }}
                                    />

                                  </div>

                                </div>

                              </td>

                              <td className="p-3">

                                <div className="flex items-center justify-center gap-2">

                                  <span className="w-11 text-right font-bold text-gray-800">
                                    {row.premiumPercentage.toFixed(1)}%
                                  </span>

                                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">

                                    <div
                                      className="h-full rounded-full bg-emerald-600"
                                      style={{
                                        width: `${Math.min(
                                          row.premiumPercentage,
                                          100
                                        )}%`,
                                      }}
                                    />

                                  </div>

                                </div>

                              </td>

                            </tr>

                          )
                        )}

                        <tr className="bg-slate-50">

                          <td className="p-3 font-black text-slate-900">
                            TOTAL
                          </td>

                          <td className="p-3 text-center font-black text-slate-950">
                            {procurementSummaryTotalCase}
                          </td>

                          <td className="p-3 text-right font-black text-emerald-900">
                            {formatRupiah(
                              procurementSummaryTotalValue
                            )}
                          </td>

                          <td className="p-3 text-center font-black text-slate-950">
                            100.0%
                          </td>

                          <td className="p-3 text-center font-black text-slate-950">
                            100.0%
                          </td>

                        </tr>

                      </tbody>

                    </table>

                  </div>

                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-[10px] text-gray-500">

                  <span>
                    Non-Tender: {nonTenderCount} case • {formatRupiah(nonTenderValue)}
                  </span>

                  <span>
                    Tender: {tenderCount} case • {formatRupiah(tenderValue)}
                  </span>

                </div>

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              PIPELINE MONITORING
          =================================================== */}

          <TabsContent
            value="pipeline"
            className="space-y-4 mt-4"
          >

            <Card className="border-gray-200">

              <CardHeader className="space-y-4">

                <div>

                  <CardTitle className="text-sm font-bold">
                    Monitor Day Lapse & Potensi Bottleneck
                  </CardTitle>

                  <CardDescription className="mt-1 text-xs">
                    Klasifikasi Day Lapse: Normal (0-30 Hari), Warning (31-60 Hari), Critical (lebih dari 60 Hari)
                  </CardDescription>

                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">

                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_240px_auto]">

                    <div className="relative">

                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                      <Input
                        value={
                          pipelineSearchQuery
                        }
                        onChange={
                          event =>
                            setPipelineSearchQuery(
                              event.target.value
                            )
                        }
                        placeholder="Cari ID, perusahaan, PIC, atau produk..."
                        className="h-9 bg-white pl-9 text-xs"
                      />

                    </div>

                    <Select
                      value={
                        pipelinePicFilter
                      }
                      onValueChange={
                        setPipelinePicFilter
                      }
                    >

                      <SelectTrigger className="h-9 bg-white text-xs">
                        <SelectValue placeholder="Semua PIC" />
                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="ALL">
                          Semua PIC
                        </SelectItem>

                        {pipelinePicOptions.map(
                          option => (

                            <SelectItem
                              key={
                                option.id
                              }
                              value={
                                option.id
                              }
                            >
                              {option.name}
                            </SelectItem>

                          )
                        )}

                      </SelectContent>

                    </Select>

                    <Select
                      value={
                        pipelineProductFilter
                      }
                      onValueChange={
                        setPipelineProductFilter
                      }
                    >

                      <SelectTrigger className="h-9 bg-white text-xs">
                        <SelectValue placeholder="Semua Produk" />
                      </SelectTrigger>

                      <SelectContent>

                        <SelectItem value="ALL">
                          Semua Produk
                        </SelectItem>

                        {pipelineProductOptions.map(
                          productName => (

                            <SelectItem
                              key={
                                productName
                              }
                              value={
                                productName
                              }
                            >
                              {productName}
                            </SelectItem>

                          )
                        )}

                      </SelectContent>

                    </Select>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={
                        resetPipelineMonitorFilters
                      }
                      disabled={
                        !pipelineMonitorFilterActive
                      }
                      className="h-9 gap-1.5 whitespace-nowrap text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset
                    </Button>

                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-500">

                    <span>
                      Search berlaku untuk nama perusahaan, PIC Marketing, nama produk, dan ID Pipeline.
                    </span>

                    <span>
                      Menampilkan{' '}
                      <span className="font-black text-gray-800">
                        {pipelineMonitorRows.length}
                      </span>{' '}
                      dari{' '}
                      <span className="font-black text-gray-800">
                        {activePipelines.length}
                      </span>{' '}
                      pipeline aktif
                    </span>

                  </div>

                </div>

              </CardHeader>

              <CardContent>

                {activePipelines.length ===
                0 ? (

                  <div className="p-8 text-center text-xs text-gray-400">
                    Belum ada data pipeline aktif.
                  </div>

                ) : pipelineMonitorRows.length ===
                0 ? (

                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-10 text-center">

                    <Search className="mx-auto h-6 w-6 text-gray-300" />

                    <div className="mt-2 text-xs font-bold text-gray-600">
                      Pipeline tidak ditemukan
                    </div>

                    <p className="mt-1 text-[10px] text-gray-400">
                      Coba ubah kata pencarian atau reset filter PIC / Produk.
                    </p>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={
                        resetPipelineMonitorFilters
                      }
                      className="mt-3 h-8 gap-1.5 text-[10px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset Filter
                    </Button>

                  </div>

                ) : (

                  <div className="overflow-x-auto">

                    <table className="w-full text-left text-xs">

                      <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-[10px]">

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
                            PIC
                          </th>

                          <th className="p-3">
                            Status
                          </th>

                          <th className="p-3">
                            Current Handler
                          </th>

                          <th className="p-3">
                            Day Lapse
                          </th>

                        </tr>

                      </thead>

                      <tbody className="divide-y divide-gray-100">

                        {pipelineMonitorRows.map(
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
                              isCritical
                                ? 'bg-rose-50/70'
                                : isWarning
                                ? 'bg-amber-50/70'
                                : 'hover:bg-gray-50';

                            return (

                              <tr
                                key={
                                  pipeline.id
                                }
                                className={`${rowBg} transition-colors`}
                              >

                                <td className="p-3 font-mono font-bold text-blue-700">
                                  {pipeline.id}
                                </td>

                                <td className="p-3 font-semibold text-gray-900">
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

                                <td className="p-3 text-gray-700">
                                  {pipeline.picName}
                                </td>

                                <td className="p-3">
                                  <StatusBadge
                                    status={
                                      pipeline.status
                                    }
                                  />
                                </td>

                                <td className="p-3 font-semibold text-gray-700">
                                  {pipeline.currentHandler}
                                </td>

                                <td className="p-3">

                                  <span
                                    className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                      isCritical
                                        ? 'bg-rose-600 text-white'
                                        : isWarning
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-gray-100 text-gray-700'
                                    }`}
                                  >
                                    Lapse {pipeline.dayLapse} Hari
                                  </span>

                                </td>

                              </tr>

                            );
                          }
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              PRODUCT MIX
          =================================================== */}

          <TabsContent
            value="productmix"
            className="space-y-4 mt-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">

                  <div>

                    <CardTitle className="text-sm font-bold">
                      {productMixMode ===
                      'REALISASI'
                        ? 'Product Mix Portfolio (Realisasi Produksi)'
                        : 'Product Mix Portfolio (Pipeline Value)'}
                    </CardTitle>

                    <CardDescription className="text-xs mt-1">
                      {productMixMode ===
                      'REALISASI'
                        ? showProductMixDivisionSplit
                          ? 'Distribusi realisasi produksi per produk. Pada scope Semua Marketing, setiap produk dibandingkan antara Captive Marketing dan Corporate & Retail Marketing.'
                          : 'Distribusi realisasi produksi per produk berdasarkan tahun, scope, dan jenis bisnis yang dipilih.'
                        : showProductMixDivisionSplit
                          ? 'Distribusi nilai active pipeline per produk. Pada scope Semua Marketing, setiap produk dibandingkan antara Captive Marketing dan Corporate & Retail Marketing.'
                          : 'Distribusi nilai active pipeline per produk berdasarkan tahun, scope, dan jenis bisnis yang dipilih.'}
                    </CardDescription>

                  </div>

                  <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1">

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        productMixMode ===
                        'PIPELINE'
                          ? 'default'
                          : 'ghost'
                      }
                      onClick={() =>
                        setProductMixMode(
                          'PIPELINE'
                        )
                      }
                      className={`h-8 px-3 text-[11px] font-bold ${
                        productMixMode ===
                        'PIPELINE'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'text-gray-600 hover:bg-white'
                      }`}
                    >
                      Pipeline Value
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant={
                        productMixMode ===
                        'REALISASI'
                          ? 'default'
                          : 'ghost'
                      }
                      onClick={() =>
                        setProductMixMode(
                          'REALISASI'
                        )
                      }
                      className={`h-8 px-3 text-[11px] font-bold ${
                        productMixMode ===
                        'REALISASI'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'text-gray-600 hover:bg-white'
                      }`}
                    >
                      Realisasi Produksi
                    </Button>

                  </div>

                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">

                  <Badge
                    variant="outline"
                    className="bg-white text-gray-700"
                  >
                    {productMixData.length}{' '}
                    Produk
                  </Badge>

                  {showProductMixDivisionSplit && (
                    <Badge
                      variant="outline"
                      className="bg-blue-50 text-blue-700 border-blue-200"
                    >
                      Captive:{' '}
                      {formatRupiah(
                        productMixCaptiveTotal
                      )}
                    </Badge>
                  )}

                  {showProductMixDivisionSplit && (
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Corporate & Retail:{' '}
                      {formatRupiah(
                        productMixCrmTotal
                      )}
                    </Badge>
                  )}

                  <Badge
                    variant="outline"
                    className="bg-gray-50 text-gray-900 border-gray-300 font-bold"
                  >
                    {showProductMixDivisionSplit
                      ? 'Grand Total'
                      : 'Total'}:{' '}
                    {formatRupiah(
                      productMixTotal
                    )}
                  </Badge>

                </div>

              </CardHeader>

              <CardContent>

                {productMixData.length ===
                0 ? (

                  <div className="h-72 flex items-center justify-center text-center text-xs text-gray-400">
                    {productMixMode ===
                    'REALISASI'
                      ? 'Belum ada Realisasi Produksi Official pada filter yang dipilih.'
                      : 'Belum ada Active Pipeline pada filter yang dipilih.'}
                  </div>

                ) : (

                  <div className="space-y-5">

                    <div className="h-80">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >

                        <BarChart
                          data={
                            productMixChartData
                          }
                          margin={{
                            top: 8,
                            right: 12,
                            left: 12,
                            bottom: 8,
                          }}
                          barCategoryGap={
                            showProductMixDivisionSplit
                              ? '24%'
                              : '36%'
                          }
                        >

                          <XAxis
                            dataKey="axisLabel"
                            interval={0}
                            height={34}
                            tick={{
                              fontSize: 10,
                              fontWeight: 700,
                            }}
                          />

                          <YAxis
                            tick={{
                              fontSize: 10,
                            }}
                            tickFormatter={(
                              value
                            ) =>
                              formatCompactRupiah(
                                Number(
                                  value
                                )
                              )
                            }
                            width={78}
                          />

                          <Tooltip
                            formatter={(
                              value,
                              name
                            ) => [
                              formatRupiah(
                                Number(
                                  value
                                )
                              ),
                              name ===
                              'captive'
                                ? 'Captive Marketing'
                                : name ===
                                  'crm'
                                  ? 'Corporate & Retail Marketing'
                                  : productMixMode ===
                                    'REALISASI'
                                    ? 'Realisasi Produksi'
                                    : 'Pipeline Value',
                            ]}
                            labelFormatter={(
                              label
                            ) => {
                              const row =
                                productMixChartData.find(
                                  item =>
                                    item.axisLabel ===
                                    label
                                );

                              return row
                                ? `${label} — ${row.product}`
                                : String(
                                    label
                                  );
                            }}
                          />

                          {showProductMixDivisionSplit && (
                            <Legend
                              verticalAlign="top"
                              height={32}
                              formatter={(
                                value
                              ) =>
                                value ===
                                'captive'
                                  ? 'Captive Marketing'
                                  : value ===
                                    'crm'
                                    ? 'Corporate & Retail Marketing'
                                    : value
                              }
                            />
                          )}

                          {showProductMixDivisionSplit && (
                            <Bar
                              dataKey="captive"
                              name="captive"
                              fill="#2563eb"
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                            />
                          )}

                          {showProductMixDivisionSplit && (
                            <Bar
                              dataKey="crm"
                              name="crm"
                              fill="#10b981"
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                            />
                          )}

                          {!showProductMixDivisionSplit && (
                            <Bar
                              dataKey="nilai"
                              fill={
                                productMixMode ===
                                'REALISASI'
                                  ? '#10b981'
                                  : '#3b82f6'
                              }
                              radius={[
                                4,
                                4,
                                0,
                                0,
                              ]}
                            />
                          )}

                        </BarChart>

                      </ResponsiveContainer>

                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">

                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">

                        <p className="text-xs font-bold text-gray-800">
                          Summary Product Mix
                        </p>

                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {showProductMixDivisionSplit
                            ? 'Scope Semua Marketing menampilkan perbandingan Captive Marketing dan Corporate & Retail Marketing untuk produk yang sama, termasuk saat jenis bisnis dipilih Overall, New Business, maupun Renewal.'
                            : 'Kode P1, P2, dan seterusnya mengikuti urutan bar pada grafik di atas.'}
                        </p>

                      </div>

                      <div className="overflow-x-auto">

                        <table className="w-full text-xs">

                          <thead className="bg-white border-b border-gray-200 uppercase text-[10px] text-gray-500">

                            <tr>

                              <th className="p-3 text-left w-16">
                                Axis
                              </th>

                              <th className="p-3 text-left">
                                Produk
                              </th>

                              {showProductMixDivisionSplit ? (
                                <>
                                  <th className="p-3 text-right">
                                    Captive Marketing
                                  </th>

                                  <th className="p-3 text-right">
                                    Corporate & Retail Marketing
                                  </th>

                                  <th className="p-3 text-right">
                                    Total
                                  </th>
                                </>
                              ) : (
                                <th className="p-3 text-right">
                                  {productMixMode ===
                                  'REALISASI'
                                    ? 'Realisasi Produksi'
                                    : 'Pipeline Value'}
                                </th>
                              )}

                              <th className="p-3 text-right w-24">
                                Mix
                              </th>

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-gray-100">

                            {productMixChartData.map(
                              row => (

                                <tr
                                  key={
                                    row.axisLabel
                                  }
                                  className="hover:bg-gray-50"
                                >

                                  <td className="p-3">

                                    <Badge
                                      variant="outline"
                                      className={
                                        productMixMode ===
                                        'REALISASI'
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold'
                                          : 'bg-blue-50 text-blue-700 border-blue-200 font-bold'
                                      }
                                    >
                                      {row.axisLabel}
                                    </Badge>

                                  </td>

                                  <td className="p-3 font-semibold text-gray-900">
                                    {row.product}
                                  </td>

                                  {showProductMixDivisionSplit ? (
                                    <>
                                      <td className="p-3 text-right font-bold text-blue-700 whitespace-nowrap">
                                        {formatRupiah(
                                          row.captive
                                        )}
                                      </td>

                                      <td className="p-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                        {formatRupiah(
                                          row.crm
                                        )}
                                      </td>

                                      <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                        {formatRupiah(
                                          row.nilai
                                        )}
                                      </td>
                                    </>
                                  ) : (
                                    <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                      {formatRupiah(
                                        row.nilai
                                      )}
                                    </td>
                                  )}

                                  <td className="p-3 text-right font-semibold text-gray-700">
                                    {row.mixPercentage.toLocaleString(
                                      'id-ID',
                                      {
                                        minimumFractionDigits:
                                          1,
                                        maximumFractionDigits:
                                          1,
                                      }
                                    )}
                                    %
                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                          <tfoot className="bg-gray-50 border-t border-gray-200">

                            <tr>

                              <td
                                colSpan={2}
                                className="p-3 font-bold text-gray-900"
                              >
                                TOTAL
                              </td>

                              {showProductMixDivisionSplit ? (
                                <>
                                  <td className="p-3 text-right font-bold text-blue-700 whitespace-nowrap">
                                    {formatRupiah(
                                      productMixCaptiveTotal
                                    )}
                                  </td>

                                  <td className="p-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                    {formatRupiah(
                                      productMixCrmTotal
                                    )}
                                  </td>

                                  <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                    {formatRupiah(
                                      productMixTotal
                                    )}
                                  </td>
                                </>
                              ) : (
                                <td className="p-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                  {formatRupiah(
                                    productMixTotal
                                  )}
                                </td>
                              )}

                              <td className="p-3 text-right font-bold text-gray-900">
                                {productMixTotal !==
                                0
                                  ? '100,0%'
                                  : '0,0%'}
                              </td>

                            </tr>

                          </tfoot>

                        </table>

                      </div>

                    </div>

                  </div>

                )}

              </CardContent>

            </Card>

          </TabsContent>

          {/* ==================================================
              LOSE ANALYSIS
          =================================================== */}

          <TabsContent
            value="lose"
            className="space-y-5 mt-4"
          >

            {losePipelines.length ===
            0 ? (

              <Card className="border-gray-200">

                <CardHeader>

                  <CardTitle className="text-sm font-bold text-rose-800">
                    Executive LOSE Analysis
                  </CardTitle>

                  <CardDescription className="text-xs">
                    Ringkasan penyebab kekalahan berdasarkan scope dan filter yang dipilih
                  </CardDescription>

                </CardHeader>

                <CardContent>

                  <div className="p-10 text-center text-xs text-gray-400">
                    Belum ada catatan LOSE untuk scope dan periode ini.
                  </div>

                </CardContent>

              </Card>

            ) : (

              <>

                {/* SUMMARY CARDS */}

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

                  <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white shadow-sm">

                    <CardHeader className="pb-1 pt-4">

                      <CardDescription className="text-xs font-bold text-rose-700 uppercase">
                        Total LOSE Case
                      </CardDescription>

                    </CardHeader>

                    <CardContent className="pb-4">

                      <div className="text-2xl font-black text-rose-900">
                        {losePipelines.length} Case
                      </div>

                      <p className="text-[11px] text-rose-600 mt-1">
                        Pipeline berstatus LOSE
                      </p>

                    </CardContent>

                  </Card>

                  <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-sm">

                    <CardHeader className="pb-1 pt-4">

                      <CardDescription className="text-xs font-bold text-amber-700 uppercase">
                        Total Nilai LOSE
                      </CardDescription>

                    </CardHeader>

                    <CardContent className="pb-4">

                      <div className="text-2xl font-black text-amber-900">
                        {formatRupiah(
                          totalLoseValue
                        )}
                      </div>

                      <p className="text-[11px] text-amber-600 mt-1">
                        Nilai komersial yang tidak berhasil dikonversi
                      </p>

                    </CardContent>

                  </Card>

                  <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm">

                    <CardHeader className="pb-1 pt-4">

                      <CardDescription className="text-xs font-bold text-orange-700 uppercase">
                        Alasan Terbanyak
                      </CardDescription>

                    </CardHeader>

                    <CardContent className="pb-4">

                      <div className="text-sm font-black text-orange-900 leading-snug min-h-10">
                        {topLoseReason?.label ||
                          '-'}
                      </div>

                      <p className="text-[11px] text-orange-600 mt-1">
                        {topLoseReason
                          ? `${topLoseReason.count} Case (${topLoseReason.percentage.toFixed(1)}%)`
                          : '-'}
                      </p>

                    </CardContent>

                  </Card>

                  <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white shadow-sm">

                    <CardHeader className="pb-1 pt-4">

                      <CardDescription className="text-xs font-bold text-violet-700 uppercase">
                        Unit dengan Nilai LOSE Tertinggi
                      </CardDescription>

                    </CardHeader>

                    <CardContent className="pb-4">

                      <div className="text-sm font-black text-violet-900 leading-snug min-h-10">
                        {topLoseOrganization?.label ||
                          '-'}
                      </div>

                      <p className="text-[11px] text-violet-600 mt-1">
                        {topLoseOrganization
                          ? `${formatRupiah(topLoseOrganization.value)} • ${topLoseOrganization.count} Case`
                          : '-'}
                      </p>

                    </CardContent>

                  </Card>

                </div>

                {/* EXECUTIVE CHARTS */}

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

                  {/* REASON BAR CHART */}

                  <Card className="border-gray-200 xl:col-span-3">

                    <CardHeader className="pb-2">

                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">

                        <div>

                          <CardTitle className="text-sm font-bold text-gray-900">
                            Penyebab LOSE
                          </CardTitle>

                          <CardDescription className="text-xs mt-1">
                            Ranking 5 alasan baku kekalahan berdasarkan scope terpilih
                          </CardDescription>

                        </div>

                        <div className="bg-gray-100 p-0.5 rounded-lg flex items-center gap-1 text-[11px] font-semibold shrink-0">

                          <button
                            type="button"
                            onClick={() =>
                              setLoseMetricMode(
                                'COUNT'
                              )
                            }
                            className={`px-3 py-1.5 rounded-md transition-all ${
                              loseMetricMode ===
                              'COUNT'
                                ? 'bg-white text-rose-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Jumlah Case
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setLoseMetricMode(
                                'VALUE'
                              )
                            }
                            className={`px-3 py-1.5 rounded-md transition-all ${
                              loseMetricMode ===
                              'VALUE'
                                ? 'bg-white text-rose-700 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            Nilai Premi
                          </button>

                        </div>

                      </div>

                    </CardHeader>

                    <CardContent className="h-[340px] pt-2">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >

                        <BarChart
                          data={
                            loseReasonChartData
                          }
                          layout="vertical"
                          margin={{
                            top: 8,
                            right: 24,
                            left: 18,
                            bottom: 8,
                          }}
                        >

                          <XAxis
                            type="number"
                            tick={{
                              fontSize: 10,
                            }}
                            tickFormatter={(
                              value
                            ) =>
                              loseMetricMode ===
                              'COUNT'
                                ? String(
                                    value
                                  )
                                : formatCompactRupiah(
                                    Number(
                                      value
                                    )
                                  )
                            }
                          />

                          <YAxis
                            type="category"
                            dataKey="label"
                            width={220}
                            tick={{
                              fontSize: 10,
                            }}
                          />

                          <Tooltip
                            formatter={(
                              value
                            ) =>
                              loseMetricMode ===
                              'COUNT'
                                ? `${Number(value)} Case`
                                : formatRupiah(
                                    Number(
                                      value
                                    )
                                  )
                            }
                          />

                          <Bar
                            dataKey={
                              loseMetricMode ===
                              'COUNT'
                                ? 'count'
                                : 'value'
                            }
                            fill="#e11d48"
                            radius={[
                              0,
                              5,
                              5,
                              0,
                            ]}
                          />

                        </BarChart>

                      </ResponsiveContainer>

                    </CardContent>

                  </Card>

                  {/* DONUT COMPOSITION */}

                  <Card className="border-gray-200 xl:col-span-2">

                    <CardHeader className="pb-2">

                      <CardTitle className="text-sm font-bold text-gray-900">
                        Komposisi Alasan LOSE
                      </CardTitle>

                      <CardDescription className="text-xs">
                        Persentase berdasarkan jumlah case
                      </CardDescription>

                    </CardHeader>

                    <CardContent className="h-[340px]">

                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                      >

                        <PieChart>

                          <Pie
                            data={
                              loseReasonData
                            }
                            dataKey="count"
                            nameKey="label"
                            cx="50%"
                            cy="44%"
                            innerRadius={58}
                            outerRadius={92}
                            paddingAngle={2}
                          >

                            {loseReasonData.map(
                              (
                                entry,
                                index
                              ) => (

                                <Cell
                                  key={`lose-reason-${index}`}
                                  fill={
                                    entry.color
                                  }
                                />

                              )
                            )}

                          </Pie>

                          <Tooltip
                            formatter={(
                              value
                            ) =>
                              `${Number(value)} Case`
                            }
                          />

                          <Legend
                            verticalAlign="bottom"
                            height={78}
                            wrapperStyle={{
                              fontSize: 10,
                            }}
                          />

                        </PieChart>

                      </ResponsiveContainer>

                    </CardContent>

                  </Card>

                </div>

                {/* LOSE BY ORGANIZATION */}

                <Card className="border-gray-200">

                  <CardHeader className="pb-2">

                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">

                      <div>

                        <CardTitle className="text-sm font-bold text-gray-900">
                          {loseOrganizationChartTitle}
                        </CardTitle>

                        <CardDescription className="text-xs mt-1">
                          {loseOrganizationChartDescription}
                        </CardDescription>

                      </div>

                      <Badge
                        variant="outline"
                        className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] font-semibold"
                      >
                        {loseMetricMode ===
                        'COUNT'
                          ? 'Metric: Jumlah Case'
                          : 'Metric: Nilai Premi'}
                      </Badge>

                    </div>

                  </CardHeader>

                  <CardContent className="h-[320px] pt-2">

                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >

                      <BarChart
                        data={
                          loseOrganizationData
                        }
                        layout="vertical"
                        margin={{
                          top: 8,
                          right: 28,
                          left: 20,
                          bottom: 8,
                        }}
                      >

                        <XAxis
                          type="number"
                          tick={{
                            fontSize: 10,
                          }}
                          tickFormatter={(
                            value
                          ) =>
                            loseMetricMode ===
                            'COUNT'
                              ? String(
                                  value
                                )
                              : formatCompactRupiah(
                                  Number(
                                    value
                                  )
                                )
                          }
                        />

                        <YAxis
                          type="category"
                          dataKey="label"
                          width={185}
                          tick={{
                            fontSize: 10,
                          }}
                        />

                        <Tooltip
                          formatter={(
                            value
                          ) =>
                            loseMetricMode ===
                            'COUNT'
                              ? `${Number(value)} Case`
                              : formatRupiah(
                                  Number(
                                    value
                                  )
                                )
                          }
                        />

                        <Bar
                          dataKey={
                            loseMetricMode ===
                            'COUNT'
                              ? 'count'
                              : 'value'
                          }
                          fill="#7c3aed"
                          radius={[
                            0,
                            5,
                            5,
                            0,
                          ]}
                        />

                      </BarChart>

                    </ResponsiveContainer>

                  </CardContent>

                </Card>

                {/* EXECUTIVE TAKEAWAY */}

                <Card className="border-rose-100 bg-rose-50/40">

                  <CardContent className="py-4">

                    <div className="flex items-start gap-3">

                      <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />

                      <div>

                        <div className="text-xs font-bold text-rose-900">
                          Executive Takeaway
                        </div>

                        <p className="text-[11px] text-rose-800 mt-1 leading-relaxed">
                          Penyebab LOSE terbanyak saat ini adalah <span className="font-bold">{topLoseReason?.label}</span> dengan <span className="font-bold">{topLoseReason?.count} case</span>. Nilai LOSE tertinggi berada pada <span className="font-bold">{topLoseOrganization?.label}</span> sebesar <span className="font-bold">{formatRupiah(topLoseOrganization?.value || 0)}</span>. Gunakan insight ini untuk menentukan fokus evaluasi pricing, benefit, proses tender, dan strategi follow-up.
                        </p>

                      </div>

                    </div>

                  </CardContent>

                </Card>

              </>

            )}

          </TabsContent>

          {/* ==================================================
              HISTORICAL
          =================================================== */}

          <TabsContent
            value="historical"
            className="space-y-4 mt-4"
          >

            <Card className="border-gray-200">

              <CardHeader>

                <CardTitle className="text-sm font-bold">
                  Historical Performance & YoY Growth
                </CardTitle>

                <CardDescription className="text-xs">
                  Perbandingan tren produksi antar tahun
                </CardDescription>

              </CardHeader>

              <CardContent>

                <div className="p-6 text-center text-xs text-gray-500">
                  Visualisasi grafik perbandingan YoY otomatis teragregasi setelah data histori produksi diupload pada menu Produksi.
                </div>

              </CardContent>

            </Card>

          </TabsContent>

        </Tabs>

      </div>
    </AppLayout>
  );
};

export default Index;