<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	export let data: { date: string; duration: number }[];

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	onMount(() => {
		Chart.register(...registerables);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: data.map(d => d.date),
				datasets: [{
					label: 'Study Hours',
					data: data.map(d => d.duration),
					backgroundColor: 'rgba(99, 102, 241, 0.8)',
					borderColor: 'rgba(99, 102, 241, 1)',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					y: {
						beginAtZero: true,
						title: {
							display: true,
							text: 'Hours'
						}
					},
					x: {
						title: {
							display: true,
							text: 'Date'
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
		chart.data.labels = data.map(d => d.date);
		chart.data.datasets[0].data = data.map(d => d.duration);
		chart.update();
	}
</script>

<div class="relative h-64">
	<canvas bind:this={canvas}></canvas>
</div>
