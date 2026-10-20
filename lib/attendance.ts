import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { lookupEventByCode } from './events';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'excused',
];

export type AttendanceRecord = {
  id: string;
  eventId: string; // event code
  eventTitle: string;
  venue: string | null;
  status: AttendanceStatus;
  scannedAt: string;
};

export type RegisterCode =
  | 'ok'
  | 'invalid_qr'
  | 'not_found'
  | 'closed'
  | 'not_started'
  | 'ended'
  | 'duplicate'
  | 'unauthorized'
  | 'error';

export type RegisterResult = {
  success: boolean;
  code: RegisterCode;
  message: string;
  eventTitle?: string;
  scannedAt?: string;
};

export type AttendeeRow = {
  attendanceId: string;
  studentId: string;
  studentName: string | null;
  idNumber: string | null;
  status: AttendanceStatus;
  scannedAt: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string | null;
    status: AttendanceStatus;
    scannedAt: string;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type AdminAttendanceRow = {
  attendanceId: string;
  studentId: string;
  studentName: string | null;
  eventId: string;
  eventTitle: string;
  eventCode: string;
  status: AttendanceStatus;
  scannedAt: string;
};

// ---------------------------------------------------------------------
// STUDENT: record attendance from a scanned QR.
// Validation chain (each failure = one handled event):
//   invalid QR -> unknown event -> closed -> not started -> ended
//   -> duplicate -> unauthorized (blocked by RLS)
// ---------------------------------------------------------------------
export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, code: 'invalid_qr', message: parsed.message };
  }

  // Always trust the DATABASE, never the data inside the QR.
  const { event, failed } = await lookupEventByCode(parsed.payload.event);
  if (failed) {
    return {
      success: false,
      code: 'error',
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }
  if (!event) {
    return {
      success: false,
      code: 'not_found',
      message: 'This QR code does not match any event.',
    };
  }

  if (event.status === 'closed') {
    return {
      success: false,
      code: 'closed',
      message: 'This event is closed. Attendance can no longer be recorded.',
      eventTitle: event.title,
    };
  }

  const now = Date.now();
  if (event.start_time && now < new Date(event.start_time).getTime()) {
    return {
      success: false,
      code: 'not_started',
      message: 'This event has not started yet.',
      eventTitle: event.title,
    };
  }
  if (event.end_time && now > new Date(event.end_time).getTime()) {
    return {
      success: false,
      code: 'ended',
      message: 'This event has already ended.',
      eventTitle: event.title,
    };
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert([{ student_id: studentId, event_id: event.id }])
    .select('scanned_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        code: 'duplicate',
        message: 'You already recorded attendance for this event.',
        eventTitle: event.title,
      };
    }
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      return {
        success: false,
        code: 'unauthorized',
        message:
          'You are not allowed to record attendance for this event (students only, while the event is open).',
        eventTitle: event.title,
      };
    }
    return {
      success: false,
      code: 'error',
      message: error.message,
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    code: 'ok',
    message: 'Attendance recorded!',
    eventTitle: event.title,
    scannedAt: (data as any)?.scanned_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------
// STUDENT: own history
// ---------------------------------------------------------------------
export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, status, scanned_at, events ( event_code, title, venue )')
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    venue: row.events?.venue ?? null,
    status: (row.status ?? 'present') as AttendanceStatus,
    scannedAt: row.scanned_at,
  }));
}

// ---------------------------------------------------------------------
// Helper: fetch names for a list of student ids
// (attendance.student_id references auth.users, so a nested profiles
//  embed is not possible -> separate query, allowed by RLS policies.)
// ---------------------------------------------------------------------
async function getProfileNames(
  ids: string[]
): Promise<Record<string, { name: string | null; idNumber: string | null }>> {
  const map: Record<string, { name: string | null; idNumber: string | null }> =
    {};
  const unique = [...new Set(ids)];
  if (unique.length === 0) return map;
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, id_number')
    .in('id', unique);
  ((data as any[] | null) ?? []).forEach((p) => {
    map[p.id] = { name: p.full_name ?? null, idNumber: p.id_number ?? null };
  });
  return map;
}

// TEACHER / ADMIN: attendance of ONE event ------------------------------
export async function getEventAttendance(eventId: string): Promise<AttendeeRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, student_id, status, scanned_at')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: true });
  if (error || !data) return [];

  const names = await getProfileNames((data as any[]).map((r) => r.student_id));
  return (data as any[]).map((r) => ({
    attendanceId: r.id,
    studentId: r.student_id,
    studentName: names[r.student_id]?.name ?? null,
    idNumber: names[r.student_id]?.idNumber ?? null,
    status: (r.status ?? 'present') as AttendanceStatus,
    scannedAt: r.scanned_at,
  }));
}

// TEACHER: all of my events with attendee lists ----------------------------
export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const eventIds = events.map((e: any) => e.id);
  if (eventIds.length === 0) return [];

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id, status')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  const rowsAll = (!attError && attendance ? attendance : []) as any[];
  const names = await getProfileNames(rowsAll.map((a) => a.student_id));

  return events.map((e: any) => {
    const rows = rowsAll.filter((a) => a.event_id === e.id);
    return {
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      attendeeCount: rows.length,
      attendees: rows.map((a) => ({
        studentId: a.student_id,
        studentName: names[a.student_id]?.name ?? null,
        status: (a.status ?? 'present') as AttendanceStatus,
        scannedAt: a.scanned_at,
      })),
    };
  });
}

/** attendee counts per event id (count-only query) */
export async function getAttendanceCounts(
  eventIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (eventIds.length === 0) return counts;
  const { data, error } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);
  if (error || !data) return counts;
  (data as any[]).forEach((r) => {
    counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  });
  return counts;
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });
  if (error || !events) return [];
  const counts = await getAttendanceCounts((events as any[]).map((e) => e.id));
  return (events as any[]).map((e) => ({
    eventId: e.id,
    eventCode: e.event_code,
    title: e.title,
    attendeeCount: counts[e.id] ?? 0,
  }));
}

// ADMIN: system-wide attendance + corrections ------------------------------
export async function getAllAttendance(limit = 200): Promise<AdminAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, student_id, status, scanned_at, events ( id, event_code, title )')
    .order('scanned_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const names = await getProfileNames((data as any[]).map((r) => r.student_id));
  return (data as any[]).map((r) => ({
    attendanceId: r.id,
    studentId: r.student_id,
    studentName: names[r.student_id]?.name ?? null,
    eventId: r.events?.id ?? '',
    eventTitle: r.events?.title ?? '(deleted event)',
    eventCode: r.events?.event_code ?? '',
    status: (r.status ?? 'present') as AttendanceStatus,
    scannedAt: r.scanned_at,
  }));
}

export async function updateAttendanceStatus(
  attendanceId: string,
  status: AttendanceStatus
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('attendance')
    .update({ status })
    .eq('id', attendanceId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Only an administrator can correct attendance records.' };
  }
  return { error: null };
}

export async function deleteAttendance(
  attendanceId: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Only an administrator can delete attendance records.' };
  }
  return { error: null };
}
