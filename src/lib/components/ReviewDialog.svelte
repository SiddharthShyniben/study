<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { updateSM2 } from '$lib/utils/sm2';
	import type { Subtopic } from '$lib/firebase/schema';

	const dispatch = createEventDispatcher<{
		complete: SubtopicSM2Update[];
		cancel: void;
	}>();

	export let subtopics: Subtopic[] = [];
	export let isOpen = false;

	interface SubtopicSM2Update {
		subtopicId: string;
		easeFactor: number;
		interval: number;
		repetitions: number;
		nextReviewDate: Date;
		lastReviewDate: Date;
		lastPerformanceRating: number;
	}

	// Track ratings for each subtopic
	let ratings: { [subtopicId: string]: number } = {};

	// Initialize ratings to 3 (average)
	$: if (subtopics.length > 0) {
		ratings = subtopics.reduce((acc, subtopic) => {
			acc[subtopic.id] = acc[subtopic.id] ?? 3;
			return acc;
		}, ratings);
	}

	const ratingDescriptions = {
		0: 'Complete failure - no recall',
		1: 'Incorrect with easy recall',
		2: 'Incorrect with hesitation',
		3: 'Correct with difficulty',
		4: 'Correct with hesitation',
		5: 'Perfect recall'
	};

	const handleSubmit = () => {
		const updates: SubtopicSM2Update[] = [];
		const reviewDate = new Date();

		for (const subtopic of subtopics) {
			const rating = ratings[subtopic.id];
			const updatedSM2 = updateSM2({
				easeFactor: subtopic.easeFactor,
				interval: subtopic.interval,
				repetitions: subtopic.repetitions,
				lastReviewDate: subtopic.lastReviewDate
			}, rating);

			updates.push({
				subtopicId: subtopic.id,
				easeFactor: updatedSM2.easeFactor,
				interval: updatedSM2.interval,
				repetitions: updatedSM2.repetitions,
				nextReviewDate: updatedSM2.nextReviewDate,
				lastReviewDate: reviewDate,
				lastPerformanceRating: rating
			});
		}

		dispatch('complete', updates);
		isOpen = false;
	};

	const handleCancel = () => {
		dispatch('cancel');
		isOpen = false;
	};

	const allRated = () => {
		return subtopics.every(subtopic => ratings[subtopic.id] !== undefined);
	};
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 class="text-xl font-semibold text-gray-900">Rate Your Performance</h2>
				<p class="text-sm text-gray-600 mt-1">
					How well did you recall each subtopic? This helps optimize your review schedule.
				</p>
			</div>

			<div class="p-6 overflow-y-auto max-h-[60vh]">
				<div class="space-y-6">
					{#each subtopics as subtopic}
						<div class="border border-gray-200 rounded-lg p-4">
							<h3 class="font-medium text-gray-900 mb-3">{subtopic.name}</h3>
							
							<div class="space-y-2">
								{#each Object.entries(ratingDescriptions) as [value, description]}
									<label class="flex items-center space-x-3 cursor-pointer">
										<input
											type="radio"
											bind:group={ratings[subtopic.id]}
											value={parseInt(value)}
											class="text-indigo-600 focus:ring-indigo-500"
										/>
										<span class="flex-1">
											<span class="font-medium text-gray-700">{value}</span>
											<span class="text-gray-600 ml-2">{description}</span>
										</span>
									</label>
								{/each}
							</div>

							<div class="mt-3 text-xs text-gray-500">
								Current: {subtopic.repetitions} repetitions, 
								next review in {subtopic.interval} day{subtopic.interval === 1 ? '' : 's'}
							</div>
						</div>
					{/each}
				</div>
			</div>

			<div class="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
				<button
					type="button"
					on:click={handleCancel}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={handleSubmit}
					disabled={!allRated()}
					class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Update Review Schedule
				</button>
			</div>
		</div>
	</div>
{/if}
