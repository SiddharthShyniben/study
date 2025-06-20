<script lang="ts">
	import { onMount } from 'svelte';
	import { user, authLoading } from '$lib/stores/auth';
	import { goto } from '$app/navigation';
	import StudyTimeChart from '$lib/components/charts/StudyTimeChart.svelte';
	import DifficultyChart from '$lib/components/charts/DifficultyChart.svelte';
	import ReviewQueueChart from '$lib/components/charts/ReviewQueueChart.svelte';
	import type { PageData } from './$types';

	export let data: PageData;

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	// Calculate stats
	$: last7DaysData = calculateLast7Days(data.studySessions);
	$: difficultyData = calculateDifficultyDistribution(data.subtopics);
	$: reviewQueueData = calculateReviewQueue(data.subtopics);

	function calculateLast7Days(sessions: any[]) {
		const today = new Date();
		const last7Days = [];
		
		for (let i = 6; i >= 0; i--) {
			const date = new Date(today);
			date.setDate(date.getDate() - i);
			date.setHours(0, 0, 0, 0);
			
			const nextDate = new Date(date);
			nextDate.setDate(nextDate.getDate() + 1);
			
			const dayTotal = sessions
				.filter(session => {
					const sessionDate = new Date(session.startTime);
					return sessionDate >= date && sessionDate < nextDate;
				})
				.reduce((total, session) => total + (session.duration || 0), 0);
			
			last7Days.push({
				date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
				duration: Math.round(dayTotal / 60 * 10) / 10 // Convert to hours
			});
		}
		
		return last7Days;
	}

	function calculateDifficultyDistribution(subtopics: any[]) {
		const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
		
		subtopics.forEach(subtopic => {
			const difficulty = subtopic.lastPerformanceRating || 3;
			if (difficulty >= 1 && difficulty <= 5) {
				distribution[difficulty]++;
			}
		});
		
		return [
			{ label: 'Very Easy (1)', value: distribution[1], color: '#10B981' },
			{ label: 'Easy (2)', value: distribution[2], color: '#84CC16' },
			{ label: 'Medium (3)', value: distribution[3], color: '#F59E0B' },
			{ label: 'Hard (4)', value: distribution[4], color: '#EF4444' },
			{ label: 'Very Hard (5)', value: distribution[5], color: '#DC2626' }
		];
	}

	function calculateReviewQueue(subtopics: any[]) {
		const now = new Date();
		const buckets = {
			'Today': 0,
			'1-3 days': 0,
			'4-7 days': 0,
			'1-2 weeks': 0,
			'2+ weeks': 0
		};
		
		subtopics.forEach(subtopic => {
			if (subtopic.status === 'mastered') return;
			
			const reviewDate = new Date(subtopic.nextReviewDate);
			const daysUntil = Math.ceil((reviewDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
			
			if (daysUntil <= 0) {
				buckets['Today']++;
			} else if (daysUntil <= 3) {
				buckets['1-3 days']++;
			} else if (daysUntil <= 7) {
				buckets['4-7 days']++;
			} else if (daysUntil <= 14) {
				buckets['1-2 weeks']++;
			} else {
				buckets['2+ weeks']++;
			}
		});
		
		return Object.entries(buckets).map(([label, count]) => ({ label, count }));
	}
</script>

<svelte:head>
	<title>Study Statistics</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">Loading...</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="text-center mb-8">
				<h1 class="text-3xl font-extrabold text-gray-900">Study Statistics</h1>
				<p class="mt-4 text-lg text-gray-600">
					Track your progress and analyze your study patterns
				</p>
			</div>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
				<!-- Study Time Chart -->
				<div class="bg-white rounded-lg shadow p-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4">Study Time (Last 7 Days)</h2>
					<StudyTimeChart data={last7DaysData} />
				</div>

				<!-- Difficulty Distribution -->
				<div class="bg-white rounded-lg shadow p-6">
					<h2 class="text-xl font-semibold text-gray-900 mb-4">Subtopic Difficulty Distribution</h2>
					<DifficultyChart data={difficultyData} />
				</div>
			</div>

			<!-- Review Queue -->
			<div class="bg-white rounded-lg shadow p-6">
				<h2 class="text-xl font-semibold text-gray-900 mb-4">Review Queue</h2>
				<ReviewQueueChart data={reviewQueueData} />
			</div>

			<!-- Summary Stats -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
				<div class="bg-white rounded-lg shadow p-6 text-center">
					<div class="text-3xl font-bold text-indigo-600">{data.studySessions.length}</div>
					<div class="text-sm text-gray-600">Total Sessions</div>
				</div>
				
				<div class="bg-white rounded-lg shadow p-6 text-center">
					<div class="text-3xl font-bold text-green-600">
						{Math.round(data.studySessions.reduce((total, session) => total + (session.duration || 0), 0) / 60 * 10) / 10}h
					</div>
					<div class="text-sm text-gray-600">Total Study Time</div>
				</div>
				
				<div class="bg-white rounded-lg shadow p-6 text-center">
					<div class="text-3xl font-bold text-yellow-600">
						{data.subtopics.filter(s => s.status === 'mastered').length}
					</div>
					<div class="text-sm text-gray-600">Mastered Subtopics</div>
				</div>
			</div>
		</div>
	{/if}
</div>
