const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

export function fmtDateTime(iso?: string | Date | null): string {
  if (!iso) return '-';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, DATE_TIME);
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function fmtRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return 'No schedule';
  if (start && end) {
    const s = new Date(start);
    const e = new Date(end);
    const sameDay = s.toDateString() === e.toDateString();
    return sameDay
      ? `${fmtDate(start)}, ${fmtTime(start)} - ${fmtTime(end)}`
      : `${fmtDateTime(start)} - ${fmtDateTime(end)}`;
  }
  return fmtDateTime(start ?? end);
}

export function shortId(id: string): string {
  return id ? `...${id.slice(-8)}` : 'unknown';
}
