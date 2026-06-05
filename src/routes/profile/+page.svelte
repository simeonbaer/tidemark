<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { darkMode } from '$lib/stores/theme';

	interface WeekStat {
		weekStart: string;
		distance: number;
		sessions: number;
		avgPace: number;
		calories: number;
		bestSession: number;
	}

	interface ProfileData {
		_id: string;
		username: string;
		email: string;
		skillLevel: string;
		profilePicture: string | null;
		stats: {
			totalDistance: number;
			totalDuration: number;
			totalSwims: number;
			battleCount: number;
			battlesWon: number;
			battlesLost: number;
			winRate: number;
			personalBestDistance: number;
			personalBestPace: number;
			thisMonthDistance: number;
			lastMonthDistance: number;
			thisMonthSessions: number;
			lastMonthSessions: number;
			bestPaceThisMonth: number;
			weeklyStats: WeekStat[];
			longestStreak: number;
			mostSessionsInWeek: number;
		};
	}

	let state = $state({
		profile: null as ProfileData | null,
		loading: true,
		saving: false,
		uploading: false,
		userId: null as string | null,
		errorMessage: '',
		successMessage: '',
		editUsername: '',
		editSkillLevel: ''
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		loadProfile();
	});

	async function loadProfile() {
		try {
			const response = await fetch(`/api/profile?userId=${state.userId}`);
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load profile';
				return;
			}
			state.profile = data;
			state.editUsername = data.username;
			state.editSkillLevel = data.skillLevel;
		} catch (error) {
			state.errorMessage = 'An error occurred loading your profile';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	async function saveProfile() {
		if (!state.editUsername.trim()) {
			state.errorMessage = 'Username cannot be empty';
			return;
		}
		try {
			state.saving = true;
			const response = await fetch('/api/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: state.userId,
					username: state.editUsername.trim(),
					skillLevel: state.editSkillLevel
				})
			});
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to save profile';
				return;
			}
			if (state.profile) {
				state.profile.username = state.editUsername.trim();
				state.profile.skillLevel = state.editSkillLevel;
			}
			localStorage.setItem('userName', state.editUsername.trim());
			state.successMessage = 'Profile updated!';
			state.errorMessage = '';
			setTimeout(() => {
				state.successMessage = '';
			}, 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred saving your profile';
			console.error(error);
		} finally {
			state.saving = false;
		}
	}

	function handleImageUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files || input.files.length === 0) return;

		const file = input.files[0];
		if (!file.type.startsWith('image/')) {
			state.errorMessage = 'Please upload an image file';
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			state.errorMessage = 'Image must be smaller than 2 MB';
			return;
		}

		state.uploading = true;
		const reader = new FileReader();
		reader.onload = async (e) => {
			const base64 = e.target?.result as string;
			try {
				const response = await fetch('/api/profile', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userId: state.userId, profilePicture: base64 })
				});
				const data = await response.json();
				if (!response.ok) {
					state.errorMessage = data.message || 'Failed to upload image';
				} else {
					if (state.profile) state.profile.profilePicture = base64;
					state.successMessage = 'Profile picture updated!';
					setTimeout(() => {
						state.successMessage = '';
					}, 3000);
				}
			} catch (error) {
				state.errorMessage = 'Upload failed';
				console.error(error);
			} finally {
				state.uploading = false;
			}
		};
		reader.readAsDataURL(file);
	}

	function formatDistance(meters: number): string {
		if (meters === 0) return '0 m';
		if (meters < 1000) return `${meters} m`;
		return `${(meters / 1000).toFixed(2)} km`;
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatPace(minPer100m: number): string {
		if (minPer100m === 0) return '—';
		return `${minPer100m.toFixed(1)} min/100m`;
	}

	function formatWeekLabel(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function monthImprovement(
		thisMonth: number,
		lastMonth: number
	): { pct: number; improved: boolean } {
		if (lastMonth === 0) return { pct: thisMonth > 0 ? 100 : 0, improved: thisMonth > 0 };
		const raw = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
		return { pct: Math.abs(raw), improved: raw >= 0 };
	}

	// Index of the best week by distance (for table highlight)
	let bestWeekIdx = $derived.by(() => {
		const weeks = state.profile?.stats.weeklyStats;
		if (!weeks?.length) return -1;
		let maxDist = 0;
		let idx = -1;
		weeks.forEach((w, i) => {
			if (w.distance > maxDist) {
				maxDist = w.distance;
				idx = i;
			}
		});
		return maxDist > 0 ? idx : -1;
	});

	const skillLevels = ['beginner', 'intermediate', 'advanced', 'elite'];
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">My Profile</h1>
			<p class="mt-1 text-sm text-white/60">View and edit your swimmer profile</p>
		</div>

		{#if state.errorMessage}
			<div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{state.errorMessage}</div>
		{/if}
		{#if state.successMessage}
			<div class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
				{state.successMessage}
			</div>
		{/if}

		{#if state.loading}
			<div class="flex h-64 items-center justify-center">
				<p class="text-gray-400">Loading profile…</p>
			</div>
		{:else if state.profile}
			{@const imp = monthImprovement(
				state.profile.stats.thisMonthDistance,
				state.profile.stats.lastMonthDistance
			)}
			{@const sessImp = monthImprovement(
				state.profile.stats.thisMonthSessions,
				state.profile.stats.lastMonthSessions
			)}

			<!-- ── Top grid: avatar / monthly card + stat cards / edit ── -->
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- Left column: avatar + monthly mini-card -->
				<div class="space-y-4">
					<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
						<div class="flex flex-col items-center">
							{#if state.profile.profilePicture}
								<img
									src={state.profile.profilePicture}
									alt="Profile"
									class="h-24 w-24 rounded-full object-cover ring-4 ring-[#0ABFBC]"
								/>
							{:else}
								<div
									class="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#1F41BB] to-[#0ABFBC] text-3xl font-bold text-white ring-4 ring-[#0ABFBC]/40"
								>
									{state.profile.username[0].toUpperCase()}
								</div>
							{/if}

							<label
								for="profile-pic"
								class="mt-3 cursor-pointer rounded-lg bg-[#F0F4FF] px-4 py-2 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100 dark:bg-gray-700 dark:hover:bg-gray-600"
							>
								{state.uploading ? 'Uploading…' : 'Change Photo'}
							</label>
							<input
								id="profile-pic"
								type="file"
								accept="image/*"
								class="hidden"
								onchange={handleImageUpload}
							/>
						</div>

						<div class="mt-5 text-center">
							<h2 class="text-xl font-bold text-[#0D1B4B] dark:text-white">{state.profile.username}</h2>
							<p class="mt-1 text-sm capitalize text-gray-500 dark:text-gray-400">{state.profile.skillLevel}</p>
							<p class="mt-1 text-xs text-gray-400">{state.profile.email}</p>
						</div>
					</div>

					<!-- Monthly mini-card -->
					<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
							Monthly Progress
						</p>
						<p class="text-2xl font-bold text-[#0D1B4B] dark:text-white">
							{formatDistance(state.profile.stats.thisMonthDistance)}
						</p>
						<p class="mt-0.5 text-xs text-gray-400">this month</p>
						{#if state.profile.stats.lastMonthDistance > 0 || state.profile.stats.thisMonthDistance > 0}
							<div class="mt-2 flex items-center gap-1.5">
								<span class={`text-sm font-bold ${imp.improved ? 'text-[#2ECC71]' : 'text-[#FF6B6B]'}`}>
									{imp.improved ? '↑' : '↓'}{imp.pct}%
								</span>
								<span class="text-xs text-gray-400">
									vs {formatDistance(state.profile.stats.lastMonthDistance)} last month
								</span>
							</div>
						{:else}
							<p class="mt-2 text-xs text-gray-400">No data yet</p>
						{/if}
					</div>
				</div>

				<!-- Right column: stats + battle record + personal bests + edit -->
				<div class="space-y-6 lg:col-span-2">
					<!-- Swim stats -->
					<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
						<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Distance</p>
							<p class="mt-2 text-2xl font-bold text-[#1F41BB]">
								{formatDistance(state.profile.stats.totalDistance)}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Duration</p>
							<p class="mt-2 text-2xl font-bold text-[#0ABFBC]">
								{formatDuration(state.profile.stats.totalDuration)}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Swims</p>
							<p class="mt-2 text-2xl font-bold text-[#0D1B4B] dark:text-white">
								{state.profile.stats.totalSwims}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Battles</p>
							<p class="mt-2 text-2xl font-bold text-[#FF6B6B]">
								{state.profile.stats.battleCount}
							</p>
						</div>
					</div>

					<!-- Battle record -->
					<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
						<h3 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
							Battle Record
						</h3>
						<div class="grid grid-cols-3 gap-4">
							<div class="rounded-xl bg-green-50 p-4 text-center dark:bg-green-900/20">
								<p class="text-xs font-medium text-green-600 dark:text-green-400">Won</p>
								<p class="mt-1 text-2xl font-bold text-[#2ECC71]">
									{state.profile.stats.battlesWon}
								</p>
							</div>
							<div class="rounded-xl bg-red-50 p-4 text-center dark:bg-red-900/20">
								<p class="text-xs font-medium text-red-500 dark:text-red-400">Lost</p>
								<p class="mt-1 text-2xl font-bold text-[#FF6B6B]">
									{state.profile.stats.battlesLost}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] p-4 text-center dark:bg-gray-700">
								<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Win Rate</p>
								<p class="mt-1 text-2xl font-bold text-[#1F41BB]">
									{state.profile.stats.winRate}%
								</p>
							</div>
						</div>
					</div>

					<!-- Personal bests (quick view) -->
					<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
						<h3 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
							Personal Bests
						</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
								<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Best Single Distance</p>
								<p class="mt-1 text-xl font-bold text-[#1F41BB]">
									{state.profile.stats.personalBestDistance > 0
										? formatDistance(state.profile.stats.personalBestDistance)
										: '—'}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
								<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Best Pace</p>
								<p class="mt-1 text-xl font-bold text-[#0ABFBC]">
									{formatPace(state.profile.stats.personalBestPace)}
								</p>
							</div>
						</div>
					</div>

					<!-- Edit form -->
					<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
						<h3 class="mb-5 text-lg font-bold text-[#0D1B4B] dark:text-white">Edit Profile</h3>
						<div class="space-y-4">
							<div>
								<label for="edit-username" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
									>Username</label
								>
								<input
									id="edit-username"
									type="text"
									bind:value={state.editUsername}
									class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								/>
							</div>
							<div>
								<label for="edit-skill" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
									>Skill Level</label
								>
								<select
									id="edit-skill"
									bind:value={state.editSkillLevel}
									class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								>
									{#each skillLevels as level}
										<option value={level}
											>{level.charAt(0).toUpperCase() + level.slice(1)}</option
										>
									{/each}
								</select>
							</div>

							<!-- Dark mode toggle -->
							<div class="flex items-center justify-between rounded-xl border border-gray-200 p-4 dark:border-gray-700">
								<div>
									<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
									<p class="text-xs text-gray-400">Toggle dark theme</p>
								</div>
								<button
									role="switch"
									aria-label="Toggle dark mode"
									aria-checked={$darkMode}
									onclick={() => darkMode.update((v) => !v)}
									class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
										$darkMode ? 'bg-[#1F41BB]' : 'bg-gray-200 dark:bg-gray-600'
									}`}
								>
									<span
										class={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
											$darkMode ? 'translate-x-5' : 'translate-x-0'
										}`}
									></span>
								</button>
							</div>

							<button
								onclick={saveProfile}
								disabled={state.saving}
								class="w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-300"
							>
								{state.saving ? 'Saving…' : 'Save Changes'}
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- ── Analytics sections ── -->

			<!-- Monthly Overview -->
			<div class="mt-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-xs font-bold uppercase tracking-wide text-gray-400">Monthly Overview</h3>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<!-- Distance this month vs last -->
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Distance This Month</p>
						<p class="mt-2 text-2xl font-bold text-[#1F41BB]">
							{formatDistance(state.profile.stats.thisMonthDistance)}
						</p>
						{#if state.profile.stats.lastMonthDistance > 0 || state.profile.stats.thisMonthDistance > 0}
							<div class="mt-1 flex items-center gap-1.5 text-xs">
								<span class={`font-bold ${imp.improved ? 'text-[#2ECC71]' : 'text-[#FF6B6B]'}`}>
									{imp.improved ? '↑' : '↓'}{imp.pct}%
								</span>
								<span class="text-gray-400">vs {formatDistance(state.profile.stats.lastMonthDistance)} last month</span>
							</div>
						{:else}
							<p class="mt-1 text-xs text-gray-400">No prior month data</p>
						{/if}
					</div>

					<!-- Sessions this month vs last -->
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Sessions This Month</p>
						<p class="mt-2 text-2xl font-bold text-[#0ABFBC]">
							{state.profile.stats.thisMonthSessions}
						</p>
						{#if state.profile.stats.lastMonthSessions > 0 || state.profile.stats.thisMonthSessions > 0}
							<div class="mt-1 flex items-center gap-1.5 text-xs">
								<span class={`font-bold ${sessImp.improved ? 'text-[#2ECC71]' : 'text-[#FF6B6B]'}`}>
									{sessImp.improved ? '↑' : '↓'}{sessImp.pct}%
								</span>
								<span class="text-gray-400">vs {state.profile.stats.lastMonthSessions} last month</span>
							</div>
						{:else}
							<p class="mt-1 text-xs text-gray-400">No prior month data</p>
						{/if}
					</div>

					<!-- Best pace this month -->
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<p class="text-xs font-medium text-gray-500 dark:text-gray-400">Best Pace This Month</p>
						<p class="mt-2 text-2xl font-bold text-[#FF6B6B]">
							{formatPace(state.profile.stats.bestPaceThisMonth)}
						</p>
						<p class="mt-1 text-xs text-gray-400">
							{state.profile.stats.bestPaceThisMonth > 0 ? 'min per 100m' : 'no data this month'}
						</p>
					</div>
				</div>
			</div>

			<!-- Personal Records -->
			<div class="mt-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-xs font-bold uppercase tracking-wide text-gray-400">Personal Records</h3>
				<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<div class="text-2xl">🏊</div>
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">Longest Swim</p>
						<p class="mt-1 text-xl font-bold text-[#1F41BB]">
							{state.profile.stats.personalBestDistance > 0
								? formatDistance(state.profile.stats.personalBestDistance)
								: '—'}
						</p>
					</div>
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<div class="text-2xl">⚡</div>
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">Fastest Pace</p>
						<p class="mt-1 text-xl font-bold text-[#0ABFBC]">
							{formatPace(state.profile.stats.personalBestPace)}
						</p>
					</div>
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<div class="text-2xl">📅</div>
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">Most Sessions/Week</p>
						<p class="mt-1 text-xl font-bold text-[#FF6B6B]">
							{state.profile.stats.mostSessionsInWeek > 0
								? `${state.profile.stats.mostSessionsInWeek}`
								: '—'}
						</p>
					</div>
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<div class="text-2xl">🔥</div>
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">Longest Streak</p>
						<p class="mt-1 text-xl font-bold text-[#2ECC71]">
							{state.profile.stats.longestStreak > 0
								? `${state.profile.stats.longestStreak} days`
								: '—'}
						</p>
					</div>
				</div>
			</div>

			<!-- Weekly Summary Table -->
			<div class="mt-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-xs font-bold uppercase tracking-wide text-gray-400">Weekly Summary — Last 8 Weeks</h3>
				{#if state.profile.stats.weeklyStats.every((w) => w.sessions === 0)}
					<div class="flex h-24 items-center justify-center">
						<p class="text-sm text-gray-400">No activity data to display</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full min-w-[580px] text-sm">
							<thead>
								<tr class="border-b border-gray-200 dark:border-gray-700">
									<th class="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Week</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Distance</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Sessions</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Avg Pace</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Calories</th>
									<th class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Best Session</th>
								</tr>
							</thead>
							<tbody>
								{#each state.profile.stats.weeklyStats as week, i}
									{@const isBest = i === bestWeekIdx}
									<tr
										class={`border-b border-gray-100 transition-colors last:border-0 dark:border-gray-700/50 ${
											isBest ? 'bg-green-50 dark:bg-green-900/20' : ''
										}`}
									>
										<td class="py-3 pr-4">
											<span class="font-medium text-[#0D1B4B] dark:text-white">
												{i === 0 ? 'This week' : i === 1 ? 'Last week' : `Week of ${formatWeekLabel(week.weekStart)}`}
											</span>
											{#if isBest && week.sessions > 0}
												<span
													class="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400"
												>BEST</span>
											{/if}
										</td>
										<td class="py-3 text-right font-semibold text-[#1F41BB]">
											{week.distance > 0 ? formatDistance(week.distance) : '—'}
										</td>
										<td class="py-3 text-right text-gray-600 dark:text-gray-400">
											{week.sessions > 0 ? week.sessions : '—'}
										</td>
										<td class="py-3 text-right text-gray-600 dark:text-gray-400">
											{week.avgPace > 0 ? formatPace(week.avgPace) : '—'}
										</td>
										<td class="py-3 text-right text-gray-600 dark:text-gray-400">
											{week.calories > 0 ? `${week.calories.toLocaleString()} kcal` : '—'}
										</td>
										<td class="py-3 text-right font-medium text-[#0ABFBC]">
											{week.bestSession > 0 ? formatDistance(week.bestSession) : '—'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
