<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Subtopic, Chapter } from '$lib/firebase/schema';

	const dispatch = createEventDispatcher<{
		toggle: void;
		postpone: { days: number };
		bury: { days: number };
	}>();

	export let subtopic: Subtopic & { chapter?: Chapter };
	export let type: 'review' | 'grind';
	export let selected = false;

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'not_started': return 'bg-gray-100 text-gray-800';
			case 'learning': return 'bg-blue-100 text-blue-800';
			case 'reviewing': return 'bg-yellow-100 text-yellow-800';
			case 'mastered': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const getDifficultyIndicator = (easeFactor: number) => {
		if (easeFactor <= 1.8) return { text: 'Very Hard', color: 'text-red-600' };
		if (easeFactor <= 2.0) return { text: 'Hard', color: 'text-orange-600' };
		if (easeFactor <= 2.5) return { text: 'Medium', color: 'text-yellow-600' };
		if (easeFactor <= 3.0) return { text: 'Easy', color: 'text-green-600' };
		return { text: 'Very Easy', color: 'text-blue-600' };
	};

	const formatDate = (date: Date) => {
		const today = new Date();
		const diffTime = date.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		if (diffDays === -1) return 'Yesterday';
		if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
		return `In ${diffDays} days`;
	};

	const difficulty = getDifficultyIndicator(subtopic.easeFactor);
</script>

<div class="bg-white rounded-lg shadow border-2 transition-all duration-200 {selected ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}">
	<div class="p-4">
		<div class="flex items-start justify-between">
			<div class="flex items-start space-x-3 flex-1">
				<button
					on:click={() => dispatch('toggle')}
					class="mt-1 w-4 h-4 rounded border-2 flex items-center justify-center {selected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-gray-400'}"
				>
					{#if selected}
						<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
					{/if}
				</button>

				<div class="flex-1 min-w-0">
					<div class="flex items-center space-x-2 mb-1">
						<h3 class="text-sm font-medium text-gray-900 truncate">{subtopic.name}</h3>
						<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(subtopic.status)}">
							{subtopic.status.replace('_', ' ')}
						</span>
					</div>

					{#if subtopic.chapter}
						<p class="text-xs text-gray-600 mb-2">
							{subtopic.chapter.subject} • {subtopic.chapter.name}
						</p>
					{/if}

					<div class="flex items-center space-x-4 text-xs text-gray-500">
						{#if type === 'review'}
							<span class="flex items-center">
								<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
								</svg>
								{formatDate(subtopic.nextReviewDate)}
							</span>
							<span>Rep: {subtopic.repetitions}</span>
						{:else}
							<span class="flex items-center {difficulty.color}">
								<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd" />
								</svg>
								{difficulty.text}
							</span>
						{/if}

						{#if subtopic.tags.length > 0}
							<span class="flex items-center">
								<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
								</svg>
								{subtopic.tags.slice(0, 2).join(', ')}{subtopic.tags.length > 2 ? '...' : ''}
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex items-center space-x-1 ml-2">
				{#if type === 'review'}
					<div class="relative group">
						<button class="p-1 text-gray-400 hover:text-gray-600 rounded">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
							</svg>
						</button>
						<div class="absolute right-0 top-6 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
							<button
								on:click={() => dispatch('postpone', { days: 1 })}
								class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
							>
								+1 day
							</button>
							<button
								on:click={() => dispatch('postpone', { days: 3 })}
								class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
							>
								+3 days
							</button>
						</div>
					</div>
				{:else}
					<div class="relative group">
						<button class="p-1 text-gray-400 hover:text-gray-600 rounded">
							<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
							</svg>
						</button>
						<div class="absolute right-0 top-6 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
							<button
								on:click={() => dispatch('bury', { days: 1 })}
								class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
							>
								Bury 1 day
							</button>
							<button
								on:click={() => dispatch('bury', { days: 3 })}
								class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
							>
								Bury 3 days
							</button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
