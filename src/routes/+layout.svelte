<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navigation from '$lib/components/Navigation.svelte';
	import { page } from '$app/state';

	let { children } = $props();

	let showNav = $derived(page.url.pathname !== '/auth' && page.url.pathname !== '/');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{#if showNav}
	<Navigation />
	<main class="min-h-screen bg-[#F0F4FF] pb-20 md:ml-64 md:pb-0">
		{@render children()}
	</main>
{:else}
	{@render children()}
{/if}
