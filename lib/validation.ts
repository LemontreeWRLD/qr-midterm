// Central input-validation helpers (used by login, register, profile, events).
// Every function returns an error message string, or null when the value is OK.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,29}$/;

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Email is required.';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password is too long (max 72 characters).';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password must contain at least one letter and one number.';
  }
  return null;
}

export function validateFullName(name: string): string | null {
  const v = cleanText(name);
  if (!v) return 'Full name is required.';
  if (v.length < 2) return 'Full name is too short.';
  if (v.length > 100) return 'Full name is too long (max 100 characters).';
  return null;
}

export function validateOptionalText(
  value: string,
  label: string,
  max: number
): string | null {
  if (cleanText(value).length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return null;
}

export function normalizeEventCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '-');
}

export type EventFormValues = {
  title: string;
  eventCode: string;
  venue: string;
  description: string;
  start: Date;
  end: Date;
};

export function validateEventForm(v: EventFormValues): string | null {
  const title = cleanText(v.title);
  if (!title) return 'Event name is required.';
  if (title.length > 120) return 'Event name must be 120 characters or fewer.';
  if (!CODE_RE.test(normalizeEventCode(v.eventCode))) {
    return 'Event code must be 3-30 characters: letters, numbers, - or _.';
  }
  if (!cleanText(v.venue)) return 'Venue is required.';
  if (cleanText(v.venue).length > 120) {
    return 'Venue must be 120 characters or fewer.';
  }
  if (v.description.trim().length > 500) {
    return 'Description must be 500 characters or fewer.';
  }
  if (isNaN(v.start.getTime()) || isNaN(v.end.getTime())) {
    return 'Please pick a valid date and time.';
  }
  if (v.start.getTime() >= v.end.getTime()) {
    return 'Start time must be before end time.';
  }
  return null;
}
