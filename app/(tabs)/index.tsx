import { router } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import AppButton from "@/components/AppButton";
import Header from "@/components/Header";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/profiles";

export default function Index() {
  const { profile, role, user } = useAuth();
  const name = profile?.full_name || user?.email || "";
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";

  const subtitle = isAdmin
    ? "Monitor users, events and attendance across the whole school."
    : isTeacher
      ? "Create events, show their QR code and monitor who attended."
      : "Scan QR codes to record attendance during school activities.";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />
        <Text style={styles.byline}> by: Vinmark Patatag</Text>
      </View>

      <View style={styles.bodyContainer}>
        <Text style={styles.mainTitle}>
          {name ? `Welcome, ${name}` : "School Event Attendance"}
        </Text>
        {role ? (
          <Text style={styles.roleText}>{ROLE_LABEL[role]}</Text>
        ) : null}
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.footerContainer}>
        {isAdmin ? (
          <>
            <AppButton
              theme="primary"
              title="Admin Dashboard"
              icon="shield-checkmark-outline"
              onPress={() => router.push("/admin")}
            />
            <AppButton
              title="All Events"
              icon="calendar-outline"
              onPress={() => router.push("/events")}
            />
          </>
        ) : isTeacher ? (
          <>
            <AppButton
              theme="primary"
              title="Create New Event"
              icon="add-circle-outline"
              onPress={() => router.push("/event/form")}
            />
            <AppButton
              title="My Events"
              icon="calendar-outline"
              onPress={() => router.push("/events")}
            />
            <AppButton
              title="Attendance Records"
              icon="time-outline"
              onPress={() => router.push("/history")}
            />
          </>
        ) : (
          <>
            <AppButton
              theme="primary"
              title="Scan QR Code"
              icon="qr-code-outline"
              onPress={() => router.push("/scan")}
            />
            <AppButton
              title="Available Events"
              icon="calendar-outline"
              onPress={() => router.push("/events")}
            />
            <AppButton
              title="Attendance History"
              icon="time-outline"
              onPress={() => router.push("/history")}
            />
          </>
        )}
        <AppButton
          title="Profile"
          icon="person-outline"
          onPress={() => router.push("/profile")}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
  },
  headerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  byline: { color: COLORS.textMuted },
  bodyContainer: {
    alignItems: "center",
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.primary,
    marginBottom: 2,
    textAlign: "center",
  },
  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center" },
  footerContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 12,
    width: "100%",
  },
});
