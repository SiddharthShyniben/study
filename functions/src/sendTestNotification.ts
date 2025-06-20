import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getMessaging } from 'firebase-admin/messaging';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

if (!getApps().length) {
	initializeApp();
}

const db = getFirestore();
const messaging = getMessaging();

export const sendTestNotification = onCall(async (request) => {
	const { auth } = request;

	if (!auth) {
		throw new HttpsError('unauthenticated', 'User must be authenticated');
	}

	const { title, body, userId } = request.data;

	if (!title || !body) {
		throw new HttpsError('invalid-argument', 'Title and body are required');
	}

	const targetUserId = userId || auth.uid;

	try {
		const userDoc = await db.collection('users').doc(targetUserId).get();

		if (!userDoc.exists) {
			throw new HttpsError('not-found', 'User not found');
		}

		const userData = userDoc.data();
		const fcmToken = userData?.fcmToken;

		if (!fcmToken) {
			throw new HttpsError('failed-precondition', 'No FCM token found for user');
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

	} catch (error) {
		console.error('Error sending notification:', error);

		if (error instanceof HttpsError) {
			throw error;
		}

		throw new HttpsError('internal', 'Failed to send notification');
	}
});

export const sendScheduledNotification = onCall(async (request) => {
	const { auth } = request;

	if (!auth) {
		throw new HttpsError('unauthenticated', 'User must be authenticated');
	}

	const { userId, notificationType } = request.data;
	const targetUserId = userId || auth.uid;

	try {
		const userDoc = await db.collection('users').doc(targetUserId).get();

		if (!userDoc.exists) {
			throw new HttpsError('not-found', 'User not found');
		}

		const userData = userDoc.data();
		const fcmToken = userData?.fcmToken;

		if (!fcmToken) {
			throw new HttpsError('failed-precondition', 'No FCM token found for user');
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

	} catch (error) {
		console.error('Error sending scheduled notification:', error);

		if (error instanceof HttpsError) {
			throw error;
		}

		throw new HttpsError('internal', 'Failed to send notification');
	}
});
