import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import { COLORS } from "@/constants/colors";
import { fmtDateTime } from "@/lib/format";

type Props = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
};

// Android shows two native dialogs (date, then time); iOS shows one
// spinner with a Done button.
export default function DateTimeField({ label, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [part, setPart] = useState<"date" | "time">("date");

  const close = () => {
    setOpen(false);
    setPart("date");
  };

  const onPick = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === "dismissed") {
      close();
      return;
    }
    if (!selected) return;

    if (Platform.OS === "android") {
      const next = new Date(value);
      if (part === "date") {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate()
        );
        onChange(next);
        setPart("time");
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        onChange(next);
        close();
      }
    } else {
      onChange(selected);
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.input}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={styles.value}>{fmtDateTime(value)}</Text>
      </Pressable>

      {open && (
        <View>
          <DateTimePicker
            key={part}
            value={value}
            mode={Platform.OS === "android" ? part : "datetime"}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onPick}
          />
          {Platform.OS === "ios" && (
            <Pressable style={styles.done} onPress={close}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  value: { fontSize: 16, color: COLORS.textPrimary },
  done: { alignSelf: "flex-end", padding: 8 },
  doneText: { color: COLORS.primary, fontWeight: "700", fontSize: 16 },
});
