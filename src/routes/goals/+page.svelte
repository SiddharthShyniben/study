<script lang="ts">
	import { onMount } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { getUserStudyGoals, getUserExams } from '$lib/firebase/firestore';
	import { generateOrUpdateGoals } from '$lib/goals/goalEngine';
	import type { StudyGoal, Exam } from '$lib/firebase/schema';

	let goals: StudyGoal[] = [];
	let exams: Exam[] = [];
	let loading = true;
	let refreshing = false;
	let error = '';

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	$: weeklyGoals = goals.filter(g => g.period === 'weekly');
	$: monthlyGoals = goals.filter(g => g.period === 'monthly');

	const loadGoalsAndExams = async () => {
		if (!$user) return;

		loading = true;
		error = '';

		try {
			const [goalsData, examsData] = await Promise.all([
				getUserStudyGoals($user.uid),
				getUserExams($user.uid)
			]);
			
			goals = goalsData;
			exams = examsData;
		} catch (err) {
			console.error('Error loading goals and exams:', err);
			error = 'Failed to load goals and exams';
		} finally {
			loading = false;
		}
	};

	const refreshGoals = async () => {
		if (!$user) return;

		refreshing = true;
		error = '';

		try {
			await generateOrUpdateGoals($user.uid);
			await loadGoalsAndExams();
		} catch (err) {
			console.error('Error refreshing goals:', err);
			error = 'Failed to refresh goals';
		} finally {
			refreshing = false;
		}
	};

	const getProgressPercentage = (actual: number, target: number): number => {
		if (target === 0) return 100;
		return Math.min(100, Math.round((actual / target) * 100));
	};

	const getProgressColor = (percentage: number): string => {
		if (percentage >= 100) return 'bg-green-500';
		if (percentage >= 75) return 'bg-yellow-500';
		if (percentage >= 50) return 'bg-orange-500';
		return 'bg-red-500';
	};

	const getStatusColor = (status: string): string => {
		switch (status) {
			case 'completed': return 'bg-green-100 text-green-800';
			case 'active': return 'bg-blue-100 text-blue-800';
			case 'failed': return 'bg-red-100 text-red-800';
			case 'paused': return 'bg-gray-100 text-gray-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const formatDate = (date: Date) => {
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	};

	const formatDateRange = (start: Date, end: Date) => {
		const startStr = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric'
		}).format(start);
		
		const endStr = new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(end);
		
		return `${startStr} - ${endStr}`;
	};

	const isCurrentPeriod = (goal: StudyGoal): boolean => {
		const now = new Date();
		return now >= goal.startDate && now <= goal.endDate;
	};

	onMount(() => {
		if ($user && !$authLoading) {
			loadGoalsAndExams();
		}
	});

	$: if (!$authLoading && $user && loading) {
		loadGoalsAndExams();
	}
</script>

<svelte:head>
	<title>Goals</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">{$authLoading ? 'Loading...' : 'Loading goals...'}</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-3xl font-extrabold text-gray-900">Study Goals</h1>
					<p class="mt-2 text-gray-600">Track your progress toward exam readiness</p>
				</div>
				<button
					on:click={refreshGoals}
					disabled={refreshing}
					class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
				>
					{refreshing ? 'Refreshing...' : 'Refresh Goals'}
				</button>
			</div>

			{#if error}
				<div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
					{error}
				</div>
			{/if}

			{#if exams.length === 0}
				<div class="bg-white rounded-lg shadow p-8 text-center">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 48 48">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900">No exams found</h3>
					<p class="mt-1 text-sm text-gray-500">Add exams to generate study goals automatically.</p>
					<div class="mt-6">
						<a
							href="/exams"
							class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
						>
							Add Exam
						</a>
					</div>
				</div>
			{:else}
				<div class="space-y-8">
					<!-- Upcoming Exams Overview -->
					<div class="bg-white rounded-lg shadow p-6">
						<h2 class="text-lg font-medium text-gray-900 mb-4">Upcoming Exams</h2>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each exams.filter(exam => new Date(exam.date) > new Date()) as exam}
								{@const daysUntil = Math.ceil((new Date(exam.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
								<div class="border border-gray-200 rounded-lg p-4">
									<h3 class="font-medium text-gray-900">{exam.name}</h3>
									<p class="text-sm text-gray-600 mt-1">{formatDate(exam.date)}</p>
									<div class="mt-2 flex items-center justify-between">
										<span class="text-xs text-gray-500">Target: {exam.targetCompletionPercentage}%</span>
										<span class="text-xs font-medium {daysUntil <= 7 ? 'text-red-600' : daysUntil <= 30 ? 'text-orange-600' : 'text-green-600'}">
											{daysUntil} days
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Weekly Goals -->
					<div class="bg-white rounded-lg shadow p-6">
						<h2 class="text-lg font-medium text-gray-900 mb-4">Weekly Goals</h2>
						{#if weeklyGoals.length === 0}
							<p class="text-gray-600 text-center py-4">No weekly goals generated yet.</p>
						{:else}
							<div class="space-y-4">
								{#each weeklyGoals as goal}
									{@const subtopicProgress = getProgressPercentage(goal.actualSubtopicsCovered, goal.targetSubtopics)}
									{@const hoursProgress = getProgressPercentage(goal.actualHoursSpent, goal.targetHours)}
									{@const isCurrent = isCurrentPeriod(goal)}
									
									<div class="border border-gray-200 rounded-lg p-4 {isCurrent ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}">
										<div class="flex items-center justify-between mb-3">
											<div>
												<h3 class="font-medium text-gray-900">
													{formatDateRange(goal.startDate, goal.endDate)}
													{#if isCurrent}
														<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
															Current
														</span>
													{/if}
												</h3>
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(goal.status)}">
													{goal.status}
												</span>
											</div>
											{#if goal.behindBy.subtopics > 0 || goal.behindBy.hours > 0}
												<div class="text-right text-sm text-red-600">
													Behind by:
													{#if goal.behindBy.subtopics > 0}
														<div>{goal.behindBy.subtopics} subtopics</div>
													{/if}
													{#if goal.behindBy.hours > 0}
														<div>{goal.behindBy.hours.toFixed(1)} hours</div>
													{/if}
												</div>
											{/if}
										</div>

										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<div class="flex justify-between text-sm text-gray-600 mb-1">
													<span>Subtopics</span>
													<span>{goal.actualSubtopicsCovered} / {goal.targetSubtopics}</span>
												</div>
												<div class="w-full bg-gray-200 rounded-full h-2">
													<div class="h-2 rounded-full {getProgressColor(subtopicProgress)}" style="width: {subtopicProgress}%"></div>
												</div>
												<div class="text-xs text-gray-500 mt-1">{subtopicProgress}% complete</div>
											</div>

											<div>
												<div class="flex justify-between text-sm text-gray-600 mb-1">
													<span>Study Hours</span>
													<span>{goal.actualHoursSpent.toFixed(1)} / {goal.targetHours.toFixed(1)}</span>
												</div>
												<div class="w-full bg-gray-200 rounded-full h-2">
													<div class="h-2 rounded-full {getProgressColor(hoursProgress)}" style="width: {hoursProgress}%"></div>
												</div>
												<div class="text-xs text-gray-500 mt-1">{hoursProgress}% complete</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Monthly Goals -->
					<div class="bg-white rounded-lg shadow p-6">
						<h2 class="text-lg font-medium text-gray-900 mb-4">Monthly Goals</h2>
						{#if monthlyGoals.length === 0}
							<p class="text-gray-600 text-center py-4">No monthly goals generated yet.</p>
						{:else}
							<div class="space-y-4">
								{#each monthlyGoals as goal}
									{@const subtopicProgress = getProgressPercentage(goal.actualSubtopicsCovered, goal.targetSubtopics)}
									{@const hoursProgress = getProgressPercentage(goal.actualHoursSpent, goal.targetHours)}
									{@const isCurrent = isCurrentPeriod(goal)}
									
									<div class="border border-gray-200 rounded-lg p-4 {isCurrent ? 'ring-2 ring-indigo-500 border-indigo-500' : ''}">
										<div class="flex items-center justify-between mb-3">
											<div>
												<h3 class="font-medium text-gray-900">
													{formatDateRange(goal.startDate, goal.endDate)}
													{#if isCurrent}
														<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
															Current
														</span>
													{/if}
												</h3>
												<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getStatusColor(goal.status)}">
													{goal.status}
												</span>
											</div>
											{#if goal.behindBy.subtopics > 0 || goal.behindBy.hours > 0}
												<div class="text-right text-sm text-red-600">
													Behind by:
													{#if goal.behindBy.subtopics > 0}
														<div>{goal.behindBy.subtopics} subtopics</div>
													{/if}
													{#if goal.behindBy.hours > 0}
														<div>{goal.behindBy.hours.toFixed(1)} hours</div>
													{/if}
												</div>
											{/if}
										</div>

										<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
											<div>
												<div class="flex justify-between text-sm text-gray-600 mb-1">
													<span>Subtopics</span>
													<span>{goal.actualSubtopicsCovered} / {goal.targetSubtopics}</span>
												</div>
												<div class="w-full bg-gray-200 rounded-full h-2">
													<div class="h-2 rounded-full {getProgressColor(subtopicProgress)}" style="width: {subtopicProgress}%"></div>
												</div>
												<div class="text-xs text-gray-500 mt-1">{subtopicProgress}% complete</div>
											</div>

											<div>
												<div class="flex justify-between text-sm text-gray-600 mb-1">
													<span>Study Hours</span>
													<span>{goal.actualHoursSpent.toFixed(1)} / {goal.targetHours.toFixed(1)}</span>
												</div>
												<div class="w-full bg-gray-200 rounded-full h-2">
													<div class="h-2 rounded-full {getProgressColor(hoursProgress)}" style="width: {hoursProgress}%"></div>
												</div>
												<div class="text-xs text-gray-500 mt-1">{hoursProgress}% complete</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
