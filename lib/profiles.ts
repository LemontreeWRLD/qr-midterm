import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  id_number: string | null;
  department: string | null;
  is_active: boolean;
  created_at?: string;
};

const PROFILE_COLUMNS =
  'id, email, full_name, role, id_number, department, is_active, created_at';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

// Role / is_active are intentionally NOT editable here: the database
// trigger `protect_profile_privileges` only lets an admin change them.
export async function updateProfile(
  userId: string,
  updates: {
    full_name?: string;
    id_number?: string | null;
    department?: string | null;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message ?? null };
}

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Administrator',
};
