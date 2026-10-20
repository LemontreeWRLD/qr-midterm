import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut, refreshProfile } from '@/lib/auth';
import { ROLE_LABEL, updateProfile } from '@/lib/profiles';
import {
  cleanText,
  validateFullName,
  validateOptionalText,
} from '@/lib/validation';

export default function ProfileScreen() {
  const { user, profile, role } = useAuth();
  const router = useRouter();
  const [draftName, setDraftName] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftDept, setDraftDept] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // EVENT: tab focused -> reload profile from the database
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [])
  );

  const startEdit = () => {
    setDraftName(profile?.full_name ?? '');
    setDraftId(profile?.id_number ?? '');
    setDraftDept(profile?.department ?? '');
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const problem =
      validateFullName(draftName) ??
      validateOptionalText(draftId, 'ID number', 40) ??
      validateOptionalText(draftDept, 'Department', 80);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const { error: saveError } = await updateProfile(user.id, {
      full_name: cleanText(draftName),
      id_number: cleanText(draftId) || null,
      department: cleanText(draftDept) || null,
    });
    if (saveError) {
      setSaving(false);
      setError(saveError);
      return;
    }
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  // EVENT: user presses Logout -> handler clears session -> login screen
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to sign out.');
    } finally {
      setSigningOut(false);
    }
  };

  const idLabel =
    role === 'teacher' ? 'Employee ID' : role === 'admin' ? 'Admin ID' : 'Student ID';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>My Profile</Text>

      {role ? (
        <View
          style={[
            styles.roleBadge,
            role === 'admin' && { backgroundColor: COLORS.textPrimary },
            role === 'student' && { backgroundColor: COLORS.accent },
          ]}
        >
          <Text style={styles.roleBadgeText}>{ROLE_LABEL[role]}</Text>
        </View>
      ) : null}

      <View style={styles.infoCard}>
        {editing ? (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted}
              maxLength={100}
              editable={!saving}
            />
            <Text style={styles.label}>{idLabel}</Text>
            <TextInput
              style={styles.input}
              value={draftId}
              onChangeText={setDraftId}
              placeholder="Optional"
              placeholderTextColor={COLORS.muted}
              autoCapitalize="characters"
              maxLength={40}
              editable={!saving}
            />
            <Text style={styles.label}>Department / Section</Text>
            <TextInput
              style={styles.input}
              value={draftDept}
              onChangeText={setDraftDept}
              placeholder="e.g. BSIT 3-A"
              placeholderTextColor={COLORS.muted}
              maxLength={80}
              editable={!saving}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.editActions}>
              <Pressable
                style={[styles.smallButton, styles.cancelButton]}
                onPress={() => setEditing(false)}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.smallButton, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{profile?.full_name || 'Not set'}</Text>

            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? profile?.email}</Text>

            <Text style={styles.label}>{idLabel}</Text>
            <Text style={styles.value}>{profile?.id_number || 'Not set'}</Text>

            <Text style={styles.label}>Department / Section</Text>
            <Text style={styles.value}>{profile?.department || 'Not set'}</Text>

            <Text style={styles.label}>User ID</Text>
            <Text style={styles.valueSmall}>{user?.id}</Text>

            <Pressable onPress={startEdit} style={styles.editLink}>
              <Text style={styles.editHint}>Edit profile</Text>
            </Pressable>
          </>
        )}
      </View>

      <AppButton
        title="Sign Out"
        icon="log-out-outline"
        onPress={handleSignOut}
        loading={signingOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  roleBadgeText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
    marginTop: 10,
  },
  value: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  valueSmall: { fontSize: 11, color: COLORS.textSecondary },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  error: { fontSize: 14, color: COLORS.danger, marginTop: 12 },
  editLink: { marginTop: 16, alignSelf: 'flex-start' },
  editHint: { fontSize: 14, fontWeight: '700', color: COLORS.accent },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  smallButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saveText: { color: COLORS.textOnPrimary, fontWeight: '700', fontSize: 14 },
  cancelText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
});
