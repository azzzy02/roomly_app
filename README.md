# Roomly — Real-Time Multiplayer Chat

Roomly is a real-time multiplayer messaging web application built with React, TypeScript, Vite, Tailwind CSS, Firebase Authentication (Google Sign-In), Cloud Firestore, and Firebase Cloud Functions.

## Architecture & Data Model

- `/usernames/{normalizedUsername}` — Globally unique case-insensitive username reservations (`uid`, `username`, `normalizedUsername`, `createdAt`), claimed and swapped atomically inside Firestore transactions.
- `/users/{uid}` — Owner-isolated user profiles (`uid`, `displayName`, `username`, `email`, `photoURL`, `createdAt`, `updatedAt`). Emails are strictly isolated to the account owner and masked in account settings.
- `/users/{uid}/recentRooms/{roomId}` — User-scoped persistent room history decoupled from active room membership (`roomId`, `roomName`, `ownerUid`, `ownerUsername`, `role`, `lastVisitedAt`, `lastReadAt`, `createdAt`). Leaving a room, navigating home, or signing out never deletes this history.
- `/rooms/{roomId}` — Chat rooms keyed by deterministic SHA-256 hash of the normalized room name (`roomId`, `name`, `normalizedName`, `createdBy`, `createdByUsername`, `createdByDisplayName`, `createdAt`, `status`). Direct client deletion is denied.
- `/rooms/{roomId}/members/{uid}` — Active room participation records (`uid`, `roomId`, `displayName`, `username`, `photoURL`, `role`, `joinedAt`, `lastMessageAt`). Roles are strictly validated against `rooms/{roomId}.createdBy` in Firestore Security Rules.
- `/rooms/{roomId}/messages/{messageId}` — Immutable room messages (`messageId`, `roomId`, `senderId`, `senderName`, `senderUsername`, `senderPhotoURL`, `text`, `createdAt`) ordered by `serverTimestamp()`.

## Running Locally

1. Install frontend dependencies:
   ```bash
   npm install
   ```
2. Verify TypeScript & Vite build:
   ```bash
   npm run lint
   npm run build
   ```
3. Lint Firestore security rules:
   ```bash
   npx eslint firestore.rules
   ```
4. Start the development server on port 3000:
   ```bash
   npm run dev
   ```

## Deploying Cloud Functions (`deleteRoom`)

Permanent room deletion runs exclusively through the `deleteRoom` callable Cloud Function (`functions/src/index.ts`) using the Firebase Admin SDK so only the original creator (`room.createdBy === request.auth.uid`) can cascade-delete messages, memberships, `recentRooms` references, and the room document.

To deploy `deleteRoom` to Firebase:
```bash
firebase login
firebase use sixth-timer-rv0ns
cd functions && npm install && npm run build && cd ..
firebase deploy --only functions
```
