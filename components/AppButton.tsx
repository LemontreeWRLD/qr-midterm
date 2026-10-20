import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

type Props = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme?: "primary" | "danger";
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export default function AppButton({
  title,
  icon,
  theme,
  disabled,
  loading,
  onPress,
}: Props) {
  const isOff = !!disabled || !!loading;
  const filled = theme === "primary" || theme === "danger";
  const bg = theme === "danger" ? COLORS.danger : COLORS.primary;
  const fg = filled ? COLORS.textOnPrimary : COLORS.textSecondary;

  return (
    <View
      style={[
        styles.buttonOuter,
        filled && { borderWidth: 3, borderColor: bg, borderRadius: 18 },
        isOff && { opacity: 0.55 },
      ]}
    >
      <Pressable
        style={[styles.buttonInner, filled && { backgroundColor: bg }]}
        onPress={onPress}
        disabled={isOff}
        accessibilityRole="button"
        accessibilityState={{ disabled: isOff }}
      >
        {loading ? (
          <ActivityIndicator color={fg} style={styles.icon} />
        ) : (
          <Ionicons name={icon} size={22} color={fg} style={styles.icon} />
        )}
        <Text style={[styles.label, { color: fg }]}>{title}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonOuter: {
    width: "100%",
    marginBottom: 14,
  },
  buttonInner: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    backgroundColor: COLORS.card,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  icon: { paddingRight: 10 },
  label: { fontSize: 17, fontWeight: "600", color: COLORS.textPrimary },
});
