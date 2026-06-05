<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { pendingInviteCount } from '$lib/stores/inviteCount';

	let userName = $state('');
	let userInitial = $derived(userName ? userName[0].toUpperCase() : '?');

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
		{ href: '/calendar', label: 'Calendar', icon: '📅' },
		{ href: '/achievements', label: 'Achievements', icon: '🏆' },
		{ href: '/profile', label: 'Profile', icon: '👤' }
	];

	function isActive(href: string): boolean {
		return page.url.pathname === href;
	}
</script>

<!-- Desktop left sidebar -->
<aside class="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col bg-[#0D1B4B] shadow-2xl md:flex">
	<!-- Logo -->
	<div class="flex h-16 shrink-0 items-center gap-2 border-b border-white/10 px-6">
		<span class="text-xl">🏊</span>
		<span class="text-xl font-bold tracking-tight text-white">Tidemark</span>
	</div>

	<!-- Nav links -->
	<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
		{#each navLinks as link}
			<a
				href={link.href}
				class={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
					isActive(link.href)
						? 'bg-[#0ABFBC]/20 text-[#0ABFBC]'
						: 'text-white/70 hover:bg-white/10 hover:text-white'
				}`}
			>
				<span class="relative text-lg leading-none">
					{link.icon}
					{#if link.href === '/profile' && $pendingInviteCount > 0}
						<span
							class="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white"
						>
							{$pendingInviteCount > 9 ? '9+' : $pendingInviteCount}
						</span>
					{/if}
				</span>
				{link.label}
			</a>
		{/each}
	</nav>

	<!-- User section -->
	<div class="shrink-0 border-t border-white/10 p-4">
		<div class="mb-3 flex items-center gap-3">
			<div
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1F41BB] text-sm font-bold text-white"
			>
				{userInitial}
			</div>
			<span class="truncate text-sm font-medium text-white">{userName || 'Loading…'}</span>
		</div>
		<button
			onclick={handleLogout}
			class="w-full rounded-xl bg-red-500/15 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/25 hover:text-red-300"
		>
			Logout
		</button>
	</div>
</aside>

<!-- Mobile bottom navigation -->
<nav
	class="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch bg-[#0D1B4B] shadow-[0_-2px_16px_rgba(0,0,0,0.3)] md:hidden"
>
	{#each navLinks as link}
		<a
			href={link.href}
			class={`flex flex-1 flex-col items-center justify-center gap-0.5 transition ${
				isActive(link.href) ? 'text-[#0ABFBC]' : 'text-white/50 hover:text-white/80'
			}`}
		>
			<span class="relative text-lg leading-none">
				{link.icon}
				{#if link.href === '/profile' && $pendingInviteCount > 0}
					<span
						class="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white"
					>
						{$pendingInviteCount > 9 ? '9+' : $pendingInviteCount}
					</span>
				{/if}
			</span>
			<span class="text-[10px] font-medium leading-none">{link.label.split(' ')[0]}</span>
		</a>
	{/each}
</nav>
