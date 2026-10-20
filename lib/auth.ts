import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { getProfile, type Profile, type Role } from './profiles';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  /** Role of the signed-in user. null = signed out OR profile still loading. */
  role: Role | null;
  profileLoading: boolean;
};

// ---- Global auth store (pub/sub) -------------------------------------
// EVENT: auth state changes -> every subscribed screen re-renders.
let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalProfile: Profile | null = null;
let globalLoading = false;
let globalProfileLoading = false;
const listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  if (!session) {
    globalProfile = null;
    globalProfileLoading = false;
  }
  globalLoading = false;
  notify();
}

export async function refreshProfile(): Promise<Profile | null> {
  if (!globalUser) return null;
  globalProfileLoading = true;
  notify();
  const p = await getProfile(globalUser.id);
  globalProfile = p;
  globalProfileLoading = false;
  notify();
  return p;
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
    profile: globalProfile,
    role: globalProfile?.role ?? null,
    profileLoading: globalProfileLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher';
  id_number?: string;
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  // The name / role / id number travel as sign-up metadata. The database
  // trigger `handle_new_user` copies them into `profiles` and whitelists
  // the role (student or teacher only - never admin).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile?.full_name ?? '',
        role: profile?.role ?? 'student',
        id_number: profile?.id_number ?? '',
      },
    },
  });
  if (!error && data.session) {
    setAuth(data.session);
    await refreshProfile();
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) {
    return { data, error };
  }

  // Deactivated accounts (admin-controlled) are not allowed in.
  const profile = await getProfile(data.session.user.id);
  if (profile && profile.is_active === false) {
    supabase.auth.signOut().catch(() => {});
    return {
      data,
      error: {
        name: 'AccountDisabled',
        message: 'This account has been deactivated. Contact your administrator.',
      } as { name: string; message: string },
    };
  }

  setAuth(data.session);
  await refreshProfile();
  return { data, error: null };
}

export async function signOut() {
  // Clear local state first so the UI reacts immediately,
  // then revoke the session on the server in the background.
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
