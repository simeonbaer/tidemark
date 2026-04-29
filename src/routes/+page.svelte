<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(async () => {
		const userId = localStorage.getItem('userId');
		if (userId) {
			await goto('/battle');
		} else {
			await goto('/auth');
		}
	});
</script>

<div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
	<div class="text-center">
		<h1 class="text-4xl font-bold text-white mb-4">Tidemark</h1>
		<p class="text-white text-lg">Loading...</p>
	</div>
</div>
