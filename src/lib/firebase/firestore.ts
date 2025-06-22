import {
	getFirestore,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	addDoc,
	Timestamp,
	type DocumentReference,
	type Query,
	type QuerySnapshot
} from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import type {
	User,
	Chapter,
	Subtopic,
	StudySession,
	Exam,
	StudyGoal,
	UserData,
	ChapterData,
	SubtopicData,
	StudySessionData,
	ExamData,
	StudyGoalData,
	FirestoreTimestamp
} from './schema';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

if (!getApps().length) {
	initializeApp(firebaseConfig);
}

export const db = getFirestore();

// Utility functions for converting between Firestore timestamps and JS Dates
export const timestampToDate = (timestamp: FirestoreTimestamp): Date => {
	return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
};

export const dateToTimestamp = (date: Date): Timestamp => {
	return Timestamp.fromDate(date);
};

// Convert Firestore data to app data
export const convertUserData = (data: UserData): User => ({
	...data,
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

export const convertChapterData = (data: ChapterData): Chapter => ({
	...data,
	lastStudied: data.lastStudied ? timestampToDate(data.lastStudied) : undefined,
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

export const convertSubtopicData = (data: SubtopicData): Subtopic => ({
	...data,
	nextReviewDate: timestampToDate(data.nextReviewDate),
	lastReviewDate: data.lastReviewDate ? timestampToDate(data.lastReviewDate) : undefined,
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

export const convertStudySessionData = (data: StudySessionData): StudySession => ({
	...data,
	startTime: timestampToDate(data.startTime),
	endTime: data.endTime ? timestampToDate(data.endTime) : undefined,
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

export const convertExamData = (data: ExamData): Exam => ({
	...data,
	date: timestampToDate(data.date),
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

export const convertStudyGoalData = (data: StudyGoalData): StudyGoal => ({
	...data,
	startDate: timestampToDate(data.startDate),
	endDate: timestampToDate(data.endDate),
	createdAt: timestampToDate(data.createdAt),
	updatedAt: timestampToDate(data.updatedAt)
});

// User operations
export const getUserDoc = async (uid: string): Promise<User | null> => {
	const userRef = doc(db, 'users', uid);
	const userSnap = await getDoc(userRef);

	if (userSnap.exists()) {
		return convertUserData({ id: userSnap.id, ...userSnap.data() } as UserData);
	}
	return null;
};

export const createUser = async (uid: string, userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
	const now = Timestamp.now();
	const userRef = doc(db, 'users', uid);
	await setDoc(userRef, {
		...userData,
		createdAt: now,
		updatedAt: now
	});
};

export const updateUser = async (uid: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
	const userRef = doc(db, 'users', uid);
	await updateDoc(userRef, {
		...updates,
		updatedAt: Timestamp.now()
	});
};

// Chapter operations
export const getChapter = async (chapterId: string): Promise<Chapter | null> => {
	const chapterRef = doc(db, 'chapters', chapterId);
	const chapterSnap = await getDoc(chapterRef);

	if (chapterSnap.exists()) {
		return convertChapterData({ id: chapterSnap.id, ...chapterSnap.data() } as ChapterData);
	}
	return null;
};

export const getUserChapters = async (userId: string): Promise<Chapter[]> => {
	const chaptersQuery = query(
		collection(db, 'chapters'),
		where('userId', '==', userId),
		orderBy('updatedAt', 'desc')
	);
	const querySnapshot = await getDocs(chaptersQuery);

	return querySnapshot.docs.map(doc =>
		convertChapterData({ id: doc.id, ...doc.data() } as ChapterData)
	);
};

export const createChapter = async (chapterData: Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
	const now = Timestamp.now();
	const docData: any = {
		...chapterData,
		createdAt: now,
		updatedAt: now
	};

	if (chapterData.lastStudied) {
		docData.lastStudied = dateToTimestamp(chapterData.lastStudied);
	}

	const docRef = await addDoc(collection(db, 'chapters'), docData);
	return docRef.id;
};

export const updateChapter = async (chapterId: string, updates: Partial<Omit<Chapter, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
	const chapterRef = doc(db, 'chapters', chapterId);
	const updateData: any = {
		...updates,
		updatedAt: Timestamp.now()
	};

	if (updates.lastStudied) {
		updateData.lastStudied = dateToTimestamp(updates.lastStudied);
	}

	await updateDoc(chapterRef, updateData);
};

// Subtopic operations
export const getSubtopic = async (subtopicId: string): Promise<Subtopic | null> => {
	const subtopicRef = doc(db, 'subtopics', subtopicId);
	const subtopicSnap = await getDoc(subtopicRef);

	if (subtopicSnap.exists()) {
		return convertSubtopicData({ id: subtopicSnap.id, ...subtopicSnap.data() } as SubtopicData);
	}
	return null;
};

export const getChapterSubtopics = async (chapterId: string): Promise<Subtopic[]> => {
	const subtopicsQuery = query(
		collection(db, 'subtopics'),
		where('parentChapterId', '==', chapterId),
		orderBy('createdAt', 'asc')
	);
	const querySnapshot = await getDocs(subtopicsQuery);

	return querySnapshot.docs.map(doc =>
		convertSubtopicData({ id: doc.id, ...doc.data() } as SubtopicData)
	);
};

export const getSubtopicsDueForReview = async (userId: string, beforeDate: Date = new Date()): Promise<Subtopic[]> => {
	const subtopicsQuery = query(
		collection(db, 'subtopics'),
		where('userId', '==', userId),
		where('nextReviewDate', '<=', dateToTimestamp(beforeDate)),
		orderBy('nextReviewDate', 'asc')
	);
	const querySnapshot = await getDocs(subtopicsQuery);

	return querySnapshot.docs.map(doc =>
		convertSubtopicData({ id: doc.id, ...doc.data() } as SubtopicData)
	);
};

export const createSubtopic = async (subtopicData: Omit<Subtopic, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
	const now = Timestamp.now();
	const docData: any = {
		...subtopicData,
		nextReviewDate: dateToTimestamp(subtopicData.nextReviewDate),
		createdAt: now,
		updatedAt: now
	};

	if (subtopicData.lastReviewDate) {
		docData.lastReviewDate = dateToTimestamp(subtopicData.lastReviewDate);
	}

	const docRef = await addDoc(collection(db, 'subtopics'), docData);
	return docRef.id;
};

export const updateSubtopic = async (subtopicId: string, updates: Partial<Omit<Subtopic, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
	const subtopicRef = doc(db, 'subtopics', subtopicId);
	const updateData: any = {
		...updates,
		updatedAt: Timestamp.now()
	};

	if (updates.nextReviewDate) {
		updateData.nextReviewDate = dateToTimestamp(updates.nextReviewDate);
	}

	if (updates.lastReviewDate) {
		updateData.lastReviewDate = dateToTimestamp(updates.lastReviewDate);
	}

	await updateDoc(subtopicRef, updateData);
};

// Study Session operations
export const getStudySession = async (sessionId: string): Promise<StudySession | null> => {
	const sessionRef = doc(db, 'studySessions', sessionId);
	const sessionSnap = await getDoc(sessionRef);

	if (sessionSnap.exists()) {
		return convertStudySessionData({ id: sessionSnap.id, ...sessionSnap.data() } as StudySessionData);
	}
	return null;
};

export const getUserStudySessions = async (userId: string, limitCount: number = 50): Promise<StudySession[]> => {
	const sessionsQuery = query(
		collection(db, 'studySessions'),
		where('userId', '==', userId),
		orderBy('startTime', 'desc'),
		limit(limitCount)
	);
	const querySnapshot = await getDocs(sessionsQuery);

	return querySnapshot.docs.map(doc =>
		convertStudySessionData({ id: doc.id, ...doc.data() } as StudySessionData)
	);
};

export const createStudySession = async (sessionData: Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
	const now = Timestamp.now();
	const docData: any = {
		...sessionData,
		startTime: dateToTimestamp(sessionData.startTime),
		createdAt: now,
		updatedAt: now
	};

	if (sessionData.endTime) {
		docData.endTime = dateToTimestamp(sessionData.endTime);
	}

	const docRef = await addDoc(collection(db, 'studySessions'), docData);
	return docRef.id;
};

export const updateStudySession = async (sessionId: string, updates: Partial<Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
	const sessionRef = doc(db, 'studySessions', sessionId);
	const updateData: any = {
		...updates,
		updatedAt: Timestamp.now()
	};

	if (updates.startTime) {
		updateData.startTime = dateToTimestamp(updates.startTime);
	}

	if (updates.endTime) {
		updateData.endTime = dateToTimestamp(updates.endTime);
	}

	await updateDoc(sessionRef, updateData);
};

// Exam operations
export const getExam = async (examId: string): Promise<Exam | null> => {
	const examRef = doc(db, 'exams', examId);
	const examSnap = await getDoc(examRef);

	if (examSnap.exists()) {
		return convertExamData({ id: examSnap.id, ...examSnap.data() } as ExamData);
	}
	return null;
};

export const getUserExams = async (userId: string): Promise<Exam[]> => {
	const examsQuery = query(
		collection(db, 'exams'),
		where('userId', '==', userId),
		orderBy('date', 'asc')
	);
	const querySnapshot = await getDocs(examsQuery);

	return querySnapshot.docs.map(doc =>
		convertExamData({ id: doc.id, ...doc.data() } as ExamData)
	);
};

export const createExam = async (examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
	const now = Timestamp.now();
	const docRef = await addDoc(collection(db, 'exams'), {
		...examData,
		date: dateToTimestamp(examData.date),
		createdAt: now,
		updatedAt: now
	});
	return docRef.id;
};

// Study Goal operations
export const getStudyGoal = async (goalId: string): Promise<StudyGoal | null> => {
	const goalRef = doc(db, 'studyGoals', goalId);
	const goalSnap = await getDoc(goalRef);

	if (goalSnap.exists()) {
		return convertStudyGoalData({ id: goalSnap.id, ...goalSnap.data() } as StudyGoalData);
	}
	return null;
};

export const getUserStudyGoals = async (userId: string): Promise<StudyGoal[]> => {
	const goalsQuery = query(
		collection(db, 'studyGoals'),
		where('userId', '==', userId),
		orderBy('startDate', 'desc')
	);
	const querySnapshot = await getDocs(goalsQuery);

	return querySnapshot.docs.map(doc =>
		convertStudyGoalData({ id: doc.id, ...doc.data() } as StudyGoalData)
	);
};

export const createStudyGoal = async (goalData: Omit<StudyGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
	const now = Timestamp.now();
	const docRef = await addDoc(collection(db, 'studyGoals'), {
		...goalData,
		startDate: dateToTimestamp(goalData.startDate),
		endDate: dateToTimestamp(goalData.endDate),
		createdAt: now,
		updatedAt: now
	});
	return docRef.id;
};

export const updateStudyGoal = async (goalId: string, updates: Partial<Omit<StudyGoal, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
	const goalRef = doc(db, 'studyGoals', goalId);
	const updateData: any = {
		...updates,
		updatedAt: Timestamp.now()
	};

	if (updates.startDate) {
		updateData.startDate = dateToTimestamp(updates.startDate);
	}

	if (updates.endDate) {
		updateData.endDate = dateToTimestamp(updates.endDate);
	}

	await updateDoc(goalRef, updateData);
};

// Generic delete operation
export const deleteDocument = async (collectionName: string, docId: string): Promise<void> => {
	const docRef = doc(db, collectionName, docId);
	await deleteDoc(docRef);
};
