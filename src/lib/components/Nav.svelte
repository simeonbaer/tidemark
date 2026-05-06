<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let userName = $state('');

	onMount(() => {
		userName = localStorage.getItem('userName') || '';
	});

	function handleLogout() {
		localStorage.removeItem('userId');
		localStorage.removeItem('userName');
		goto('/auth');
	}

	const navLinks = [
		{ href: '/battle', label: 'Battle', icon: '⚔️' },
		{ href: '/activity-log', label: 'Activity Log', icon: '📋' },
		{ href: '/calendar', label: 'Calendar', icon: '📅' }
	];
</script>

<!-- Desktop top nav -->
<div class="mb-8 hidden items-center justify-between md:flex">
	<div class="flex items-center gap-8">
		<h1 class="text-3xl font-bold text-white">Tidemark</h1>
		<nav class="flex gap-2">
			{#each navLinks as link}
				<a
					href={link.href}
					class={`rounded-lg px-6 py-2 font-semibold transition ${
						page.url.pathname === link.href
							? 'bg-white text-[#1F41BB]'
							: 'bg-white/30 text-white hover:bg-white/50'
					}`}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</div>
	<div class="flex items-center gap-4">
		<span class="text-white">{userName}</span>
		<button
			onclick={handleLogout}
			class="rounded bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
		>
			Logout
		</button>
	</div>
</div>

<!-- Mobile header -->
<div class="mb-6 flex items-center justify-between md:hidden">
	<h1 class="text-2xl font-bold text-white">Tidemark</h1>
	<div class="flex items-center gap-3">
		<span class="text-sm text-white">{userName}</span>
		<button
			onclick={handleLogout}
			class="rounded bg-red-500 px-3 py-1.5 text-sm text-white transition hover:bg-red-600"
		>
			Logout
		</button>
	</div>
</div>

<!-- Mobile bottom nav (fixed) -->
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white shadow-lg md:hidden">
	<div class="flex">
		{#each navLinks as link}
			<a
				href={link.href}
				class={`flex flex-1 flex-col items-center justify-center py-3 transition ${
					page.url.pathname === link.href ? 'text-[#1F41BB]' : 'text-gray-500 hover:text-gray-700'
				}`}
			>
				<span class="text-xl">{link.icon}</span>
				<span class="mt-1 text-xs font-medium">{link.label}</span>
			</a>
		{/each}
	</div>
</nav>
