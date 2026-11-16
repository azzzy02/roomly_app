# Roomly Security Specification

## 1. Data Invariants

1. **Authentication Gate**: Unauthenticated requests (`request.auth == null`) and unverified email accounts (`request.auth.token.email_verified != true`) are denied all read and write access across the entire database.
2. **PII Isolation**: `/users/{userId}` contains `email` (PII). Only the owner (`request.auth.uid == userId`) can `get`, `create`, or `update` their own profile. Collection listing on `/users` is strictly denied (`allow list: if false`).
3. **Room Isolation & Non-Enumeration**: Collection listing on `/rooms` is denied (`allow list: if false`) so users cannot scrape or enumerate rooms. Rooms are addressed solely via deterministic 64-char hex SHA-256 IDs (`^[a-f0-9]{64}$`). Room metadata is immutable after creation.
4. **Master Gate Membership**: Only users with an active membership document at `/rooms/{roomId}/members/{request.auth.uid}` may read (`get` or `list`) or create messages in `/rooms/{roomId}/messages`.
5. **Identity Integrity**: Users can only create or delete membership records for their own UID (`memberId == request.auth.uid`) and can only send messages with `senderId == request.auth.uid`.
6. **Message Immutability & Bounds**: Messages cannot be updated or deleted once created. Message text must be 1–2000 characters and contain non-whitespace characters (`text.trim().size() >= 1`).
7. **Temporal Integrity**: All `createdAt`, `updatedAt`, `joinedAt`, `lastVisitedAt`, and `lastMessageAt` fields must equal `request.time` on creation/update and cannot be forged to past or future timestamps.
8. **Server-Side Rate Limiting**: Every message creation must atomically update `/rooms/{roomId}/members/{uid}.lastMessageAt` to `request.time` (enforced via `getAfter()`), and the server verifies at least 500ms has elapsed since the previous `lastMessageAt`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unauthenticated Room Read**: Unauthenticated client requests `get(/rooms/<roomId>)`. Expected: `PERMISSION_DENIED`.
2. **User PII Theft**: User B (`uid: "userB"`) attempts `get(/users/userA)` to read User A's email. Expected: `PERMISSION_DENIED`.
3. **Room Enumeration**: User A attempts `list(/rooms)` to scrape all room names. Expected: `PERMISSION_DENIED`.
4. **Unauthorized Message Read**: User B (not a member of `room1`) attempts `list(/rooms/room1/messages)`. Expected: `PERMISSION_DENIED`.
5. **Sender Impersonation**: User B (member of `room1`) creates a message with `senderId: "userA"`. Expected: `PERMISSION_DENIED`.
6. **Cross-Room Message Injection**: User B creates a message under `/rooms/room1/messages/msg1` with `roomId: "room2"`. Expected: `PERMISSION_DENIED`.
7. **Shadow / Ghost Field Injection**: User A creates a message including `{ ..., isAdmin: true }` or updates `/users/userA` with `{ role: "admin" }`. Expected: `PERMISSION_DENIED`.
8. **Forged Server Timestamp**: User A creates a message with `createdAt: Timestamp(2020-01-01)`. Expected: `PERMISSION_DENIED`.
9. **Oversized Payload / Denial of Wallet**: User A creates a message with a 2001-character string, or creates a room with a 1500-char ID. Expected: `PERMISSION_DENIED`.
10. **Whitespace-Only Message**: User A creates a message with `text: "   \n\t  "`. Expected: `PERMISSION_DENIED`.
11. **Message Tampering / Deletion**: User A attempts to `update` or `delete` their own sent message in `/rooms/room1/messages/msg1`. Expected: `PERMISSION_DENIED`.
12. **Cooldown Bypass / Missing Atomic Update**: User A creates a message without updating `members/userA.lastMessageAt` in the same batch, or sends two messages within 500ms. Expected: `PERMISSION_DENIED`.
