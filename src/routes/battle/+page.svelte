<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';

	interface User {
		_id: string;
		username: string;
		skillLevel: string;
	}

	interface Activity {
		_id: string;
		distance: number;
		duration: number;
		date: string;
		notes: string;
		userId?: string;
		userName?: string;
	}

	interface Battle {
		_id: string;
		creatorId: string;
		opponentId: string;
		distanceGoal: number; // in meters
		bet: string;
		status: 'active' | 'completed';
		createdAt: string;
	}

	interface OpponentStats {
		opponent: User;
		stats: {
			totalDistance: number;
			totalDuration: number;
			activityCount: number;
		};
		recentActivities: Activity[];
		activeBattle: Battle | null;
	}

	let state = $state({
		userId: null as string | null,
		userName: null as string | null,
		users: [] as User[],
		selectedOpponent: null as User | null,
		opponentStats: null as OpponentStats | null,
		activeBattle: null as Battle | null,
		currentUserActivities: [] as Activity[],
		newBattle: { distanceGoalKm: 0, bet: '' },
		loading: false,
		loadingOpponent: false,
		errorMessage: '',
		successMessage: ''
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');

		if (!state.userId) {
			await goto('/auth');
			return;
		}

		loadUsers();
		loadUserActivities();
	});

	async function loadUsers() {
		try {
			state.loading = true;
			const response = await fetch(`/api/users?excludeUserId=${state.userId}`);
			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load users';
				return;
			}

			state.users = data;
		} catch (error) {
			state.errorMessage = 'An error occurred while loading users';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	async function loadUserActivities() {
		try {
			const response = await fetch(`/api/activities?userId=${state.userId}`);
			const data = await response.json();

			if (!response.ok) return;

			state.currentUserActivities = data;
		} catch (error) {
			console.error('Error loading user activities:', error);
		}
	}

	async function selectOpponent(opponent: User) {
		state.selectedOpponent = opponent;
		state.activeBattle = null;
		state.opponentStats = null;
		state.errorMessage = '';

		try {
			state.loadingOpponent = true;
			const response = await fetch(
				`/api/battles?opponentId=${opponent._id}&userId=${state.userId}`
			);
			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load battle data';
				return;
			}

			state.opponentStats = data;
			state.activeBattle = data.activeBattle || null;
		} catch (error) {
			state.errorMessage = 'An error occurred while loading battle data';
			console.error(error);
		} finally {
			state.loadingOpponent = false;
		}
	}

	async function createBattle() {
		if (!state.newBattle.distanceGoalKm || state.newBattle.distanceGoalKm <= 0) {
			state.errorMessage = 'Please enter a valid distance goal';
			return;
		}

		try {
			state.loading = true;
			const response = await fetch('/api/battles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					creatorId: state.userId,
					opponentId: state.selectedOpponent!._id,
					distanceGoal: Math.round(state.newBattle.distanceGoalKm * 1000),
					bet: state.newBattle.bet
				})
			});

			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to create battle';
				return;
			}

			state.activeBattle = data;
			state.successMessage = 'Battle created!';
			setTimeout(() => {
				state.successMessage = '';
			}, 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred while creating battle';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	function formatDistance(meters: number): string {
		if (meters >= 1000) {
			return `${(meters / 1000).toFixed(2)} km`;
		}
		return `${meters} m`;
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getAllActivitiesSorted(
		currentActivities: Activity[],
		opponentActivities: Activity[]
	): Array<Activity & { userName: string }> {
		const all = [
			...currentActivities.map((a) => ({ ...a, userName: state.userName || 'You' })),
			...opponentActivities.map((a) => ({
				...a,
				userName: state.selectedOpponent?.username || 'Opponent'
			}))
		];
		return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	let yourDist = $derived(
		state.currentUserActivities.reduce((sum, a) => sum + (a.distance || 0), 0)
	);
	let oppDist = $derived(state.opponentStats?.stats.totalDistance ?? 0);
	let lead = $derived(yourDist - oppDist);

	let winner = $derived.by(() => {
		if (!state.activeBattle) return null;
		const goal = state.activeBattle.distanceGoal;
		if (lead >= goal) return state.userName || 'You';
		if (lead <= -goal) return state.selectedOpponent?.username || 'Opponent';
		return null;
	});

	let yourProgress = $derived(
		state.activeBattle ? Math.min((yourDist / state.activeBattle.distanceGoal) * 100, 100) : 0
	);
	let oppProgress = $derived(
		state.activeBattle ? Math.min((oppDist / state.activeBattle.distanceGoal) * 100, 100) : 0
	);
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6 pb-24 md:pb-6">
	<div class="mx-auto max-w-6xl">
		<Nav />

		{#if state.errorMessage}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">{state.errorMessage}</div>
		{/if}

		{#if state.successMessage}
			<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">{state.successMessage}</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
			<!-- Users List -->
			<div class="rounded-lg bg-white p-6 shadow-lg lg:col-span-1">
				<h2 class="mb-4 text-xl font-bold text-gray-800">Select Opponent</h2>

				{#if state.loading}
					<div class="text-center text-gray-600">Loading users...</div>
				{:else if state.users.length === 0}
					<div class="text-center text-gray-600">No other users available</div>
				{:else}
					<div class="max-h-96 space-y-2 overflow-y-auto">
						{#each state.users as user (user._id)}
							<button
								onclick={() => selectOpponent(user)}
								class={`w-full rounded p-3 text-left transition ${
									state.selectedOpponent?._id === user._id
										? 'bg-[#1F41BB] text-white'
										: 'bg-gray-100 text-gray-800 hover:bg-gray-200'
								}`}
							>
								<div class="font-semibold">{user.username}</div>
								<div class="text-xs opacity-75">{user.skillLevel}</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Battle Panel -->
			<div class="space-y-6 lg:col-span-3">
				{#if state.loadingOpponent}
					<div class="rounded-lg bg-white p-8 text-center shadow-lg">
						<div class="text-gray-600">Loading battle data...</div>
					</div>
				{:else if state.selectedOpponent && state.opponentStats}
					{#if state.activeBattle}
						<!-- Active Battle View -->
						<div class="rounded-lg bg-white p-6 shadow-lg">
							<div class="mb-4 flex items-center justify-between">
								<h2 class="text-xl font-bold text-gray-800">
									Battle vs {state.selectedOpponent.username}
								</h2>
								<span
									class="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700"
									>Active</span
								>
							</div>

							<div class="mb-6 flex flex-wrap gap-4 text-sm">
								<div class="rounded-lg bg-gray-50 px-3 py-2">
									<span class="text-gray-500">Goal:</span>
									<span class="ml-1 font-semibold text-gray-800">
										{(state.activeBattle.distanceGoal / 1000).toFixed(1)} km lead
									</span>
								</div>
								{#if state.activeBattle.bet}
									<div class="rounded-lg bg-yellow-50 px-3 py-2">
										<span class="text-gray-500">Bet:</span>
										<span class="ml-1 font-semibold text-gray-800">{state.activeBattle.bet}</span>
									</div>
								{/if}
							</div>

							<!-- Winner Banner -->
							{#if winner}
								<div class="mb-6 rounded-lg bg-yellow-100 p-6 text-center">
									<div class="text-3xl font-bold text-yellow-800">
										🏆 {winner === state.userName ? 'You Win!' : `${winner} Wins!`}
									</div>
									<div class="mt-1 text-sm text-yellow-700">
										Lead of {formatDistance(Math.abs(lead))}
									</div>
								</div>
							{/if}

							<!-- Progress Bars -->
							<div class="space-y-5">
								<div>
									<div class="mb-2 flex justify-between text-sm">
										<span class="font-semibold text-gray-700">{state.userName} (You)</span>
										<span class="font-medium text-gray-600">{formatDistance(yourDist)}</span>
									</div>
									<div class="h-6 w-full overflow-hidden rounded-full bg-gray-200">
										<div
											class="h-full rounded-full bg-[#1F41BB] transition-all duration-500"
											style="width: {yourProgress}%;"
										></div>
									</div>
								</div>

								<div>
									<div class="mb-2 flex justify-between text-sm">
										<span class="font-semibold text-gray-700"
											>{state.selectedOpponent.username}</span
										>
										<span class="font-medium text-gray-600">{formatDistance(oppDist)}</span>
									</div>
									<div class="h-6 w-full overflow-hidden rounded-full bg-gray-200">
										<div
											class="h-full rounded-full bg-purple-500 transition-all duration-500"
											style="width: {oppProgress}%;"
										></div>
									</div>
								</div>

								<div class="pt-2 text-center text-sm">
									{#if lead > 0}
										<span class="font-semibold text-[#1F41BB]"
											>You lead by {formatDistance(lead)}</span
										>
										{#if !winner}
											<span class="text-gray-500">
												· {formatDistance(state.activeBattle.distanceGoal - lead)} more to win
											</span>
										{/if}
									{:else if lead < 0}
										<span class="font-semibold text-purple-600"
											>{state.selectedOpponent.username} leads by {formatDistance(
												Math.abs(lead)
											)}</span
										>
										{#if !winner}
											<span class="text-gray-500">
												· Opponent needs {formatDistance(
													state.activeBattle.distanceGoal - Math.abs(lead)
												)} more to win
											</span>
										{/if}
									{:else}
										<span class="text-gray-500">Tied — both swimmers are even.</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Recent Activities -->
						<div class="rounded-lg bg-white p-6 shadow-lg">
							<h2 class="mb-4 text-xl font-bold text-gray-800">Recent Activities</h2>
							<div class="max-h-96 space-y-3 overflow-y-auto">
								{@const allActivities = getAllActivitiesSorted(
									state.currentUserActivities,
									state.opponentStats.recentActivities
								)}
								{#if allActivities.length === 0}
									<div class="text-center text-gray-500">No activities yet</div>
								{:else}
									{#each allActivities as activity (activity._id)}
										<div
											class={`rounded-lg p-3 ${
												activity.userName === state.userName
													? 'border-l-4 border-[#1F41BB] bg-blue-50'
													: 'border-l-4 border-purple-500 bg-purple-50'
											}`}
										>
											<div class="flex items-start justify-between">
												<div>
													<div class="font-semibold text-gray-800">{activity.userName}</div>
													<div class="text-sm text-gray-600">
														{formatDistance(activity.distance)} · {formatDuration(activity.duration)}
													</div>
													{#if activity.notes}
														<div class="text-xs italic text-gray-500">{activity.notes}</div>
													{/if}
												</div>
												<div class="text-xs text-gray-500">{formatDate(activity.date)}</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					{:else}
						<!-- Create Battle Form -->
						<div class="rounded-lg bg-white p-6 shadow-lg">
							<h2 class="mb-2 text-xl font-bold text-gray-800">
								Challenge {state.selectedOpponent.username}
							</h2>
							<p class="mb-6 text-sm text-gray-500">
								Set a distance lead goal — the first swimmer to be that far ahead wins!
							</p>

							<div class="space-y-5">
								<div>
									<label
										for="battle-goal"
										class="block text-sm font-medium text-gray-700"
									>
										Distance Goal (km)
									</label>
									<input
										id="battle-goal"
										type="number"
										bind:value={state.newBattle.distanceGoalKm}
										min="0.1"
										step="0.5"
										placeholder="e.g. 10"
										class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
									/>
									<p class="mt-1 text-xs text-gray-500">
										First to swim this many km more than the opponent wins
									</p>
								</div>

								<div>
									<label
										for="battle-bet"
										class="block text-sm font-medium text-gray-700"
									>
										Bet (optional)
									</label>
									<input
										id="battle-bet"
										type="text"
										bind:value={state.newBattle.bet}
										placeholder="e.g. Loser buys lunch"
										class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
									/>
								</div>

								<button
									onclick={createBattle}
									disabled={state.loading}
									class="w-full rounded-lg bg-[#1F41BB] py-3 font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-400"
								>
									{state.loading ? 'Creating...' : 'Create Battle'}
								</button>
							</div>
						</div>

						<!-- Opponent Stats Preview -->
						<div class="rounded-lg bg-white p-6 shadow-lg">
							<h2 class="mb-4 text-xl font-bold text-gray-800">
								{state.selectedOpponent.username}'s Stats
							</h2>
							<div class="grid grid-cols-3 gap-4">
								<div class="rounded-lg bg-purple-50 p-4 text-center">
									<div class="text-sm text-gray-600">Total Distance</div>
									<div class="mt-1 text-xl font-bold text-purple-600">
										{formatDistance(state.opponentStats.stats.totalDistance)}
									</div>
								</div>
								<div class="rounded-lg bg-purple-50 p-4 text-center">
									<div class="text-sm text-gray-600">Total Duration</div>
									<div class="mt-1 text-xl font-bold text-purple-600">
										{formatDuration(state.opponentStats.stats.totalDuration)}
									</div>
								</div>
								<div class="rounded-lg bg-purple-50 p-4 text-center">
									<div class="text-sm text-gray-600">Swims</div>
									<div class="mt-1 text-xl font-bold text-purple-600">
										{state.opponentStats.stats.activityCount}
									</div>
								</div>
							</div>
						</div>
					{/if}
				{:else if !state.selectedOpponent}
					<div class="rounded-lg bg-white p-8 text-center shadow-lg">
						<p class="text-gray-600">Select an opponent from the list to start a battle</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
