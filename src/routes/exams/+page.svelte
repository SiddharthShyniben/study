<script lang="ts">
	import { onMount } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { createExam, getUserExams, deleteDocument } from '$lib/firebase/firestore';
	import type { Exam } from '$lib/firebase/schema';

	let exams: Exam[] = [];
	let loading = true;
	let saving = false;
	let error = '';
	let showForm = false;

	// Form fields
	let examName = '';
	let examDate = '';
	let targetPercentage = 80;

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	const loadExams = async () => {
		if (!$user) return;

		loading = true;
		try {
			exams = await getUserExams($user.uid);
		} catch (err) {
			console.error('Error loading exams:', err);
			error = 'Failed to load exams';
		} finally {
			loading = false;
		}
	};

	const saveExam = async () => {
		if (!$user || !examName.trim() || !examDate) {
			error = 'Please fill in all required fields';
			return;
		}

		saving = true;
		error = '';

		try {
			await createExam({
				name: examName.trim(),
				date: new Date(examDate),
				targetCompletionPercentage: targetPercentage,
				associatedChapterIds: [],
				associatedSubtopicIds: [],
				userId: $user.uid
			});

			// Reset form
			examName = '';
			examDate = '';
			targetPercentage = 80;
			showForm = false;

			// Reload exams
			await loadExams();
		} catch (err) {
			console.error('Error saving exam:', err);
			error = 'Failed to save exam';
		} finally {
			saving = false;
		}
	};

	const deleteExam = async (examId: string) => {
		if (!confirm('Are you sure you want to delete this exam?')) return;

		try {
			await deleteDocument('exams', examId);
			await loadExams();
		} catch (err) {
			console.error('Error deleting exam:', err);
			error = 'Failed to delete exam';
		}
	};

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}).format(date);
	};

	const getDaysUntil = (date: Date) => {
		const now = new Date();
		const diffTime = date.getTime() - now.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	};

	const getDateColor = (daysUntil: number) => {
		if (daysUntil < 0) return 'text-red-600';
		if (daysUntil <= 7) return 'text-orange-600';
		if (daysUntil <= 30) return 'text-yellow-600';
		return 'text-green-600';
	};

	onMount(() => {
		if ($user && !$authLoading) {
			loadExams();
		}
	});

	$: if (!$authLoading && $user && loading) {
		loadExams();
	}
</script>

<svelte:head>
	<title>Exams</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">{$authLoading ? 'Loading...' : 'Loading exams...'}</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-3xl font-extrabold text-gray-900">Exams</h1>
					<p class="mt-2 text-gray-600">Manage your upcoming exams and target completion rates</p>
				</div>
				<button
					on:click={() => showForm = !showForm}
					class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				>
					{showForm ? 'Cancel' : 'Add Exam'}
				</button>
			</div>

			{#if error}
				<div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			{/if}

			<!-- Add Exam Form -->
			{#if showForm}
				<div class="bg-white rounded-lg shadow p-6 mb-8">
					<h2 class="text-lg font-medium text-gray-900 mb-4">Add New Exam</h2>
					
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="md:col-span-2">
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Exam Name *
							</label>
							<input
								type="text"
								bind:value={examName}
								placeholder="e.g., JEE Main 2024"
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
							/>
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Exam Date *
							</label>
							<input
								type="date"
								bind:value={examDate}
								class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
							/>
						</div>

						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">
								Target Completion ({targetPercentage}%)
							</label>
							<input
								type="range"
								min="50"
								max="100"
								step="5"
								bind:value={targetPercentage}
								class="w-full"
							/>
							<div class="flex justify-between text-xs text-gray-500 mt-1">
								<span>50%</span>
								<span>100%</span>
							</div>
						</div>
					</div>

					<div class="mt-6 flex justify-end space-x-3">
						<button
							type="button"
							on:click={() => showForm = false}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
						>
							Cancel
						</button>
						<button
							type="button"
							on:click={saveExam}
							disabled={saving || !examName.trim() || !examDate}
							class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{saving ? 'Saving...' : 'Save Exam'}
						</button>
					</div>
				</div>
			{/if}

			<!-- Exams List -->
			{#if exams.length === 0}
				<div class="bg-white rounded-lg shadow p-8 text-center">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8s-16-3.582-16-8" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No exams</h3>
					<p class="mt-1 text-sm text-gray-500">Get started by adding your first exam.</p>
					<div class="mt-6">
						<button
							on:click={() => showForm = true}
							class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
						>
							Add Exam
						</button>
					</div>
				</div>
			{:else}
				<div class="space-y-4">
					{#each exams as exam}
						{@const daysUntil = getDaysUntil(exam.date)}
						<div class="bg-white rounded-lg shadow p-6">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<h3 class="text-lg font-medium text-gray-900">{exam.name}</h3>
									<div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
										<span class="flex items-center">
											<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
											</svg>
											{formatDate(exam.date)}
										</span>
										<span class="{getDateColor(daysUntil)} font-medium">
											{#if daysUntil < 0}
												{Math.abs(daysUntil)} days ago
											{:else if daysUntil === 0}
												Today
											{:else if daysUntil === 1}
												Tomorrow
											{:else}
												{daysUntil} days away
											{/if}
										</span>
										<span class="flex items-center">
											<svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clip-rule="evenodd" />
											</svg>
											Target: {exam.targetCompletionPercentage}%
										</span>
									</div>
								</div>
								
								<div class="flex items-center space-x-2">
									<a
										href="/goals"
										class="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
									>
										View Goals
									</a>
									<button
										on:click={() => deleteExam(exam.id)}
										class="text-red-600 hover:text-red-900 text-sm"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
