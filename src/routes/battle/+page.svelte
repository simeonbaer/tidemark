<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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

	interface OpponentStats {
		opponent: User;
		stats: {
			totalDistance: number;
			totalDuration: number;
			activityCount: number;
		};
		recentActivities: Activity[];
	}

	let state = $state({
		userId: null as string | null,
		userName: null as string | null,
		users: [] as User[],
		selectedOpponent: null as User | null,
		opponentStats: null as OpponentStats | null,
		currentUserActivities: [] as Activity[],
		showLogForm: false,
		newActivity: {
			distance: 0,
			duration: 0,
			notes: ''
		},
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

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load activities';
				return;
			}

			state.currentUserActivities = data;
		} catch (error) {
			console.error('Error loading user activities:', error);
		}
	}

	async function selectOpponent(opponent: User) {
		state.selectedOpponent = opponent;
		state.showLogForm = false;

		try {
			state.loadingOpponent = true;
			const response = await fetch(`/api/battles?opponentId=${opponent._id}`);
			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load opponent stats';
				return;
			}

			state.opponentStats = data;
			state.errorMessage = '';
		} catch (error) {
			state.errorMessage = 'An error occurred while loading opponent stats';
			console.error(error);
		} finally {
			state.loadingOpponent = false;
		}
	}

	async function submitActivity() {
		if (!state.userId || state.newActivity.distance === 0 || state.newActivity.duration === 0) {
			state.errorMessage = 'Please enter distance and duration';
			return;
		}

		try {
			state.loading = true;
			const response = await fetch('/api/activities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: state.userId,
					distance: state.newActivity.distance,
					duration: state.newActivity.duration,
					date: new Date().toISOString(),
					notes: state.newActivity.notes
				})
			});

			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to log activity';
				return;
			}

			state.successMessage = 'Swim logged successfully!';
			state.newActivity = { distance: 0, duration: 0, notes: '' };
			state.showLogForm = false;

			// Reload data
			await loadUserActivities();
			if (state.selectedOpponent) {
				await selectOpponent(state.selectedOpponent);
			}

			setTimeout(() => {
				state.successMessage = '';
			}, 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred while logging activity';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	function handleLogout() {
		localStorage.removeItem('userId');
		localStorage.removeItem('userName');
		goto('/auth');
	}

	function calculatePercentage(opponentDist: number, userDist: number): number {
		if (opponentDist + userDist === 0) return 50;
		return Math.round((userDist / (opponentDist + userDist)) * 100);
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
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
	}

	function getAllActivitiesSorted(currentActivities: Activity[], opponentActivities: Activity[]): Array<Activity & { userName: string }> {
		const all = [
			...currentActivities.map(a => ({ ...a, userName: state.userName || 'You' })),
			...opponentActivities.map(a => ({ ...a, userName: state.selectedOpponent?.username || 'Opponent' }))
		];
		return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6">
	<div class="mx-auto max-w-6xl">
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
					<div class="space-y-2 max-h-96 overflow-y-auto">
						{#each state.users as user (user._id)}
							<button
								onclick={() => selectOpponent(user)}
								class={`w-full rounded p-3 text-left transition ${
									state.selectedOpponent?._id === user._id
										? 'bg-blue-500 text-white'
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

			<!-- Battle Details -->
			<div class="space-y-6 lg:col-span-3">
				{#if state.selectedOpponent && state.opponentStats}
					<!-- Distance Comparison Bar -->
					<div class="rounded-lg bg-white p-6 shadow-lg">
						<h2 class="mb-4 text-xl font-bold text-gray-800">Distance Battle</h2>

						{#if state.loadingOpponent}
							<div class="text-center text-gray-600">Loading opponent stats...</div>
						{:else}
							<div class="mb-6">
								<div class="mb-2 flex items-center justify-between">
									<span class="font-semibold text-gray-700">{state.userName}</span>
									<span class="font-semibold text-gray-700">{state.selectedOpponent.username}</span>
								</div>

								{@const yourDist = state.currentUserActivities.reduce((sum, a) => sum + (a.distance || 0), 0)}
								{@const oppDist = state.opponentStats.stats.totalDistance}
								{@const yourPercent = calculatePercentage(oppDist, yourDist)}

								<div class="h-12 overflow-hidden rounded-lg bg-gray-200">
									<div
										class="flex h-full transition-all duration-300"
										style="width: 100%;"
									>
										<div
											class="flex items-center justify-center bg-gradient-to-r from-blue-400 to-blue-600 text-white font-bold"
											style="width: {yourPercent}%;"
										>
											{#if yourPercent > 15}
												{yourPercent}%
											{/if}
										</div>
										<div
											class="flex items-center justify-center bg-gradient-to-r from-purple-400 to-purple-600 text-white font-bold"
											style="width: {100 - yourPercent}%;"
										>
											{#if 100 - yourPercent > 15}
												{100 - yourPercent}%
											{/if}
										</div>
									</div>
								</div>

								<div class="mt-4 grid grid-cols-2 gap-4">
									<div class="rounded bg-blue-50 p-3">
										<div class="text-sm text-gray-600">Your Total</div>
										<div class="text-2xl font-bold text-blue-600">{formatDistance(yourDist)}</div>
										<div class="text-xs text-gray-500">{state.currentUserActivities.length} swims</div>
									</div>
									<div class="rounded bg-purple-50 p-3">
										<div class="text-sm text-gray-600">Opponent Total</div>
										<div class="text-2xl font-bold text-purple-600">{formatDistance(oppDist)}</div>
										<div class="text-xs text-gray-500">{state.opponentStats.stats.activityCount} swims</div>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Activity Log -->
					<div class="rounded-lg bg-white p-6 shadow-lg">
						<div class="mb-4 flex items-center justify-between">
							<h2 class="text-xl font-bold text-gray-800">Recent Activities</h2>
							<button
								onclick={() => (state.showLogForm = !state.showLogForm)}
								class="rounded bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
							>
								{state.showLogForm ? 'Cancel' : '+ Log Swim'}
							</button>
						</div>

						{#if state.showLogForm}
							<div class="mb-6 rounded-lg bg-blue-50 p-4">
								<h3 class="mb-3 font-semibold text-gray-800">Log Your Swim</h3>
								<div class="space-y-3">
									<div>
										<label class="block text-sm font-medium text-gray-700">Distance (meters)</label>
										<input
											type="number"
											bind:value={state.newActivity.distance}
											min="0"
											step="100"
											placeholder="e.g., 1000"
											class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
										/>
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700">Duration (minutes)</label>
										<input
											type="number"
											bind:value={state.newActivity.duration}
											min="0"
											step="5"
											placeholder="e.g., 30"
											class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
										/>
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700">Notes (optional)</label>
										<input
											type="text"
											bind:value={state.newActivity.notes}
											placeholder="e.g., Morning swim, felt great"
											class="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
										/>
									</div>
									<button
										onclick={submitActivity}
										disabled={state.loading}
										class="w-full rounded bg-blue-500 py-2 font-semibold text-white transition hover:bg-blue-600 disabled:bg-gray-400"
									>
										{state.loading ? 'Logging...' : 'Log Swim'}
									</button>
								</div>
							</div>
						{/if}

						<!-- Activities List -->
						<div class="space-y-3 max-h-96 overflow-y-auto">
							{@const allActivities = getAllActivitiesSorted(state.currentUserActivities, state.opponentStats.recentActivities)}
							{#if allActivities.length === 0}
								<div class="text-center text-gray-500">No activities yet</div>
							{:else}
								{#each allActivities as activity (activity._id)}
									<div
										class={`rounded-lg p-3 ${
											activity.userName === state.userName
												? 'border-l-4 border-blue-500 bg-blue-50'
												: 'border-l-4 border-purple-500 bg-purple-50'
										}`}
									>
										<div class="flex items-start justify-between">
											<div>
												<div class="font-semibold text-gray-800">{activity.userName}</div>
												<div class="text-sm text-gray-600">{formatDistance(activity.distance)} • {formatDuration(activity.duration)}</div>
												{#if activity.notes}
													<div class="text-xs text-gray-500 italic">{activity.notes}</div>
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
					<div class="rounded-lg bg-white p-8 text-center shadow-lg">
						<p class="text-gray-600">Select an opponent from the list to start a battle</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
