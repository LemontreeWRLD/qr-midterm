import { Stack } from "expo-router";

import { COLORS } from "@/constants/colors";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="event/[id]"
        options={{
          headerShown: true,
          title: "Event",
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: COLORS.background },
        }}
      />
      <Stack.Screen
        name="event/form"
        options={{
          headerShown: true,
          title: "Event",
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: COLORS.background },
        }}
      />
    </Stack>
  );
}
