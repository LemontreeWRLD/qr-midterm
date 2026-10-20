import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import AppButton from "@/components/AppButton";
import { COLORS } from "@/constants/colors";

type Props = {
  kind: "loading" | "empty" | "error" | "locked";
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ICONS = {
  empty: "file-tray-outline",
  error: "alert-circle-outline",
  locked: "lock-closed-outline",
} as const;

// One consistent component for the four feedback states the project
// requires: Loading, Empty data, Error and Unauthorized (locked).
export default function StateView({
  kind,
  title,
  message,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.wrap}>
      {kind === "loading" ? (
        <ActivityIndicator size="large" color={COLORS.primary} />
      ) : (
        <Ionicons
          name={ICONS[kind]}
          size={52}
          color={kind === "error" ? COLORS.danger : COLORS.textMuted}
        />
      )}
      <Text style={styles.title}>
        {title ?? (kind === "loading" ? "Loading..." : "")}
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <AppButton title={actionLabel} icon="refresh" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  action: { width: "70%", marginTop: 12 },
});
