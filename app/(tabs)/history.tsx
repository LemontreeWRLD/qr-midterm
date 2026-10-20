import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import StateView from "@/components/StateView";
import StatusBadge, { toneForAttendance } from "@/components/StatusBadge";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from "@/lib/attendance";
import { fmtDateTime, shortId } from "@/lib/format";

export default function HistoryScreen() {
  const { user, role, profileLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);

  // EVENT: tab focused / pull-to-refresh -> data is refreshed
  const load = useCallback(
    async (pull = false) => {
      if (!user || !role) {
        setLoading(false);
        return;
      }
      pull ? setRefreshing(true) : setLoading(true);
      setFailed(false);
      try {
        if (role === "teacher") {
          setTeacherEvents(await getTeacherEventAttendance(user.id));
          setStudentRecords([]);
        } else if (role === "student") {
          setStudentRecords(await getAttendanceHistory(user.id));
          setTeacherEvents([]);
        }
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, role]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (profileLoading || (loading && role)) {
    return <StateView kind="loading" title="Loading records..." />;
  }

  if (role === "admin") {
    return (
      <StateView
        kind="empty"
        title="Use the Admin tab"
        message="System-wide attendance records are managed from the Admin dashboard."
      />
    );
  }

  if (failed) {
    return (
      <StateView
        kind="error"
        title="Could not load records"
        message="Check your internet connection and try again."
        actionLabel="Try again"
        onAction={() => load()}
      />
    );
  }

  if (role === "teacher") {
    return (
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
        data={teacherEvents}
        keyExtractor={(item) => item.eventId}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          <StateView
            kind="empty"
            title="No events yet"
            message="Create an event in the Events tab to see attendance here."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/event/${item.eventId}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.attendeeCount}</Text>
              </View>
            </View>
            <Text style={styles.meta}>{item.eventCode}</Text>
            {item.startTime ? (
              <Text style={styles.meta}>{fmtDateTime(item.startTime)}</Text>
            ) : null}
            {item.attendees.length === 0 ? (
              <Text style={styles.noScans}>No scans yet.</Text>
            ) : (
              item.attendees.slice(0, 5).map((a) => (
                <View key={a.studentId} style={styles.attendeeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendeeName}>
                      {a.studentName ?? shortId(a.studentId)}
                    </Text>
                    <Text style={styles.meta}>{fmtDateTime(a.scannedAt)}</Text>
                  </View>
                  <StatusBadge label={a.status} tone={toneForAttendance(a.status)} />
                </View>
              ))
            )}
            {item.attendees.length > 5 && (
              <Text style={styles.more}>
                +{item.attendees.length - 5} more - tap to view all
              </Text>
            )}
          </Pressable>
        )}
      />
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={[styles.listContent, { flexGrow: 1 }]}
      data={studentRecords}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
      }
      ListEmptyComponent={
        <StateView
          kind="empty"
          title="No records yet"
          message="Scan an event QR code to record your attendance."
        />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.eventTitle}</Text>
            <StatusBadge label={item.status} tone={toneForAttendance(item.status)} />
          </View>
          <Text style={styles.meta}>{item.eventId}</Text>
          {item.venue ? <Text style={styles.meta}>{item.venue}</Text> : null}
          <Text style={styles.meta}>{fmtDateTime(item.scannedAt)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
    flex: 1,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countText: { color: COLORS.textOnPrimary, fontWeight: "700", fontSize: 14 },
  meta: { fontSize: 13, color: COLORS.textSecondary },
  noScans: { fontSize: 13, color: COLORS.textMuted, marginTop: 6 },
  more: { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginTop: 8 },
  attendeeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendeeName: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
});
