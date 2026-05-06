<script lang="ts">
	import { onMount } from 'svelte';
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
		newBattle: { distanceGoalMeters: 0, bet: '' },
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
			state.successMessage = 'Battle created!';
			setTimeout(() => (state.successMessage = ''), 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred while creating battle';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	function formatDistance(meters: number): string {
		if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
		return `${Math.round(meters)} m`;
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
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

	// Only count activities since the battle started
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
				<h2 class="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">
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
								<!-- Avatar -->
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
							<!-- Battle header -->
							<div class="mb-5 flex items-center justify-between">
								<div>
									<h2 class="text-lg font-bold text-[#0D1B4B]">
										vs {state.selectedOpponent.username}
									</h2>
									<p class="text-sm text-gray-400">
										Goal: {formatDistance(state.activeBattle.distanceGoal)} lead
									</p>
								</div>
								<span
									class="rounded-full bg-[#2ECC71]/15 px-3 py-1 text-xs font-semibold text-[#2ECC71]"
								>
									Active
								</span>
							</div>

							<!-- Bet banner -->
							{#if state.activeBattle.bet}
								<div
									class="mb-5 flex items-center gap-2 rounded-xl bg-yellow-50 px-4 py-3 text-sm"
								>
									<span class="text-base">💰</span>
									<span class="font-semibold text-yellow-800">{state.activeBattle.bet}</span>
								</div>
							{/if}

							<!-- Winner banner -->
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
								</div>
							{/if}

							<!-- Progress bars (aquatic redesign) -->
							<div class="space-y-5">
								<!-- Your bar -->
								<div class="rounded-xl bg-[#F0F4FF] p-4">
									<div class="mb-3 flex items-center gap-3">
										{#if state.opponentStats}
											<!-- user avatar placeholder (current user) -->
											<div
												class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1F41BB] text-sm font-bold text-white shadow"
											>
												{getInitial(state.userName || '')}
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<div class="flex items-baseline justify-between">
												<span class="truncate text-sm font-bold text-[#0D1B4B]"
													>{state.userName} <span class="text-xs font-normal text-gray-400"
														>(You)</span
													></span
												>
												<span class="ml-2 shrink-0 text-sm font-semibold text-[#1F41BB]">
													{formatDistance(yourDist)}
												</span>
											</div>
											<div class="mt-2 h-3 w-full overflow-hidden rounded-full bg-white shadow-inner">
												<div
													class="h-full rounded-full bg-[#1F41BB] transition-all duration-700"
													style="width: {yourProgress}%;"
												></div>
											</div>
										</div>
										<span
											class="w-10 shrink-0 text-right text-xs font-semibold text-[#1F41BB]"
										>
											{yourPct}%
										</span>
									</div>
								</div>

								<!-- Lead indicator -->
								<div class="py-1 text-center text-sm">
									{#if lead > 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-[#1F41BB]/10 px-4 py-1.5 text-sm font-semibold text-[#1F41BB]"
										>
											🏄 You lead by {formatDistance(lead)}
											{#if !winner}
												<span class="font-normal text-[#1F41BB]/60"
													>· {formatDistance(state.activeBattle.distanceGoal - lead)} to win</span
												>
											{/if}
										</span>
									{:else if lead < 0}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B6B]/10 px-4 py-1.5 text-sm font-semibold text-[#FF6B6B]"
										>
											🏄 {state.selectedOpponent.username} leads by {formatDistance(Math.abs(lead))}
											{#if !winner}
												<span class="font-normal text-[#FF6B6B]/60"
													>· {formatDistance(
														state.activeBattle.distanceGoal - Math.abs(lead)
													)} to win</span
												>
											{/if}
										</span>
									{:else}
										<span
											class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-500"
										>
											⚖️ Tied
										</span>
									{/if}
								</div>

								<!-- Opponent bar -->
								<div class="rounded-xl bg-[#FFF5F5] p-4">
									<div class="mb-3 flex items-center gap-3">
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
										<div class="flex-1 min-w-0">
											<div class="flex items-baseline justify-between">
												<span class="truncate text-sm font-bold text-[#0D1B4B]"
													>{state.selectedOpponent.username}</span
												>
												<span class="ml-2 shrink-0 text-sm font-semibold text-[#FF6B6B]">
													{formatDistance(oppDist)}
												</span>
											</div>
											<div class="mt-2 h-3 w-full overflow-hidden rounded-full bg-white shadow-inner">
												<div
													class="h-full rounded-full bg-[#FF6B6B] transition-all duration-700"
													style="width: {oppProgress}%;"
												></div>
											</div>
										</div>
										<span class="w-10 shrink-0 text-right text-xs font-semibold text-[#FF6B6B]">
											{oppPct}%
										</span>
									</div>
								</div>
							</div>

							<!-- Goal reminder -->
							<p class="mt-4 text-center text-xs text-gray-400">
								Goal: swim {formatDistance(state.activeBattle.distanceGoal)} more than your opponent
								· Progress counts from battle start
							</p>
						</div>

						<!-- Recent activities -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<h2 class="mb-4 text-sm font-bold uppercase tracking-wide text-gray-400">
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
						<!-- ── Create Battle Form ── -->
						<div class="rounded-2xl bg-white p-6 shadow-sm">
							<h2 class="mb-1 text-lg font-bold text-[#0D1B4B]">
								Challenge {state.selectedOpponent.username}
							</h2>
							<p class="mb-6 text-sm text-gray-400">
								First to lead by the goal distance wins. Progress only counts from battle start.
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

						<!-- Opponent stats preview -->
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
										class="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B6B] text-lg font-bold text-white ring-2 ring-[#FF6B6B]/40"
									>
										{getInitial(state.selectedOpponent.username)}
									</div>
								{/if}
								<div>
									<h2 class="text-base font-bold text-[#0D1B4B]">
										{state.selectedOpponent.username}
									</h2>
									<p class="text-xs capitalize text-gray-400">
										{state.selectedOpponent.skillLevel}
									</p>
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
