import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import QRCode from "react-native-qrcode-svg";

import AppButton from "@/components/AppButton";
import AttendanceActionModal from "@/components/AttendanceActionModal";
import StateView from "@/components/StateView";
import StatusBadge, {
  toneForAttendance,
  toneForPhase,
} from "@/components/StatusBadge";
import { COLORS } from "@/constants/colors";
import { logAction } from "@/lib/admin";
import {
  deleteAttendance,
  getEventAttendance,
  updateAttendanceStatus,
  type AttendanceStatus,
  type AttendeeRow,
} from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import {
  deleteEvent,
  eventPhase,
  getEventById,
  setEventStatus,
  type CloudEvent,
} from "@/lib/events";
import { fmtDateTime, fmtRange, shortId } from "@/lib/format";
import { buildQRPayload } from "@/lib/qr";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const [event, setEvent] = useState<CloudEvent | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<AttendeeRow | null>(null);

  // Staff who may manage THIS event: the teacher who created it, or an admin.
  const canManage =
    !!event && (isAdmin || (isTeacher && event.created_by === user?.id));

  const load = useCallback(
    async (pull = false) => {
      if (!id) return;
      pull ? setRefreshing(true) : setLoading(true);
      const e = await getEventById(id);
      if (!e) {
        setNotFound(true);
      } else {
        setNotFound(false);
        setEvent(e);
        const mine = isAdmin || (isTeacher && e.created_by === user?.id);
        setAttendees(mine ? await getEventAttendance(e.id) : []);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [id, isAdmin, isTeacher, user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <StateView kind="loading" title="Loading event..." />;
  if (notFound || !event) {
    return (
      <StateView
        kind="error"
        title="Event not found"
        message="It may have been deleted, or you do not have access to it."
      />
    );
  }

  const phase = eventPhase(event);
  const isOpen = event.status === "open";

  // EVENT: Close / Reopen pressed -> confirm -> update status -> refresh
  const toggleStatus = () => {
    const next = isOpen ? "closed" : "open";
    Alert.alert(
      isOpen ? "Close this event?" : "Reopen this event?",
      isOpen
        ? "Students will no longer be able to record attendance."
        : "Students will be able to scan the QR code again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isOpen ? "Close event" : "Reopen",
          style: isOpen ? "destructive" : "default",
          onPress: async () => {
            setBusy(true);
            const res = await setEventStatus(event.id, next);
            setBusy(false);
            if (res.error || !res.event) {
              Alert.alert("Error", res.error ?? "Could not update the event.");
              return;
            }
            setEvent(res.event);
            if (user) logAction(user.id, `event.${next}`, "event", event.id, event.title);
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete this event?",
      "This also deletes all of its attendance records. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            const res = await deleteEvent(event.id);
            setBusy(false);
            if (res.error) {
              Alert.alert("Error", res.error);
              return;
            }
            if (user) logAction(user.id, "event.delete", "event", event.id, event.title);
            router.back();
          },
        },
      ]
    );
  };

  // EVENT: admin corrects an attendance record
  const changeStatus = async (s: AttendanceStatus) => {
    if (!selected) return;
    setBusy(true);
    const res = await updateAttendanceStatus(selected.attendanceId, s);
    setBusy(false);
    if (res.error) {
      Alert.alert("Error", res.error);
      return;
    }
    if (user) {
      logAction(
        user.id,
        "attendance.correct",
        "attendance",
        selected.attendanceId,
        `${selected.studentName ?? shortId(selected.studentId)}: ${selected.status} -> ${s}`
      );
    }
    setSelected(null);
    load(true);
  };

  const removeRecord = () => {
    if (!selected) return;
    const row = selected;
    Alert.alert("Delete record?", "This removes the student's attendance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          const res = await deleteAttendance(row.attendanceId);
          setBusy(false);
          if (res.error) {
            Alert.alert("Error", res.error);
            return;
          }
          if (user) {
            logAction(
              user.id,
              "attendance.delete",
              "attendance",
              row.attendanceId,
              row.studentName ?? shortId(row.studentId)
            );
          }
          setSelected(null);
          load(true);
        },
      },
    ]);
  };

  const tally = (s: AttendanceStatus) =>
    attendees.filter((a) => a.status === s).length;

  return (
    <>
      <Stack.Screen options={{ title: event.title }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
        }
      >
        {/* ---- Event information ---- */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.title}>{event.title}</Text>
            <StatusBadge label={phase} tone={toneForPhase(phase)} />
          </View>
          <Text style={styles.code}>{event.event_code}</Text>

          <InfoRow icon="calendar-outline" text={fmtRange(event.start_time, event.end_time)} />
          <InfoRow icon="location-outline" text={event.venue || "No venue"} />
          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}
        </View>

        {/* ---- Student view ---- */}
        {!canManage && role === "student" && (
          <View style={{ marginTop: 16 }}>
            {phase === "live" ? (
              <AppButton
                theme="primary"
                title="Scan QR to Attend"
                icon="qr-code-outline"
                onPress={() => router.push("/scan")}
              />
            ) : (
              <Text style={styles.notice}>
                {phase === "upcoming"
                  ? "This event has not started yet."
                  : phase === "closed"
                    ? "This event is closed."
                    : "This event has ended."}
              </Text>
            )}
          </View>
        )}

        {/* ---- Staff tools ---- */}
        {canManage && (
          <>
            <View style={[styles.card, styles.qrCard]}>
              {isOpen ? (
                <>
                  <Text style={styles.sectionTitle}>Event QR Code</Text>
                  <View style={styles.qrBox}>
                    <QRCode value={buildQRPayload({ eventId: event.event_code })} size={210} />
                  </View>
                  <Text style={styles.hint}>
                    Students scan this with the Scan tab to record attendance.
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={40} color={COLORS.textMuted} />
                  <Text style={styles.sectionTitle}>Event closed</Text>
                  <Text style={styles.hint}>
                    This QR code is no longer accepted. Reopen the event to use it again.
                  </Text>
                </>
              )}
            </View>

            <View style={{ marginTop: 16 }}>
              <AppButton
                title="Edit Event"
                icon="create-outline"
                onPress={() => router.push({ pathname: "/event/form", params: { id: event.id } })}
              />
              <AppButton
                theme={isOpen ? "danger" : "primary"}
                title={isOpen ? "Close Event" : "Reopen Event"}
                icon={isOpen ? "lock-closed-outline" : "lock-open-outline"}
                loading={busy}
                onPress={toggleStatus}
              />
              {isAdmin && (
                <AppButton
                  title="Delete Event"
                  icon="trash-outline"
                  disabled={busy}
                  onPress={handleDelete}
                />
              )}
            </View>

            {/* ---- Attendance ---- */}
            <Text style={styles.sectionHeading}>
              Attendance ({attendees.length})
            </Text>
            <View style={styles.tallyRow}>
              {(["present", "late", "absent", "excused"] as AttendanceStatus[]).map((s) => (
                <View key={s} style={styles.tally}>
                  <Text style={styles.tallyNumber}>{tally(s)}</Text>
                  <Text style={styles.tallyLabel}>{s}</Text>
                </View>
              ))}
            </View>

            {attendees.length === 0 ? (
              <Text style={styles.notice}>No one has recorded attendance yet.</Text>
            ) : (
              attendees.map((a) => (
                <Pressable
                  key={a.attendanceId}
                  style={styles.attendee}
                  disabled={!isAdmin}
                  onPress={() => setSelected(a)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.attendeeName}>
                      {a.studentName ?? shortId(a.studentId)}
                    </Text>
                    <Text style={styles.meta}>
                      {a.idNumber ? `${a.idNumber}  -  ` : ""}
                      {fmtDateTime(a.scannedAt)}
                    </Text>
                  </View>
                  <StatusBadge label={a.status} tone={toneForAttendance(a.status)} />
                  {isAdmin && (
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  )}
                </Pressable>
              ))
            )}
            {isAdmin && attendees.length > 0 && (
              <Text style={styles.hint}>Tap a record to correct or delete it.</Text>
            )}
          </>
        )}
      </ScrollView>

      <AttendanceActionModal
        visible={!!selected}
        title={selected?.studentName ?? (selected ? shortId(selected.studentId) : "")}
        subtitle={event.title}
        current={selected?.status ?? null}
        busy={busy}
        onSelectStatus={changeStatus}
        onDelete={removeRecord}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function InfoRow({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={COLORS.textMuted} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: COLORS.textPrimary },
  code: { fontSize: 13, color: COLORS.textMuted, marginBottom: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, color: COLORS.textPrimary, flex: 1 },
  description: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  notice: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 12,
  },
  qrCard: { marginTop: 16, alignItems: "center", gap: 10 },
  qrBox: { backgroundColor: "#FFFFFF", padding: 14, borderRadius: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginTop: 12,
    marginBottom: 10,
  },
  tallyRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tally: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: "center",
  },
  tallyNumber: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  tallyLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: "capitalize",
  },
  attendee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingVertical: 12,
  },
  attendeeName: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary },
});
