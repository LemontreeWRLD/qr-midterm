import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";

import AppButton from "@/components/AppButton";
import DateTimeField from "@/components/DateTimeField";
import StateView from "@/components/StateView";
import { COLORS } from "@/constants/colors";
import { logAction } from "@/lib/admin";
import { useAuth } from "@/lib/auth";
import {
  createEvent,
  getEventById,
  updateEvent,
  type CloudEvent,
} from "@/lib/events";
import { normalizeEventCode, validateEventForm } from "@/lib/validation";

function suggestCode() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EVT-${new Date().getFullYear()}-${rand}`;
}

export default function EventFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const { user, role } = useAuth();
  const isStaff = role === "teacher" || role === "admin";

  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [original, setOriginal] = useState<CloudEvent | null>(null);

  const [title, setTitle] = useState("");
  const [eventCode, setEventCode] = useState(editing ? "" : suggestCode());
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState(new Date());
  const [end, setEnd] = useState(new Date(Date.now() + 60 * 60 * 1000));

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit mode: load the existing event once
  useEffect(() => {
    if (!editing || !id) return;
    let active = true;
    getEventById(id).then((e) => {
      if (!active) return;
      if (!e) {
        setLoadError("This event could not be found.");
      } else {
        setOriginal(e);
        setTitle(e.title);
        setEventCode(e.event_code);
        setVenue(e.venue ?? "");
        setDescription(e.description ?? "");
        if (e.start_time) setStart(new Date(e.start_time));
        if (e.end_time) setEnd(new Date(e.end_time));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [editing, id]);

  if (!isStaff) {
    return (
      <StateView
        kind="locked"
        title="Teachers and administrators only"
        message="Your account is not allowed to create or edit events."
      />
    );
  }
  if (loading) return <StateView kind="loading" title="Loading event..." />;
  if (loadError) return <StateView kind="error" title={loadError} />;

  const applyQuickDuration = (minutes: number) =>
    setEnd(new Date(start.getTime() + minutes * 60 * 1000));

  // EVENT: Save pressed -> validate -> insert/update -> navigate
  const handleSave = async () => {
    setError(null);
    const problem = validateEventForm({
      title,
      eventCode,
      venue,
      description,
      start,
      end,
    });
    if (problem) {
      setError(problem);
      return;
    }
    if (!user) return;

    setSaving(true);
    try {
      if (editing && id) {
        const res = await updateEvent(id, { title, description, venue, start, end });
        if (res.error || !res.event) {
          setError(res.error ?? "Could not save the event.");
          return;
        }
        logAction(user.id, "event.update", "event", id, res.event.title);
        router.replace(`/event/${id}`);
      } else {
        const res = await createEvent(user.id, {
          eventCode,
          title,
          description,
          venue,
          start,
          end,
        });
        if (res.error || !res.event) {
          setError(res.error ?? "Could not create the event.");
          return;
        }
        logAction(user.id, "event.create", "event", res.event.id, res.event.title);
        router.replace(`/event/${res.event.id}`);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: editing ? "Edit Event" : "New Event" }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.label}>Event Name *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Founders Day Assembly"
          placeholderTextColor={COLORS.muted}
          maxLength={120}
          editable={!saving}
        />

        <Text style={styles.label}>Event Code *</Text>
        <View style={styles.codeRow}>
          <TextInput
            style={[styles.input, styles.codeInput, editing && styles.disabled]}
            value={eventCode}
            onChangeText={(t) => setEventCode(normalizeEventCode(t))}
            placeholder="EVT-2026-0001"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            editable={!editing && !saving}
          />
          {!editing && (
            <Pressable style={styles.genButton} onPress={() => setEventCode(suggestCode())}>
              <Text style={styles.genText}>Generate</Text>
            </Pressable>
          )}
        </View>
        {editing && (
          <Text style={styles.hint}>
            The code is printed in the QR, so it cannot be changed.
          </Text>
        )}

        <Text style={styles.label}>Venue *</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="School Gymnasium"
          placeholderTextColor={COLORS.muted}
          maxLength={120}
          editable={!saving}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this event about?"
          placeholderTextColor={COLORS.muted}
          multiline
          maxLength={500}
          editable={!saving}
        />

        <DateTimeField label="Start (date & time) *" value={start} onChange={setStart} />
        <DateTimeField label="End (date & time) *" value={end} onChange={setEnd} />

        <View style={styles.chipRow}>
          {[30, 60, 120].map((m) => (
            <Pressable key={m} style={styles.chip} onPress={() => applyQuickDuration(m)}>
              <Text style={styles.chipText}>{m < 60 ? `+${m} min` : `+${m / 60} hr`}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ marginTop: 20 }}>
          <AppButton
            theme="primary"
            title={editing ? "Save Changes" : "Create Event"}
            icon="checkmark-circle-outline"
            loading={saving}
            onPress={handleSave}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, paddingBottom: 48 },
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
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  disabled: { opacity: 0.6 },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  codeRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  codeInput: { flex: 1 },
  genButton: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  genText: { color: COLORS.primary, fontWeight: "700" },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.textPrimary },
  error: { fontSize: 14, color: COLORS.danger, marginTop: 14 },
});
