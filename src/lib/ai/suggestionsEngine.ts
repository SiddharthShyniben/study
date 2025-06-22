import {
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	Timestamp
} from 'firebase/firestore';
import { db, timestampToDate } from '$lib/firebase/firestore';

import { initializeApp } from "firebase/app";
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });
const model = getGenerativeModel(ai, { model: "gemini-2.5-flash" });

interface StudySession {
	startTime: Date;
	endTime: Date;
	duration: number;
	type: string;
	subtopicIdsStudied: string[];
	chapterIdsStudied: string[];
	notes?: string;
}

interface ReviewSession {
	subtopicId: string;
	rating: number;
	reviewDate: Date;
	difficulty: number;
	previousRating?: number;
}

interface StudyPattern {
	totalHours: number;
	sessionCount: number;
	subjectDistribution: { [subject: string]: number };
	timeOfDayDistribution: { [hour: string]: number };
	reviewPerformance: { [subtopicId: string]: ReviewSession[] };
	streaks: {
		current: number;
		longest: number;
	};
	missedReviews: number;
}

export async function generateSmartSuggestions(userId: string): Promise<string[]> {
	try {
		const pattern = await analyzeStudyPattern(userId);
		const suggestions = await generateAISuggestions(pattern);

		return suggestions.length > 0 ? suggestions : [
			"You're doing great! Keep up the consistent study routine.",
			"No specific suggestions today - your study pattern looks balanced."
		];
	} catch (error) {
		console.error('Error generating suggestions:', error);
		return ["Unable to generate suggestions at this time. Please try again later."];
	}
}

async function analyzeStudyPattern(userId: string): Promise<StudyPattern> {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// Fetch study sessions
	const sessionsQuery = query(
		collection(db, 'studySessions'),
		where('userId', '==', userId),
		where('startTime', '>=', Timestamp.fromDate(thirtyDaysAgo)),
		orderBy('startTime', 'desc'),
		limit(100)
	);

	const sessionsSnapshot = await getDocs(sessionsQuery);
	const sessions: StudySession[] = sessionsSnapshot.docs.map(doc => {
		const data = doc.data();
		return {
			startTime: timestampToDate(data.startTime),
			endTime: timestampToDate(data.endTime),
			duration: data.duration,
			type: data.type,
			subtopicIdsStudied: data.subtopicIdsStudied || [],
			chapterIdsStudied: data.chapterIdsStudied || [],
			notes: data.notes
		};
	});

	// Get subtopics for subject mapping
	const subtopicsQuery = query(
		collection(db, 'subtopics'),
		where('userId', '==', userId)
	);

	const subtopicsSnapshot = await getDocs(subtopicsQuery);
	const subtopicToSubject: { [id: string]: string } = {};

	for (const doc of subtopicsSnapshot.docs) {
		const data = doc.data();
		// Get chapter to determine subject
		try {
			const chapterQuery = query(
				collection(db, 'chapters'),
				where('userId', '==', userId),
				where('__name__', '==', data.parentChapterId)
			);
			const chapterSnapshot = await getDocs(chapterQuery);
			if (!chapterSnapshot.empty) {
				const chapterData = chapterSnapshot.docs[0].data();
				subtopicToSubject[doc.id] = chapterData.subject;
			}
		} catch (error) {
			console.warn('Could not map subtopic to subject:', error);
		}
	}

	// Analyze patterns
	const totalHours = sessions.reduce((sum, s) => sum + (s.duration / 60), 0);
	const subjectDistribution: { [subject: string]: number } = {};
	const timeOfDayDistribution: { [hour: string]: number } = {};

	sessions.forEach(session => {
		// Subject distribution
		session.subtopicIdsStudied.forEach(subtopicId => {
			const subject = subtopicToSubject[subtopicId] || 'Unknown';
			subjectDistribution[subject] = (subjectDistribution[subject] || 0) + session.duration;
		});

		// Time of day distribution
		const hour = session.startTime.getHours();
		const timeSlot = getTimeSlot(hour);
		timeOfDayDistribution[timeSlot] = (timeOfDayDistribution[timeSlot] || 0) + 1;
	});

	// Calculate streaks
	const studyDates = [...new Set(sessions.map(s => s.startTime.toDateString()))].sort();
	const { current, longest } = calculateStreaks(studyDates);

	return {
		totalHours,
		sessionCount: sessions.length,
		subjectDistribution,
		timeOfDayDistribution,
		reviewPerformance: {}, // Simplified for now
		streaks: { current, longest },
		missedReviews: 0 // Simplified for now
	};
}

function getTimeSlot(hour: number): string {
	if (hour < 6) return 'Late Night (12-6 AM)';
	if (hour < 12) return 'Morning (6 AM-12 PM)';
	if (hour < 18) return 'Afternoon (12-6 PM)';
	return 'Evening (6 PM-12 AM)';
}

function calculateStreaks(studyDates: string[]): { current: number; longest: number } {
	if (studyDates.length === 0) return { current: 0, longest: 0 };

	let current = 1;
	let longest = 1;
	let streak = 1;

	for (let i = 1; i < studyDates.length; i++) {
		const prevDate = new Date(studyDates[i - 1]);
		const currDate = new Date(studyDates[i]);
		const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);

		if (diffDays === 1) {
			streak++;
		} else {
			longest = Math.max(longest, streak);
			streak = 1;
		}
	}

	// Check if current streak is ongoing
	const lastStudyDate = new Date(studyDates[studyDates.length - 1]);
	const today = new Date();
	const daysSinceLastStudy = (today.getTime() - lastStudyDate.getTime()) / (1000 * 60 * 60 * 24);

	if (daysSinceLastStudy <= 1) {
		current = streak;
	} else {
		current = 0;
	}

	return { current, longest: Math.max(longest, streak) };
}

async function generateAISuggestions(pattern: StudyPattern): Promise<string[]> {
	if (!import.meta.env.VITE_GEMINI_API_KEY) {
		return generateFallbackSuggestions(pattern);
	}

	try {
		const prompt = `
Analyze this student's study pattern and provide 3-5 specific, actionable suggestions in plain English. Focus on practical improvements and patterns you notice.

Study Data:
- Total study time: ${pattern.totalHours.toFixed(1)} hours over 30 days
- Number of sessions: ${pattern.sessionCount}
- Current study streak: ${pattern.streaks.current} days
- Longest streak: ${pattern.streaks.longest} days

Subject Distribution (minutes):
${Object.entries(pattern.subjectDistribution)
				.map(([subject, minutes]) => `- ${subject}: ${(minutes / 60).toFixed(1)} hours (${((minutes / pattern.totalHours / 60) * 100).toFixed(1)}%)`)
				.join('\n')}

Time of Day Preferences:
${Object.entries(pattern.timeOfDayDistribution)
				.map(([time, count]) => `- ${time}: ${count} sessions`)
				.join('\n')}

Please provide suggestions as a JSON array of strings, like:
["suggestion 1", "suggestion 2", "suggestion 3"]

Focus on:
- Subject balance issues
- Time management opportunities  
- Study habit improvements
- Streak maintenance
- Specific actionable advice

Keep suggestions concise, friendly, and specific to the data provided.
`;

		const result = await model.generateContent(prompt);
		const response = result.response;
		const text = response.text();

		try {
			const suggestions = JSON.parse(text);
			if (Array.isArray(suggestions) && suggestions.length > 0) {
				return suggestions.slice(0, 5); // Limit to 5 suggestions
			}
		} catch (parseError) {
			console.warn('Could not parse AI response as JSON:', parseError);
		}

		return generateFallbackSuggestions(pattern);
	} catch (error) {
		console.error('Error calling Gemini API:', error);
		return generateFallbackSuggestions(pattern);
	}
}

function generateFallbackSuggestions(pattern: StudyPattern): string[] {
	const suggestions: string[] = [];

	// Study frequency suggestions
	if (pattern.sessionCount < 10) {
		suggestions.push("Try to study more consistently - aim for at least one session every 2-3 days.");
	} else if (pattern.sessionCount > 25) {
		suggestions.push("Great study frequency! Consider longer sessions to reduce setup time.");
	}

	// Subject balance suggestions
	const subjects = Object.entries(pattern.subjectDistribution);
	if (subjects.length > 1) {
		const totalTime = pattern.totalHours * 60;
		const imbalanced = subjects.find(([_, minutes]) => (minutes / totalTime) < 0.15);
		if (imbalanced) {
			const [subject, minutes] = imbalanced;
			const percentage = ((minutes / totalTime) * 100).toFixed(0);
			suggestions.push(`You've only spent ${percentage}% of your time on ${subject} - consider increasing focus on this subject.`);
		}
	}

	// Time of day suggestions
	const timeSlots = Object.entries(pattern.timeOfDayDistribution);
	const mostProductiveTime = timeSlots.reduce((max, curr) => curr[1] > max[1] ? curr : max, ['', 0]);
	if (mostProductiveTime[0]) {
		suggestions.push(`You seem most active during ${mostProductiveTime[0].toLowerCase()} - try scheduling challenging topics during this time.`);
	}

	// Streak suggestions
	if (pattern.streaks.current === 0) {
		suggestions.push("Start a new study streak today - even 15 minutes counts!");
	} else if (pattern.streaks.current >= 7) {
		suggestions.push(`Amazing ${pattern.streaks.current}-day streak! Keep the momentum going.`);
	}

	// Study volume suggestions
	const dailyAverage = pattern.totalHours / 30;
	if (dailyAverage < 0.5) {
		suggestions.push("Consider increasing your daily study time to at least 30 minutes for better retention.");
	} else if (dailyAverage > 3) {
		suggestions.push("You're studying intensively! Make sure to take breaks and avoid burnout.");
	}

	return suggestions.slice(0, 5);
}
