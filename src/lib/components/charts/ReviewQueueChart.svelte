<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	export let data: { label: string; count: number }[];

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	const colors = [
		'rgba(239, 68, 68, 0.8)',   // Red for today
		'rgba(245, 158, 11, 0.8)',  // Orange for 1-3 days
		'rgba(59, 130, 246, 0.8)',  // Blue for 4-7 days
		'rgba(16, 185, 129, 0.8)',  // Green for 1-2 weeks
		'rgba(107, 114, 128, 0.8)'  // Gray for 2+ weeks
	];

	onMount(() => {
		Chart.register(...registerables);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.map(d => d.label),
				datasets: [{
					label: 'Subtopics',
					data: data.map(d => d.count),
					backgroundColor: colors,
					borderColor: colors.map(color => color.replace('0.8', '1')),
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						},
						title: {
							display: true,
							text: 'Number of Subtopics'
						}
					},
					x: {
						title: {
							display: true,
							text: 'Review Timeline'
						}
					}
				},
				plugins: {
					legend: {
						display: false
					}
				}
			}
		});

		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});

	$: if (chart && data) {
		chart.data.labels = data.map(d => d.label);
		chart.data.datasets[0].data = data.map(d => d.count);
		chart.update();
	}
</script>

<div class="relative h-64">
	<canvas bind:this={canvas}></canvas>
</div>
