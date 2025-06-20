import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
	getAuth,
	type Auth,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';
import { browser } from '$app/environment';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let messaging: Messaging;

if (browser) {
	app = initializeApp(firebaseConfig);
	auth = getAuth(app);
	db = getFirestore(app);
	messaging = getMessaging(app);
}

export const login = async (email: string, password: string) => {
	if (!auth) throw new Error('Auth not initialized');
	return await signInWithEmailAndPassword(auth, email, password);
};

export const register = async (email: string, password: string) => {
	if (!auth) throw new Error('Auth not initialized');
	return await createUserWithEmailAndPassword(auth, email, password);
};

export const logout = async () => {
	if (!auth) throw new Error('Auth not initialized');
	return await signOut(auth);
};

export const getIdToken = async (): Promise<string | null> => {
	if (!auth?.currentUser) return null;
	return await auth.currentUser.getIdToken();
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
	if (!auth) return () => { };
	return onAuthStateChanged(auth, callback);
};

export { app, auth, db, messaging };
