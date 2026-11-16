/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Run with Firebase Emulator Suite & @firebase/rules-unit-testing when testing against a local emulator.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  description: string;
  expectedError: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: readonly DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Room Read',
    description: 'Rejects reading a room when request.auth is null',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'User PII Theft',
    description: 'Rejects User B reading /users/userA containing email PII',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Room Enumeration',
    description: 'Rejects collection list query on /rooms',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unauthorized Message Read',
    description: 'Rejects non-member listing /rooms/{roomId}/messages',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Sender Impersonation',
    description: 'Rejects message where senderId != request.auth.uid',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Cross-Room Message Injection',
    description: 'Rejects message where data.roomId != path roomId',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow Ghost Field Injection',
    description: 'Rejects extra undocumented fields via keys().hasOnly()',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Forged Server Timestamp',
    description: 'Rejects message or room creation where createdAt != request.time',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Oversized Payload Rejection',
    description: 'Rejects message > 2000 chars or roomId != 64 hex chars',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Whitespace-Only Message Rejection',
    description: 'Rejects message where text.trim().size() == 0',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Message Tampering & Deletion',
    description: 'Rejects update or delete on existing /messages/{messageId}',
    expectedError: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cooldown Bypass & Non-Atomic Send',
    description: 'Rejects message create without atomic member lastMessageAt update or < 500ms cooldown',
    expectedError: 'PERMISSION_DENIED',
  },
];
