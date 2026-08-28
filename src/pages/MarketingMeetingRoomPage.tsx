import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  MeetingRoomBooking,
  createMeetingRoomBooking,
  getMeetingRoomBookings,
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
      async () => {
        setLoading(true);

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
          setLoading(
            false
          );
        }
      };

    useEffect(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      profile?.id,
    ]);

    const selectedDayBookings =
      useMemo(
        () =>
          bookings.filter(
            (
              item
            ) =>
              item.booking_date ===
              scheduleDate
          ),
        [
          bookings,
          scheduleDate,
        ]
      );

    const upcomingBookings =
      useMemo(
        () =>
          bookings.filter(
            (
              item
            ) =>
              item.booking_date >=
              today
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
              item.booking_date ===
                bookingDate &&
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
        event: React.FormEvent
      ) => {
        event.preventDefault();

        setMessage(
          null
        );

        if (
          !canSubmit
        ) {
          if (conflict) {
            setMessage({
              type:
                "error",
              text:
                `Slot bentrok dengan ${conflict.requester_name} — ${conflict.meeting_title}, pukul ${formatTime(
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
            endTime
          );

          setMessage({
            type:
              "success",
            text:
              "Booking berhasil. Slot langsung terkunci tanpa approval.",
          });

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
            type: "error",
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

    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Booking Ruangan Meeting Marketing
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                First action wins. Booking langsung aktif tanpa approval.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={
                loading
              }
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <DoorOpen className="h-5 w-5" />
                  Booking Baru
                </CardTitle>

                <p className="text-xs text-slate-500">
                  Ruangan: Ruang Meeting Marketing
                </p>
              </CardHeader>

              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={
                    handleSubmit
                  }
                >
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
                          event
                            .target
                            .value
                        )
                      }
                      maxLength={
                        200
                      }
                      placeholder="Contoh: Weekly Marketing Meeting"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-700">
                      Tanggal *
                    </label>

                    <Input
                      type="date"
                      min={today}
                      value={
                        bookingDate
                      }
                      onChange={(
                        event
                      ) => {
                        setBookingDate(
                          event
                            .target
                            .value
                        );

                        setScheduleDate(
                          event
                            .target
                            .value
                        );
                      }}
                    />
                  </div>

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
                            event
                              .target
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
                            event
                              .target
                              .value
                          )
                        }
                      />
                    </div>
                  </div>

                  {endTime &&
                    startTime &&
                    endTime <=
                      startTime && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Jam berakhir harus setelah jam mulai.
                      </div>
                    )}

                  {conflict && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <AlertTriangle className="h-4 w-4" />
                        Slot Sudah Terpakai
                      </div>

                      <div className="mt-2 text-sm font-bold text-slate-900">
                        {
                          conflict.meeting_title
                        }
                      </div>

                      <div className="mt-1 text-xs text-slate-600">
                        {
                          conflict.requester_name
                        }{" "}
                        •{" "}
                        {formatTime(
                          conflict.start_time
                        )}
                        -
                        {formatTime(
                          conflict.end_time
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-amber-700">
                        Pilih jam lain untuk melanjutkan.
                      </div>
                    </div>
                  )}

                  {!conflict &&
                    bookingDate &&
                    startTime &&
                    endTime >
                      startTime && (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Slot terlihat tersedia.
                      </div>
                    )}

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
                      : "Booking Ruangan"}
                  </Button>

                  <div className="text-[10px] leading-relaxed text-slate-500">
                    Sistem tetap mengecek konflik di database saat tombol diklik.
                    Kalau dua user booking bersamaan, transaksi yang masuk lebih dulu
                    akan menang.
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-5 w-5" />
                      Jadwal Ruangan
                    </CardTitle>

                    <p className="mt-1 text-xs text-slate-500">
                      Lihat siapa yang memakai ruangan, untuk meeting apa, dan kapan.
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
                          event
                            .target
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
                      Ruangan masih kosong pada tanggal ini.
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
                          className="rounded-xl border border-slate-200 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-slate-900">
                                {
                                  item.meeting_title
                                }
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
                                }{" "}
                                •{" "}
                                {item.requester_department ||
                                  item.requester_unit}
                              </div>
                            </div>

                            <div className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-center">
                              <div className="text-[9px] font-bold uppercase text-blue-500">
                                Waktu
                              </div>

                              <div className="mt-0.5 text-xs font-black text-blue-700">
                                {formatTime(
                                  item.start_time
                                )}
                              </div>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Booking Mendatang
              </CardTitle>

              <p className="text-xs text-slate-500">
                Seluruh booking aktif yang dapat dilihat user Marketing.
              </p>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="p-3">
                        Tanggal
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
                        Unit
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {upcomingBookings.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={
                            5
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
                            className="hover:bg-slate-50/60"
                          >
                            <td className="p-3 font-semibold text-slate-800">
                              {formatDate(
                                item.booking_date
                              )}
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
                              {
                                item.requester_name
                              }
                            </td>

                            <td className="p-3 text-slate-600">
                              {item.requester_department ||
                                item.requester_unit}
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
