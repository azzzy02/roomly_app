import { ERROR_MESSAGES } from '@/src/utils/errorHandling';

export const ROOM_NAME_MIN_LENGTH = 1;
export const ROOM_NAME_MAX_LENGTH = 40;
export const DISPLAY_NAME_MIN_LENGTH = 2;
export const DISPLAY_NAME_MAX_LENGTH = 24;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_COOLDOWN_MS = 800;

export interface RoomValidationResult {
  valid: boolean;
  displayName: string;
  normalizedName: string;
  error?: string;
}

export interface DisplayNameValidationResult {
  valid: boolean;
  trimmed: string;
  error?: string;
}

export interface UsernameValidationResult {
  valid: boolean;
  username: string;
  normalizedUsername: string;
  error?: string;
}

export interface MessageValidationResult {
  valid: boolean;
  trimmed: string;
  error?: string;
}

export function normalizeUsername(raw: string): { username: string; normalizedUsername: string } {
  const username = raw.normalize('NFKC').trim();
  const normalizedUsername = username.toLowerCase();
  return { username, normalizedUsername };
}

export function validateUsername(raw: string): UsernameValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, username: '', normalizedUsername: '', error: 'Please enter a username.' };
  }

  const { username, normalizedUsername } = normalizeUsername(raw);

  if (username.length === 0) {
    return { valid: false, username, normalizedUsername, error: 'Username cannot be empty.' };
  }

  if (username.length < USERNAME_MIN_LENGTH) {
    return {
      valid: false,
      username,
      normalizedUsername,
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`,
    };
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return {
      valid: false,
      username,
      normalizedUsername,
      error: `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (!USERNAME_REGEX.test(username)) {
    return {
      valid: false,
      username,
      normalizedUsername,
      error: 'Use only letters, numbers, underscores, periods, or hyphens.',
    };
  }

  if (normalizedUsername === 'legacy' || normalizedUsername === 'admin' || normalizedUsername === 'system') {
    return {
      valid: false,
      username,
      normalizedUsername,
      error: 'This username is reserved.',
    };
  }

  return { valid: true, username, normalizedUsername };
}

export function normalizeRoomInput(raw: string): { displayName: string; normalizedName: string } {
  const displayName = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const normalizedName = displayName.toLowerCase();
  return { displayName, normalizedName };
}

export function validateRoomName(raw: string): RoomValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, displayName: '', normalizedName: '', error: ERROR_MESSAGES.empty_room };
  }

  const { displayName, normalizedName } = normalizeRoomInput(raw);

  if (displayName.length < ROOM_NAME_MIN_LENGTH) {
    return { valid: false, displayName, normalizedName, error: ERROR_MESSAGES.empty_room };
  }

  if (displayName.length > ROOM_NAME_MAX_LENGTH || normalizedName.length > ROOM_NAME_MAX_LENGTH) {
    return {
      valid: false,
      displayName,
      normalizedName,
      error: `Room name must be ${ROOM_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  // Reject control characters
  if (/[\u0000-\u001F\u007F]/.test(displayName)) {
    return { valid: false, displayName, normalizedName, error: ERROR_MESSAGES.invalid_room };
  }

  return { valid: true, displayName, normalizedName };
}

export function validateDisplayName(raw: string): DisplayNameValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, trimmed: '', error: 'Please enter a display name.' };
  }

  const trimmed = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');

  if (trimmed.length === 0) {
    return { valid: false, trimmed, error: 'Display name cannot be empty.' };
  }

  if (trimmed.length < DISPLAY_NAME_MIN_LENGTH) {
    return {
      valid: false,
      trimmed,
      error: `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters.`,
    };
  }

  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    return {
      valid: false,
      trimmed,
      error: `Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    };
  }

  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return { valid: false, trimmed, error: 'Display name contains unsupported characters.' };
  }

  return { valid: true, trimmed };
}

export function sanitizeInitialDisplayName(
  googleDisplayName: string | null | undefined,
  email: string | null | undefined
): string {
  const candidate = (googleDisplayName || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (candidate.length >= DISPLAY_NAME_MIN_LENGTH) {
    return candidate.slice(0, DISPLAY_NAME_MAX_LENGTH).trim();
  }

  const emailPrefix = (email || '').split('@')[0]?.trim().replace(/\s+/g, ' ') || '';
  if (emailPrefix.length >= DISPLAY_NAME_MIN_LENGTH) {
    return emailPrefix.slice(0, DISPLAY_NAME_MAX_LENGTH).trim();
  }

  return 'Roomly Member';
}

export function sanitizePhotoUrl(photoURL: string | null | undefined): string {
  if (!photoURL) return '';
  const trimmed = photoURL.trim();
  if (trimmed.length > 500) return '';
  return trimmed;
}

export function validateMessageText(raw: string): MessageValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, trimmed: '', error: ERROR_MESSAGES.empty_message };
  }

  // Trim outer whitespace while preserving internal newlines and spacing
  const trimmed = raw.trim();

  if (trimmed.length < MESSAGE_MIN_LENGTH) {
    return { valid: false, trimmed, error: ERROR_MESSAGES.empty_message };
  }

  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { valid: false, trimmed, error: ERROR_MESSAGES.message_too_long };
  }

  return { valid: true, trimmed };
}

export function isValidRoomIdFormat(roomId: string | undefined | null): roomId is string {
  return typeof roomId === 'string' && /^[a-f0-9]{64}$/.test(roomId);
}

/**
 * Pure TypeScript SHA-256 fallback for environments lacking crypto.subtle
 */
function sha256Fallback(ascii: string): string {
  const bytes = new TextEncoder().encode(ascii);
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return Array.from(hash)
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export async function computeRoomId(normalizedName: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const data = new TextEncoder().encode(normalizedName);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return sha256Fallback(normalizedName);
    }
  }
  return sha256Fallback(normalizedName);
}

export function createUniqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const rand = Math.random().toString(36).slice(2, 10);
  return `msg_${Date.now().toString(36)}_${rand}`;
}
