<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { 
		getUserChapters, 
		getChapterSubtopics, 
		createStudySession,
		updateSubtopic 
	} from '$lib/firebase/firestore';
	import { updateSM2 } from '$lib/utils/sm2';
	import type { Subtopic, Chapter } from '$lib/firebase/schema';
	import StudyTimer from '$lib/components/StudyTimer.svelte';
	import ReviewDialog from '$lib/components/ReviewDialog.svelte';

	interface SubtopicWithChapter extends Subtopic {
		chapter?: Chapter;
	}

	let chapters: Chapter[] = [];
	let subtopicsByChapter: { [chapterId: string]: Subtopic[] } = {};
	let selectedSubtopicIds: string[] = [];
	let sessionType: 'grind' | 'review' | 'problem-solving' | 'reading' = 'grind';
	let notes = '';
	let manualMode = false;
	let manualStartTime = '';
	let manualEndTime = '';

	// Timer state
	let isTracking = false;
	let startTime: Date | null = null;
	let endTime: Date | null = null;
	let duration = 0;

	// Review state
	let showReviewDialog = false;
	let reviewSubtopics: SubtopicWithChapter[] = [];

	let loading = true;
	let saving = false;
	let error = '';

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	$: selectedSubtopics = selectedSubtopicIds
		.map(id => Object.values(subtopicsByChapter).flat().find(s => s.id === id))
		.filter(Boolean) as Subtopic[];

	const loadUserData = async () => {
		if (!$user) return;
		
		loading = true;
		try {
			chapters = await getUserChapters($user.uid);
			
			for (const chapter of chapters) {
				subtopicsByChapter[chapter.id] = await getChapterSubtopics(chapter.id);
			}
		} catch (err) {
			console.error('Error loading user data:', err);
			error = 'Failed to load chapters and subtopics';
		} finally {
			loading = false;
		}
	};

	const handleTimerStart = (sessionStartTime: Date) => {
		startTime = sessionStartTime;
		isTracking = true;
	};

	const handleTimerStop = (sessionEndTime: Date, sessionDuration: number) => {
		endTime = sessionEndTime;
		duration = sessionDuration;
		isTracking = false;
		
		completeSession();
	};

	const handleManualSubmit = () => {
		if (!manualStartTime || !manualEndTime) {
			error = 'Please provide both start and end times';
			return;
		}

		const start = new Date(manualStartTime);
		const end = new Date(manualEndTime);

		if (start >= end) {
			error = 'End time must be after start time';
			return;
		}

		startTime = start;
		endTime = end;
		duration = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
		
		completeSession();
	};

	const completeSession = async () => {
		if (!$user || !startTime || !endTime || selectedSubtopicIds.length === 0) {
			error = 'Invalid session data';
			return;
		}

		// Check if any subtopics were due for review
		const now = new Date();
		const reviewedSubtopics: SubtopicWithChapter[] = [];
		
		for (const subtopicId of selectedSubtopicIds) {
			const subtopic = Object.values(subtopicsByChapter).flat().find(s => s.id === subtopicId);
			if (subtopic && subtopic.nextReviewDate <= now) {
				const chapter = chapters.find(c => c.id === subtopic.parentChapterId);
				reviewedSubtopics.push({ ...subtopic, chapter });
			}
		}

		// If this was a review session and we have reviewed subtopics, show rating dialog
		if (sessionType === 'review' && reviewedSubtopics.length > 0) {
			reviewSubtopics = reviewedSubtopics;
			showReviewDialog = true;
		} else {
			await saveSession();
		}
	};

	const saveSession = async () => {
		if (!$user || !startTime || !endTime) return;

		saving = true;
		error = '';

		try {
			const chapterIds = [...new Set(selectedSubtopics.map(s => s.parentChapterId))];

			const data = {
				userId: $user.uid,
				startTime,
				endTime,
				duration,
				chapterIdsStudied: chapterIds,
				subtopicIdsStudied: selectedSubtopicIds,
				type: sessionType === 'grind' ? 'focused_study' : 
					  sessionType === 'review' ? 'review' :
					  sessionType === 'problem-solving' ? 'practice_test' : 'reading',
			}

			if (notes.trim()) {
				data.notes = notes.trim();
			}

			await createStudySession(data);

			resetSession();
			goto('/');
		} catch (err) {
			console.error('Error saving session:', err);
			error = 'Failed to save session';
		} finally {
			saving = false;
		}
	};

	const handleReviewComplete = async (updates: any[]) => {
		saving = true;
		
		try {
			// Update SM-2 parameters for reviewed subtopics
			for (const update of updates) {
				await updateSubtopic(update.subtopicId, {
					easeFactor: update.easeFactor,
					interval: update.interval,
					repetitions: update.repetitions,
					nextReviewDate: update.nextReviewDate,
					lastReviewDate: update.lastReviewDate,
					lastPerformanceRating: update.lastPerformanceRating
				});
			}

			await saveSession();
		} catch (err) {
			console.error('Error updating review data:', err);
			error = 'Failed to update review data';
		} finally {
			saving = false;
		}
	};

	const resetSession = () => {
		selectedSubtopicIds = [];
		notes = '';
		manualStartTime = '';
		manualEndTime = '';
		startTime = null;
		endTime = null;
		duration = 0;
		isTracking = false;
		showReviewDialog = false;
		reviewSubtopics = [];
		error = '';
	};

	const toggleSubtopicSelection = (subtopicId: string) => {
		if (selectedSubtopicIds.includes(subtopicId)) {
			selectedSubtopicIds = selectedSubtopicIds.filter(id => id !== subtopicId);
		} else {
			selectedSubtopicIds = [...selectedSubtopicIds, subtopicId];
		}
	};

	onMount(() => {
		if ($user && !$authLoading) {
			loadUserData();
		}
	});

	$: if (!$authLoading && $user && loading) {
		loadUserData();
	}
</script>

<svelte:head>
	<title>Track Study Session</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">{$authLoading ? 'Loading...' : 'Loading data...'}</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="text-center mb-8">
				<h1 class="text-3xl font-extrabold text-gray-900">Track Study Session</h1>
				<p class="mt-4 text-lg text-gray-600">
					Record your study time and track progress on specific subtopics
				</p>
			</div>

			{#if error}
				<div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			{/if}

			<div class="bg-white rounded-lg shadow p-6">
				<!-- Mode Toggle -->
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-xl font-semibold text-gray-900">Session Tracking</h2>
					<div class="flex space-x-2">
						<button
							on:click={() => { manualMode = false; resetSession(); }}
							class="px-3 py-1 text-sm rounded {!manualMode ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}"
						>
							Live Timer
						</button>
						<button
							on:click={() => { manualMode = true; resetSession(); }}
							class="px-3 py-1 text-sm rounded {manualMode ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}"
						>
							Manual Entry
						</button>
					</div>
				</div>

				<!-- Session Type -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">Session Type</label>
					<select 
						bind:value={sessionType} 
						disabled={isTracking || saving}
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
					>
						<option value="grind">Focused Study</option>
						<option value="review">Review</option>
						<option value="problem-solving">Problem Solving</option>
						<option value="reading">Reading</option>
					</select>
				</div>

				<!-- Timer or Manual Time Entry -->
				{#if !manualMode}
					<StudyTimer
						disabled={selectedSubtopicIds.length === 0 || saving}
						on:start={(e) => handleTimerStart(e.detail)}
						on:stop={(e) => handleTimerStop(e.detail.endTime, e.detail.duration)}
					/>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
							<input
								type="datetime-local"
								bind:value={manualStartTime}
								disabled={saving}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
							/>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">End Time</label>
							<input
								type="datetime-local"
								bind:value={manualEndTime}
								disabled={saving}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
							/>
						</div>
					</div>
				{/if}

				<!-- Subtopic Selection -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-3">Select Subtopics Studied</label>
					<div class="space-y-4 max-h-64 overflow-y-auto">
						{#each chapters as chapter}
							<div class="border border-gray-200 rounded-lg p-3">
								<h4 class="font-medium text-gray-900 mb-2">{chapter.name} ({chapter.subject})</h4>
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
									{#each subtopicsByChapter[chapter.id] || [] as subtopic}
										<label class="flex items-center space-x-2 text-sm">
											<input
												type="checkbox"
												checked={selectedSubtopicIds.includes(subtopic.id)}
												on:change={() => toggleSubtopicSelection(subtopic.id)}
												disabled={isTracking || saving}
												class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
											/>
											<span class="text-gray-700">{subtopic.name}</span>
											<span class="text-xs text-gray-500">({subtopic.status})</span>
										</label>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Notes -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">Session Notes (Optional)</label>
					<textarea
						bind:value={notes}
						rows="3"
						disabled={saving}
						placeholder="Add any notes about this study session..."
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
					></textarea>
				</div>

				<!-- Action Buttons -->
				{#if manualMode}
					<div class="flex flex-col sm:flex-row gap-3">
						<button
							on:click={handleManualSubmit}
							disabled={saving || !manualStartTime || !manualEndTime || selectedSubtopicIds.length === 0}
							class="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{saving ? 'Saving...' : 'Save Session'}
						</button>
						
						<button
							on:click={resetSession}
							disabled={saving}
							class="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
						>
							Reset
						</button>
					</div>
				{/if}

				{#if selectedSubtopicIds.length > 0}
					<div class="mt-4 text-sm text-gray-600">
						Selected: {selectedSubtopicIds.length} subtopic{selectedSubtopicIds.length === 1 ? '' : 's'}
					</div>
				{/if}
			</div>
		</div>

		<!-- Review Rating Dialog -->
		<ReviewDialog
			bind:isOpen={showReviewDialog}
			subtopics={reviewSubtopics}
			on:complete={(e) => handleReviewComplete(e.detail)}
			on:cancel={() => { showReviewDialog = false; saveSession(); }}
		/>
	{/if}
</div>
