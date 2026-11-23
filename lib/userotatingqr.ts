import { useEffect, useMemo, useState } from 'react';
import { buildQRPayload } from './qr';
import { WINDOW_SECONDS, currentWindow } from './qrwindow';

type EventInfo = { eventId: string; title: string; start?: string; end?: string };

export function useRotatingQR(event: EventInfo | null) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const w = currentWindow(now);

  const payload = useMemo(
    () => (event ? buildQRPayload(event, { rotating: true, now }) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [event?.eventId, event?.title, event?.start, event?.end, w]
  );

  const secondsLeft = WINDOW_SECONDS - Math.floor((now / 1000) % WINDOW_SECONDS);

  return { payload, secondsLeft };
}