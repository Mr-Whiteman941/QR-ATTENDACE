/**
 * Rotating, time-limited QR codes.
 * The teacher's screen re-generates the QR every WINDOW_SECONDS, so a
 * screenshot shared with an absent classmate stops working within seconds.
 *
 * NOTE: the hash is a lightweight deterrent, not real cryptography (the
 * secret ships inside the app). For strong guarantees, verify on the server
 * (a Supabase edge function / RPC).
 */
export const WINDOW_SECONDS = 30;

function hash(input: string): string {
  const run = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return run(2166136261) + run(84696351);
}

export function currentWindow(now = Date.now(), size = WINDOW_SECONDS): number {
  return Math.floor(now / 1000 / size);
}

export function signWindow(sessionId: string, w: number, secret: string): string {
  return hash(`${sessionId}|${w}|${secret}`);
}

export type VerifyResult = { ok: true } | { ok: false; reason: string };

/** Check a window number + signature. tolerance allows for clock drift. */
export function checkWindow(
  sessionId: string,
  w: unknown,
  h: unknown,
  secret: string,
  now = Date.now(),
  tolerance = 2
): VerifyResult {
  if (typeof w !== 'number' || typeof h !== 'string') {
    return { ok: false, reason: 'Invalid QR code.' };
  }
  if (Math.abs(w - currentWindow(now)) > tolerance) {
    return { ok: false, reason: 'This QR code has expired. Scan the live one on the teacher\'s screen.' };
  }
  if (h !== signWindow(sessionId, w, secret)) {
    return { ok: false, reason: 'Invalid QR code.' };
  }
  return { ok: true };
}