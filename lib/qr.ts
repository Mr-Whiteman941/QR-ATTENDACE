import { checkWindow, currentWindow, signWindow } from './qrwindow';

// Deterrent only (ships inside the app). Change it to your own string.
const QR_SECRET = 'pepito-qr-att-9X2kLm47';

export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
  /** Rotating-QR fields (only present when rotating is enabled). */
  w?: number;
  h?: string;
};

export function buildQRPayload(
  event: { eventId: string; title: string; start?: string; end?: string },
  options?: { rotating?: boolean; now?: number }
): string {
  const payload: QRPayload = { v: 1, event: event.eventId };

  if (event.title) payload.title = event.title;
  if (event.start) payload.start = event.start;
  if (event.end) payload.end = event.end;

  if (options?.rotating) {
    const w = currentWindow(options.now ?? Date.now());
    payload.w = w;
    payload.h = signWindow(event.eventId, w, QR_SECRET);
  }

  return JSON.stringify(payload);
}

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function parseQRPayload(raw: string): ParseQRResult {
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (!parsed || parsed.v !== 1 || typeof parsed.event !== 'string' || !parsed.event) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  // Rotating QR: if it carries a time window, it must be fresh and signed.
  // (Old static QR codes without "w" are still accepted.)
  if (parsed.w !== undefined || parsed.h !== undefined) {
    const check = checkWindow(parsed.event, parsed.w, parsed.h, QR_SECRET);
    if (!check.ok) return { ok: false, message: check.reason };
  }

  return { ok: true, payload: parsed as QRPayload };
}