import { supabase } from './supabase';
import { scheduleSessionReminder } from './reminders';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

const REMINDER_MINUTES_BEFORE = 10;

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('events').upsert(
    {
      event_code: event.eventId,
      title: event.title,
      start_time: event.start || null,
      end_time: event.end || null,
      created_by: user?.id ?? null,
    },
    { onConflict: 'event_code' }
  );

  if (!error && event.start) {
    await scheduleReminderFor(event.eventId, event.title, event.start);
  }

  return { error: error?.message ?? null };
}

export async function scheduleReminderFor(
  eventCode: string,
  title: string,
  start: string
): Promise<void> {
  try {
    const startsAt = new Date(start);
    if (isNaN(startsAt.getTime())) return;

    await scheduleSessionReminder(
      { id: eventCode, title, startsAt },
      REMINDER_MINUTES_BEFORE
    );
  } catch (e) {
    console.warn('Could not schedule reminder:', e);
  }
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}