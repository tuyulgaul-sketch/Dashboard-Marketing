import React, { useEffect, useState } from 'react';
import { store } from '@/services/store';
import {
  User,
  BookingCase,
  Pipeline,
  ProductionTransaction,
  ParticipantAddition,
  Reimbursement,
} from '@/types';
import { formatRupiah } from '@/utils/formatters';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  ChevronRight,
  Clock3,
  Inbox,
  ListTodo,
  Lock,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface WorkItem {
  id: string;
  type:
    | 'Booking'
    | 'Pipeline'
    | 'Produksi'
    | 'Peserta'
    | 'Reimbursement';
  reference: string;
  picName: string;
  entryDate: string;
  agingDays: number;
  status: string;
  claimedBy?: string;
  claimedByName?: string;
  linkPath: string;
}

export const MarketingSupportDashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(
    store.getCurrentUser()
  );

  const [bookings, setBookings] =
    useState<BookingCase[]>([]);

  const [pipelines, setPipelines] =
    useState<Pipeline[]>([]);

  const [productions, setProductions] =
    useState<ProductionTransaction[]>([]);

  const [participants, setParticipants] =
    useState<ParticipantAddition[]>([]);

  const [reimbursements, setReimbursements] =
    useState<Reimbursement[]>([]);

  const [activeQueueTab, setActiveQueueTab] =
    useState<string>('all');

  const navigate = useNavigate();

  useEffect(() => {
    const refresh = () => {
      setCurrentUser(
        store.getCurrentUser()
      );

      setBookings(
        store.getBookings()
      );

      setPipelines(
        store.getPipelines()
      );

      setProductions(
        store.getProductions()
      );

      setParticipants(
        store.getParticipants()
      );

      setReimbursements(
        store.getReimbursements()
      );
    };

    refresh();

    return store.subscribe(refresh);
  }, []);

  // ============================================================
  // ROLE
  // ============================================================

  const isTLMS =
    currentUser.role ===
      'TEAM_LEADER_MARKETING_SUPPORT' ||
    currentUser.role ===
      'SYSTEM_ADMIN';

  // ============================================================
  // AGING HELPER
  // ============================================================

  const calculateDays = (
    dateStr: string
  ) => {
    if (!dateStr) {
      return 0;
    }

    const diff =
      new Date().getTime() -
      new Date(dateStr).getTime();

    return Math.max(
      0,
      Math.floor(
        diff /
          (1000 * 60 * 60 * 24)
      )
    );
  };

  // ============================================================
  // BOOKING
  // ============================================================

  const pendingBookings =
    bookings.filter(
      (booking) =>
        booking.status ===
          'Submitted' ||
        booking.status ===
          'Claimed'
    );

  const unclaimedBookings =
    bookings.filter(
      (booking) =>
        booking.status ===
          'Submitted' &&
        !booking.claimedBy
    );

  const myBookings =
    bookings.filter(
      (booking) =>
        booking.claimedBy ===
          currentUser.id &&
        booking.status ===
          'Claimed'
    );

  // ============================================================
  // PIPELINE
  // ============================================================

  const msPipelineStatuses = [
    'Dokumen Diajukan oleh Marketing',
    'On Progress Marketing Support',
    'Dokumen Closing Diajukan',
    'Dalam Verifikasi Marketing Support',
    'Menunggu Final Approval Team Leader Marketing Support',
  ];

  const pendingPipelines =
    pipelines.filter(
      (pipeline) =>
        msPipelineStatuses.includes(
          pipeline.status
        )
    );

  // ============================================================
  // PRODUCTION / INVOICE
  // ============================================================

  const pendingProductions =
    productions.filter(
      (production) =>
        production.status ===
        'Pending Checker'
    );

  // ============================================================
  // PARTICIPANT ADDITION
  // ============================================================

  const pendingParticipants =
    participants.filter(
      (participant) =>
        participant.status ===
        'Pending Verification'
    );

  // ============================================================
  // REIMBURSEMENT
  // ============================================================

  const pendingReimbursements =
    reimbursements.filter(
      (reimbursement) =>
        reimbursement.status ===
          'Submitted' ||
        reimbursement.status ===
          'Approved Superior' ||
        reimbursement.status ===
          'Verified MS'
    );

  // ============================================================
  // KPI
  // ============================================================

  const totalActionable =
    pendingBookings.length +
    pendingPipelines.length +
    pendingProductions.length +
    pendingParticipants.length +
    pendingReimbursements.length;

  const totalUnclaimed =
    unclaimedBookings.length;

  const totalMyClaimed =
    myBookings.length +
    productions.filter(
      (production) =>
        production.makerUserId ===
          currentUser.id &&
        production.status ===
          'Pending Checker'
    ).length;

  const totalFollowUp =
    pipelines.filter(
      (pipeline) =>
        pipeline.status ===
        'Perlu Perbaikan Dokumen Marketing'
    ).length +
    participants.filter(
      (participant) =>
        participant.status ===
        'Needs Revision'
    ).length;

  const totalAgingAttention =
    bookings.filter(
      (booking) =>
        booking.status !==
          'Approved' &&
        booking.status !==
          'Rejected' &&
        calculateDays(
          booking.createdAt
        ) >= 2
    ).length +
    pipelines.filter(
      (pipeline) =>
        pipeline.dayLapse >= 2 &&
        pipeline.status !==
          'WIN' &&
        pipeline.status !==
          'LOSE'
    ).length;

  // ============================================================
  // FINAL APPROVAL TL MS
  // ============================================================

  const tlFinalApprovalItems = [
    ...bookings.filter(
      (booking) =>
        booking.status ===
          'Claimed' ||
        booking.verificationRecommendation ===
          'VALID'
    ),

    ...pipelines.filter(
      (pipeline) =>
        pipeline.status ===
        'Menunggu Final Approval Team Leader Marketing Support'
    ),

    ...reimbursements.filter(
      (reimbursement) =>
        reimbursement.status ===
        'Verified MS'
    ),
  ];

  // ============================================================
  // UNIFIED WORK QUEUE
  // ============================================================

  const workItems: WorkItem[] = [
    ...pendingBookings.map(
      (booking) => ({
        id: booking.id,

        type:
          'Booking' as const,

        reference:
          booking.customerName,

        picName:
          booking.picName,

        entryDate:
          booking.createdAt,

        agingDays:
          calculateDays(
            booking.createdAt
          ),

        status:
          booking.status,

        claimedBy:
          booking.claimedBy,

        claimedByName:
          booking.claimedByName,

        linkPath:
          '/booking-pipeline?tab=verifier',
      })
    ),

    ...pendingPipelines.map(
      (pipeline) => ({
        id:
          pipeline.id,

        type:
          'Pipeline' as const,

        reference:
          `${pipeline.customerName} (${pipeline.productName})`,

        picName:
          pipeline.picName,

        entryDate:
          pipeline.createdAt,

        agingDays:
          pipeline.dayLapse,

        status:
          pipeline.status,

        claimedBy:
          pipeline.picUserId,

        claimedByName:
          pipeline.picName,

        linkPath:
          '/booking-pipeline?tab=pipeline',
      })
    ),

    ...pendingProductions.map(
      (production) => ({
        id:
          production.id,

        type:
          'Produksi' as const,

        reference:
          `${production.customerName} - Invoice ${production.coreInvoiceNumber}`,

        picName:
          production.makerUserName,

        entryDate:
          production.makerTimestamp,

        agingDays:
          calculateDays(
            production.makerTimestamp
          ),

        status:
          production.status,

        claimedBy:
          production.makerUserId,

        claimedByName:
          production.makerUserName,

        linkPath:
          '/produksi?tab=maker_checker',
      })
    ),

    ...pendingParticipants.map(
      (participant) => ({
        id:
          participant.id,

        type:
          'Peserta' as const,

        reference:
          `${participant.customerName} (Polis ${participant.corePolicyNumber})`,

        picName:
          participant.uploadedBy,

        entryDate:
          participant.uploadedAt,

        agingDays:
          calculateDays(
            participant.uploadedAt
          ),

        status:
          participant.status,

        linkPath:
          '/produksi',
      })
    ),

    ...pendingReimbursements.map(
      (reimbursement) => ({
        id:
          reimbursement.id,

        type:
          'Reimbursement' as const,

        reference:
          `${reimbursement.userName} - ${reimbursement.companyName} (${formatRupiah(
            reimbursement.amount
          )})`,

        picName:
          reimbursement.userName,

        entryDate:
          reimbursement.createdAt,

        agingDays:
          calculateDays(
            reimbursement.createdAt
          ),

        status:
          reimbursement.status,

        linkPath:
          '/aktivitas?tab=reimbursement',
      })
    ),
  ];

  // ============================================================
  // QUEUE FILTER
  // ============================================================

  const filteredWorkItems =
    workItems.filter(
      (item) => {
        if (
          activeQueueTab ===
          'booking'
        ) {
          return (
            item.type ===
            'Booking'
          );
        }

        if (
          activeQueueTab ===
          'pipeline'
        ) {
          return (
            item.type ===
            'Pipeline'
          );
        }

        if (
          activeQueueTab ===
          'produksi'
        ) {
          return (
            item.type ===
            'Produksi'
          );
        }

        if (
          activeQueueTab ===
          'peserta'
        ) {
          return (
            item.type ===
            'Peserta'
          );
        }

        if (
          activeQueueTab ===
          'reimbursement'
        ) {
          return (
            item.type ===
            'Reimbursement'
          );
        }

        return true;
      }
    );

  const myClaimedItems =
    workItems.filter(
      (item) =>
        item.claimedBy ===
        currentUser.id
    );

  // ============================================================
  // TEAM WORKLOAD
  // ============================================================

  const msUsers =
    store
      .getUsers()
      .filter(
        (user) =>
          user.unit ===
            'Marketing Support' &&
          user.role !==
            'SYSTEM_ADMIN'
      );

  const workloadByStaff =
    msUsers.map(
      (user) => {
        const count =
          workItems.filter(
            (workItem) =>
              workItem.claimedBy ===
                user.id ||
              workItem.picName ===
                user.name
          ).length;

        return {
          user,
          count,
        };
      }
    );

  // ============================================================
  // CLAIM HANDLER
  // ============================================================

  const handleClaimItem = (
    item: WorkItem
  ) => {
    if (
      item.type ===
      'Booking'
    ) {
      const booking =
        bookings.find(
          (record) =>
            record.id ===
            item.id
        );

      if (booking) {
        store.updateBooking({
          ...booking,

          status:
            'Claimed',

          claimedBy:
            currentUser.id,

          claimedByName:
            currentUser.name,

          claimedAt:
            new Date().toISOString(),
        });

        alert(
          `Berhasil meng-claim Booking Case ${item.id}`
        );
      }

      return;
    }

    navigate(
      item.linkPath
    );
  };

  return (
    <div className="space-y-6">

      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">

        <div>

          <div className="flex items-center gap-2">

            <Badge className="bg-blue-600 text-white border-none text-[10px] uppercase font-bold">
              Marketing Support OS
            </Badge>

            <span className="text-xs text-slate-400">
              |
            </span>

            <span className="text-xs font-semibold text-slate-300">
              {currentUser.position}
            </span>

          </div>

          <h1 className="text-xl font-extrabold mt-1">
            Dashboard Operasional & Shared Queue
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Pusat monitoring verifikasi booking, administrasi pipeline, checker nota tagihan, dan alur approval
          </p>

        </div>

        <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center gap-3">

          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-lg shrink-0">
            {currentUser.name.charAt(0)}
          </div>

          <div className="text-xs">

            <div className="font-bold text-slate-100">
              {currentUser.name}
            </div>

            <div className="text-[10px] text-slate-400">
              {currentUser.unit} - {currentUser.department}
            </div>

          </div>

        </div>

      </div>

      {/* =====================================================
          KPI CARDS
      ====================================================== */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">

        {/* PERLU TINDAKAN */}

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/60 to-white shadow-sm">

          <CardHeader className="p-3 pb-1">

            <CardDescription className="text-[11px] font-bold text-blue-800 uppercase flex items-center justify-between">

              <span>
                Perlu Tindakan
              </span>

              <Inbox className="w-4 h-4 text-blue-600" />

            </CardDescription>

          </CardHeader>

          <CardContent className="p-3 pt-0">

            <div className="text-2xl font-black text-blue-950">
              {totalActionable}
            </div>

            <p className="text-[10px] text-blue-700 mt-1 font-medium">
              Total antrean aktif
            </p>

          </CardContent>

        </Card>

        {/* BELUM DI-CLAIM */}

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/60 to-white shadow-sm">

          <CardHeader className="p-3 pb-1">

            <CardDescription className="text-[11px] font-bold text-purple-800 uppercase flex items-center justify-between">

              <span>
                Belum Di-claim
              </span>

              <Lock className="w-4 h-4 text-purple-600" />

            </CardDescription>

          </CardHeader>

          <CardContent className="p-3 pt-0">

            <div className="text-2xl font-black text-purple-950">
              {totalUnclaimed}
            </div>

            <p className="text-[10px] text-purple-700 mt-1 font-medium">
              Shared Queue terbuka
            </p>

          </CardContent>

        </Card>

        {/* SEDANG DIPROSES */}

        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white shadow-sm">

          <CardHeader className="p-3 pb-1">

            <CardDescription className="text-[11px] font-bold text-emerald-800 uppercase flex items-center justify-between">

              <span>
                Sedang Diproses MS
              </span>

              <UserCheck className="w-4 h-4 text-emerald-600" />

            </CardDescription>

          </CardHeader>

          <CardContent className="p-3 pt-0">

            <div className="text-2xl font-black text-emerald-950">
              {totalMyClaimed}
            </div>

            <p className="text-[10px] text-emerald-700 mt-1 font-medium">
              Claimed oleh Anda
            </p>

          </CardContent>

        </Card>

        {/* FOLLOW UP */}

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-white shadow-sm">

          <CardHeader className="p-3 pb-1">

            <CardDescription className="text-[11px] font-bold text-amber-800 uppercase flex items-center justify-between">

              <span>
                Perlu Follow-Up
              </span>

              <AlertCircle className="w-4 h-4 text-amber-600" />

            </CardDescription>

          </CardHeader>

          <CardContent className="p-3 pt-0">

            <div className="text-2xl font-black text-amber-950">
              {totalFollowUp}
            </div>

            <p className="text-[10px] text-amber-700 mt-1 font-medium">
              Revisi & Pending feedback
            </p>

          </CardContent>

        </Card>

        {/* AGING */}

        <Card className="border-rose-200 bg-gradient-to-br from-rose-50/60 to-white shadow-sm col-span-2 lg:col-span-1">

          <CardHeader className="p-3 pb-1">

            <CardDescription className="text-[11px] font-bold text-rose-800 uppercase flex items-center justify-between">

              <span>
                Aging Minimal 2 Hari
              </span>

              <Clock3 className="w-4 h-4 text-rose-600" />

            </CardDescription>

          </CardHeader>

          <CardContent className="p-3 pt-0">

            <div className="text-2xl font-black text-rose-950">
              {totalAgingAttention}
            </div>

            <p className="text-[10px] text-rose-700 mt-1 font-medium">
              Perlu prioritas penanganan
            </p>

          </CardContent>

        </Card>

      </div>

      {/* =====================================================
          TEAM LEADER FINAL APPROVAL
      ====================================================== */}

      {isTLMS && (

        <Card className="border-indigo-300 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">

          <CardHeader className="pb-2">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2">

                <ShieldCheck className="w-5 h-5 text-indigo-600" />

                <CardTitle className="text-sm font-bold text-indigo-950">
                  Menunggu Final Approval Team Leader Marketing Support
                </CardTitle>

              </div>

              <Badge className="bg-indigo-600 text-white font-bold text-xs">
                {tlFinalApprovalItems.length} Case Pending
              </Badge>

            </div>

            <CardDescription className="text-xs text-indigo-800">
              Daftar keputusan akhir administrasi, persetujuan booking case, pipeline, dan reimbursement tim
            </CardDescription>

          </CardHeader>

          <CardContent className="pt-0">

            {tlFinalApprovalItems.length ===
            0 ? (

              <div className="text-xs text-gray-500 italic py-2">
                Tidak ada dokumen yang memerlukan keputusan final Team Leader saat ini.
              </div>

            ) : (

              <div className="divide-y divide-indigo-100">

                {tlFinalApprovalItems.map(
                  (item, index) => {

                    const title =
                      'customerName' in
                      item
                        ? item.customerName
                        : 'companyName' in
                          item
                        ? item.companyName
                        : item.id;

                    return (

                      <div
                        key={`${item.id}-${index}`}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >

                        <div>

                          <span className="font-mono text-xs font-bold text-indigo-900">
                            {item.id}
                          </span>

                          <span className="text-xs font-bold text-gray-900 ml-2">
                            {title}
                          </span>

                        </div>

                        <Button
                          size="sm"
                          onClick={() =>
                            navigate(
                              '/booking-pipeline?tab=verifier'
                            )
                          }
                          className="h-7 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                        >
                          Review & Approve
                        </Button>

                      </div>

                    );
                  }
                )}

              </div>

            )}

          </CardContent>

        </Card>

      )}

      {/* =====================================================
          TINDAKAN YANG MEMBUTUHKAN PERHATIAN
      ====================================================== */}

      <Card className="border-gray-200">

        <CardHeader className="pb-3">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <ListTodo className="w-5 h-5 text-blue-600" />

              <CardTitle className="text-sm font-bold text-gray-900">
                Tindakan Yang Membutuhkan Perhatian
              </CardTitle>

            </div>

            <Badge
              variant="outline"
              className="text-[10px] font-bold text-gray-600"
            >
              Kategori Work Queue MS
            </Badge>

          </div>

          <CardDescription className="text-xs">
            Ringkasan ketersediaan antrean tugas berdasarkan tahapan workflow bisnis
          </CardDescription>

        </CardHeader>

        <CardContent>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">

            {/* BOOKING */}

            <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/40 flex items-center justify-between gap-3">

              <div>

                <span className="text-xs font-bold text-purple-950 block">
                  Booking Belum Di-claim
                </span>

                <span className="text-[11px] text-purple-700 mt-0.5 block">
                  {unclaimedBookings.length} Case dalam Shared Queue
                </span>

              </div>

              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    '/booking-pipeline?tab=verifier'
                  )
                }
                className="h-7 text-[10px] bg-purple-700 hover:bg-purple-800 text-white font-bold"
              >
                Lihat Queue
              </Button>

            </div>

            {/* INVOICE */}

            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 flex items-center justify-between gap-3">

              <div>

                <span className="text-xs font-bold text-blue-950 block">
                  Nota Tagihan / Invoice Pending Checker
                </span>

                <span className="text-[11px] text-blue-700 mt-0.5 block">
                  {pendingProductions.length} Transaksi Maker-Checker
                </span>

              </div>

              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    '/produksi?tab=maker_checker'
                  )
                }
                className="h-7 text-[10px] bg-blue-700 hover:bg-blue-800 text-white font-bold"
              >
                Checker MS
              </Button>

            </div>

            {/* ADDITIONAL PARTICIPANT */}

            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between gap-3">

              <div>

                <span className="text-xs font-bold text-emerald-950 block">
                  Peserta Tambahan Pending Verifikasi
                </span>

                <span className="text-[11px] text-emerald-700 mt-0.5 block">
                  {pendingParticipants.length} Berkas Peserta
                </span>

              </div>

              <Button
                size="sm"
                onClick={() =>
                  navigate('/produksi')
                }
                className="h-7 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                Verifikasi
              </Button>

            </div>

            {/* REIMBURSEMENT */}

            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 flex items-center justify-between gap-3">

              <div>

                <span className="text-xs font-bold text-amber-950 block">
                  Reimbursement Aktivitas Tim
                </span>

                <span className="text-[11px] text-amber-700 mt-0.5 block">
                  {pendingReimbursements.length} Pengajuan
                </span>

              </div>

              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    '/aktivitas?tab=reimbursement'
                  )
                }
                className="h-7 text-[10px] bg-amber-700 hover:bg-amber-800 text-white font-bold"
              >
                Proses RMB
              </Button>

            </div>

            {/* PIPELINE */}

            <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/40 flex items-center justify-between gap-3">

              <div>

                <span className="text-xs font-bold text-indigo-950 block">
                  Pipeline Menunggu Tindakan MS
                </span>

                <span className="text-[11px] text-indigo-700 mt-0.5 block">
                  {pendingPipelines.length} Case On-Going
                </span>

              </div>

              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    '/booking-pipeline?tab=pipeline'
                  )
                }
                className="h-7 text-[10px] bg-indigo-700 hover:bg-indigo-800 text-white font-bold"
              >
                Buka Pipeline
              </Button>

            </div>

          </div>

        </CardContent>

      </Card>

      {/* =====================================================
          SHARED QUEUE + MY WORK
      ====================================================== */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* SHARED QUEUE */}

        <Card className="border-gray-200 lg:col-span-2">

          <CardHeader className="pb-3">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">

              <div>

                <CardTitle className="text-sm font-bold text-gray-900">
                  Shared Work Queue Marketing Support
                </CardTitle>

                <CardDescription className="text-xs mt-0.5">
                  Antrean bersama yang dapat di-claim dan diproses oleh seluruh anggota tim Marketing Support
                </CardDescription>

              </div>

              <Tabs
                value={
                  activeQueueTab
                }
                onValueChange={
                  setActiveQueueTab
                }
                className="w-auto"
              >

                <TabsList className="bg-gray-100 p-1">

                  <TabsTrigger
                    value="all"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    Semua ({workItems.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="booking"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    Booking ({pendingBookings.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="pipeline"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    Pipeline ({pendingPipelines.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="produksi"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    Produksi ({pendingProductions.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="peserta"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    Peserta ({pendingParticipants.length})
                  </TabsTrigger>

                  <TabsTrigger
                    value="reimbursement"
                    className="text-[10px] font-bold px-2 py-1"
                  >
                    RMB ({pendingReimbursements.length})
                  </TabsTrigger>

                </TabsList>

              </Tabs>

            </div>

          </CardHeader>

          <CardContent>

            {filteredWorkItems.length ===
            0 ? (

              <div className="p-12 text-center text-xs text-gray-400">
                Tidak ada pekerjaan Marketing Support yang membutuhkan tindakan saat ini.
              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full text-left text-xs">

                  <thead className="bg-gray-50 border-b border-gray-200 uppercase text-[10px] text-gray-600">

                    <tr>

                      <th className="p-3">
                        Case ID
                      </th>

                      <th className="p-3">
                        Jenis Pekerjaan
                      </th>

                      <th className="p-3">
                        Nasabah / Referensi
                      </th>

                      <th className="p-3">
                        PIC Submit
                      </th>

                      <th className="p-3">
                        Aging Status
                      </th>

                      <th className="p-3">
                        Status Lock / Claim
                      </th>

                      <th className="p-3 text-right">
                        Aksi
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-gray-100">

                    {filteredWorkItems.map(
                      (item) => {
                        const isAgingAttention =
                          item.agingDays >=
                          2;

                        const isAgingCritical =
                          item.agingDays >=
                          3;

                        return (

                          <tr
                            key={`${item.type}-${item.id}`}
                            className="hover:bg-gray-50/80 transition-colors"
                          >

                            <td className="p-3 font-mono font-bold text-blue-700">
                              {item.id}
                            </td>

                            <td className="p-3">

                              <Badge
                                variant="outline"
                                className="text-[10px] font-bold"
                              >
                                {item.type}
                              </Badge>

                            </td>

                            <td className="p-3 font-semibold text-gray-900">
                              {item.reference}
                            </td>

                            <td className="p-3 text-gray-700">
                              {item.picName}
                            </td>

                            <td className="p-3">

                              <span
                                className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                                  isAgingCritical
                                    ? 'bg-rose-600 text-white'
                                    : isAgingAttention
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >

                                {item.agingDays ===
                                0
                                  ? 'Hari ini'
                                  : `${item.agingDays} Hari`}

                              </span>

                            </td>

                            <td className="p-3">

                              {item.claimedByName ? (

                                <span className="text-[11px] font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  Diproses oleh {item.claimedByName}
                                </span>

                              ) : (

                                <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                  Belum Di-claim
                                </span>

                              )}

                            </td>

                            <td className="p-3 text-right">

                              {!item.claimedBy &&
                              item.type ===
                                'Booking' ? (

                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleClaimItem(
                                      item
                                    )
                                  }
                                  className="h-7 text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-bold"
                                >
                                  Claim Lock
                                </Button>

                              ) : (

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    navigate(
                                      item.linkPath
                                    )
                                  }
                                  className="h-7 text-[10px] border-blue-200 text-blue-700 hover:bg-blue-50 font-bold"
                                >
                                  Lihat Case
                                </Button>

                              )}

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

        {/* =====================================================
            RIGHT PANEL
        ====================================================== */}

        <div className="space-y-6 lg:col-span-1">

          {/* PEKERJAAN SAYA */}

          <Card className="border-gray-200">

            <CardHeader className="pb-2">

              <CardTitle className="text-sm font-bold text-gray-900 flex items-center justify-between">

                <span>
                  Pekerjaan Saya
                </span>

                <Badge className="bg-emerald-600 text-white font-bold text-xs">
                  {myClaimedItems.length} Active
                </Badge>

              </CardTitle>

              <CardDescription className="text-xs">
                Dokumen yang saat ini sedang dalam penanganan aktif akun Anda
              </CardDescription>

            </CardHeader>

            <CardContent className="pt-2">

              {myClaimedItems.length ===
              0 ? (

                <div className="text-xs text-gray-400 italic p-4 text-center">
                  Anda belum meng-claim dokumen dari shared queue.
                </div>

              ) : (

                <div className="divide-y divide-gray-100">

                  {myClaimedItems.map(
                    (item) => (

                      <div
                        key={`my-${item.type}-${item.id}`}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >

                        <div>

                          <div className="flex items-center gap-1.5">

                            <span className="font-mono text-xs font-bold text-blue-700">
                              {item.id}
                            </span>

                            <Badge
                              variant="outline"
                              className="text-[9px] px-1 py-0"
                            >
                              {item.type}
                            </Badge>

                          </div>

                          <p className="text-xs font-semibold text-gray-900 mt-0.5">
                            {item.reference}
                          </p>

                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            navigate(
                              item.linkPath
                            )
                          }
                          className="h-7 text-xs text-blue-600 font-bold hover:bg-blue-50"
                        >
                          Buka
                          <ChevronRight className="w-3.5 h-3.5 ml-1" />
                        </Button>

                      </div>

                    )
                  )}

                </div>

              )}

            </CardContent>

          </Card>

          {/* ==================================================
              REMINDER
          =================================================== */}

          <Card className="border-amber-200 bg-amber-50/30">

            <CardHeader className="pb-2">

              <CardTitle className="text-sm font-bold text-amber-950 flex items-center gap-2">

                <Bell className="w-4 h-4 text-amber-600" />

                <span>
                  Pengingat & Alert Operasional
                </span>

              </CardTitle>

            </CardHeader>

            <CardContent className="space-y-2 pt-1 text-xs">

              {unclaimedBookings.length >
                0 && (

                <div className="p-2 bg-white rounded-lg border border-amber-200 text-amber-900 font-medium flex items-center justify-between gap-2">

                  <span>
                    {unclaimedBookings.length} Booking Case belum di-claim
                  </span>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        '/booking-pipeline?tab=verifier'
                      )
                    }
                    className="h-6 text-[10px] text-amber-800 font-bold"
                  >
                    Proses
                  </Button>

                </div>

              )}

              {pendingProductions.length >
                0 && (

                <div className="p-2 bg-white rounded-lg border border-blue-200 text-blue-900 font-medium flex items-center justify-between gap-2">

                  <span>
                    {pendingProductions.length} Invoice pending Checker MS
                  </span>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        '/produksi?tab=maker_checker'
                      )
                    }
                    className="h-6 text-[10px] text-blue-800 font-bold"
                  >
                    Checker
                  </Button>

                </div>

              )}

              {totalAgingAttention >
                0 && (

                <div className="p-2 bg-white rounded-lg border border-rose-200 text-rose-900 font-medium flex items-center justify-between gap-2">

                  <span>
                    {totalAgingAttention} Case telah menunggu minimal 2 Hari
                  </span>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      navigate(
                        '/booking-pipeline'
                      )
                    }
                    className="h-6 text-[10px] text-rose-800 font-bold"
                  >
                    Cek Case
                  </Button>

                </div>

              )}

              {unclaimedBookings.length ===
                0 &&
                pendingProductions.length ===
                  0 &&
                totalAgingAttention ===
                  0 && (

                  <div className="text-xs text-gray-500 italic p-2 text-center">
                    Semua pengingat operasional aman.
                  </div>

                )}

            </CardContent>

          </Card>

        </div>

      </div>

      {/* =====================================================
          TEAM LEADER WORKLOAD
      ====================================================== */}

      {isTLMS && (

        <Card className="border-gray-200">

          <CardHeader className="pb-3">

            <div className="flex items-center gap-2">

              <Users className="w-5 h-5 text-gray-700" />

              <div>

                <CardTitle className="text-sm font-bold text-gray-900">
                  Workload Tim Marketing Support
                </CardTitle>

                <CardDescription className="text-xs">
                  Distribusi beban kasus aktif per personil Marketing Support untuk monitoring operasional
                </CardDescription>

              </div>

            </div>

          </CardHeader>

          <CardContent>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">

              {workloadByStaff.map(
                ({
                  user,
                  count,
                }) => (

                  <div
                    key={
                      user.id
                    }
                    className="p-3.5 rounded-xl border border-gray-200 bg-white flex items-center justify-between"
                  >

                    <div>

                      <div className="text-xs font-bold text-gray-900">
                        {user.name}
                      </div>

                      <div className="text-[10px] text-gray-500">
                        {user.position}
                      </div>

                    </div>

                    <div className="text-right">

                      <span className="text-lg font-black text-blue-900">
                        {count}
                      </span>

                      <span className="text-[10px] text-gray-400 block">
                        Case
                      </span>

                    </div>

                  </div>

                )
              )}

            </div>

          </CardContent>

        </Card>

      )}

    </div>
  );
};

export default MarketingSupportDashboard;