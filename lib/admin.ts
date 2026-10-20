import { supabase } from './supabase';
import type { Profile, Role } from './profiles';

export type SystemStats = {
  users: number;
  students: number;
  teachers: number;
  admins: number;
  events: number;
  openEvents: number;
  attendance: number;
  attendanceToday: number;
};

export type AuditLog = {
  id: string;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
};

async function count(
  table: string,
  apply?: (q: any) => any
): Promise<number> {
  let q: any = supabase.from(table).select('*', { count: 'exact', head: true });
  if (apply) q = apply(q);
  const { count: c } = await q;
  return c ?? 0;
}

export async function getSystemStats(): Promise<SystemStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [users, students, teachers, admins, events, openEvents, attendance, today] =
    await Promise.all([
      count('profiles'),
      count('profiles', (q) => q.eq('role', 'student')),
      count('profiles', (q) => q.eq('role', 'teacher')),
      count('profiles', (q) => q.eq('role', 'admin')),
      count('events'),
      count('events', (q) => q.eq('status', 'open')),
      count('attendance'),
      count('attendance', (q) => q.gte('scanned_at', startOfDay.toISOString())),
    ]);

  return {
    users,
    students,
    teachers,
    admins,
    events,
    openEvents,
    attendance,
    attendanceToday: today,
  };
}

export async function getAllUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, id_number, department, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as Profile[];
}

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Update was not allowed.' };
  return { error: null };
}

export async function setUserActive(
  userId: string,
  active: boolean
): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: active })
    .eq('id', userId)
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Update was not allowed.' };
  return { error: null };
}

// Fire-and-forget: a failed log must never block the real action.
export function logAction(
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  details?: string
) {
  supabase
    .from('audit_logs')
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      details: details ?? null,
    })
    .then(() => {}, () => {});
}

export async function getAuditLogs(limit = 100): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, actor_id, action, target_type, target_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const ids = [...new Set((data as any[]).map((r) => r.actor_id).filter(Boolean))];
  const names: Record<string, string | null> = {};
  if (ids.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', ids);
    ((profs as any[] | null) ?? []).forEach((p) => {
      names[p.id] = p.full_name || p.email || null;
    });
  }

  return (data as any[]).map((r) => ({
    id: r.id,
    actorName: r.actor_id ? names[r.actor_id] ?? null : null,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details,
    createdAt: r.created_at,
  }));
}
