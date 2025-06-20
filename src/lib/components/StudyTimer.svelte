<script lang="ts">
	import { createEventDispatcher, onDestroy } from 'svelte';

	const dispatch = createEventDispatcher<{
		start: Date;
		stop: { endTime: Date; duration: number };
	}>();

	export let disabled = false;

	let isTracking = false;
	let isPaused = false;
	let startTime: Date | null = null;
	let pausedDuration = 0;
	let elapsedTime = 0;
	let timerInterval: number | null = null;

	const startTimer = () => {
		if (disabled) return;

		startTime = new Date();
		isTracking = true;
		isPaused = false;
		pausedDuration = 0;
		elapsedTime = 0;

		startTimerInterval();
		dispatch('start', startTime);
	};

	const pauseTimer = () => {
		isPaused = true;
		stopTimerInterval();
	};

	const resumeTimer = () => {
		if (!startTime) return;
		
		const pauseStartTime = Date.now() - (elapsedTime * 1000);
		pausedDuration += Date.now() - pauseStartTime;
		
		isPaused = false;
		startTimerInterval();
	};

	const stopTimer = () => {
		if (!startTime) return;

		const endTime = new Date();
		const totalDuration = Math.floor((endTime.getTime() - startTime.getTime() - pausedDuration) / 1000 / 60);

		stopTimerInterval();
		resetTimer();

		dispatch('stop', { endTime, duration: totalDuration });
	};

	const resetTimer = () => {
		isTracking = false;
		isPaused = false;
		startTime = null;
		pausedDuration = 0;
		elapsedTime = 0;
		stopTimerInterval();
	};

	const startTimerInterval = () => {
		timerInterval = setInterval(() => {
			if (startTime && !isPaused) {
				elapsedTime = Math.floor((Date.now() - startTime.getTime() - pausedDuration) / 1000);
			}
		}, 1000);
	};

	const stopTimerInterval = () => {
		if (timerInterval) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const formatTime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		
		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
		}
		return `${minutes}:${secs.toString().padStart(2, '0')}`;
	};

	onDestroy(() => {
		stopTimerInterval();
	});
</script>

<div class="text-center mb-6">
	{#if isTracking}
		<div class="text-6xl font-mono font-bold text-indigo-600 mb-4">
			{formatTime(elapsedTime)}
		</div>
		<div class="text-sm text-gray-600 mb-4">
			{isPaused ? 'Paused' : 'Recording...'}
		</div>
		
		<div class="flex justify-center space-x-3">
			{#if !isPaused}
				<button
					on:click={pauseTimer}
					class="bg-yellow-600 text-white px-6 py-2 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
				>
					Pause
				</button>
			{:else}
				<button
					on:click={resumeTimer}
					class="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
				>
					Resume
				</button>
			{/if}
			
			<button
				on:click={stopTimer}
				class="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
			>
				Stop & Save
			</button>
			
			<button
				on:click={resetTimer}
				class="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
			>
				Cancel
			</button>
		</div>
	{:else}
		<div class="text-4xl font-mono font-bold text-gray-400 mb-4">
			0:00
		</div>
		<button
			on:click={startTimer}
			{disabled}
			class="bg-green-600 text-white px-8 py-3 rounded-md text-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Start Session
		</button>
		{#if disabled}
			<p class="mt-2 text-sm text-gray-500">Select at least one subtopic to start</p>
		{/if}
	{/if}
</div>
