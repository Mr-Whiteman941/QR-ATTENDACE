import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';
import { getStatus, summarize, type AttendanceStatus } from './attendancestatus';

/** Scanning within this many minutes of the start counts as Present; after, Late. */
export const GRACE_MINUTES = 10;

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
  status?: AttendanceStatus;
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
    studentName: string;
    scannedAt: string;
    status: AttendanceStatus;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

/** Present or Late, based on the event's start time (no start time = Present). */
function statusFor(start: string | null | undefined, scannedAt: string): AttendanceStatus {
  if (!start) return 'present';
  const s = new Date(start);
  const a = new Date(scannedAt);
  if (isNaN(s.getTime()) || isNaN(a.getTime())) return 'present';
  // A scanned student is never "absent": anything past the grace period is Late.
  return getStatus(s, a, GRACE_MINUTES, Infinity);
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId);

  if (eventsError || !events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => event.id);

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id')
    .in('event_id', eventIds);

  if (attendanceError) {
    return [];
  }

  // Look up student names (falls back to the id if profiles aren't readable).
  const studentIds = Array.from(
    new Set((attendance ?? []).map((r) => String(r.student_id)))
  );
  const names: Record<string, string> = {};
  if (studentIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', studentIds);
    (profs ?? []).forEach((p: any) => {
      names[String(p.id)] = p.full_name || p.email || String(p.id);
    });
  }

  return events.map((event) => {
    const attendees = (attendance ?? [])
      .filter((row) => row.event_id === event.id)
      .map((row) => {
        const studentId = String(row.student_id);
        const scannedAt = String(row.scanned_at);
        return {
          studentId,
          studentName: names[studentId] ?? studentId,
          scannedAt,
          status: statusFor(event.start_time, scannedAt),
        };
      });

    return {
      eventId: String(event.id),
      eventCode: String(event.event_code),
      title: String(event.title),
      startTime: event.start_time ?? null,
      endTime: event.end_time ?? null,
      attendeeCount: attendees.length,
      attendees,
    };
  });
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventsError || !events || events.length === 0) {
    return [];
  }

  const eventIds = events.map((event) => event.id);

  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError) {
    return [];
  }

  const counts: Record<string, number> = {};
  (attRows ?? []).forEach((row) => {
    counts[String(row.event_id)] = (counts[String(row.event_id)] ?? 0) + 1;
  });

  return events.map((event) => ({
    eventId: String(event.id),
    eventCode: String(event.event_code),
    title: String(event.title),
    attendeeCount: counts[String(event.id)] ?? 0,
  }));
}

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  // 1. Validate QR payload (also rejects expired rotating QR codes)
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }

  const payload = parsed.payload;

  // 2. Quick time-window check using the QR's own data
  const now = Date.now();
  const qrStart = payload.start ? new Date(payload.start).getTime() : null;
  const qrEnd = payload.end ? new Date(payload.end).getTime() : null;

  if (qrStart && now < qrStart) {
    return { success: false, message: 'Event has not started yet.' };
  }
  if (qrEnd && now > qrEnd) {
    return { success: false, message: 'Event has already ended.' };
  }

  const title = payload.title ?? payload.event;

  // 3. Find event using shared helper
  const foundEvent = await getEventByCode(payload.event);

  let eventId: string;
  let eventTitle: string;
  let authStart: string | null = payload.start ?? null;

  if (foundEvent) {
    eventId = String(foundEvent.id);
    eventTitle = String(foundEvent.title);

    // The saved event is the source of truth, not the QR contents.
    authStart = foundEvent.start_time ?? authStart;
    const dbStart = foundEvent.start_time ? new Date(foundEvent.start_time).getTime() : null;
    const dbEnd = foundEvent.end_time ? new Date(foundEvent.end_time).getTime() : null;

    if (dbStart && now < dbStart) {
      return { success: false, message: 'Event has not started yet.', eventTitle };
    }
    if (dbEnd && now > dbEnd) {
      return { success: false, message: 'Event has already ended.', eventTitle };
    }
  } else {
    const { data: newEvent, error: insertError } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError || !newEvent) {
      return { success: false, message: 'Could not create event.' };
    }

    eventId = String(newEvent.id);
    eventTitle = String(newEvent.title);
  }

  // 4. Record attendance
  const scannedAt = new Date().toISOString();
  const { error: attendanceError } = await supabase.from('attendance').insert([
    { student_id: studentId, event_id: eventId, scanned_at: scannedAt },
  ]);

  // 5. Duplicate protection (unique student + event) and other errors
  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return {
        success: false,
        message: 'You already checked in for this event.',
        eventTitle,
      };
    }
    return { success: false, message: attendanceError.message, eventTitle };
  }

  const status = statusFor(authStart, scannedAt);

  return {
    success: true,
    message:
      status === 'late'
        ? 'Attendance recorded. You were marked Late.'
        : 'Attendance recorded!',
    eventTitle,
    status,
  };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      event_id,
      scanned_at,
      events (
        event_code,
        title,
        start_time
      )
    `)
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: String(row.id),
    eventId: String(row.events?.event_code ?? ''),
    eventTitle: String(row.events?.title ?? ''),
    scannedAt: String(row.scanned_at ?? ''),
    status: statusFor(row.events?.start_time, String(row.scanned_at ?? '')),
  }));
}

/**
 * Student stats. Your database has no class enrollment, so "absent" means
 * "events that exist in the system that the student never scanned".
 */
export async function getStudentStats(studentId: string) {
  const history = await getAttendanceHistory(studentId);
  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true });

  const totalEvents = Math.max(count ?? 0, history.length);
  const counts = summarize(history);
  const absent = totalEvents - history.length;
  const percentage =
    totalEvents === 0 ? 0 : Math.round((history.length / totalEvents) * 100);

  return {
    present: counts.present,
    late: counts.late,
    absent,
    totalEvents,
    percentage,
  };
}

/**
 * Teacher checks a student in by email (dead phone, camera trouble, etc.).
 * Only works for events the teacher created.
 */
export async function manualCheckIn(
  eventCode: string,
  studentEmail: string,
  teacherId: string
): Promise<RegisterResult> {
  const event = await getEventByCode(eventCode);
  if (!event || event.created_by !== teacherId) {
    return { success: false, message: 'Event not found.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('email', studentEmail.trim().toLowerCase())
    .maybeSingle();

  if (!profile) {
    return { success: false, message: 'No student found with that email.', eventTitle: event.title };
  }

  const scannedAt = new Date().toISOString();
  const { error } = await supabase.from('attendance').insert([
    { student_id: profile.id, event_id: event.id, scanned_at: scannedAt },
  ]);

  if (error) {
    if (error.code === '23505') {
      return { success: false, message: 'Student is already checked in.', eventTitle: event.title };
    }
    return { success: false, message: error.message, eventTitle: event.title };
  }

  return {
    success: true,
    message: `${profile.full_name ?? studentEmail} checked in.`,
    eventTitle: event.title,
    status: statusFor(event.start_time, scannedAt),
  };
}
/** Teacher screen: live count + the 5 most recent check-ins for one event. */
export async function getEventAttendanceLive(eventCode: string): Promise<{
  count: number;
  recent: {
    studentId: string;
    name: string;
    status: AttendanceStatus;
    scannedAt: string;
  }[];
}> {
  const event = await getEventByCode(eventCode);
  if (!event) return { count: 0, recent: [] };

  const { data } = await supabase
    .from('attendance')
    .select('student_id, scanned_at')
    .eq('event_id', event.id)
    .order('scanned_at', { ascending: false });

  const rows = data ?? [];
  const latest = rows.slice(0, 5);
  const ids = latest.map((r) => String(r.student_id));

  const names: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    (profs ?? []).forEach((p: any) => {
      names[String(p.id)] = p.full_name || p.email || String(p.id);
    });
  }

  return {
    count: rows.length,
    recent: latest.map((r) => {
      const studentId = String(r.student_id);
      const scannedAt = String(r.scanned_at);
      return {
        studentId,
        name: names[studentId] ?? 'Student',
        status: statusFor(event.start_time, scannedAt),
        scannedAt,
      };
    }),
  };
}