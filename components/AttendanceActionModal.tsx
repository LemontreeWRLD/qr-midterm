import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "@/constants/colors";
import {
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@/lib/attendance";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  current: AttendanceStatus | null;
  busy?: boolean;
  onSelectStatus: (s: AttendanceStatus) => void;
  onDelete: () => void;
  onClose: () => void;
};

// Admin-only sheet for correcting an attendance record.
export default function AttendanceActionModal({
  visible,
  title,
  subtitle,
  current,
  busy,
  onSelectStatus,
  onDelete,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <Text style={styles.section}>Correct status</Text>
          <View style={styles.row}>
            {ATTENDANCE_STATUSES.map((s) => (
              <Pressable
                key={s}
                disabled={busy}
                onPress={() => onSelectStatus(s)}
                style={[styles.chip, current === s && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, current === s && styles.chipTextActive]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable disabled={busy} style={styles.delete} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete this record</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textSecondary },
  section: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginTop: 12,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    textTransform: "capitalize",
  },
  chipTextActive: { color: COLORS.textOnPrimary },
  delete: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteText: { color: COLORS.danger, fontWeight: "700", fontSize: 15 },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: COLORS.textSecondary, fontWeight: "600", fontSize: 15 },
});
