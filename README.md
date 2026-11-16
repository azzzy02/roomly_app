# Roomly — Real-Time Multiplayer Chat

Roomly is a real-time multiplayer messaging web application built with React, TypeScript, Vite, Tailwind CSS, Firebase Authentication (Google Sign-In), Cloud Firestore, and Firebase Cloud Functions.

## Features

- Google sign-in with unique, case-insensitive usernames
- Rooms are created or joined by name; the same name always maps to the same room
- Live messaging through Firestore listeners
- Recent rooms list that survives leaving a room or signing out
- Only the room creator can delete a room, enforced server-side

## Data model

| Path | Purpose |
| --- | --- |
| `usernames/{normalizedUsername}` | Username reservation, claimed and swapped in a transaction |
| `users/{uid}` | Profile. Readable only by its owner |
| `users/{uid}/recentRooms/{roomId}` | Per-user room history, independent of membership |
| `rooms/{roomId}` | Room, keyed by the SHA-256 hash of its normalized name. Clients cannot delete it |
| `rooms/{roomId}/members/{uid}` | Active participants and their role |
| `rooms/{roomId}/messages/{messageId}` | Messages, ordered by server timestamp and immutable once sent |

Access rules live in `firestore.rules`. Roles are checked against `rooms/{roomId}.createdBy`.

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
