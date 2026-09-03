import { supabase } from "@/lib/supabase";

export type MeetingRoomCode =
  | "MARKETING_MEETING_ROOM"
  | "DIRPEM_WORK_ROOM";

export type MeetingRoomBookingStatus =
  | "PENDING_APPROVAL"
  | "BOOKED"
  | "REJECTED"
  | "CANCELLED";

export type MeetingRoomBooking = {
  id: string;
  room_code: MeetingRoomCode;
  room_name: string;
  meeting_title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  booking_status: MeetingRoomBookingStatus;

  requester_profile_id: string;
  requester_name: string;
  requester_role: string;
  requester_unit: string;
  requester_department: string | null;

  approver_profile_id: string | null;
  approver_name: string | null;

  approval_decision_at: string | null;
  approval_notes: string | null;

  cancelled_at: string | null;
  cancellation_reason: string | null;

  can_cancel: boolean;
  can_approve: boolean;

  created_at: string;
};

export async function getMeetingRoomBookings(
  fromDate: string,
  toDate: string
) {
  const { data, error } =
    await supabase.rpc(
      "list_meeting_room_bookings_v2",
      {
        p_from_date: fromDate,
        p_to_date: toDate,
      }
    );

  if (error) {
    throw error;
  }

  return (
    (data || []) as MeetingRoomBooking[]
  );
}

export async function createMeetingRoomBooking(
  meetingTitle: string,
  bookingDate: string,
  startTime: string,
  endTime: string,
  roomCode: MeetingRoomCode =
    "MARKETING_MEETING_ROOM"
) {
  const { data, error } =
    await supabase.rpc(
      "create_meeting_room_booking_v2",
      {
        p_room_code: roomCode,
        p_meeting_title: meetingTitle,
        p_booking_date: bookingDate,
        p_start_time: startTime,
        p_end_time: endTime,
      }
    );

  if (error) {
    throw error;
  }

  return data as string;
}

export async function cancelMeetingRoomBooking(
  bookingId: string,
  reason?: string
) {
  const { data, error } =
    await supabase.rpc(
      "cancel_meeting_room_booking_v2",
      {
        p_booking_id: bookingId,
        p_reason:
          reason?.trim() || null,
      }
    );

  if (error) {
    throw error;
  }

  return data as Record<
    string,
    unknown
  >;
}

export async function reviewDirpemRoomBooking(
  bookingId: string,
  decision:
    | "APPROVE"
    | "REJECT",
  notes?: string
) {
  const { data, error } =
    await supabase.rpc(
      "review_dirpem_room_booking_v2",
      {
        p_booking_id: bookingId,
        p_decision: decision,
        p_notes:
          notes?.trim() || null,
      }
    );

  if (error) {
    throw error;
  }

  return data as Record<
    string,
    unknown
  >;
}