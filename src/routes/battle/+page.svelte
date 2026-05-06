<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';

	interface User {
		_id: string;
		username: string;
		skillLevel: string;
		profilePicture: string | null;
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
		distanceGoal: number; // meters
		bet: string;
		status: 'active' | 'completed';
		createdAt: string;
	}

	interface OpponentStats {
		opponent: User;
		stats: { totalDistance: number; totalDuration: number; activityCount: number };
		recentActivities: Activity[];
		activeBattle: Battle | null;
	}

	interface CompletedBattle {
		_id: string;
		distanceGoal: number;
		bet: string;
		createdAt: string;
		completedAt: string | null;
		winnerId: string | null;
		yourDistance: number;
		opponentDistance: number;
		opponent: { _id: string; username: string; profilePicture: string | null } | null;
	}

	let state = $state({
		userId: null as string | null,
		userName: null as string | null,
		users: [] as User[],
		selectedOpponent: null as User | null,
		opponentStats: null as OpponentStats | null,
		activeBattle: null as Battle | null,
		currentUserActivities: [] as Activity[],
		battleHistory: [] as CompletedBattle[],
		newBattle: { distanceGoalMeters: 0, bet: '' },
		loading: false,
		loadingOpponent: false,
		loadingHistory: false,
		refreshing: false,
		showEndConfirm: false,
		autoCompleteCountdown: 0,
		errorMessage: '',
		successMessage: ''
	});

	// Tracks which battle ID has already been queued for auto-complete (plain var, not reactive)
	let autoCompletedBattleId = '';
	let refreshInterval: ReturnType<typeof setInterval>;

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		await Promise.all([loadUsers(), loadUserActivities()]);

		// Auto-refresh battle data every 30 seconds
		refreshInterval = setInterval(() => {
			if (state.activeBattle && state.selectedOpponent) {
				refreshData();
			}
		}, 30000);
	});

	onDestroy(() => {
		clearInterval(refreshInterval);
	});

	// Auto-complete battle when winning condition is met
	$effect(() => {
		const w = winner;
		const b = state.activeBattle;
		if (w && b && autoCompletedBattleId !== b._id) {
			autoCompletedBattleId = b._id;
			state.autoCompleteCountdown = 5;

			const tick = setInterval(() => {
				state.autoCompleteCountdown--;
				if (state.autoCompleteCountdown <= 0) {
					clearInterval(tick);
					autoCompleteBattle(b._id, w);
				}
			}, 1000);

			return () => clearInterval(tick);
		}
	});

	// ── Data loaders ────────────────────────────────────────────────────────────

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
		state.battleHistory = [];
		state.errorMessage = '';
		state.showEndConfirm = false;
		autoCompletedBattleId = '';

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

		// Load history (for the no-active-battle view or after transitions)
		loadBattleHistory(opponent._id);
	}

	async function loadBattleHistory(opponentId: string) {
		try {
			state.loadingHistory = true;
			const response = await fetch(
				`/api/battles/history?userId=${state.userId}&opponentId=${opponentId}`
			);
			const data = await response.json();
			if (!response.ok) return;
			state.battleHistory = data;
		} catch (error) {
			console.error('Error loading battle history:', error);
		} finally {
			state.loadingHistory = false;
		}
	}

	async function refreshData() {
		if (!state.selectedOpponent) return;
		try {
			state.refreshing = true;
			await Promise.all([
				loadUserActivities(),
				(async () => {
					const response = await fetch(
						`/api/battles?opponentId=${state.selectedOpponent!._id}&userId=${state.userId}`
					);
					const data = await response.json();
					if (response.ok) {
						state.opponentStats = data;
						state.activeBattle = data.activeBattle || null;
					}
				})()
			]);
		} finally {
			state.refreshing = false;
		}
	}

	// ── Battle actions ───────────────────────────────────────────────────────────

	async function createBattle() {
		if (!state.newBattle.distanceGoalMeters || state.newBattle.distanceGoalMeters <= 0) {
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
					distanceGoal: Math.round(state.newBattle.distanceGoalMeters),
					bet: state.newBattle.bet
				})
			});
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to create battle';
				return;
			}
			state.activeBattle = data;
			state.battleHistory = [];
			autoCompletedBattleId = '';
			state.successMessage = 'Battle created!';
			setTimeout(() => (state.successMessage = ''), 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred while creating battle';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	async function endBattle() {
		if (!state.activeBattle) return;
		try {
			const response = await fetch('/api/battles', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ battleId: state.activeBattle._id, status: 'completed' })
			});
			if (!response.ok) {
				const data = await response.json();
				state.errorMessage = data.message || 'Failed to end battle';
				return;
			}
			state.activeBattle = null;
			state.showEndConfirm = false;
			autoCompletedBattleId = '';
			state.successMessage = 'Battle ended.';
			setTimeout(() => (state.successMessage = ''), 3000);
			if (state.selectedOpponent) loadBattleHistory(state.selectedOpponent._id);
		} catch (error) {
			state.errorMessage = 'An error occurred';
			console.error(error);
		}
	}

	async function autoCompleteBattle(battleId: string, winnerName: string) {
		const winnerId =
			winnerName === state.userName ? state.userId : state.selectedOpponent?._id;
		try {
			await fetch('/api/battles', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					battleId,
					status: 'completed',
					winnerId: winnerId || undefined
				})
			});
		} catch (error) {
			console.error('Error auto-completing battle:', error);
		}
		state.activeBattle = null;
		state.autoCompleteCountdown = 0;
		if (state.selectedOpponent) loadBattleHistory(state.selectedOpponent._id);
	}

	// ── Formatting ───────────────────────────────────────────────────────────────

	function formatDistance(meters: number): string {
		if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
		return `${Math.round(meters)} m`;
	}

	function formatDuration(minutes: number): string {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatShortDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getInitial(name: string): string {
		return name ? name[0].toUpperCase() : '?';
	}

	function getAllActivitiesSorted(
		current: Activity[],
		opponent: Activity[]
	): Array<Activity & { userName: string }> {
		const all = [
			...current.map((a) => ({ ...a, userName: state.userName || 'You' })),
			...opponent.map((a) => ({
				...a,
				userName: state.selectedOpponent?.username || 'Opponent'
			}))
		];
		return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
	}

	// ── Derived values ───────────────────────────────────────────────────────────

	let yourDist = $derived.by(() => {
		if (!state.activeBattle) return 0;
		const battleStart = new Date(state.activeBattle.createdAt);
		return state.currentUserActivities
			.filter((a) => new Date(a.date) >= battleStart)
			.reduce((sum, a) => sum + (a.distance || 0), 0);
	});

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
	let yourPct = $derived(Math.round(yourProgress));
	let oppPct = $derived(Math.round(oppProgress));

	let allActivities = $derived(
		state.opponentStats
			? getAllActivitiesSorted(state.currentUserActivities, state.opponentStats.recentActivities)
			: []
	);
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-6xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">Battle</h1>
			<p class="mt-1 text-sm text-white/60">Challenge other swimmers to distance battles</p>
		</div>

		{#if state.errorMessage}
			<div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.errorMessage}</div>
		{/if}
		{#if state.successMessage}
			<div class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
				{state.successMessage}
			</div>
		{/if}

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
			<!-- Opponent list -->
			<div class="rounded-2xl bg-white p-6 shadow-sm lg:col-span-1">
				<h2 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
					Select Opponent
				</h2>

				{#if state.loading}
					<p class="text-sm text-gray-400">Loading…</p>
				{:else if state.users.length === 0}
					<p class="text-sm text-gray-400">No other users available</p>
				{:else}
					<div class="max-h-[28rem] space-y-2 overflow-y-auto">
						{#each state.users as user (user._id)}
							<button
								onclick={() => selectOpponent(user)}
								class={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
									state.selectedOpponent?._id === user._id
										? 'bg-[#1F41BB] text-white'
										: 'bg-[#F0F4FF] text-gray-700 hover:bg-blue-100'
								}`}
							>
								{#if user.profilePicture}
									<img
										src={user.profilePicture}
										alt={user.username}
										class="h-10 w-10 shrink-0 rounded-full object-cover"
									/>
								{:else}
									<div
										class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
											state.selectedOpponent?._id === user._id
												? 'bg-white/20 text-white'
												: 'bg-[#0ABFBC]/20 text-[#0ABFBC]'
										}`}
									>
										{getInitial(user.username)}
									</div>
								{/if}
								<div class="min-w-0">
									<div class="truncate text-sm font-semibold">{user.username}</div>
									<div class="text-xs capitalize opacity-60">{user.skillLevel}</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Battle panel -->
			<div class="space-y-6 lg:col-span-3">
				{#if state.loadingOpponent}
					<div class="rounded-2xl bg-white p-10 text-center shadow-sm">
						<p class="text-sm text-gray-400">Loading battle data…</p>
					</div>
				{:else if state.selectedOpponent && state.opponentStats}
					{#if state.activeBattle}
						<!-- ── Active Battle View ── -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<!-- Battle header with actions -->
							<div class="mb-5 flex items-start justify-between gap-4">
								<div>
									<h2 class="text-lg font-bold text-[#0D1B4B]">
										vs {state.selectedOpponent.username}
									</h2>
									<p class="text-sm text-gray-400">
										Goal: {formatDistance(state.activeBattle.distanceGoal)} lead · from battle start
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<!-- Refresh button -->
									<button
										onclick={refreshData}
										disabled={state.refreshing}
										class="rounded-xl bg-[#F0F4FF] px-3 py-2 text-xs font-medium text-[#1F41BB] transition hover:bg-blue-100 disabled:opacity-50"
										title="Refresh battle data"
									>
										{state.refreshing ? '↻…' : '↻ Refresh'}
									</button>
									<!-- End battle button -->
									{#if !state.showEndConfirm}
										<button
											onclick={() => (state.showEndConfirm = true)}
											class="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-100"
										>
											End Battle
										</button>
									{/if}
								</div>
							</div>

							<!-- End battle confirmation -->
							{#if state.showEndConfirm}
								<div
									class="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
								>
									<p class="flex-1 text-sm font-medium text-red-800">
										Are you sure you want to end this battle?
									</p>
									<button
										onclick={endBattle}
										class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
									>
										Yes, end it
									</button>
									<button
										onclick={() => (state.showEndConfirm = false)}
										class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
									>
										Cancel
									</button>
								</div>
							{/if}

							<!-- Bet banner -->
							{#if state.activeBattle.bet}
								<div
									class="mb-5 flex items-center gap-2 rounded-xl bg-yellow-50 px-4 py-3 text-sm"
								>
									<span class="text-base">💰</span>
									<span class="font-semibold text-yellow-800">{state.activeBattle.bet}</span>
								</div>
							{/if}

							<!-- Winner banner + countdown -->
							{#if winner}
								<div
									class="mb-6 rounded-2xl bg-gradient-to-r from-yellow-400 to-[#FF6B6B] p-6 text-center shadow"
								>
									<div class="text-3xl font-extrabold text-white">
										🏆 {winner === state.userName ? 'You Win!' : `${winner} Wins!`}
									</div>
									<div class="mt-1 text-sm text-white/80">
										Lead of {formatDistance(Math.abs(lead))}
									</div>
									{#if state.activeBattle.bet}
										<div class="mt-2 text-sm font-medium text-white/90">
											💰 {state.activeBattle.bet}
										</div>
									{/if}
									{#if state.autoCompleteCountdown > 0}
										<div class="mt-3 text-sm text-white/70">
											Battle ends in {state.autoCompleteCountdown}s…
										</div>
									{/if}
								</div>
							{/if}

							<!-- Progress bars -->
							<div class="space-y-4">
								<!-- Your bar -->
								<div class="rounded-xl bg-[#F0F4FF] p-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F41BB] text-sm font-bold text-white shadow"
										>
											{getInitial(state.userName || '')}
										</div>
										<div class="min-w-0 flex-1">
											<div class="mb-1.5 flex items-baseline justify-between">
												<span class="truncate text-sm font-bold text-[#0D1B4B]">
													{state.userName}
													<span class="text-xs font-normal text-gray-400">(You)</span>
												</span>
												<span class="ml-2 shrink-0 text-sm font-semibold text-[#1F41BB]">
													{formatDistance(yourDist)}
												</span>
											</div>
											<div class="h-3 w-full overflow-hidden rounded-full bg-white shadow-inner">
												<div
													class="h-full rounded-full bg-[#1F41BB] transition-all duration-700"
													style="width: {yourProgress}%;"
												></div>
											</div>
										</div>
										<span class="w-9 shrink-0 text-right text-xs font-semibold text-[#1F41BB]">
											{yourPct}%
										</span>
									</div>
								</div>

								<!-- Lead pill -->
								<div class="text-center">
									{#if lead > 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-[#1F41BB]/10 px-4 py-1.5 text-xs font-semibold text-[#1F41BB]"
										>
											🏄 You lead by {formatDistance(lead)}
											{#if !winner}
												<span class="font-normal opacity-60"
													>· {formatDistance(state.activeBattle.distanceGoal - lead)} to win</span
												>
											{/if}
										</span>
									{:else if lead < 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B6B]/10 px-4 py-1.5 text-xs font-semibold text-[#FF6B6B]"
										>
											🏄 {state.selectedOpponent.username} leads by {formatDistance(Math.abs(lead))}
											{#if !winner}
												<span class="font-normal opacity-60">
													· {formatDistance(
														state.activeBattle.distanceGoal - Math.abs(lead)
													)} to win
												</span>
											{/if}
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-1.5 text-xs font-medium text-gray-500"
											>⚖️ Tied</span
										>
									{/if}
								</div>

								<!-- Opponent bar -->
								<div class="rounded-xl bg-[#FFF5F5] p-4">
									<div class="flex items-center gap-3">
										{#if state.opponentStats.opponent.profilePicture}
											<img
												src={state.opponentStats.opponent.profilePicture}
												alt={state.selectedOpponent.username}
												class="h-10 w-10 shrink-0 rounded-full object-cover shadow"
											/>
										{:else}
											<div
												class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FF6B6B] text-sm font-bold text-white shadow"
											>
												{getInitial(state.selectedOpponent.username)}
											</div>
										{/if}
										<div class="min-w-0 flex-1">
											<div class="mb-1.5 flex items-baseline justify-between">
												<span class="truncate text-sm font-bold text-[#0D1B4B]">
													{state.selectedOpponent.username}
												</span>
												<span class="ml-2 shrink-0 text-sm font-semibold text-[#FF6B6B]">
													{formatDistance(oppDist)}
												</span>
											</div>
											<div class="h-3 w-full overflow-hidden rounded-full bg-white shadow-inner">
												<div
													class="h-full rounded-full bg-[#FF6B6B] transition-all duration-700"
													style="width: {oppProgress}%;"
												></div>
											</div>
										</div>
										<span class="w-9 shrink-0 text-right text-xs font-semibold text-[#FF6B6B]">
											{oppPct}%
										</span>
									</div>
								</div>
							</div>

							<p class="mt-4 text-center text-xs text-gray-400">
								Progress counts from battle start ·
								<button
									onclick={refreshData}
									class="text-[#1F41BB] underline hover:no-underline"
									disabled={state.refreshing}
								>
									{state.refreshing ? 'refreshing…' : 'refresh now'}
								</button>
							</p>
						</div>

						<!-- Recent activities -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<h2 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
								Recent Activities
							</h2>
							<div class="max-h-96 space-y-3 overflow-y-auto">
								{#if allActivities.length === 0}
									<p class="text-center text-sm text-gray-400">No activities yet</p>
								{:else}
									{#each allActivities as activity (activity._id)}
										<div
											class={`rounded-xl p-3 text-sm ${
												activity.userName === state.userName
													? 'border-l-4 border-[#1F41BB] bg-[#F0F4FF]'
													: 'border-l-4 border-[#FF6B6B] bg-[#FFF5F5]'
											}`}
										>
											<div class="flex items-start justify-between">
												<div>
													<div class="font-semibold text-[#0D1B4B]">{activity.userName}</div>
													<div class="text-gray-500">
														{formatDistance(activity.distance)} · {formatDuration(activity.duration)}
													</div>
													{#if activity.notes}
														<div class="text-xs italic text-gray-400">{activity.notes}</div>
													{/if}
												</div>
												<div class="text-xs text-gray-400">{formatDate(activity.date)}</div>
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					{:else}
						<!-- ── No Active Battle ── -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<h2 class="mb-1 text-lg font-bold text-[#0D1B4B]">
								Challenge {state.selectedOpponent.username}
							</h2>
							<p class="mb-6 text-sm text-gray-400">
								First to lead by the goal distance wins. Progress counts from battle start.
							</p>
							<div class="space-y-5">
								<div>
									<label for="battle-goal" class="block text-sm font-medium text-gray-700">
										Distance Goal (meters)
									</label>
									<input
										id="battle-goal"
										type="number"
										bind:value={state.newBattle.distanceGoalMeters}
										min="100"
										step="100"
										placeholder="e.g. 50000 = 50 km"
										class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
									/>
									{#if state.newBattle.distanceGoalMeters > 0}
										<p class="mt-1 text-xs text-gray-400">
											= {(state.newBattle.distanceGoalMeters / 1000).toFixed(1)} km lead needed to win
										</p>
									{:else}
										<p class="mt-1 text-xs text-gray-400">
											First to swim this many meters more than opponent wins
										</p>
									{/if}
								</div>
								<div>
									<label for="battle-bet" class="block text-sm font-medium text-gray-700">
										Bet (optional)
									</label>
									<input
										id="battle-bet"
										type="text"
										bind:value={state.newBattle.bet}
										placeholder="e.g. Loser buys lunch"
										class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
									/>
								</div>
								<button
									onclick={createBattle}
									disabled={state.loading}
									class="w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-300"
								>
									{state.loading ? 'Creating…' : 'Create Battle ⚔️'}
								</button>
							</div>
						</div>

						<!-- Opponent stats -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<div class="mb-4 flex items-center gap-3">
								{#if state.opponentStats.opponent.profilePicture}
									<img
										src={state.opponentStats.opponent.profilePicture}
										alt={state.selectedOpponent.username}
										class="h-12 w-12 rounded-full object-cover ring-2 ring-[#0ABFBC]"
									/>
								{:else}
									<div
										class="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B6B] text-lg font-bold text-white"
									>
										{getInitial(state.selectedOpponent.username)}
									</div>
								{/if}
								<div>
									<h2 class="text-base font-bold text-[#0D1B4B]">
										{state.selectedOpponent.username}
									</h2>
									<p class="text-xs capitalize text-gray-400">{state.selectedOpponent.skillLevel}</p>
								</div>
							</div>
							<div class="grid grid-cols-3 gap-3">
								<div class="rounded-xl bg-[#F0F4FF] p-4 text-center">
									<p class="text-xs text-gray-400">Distance</p>
									<p class="mt-1 text-lg font-bold text-[#0ABFBC]">
										{formatDistance(state.opponentStats.stats.totalDistance)}
									</p>
								</div>
								<div class="rounded-xl bg-[#F0F4FF] p-4 text-center">
									<p class="text-xs text-gray-400">Duration</p>
									<p class="mt-1 text-lg font-bold text-[#0ABFBC]">
										{formatDuration(state.opponentStats.stats.totalDuration)}
									</p>
								</div>
								<div class="rounded-xl bg-[#F0F4FF] p-4 text-center">
									<p class="text-xs text-gray-400">Swims</p>
									<p class="mt-1 text-lg font-bold text-[#0ABFBC]">
										{state.opponentStats.stats.activityCount}
									</p>
								</div>
							</div>
						</div>

						<!-- Battle History -->
						{#if state.loadingHistory}
							<div class="rounded-2xl bg-white p-6 shadow-sm">
								<p class="text-center text-sm text-gray-400">Loading history…</p>
							</div>
						{:else if state.battleHistory.length > 0}
							<div class="rounded-2xl bg-white p-6 shadow-sm">
								<h2 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
									Battle History
								</h2>
								<div class="space-y-3">
									{#each state.battleHistory as battle (battle._id)}
										{@const youWon = battle.winnerId === state.userId}
										{@const hasWinner = !!battle.winnerId}
										<div
											class={`rounded-xl p-4 text-sm ${
												hasWinner
													? youWon
														? 'border border-[#2ECC71]/30 bg-green-50'
														: 'border border-[#FF6B6B]/30 bg-red-50'
													: 'bg-[#F0F4FF]'
											}`}
										>
											<div class="mb-2 flex items-center justify-between">
												<span class="font-semibold text-[#0D1B4B]">
													{#if hasWinner}
														{youWon ? '🏆 You Won' : '😔 You Lost'}
													{:else}
														⚔️ Ended
													{/if}
												</span>
												{#if battle.completedAt}
													<span class="text-xs text-gray-400"
														>{formatShortDate(battle.completedAt)}</span
													>
												{/if}
											</div>
											<div class="grid grid-cols-2 gap-2 text-xs text-gray-600">
												<div>
													Goal: <span class="font-medium text-[#0D1B4B]"
														>{formatDistance(battle.distanceGoal)} lead</span
													>
												</div>
												{#if battle.bet}
													<div>
														Bet: <span class="font-medium text-yellow-700">{battle.bet}</span>
													</div>
												{/if}
												<div>
													You: <span class="font-medium text-[#1F41BB]"
														>{formatDistance(battle.yourDistance)}</span
													>
												</div>
												<div>
													Them: <span class="font-medium text-[#FF6B6B]"
														>{formatDistance(battle.opponentDistance)}</span
													>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{/if}
				{:else if !state.selectedOpponent}
					<div class="rounded-2xl bg-white p-10 text-center shadow-sm">
						<div class="mb-3 text-5xl">⚔️</div>
						<p class="text-gray-400">Select an opponent to start a battle</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
