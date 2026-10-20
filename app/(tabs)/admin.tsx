import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import AttendanceActionModal from "@/components/AttendanceActionModal";
import StateView from "@/components/StateView";
import StatusBadge, { toneForAttendance } from "@/components/StatusBadge";
import { COLORS } from "@/constants/colors";
import {
  getAllUsers,
  getAuditLogs,
  getSystemStats,
  logAction,
  setUserActive,
  updateUserRole,
  type AuditLog,
  type SystemStats,
} from "@/lib/admin";
import {
  deleteAttendance,
  getAllAttendance,
  updateAttendanceStatus,
  type AdminAttendanceRow,
  type AttendanceStatus,
} from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, shortId } from "@/lib/format";
import { ROLE_LABEL, type Profile, type Role } from "@/lib/profiles";

type Section = "overview" | "users" | "attendance" | "logs";
const SECTIONS: { key: Section; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "attendance", label: "Attendance" },
  { key: "logs", label: "Logs" },
];

export default function AdminScreen() {
  const { user, role, profileLoading } = useAuth();

  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<AdminAttendanceRow[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const [userFilter, setUserFilter] = useState("");
  const [attFilter, setAttFilter] = useState("");
  const [pickedUser, setPickedUser] = useState<Profile | null>(null);
  const [pickedAtt, setPickedAtt] = useState<AdminAttendanceRow | null>(null);

  const load = useCallback(
    async (pull = false) => {
      if (role !== "admin") {
        setLoading(false);
        return;
      }
      pull ? setRefreshing(true) : setLoading(true);
      setFailed(false);
      try {
        const [s, u, a, l] = await Promise.all([
          getSystemStats(),
          getAllUsers(),
          getAllAttendance(),
          getAuditLogs(),
        ]);
        setStats(s);
        setUsers(u);
        setAttendance(a);
        setLogs(l);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [role]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shownUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.includes(q)
    );
  }, [users, userFilter]);

  const shownAttendance = useMemo(() => {
    const q = attFilter.trim().toLowerCase();
    if (!q) return attendance;
    return attendance.filter(
      (a) =>
        (a.studentName ?? "").toLowerCase().includes(q) ||
        a.eventTitle.toLowerCase().includes(q) ||
        a.status.includes(q)
    );
  }, [attendance, attFilter]);

  if (profileLoading) return <StateView kind="loading" title="Checking your account..." />;

  // UNAUTHORIZED ACCESS: admin tab is hidden for others, but guard anyway
  if (role !== "admin") {
    return (
      <StateView
        kind="locked"
        title="Administrators only"
        message="You do not have permission to open this page."
      />
    );
  }
  if (loading) return <StateView kind="loading" title="Loading dashboard..." />;
  if (failed) {
    return (
      <StateView
        kind="error"
        title="Could not load the dashboard"
        message="Check your internet connection and try again."
        actionLabel="Try again"
        onAction={() => load()}
      />
    );
  }

  // ---- User management -------------------------------------------------
  const isSelf = (u: Profile) => u.id === user?.id;

  const changeRole = async (u: Profile, next: Role) => {
    if (u.role === next) return;
    setBusy(true);
    const res = await updateUserRole(u.id, next);
    setBusy(false);
    if (res.error) {
      Alert.alert("Error", res.error);
      return;
    }
    if (user) {
      logAction(user.id, "user.role", "user", u.id, `${u.email}: ${u.role} -> ${next}`);
    }
    setPickedUser(null);
    load(true);
  };

  const toggleActive = async (u: Profile) => {
    const next = !u.is_active;
    setBusy(true);
    const res = await setUserActive(u.id, next);
    setBusy(false);
    if (res.error) {
      Alert.alert("Error", res.error);
      return;
    }
    if (user) {
      logAction(
        user.id,
        next ? "user.activate" : "user.deactivate",
        "user",
        u.id,
        u.email
      );
    }
    setPickedUser(null);
    load(true);
  };

  // ---- Attendance correction ------------------------------------------
  const correct = async (s: AttendanceStatus) => {
    if (!pickedAtt) return;
    const row = pickedAtt;
    setBusy(true);
    const res = await updateAttendanceStatus(row.attendanceId, s);
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
        row.attendanceId,
        `${row.studentName ?? shortId(row.studentId)} @ ${row.eventTitle}: ${row.status} -> ${s}`
      );
    }
    setPickedAtt(null);
    load(true);
  };

  const removeAtt = () => {
    if (!pickedAtt) return;
    const row = pickedAtt;
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
              `${row.studentName ?? shortId(row.studentId)} @ ${row.eventTitle}`
            );
          }
          setPickedAtt(null);
          load(true);
        },
      },
    ]);
  };

  const refresh = (
    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
  );

  return (
    <View style={styles.container}>
      {/* Segmented control */}
      <View style={styles.segment}>
        {SECTIONS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.segItem, section === s.key && styles.segActive]}
            onPress={() => setSection(s.key)}
          >
            <Text style={[styles.segText, section === s.key && styles.segTextActive]}>
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === "overview" && stats && (
        <ScrollView contentContainerStyle={styles.pad} refreshControl={refresh}>
          <Text style={styles.heading}>System overview</Text>
          <View style={styles.grid}>
            <Stat label="Users" value={stats.users} />
            <Stat label="Students" value={stats.students} />
            <Stat label="Teachers" value={stats.teachers} />
            <Stat label="Admins" value={stats.admins} />
            <Stat label="Events" value={stats.events} />
            <Stat label="Open events" value={stats.openEvents} />
            <Stat label="Attendance (all)" value={stats.attendance} />
            <Stat label="Attendance today" value={stats.attendanceToday} />
          </View>
          <Pressable style={styles.link} onPress={() => router.push("/events")}>
            <Text style={styles.linkText}>Manage all events</Text>
          </Pressable>
        </ScrollView>
      )}

      {section === "users" && (
        <FlatList
          contentContainerStyle={[styles.pad, { flexGrow: 1 }]}
          data={shownUsers}
          keyExtractor={(u) => u.id}
          refreshControl={refresh}
          ListHeaderComponent={
            <TextInput
              style={styles.search}
              value={userFilter}
              onChangeText={setUserFilter}
              placeholder="Search name, email or role"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
            />
          }
          ListEmptyComponent={<StateView kind="empty" title="No users found" />}
          renderItem={({ item }) => (
            <Pressable style={styles.rowCard} onPress={() => setPickedUser(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.full_name || "(no name)"}
                  {isSelf(item) ? "  (you)" : ""}
                </Text>
                <Text style={styles.meta}>{item.email}</Text>
                {item.id_number ? <Text style={styles.meta}>ID: {item.id_number}</Text> : null}
              </View>
              <View style={{ gap: 6, alignItems: "flex-end" }}>
                <StatusBadge
                  label={ROLE_LABEL[item.role]}
                  tone={item.role === "admin" ? "danger" : item.role === "teacher" ? "info" : "neutral"}
                />
                {!item.is_active && <StatusBadge label="deactivated" tone="warning" />}
              </View>
            </Pressable>
          )}
        />
      )}

      {section === "attendance" && (
        <FlatList
          contentContainerStyle={[styles.pad, { flexGrow: 1 }]}
          data={shownAttendance}
          keyExtractor={(a) => a.attendanceId}
          refreshControl={refresh}
          ListHeaderComponent={
            <TextInput
              style={styles.search}
              value={attFilter}
              onChangeText={setAttFilter}
              placeholder="Search student, event or status"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="none"
            />
          }
          ListEmptyComponent={
            <StateView kind="empty" title="No attendance records" message="Records appear here once students scan." />
          }
          renderItem={({ item }) => (
            <Pressable style={styles.rowCard} onPress={() => setPickedAtt(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.studentName ?? shortId(item.studentId)}</Text>
                <Text style={styles.meta}>{item.eventTitle}</Text>
                <Text style={styles.meta}>{fmtDateTime(item.scannedAt)}</Text>
              </View>
              <StatusBadge label={item.status} tone={toneForAttendance(item.status)} />
            </Pressable>
          )}
        />
      )}

      {section === "logs" && (
        <FlatList
          contentContainerStyle={[styles.pad, { flexGrow: 1 }]}
          data={logs}
          keyExtractor={(l) => l.id}
          refreshControl={refresh}
          ListEmptyComponent={
            <StateView kind="empty" title="No activity yet" message="Event and record changes are logged here." />
          }
          renderItem={({ item }) => (
            <View style={styles.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.action}</Text>
                {item.details ? <Text style={styles.meta}>{item.details}</Text> : null}
                <Text style={styles.meta}>
                  {item.actorName ?? "unknown"} - {fmtDateTime(item.createdAt)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* User actions */}
      <Modal
        visible={!!pickedUser}
        transparent
        animationType="fade"
        onRequestClose={() => setPickedUser(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickedUser(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{pickedUser?.full_name || pickedUser?.email}</Text>
            <Text style={styles.meta}>{pickedUser?.email}</Text>

            {pickedUser && isSelf(pickedUser) ? (
              <Text style={styles.notice}>
                You cannot change your own role or deactivate your own account.
              </Text>
            ) : (
              <>
                <Text style={styles.sheetSection}>Role</Text>
                <View style={styles.chips}>
                  {(["student", "teacher", "admin"] as Role[]).map((r) => (
                    <Pressable
                      key={r}
                      disabled={busy}
                      style={[styles.chip, pickedUser?.role === r && styles.chipActive]}
                      onPress={() => pickedUser && changeRole(pickedUser, r)}
                    >
                      <Text
                        style={[styles.chipText, pickedUser?.role === r && styles.chipTextActive]}
                      >
                        {ROLE_LABEL[r]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  disabled={busy}
                  style={[styles.action, pickedUser?.is_active && styles.actionDanger]}
                  onPress={() => pickedUser && toggleActive(pickedUser)}
                >
                  <Text
                    style={[styles.actionText, pickedUser?.is_active && { color: COLORS.danger }]}
                  >
                    {pickedUser?.is_active ? "Deactivate account" : "Reactivate account"}
                  </Text>
                </Pressable>
              </>
            )}
            <Pressable style={styles.cancel} onPress={() => setPickedUser(null)}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <AttendanceActionModal
        visible={!!pickedAtt}
        title={pickedAtt?.studentName ?? (pickedAtt ? shortId(pickedAtt.studentId) : "")}
        subtitle={pickedAtt?.eventTitle}
        current={pickedAtt?.status ?? null}
        busy={busy}
        onSelectStatus={correct}
        onDelete={removeAtt}
        onClose={() => setPickedAtt(null)}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  pad: { padding: 16, gap: 10 },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  segment: {
    flexDirection: "row",
    margin: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10 },
  segActive: { backgroundColor: COLORS.primary },
  segText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  segTextActive: { color: COLORS.textOnPrimary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  statValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  statLabel: { fontSize: 13, color: COLORS.textSecondary },
  link: { marginTop: 8, alignItems: "center", padding: 12 },
  linkText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
  search: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  name: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  sheetSection: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 10,
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: COLORS.textPrimary },
  chipTextActive: { color: COLORS.textOnPrimary },
  action: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.success,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionDanger: { borderColor: COLORS.danger },
  actionText: { color: COLORS.success, fontWeight: "700", fontSize: 15 },
  notice: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: COLORS.textSecondary, fontWeight: "600", fontSize: 15 },
});
