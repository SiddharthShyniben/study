import { messaging, auth, db } from './firebase';
import { getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { browser } from '$app/environment';
import { onAuthStateChanged, type User } from 'firebase/auth';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let currentUser: User | null = null;
let authListenerInitialized = false;
let messagingInitialized = false;

if (browser && !authListenerInitialized) {
	authListenerInitialized = true;
	onAuthStateChanged(auth, (user) => {
		currentUser = user;
	});
}

export const requestNotificationPermission = async (): Promise<boolean> => {
	if (!browser || !('Notification' in window)) {
		return false;
	}

	const permission = await Notification.requestPermission();
	return permission === 'granted';
};

export const registerMessagingServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
	if (!browser || !('serviceWorker' in navigator)) {
		return null;
	}

	try {
		const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
			scope: '/firebase-cloud-messaging-push-scope'
		});

		console.log('Firebase messaging service worker registered:', registration);
		return registration;
	} catch (error) {
		console.error('Failed to register Firebase messaging service worker:', error);
		return null;
	}
};

export const getFCMToken = async (): Promise<string | null> => {
	if (!browser || !messaging) {
		return null;
	}

	try {
		const registration = await registerMessagingServiceWorker();
		if (!registration) {
			console.error('No service worker registration available for FCM');
			return null;
		}

		const token = await getToken(messaging, {
			vapidKey: vapidKey,
			serviceWorkerRegistration: registration
		});


		if (token && currentUser) {
			await saveFCMToken(token);
		}

		return token;
	} catch (error) {
		console.error('Error getting FCM token:', error);
		return null;
	}
};

export const saveFCMToken = async (token: string): Promise<void> => {
	if (!currentUser || !db) {
		return;
	}

	try {
		const userRef = doc(db, 'users', currentUser.uid);
		await setDoc(userRef, {
			fcmToken: token,
			updatedAt: new Date()
		}, { merge: true });

		console.log('FCM token saved to Firestore');
	} catch (error) {
		console.error('Error saving FCM token:', error);
	}
};

export const initializeFCM = async (): Promise<void> => {
	if (!browser || !messaging || messagingInitialized) {
		return;
	}

	messagingInitialized = true;

	const hasPermission = await requestNotificationPermission();
	if (!hasPermission) {
		console.log('Notification permission denied');
		return;
	}

	await getFCMToken();

	onMessage(messaging, (payload: MessagePayload) => {
		console.log('Foreground message received:', payload);

		if (payload.notification) {
			new Notification(payload.notification.title || 'Notification', {
				body: payload.notification.body,
				icon: payload.notification.icon || '/icon-192x192.png',
				badge: '/icon-192x192.png',
				tag: payload.messageId,
				requireInteraction: true,
				data: payload.data || {}
			});
		}
	});
};
