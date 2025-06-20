import {
	collection,
	query,
	where,
	orderBy,
	getDocs,
	Timestamp
} from 'firebase/firestore';
import { db, timestampToDate, getChapter } from '$lib/firebase/firestore';
import type { Subtopic, Chapter } from '$lib/firebase/schema';

export interface SuggestionItem extends Subtopic {
	type: 'review' | 'grind';
	chapter?: Chapter | null;
	priority: number;
}

export interface SuggestionResult {
	suggestions: SuggestionItem[];
	estimatedDuration: number;
}

export interface SuggestionOptions {
	maxNewItemsPerDay?: number;
	maxReviewItems?: number;
	maxGrindItems?: number;
	grindDifficultyThreshold?: number;
	reviewTimePerItem?: number;
	grindTimePerItem?: number;
	youngNewItemsLimit?: number;
}

const DEFAULT_OPTIONS: Required<SuggestionOptions> = {
	maxNewItemsPerDay: 5,
	maxReviewItems: 20,
	maxGrindItems: 10,
	grindDifficultyThreshold: 2.2,
	reviewTimePerItem: 5,
	grindTimePerItem: 15,
	youngNewItemsLimit: 3
};

export async function getStudySuggestions(
	userId: string,
	options: SuggestionOptions = {}
): Promise<SuggestionResult> {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const subtopicsQuery = query(
		collection(db, 'subtopics'),
		where('userId', '==', userId),
		orderBy('updatedAt', 'desc')
	);

	const subtopicsSnapshot = await getDocs(subtopicsQuery);
	const allSubtopics: Subtopic[] = [];

	for (const doc of subtopicsSnapshot.docs) {
		const data = doc.data();

		if (data.postponedUntil && timestampToDate(data.postponedUntil) > now) {
			continue;
		}

		if (data.buriedUntil && timestampToDate(data.buriedUntil) > now) {
			continue;
		}

		const subtopic: Subtopic = {
			id: doc.id,
			name: data.name,
			parentChapterId: data.parentChapterId,
			easeFactor: data.easeFactor,
			interval: data.interval,
			repetitions: data.repetitions,
			nextReviewDate: timestampToDate(data.nextReviewDate),
			lastReviewDate: data.lastReviewDate ? timestampToDate(data.lastReviewDate) : undefined,
			lastPerformanceRating: data.lastPerformanceRating,
			tags: data.tags || [],
			status: data.status,
			userId: data.userId,
			createdAt: timestampToDate(data.createdAt),
			updatedAt: timestampToDate(data.updatedAt)
		};

		allSubtopics.push(subtopic);
	}

	const reviewCandidates = allSubtopics.filter(subtopic => {
		return subtopic.nextReviewDate <= now &&
			(subtopic.status === 'learning' || subtopic.status === 'reviewing');
	});

	const grindCandidates = getGrindCandidates(allSubtopics, twentyFourHoursAgo, opts);

	const newItemsToday = allSubtopics.filter(subtopic => {
		return subtopic.status === 'learning' &&
			subtopic.createdAt >= todayStart;
	}).length;

	const remainingNewItemsAllowed = Math.max(0, opts.maxNewItemsPerDay - newItemsToday);

	const reviewBySubject = await groupBySubject(reviewCandidates);
	const grindBySubject = await groupBySubject(grindCandidates);

	const selectedReviews = selectReviewItems(reviewBySubject, opts.maxReviewItems);
	const selectedGrinds = selectGrindItems(
		grindBySubject,
		Math.min(opts.maxGrindItems, remainingNewItemsAllowed)
	);

	const reviewSuggestions: SuggestionItem[] = await Promise.all(
		selectedReviews.map(async (subtopic, index) => ({
			...subtopic,
			type: 'review' as const,
			chapter: await getChapter(subtopic.parentChapterId),
			priority: calculateReviewPriority(subtopic, now) + (index * 0.1)
		}))
	);

	const grindSuggestions: SuggestionItem[] = await Promise.all(
		selectedGrinds.map(async (subtopic, index) => ({
			...subtopic,
			type: 'grind' as const,
			chapter: await getChapter(subtopic.parentChapterId),
			priority: calculateGrindPriority(subtopic) + (index * 0.1)
		}))
	);

	const allSuggestions = [...reviewSuggestions, ...grindSuggestions]
		.sort((a, b) => b.priority - a.priority);

	const estimatedDuration =
		(reviewSuggestions.length * opts.reviewTimePerItem) +
		(grindSuggestions.length * opts.grindTimePerItem);

	return {
		suggestions: allSuggestions,
		estimatedDuration
	};
}

function getGrindCandidates(
	allSubtopics: Subtopic[],
	twentyFourHoursAgo: Date,
	opts: Required<SuggestionOptions>
): Subtopic[] {
	const newSubtopics = allSubtopics.filter(s => s.status === 'not_started');
	const learningSubtopics = allSubtopics.filter(s =>
		s.status === 'learning' && s.easeFactor <= opts.grindDifficultyThreshold
	);

	const matureNewSubtopics = newSubtopics.filter(s => s.createdAt <= twentyFourHoursAgo);

	let selectedNewSubtopics: Subtopic[] = [];

	if (matureNewSubtopics.length > 0) {
		selectedNewSubtopics = matureNewSubtopics;
	} else {
		const youngNewSubtopics = newSubtopics
			.filter(s => s.createdAt > twentyFourHoursAgo)
			.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
			.slice(0, opts.youngNewItemsLimit);

		selectedNewSubtopics = youngNewSubtopics;
	}

	return [...selectedNewSubtopics, ...learningSubtopics];
}

async function groupBySubject(subtopics: Subtopic[]): Promise<Map<string, Subtopic[]>> {
	const subjectGroups = new Map<string, Subtopic[]>();

	for (const subtopic of subtopics) {
		try {
			const chapter = await getChapter(subtopic.parentChapterId);
			const subject = chapter?.subject || 'Unknown';

			if (!subjectGroups.has(subject)) {
				subjectGroups.set(subject, []);
			}
			subjectGroups.get(subject)!.push(subtopic);
		} catch (error) {
			console.warn(`Could not load chapter for subtopic ${subtopic.id}:`, error);
		}
	}

	return subjectGroups;
}

function selectReviewItems(reviewBySubject: Map<string, Subtopic[]>, maxItems: number): Subtopic[] {
	const selected: Subtopic[] = [];
	const subjects = Array.from(reviewBySubject.keys());

	subjects.forEach(subject => {
		const subtopics = reviewBySubject.get(subject)!;
		subtopics.sort((a, b) => a.nextReviewDate.getTime() - b.nextReviewDate.getTime());
	});

	let subjectIndex = 0;
	while (selected.length < maxItems && subjects.length > 0) {
		const currentSubject = subjects[subjectIndex];
		const subtopics = reviewBySubject.get(currentSubject)!;

		if (subtopics.length > 0) {
			selected.push(subtopics.shift()!);
		}

		if (subtopics.length === 0) {
			subjects.splice(subjectIndex, 1);
			if (subjectIndex >= subjects.length) {
				subjectIndex = 0;
			}
		} else {
			subjectIndex = (subjectIndex + 1) % subjects.length;
		}
	}

	return selected;
}

function selectGrindItems(grindBySubject: Map<string, Subtopic[]>, maxItems: number): Subtopic[] {
	const selected: Subtopic[] = [];
	const subjects = Array.from(grindBySubject.keys());

	subjects.forEach(subject => {
		const subtopics = grindBySubject.get(subject)!;
		subtopics.sort((a, b) => {
			if (a.status === 'not_started' && b.status !== 'not_started') return -1;
			if (a.status !== 'not_started' && b.status === 'not_started') return 1;
			return a.easeFactor - b.easeFactor;
		});
	});

	let subjectIndex = 0;
	while (selected.length < maxItems && subjects.length > 0) {
		const currentSubject = subjects[subjectIndex];
		const subtopics = grindBySubject.get(currentSubject)!;

		if (subtopics.length > 0) {
			selected.push(subtopics.shift()!);
		}

		if (subtopics.length === 0) {
			subjects.splice(subjectIndex, 1);
			if (subjectIndex >= subjects.length) {
				subjectIndex = 0;
			}
		} else {
			subjectIndex = (subjectIndex + 1) % subjects.length;
		}
	}

	return selected;
}

function calculateReviewPriority(subtopic: Subtopic, now: Date): number {
	const daysOverdue = Math.max(0, (now.getTime() - subtopic.nextReviewDate.getTime()) / (1000 * 60 * 60 * 24));

	let priority = 100 + (daysOverdue * 10);

	if (subtopic.easeFactor < 2.0) {
		priority += 20;
	} else if (subtopic.easeFactor < 2.3) {
		priority += 10;
	}

	if (subtopic.repetitions < 3) {
		priority += 5;
	}

	return priority;
}

function calculateGrindPriority(subtopic: Subtopic): number {
	let priority = 50;

	if (subtopic.status === 'not_started') {
		priority += 25;
	} else {
		priority += (2.5 - subtopic.easeFactor) * 20;
	}

	priority -= subtopic.repetitions * 2;

	return Math.max(0, priority);
}

export default getStudySuggestions;
