import { Redirect, Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth";

type IconName = keyof typeof Ionicons.glyphMap;

function icon(active: IconName, inactive: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} color={color} size={24} />
  );
}

export default function TabLayout() {
  const { user, role } = useAuth();

  // UNAUTHORIZED ACCESS guard: no session -> back to login.
  if (!user) {
    return <Redirect href="/login" />;
  }

  // Role-based navigation. While the profile loads we show the student
  // layout; the database (RLS) is the real gatekeeper either way.
  const isAdmin = role === "admin";
  const isTeacher = role === "teacher";
  const isStudent = !isAdmin && !isTeacher;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerTintColor: COLORS.textPrimary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.divider,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: icon("home-sharp", "home-outline") }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: isStudent ? "Events" : "Manage Events",
          tabBarLabel: "Events",
          tabBarIcon: icon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          href: isStudent ? undefined : null,
          tabBarIcon: icon("qr-code", "qr-code-outline"),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: isTeacher ? "Attendance" : "History",
          href: isAdmin ? null : undefined,
          tabBarIcon: icon("time", "time-outline"),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          href: isAdmin ? undefined : null,
          tabBarIcon: icon("shield-checkmark", "shield-checkmark-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon("person", "person-outline") }}
      />
    </Tabs>
  );
}
