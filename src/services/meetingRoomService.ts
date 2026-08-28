import { supabase } from "@/lib/supabase";

export type MeetingRoomBooking = {
  id: string;
  meeting_title: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  requester_profile_id: string;
  requester_name: string;
  requester_role: string;
  requester_unit: string;
  requester_department: string | null;
  created_at: string;
};

export async function getMeetingRoomBookings(
  fromDate: string,
  toDate: string
) {
  const { data, error } =
    await supabase.rpc(
      "list_marketing_meeting_room_bookings",
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
  endTime: string
) {
  const { data, error } =
    await supabase.rpc(
      "create_marketing_meeting_room_booking",
      {
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
