import { Share } from 'react-native';
import type { AttendanceStatus } from './attendancestatus';
import type { TeacherEventAttendance } from './attendance';

export interface AttendanceRow {
  studentId: string;
  name: string;
  status: AttendanceStatus;
  scannedAt: Date | null;
}

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function buildAttendanceCsv(rows: AttendanceRow[]): string {
  const header = 'Student ID,Name,Status,Time Scanned';
  const lines = rows.map(r =>
    [r.studentId, r.name, r.status, r.scannedAt ? r.scannedAt.toISOString() : '']
      .map(esc)
      .join(',')
  );
  return [header, ...lines].join('\n');
}

/** Opens the system share sheet (email, Drive, messaging...) with the CSV text. */
export function shareAttendanceCsv(sessionTitle: string, rows: AttendanceRow[]) {
  return Share.share({
    title: `${sessionTitle} attendance`,
    message: buildAttendanceCsv(rows),
  });
}

/** Teacher screen: pass one item from getTeacherEventAttendance(). */
export function shareEventAttendance(ev: TeacherEventAttendance) {
  return shareAttendanceCsv(
    ev.title,
    ev.attendees.map(a => ({
      studentId: a.studentId,
      name: a.studentName,
      status: a.status,
      scannedAt: new Date(a.scannedAt),
    }))
  );
}