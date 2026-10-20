export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

// The QR only needs to carry the event CODE. Title / times are always
// re-read from the database when a student scans, so a forged QR can
// never change an event's time window or status.
export function buildQRPayload(event: { eventId: string }): string {
  const payload: QRPayload = { v: 1, event: event.eventId };
  return JSON.stringify(payload);
}

export function parseQRPayload(raw: string): ParseQRResult {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1000) {
    return { ok: false, message: 'Invalid QR code.' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.v !== 1 ||
    typeof parsed.event !== 'string' ||
    !parsed.event ||
    parsed.event.length > 60
  ) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  return { ok: true, payload: parsed as QRPayload };
}
