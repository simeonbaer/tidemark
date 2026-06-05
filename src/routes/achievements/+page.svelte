<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Achievement {
		id: string;
		name: string;
		emoji: string;
		desc: string;
		unlocked: boolean;
		unlockedAt: string | null;
	}

	let state = $state({
		achievements: [] as Achievement[],
		loading: true,
		userId: null as string | null
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		await loadAchievements();
	});

	async function loadAchievements() {
		try {
			const response = await fetch(`/api/achievements?userId=${state.userId}`);
			if (!response.ok) return;
			state.achievements = await response.json();
		} catch (error) {
			console.error('Error loading achievements:', error);
		} finally {
			state.loading = false;
		}
	}

	function formatDate(isoStr: string): string {
		return new Date(isoStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	let unlockedCount = $derived(state.achievements.filter((a) => a.unlocked).length);
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">Achievements</h1>
			<p class="mt-1 text-sm text-white/60">
				{#if !state.loading}
					{unlockedCount} of {state.achievements.length} unlocked
				{:else}
					Loading your achievements…
				{/if}
			</p>
		</div>

		{#if state.loading}
			<div class="flex h-64 items-center justify-center">
				<p class="text-gray-400">Checking achievements…</p>
			</div>
		{:else}
			<!-- Progress bar -->
			<div class="mb-6 rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
				<div class="mb-2 flex items-center justify-between text-sm">
					<span class="font-semibold text-[#0D1B4B] dark:text-white">Overall Progress</span>
					<span class="font-bold text-[#1F41BB]"
						>{unlockedCount}/{state.achievements.length}</span
					>
				</div>
				<div class="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
					<div
						class="h-3 rounded-full bg-gradient-to-r from-[#1F41BB] to-[#0ABFBC] transition-all duration-500"
						style="width: {state.achievements.length > 0
							? Math.round((unlockedCount / state.achievements.length) * 100)
							: 0}%"
					></div>
				</div>
			</div>

			<!-- Achievement grid -->
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				{#each state.achievements as achievement (achievement.id)}
					<div
						class={`rounded-2xl bg-white p-5 shadow-sm transition dark:bg-gray-800 ${
							achievement.unlocked
								? 'ring-2 ring-[#0ABFBC]/40'
								: 'opacity-60 dark:opacity-50'
						}`}
					>
						<!-- Emoji + badge row -->
						<div class="mb-3 flex items-start justify-between">
							<span
								class={`text-4xl leading-none ${achievement.unlocked ? '' : 'grayscale'}`}
							>
								{achievement.emoji}
							</span>
							{#if achievement.unlocked}
								<span
									class="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-400"
								>
									Unlocked
								</span>
							{:else}
								<span
									class="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
								>
									Locked
								</span>
							{/if}
						</div>

						<!-- Name -->
						<h3
							class={`text-sm font-bold leading-tight ${
								achievement.unlocked
									? 'text-[#0D1B4B] dark:text-white'
									: 'text-gray-400 dark:text-gray-500'
							}`}
						>
							{achievement.name}
						</h3>

						<!-- Description -->
						<p
							class={`mt-1 text-xs leading-relaxed ${
								achievement.unlocked
									? 'text-gray-500 dark:text-gray-400'
									: 'text-gray-400 dark:text-gray-500'
							}`}
						>
							{achievement.desc}
						</p>

						<!-- Unlocked date -->
						{#if achievement.unlocked && achievement.unlockedAt}
							<p class="mt-2 text-xs font-medium text-[#2ECC71]">
								{formatDate(achievement.unlockedAt)}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
