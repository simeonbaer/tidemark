<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { darkMode } from '$lib/stores/theme';
	import { pendingInviteCount } from '$lib/stores/inviteCount';

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

	interface Invite {
		_id: string;
		fromUserId: string;
		fromUsername: string;
		toUserId: string;
		toUsername: string;
		date: string;
		time: string;
		location: string;
		message: string;
		status: 'pending' | 'accepted' | 'declined';
		createdAt: string;
	}

	interface Achievement {
		id: string;
		name: string;
		emoji: string;
		desc: string;
		unlocked: boolean;
		unlockedAt: string | null;
	}

	interface DayData {
		label: string;
		date: string;
		distance: number;
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

	let inviteState = $state({
		invites: [] as Invite[],
		loading: false
	});

	let achievementsState = $state({
		achievements: [] as Achievement[],
		loading: false
	});

	let chartState = $state({
		period: '7d' as '7d' | '30d' | '3m',
		days: [] as DayData[],
		loading: false
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		loadProfile();
		loadInvites();
		loadAchievements();
		loadChartData();
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

	async function loadInvites() {
		if (!state.userId) return;
		inviteState.loading = true;
		try {
			const response = await fetch(`/api/invites?userId=${state.userId}`);
			if (!response.ok) return;
			const all: Invite[] = await response.json();
			inviteState.invites = all;
			const pending = all.filter(
				(inv) => inv.toUserId === state.userId && inv.status === 'pending'
			);
			pendingInviteCount.set(pending.length);
		} catch (error) {
			console.error('Error loading invites:', error);
		} finally {
			inviteState.loading = false;
		}
	}

	async function loadAchievements() {
		if (!state.userId) return;
		achievementsState.loading = true;
		try {
			const res = await fetch(`/api/achievements?userId=${state.userId}`);
			if (!res.ok) return;
			achievementsState.achievements = await res.json();
		} catch (e) {
			console.error('Error loading achievements:', e);
		} finally {
			achievementsState.loading = false;
		}
	}

	async function loadChartData() {
		if (!state.userId) return;
		chartState.loading = true;

		const now = new Date();
		const days: DayData[] = [];

		if (chartState.period === '7d') {
			for (let i = 6; i >= 0; i--) {
				const d = new Date(now);
				d.setDate(d.getDate() - i);
				days.push({
					label: d.toLocaleDateString('en-US', { weekday: 'short' }),
					date: d.toISOString().split('T')[0],
					distance: 0
				});
			}
		} else if (chartState.period === '30d') {
			for (let i = 29; i >= 0; i--) {
				const d = new Date(now);
				d.setDate(d.getDate() - i);
				const show = i % 5 === 0 || i === 0;
				days.push({
					label: show ? `${d.getDate()}.${d.getMonth() + 1}` : '',
					date: d.toISOString().split('T')[0],
					distance: 0
				});
			}
		} else {
			// 3 months — weekly buckets (13 weeks)
			for (let i = 12; i >= 0; i--) {
				const d = new Date(now);
				d.setDate(d.getDate() - i * 7);
				days.push({
					label: `${d.getDate()}.${d.getMonth() + 1}`,
					date: d.toISOString().split('T')[0],
					distance: 0
				});
			}
		}

		const startDate = days[0].date;
		const endDate = now.toISOString().split('T')[0];

		try {
			const res = await fetch(
				`/api/activities?userId=${state.userId}&startDate=${startDate}&endDate=${endDate}T23:59:59`
			);
			if (!res.ok) return;
			const activities: Array<{ date: string; distance: number }> = await res.json();

			if (chartState.period === '3m') {
				const startMs = new Date(startDate + 'T00:00:00').getTime();
				const msPerDay = 86400000;
				activities.forEach((act) => {
					const actMs = new Date(act.date).getTime();
					const dayOffset = Math.floor((actMs - startMs) / msPerDay);
					const weekIdx = Math.min(Math.max(Math.floor(dayOffset / 7), 0), 12);
					days[weekIdx].distance += act.distance;
				});
			} else {
				activities.forEach((act) => {
					const actDateStr = new Date(act.date).toISOString().split('T')[0];
					const dayEntry = days.find((d) => d.date === actDateStr);
					if (dayEntry) dayEntry.distance += act.distance;
				});
			}

			chartState.days = [...days];
		} catch (e) {
			console.error('Error loading chart data:', e);
		} finally {
			chartState.loading = false;
		}
	}

	async function setPeriod(p: '7d' | '30d' | '3m') {
		chartState.period = p;
		await loadChartData();
	}

	async function respondToInvite(inviteId: string, status: 'accepted' | 'declined') {
		try {
			const response = await fetch(`/api/invites/${inviteId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status })
			});
			if (!response.ok) return;
			inviteState.invites = inviteState.invites.map((inv) =>
				inv._id === inviteId ? { ...inv, status } : inv
			);
			const pending = inviteState.invites.filter(
				(inv) => inv.toUserId === state.userId && inv.status === 'pending'
			);
			pendingInviteCount.set(pending.length);
		} catch (error) {
			console.error('Error responding to invite:', error);
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

	function formatPace(minPer100m: number): string {
		if (minPer100m === 0) return '—';
		return `${minPer100m.toFixed(1)} min/100m`;
	}

	function formatWeekLabel(isoDate: string): string {
		return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatInviteDate(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function monthImprovement(
		thisMonth: number,
		lastMonth: number
	): { pct: number; improved: boolean } {
		if (lastMonth === 0) return { pct: thisMonth > 0 ? 100 : 0, improved: thisMonth > 0 };
		const raw = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
		return { pct: Math.abs(raw), improved: raw >= 0 };
	}

	function scrollToEdit() {
		document.getElementById('edit-profile')?.scrollIntoView({ behavior: 'smooth' });
	}

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

	let pendingReceivedInvites = $derived(
		inviteState.invites.filter(
			(inv) => inv.toUserId === state.userId && inv.status === 'pending'
		)
	);

	let unlockedAchievements = $derived(
		achievementsState.achievements.filter((a) => a.unlocked)
	);

	// SVG chart constants
	const CW = 700;
	const CH_SVG = 200;
	const PL = 55;
	const PR = 20;
	const PT = 15;
	const PB = 30;
	const innerW = CW - PL - PR;
	const innerH = CH_SVG - PT - PB;

	let chartComputed = $derived.by(() => {
		const days = chartState.days;
		if (!days.length) return null;
		const maxDist = Math.max(...days.map((d) => d.distance), 1);
		const n = days.length;
		const pts = days.map((d, i) => ({
			x: PL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW),
			y: PT + innerH - (d.distance / maxDist) * innerH,
			label: d.label,
			distance: d.distance
		}));
		const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
		const bottom = PT + innerH;
		const areaPath =
			`M${pts[0].x},${bottom} ` +
			pts.map((p) => `L${p.x},${p.y}`).join(' ') +
			` L${pts[pts.length - 1].x},${bottom} Z`;
		return { pts, polyline, areaPath, maxDist };
	});

	const skillLevels = ['beginner', 'intermediate', 'advanced', 'elite'];
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page banner -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">My Profile</h1>
			<p class="mt-1 text-sm text-white/60">View and edit your swimmer profile</p>
		</div>

		{#if state.errorMessage}
			<div
				class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
			>
				{state.errorMessage}
			</div>
		{/if}
		{#if state.successMessage}
			<div
				class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400"
			>
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

			<!-- ── 1. Profile Header ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<div class="flex flex-col items-center gap-5 sm:flex-row">
					<!-- Avatar -->
					<div class="shrink-0">
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
					</div>

					<!-- Name + details -->
					<div class="flex-1 text-center sm:text-left">
						<h2 class="text-2xl font-bold text-[#0D1B4B] dark:text-white">
							{state.profile.username}
						</h2>
						<p class="mt-1 text-sm capitalize text-gray-500 dark:text-gray-400">
							{state.profile.skillLevel}
						</p>
						<p class="mt-0.5 text-xs text-gray-400">{state.profile.email}</p>
					</div>

					<!-- Actions -->
					<div class="flex shrink-0 flex-wrap justify-center gap-2 sm:flex-col sm:items-end">
						<label
							for="profile-pic"
							class="cursor-pointer rounded-xl bg-[#F0F4FF] px-4 py-2 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400 dark:hover:bg-gray-600"
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
						<button
							onclick={scrollToEdit}
							class="rounded-xl bg-[#1F41BB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a38a8]"
						>
							Edit Profile
						</button>
					</div>
				</div>
			</div>

			<!-- ── 2. Swim Invitations ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<div class="mb-5 flex items-center justify-between">
					<h3 class="text-xs font-bold uppercase tracking-wide text-gray-400">
						Swim Invitations
					</h3>
					{#if pendingReceivedInvites.length > 0}
						<span
							class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400"
						>
							{pendingReceivedInvites.length} pending
						</span>
					{/if}
				</div>

				{#if inviteState.loading}
					<p class="text-center text-sm text-gray-400">Loading invitations…</p>
				{:else if pendingReceivedInvites.length === 0}
					<div class="flex h-24 flex-col items-center justify-center">
						<p class="text-sm text-gray-400">No pending swim invitations</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each pendingReceivedInvites as invite (invite._id)}
							<div
								class="rounded-xl border border-[#0ABFBC]/30 bg-teal-50 p-4 dark:border-teal-800 dark:bg-teal-900/20"
							>
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p class="font-semibold text-[#0D1B4B] dark:text-white">
											<span class="text-[#1F41BB]">{invite.fromUsername}</span> invited you to swim
										</p>
										<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">
											{formatInviteDate(invite.date)} at {invite.time}
										</p>
										<p class="text-sm text-gray-500 dark:text-gray-400">{invite.location}</p>
										{#if invite.message}
											<p class="mt-1.5 text-xs italic text-gray-400">"{invite.message}"</p>
										{/if}
									</div>
									<div class="flex shrink-0 gap-2">
										<button
											onclick={() => respondToInvite(invite._id, 'accepted')}
											class="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-600"
										>
											Accept
										</button>
										<button
											onclick={() => respondToInvite(invite._id, 'declined')}
											class="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
										>
											Decline
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ── 3. Stats Overview Cards ── -->
			<div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Distance</p>
					<p class="mt-2 text-2xl font-bold text-[#1F41BB]">
						{formatDistance(state.profile.stats.totalDistance)}
					</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Swims</p>
					<p class="mt-2 text-2xl font-bold text-[#0ABFBC]">
						{state.profile.stats.totalSwims}
					</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">This Month</p>
					<p class="mt-2 text-2xl font-bold text-[#0D1B4B] dark:text-white">
						{formatDistance(state.profile.stats.thisMonthDistance)}
					</p>
					{#if imp.pct > 0}
						<p
							class={`mt-0.5 text-xs font-medium ${imp.improved ? 'text-[#2ECC71]' : 'text-[#FF6B6B]'}`}
						>
							{imp.improved ? '↑' : '↓'}{imp.pct}% vs last month
						</p>
					{/if}
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Battles Won</p>
					<p class="mt-2 text-2xl font-bold text-[#2ECC71]">
						{state.profile.stats.battlesWon}
					</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Battles Lost</p>
					<p class="mt-2 text-2xl font-bold text-[#FF6B6B]">
						{state.profile.stats.battlesLost}
					</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Win Rate</p>
					<p class="mt-2 text-2xl font-bold text-[#1F41BB]">
						{state.profile.stats.winRate}%
					</p>
				</div>
			</div>

			<!-- ── 4. Line Chart ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<h3 class="text-xs font-bold uppercase tracking-wide text-gray-400">Swim Distance</h3>
					<div class="flex gap-1 rounded-xl bg-[#F0F4FF] p-1 dark:bg-gray-700">
						<button
							onclick={() => setPeriod('7d')}
							class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${chartState.period === '7d' ? 'bg-[#1F41BB] text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
						>
							7 Days
						</button>
						<button
							onclick={() => setPeriod('30d')}
							class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${chartState.period === '30d' ? 'bg-[#1F41BB] text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
						>
							30 Days
						</button>
						<button
							onclick={() => setPeriod('3m')}
							class={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${chartState.period === '3m' ? 'bg-[#1F41BB] text-white shadow' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
						>
							3 Months
						</button>
					</div>
				</div>

				{#if chartState.loading}
					<div class="flex h-48 items-center justify-center">
						<p class="text-sm text-gray-400">Loading chart…</p>
					</div>
				{:else if chartComputed}
					{@const gridColor = $darkMode ? '#374151' : '#e5e7eb'}
					{@const labelColor = $darkMode ? '#6b7280' : '#9ca3af'}
					<svg
						viewBox="0 0 {CW} {CH_SVG}"
						class="w-full"
						aria-label="Swim distance chart"
					>
						<defs>
							<linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#0ABFBC" stop-opacity="0.28" />
								<stop offset="100%" stop-color="#0ABFBC" stop-opacity="0" />
							</linearGradient>
						</defs>

						<!-- Gridlines + Y-axis labels -->
						{#each [0, 0.25, 0.5, 0.75, 1] as frac}
							{@const yPos = PT + innerH - frac * innerH}
							{@const yVal = chartComputed.maxDist * frac}
							<line
								x1={PL}
								y1={yPos}
								x2={CW - PR}
								y2={yPos}
								stroke={gridColor}
								stroke-width="1"
							/>
							<text
								x={PL - 6}
								y={yPos + 4}
								text-anchor="end"
								font-size="10"
								fill={labelColor}
							>
								{yVal >= 1000 ? `${(yVal / 1000).toFixed(1)}k` : Math.round(yVal)}
							</text>
						{/each}

						<!-- Area fill -->
						<path d={chartComputed.areaPath} fill="url(#areaGrad)" />

						<!-- Line -->
						<polyline
							points={chartComputed.polyline}
							fill="none"
							stroke="#1F41BB"
							stroke-width="2.5"
							stroke-linejoin="round"
							stroke-linecap="round"
						/>

						<!-- Dots -->
						{#each chartComputed.pts as p}
							<circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#1F41BB" stroke-width="2" />
						{/each}

						<!-- X-axis labels -->
						{#each chartComputed.pts as p}
							{#if p.label}
								<text
									x={p.x}
									y={CH_SVG - 4}
									text-anchor="middle"
									font-size="10"
									fill={labelColor}
								>
									{p.label}
								</text>
							{/if}
						{/each}
					</svg>
				{:else}
					<div class="flex h-48 items-center justify-center">
						<p class="text-sm text-gray-400">No activity data for this period</p>
					</div>
				{/if}
			</div>

			<!-- ── 5. Analytics / Weekly Table ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-xs font-bold uppercase tracking-wide text-gray-400">
					Weekly Summary — Last 8 Weeks
				</h3>
				{#if state.profile.stats.weeklyStats.every((w) => w.sessions === 0)}
					<div class="flex h-24 items-center justify-center">
						<p class="text-sm text-gray-400">No activity data to display</p>
					</div>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full min-w-[580px] text-sm">
							<thead>
								<tr class="border-b border-gray-200 dark:border-gray-700">
									<th
										class="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Week</th
									>
									<th
										class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Distance</th
									>
									<th
										class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Sessions</th
									>
									<th
										class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Avg Pace</th
									>
									<th
										class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Calories</th
									>
									<th
										class="pb-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400"
										>Best Session</th
									>
								</tr>
							</thead>
							<tbody>
								{#each state.profile.stats.weeklyStats as week, i}
									{@const isBest = i === bestWeekIdx}
									<tr
										class={`border-b border-gray-100 transition-colors last:border-0 dark:border-gray-700/50 ${isBest ? 'bg-green-50 dark:bg-green-900/20' : ''}`}
									>
										<td class="py-3 pr-4">
											<span class="font-medium text-[#0D1B4B] dark:text-white">
												{i === 0
													? 'This week'
													: i === 1
														? 'Last week'
														: `Week of ${formatWeekLabel(week.weekStart)}`}
											</span>
											{#if isBest && week.sessions > 0}
												<span
													class="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400"
													>BEST</span
												>
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

			<!-- ── 6. Personal Records ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-xs font-bold uppercase tracking-wide text-gray-400">
					Personal Records
				</h3>
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
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
							Most Sessions/Week
						</p>
						<p class="mt-1 text-xl font-bold text-[#FF6B6B]">
							{state.profile.stats.mostSessionsInWeek > 0
								? `${state.profile.stats.mostSessionsInWeek}`
								: '—'}
						</p>
					</div>
					<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
						<div class="text-2xl">🔥</div>
						<p class="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
							Longest Streak
						</p>
						<p class="mt-1 text-xl font-bold text-[#2ECC71]">
							{state.profile.stats.longestStreak > 0
								? `${state.profile.stats.longestStreak} days`
								: '—'}
						</p>
					</div>
				</div>
			</div>

			<!-- ── 7. Achievements Badges ── -->
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-xs font-bold uppercase tracking-wide text-gray-400">Achievements</h3>
					{#if achievementsState.achievements.length > 0}
						<span class="text-xs text-gray-400">
							{unlockedAchievements.length} / {achievementsState.achievements.length} unlocked
						</span>
					{/if}
				</div>

				{#if achievementsState.loading}
					<p class="text-center text-sm text-gray-400">Loading achievements…</p>
				{:else if achievementsState.achievements.length === 0}
					<div class="flex h-24 items-center justify-center">
						<p class="text-sm text-gray-400">No achievements yet — start swimming!</p>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
						{#each achievementsState.achievements as ach}
							<div
								class={`rounded-xl p-4 text-center transition ${ach.unlocked ? 'bg-[#F0F4FF] dark:bg-gray-700' : 'bg-gray-50 opacity-50 dark:bg-gray-800/50'}`}
							>
								<div class="text-3xl">{ach.emoji}</div>
								<p class="mt-2 text-xs font-semibold text-[#0D1B4B] dark:text-white">
									{ach.name}
								</p>
								<p class="mt-0.5 text-[10px] text-gray-400">{ach.desc}</p>
								{#if ach.unlocked}
									<p class="mt-1 text-[9px] font-medium text-[#0ABFBC]">Unlocked ✓</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- ── 8. Edit Profile Form ── -->
			<div id="edit-profile" class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h3 class="mb-5 text-lg font-bold text-[#0D1B4B] dark:text-white">Edit Profile</h3>
				<div class="space-y-4">
					<div>
						<label
							for="edit-username"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label
						>
						<input
							id="edit-username"
							type="text"
							bind:value={state.editUsername}
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>
					<div>
						<label
							for="edit-skill"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Skill Level</label
						>
						<select
							id="edit-skill"
							bind:value={state.editSkillLevel}
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						>
							{#each skillLevels as level}
								<option value={level}>{level.charAt(0).toUpperCase() + level.slice(1)}</option>
							{/each}
						</select>
					</div>

					<!-- Dark mode toggle -->
					<div
						class="flex items-center justify-between rounded-xl border border-gray-200 p-4 dark:border-gray-700"
					>
						<div>
							<p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
							<p class="text-xs text-gray-400">Toggle dark theme</p>
						</div>
						<button
							role="switch"
							aria-label="Toggle dark mode"
							aria-checked={$darkMode}
							onclick={() => darkMode.update((v) => !v)}
							class={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${$darkMode ? 'bg-[#1F41BB]' : 'bg-gray-200 dark:bg-gray-600'}`}
						>
							<span
								class={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${$darkMode ? 'translate-x-5' : 'translate-x-0'}`}
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
		{/if}
	</div>
</div>
