import { StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "#E3F5EA", fg: "#1F7A45" },
  warning: { bg: "#FCF1D8", fg: "#8A6410" },
  danger: { bg: "#FDE4E7", fg: "#B3202F" },
  info: { bg: "#E2F0FB", fg: "#1D6AA8" },
  neutral: { bg: COLORS.surface, fg: COLORS.textSecondary },
};

export function toneForPhase(phase: string): Tone {
  switch (phase) {
    case "live":
      return "success";
    case "upcoming":
      return "info";
    case "ended":
      return "warning";
    case "closed":
      return "danger";
    default:
      return "neutral";
  }
}

export function toneForAttendance(status: string): Tone {
  switch (status) {
    case "present":
      return "success";
    case "late":
      return "warning";
    case "absent":
      return "danger";
    case "excused":
      return "info";
    default:
      return "neutral";
  }
}

type Props = { label: string; tone?: Tone };

export default function StatusBadge({ label, tone = "neutral" }: Props) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
});
