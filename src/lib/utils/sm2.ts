/**
 * SM-2 Algorithm implementation for spaced repetition
 * Based on SuperMemo 2 algorithm by Piotr Wozniak
 */

export interface CurrentSM2Data {
	easeFactor: number;
	interval: number;
	repetitions: number;
	lastReviewDate?: Date;
}

export interface UpdatedSM2Data {
	easeFactor: number;
	interval: number;
	repetitions: number;
	nextReviewDate: Date;
}

/**
 * Updates SM-2 parameters based on performance rating
 * @param current Current SM-2 data for the item
 * @param performanceRating Performance rating from 0-5
 * @returns Updated SM-2 parameters with next review date
 */
export function updateSM2(current: CurrentSM2Data, performanceRating: number): UpdatedSM2Data {
	let { easeFactor, interval, repetitions } = current;

	// Clamp performance rating to valid range
	const q = Math.max(0, Math.min(5, performanceRating));

	if (q < 3) {
		// Poor performance: reset progress
		repetitions = 0;
		interval = 1;
	} else {
		// Good performance: advance according to SM-2
		repetitions += 1;

		// Calculate new interval based on repetitions
		if (repetitions === 1) {
			interval = 1;
		} else if (repetitions === 2) {
			interval = 6;
		} else {
			interval = Math.round(interval * easeFactor);
		}
	}

	// Update ease factor based on performance
	// EF := EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
	// Simplified: EF - 0.8 + 0.28*q - 0.02*q*q
	easeFactor = easeFactor - 0.8 + 0.28 * q - 0.02 * q * q;

	// Ensure ease factor doesn't go below minimum
	easeFactor = Math.max(1.3, easeFactor);

	// Calculate next review date
	const nextReviewDate = new Date();
	nextReviewDate.setDate(nextReviewDate.getDate() + interval);

	return {
		easeFactor,
		interval,
		repetitions,
		nextReviewDate
	};
}
