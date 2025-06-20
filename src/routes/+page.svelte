<script lang="ts">
	import { onMount } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import { 
		getUserChapters, 
		getChapterSubtopics, 
		getUserStudySessions 
	} from '$lib/firebase/firestore';
	import type { Subtopic, Chapter, StudySession } from '$lib/firebase/schema';

	let chapters: Chapter[] = [];
	let allSubtopics: Subtopic[] = [];
	let todaySessions: StudySession[] = [];
	let loading = true;

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	$: pendingReviews = allSubtopics.filter(subtopic => {
		const now = new Date();
		return subtopic.nextReviewDate <= now && 
			   (subtopic.status === 'learning' || subtopic.status === 'reviewing');
	}).length;

	$: todayMinutes = todaySessions.reduce((total, session) => {
		return total + (session.duration || 0);
	}, 0);

	$: masteredSubtopics = allSubtopics.filter(s => s.status === 'mastered').length;
	$: completionPercentage = allSubtopics.length > 0 
		? Math.round((masteredSubtopics / allSubtopics.length) * 100) 
		: 0;

	$: currentDay = new Date().toLocaleDateString('en-US', { 
		weekday: 'long', 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	});

	const loadDashboardData = async () => {
		if (!$user) return;

		loading = true;
		try {
			// Load chapters
			chapters = await getUserChapters($user.uid);
			
			// Load all subtopics
			allSubtopics = [];
			for (const chapter of chapters) {
				const subtopics = await getChapterSubtopics(chapter.id);
				allSubtopics.push(...subtopics);
			}

			// Load today's sessions
			const allSessions = await getUserStudySessions($user.uid, 50);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today);
			tomorrow.setDate(tomorrow.getDate() + 1);
			
			todaySessions = allSessions.filter(session => {
				const sessionDate = new Date(session.startTime);
				return sessionDate >= today && sessionDate < tomorrow;
			});

		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		if ($user && !$authLoading) {
			loadDashboardData();
		}
	});

	$: if (!$authLoading && $user && loading) {
		loadDashboardData();
	}
</script>

<svelte:head>
	<title>Study Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">Loading dashboard...</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<!-- Header -->
			<div class="text-center mb-8">
				<h1 class="text-4xl font-bold text-gray-900 mb-2">Welcome back!</h1>
				<p class="text-lg text-gray-600">{currentDay}</p>
				<p class="text-sm text-indigo-600 font-medium mt-2">You've got this 💪</p>
			</div>

			<!-- Overview Cards -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<span class="text-2xl">📚</span>
							</div>
							<div class="ml-5 w-0 flex-1">
								<dl>
									<dt class="text-sm font-medium text-gray-500 truncate">
										Pending Reviews
									</dt>
									<dd class="text-lg font-medium text-gray-900">
										{pendingReviews} subtopics due
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<span class="text-2xl">⏱</span>
							</div>
							<div class="ml-5 w-0 flex-1">
								<dl>
									<dt class="text-sm font-medium text-gray-500 truncate">
										Today's Study Time
									</dt>
									<dd class="text-lg font-medium text-gray-900">
										{Math.round(todayMinutes / 60 * 10) / 10} hours
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="p-5">
						<div class="flex items-center">
							<div class="flex-shrink-0">
								<span class="text-2xl">✅</span>
							</div>
							<div class="ml-5 w-0 flex-1">
								<dl>
									<dt class="text-sm font-medium text-gray-500 truncate">
										Syllabus Progress
									</dt>
									<dd class="text-lg font-medium text-gray-900">
										{completionPercentage}% completed
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Actions -->
			<div class="bg-white shadow rounded-lg p-6 mb-8">
				<h2 class="text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
				<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{#if pendingReviews > 0}
						<a
							href="/suggestions"
							class="group relative bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
						>
							<div class="flex items-center space-x-3">
								<span class="text-2xl">🧠</span>
								<div>
									<h3 class="text-lg font-medium">Start Studying</h3>
									<p class="text-sm text-blue-100">{pendingReviews} reviews due</p>
								</div>
							</div>
						</a>
					{:else}
						<a
							href="/track"
							class="group relative bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
						>
							<div class="flex items-center space-x-3">
								<span class="text-2xl">▶️</span>
								<div>
									<h3 class="text-lg font-medium">Start Session</h3>
									<p class="text-sm text-green-100">Track your study time</p>
								</div>
							</div>
						</a>
					{/if}

					<a
						href="/suggestions"
						class="group relative bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
					>
						<div class="flex items-center space-x-3">
							<span class="text-2xl">💡</span>
							<div>
								<h3 class="text-lg font-medium">Suggestions</h3>
								<p class="text-sm text-purple-100">AI-powered recommendations</p>
							</div>
						</div>
					</a>

					<a
						href="/goals"
						class="group relative bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
					>
						<div class="flex items-center space-x-3">
							<span class="text-2xl">🎯</span>
							<div>
								<h3 class="text-lg font-medium">Goals</h3>
								<p class="text-sm text-orange-100">Track your targets</p>
							</div>
						</div>
					</a>

					<a
						href="/setup/syllabus"
						class="group relative bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
					>
						<div class="flex items-center space-x-3">
							<span class="text-2xl">📖</span>
							<div>
								<h3 class="text-lg font-medium">Syllabus</h3>
								<p class="text-sm text-teal-100">Manage your topics</p>
							</div>
						</div>
					</a>

					<a
						href="/stats"
						class="group relative bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-white"
					>
						<div class="flex items-center space-x-3">
							<span class="text-2xl">📊</span>
							<div>
								<h3 class="text-lg font-medium">Statistics</h3>
								<p class="text-sm text-indigo-100">View your progress</p>
							</div>
						</div>
					</a>
				</div>
			</div>

			<!-- Recent Activity -->
			{#if todaySessions.length > 0}
				<div class="bg-white shadow rounded-lg p-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4">Today's Sessions</h2>
					<div class="space-y-3">
						{#each todaySessions.slice(0, 3) as session}
							<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
								<div class="flex items-center space-x-3">
									<span class="w-2 h-2 bg-green-500 rounded-full"></span>
									<div>
										<p class="text-sm font-medium text-gray-900">
											{session.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
										</p>
										<p class="text-xs text-gray-500">
											{session.subtopicIdsStudied.length} subtopic{session.subtopicIdsStudied.length === 1 ? '' : 's'}
										</p>
									</div>
								</div>
								<div class="text-right">
									<p class="text-sm font-medium text-gray-900">{session.duration} min</p>
									<p class="text-xs text-gray-500">
										{new Date(session.startTime).toLocaleTimeString('en-US', { 
											hour: 'numeric', 
											minute: '2-digit' 
										})}
									</p>
								</div>
							</div>
						{/each}
					</div>
					{#if todaySessions.length > 3}
						<div class="mt-4 text-center">
							<a href="/stats" class="text-sm text-indigo-600 hover:text-indigo-900">
								View all sessions →
							</a>
						</div>
					{/if}
				</div>
			{:else}
				<div class="bg-white shadow rounded-lg p-6 text-center">
					<span class="text-4xl mb-4 block">🚀</span>
					<h3 class="text-lg font-medium text-gray-900 mb-2">Ready to start studying?</h3>
					<p class="text-gray-600 mb-4">You haven't started any sessions today. Let's get learning!</p>
					<a
						href="/suggestions"
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
					>
						Get Started
					</a>
				</div>
			{/if}
		</div>
	{/if}
</div>
