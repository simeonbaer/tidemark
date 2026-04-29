<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface User {
		_id: string;
		name: string;
		username: string;
		stats: {
			wins: number;
			losses: number;
			draws: number;
		};
	}

	interface Battle {
		_id: string;
		swimmer1: User;
		swimmer2: User;
		date: string;
	}

	let state = $state({
		currentBattle: null as Battle | null,
		sliderValue: 50,
		loading: true,
		errorMessage: '',
		userId: null as string | null,
		userName: null as string | null
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');

		if (!state.userId) {
			await goto('/auth');
			return;
		}

		loadBattle();
	});

	async function loadBattle() {
		try {
			const response = await fetch('/api/battles/random');
			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load battle';
				return;
			}

			state.currentBattle = data;
			state.sliderValue = 50;
		} catch (error) {
			state.errorMessage = 'An error occurred while loading the battle';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	async function submitBattle(winnerId: string | null) {
		if (!state.currentBattle || !state.userId) return;

		try {
			const response = await fetch('/api/battles/record', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: state.userId,
					swimmer1Id: state.currentBattle.swimmer1._id,
					swimmer2Id: state.currentBattle.swimmer2._id,
					winnerId,
					sliderValue: state.sliderValue
				})
			});

			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to record battle';
				return;
			}

			loadBattle();
		} catch (error) {
			state.errorMessage = 'An error occurred while recording the battle';
			console.error(error);
		}
	}

	function handleLogout() {
		localStorage.removeItem('userId');
		localStorage.removeItem('userName');
		goto('/auth');
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6">
	<div class="mx-auto max-w-2xl">
		<!-- Header -->
		<div class="mb-8 flex items-center justify-between">
			<h1 class="text-3xl font-bold text-white">Tidemark</h1>
			<div class="flex items-center gap-4">
				<span class="text-white">{state.userName}</span>
				<button
					onclick={handleLogout}
					class="rounded bg-red-500 px-4 py-2 text-white transition hover:bg-red-600"
				>
					Logout
				</button>
			</div>
		</div>

		<!-- Navigation -->
		<div class="mb-8 flex gap-4">
			<a href="/battle" class="rounded-lg bg-white px-6 py-2 font-semibold text-blue-600">
				Battle
			</a>
			<a href="/activity-log" class="rounded-lg bg-white bg-opacity-30 px-6 py-2 font-semibold text-white transition hover:bg-opacity-50">
				Activity Log
			</a>
			<a href="/calendar" class="rounded-lg bg-white bg-opacity-30 px-6 py-2 font-semibold text-white transition hover:bg-opacity-50">
				Calendar
			</a>
		</div>

		{#if state.loading}
			<div class="text-center text-white">Loading battle...</div>
		{:else if state.errorMessage}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">{state.errorMessage}</div>
		{:else if state.currentBattle}
			<!-- Battle Card -->
			<div class="rounded-lg bg-white p-8 shadow-2xl">
				<h2 class="mb-8 text-center text-2xl font-bold text-gray-800">Choose Your Winner</h2>

				<div class="mb-8 grid grid-cols-2 gap-6">
					<!-- Swimmer 1 -->
					<div class="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-6">
						<h3 class="mb-4 text-xl font-bold text-gray-800">{state.currentBattle.swimmer1.username}</h3>
						<div class="space-y-2 text-gray-700">
							<p>Wins: <span class="font-semibold">{state.currentBattle.swimmer1.stats.wins}</span></p>
							<p>Losses: <span class="font-semibold">{state.currentBattle.swimmer1.stats.losses}</span></p>
							<p>Draws: <span class="font-semibold">{state.currentBattle.swimmer1.stats.draws}</span></p>
						</div>
						<button
							onclick={() => submitBattle(state.currentBattle!.swimmer1._id)}
							class="mt-4 w-full rounded bg-blue-500 py-2 font-semibold text-white transition hover:bg-blue-600"
						>
							Vote for {state.currentBattle.swimmer1.username}
						</button>
					</div>

					<!-- Swimmer 2 -->
					<div class="rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 p-6">
						<h3 class="mb-4 text-xl font-bold text-gray-800">{state.currentBattle.swimmer2.username}</h3>
						<div class="space-y-2 text-gray-700">
							<p>Wins: <span class="font-semibold">{state.currentBattle.swimmer2.stats.wins}</span></p>
							<p>Losses: <span class="font-semibold">{state.currentBattle.swimmer2.stats.losses}</span></p>
							<p>Draws: <span class="font-semibold">{state.currentBattle.swimmer2.stats.draws}</span></p>
						</div>
						<button
							onclick={() => submitBattle(state.currentBattle!.swimmer2._id)}
							class="mt-4 w-full rounded bg-purple-500 py-2 font-semibold text-white transition hover:bg-purple-600"
						>
							Vote for {state.currentBattle.swimmer2.username}
						</button>
					</div>
				</div>

				<!-- Comparison Slider -->
				<div class="mb-6 space-y-4">
					<div class="flex items-center justify-between">
						<span class="text-sm font-semibold text-gray-600">{state.currentBattle.swimmer1.username}</span>
						<span class="text-sm font-semibold text-gray-600">{state.currentBattle.swimmer2.username}</span>
					</div>
					<input
						type="range"
						min="0"
						max="100"
						bind:value={state.sliderValue}
						class="w-full"
					/>
					<div class="text-center text-sm text-gray-600">
						Confidence: {Math.abs(state.sliderValue - 50)}%
					</div>
				</div>

				<!-- Draw Option -->
				<button
					onclick={() => submitBattle(null)}
					class="w-full rounded bg-gray-500 py-2 font-semibold text-white transition hover:bg-gray-600"
				>
					It's a Draw
				</button>
			</div>
		{/if}
	</div>
</div>
