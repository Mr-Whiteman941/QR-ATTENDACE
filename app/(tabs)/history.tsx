import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getStudentStats,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import type { AttendanceStatus } from '@/lib/attendancestatus';
import { shareEventAttendance } from '@/lib/exportcsv';
import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<
    TeacherEventAttendance[]
  >([]);
  const [stats, setStats] = useState<Awaited<
    ReturnType<typeof getStudentStats>
  > | null>(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const profile = await getProfile(user.id);
    const currentRole = profile?.role ?? 'student';

    setRole(currentRole);

    if (currentRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);

      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);

      setStudentRecords(records);
      setStats(await getStudentStats(user.id));
      setTeacherEvents([]);
    }

    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>Loading records...</Text>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Attendance History</Text>

        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event to see attendance here.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{item.title}</Text>

                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {item.attendeeCount}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>
                  Code: {item.eventCode}
                </Text>

                <Pressable
                  style={styles.exportButton}
                  onPress={() =>
                    shareEventAttendance(item).catch(() =>
                      Alert.alert('Error', 'Could not export attendance.')
                    )
                  }
                >
                  <Text style={styles.exportText}>Export CSV</Text>
                </Pressable>

                {item.startTime && (
                  <Text style={styles.eventMeta}>
                    Start: {formatDate(item.startTime)}
                  </Text>
                )}

                {item.attendees.length === 0 ? (
                  <Text style={styles.noStudents}>
                    No students have scanned yet.
                  </Text>
                ) : (
                  <View style={styles.attendeeList}>
                    <Text style={styles.attendeeTitle}>Students</Text>

                    {item.attendees.map((attendee) => (
                      <View
                        key={`${attendee.studentId}-${attendee.scannedAt}`}
                        style={styles.attendeeRow}
                      >
                        <Text style={styles.studentId} numberOfLines={1}>
                          {attendee.studentName || shortId(attendee.studentId)}
                        </Text>

                        <StatusBadge status={attendee.status} />

                        <Text style={styles.scanTime}>
                          {formatDate(attendee.scannedAt)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance History</Text>

      {stats && studentRecords.length > 0 && (
        <View style={styles.statsCard}>
          <StatBox label="Present" value={stats.present} color={STATUS_COLORS.present} />
          <StatBox label="Late" value={stats.late} color={STATUS_COLORS.late} />
          <StatBox label="Absent" value={stats.absent} color={STATUS_COLORS.absent} />
          <StatBox label="Rate" value={`${stats.percentage}%`} color={COLORS.primary} />
        </View>
      )}

      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{item.eventTitle}</Text>
                <StatusBadge status={item.status} />
              </View>

              <Text style={styles.eventMeta}>
                {item.eventId}
              </Text>

              <Text style={styles.eventMeta}>
                {formatDate(item.scannedAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: '#2E8B57',
  late: '#D98E04',
  absent: '#C62828',
};

function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] }]}>
      <Text style={styles.statusText}>{status.toUpperCase()}</Text>
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 14,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  statusText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  exportButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
  },
  exportText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },

  list: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 10,
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  countBadge: {
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#2E8B57',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  attendeeList: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  attendeeTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },

  studentId: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 10,
  },

  noStudents: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
});