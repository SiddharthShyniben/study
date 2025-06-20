"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendScheduledNotification = exports.sendTestNotification = void 0;
const https_1 = require("firebase-functions/v2/https");
const messaging_1 = require("firebase-admin/messaging");
const firestore_1 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const messaging = (0, messaging_1.getMessaging)();
exports.sendTestNotification = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { title, body, userId } = request.data;
    if (!title || !body) {
        throw new https_1.HttpsError('invalid-argument', 'Title and body are required');
    }
    const targetUserId = userId || auth.uid;
    console.log(targetUserId);
    try {
        const userDoc = await db.collection('users').doc(targetUserId).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const fcmToken = userData === null || userData === void 0 ? void 0 : userData.fcmToken;
        if (!fcmToken) {
            throw new https_1.HttpsError('failed-precondition', 'No FCM token found for user');
        }
        const message = {
            notification: {
                title: title,
                body: body,
            },
            data: {
                type: 'test',
                timestamp: Date.now().toString(),
            },
            token: fcmToken,
        };
        const response = await messaging.send(message);
        return {
            success: true,
            messageId: response,
            sentTo: targetUserId
        };
    }
    catch (error) {
        console.error('Error sending notification:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to send notification');
    }
});
exports.sendScheduledNotification = (0, https_1.onCall)(async (request) => {
    const { auth } = request;
    if (!auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { userId, notificationType } = request.data;
    const targetUserId = userId || auth.uid;
    try {
        const userDoc = await db.collection('users').doc(targetUserId).get();
        if (!userDoc.exists) {
            throw new https_1.HttpsError('not-found', 'User not found');
        }
        const userData = userDoc.data();
        const fcmToken = userData === null || userData === void 0 ? void 0 : userData.fcmToken;
        if (!fcmToken) {
            throw new https_1.HttpsError('failed-precondition', 'No FCM token found for user');
        }
        let title = '';
        let body = '';
        switch (notificationType) {
            case 'review_reminder':
                title = 'Time to Review!';
                body = 'You have items ready for review';
                break;
            case 'daily_summary':
                title = 'Daily Summary';
                body = 'Check your progress for today';
                break;
            default:
                title = 'Notification';
                body = 'You have a new update';
        }
        const message = {
            notification: {
                title: title,
                body: body,
            },
            data: {
                type: notificationType,
                timestamp: Date.now().toString(),
            },
            token: fcmToken,
        };
        const response = await messaging.send(message);
        return {
            success: true,
            messageId: response,
            sentTo: targetUserId,
            type: notificationType
        };
    }
    catch (error) {
        console.error('Error sending scheduled notification:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to send notification');
    }
});
//# sourceMappingURL=sendTestNotification.js.map