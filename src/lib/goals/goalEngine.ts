import {
	getUserChapters,
	getChapterSubtopics,
	getUserStudySessions,
	getUserExams,
	getUserStudyGoals,
	createStudyGoal,
	updateStudyGoal
} from '$lib/firebase/firestore';
import type { Exam, Subtopic, StudySession, StudyGoal } from '$lib/firebase/schema';

interface GoalMetrics {
	totalSubtopics: number;
	masteredSubtopics: number;
	totalHoursStudied: number;
	remainingWeeks: number;
	targetCompletionPercentage: number;
}

export async function calculateGoalMetrics(userId: string, exam: Exam): Promise<GoalMetrics> {
	// Get all chapters and subtopics
	const chapters = await getUserChapters(userId);
	let allSubtopics: Subtopic[] = [];

	for (const chapter of chapters) {
		const subtopics = await getChapterSubtopics(chapter.id);
		allSubtopics = [...allSubtopics, ...subtopics];
	}

	// Calculate mastered subtopics
	const masteredSubtopics = allSubtopics.filter(s => s.status === 'mastered').length;

	// Get study sessions to calculate total hours
	const sessions = await getUserStudySessions(userId, 1000);
	const totalHoursStudied = sessions.reduce((total, session) => {
		return total + (session.duration || 0);
	}, 0) / 60; // Convert minutes to hours

	// Calculate remaining time to exam
	const now = new Date();
	const examDate = new Date(exam.date);
	const remainingTime = examDate.getTime() - now.getTime();
	const remainingWeeks = Math.max(1, Math.ceil(remainingTime / (1000 * 60 * 60 * 24 * 7)));

	return {
		totalSubtopics: allSubtopics.length,
		masteredSubtopics,
		totalHoursStudied,
		remainingWeeks,
		targetCompletionPercentage: exam.targetCompletionPercentage
	};
}

export function calculateWeeklyTargets(metrics: GoalMetrics): { targetSubtopics: number; targetHours: number } {
	const requiredSubtopics = Math.ceil(metrics.totalSubtopics * (metrics.targetCompletionPercentage / 100));
	const remainingSubtopics = Math.max(0, requiredSubtopics - metrics.masteredSubtopics);

	const targetSubtopicsPerWeek = Math.ceil(remainingSubtopics / metrics.remainingWeeks);

	// Estimate 45 minutes per new subtopic (including review time)
	const targetHoursPerWeek = Math.max(5, targetSubtopicsPerWeek * 0.75);

	return {
		targetSubtopics: targetSubtopicsPerWeek,
		targetHours: Math.round(targetHoursPerWeek * 10) / 10 // Round to 1 decimal
	};
}

export function calculateMonthlyTargets(metrics: GoalMetrics): { targetSubtopics: number; targetHours: number } {
	const weeklyTargets = calculateWeeklyTargets(metrics);

	return {
		targetSubtopics: weeklyTargets.targetSubtopics * 4,
		targetHours: weeklyTargets.targetHours * 4
	};
}

export function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
	const start = new Date(date);
	const day = start.getDay();
	const diff = start.getDate() - day; // Sunday = 0
	start.setDate(diff);
	start.setHours(0, 0, 0, 0);

	const end = new Date(start);
	end.setDate(start.getDate() + 6);
	end.setHours(23, 59, 59, 999);

	return { start, end };
}

export function getMonthBounds(date: Date = new Date()): { start: Date; end: Date } {
	const start = new Date(date.getFullYear(), date.getMonth(), 1);
	start.setHours(0, 0, 0, 0);

	const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	end.setHours(23, 59, 59, 999);

	return { start, end };
}

export async function calculateActualProgress(
	userId: string,
	startDate: Date,
	endDate: Date
): Promise<{ actualSubtopicsCovered: number; actualHoursSpent: number }> {
	// Get study sessions within the period
	const allSessions = await getUserStudySessions(userId, 1000);
	const periodSessions = allSessions.filter(session => {
		const sessionDate = new Date(session.startTime);
		return sessionDate >= startDate && sessionDate <= endDate;
	});

	// Calculate hours spent
	const actualHoursSpent = periodSessions.reduce((total, session) => {
		return total + (session.duration || 0);
	}, 0) / 60;

	// Calculate unique subtopics covered
	const coveredSubtopicIds = new Set<string>();
	periodSessions.forEach(session => {
		session.subtopicIdsStudied.forEach(id => coveredSubtopicIds.add(id));
	});

	return {
		actualSubtopicsCovered: coveredSubtopicIds.size,
		actualHoursSpent: Math.round(actualHoursSpent * 10) / 10
	};
}

export async function generateOrUpdateGoals(userId: string): Promise<void> {
	const exams = await getUserExams(userId);
	const now = new Date();

	for (const exam of exams) {
		// Skip past exams
		if (new Date(exam.date) <= now) continue;

		const metrics = await calculateGoalMetrics(userId, exam);

		// Generate weekly goal
		const weekBounds = getWeekBounds(now);
		const weeklyTargets = calculateWeeklyTargets(metrics);
		const weeklyActual = await calculateActualProgress(userId, weekBounds.start, weekBounds.end);

		await createOrUpdateGoal(userId, {
			period: 'weekly',
			startDate: weekBounds.start,
			endDate: weekBounds.end,
			targetSubtopics: weeklyTargets.targetSubtopics,
			targetHours: weeklyTargets.targetHours,
			actualSubtopicsCovered: weeklyActual.actualSubtopicsCovered,
			actualHoursSpent: weeklyActual.actualHoursSpent,
			associatedChapterIds: [],
			associatedSubtopicIds: [],
			status: 'active',
			behindBy: {
				subtopics: Math.max(0, weeklyTargets.targetSubtopics - weeklyActual.actualSubtopicsCovered),
				hours: Math.max(0, weeklyTargets.targetHours - weeklyActual.actualHoursSpent)
			}
		});

		// Generate monthly goal
		const monthBounds = getMonthBounds(now);
		const monthlyTargets = calculateMonthlyTargets(metrics);
		const monthlyActual = await calculateActualProgress(userId, monthBounds.start, monthBounds.end);

		await createOrUpdateGoal(userId, {
			period: 'monthly',
			startDate: monthBounds.start,
			endDate: monthBounds.end,
			targetSubtopics: monthlyTargets.targetSubtopics,
			targetHours: monthlyTargets.targetHours,
			actualSubtopicsCovered: monthlyActual.actualSubtopicsCovered,
			actualHoursSpent: monthlyActual.actualHoursSpent,
			associatedChapterIds: [],
			associatedSubtopicIds: [],
			status: 'active',
			behindBy: {
				subtopics: Math.max(0, monthlyTargets.targetSubtopics - monthlyActual.actualSubtopicsCovered),
				hours: Math.max(0, monthlyTargets.targetHours - monthlyActual.actualHoursSpent)
			}
		});
	}
}

async function createOrUpdateGoal(userId: string, goalData: Omit<StudyGoal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<void> {
	const existingGoals = await getUserStudyGoals(userId);

	// Find existing goal for this period
	const existingGoal = existingGoals.find(goal =>
		goal.period === goalData.period &&
		goal.startDate.getTime() === goalData.startDate.getTime() &&
		goal.endDate.getTime() === goalData.endDate.getTime()
	);

	if (existingGoal) {
		// Update existing goal
		await updateStudyGoal(existingGoal.id, {
			targetSubtopics: goalData.targetSubtopics,
			targetHours: goalData.targetHours,
			actualSubtopicsCovered: goalData.actualSubtopicsCovered,
			actualHoursSpent: goalData.actualHoursSpent,
			behindBy: goalData.behindBy,
			status: goalData.status
		});
	} else {
		// Create new goal
		await createStudyGoal({
			...goalData,
			userId
		});
	}
}
