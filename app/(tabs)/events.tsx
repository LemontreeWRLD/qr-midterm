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
import Ionicons from "@expo/vector-icons/Ionicons";

import StateView from "@/components/StateView";
import StatusBadge, { toneForPhase } from "@/components/StatusBadge";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { getAttendanceCounts } from "@/lib/attendance";
import {
  eventPhase,
  getAvailableEvents,
  getManagedEvents,
  type CloudEvent,
} from "@/lib/events";
import { fmtRange } from "@/lib/format";

export default function EventsScreen() {
  const { user, role } = useAuth();
  const isStaff = role === "teacher" || role === "admin";

  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  // EVENT: screen gains focus / user pulls to refresh -> reload data
  const load = useCallback(
    async (pull = false) => {
      if (!user) return;
      pull ? setRefreshing(true) : setLoading(true);
      setFailed(false);
      try {
        const list = isStaff
          ? await getManagedEvents(user.id, role === "admin" ? "admin" : "teacher")
          : await getAvailableEvents();
        setEvents(list);
        setCounts(isStaff ? await getAttendanceCounts(list.map((e) => e.id)) : {});
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, role, isStaff]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <StateView kind="loading" title="Loading events..." />;

  if (failed) {
    return (
      <StateView
        kind="error"
        title="Could not load events"
        message="Check your internet connection and try again."
        actionLabel="Try again"
        onAction={() => load()}
      />
    );
  }

  return (
    <View style={styles.container}>
      {isStaff && (
        <Pressable
          style={styles.newButton}
          onPress={() => router.push("/event/form")}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={22} color={COLORS.textOnPrimary} />
          <Text style={styles.newButtonText}>New Event</Text>
        </Pressable>
      )}

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
        ListEmptyComponent={
          <StateView
            kind="empty"
            title={isStaff ? "No events yet" : "No events available"}
            message={
              isStaff
                ? "Tap New Event to create your first event."
                : "Open events will appear here when your teacher creates them."
            }
          />
        }
        renderItem={({ item }) => {
          const phase = eventPhase(item);
          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/event/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <StatusBadge label={phase} tone={toneForPhase(phase)} />
              </View>
              <Text style={styles.meta}>{item.event_code}</Text>
              <Text style={styles.meta}>
                {fmtRange(item.start_time, item.end_time)}
              </Text>
              {item.venue ? (
                <View style={styles.venueRow}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textMuted} />
                  <Text style={styles.meta}>{item.venue}</Text>
                </View>
              ) : null}
              {isStaff && (
                <Text style={styles.count}>
                  {counts[item.id] ?? 0} attendee
                  {(counts[item.id] ?? 0) === 1 ? "" : "s"}
                </Text>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, gap: 12, flexGrow: 1 },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 14,
  },
  newButtonText: { color: COLORS.textOnPrimary, fontWeight: "700", fontSize: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 4,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textPrimary,
  },
  meta: { fontSize: 13, color: COLORS.textSecondary },
  venueRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  count: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
});
