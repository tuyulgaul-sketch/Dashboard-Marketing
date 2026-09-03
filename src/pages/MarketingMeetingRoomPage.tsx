import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";

import {
  MeetingRoomBooking,
  MeetingRoomCode,
  cancelMeetingRoomBooking,
  createMeetingRoomBooking,
  getMeetingRoomBookings,
  reviewDirpemRoomBooking,
} from "@/services/meetingRoomService";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DoorOpen,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";


const pad = (value: number) =>
  String(value).padStart(2, "0");


const toDateKey = (
  date: Date
) =>
  `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;


const addDays = (
  date: Date,
  days: number
) => {
  const next =
    new Date(date);

  next.setDate(
    next.getDate() + days
  );

  return next;
};


const formatDate = (
  value: string
) =>
  new Date(
    `${value}T00:00:00`
  ).toLocaleDateString(
    "id-ID",
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );


const formatTime = (
  value: string
) =>
  value
    ? value.slice(0, 5)
    : "-";


const normalizeTime = (
  value: string
) =>
  value.length === 5
    ? `${value}:00`
    : value;


const getRoomName = (
  roomCode: MeetingRoomCode
) => {
  if (
    roomCode ===
    "DIRPEM_WORK_ROOM"
  ) {
    return "Ruang Kerja DirPem";
  }

  return "Ruang Meeting Marketing";
};


const getStatusLabel = (
  status:
    MeetingRoomBooking["booking_status"]
) => {
  switch (status) {
    case "BOOKED":
      return "Booked";

    case "PENDING_APPROVAL":
      return "Menunggu Approval";

    case "REJECTED":
      return "Ditolak";

    case "CANCELLED":
      return "Dibatalkan";

    default:
      return status;
  }
};


const getStatusClass = (
  status:
    MeetingRoomBooking["booking_status"]
) => {
  switch (status) {
    case "BOOKED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";

    case "CANCELLED":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
};


const isBlockingStatus = (
  status:
    MeetingRoomBooking["booking_status"]
) =>
  status === "BOOKED" ||
  status === "PENDING_APPROVAL";


const MarketingMeetingRoomPage:
  React.FC = () => {
    const { profile } =
      useAuth();

    const today =
      toDateKey(
        new Date()
      );


    const [
      bookings,
      setBookings,
    ] =
      useState<
        MeetingRoomBooking[]
      >([]);


    const [
      loading,
      setLoading,
    ] =
      useState(true);


    const [
      saving,
      setSaving,
    ] =
      useState(false);


    const [
      actionBusy,
      setActionBusy,
    ] =
      useState<
        string | null
      >(null);


    const [
      roomCode,
      setRoomCode,
    ] =
      useState<MeetingRoomCode>(
        "MARKETING_MEETING_ROOM"
      );


    const [
      meetingTitle,
      setMeetingTitle,
    ] =
      useState("");


    const [
      bookingDate,
      setBookingDate,
    ] =
      useState(today);


    const [
      startTime,
      setStartTime,
    ] =
      useState("09:00");


    const [
      endTime,
      setEndTime,
    ] =
      useState("10:00");


    const [
      scheduleDate,
      setScheduleDate,
    ] =
      useState(today);


    const [
      message,
      setMessage,
    ] =
      useState<{
        type:
          | "success"
          | "error";

        text: string;
      } | null>(null);


    const refresh =
      async (
        options?: {
          silent?: boolean;
        }
      ) => {
        const silent =
          Boolean(
            options?.silent
          );

        if (!silent) {
          setLoading(true);
        }

        try {
          const fromDate =
            toDateKey(
              addDays(
                new Date(),
                -7
              )
            );

          const toDate =
            toDateKey(
              addDays(
                new Date(),
                365
              )
            );

          const rows =
            await getMeetingRoomBookings(
              fromDate,
              toDate
            );

          setBookings(
            rows
          );
        } catch (
          error
        ) {
          console.error(
            error
          );

          setMessage({
            type: "error",

            text:
              error instanceof
              Error
                ? error.message
                : "Gagal membaca jadwal ruangan.",
          });
        } finally {
          if (!silent) {
            setLoading(
              false
            );
          }
        }
      };


    useEffect(() => {
      void refresh();

      const intervalId =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              void refresh({
                silent: true,
              });
            }
          },
          10_000
        );

      const handleFocus =
        () => {
          void refresh({
            silent: true,
          });
        };

      const handleVisibility =
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void refresh({
              silent: true,
            });
          }
        };

      window.addEventListener(
        "focus",
        handleFocus
      );

      document.addEventListener(
        "visibilitychange",
        handleVisibility
      );

      return () => {
        window.clearInterval(
          intervalId
        );

        window.removeEventListener(
          "focus",
          handleFocus
        );

        document.removeEventListener(
          "visibilitychange",
          handleVisibility
        );
      };

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      profile?.id,
    ]);


    const selectedDayBookings =
      useMemo(
        () =>
          bookings
            .filter(
              (
                item
              ) =>
                item.booking_date ===
                scheduleDate
            )
            .sort(
              (
                a,
                b
              ) =>
                a.start_time.localeCompare(
                  b.start_time
                )
            ),
        [
          bookings,
          scheduleDate,
        ]
      );


    const upcomingBookings =
      useMemo(
        () =>
          bookings
            .filter(
              (
                item
              ) =>
                item.booking_date >=
                today
            )
            .sort(
              (
                a,
                b
              ) => {
                const dateCompare =
                  a.booking_date.localeCompare(
                    b.booking_date
                  );

                if (
                  dateCompare !==
                  0
                ) {
                  return dateCompare;
                }

                return a.start_time.localeCompare(
                  b.start_time
                );
              }
            ),
        [
          bookings,
          today,
        ]
      );


    const conflict =
      useMemo(() => {
        if (
          !bookingDate ||
          !startTime ||
          !endTime
        ) {
          return null;
        }

        const start =
          normalizeTime(
            startTime
          );

        const end =
          normalizeTime(
            endTime
          );

        return (
          bookings.find(
            (
              item
            ) =>
              item.room_code ===
                roomCode &&

              item.booking_date ===
                bookingDate &&

              isBlockingStatus(
                item.booking_status
              ) &&

              item.start_time <
                end &&

              item.end_time >
                start
          ) || null
        );
      }, [
        bookingDate,
        bookings,
        endTime,
        roomCode,
        startTime,
      ]);


    const canSubmit =
      Boolean(
        meetingTitle
          .trim()
          .length >= 3 &&

          bookingDate &&

          startTime &&

          endTime &&

          endTime >
            startTime &&

          !conflict
      );


    const handleSubmit =
      async (
        event:
          React.FormEvent
      ) => {
        event.preventDefault();

        setMessage(
          null
        );

        if (
          !canSubmit
        ) {
          if (
            conflict
          ) {
            setMessage({
              type:
                "error",

              text:
                `Slot ${getRoomName(
                  roomCode
                )} bentrok dengan ${conflict.requester_name} — ${conflict.meeting_title}, pukul ${formatTime(
                  conflict.start_time
                )}-${formatTime(
                  conflict.end_time
                )}.`,
            });
          }

          return;
        }


        setSaving(true);

        try {
          await createMeetingRoomBooking(
            meetingTitle,
            bookingDate,
            startTime,
            endTime,
            roomCode
          );


          if (
            roomCode ===
            "DIRPEM_WORK_ROOM"
          ) {
            setMessage({
              type:
                "success",

              text:
                "Pengajuan booking Ruang Kerja DirPem berhasil. Slot ditahan sementara dan menunggu approval Arianie.",
            });
          } else {
            setMessage({
              type:
                "success",

              text:
                "Booking Ruang Meeting Marketing berhasil. Slot langsung terkunci.",
            });
          }


          setMeetingTitle(
            ""
          );

          setScheduleDate(
            bookingDate
          );

          await refresh();
        } catch (
          error: any
        ) {
          console.error(
            error
          );

          setMessage({
            type:
              "error",

            text:
              error?.message ||
              "Booking gagal.",
          });

          await refresh();
        } finally {
          setSaving(
            false
          );
        }
      };


    const handleCancel =
      async (
        item:
          MeetingRoomBooking
      ) => {
        const confirmed =
          window.confirm(
            `Batalkan booking "${item.meeting_title}" di ${item.room_name}?`
          );

        if (
          !confirmed
        ) {
          return;
        }


        setActionBusy(
          item.id
        );

        setMessage(
          null
        );


        try {
          await cancelMeetingRoomBooking(
            item.id
          );

          setMessage({
            type:
              "success",

            text:
              `Booking "${item.meeting_title}" berhasil dibatalkan.`,
          });

          await refresh();
        } catch (
          error: any
        ) {
          console.error(
            error
          );

          setMessage({
            type:
              "error",

            text:
              error?.message ||
              "Gagal membatalkan booking.",
          });
        } finally {
          setActionBusy(
            null
          );
        }
      };


    const handleApprove =
      async (
        item:
          MeetingRoomBooking
      ) => {
        const confirmed =
          window.confirm(
            `Setujui booking "${item.meeting_title}" untuk Ruang Kerja DirPem?`
          );

        if (
          !confirmed
        ) {
          return;
        }


        setActionBusy(
          item.id
        );

        setMessage(
          null
        );


        try {
          await reviewDirpemRoomBooking(
            item.id,
            "APPROVE"
          );

          setMessage({
            type:
              "success",

            text:
              `Booking "${item.meeting_title}" telah disetujui.`,
          });

          await refresh();
        } catch (
          error: any
        ) {
          console.error(
            error
          );

          setMessage({
            type:
              "error",

            text:
              error?.message ||
              "Approval booking gagal.",
          });
        } finally {
          setActionBusy(
            null
          );
        }
      };


    const handleReject =
      async (
        item:
          MeetingRoomBooking
      ) => {
        const notes =
          window.prompt(
            `Alasan penolakan booking "${item.meeting_title}":`
          );

        if (
          notes === null
        ) {
          return;
        }


        if (
          notes.trim().length <
          3
        ) {
          setMessage({
            type:
              "error",

            text:
              "Alasan penolakan minimal 3 karakter.",
          });

          return;
        }


        setActionBusy(
          item.id
        );

        setMessage(
          null
        );


        try {
          await reviewDirpemRoomBooking(
            item.id,
            "REJECT",
            notes
          );

          setMessage({
            type:
              "success",

            text:
              `Booking "${item.meeting_title}" telah ditolak.`,
          });

          await refresh();
        } catch (
          error: any
        ) {
          console.error(
            error
          );

          setMessage({
            type:
              "error",

            text:
              error?.message ||
              "Penolakan booking gagal.",
          });
        } finally {
          setActionBusy(
            null
          );
        }
      };


    return (
      <AppLayout>
        <div className="space-y-6">


          {/* HEADER */}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Booking Ruangan Meeting
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Ruang Meeting Marketing langsung booked. Ruang Kerja DirPem membutuhkan approval Arianie.
              </p>
            </div>


            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void refresh()
              }
              disabled={
                loading
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

          </div>


          {/* MESSAGE */}

          {message && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                message.type ===
                "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}


          <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">


            {/* BOOKING FORM */}

            <Card>

              <CardHeader>

                <CardTitle className="flex items-center gap-2 text-base">
                  <DoorOpen className="h-5 w-5" />
                  Booking Baru
                </CardTitle>

                <p className="text-xs text-slate-500">
                  Pilih ruangan yang akan digunakan.
                </p>

              </CardHeader>


              <CardContent>

                <form
                  className="space-y-4"
                  onSubmit={
                    handleSubmit
                  }
                >


                  {/* ROOM */}

                  <div>

                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Ruangan *
                    </label>

                    <select
                      value={
                        roomCode
                      }
                      onChange={(
                        event
                      ) =>
                        setRoomCode(
                          event.target
                            .value as MeetingRoomCode
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >

                      <option value="MARKETING_MEETING_ROOM">
                        Ruang Meeting Marketing
                      </option>

                      <option value="DIRPEM_WORK_ROOM">
                        Ruang Kerja DirPem
                      </option>

                    </select>

                  </div>


                  {/* ROOM FLOW INFO */}

                  {roomCode ===
                  "MARKETING_MEETING_ROOM" ? (

                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">

                      <div className="font-bold">
                        Ruang Meeting Marketing
                      </div>

                      <div className="mt-1">
                        First action wins. Jika slot tersedia, booking langsung berstatus Booked tanpa approval.
                      </div>

                    </div>

                  ) : (

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">

                      <div className="font-bold">
                        Ruang Kerja DirPem
                      </div>

                      <div className="mt-1">
                        Booking akan berstatus Menunggu Approval dan Arianie akan menerima notifikasi untuk Approve atau Reject.
                      </div>

                    </div>

                  )}


                  {/* TITLE */}

                  <div>

                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Meeting Apa *
                    </label>

                    <Input
                      value={
                        meetingTitle
                      }
                      onChange={(
                        event
                      ) =>
                        setMeetingTitle(
                          event.target
                            .value
                        )
                      }
                      maxLength={
                        200
                      }
                      placeholder="Contoh: Weekly Marketing Meeting"
                    />

                  </div>


                  {/* DATE */}

                  <div>

                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Tanggal *
                    </label>

                    <Input
                      type="date"
                      min={
                        today
                      }
                      value={
                        bookingDate
                      }
                      onChange={(
                        event
                      ) => {

                        setBookingDate(
                          event.target
                            .value
                        );

                        setScheduleDate(
                          event.target
                            .value
                        );

                      }}
                    />

                  </div>


                  {/* TIME */}

                  <div className="grid gap-3 sm:grid-cols-2">

                    <div>

                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        Jam Mulai *
                      </label>

                      <Input
                        type="time"
                        value={
                          startTime
                        }
                        onChange={(
                          event
                        ) =>
                          setStartTime(
                            event.target
                              .value
                          )
                        }
                      />

                    </div>


                    <div>

                      <label className="mb-1.5 block text-xs font-bold text-slate-700">
                        Jam Berakhir *
                      </label>

                      <Input
                        type="time"
                        value={
                          endTime
                        }
                        onChange={(
                          event
                        ) =>
                          setEndTime(
                            event.target
                              .value
                          )
                        }
                      />

                    </div>

                  </div>


                  {/* INVALID TIME */}

                  {endTime &&
                    startTime &&
                    endTime <=
                      startTime && (

                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">

                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

                        Jam berakhir harus setelah jam mulai.

                      </div>

                    )}


                  {/* CONFLICT */}

                  {conflict && (

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">

                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">

                        <AlertTriangle className="h-4 w-4" />

                        Slot Sudah Terpakai

                      </div>


                      <div className="mt-2 text-xs font-semibold text-slate-700">
                        {conflict.room_name}
                      </div>


                      <div className="mt-1 text-sm font-bold text-slate-900">

                        {
                          conflict.meeting_title
                        }

                      </div>


                      <div className="mt-1 text-xs text-slate-600">

                        {
                          conflict.requester_name
                        }

                        {" • "}

                        {formatTime(
                          conflict.start_time
                        )}

                        -

                        {formatTime(
                          conflict.end_time
                        )}

                      </div>


                      <div className="mt-2 text-[11px] text-amber-700">
                        Pilih jam lain untuk ruangan ini.
                      </div>

                    </div>

                  )}


                  {/* AVAILABLE */}

                  {!conflict &&
                    bookingDate &&
                    startTime &&
                    endTime >
                      startTime && (

                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">

                        <CheckCircle2 className="h-4 w-4" />

                        Slot {getRoomName(
                          roomCode
                        )} terlihat tersedia.

                      </div>

                    )}


                  {/* SUBMIT */}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      saving ||
                      !canSubmit
                    }
                  >

                    {saving
                      ? "Menyimpan..."
                      : roomCode ===
                        "DIRPEM_WORK_ROOM"
                      ? "Ajukan Booking"
                      : "Booking Ruangan"}

                  </Button>


                  <div className="text-[10px] leading-relaxed text-slate-500">

                    Sistem melakukan pengecekan bentrok per ruangan langsung di database.

                    {roomCode ===
                    "DIRPEM_WORK_ROOM"
                      ? " Slot yang sedang menunggu approval juga ditahan sementara agar tidak diajukan user lain."
                      : " Jika dua user booking bersamaan, transaksi yang masuk lebih dulu akan menang."}

                  </div>


                </form>

              </CardContent>

            </Card>


            {/* DAILY SCHEDULE */}

            <Card>

              <CardHeader>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

                  <div>

                    <CardTitle className="flex items-center gap-2 text-base">

                      <CalendarDays className="h-5 w-5" />

                      Jadwal Ruangan

                    </CardTitle>

                    <p className="mt-1 text-xs text-slate-500">
                      Jadwal Ruang Meeting Marketing dan Ruang Kerja DirPem.
                    </p>

                  </div>


                  <div className="w-full sm:w-48">

                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                      Lihat Tanggal
                    </label>

                    <Input
                      type="date"
                      value={
                        scheduleDate
                      }
                      onChange={(
                        event
                      ) =>
                        setScheduleDate(
                          event.target
                            .value
                        )
                      }
                    />

                  </div>

                </div>

              </CardHeader>


              <CardContent>


                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">

                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Jadwal
                  </div>

                  <div className="mt-1 text-sm font-bold text-slate-900">

                    {formatDate(
                      scheduleDate
                    )}

                  </div>

                </div>


                {loading ? (

                  <div className="py-12 text-center text-sm text-slate-500">
                    Memuat jadwal...
                  </div>

                ) : selectedDayBookings.length ===
                  0 ? (

                  <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">

                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />

                    <div className="mt-3 text-sm font-bold text-slate-900">
                      Belum ada booking
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      Kedua ruangan masih kosong pada tanggal ini.
                    </div>

                  </div>

                ) : (

                  <div className="space-y-3">

                    {selectedDayBookings.map(
                      (
                        item
                      ) => (

                        <div
                          key={
                            item.id
                          }
                          className={`rounded-xl border p-4 ${
                            item.booking_status ===
                              "CANCELLED" ||
                            item.booking_status ===
                              "REJECTED"
                              ? "border-slate-200 bg-slate-50 opacity-70"
                              : "border-slate-200 bg-white"
                          }`}
                        >


                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">


                            <div className="min-w-0">


                              <div className="flex flex-wrap items-center gap-2">

                                <div className="text-sm font-bold text-slate-900">

                                  {
                                    item.meeting_title
                                  }

                                </div>


                                <span
                                  className={`rounded-full border px-2 py-1 text-[9px] font-bold ${getStatusClass(
                                    item.booking_status
                                  )}`}
                                >

                                  {getStatusLabel(
                                    item.booking_status
                                  )}

                                </span>

                              </div>


                              <div className="mt-2 text-xs font-bold text-blue-700">

                                {item.room_name}

                              </div>


                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">


                                <span className="inline-flex items-center gap-1.5">

                                  <Clock3 className="h-3.5 w-3.5 text-slate-400" />

                                  {formatTime(
                                    item.start_time
                                  )}

                                  -

                                  {formatTime(
                                    item.end_time
                                  )}

                                </span>


                                <span className="inline-flex items-center gap-1.5">

                                  <UserRound className="h-3.5 w-3.5 text-slate-400" />

                                  {
                                    item.requester_name
                                  }

                                </span>


                              </div>


                              <div className="mt-2 text-[10px] text-slate-500">

                                {
                                  item.requester_role
                                }

                                {" • "}

                                {item.requester_department ||
                                  item.requester_unit}

                              </div>


                              {item.booking_status ===
                                "PENDING_APPROVAL" &&
                                item.approver_name && (

                                  <div className="mt-2 text-[10px] font-semibold text-amber-700">

                                    Menunggu approval:{" "}
                                    {
                                      item.approver_name
                                    }

                                  </div>

                                )}


                              {item.booking_status ===
                                "REJECTED" &&
                                item.approval_notes && (

                                  <div className="mt-2 text-[10px] text-red-600">

                                    Catatan:{" "}
                                    {
                                      item.approval_notes
                                    }

                                  </div>

                                )}


                            </div>


                            <div className="flex shrink-0 flex-wrap gap-2">


                              {item.can_approve && (

                                <>

                                  <Button
                                    size="sm"
                                    onClick={() =>
                                      void handleApprove(
                                        item
                                      )
                                    }
                                    disabled={
                                      actionBusy ===
                                      item.id
                                    }
                                  >

                                    <CheckCircle2 className="mr-1 h-4 w-4" />

                                    Approve

                                  </Button>


                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                      void handleReject(
                                        item
                                      )
                                    }
                                    disabled={
                                      actionBusy ===
                                      item.id
                                    }
                                  >

                                    <XCircle className="mr-1 h-4 w-4" />

                                    Reject

                                  </Button>

                                </>

                              )}


                              {item.can_cancel && (

                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void handleCancel(
                                      item
                                    )
                                  }
                                  disabled={
                                    actionBusy ===
                                    item.id
                                  }
                                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                >

                                  Cancel

                                </Button>

                              )}


                            </div>


                          </div>


                        </div>

                      )
                    )}


                  </div>

                )}


              </CardContent>

            </Card>


          </div>


          {/* UPCOMING TABLE */}

          <Card>

            <CardHeader>

              <CardTitle className="text-sm">
                Booking Mendatang
              </CardTitle>

              <p className="text-xs text-slate-500">
                Seluruh booking kedua ruangan beserta status dan action yang tersedia.
              </p>

            </CardHeader>


            <CardContent>

              <div className="overflow-x-auto rounded-xl border border-slate-200">

                <table className="w-full min-w-[1100px] text-left text-xs">


                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">

                    <tr>

                      <th className="p-3">
                        Tanggal
                      </th>

                      <th className="p-3">
                        Ruangan
                      </th>

                      <th className="p-3">
                        Waktu
                      </th>

                      <th className="p-3">
                        Meeting
                      </th>

                      <th className="p-3">
                        Dipakai Oleh
                      </th>

                      <th className="p-3">
                        Status
                      </th>

                      <th className="p-3">
                        Aksi
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100">


                    {upcomingBookings.length ===
                    0 ? (

                      <tr>

                        <td
                          colSpan={
                            7
                          }
                          className="p-8 text-center text-slate-500"
                        >

                          Belum ada booking mendatang.

                        </td>

                      </tr>

                    ) : (

                      upcomingBookings.map(
                        (
                          item
                        ) => (

                          <tr
                            key={
                              item.id
                            }
                            className={`hover:bg-slate-50/60 ${
                              item.booking_status ===
                                "CANCELLED" ||
                              item.booking_status ===
                                "REJECTED"
                                ? "opacity-60"
                                : ""
                            }`}
                          >


                            <td className="p-3 font-semibold text-slate-800">

                              {formatDate(
                                item.booking_date
                              )}

                            </td>


                            <td className="p-3 font-semibold text-blue-700">

                              {
                                item.room_name
                              }

                            </td>


                            <td className="p-3">

                              {formatTime(
                                item.start_time
                              )}

                              {" - "}

                              {formatTime(
                                item.end_time
                              )}

                            </td>


                            <td className="p-3 font-bold text-slate-900">

                              {
                                item.meeting_title
                              }

                            </td>


                            <td className="p-3">

                              <div className="font-semibold text-slate-800">

                                {
                                  item.requester_name
                                }

                              </div>

                              <div className="mt-1 text-[10px] text-slate-500">

                                {item.requester_department ||
                                  item.requester_unit}

                              </div>

                            </td>


                            <td className="p-3">

                              <span
                                className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold ${getStatusClass(
                                  item.booking_status
                                )}`}
                              >

                                {getStatusLabel(
                                  item.booking_status
                                )}

                              </span>

                            </td>


                            <td className="p-3">

                              <div className="flex flex-wrap gap-2">


                                {item.can_approve && (

                                  <>

                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        void handleApprove(
                                          item
                                        )
                                      }
                                      disabled={
                                        actionBusy ===
                                        item.id
                                      }
                                    >

                                      Approve

                                    </Button>


                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        void handleReject(
                                          item
                                        )
                                      }
                                      disabled={
                                        actionBusy ===
                                        item.id
                                      }
                                    >

                                      Reject

                                    </Button>

                                  </>

                                )}


                                {item.can_cancel && (

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      void handleCancel(
                                        item
                                      )
                                    }
                                    disabled={
                                      actionBusy ===
                                      item.id
                                    }
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  >

                                    Cancel

                                  </Button>

                                )}


                                {!item.can_approve &&
                                  !item.can_cancel && (

                                    <span className="text-[10px] text-slate-400">
                                      -
                                    </span>

                                  )}


                              </div>

                            </td>


                          </tr>

                        )
                      )

                    )}


                  </tbody>


                </table>


              </div>

            </CardContent>

          </Card>


        </div>
      </AppLayout>
    );
  };


export default MarketingMeetingRoomPage;