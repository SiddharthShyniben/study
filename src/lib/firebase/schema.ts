export interface User {
	id: string;
	email: string;
	displayName?: string;
	fcmToken?: string;
	notificationPreferences: {
		reviewReminders: boolean;
		dailySummary: boolean;
		goalDeadlines: boolean;
		studySessionReminders: boolean;
	};
	timezone: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Chapter {
	id: string;
	name: string;
	subject: string;
	totalStudyTime: number; // in minutes
	lastStudied?: Date;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Subtopic {
	id: string;
	name: string;
	parentChapterId: string;
	easeFactor: number; // SM-2 algorithm
	interval: number; // days until next review
	repetitions: number;
	nextReviewDate: Date;
	lastReviewDate?: Date;
	lastPerformanceRating: number; // 1-5 scale
	tags: string[];
	status: 'not_started' | 'learning' | 'reviewing' | 'mastered';
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface StudySession {
	id: string;
	userId: string;
	startTime: Date;
	endTime?: Date;
	duration?: number; // in minutes, calculated when session ends
	chapterIdsStudied: string[];
	subtopicIdsStudied: string[];
	type: 'focused_study' | 'review' | 'practice_test' | 'reading' | 'notes';
	notes?: string;
	performanceRatings?: { [subtopicId: string]: number }; // 1-5 scale
	createdAt: Date;
	updatedAt: Date;
}

export interface Exam {
	id: string;
	name: string;
	date: Date;
	targetCompletionPercentage: number; // 0-100
	associatedChapterIds: string[];
	associatedSubtopicIds: string[];
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface StudyGoal {
	id: string;
	period: 'daily' | 'weekly' | 'monthly' | 'custom';
	startDate: Date;
	endDate: Date;
	targetSubtopics: number;
	targetHours: number;
	actualSubtopicsCovered: number;
	actualHoursSpent: number;
	status: 'active' | 'completed' | 'failed' | 'paused';
	behindBy: {
		subtopics: number;
		hours: number;
	};
	associatedChapterIds: string[];
	associatedSubtopicIds: string[];
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export type FirestoreTimestamp = {
	seconds: number;
	nanoseconds: number;
};

export interface UserData extends Omit<User, 'createdAt' | 'updatedAt'> {
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}

export interface ChapterData extends Omit<Chapter, 'lastStudied' | 'createdAt' | 'updatedAt'> {
	lastStudied?: FirestoreTimestamp;
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}

export interface SubtopicData extends Omit<Subtopic, 'nextReviewDate' | 'lastReviewDate' | 'createdAt' | 'updatedAt'> {
	nextReviewDate: FirestoreTimestamp;
	lastReviewDate?: FirestoreTimestamp;
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}

export interface StudySessionData extends Omit<StudySession, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt'> {
	startTime: FirestoreTimestamp;
	endTime?: FirestoreTimestamp;
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}

export interface ExamData extends Omit<Exam, 'date' | 'createdAt' | 'updatedAt'> {
	date: FirestoreTimestamp;
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}

export interface StudyGoalData extends Omit<StudyGoal, 'startDate' | 'endDate' | 'createdAt' | 'updatedAt'> {
	startDate: FirestoreTimestamp;
	endDate: FirestoreTimestamp;
	createdAt: FirestoreTimestamp;
	updatedAt: FirestoreTimestamp;
}
