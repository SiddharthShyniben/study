importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

const firebaseConfig = {
	apiKey: "AIzaSyDuI8UBEcHMYdDOPA1pr3fo8tlGN0fllNs",
	authDomain: "study-b6624.firebaseapp.com",
	projectId: "study-b6624",
	storageBucket: "study-b6624.firebasestorage.app",
	messagingSenderId: "105732769666",
	appId: "1:105732769666:web:5f8bef3aae9d9c38aff19b"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
	console.log('[firebase-messaging-sw.js] Received background message ', payload);

	const notificationTitle = payload.notification?.title || 'Background Message Title';
	const notificationOptions = {
		body: payload.notification?.body || 'Background Message body.',
		icon: '/icon-192x192.png',
		badge: '/icon-192x192.png',
		tag: payload.messageId || 'default-tag',
		requireInteraction: true,
		data: payload.data || {}
	};

	self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
	console.log('[firebase-messaging-sw.js] Notification click received.');

	event.notification.close();

	event.waitUntil(
		clients.matchAll({
			type: 'window'
		}).then(function(clientList) {
			for (let i = 0; i < clientList.length; i++) {
				const client = clientList[i];
				if (client.url === '/' && 'focus' in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow('/');
			}
		})
	);
});
