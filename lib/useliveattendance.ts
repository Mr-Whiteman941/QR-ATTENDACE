import { useEffect, useState } from 'react';
import { getEventAttendanceLive } from './attendance';

type Live = Awaited<ReturnType<typeof getEventAttendanceLive>>;

/** Polls the database every few seconds while an event code is set. */
export function useLiveAttendance(eventCode: string | null, intervalMs = 5000) {
  const [data, setData] = useState<Live>({ count: 0, recent: [] });

  useEffect(() => {
    if (!eventCode) {
      setData({ count: 0, recent: [] });
      return;
    }

    let active = true;

    const load = async () => {
      try {
        const result = await getEventAttendanceLive(eventCode);
        if (active) setData(result);
      } catch {
        // ignore network hiccups; the next poll will try again
      }
    };

    load();
    const id = setInterval(load, intervalMs);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [eventCode, intervalMs]);

  return data;
}