<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	export let data: { label: string; value: number; color: string }[];

	let canvas: HTMLCanvasElement;
	let chart: Chart;

	onMount(() => {
		Chart.register(...registerables);

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		chart = new Chart(ctx, {
			type: 'pie',
			data: {
				labels: data.map(d => d.label),
				datasets: [{
					data: data.map(d => d.value),
					backgroundColor: data.map(d => d.color),
					borderWidth: 2,
					borderColor: '#ffffff'
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: {
							padding: 20,
							usePointStyle: true
						}
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
		chart.data.datasets[0].data = data.map(d => d.value);
		chart.data.datasets[0].backgroundColor = data.map(d => d.color);
		chart.update();
	}
</script>

<div class="relative h-64">
	<canvas bind:this={canvas}></canvas>
</div>
