"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRoom = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const app = (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)(app, 'ai-studio-99e74e83-9225-44d4-b601-b4c0607d2821');
const BATCH_LIMIT = 400;
async function deleteQueryInBatches(query) {
    let totalDeleted = 0;
    while (true) {
        const snapshot = await query.limit(BATCH_LIMIT).get();
        if (snapshot.empty) {
            break;
        }
        const batch = db.batch();
        for (const docSnap of snapshot.docs) {
            batch.delete(docSnap.ref);
        }
        await batch.commit();
        totalDeleted += snapshot.size;
        if (snapshot.size < BATCH_LIMIT) {
            break;
        }
    }
    return totalDeleted;
}
exports.deleteRoom = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    const callerUid = request.auth?.uid;
    if (!callerUid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required to delete a room.');
    }
    const roomId = typeof request.data?.roomId === 'string' ? request.data.roomId.trim() : '';
    if (!/^[a-f0-9]{64}$/.test(roomId)) {
        throw new https_1.HttpsError('invalid-argument', 'A valid roomId is required.');
    }
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
        // Idempotent cleanup of any lingering recentRooms references
        await deleteQueryInBatches(db.collectionGroup('recentRooms').where('roomId', '==', roomId));
        return { deleted: true, alreadyDeleted: true, roomId };
    }
    const roomData = roomSnap.data();
    const authoritativeOwner = roomData?.createdBy;
    if (!authoritativeOwner || authoritativeOwner === 'legacy' || authoritativeOwner !== callerUid) {
        throw new https_1.HttpsError('permission-denied', 'Only the original room creator can permanently delete this room.');
    }
    // Mark room as deleting first to stop concurrent writes and notify active listeners
    await roomRef.update({ status: 'deleting' });
    // Delete nested messages and members in batches
    await deleteQueryInBatches(roomRef.collection('messages'));
    await deleteQueryInBatches(roomRef.collection('members'));
    // Remove stale recentRooms entries across all users
    await deleteQueryInBatches(db.collectionGroup('recentRooms').where('roomId', '==', roomId));
    // Finally delete the room document itself
    await roomRef.delete();
    return {
        deleted: true,
        alreadyDeleted: false,
        roomId,
    };
});
//# sourceMappingURL=index.js.map