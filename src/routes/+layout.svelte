<script lang="ts">
	import './layout.css';
	import Navigation from '$lib/components/Navigation.svelte';
	import { page } from '$app/state';
	import '$lib/stores/theme';

	let { children } = $props();

	let showNav = $derived(page.url.pathname !== '/auth' && page.url.pathname !== '/');
</script>

{#if showNav}
	<Navigation />
	<main class="min-h-screen bg-[#F0F4FF] pb-20 md:ml-64 md:pb-0 dark:bg-gray-900">
		{@render children()}
	</main>
{:else}
	{@render children()}
{/if}
