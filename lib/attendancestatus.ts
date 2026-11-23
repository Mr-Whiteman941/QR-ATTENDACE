export type AttendanceStatus = 'present' | 'late' | 'absent';

/**
 * Decide a student's status from when they scanned.
 * - within graceMinutes of class start  -> present
 * - within lateCutoffMinutes            -> late
 * - after that, or never scanned        -> absent
 */
export function getStatus(
  classStart: Date,
  scannedAt: Date | null,
  graceMinutes = 10,
  lateCutoffMinutes = 30
): AttendanceStatus {
  if (!scannedAt) return 'absent';
  const minutes = (scannedAt.getTime() - classStart.getTime()) / 60000;
  if (minutes <= graceMinutes) return 'present';
  if (minutes <= lateCutoffMinutes) return 'late';
  return 'absent';
}

export interface AttendanceStats {
  present: number;
  late: number;
  absent: number;
  total: number;
  /** Percentage of sessions attended (late counts as attended), 0-100. */
  percentage: number;
}

export function summarize(records: { status: AttendanceStatus }[]): AttendanceStats {
  const present = records.filter(r => r.status === 'present').length;
  const late = records.filter(r => r.status === 'late').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const total = records.length;
  const percentage = total === 0 ? 0 : Math.round(((present + late) / total) * 100);
  return { present, late, absent, total, percentage };
}