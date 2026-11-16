import { validateRoomName } from '@/src/utils/validation';

export function formatMessageTime(date: Date | null): string {
  if (!date) return 'Sending...';
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeVisit(date: Date | null): string {
  if (!date) return 'Just now';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function getDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaySeparatorLabel(date: Date): string {
  const now = new Date();
  const todayKey = getDayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = getDayKey(yesterday);
  const targetKey = getDayKey(date);

  if (targetKey === todayKey) return 'Today';
  if (targetKey === yesterdayKey) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}

export function getInitials(name: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return Array.from(parts[0]).slice(0, 2).join('').toUpperCase();
  }
  const first = Array.from(parts[0])[0] || '';
  const last = Array.from(parts[parts.length - 1])[0] || '';
  return (first + last).toUpperCase();
}

const AVATAR_TONES = [
  'bg-indigo-600 text-indigo-50',
  'bg-sky-600 text-sky-50',
  'bg-violet-600 text-violet-50',
  'bg-teal-600 text-teal-50',
  'bg-amber-600 text-amber-50',
  'bg-rose-600 text-rose-50',
  'bg-emerald-600 text-emerald-50',
];

export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function buildRoomInviteUrl(roomName: string): string {
  const url = new URL(window.location.origin);
  url.pathname = '/';
  url.searchParams.set('room', roomName);
  return url.toString();
}

export interface ParsedInviteParam {
  present: boolean;
  valid: boolean;
  roomName: string;
  error?: string;
}

export function parseRoomInviteFromSearch(search: string): ParsedInviteParam {
  try {
    const params = new URLSearchParams(search);
    if (!params.has('room')) {
      return { present: false, valid: false, roomName: '' };
    }
    const raw = params.get('room') ?? '';
    const validation = validateRoomName(raw);
    if (!validation.valid) {
      return {
        present: true,
        valid: false,
        roomName: '',
        error: 'The invitation link contains an invalid room name.',
      };
    }
    return {
      present: true,
      valid: true,
      roomName: validation.displayName,
    };
  } catch {
    return {
      present: true,
      valid: false,
      roomName: '',
      error: 'The invitation link could not be parsed.',
    };
  }
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

export function formatRoomCreatedDate(date: Date | null): string {
  if (!date) return 'Just now';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

