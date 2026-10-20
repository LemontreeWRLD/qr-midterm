import { supabase } from './supabase';
import { cleanText, normalizeEventCode } from './validation';
import type { Role } from './profiles';

export type EventStatus = 'open' | 'closed';

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  description: string | null;
  venue: string | null;
  start_time: string | null;
  end_time: string | null;
  status: EventStatus;
  created_by: string | null;
  created_at: string;
};

export type EventInput = {
  eventCode: string;
  title: string;
  description: string;
  venue: string;
  start: Date;
  end: Date;
};

export type EventResult = { error: string | null; event?: CloudEvent };

function friendlyError(err: { code?: string; message: string }): string {
  if (err.code === '23505') return 'That event code is already in use.';
  if (err.code === '42501' || /row-level security/i.test(err.message)) {
    return 'You are not allowed to do that.';
  }
  if (err.code === '23514') return 'Some event details are not valid.';
  return err.message;
}

export function isEventLive(e: CloudEvent, now = Date.now()): boolean {
  if (e.status !== 'open') return false;
  if (e.start_time && now < new Date(e.start_time).getTime()) return false;
  if (e.end_time && now > new Date(e.end_time).getTime()) return false;
  return true;
}

export function eventPhase(
  e: CloudEvent,
  now = Date.now()
): 'closed' | 'upcoming' | 'live' | 'ended' {
  if (e.status === 'closed') return 'closed';
  if (e.start_time && now < new Date(e.start_time).getTime()) return 'upcoming';
  if (e.end_time && now > new Date(e.end_time).getTime()) return 'ended';
  return 'live';
}

// CREATE ---------------------------------------------------------------
export async function createEvent(
  userId: string,
  input: EventInput
): Promise<EventResult> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      event_code: normalizeEventCode(input.eventCode),
      title: cleanText(input.title),
      description: input.description.trim() || null,
      venue: cleanText(input.venue),
      start_time: input.start.toISOString(),
      end_time: input.end.toISOString(),
      status: 'open',
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) return { error: friendlyError(error) };
  return { error: null, event: data as CloudEvent };
}

// UPDATE (event code is the QR identity, so it is never edited) ----------
export async function updateEvent(
  id: string,
  input: Omit<EventInput, 'eventCode'>
): Promise<EventResult> {
  const { data, error } = await supabase
    .from('events')
    .update({
      title: cleanText(input.title),
      description: input.description.trim() || null,
      venue: cleanText(input.venue),
      start_time: input.start.toISOString(),
      end_time: input.end.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return { error: friendlyError(error) };
  if (!data) return { error: 'You are not allowed to edit this event.' };
  return { error: null, event: data as CloudEvent };
}

// CLOSE / REOPEN ----------------------------------------------------------
export async function setEventStatus(
  id: string,
  status: EventStatus
): Promise<EventResult> {
  const { data, error } = await supabase
    .from('events')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return { error: friendlyError(error) };
  if (!data) return { error: 'You are not allowed to change this event.' };
  return { error: null, event: data as CloudEvent };
}

// DELETE (admin only - enforced by RLS) -----------------------------------
export async function deleteEvent(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from('events')
    .delete()
    .eq('id', id)
    .select('id');
  if (error) return { error: friendlyError(error) };
  if (!data || data.length === 0) {
    return { error: 'Only an administrator can delete events.' };
  }
  return { error: null };
}

// READ --------------------------------------------------------------------
export async function getEventById(id: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as CloudEvent;
}

export async function lookupEventByCode(
  code: string
): Promise<{ event: CloudEvent | null; failed: boolean }> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();
  if (error) return { event: null, failed: true };
  return { event: (data as CloudEvent | null) ?? null, failed: false };
}

export async function getEventByCode(code: string): Promise<CloudEvent | null> {
  return (await lookupEventByCode(code)).event;
}

/** Events a student can still attend: open and not yet ended. */
export async function getAvailableEvents(): Promise<CloudEvent[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'open')
    .or(`end_time.is.null,end_time.gte.${nowIso}`)
    .order('start_time', { ascending: true });
  if (error || !data) return [];
  return data as CloudEvent[];
}

/** Teacher: their own events. Admin: every event. */
export async function getManagedEvents(
  userId: string,
  role: Role
): Promise<CloudEvent[]> {
  let q = supabase
    .from('events')
    .select('*')
    .order('start_time', { ascending: false });
  if (role !== 'admin') q = q.eq('created_by', userId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as CloudEvent[];
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  return getManagedEvents(teacherId, 'teacher');
}
