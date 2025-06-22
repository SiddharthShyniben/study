<script lang="ts">
	import { onMount } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { suggestionsStore } from '$lib/stores/suggestions';
	import { goto } from '$app/navigation';
	import { updateSubtopic } from '$lib/firebase/firestore';
	import getStudySuggestions, { type SuggestionItem } from '$lib/suggestions/engine';
	import { derived } from 'svelte/store';

	// Replace reactive statements with derived stores
	const reviewSuggestions = derived(
		[() => suggestions],
		([$suggestions]) => $suggestions.filter(s => s.type === 'review')
	);

	const grindSuggestions = derived(
		[() => suggestions],
		([$suggestions]) => $suggestions.filter(s => s.type === 'grind')
	);

	const selectedDuration = derived(
		[() => selectedIds, () => suggestions],
		([$selectedIds, $suggestions]) => 
			$selectedIds.reduce((total, id) => {
				const suggestion = $suggestions.find(s => s.id === id);
				return total + (suggestion?.type === 'review' ? 5 : 15);
			}, 0)
	);

	// AI Suggestions state
	$: smartSuggestions = $suggestionsStore.suggestions;
	$: smartSuggestionsLoading = $suggestionsStore.loading;
	$: smartSuggestionsError = $suggestionsStore.error;

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	$: reviewSuggestions = $reviewSuggestions;
	$: grindSuggestions = $grindSuggestions;
	$: selectedDuration = $selectedDuration;

	const loadSuggestions = async () => {
		if (!$user) return;

		loading = true;
		error = '';

		try {
			// Load study suggestions
			const result = await getStudySuggestions($user.uid, {
				maxReviewItems: 15,
				maxGrindItems: 8,
				maxNewItemsPerDay: 5
			});

			suggestions = result.suggestions;
			estimatedDuration = result.estimatedDuration;
			loading = false;

			// Load AI suggestions
			await suggestionsStore.loadSuggestions($user.uid);
		} catch (err) {
			console.error('Error loading suggestions:', err);
			error = 'Failed to load study suggestions';
		} finally {
			loading = false;
		}
	};

	const postponeSuggestion = async (subtopicId: string, days: number) => {
		try {
			const postponeUntil = new Date();
			postponeUntil.setDate(postponeUntil.getDate() + days);

			await updateSubtopic(subtopicId, {
				postponedUntil
			} as any);

			// Remove from current suggestions
			suggestions = suggestions.filter(s => s.id !== subtopicId);
			selectedIds = selectedIds.filter(id => id !== subtopicId);
		} catch (err) {
			console.error('Error postponing suggestion:', err);
			error = 'Failed to postpone item';
		}
	};

	const toggleSelection = (subtopicId: string) => {
		if (selectedIds.includes(subtopicId)) {
			selectedIds = selectedIds.filter(id => id !== subtopicId);
		} else {
			selectedIds = [...selectedIds, subtopicId];
		}
	};

	const startStudySession = () => {
		if (selectedIds.length === 0) return;

		const reviewIds = selectedIds.filter(id => 
			suggestions.find(s => s.id === id)?.type === 'review'
		);
		const grindIds = selectedIds.filter(id => 
			suggestions.find(s => s.id === id)?.type === 'grind'
		);

		const params = new URLSearchParams();
		if (reviewIds.length > 0) {
			params.set('reviewIds', reviewIds.join(','));
		}
		if (grindIds.length > 0) {
			params.set('grindIds', grindIds.join(','));
		}

		goto(`/study?${params.toString()}`);
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'not_started': return 'bg-gray-100 text-gray-800';
			case 'learning': return 'bg-blue-100 text-blue-800';
			case 'reviewing': return 'bg-yellow-100 text-yellow-800';
			case 'mastered': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
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

	onMount(() => {
		if ($user && !$authLoading) {
			loadSuggestions();
		}
	});

	$: if (!$authLoading && $user && loading) {
		loadSuggestions();
	}
</script>

<svelte:head>
	<title>Study Suggestions</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">{$authLoading ? 'Loading...' : 'Loading suggestions...'}</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<!-- Smart Study Insights Section -->
			<div class="mb-8">
				<div class="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
					<div class="flex items-center justify-between mb-4">
						<div>
							<h2 class="text-2xl font-bold">Smart Study Insights</h2>
							<p class="text-indigo-100">AI-powered recommendations based on your study patterns</p>
						</div>
						{#if $user && !smartSuggestionsLoading}
							<button
								on:click={() => suggestionsStore.refresh($user.uid)}
								class="bg-white bg-opacity-20 hover:bg-opacity-30 text-grey-200 px-4 py-2 rounded-lg transition-colors duration-200"
							>
								Refresh
							</button>
						{/if}
					</div>

					{#if smartSuggestionsLoading}
						<div class="flex items-center space-x-3">
							<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span>Analyzing your study patterns...</span>
						</div>
					{:else if smartSuggestionsError}
						<div class="bg-red-500 bg-opacity-20 border border-red-300 rounded-lg p-4">
							<p class="text-red-100">Failed to load insights: {smartSuggestionsError}</p>
						</div>
					{:else if smartSuggestions.length > 0}
						<div class="space-y-3">
							{#each smartSuggestions as suggestion, index}
								<div class="bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20">
									<div class="flex items-start space-x-3">
										<div class="flex-shrink-0 w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
											<span class="text-sm font-medium text-grey-900">{index + 1}</span>
										</div>
										<p class="text-grey-900 leading-relaxed">{suggestion}</p>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="bg-white bg-opacity-10 rounded-lg p-4 border border-white border-opacity-20">
							<p class="text-white">You're doing great! No specific suggestions today.</p>
						</div>
					{/if}
				</div>
			</div>

			<div class="text-center mb-8">
				<h1 class="text-3xl font-extrabold text-gray-900">Study Suggestions</h1>
				<p class="mt-4 text-lg text-gray-600">
					Intelligent recommendations using spaced repetition and difficulty analysis
				</p>
				{#if estimatedDuration > 0}
					<p class="mt-2 text-sm text-gray-500">
						Estimated session time: <span class="font-medium">{estimatedDuration} minutes</span>
					</p>
				{/if}
			</div>

			{#if error}
				<div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			{/if}

			<!-- Fixed Action Bar -->
			{#if selectedIds.length > 0}
				<div class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4 shadow-lg z-10">
					<div class="max-w-6xl mx-auto flex items-center justify-between">
						<div class="text-sm text-gray-600">
							<span class="font-medium">{selectedIds.length}</span> items selected
							{#if selectedDuration > 0}
								• <span class="font-medium">~{selectedDuration} min</span> estimated
							{/if}
						</div>
						<div class="flex space-x-3">
							<button
								on:click={() => selectedIds = []}
								class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
							>
								Clear
							</button>
							<button
								on:click={startStudySession}
								class="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
							>
								Start Study Session
							</button>
						</div>
					</div>
				</div>
			{/if}

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">
				<!-- Review Section -->
				<div>
					<div class="flex items-center mb-4">
						<span class="text-2xl mr-2">🧠</span>
						<h2 class="text-xl font-semibold text-gray-900">Review Due</h2>
						<span class="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
							{reviewSuggestions.length}
						</span>
					</div>

					{#if reviewSuggestions.length === 0}
						<div class="bg-white rounded-lg shadow p-6 text-center">
							<p class="text-gray-600">No reviews due! 🎉</p>
							<p class="text-sm text-gray-500 mt-1">Great job staying on top of your studies</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each reviewSuggestions as suggestion}
								<div class="bg-white rounded-lg shadow border-2 transition-all duration-200 {selectedIds.includes(suggestion.id) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}">
									<div class="p-4">
										<div class="flex items-start justify-between">
											<div class="flex items-start space-x-3 flex-1">
												<button
													on:click={() => toggleSelection(suggestion.id)}
													class="mt-1 w-4 h-4 rounded border-2 flex items-center justify-center {selectedIds.includes(suggestion.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-gray-400'}"
												>
													{#if selectedIds.includes(suggestion.id)}
														<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
															<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
														</svg>
													{/if}
												</button>

												<div class="flex-1 min-w-0">
													<div class="flex items-center space-x-2 mb-1">
														<h3 class="text-sm font-medium text-gray-900 truncate">{suggestion.name}</h3>
														<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(suggestion.status)}">
															{suggestion.status.replace('_', ' ')}
														</span>
													</div>

													{#if suggestion.chapter}
														<p class="text-xs text-gray-600 mb-2">
															{suggestion.chapter.subject} • {suggestion.chapter.name}
														</p>
													{/if}

													<div class="flex items-center space-x-4 text-xs text-gray-500">
														<span class="flex items-center">
															<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
																<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
															</svg>
															{formatDate(suggestion.nextReviewDate)}
														</span>
														<span>Rep: {suggestion.repetitions}</span>
														<span>EF: {suggestion.easeFactor.toFixed(1)}</span>
													</div>
												</div>
											</div>

											<!-- Postpone Button -->
											<div class="relative group ml-2">
												<button class="p-1 text-gray-400 hover:text-gray-600 rounded">
													<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
													</svg>
												</button>
												<div class="absolute right-0 top-6 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
													<button
														on:click={() => postponeSuggestion(suggestion.id, 1)}
														class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
													>
														+1 day
													</button>
													<button
														on:click={() => postponeSuggestion(suggestion.id, 3)}
														class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
													>
														+3 days
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Grind Section -->
				<div>
					<div class="flex items-center mb-4">
						<span class="text-2xl mr-2">🔥</span>
						<h2 class="text-xl font-semibold text-gray-900">Practice New/Difficult</h2>
						<span class="ml-2 bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
							{grindSuggestions.length}
						</span>
					</div>

					{#if grindSuggestions.length === 0}
						<div class="bg-white rounded-lg shadow p-6 text-center">
							<p class="text-gray-600">No practice items! 💪</p>
							<p class="text-sm text-gray-500 mt-1">Focus on reviews or add more topics</p>
						</div>
					{:else}
						<div class="space-y-3">
							{#each grindSuggestions as suggestion}
								<div class="bg-white rounded-lg shadow border-2 transition-all duration-200 {selectedIds.includes(suggestion.id) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300'}">
									<div class="p-4">
										<div class="flex items-start justify-between">
											<div class="flex items-start space-x-3 flex-1">
												<button
													on:click={() => toggleSelection(suggestion.id)}
													class="mt-1 w-4 h-4 rounded border-2 flex items-center justify-center {selectedIds.includes(suggestion.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-gray-400'}"
												>
													{#if selectedIds.includes(suggestion.id)}
														<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
															<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
														</svg>
													{/if}
												</button>

												<div class="flex-1 min-w-0">
													<div class="flex items-center space-x-2 mb-1">
														<h3 class="text-sm font-medium text-gray-900 truncate">{suggestion.name}</h3>
														<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(suggestion.status)}">
															{suggestion.status.replace('_', ' ')}
														</span>
													</div>

													{#if suggestion.chapter}
														<p class="text-xs text-gray-600 mb-2">
															{suggestion.chapter.subject} • {suggestion.chapter.name}
														</p>
													{/if}

													<div class="flex items-center space-x-4 text-xs text-gray-500">
														<span class="flex items-center {suggestion.easeFactor <= 1.8 ? 'text-red-600' : suggestion.easeFactor <= 2.0 ? 'text-orange-600' : 'text-yellow-600'}">
															<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
																<path fill-rule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clip-rule="evenodd" />
															</svg>
															{suggestion.easeFactor <= 1.8 ? 'Very Hard' : suggestion.easeFactor <= 2.0 ? 'Hard' : 'Medium'}
														</span>
														<span>EF: {suggestion.easeFactor.toFixed(1)}</span>
														{#if suggestion.tags.length > 0}
															<span class="flex items-center">
																<svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
																	<path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
																</svg>
																{suggestion.tags.slice(0, 2).join(', ')}{suggestion.tags.length > 2 ? '...' : ''}
															</span>
														{/if}
													</div>
												</div>
											</div>

											<!-- Postpone Button -->
											<div class="relative group ml-2">
												<button class="p-1 text-gray-400 hover:text-gray-600 rounded">
													<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
													</svg>
												</button>
												<div class="absolute right-0 top-6 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
													<button
														on:click={() => postponeSuggestion(suggestion.id, 1)}
														class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
													>
														Hide 1 day
													</button>
													<button
														on:click={() => postponeSuggestion(suggestion.id, 3)}
														class="block px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 w-full text-left"
													>
														Hide 3 days
													</button>
												</div>
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
