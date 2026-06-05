<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Activity {
		_id: string;
		userId: string;
		distance: number;
		duration: number;
		date: string;
		notes: string;
		createdAt: string;
		swimStyle: string;
		poolSize: number;
	}

	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

	function nowTime(): string {
		const d = new Date();
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	let state = $state({
		activities: [] as Activity[],
		loading: true,
		errorMessage: '',
		successMessage: '',
		userId: null as string | null,
		newActivity: {
			distance: 0,
			duration: 0,
			date: today,
			time: nowTime(),
			notes: '',
			swimStyle: 'unspecified',
			poolSize: 25
		},
		showForm: false
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		loadActivities();
	});

	async function loadActivities() {
		try {
			state.loading = true;
			const response = await fetch(`/api/activities?userId=${state.userId}`);
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to load activities';
				return;
			}
			state.activities = data;
		} catch (error) {
			state.errorMessage = 'An error occurred while loading activities';
			console.error(error);
		} finally {
			state.loading = false;
		}
	}

	async function submitActivity() {
		if (state.newActivity.distance === 0 || state.newActivity.duration === 0) {
			state.errorMessage = 'Please enter distance and duration';
			return;
		}
		try {
			const response = await fetch('/api/activities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: state.userId,
					distance: state.newActivity.distance,
					duration: state.newActivity.duration,
					date: new Date(`${state.newActivity.date}T${state.newActivity.time}`).toISOString(),
					notes: state.newActivity.notes,
					swimStyle: state.newActivity.swimStyle,
					poolSize: state.newActivity.poolSize
				})
			});
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to add activity';
				return;
			}
			state.successMessage = 'Activity logged!';
			state.newActivity = {
				distance: 0,
				duration: 0,
				date: today,
				time: nowTime(),
				notes: '',
				swimStyle: 'unspecified',
				poolSize: 25
			};
			state.showForm = false;
			state.errorMessage = '';
			loadActivities();
			setTimeout(() => {
				state.successMessage = '';
			}, 3000);
		} catch (error) {
			state.errorMessage = 'An error occurred while adding activity';
			console.error(error);
		}
	}

	function formatDate(dateString: string) {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatDistance(meters: number): string {
		if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
		return `${meters} m`;
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function calcPace100m(meters: number, minutes: number): string {
		if (meters === 0 || minutes === 0) return '—';
		return `${(minutes / (meters / 100)).toFixed(1)} min/100m`;
	}

	function calcCalories(minutes: number): number {
		return Math.round(minutes * 8);
	}

	function calcSpeed(meters: number, minutes: number): string {
		if (minutes === 0) return '—';
		return `${(meters / (minutes * 60)).toFixed(2)} m/s`;
	}

	function formatStyleLabel(style: string): string {
		if (!style || style === 'unspecified') return 'Mixed';
		return style.charAt(0).toUpperCase() + style.slice(1);
	}

	let visibleActivities = $derived(
		state.activities.filter((a) => {
			const actDate = new Date(a.date);
			const endOfToday = new Date();
			endOfToday.setHours(23, 59, 59, 999);
			return actDate <= endOfToday;
		})
	);

	let totalStats = $derived.by(() => {
		const distance = visibleActivities.reduce((sum, a) => sum + (a.distance || 0), 0);
		const duration = visibleActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
		const calories = visibleActivities.reduce(
			(sum, a) => sum + calcCalories(a.duration || 0),
			0
		);
		const avgPace =
			distance > 0 && duration > 0
				? `${(duration / (distance / 100)).toFixed(1)} min/100m`
				: '—';
		return { distance, duration, activities: visibleActivities.length, calories, avgPace };
	});
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">Activity Log</h1>
			<p class="mt-1 text-sm text-white/60">Track and review all your swims</p>
		</div>

		{#if state.errorMessage}
			<div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{state.errorMessage}</div>
		{/if}
		{#if state.successMessage}
			<div class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
				{state.successMessage}
			</div>
		{/if}

		<!-- Stats -->
		{#if visibleActivities.length > 0}
			<div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Distance</p>
					<p class="mt-2 text-xl font-bold text-[#1F41BB]">{formatDistance(totalStats.distance)}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Duration</p>
					<p class="mt-2 text-xl font-bold text-[#0ABFBC]">{formatDuration(totalStats.duration)}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Swims</p>
					<p class="mt-2 text-xl font-bold text-[#0D1B4B] dark:text-white">{totalStats.activities}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Avg Pace</p>
					<p class="mt-2 text-xl font-bold text-[#FF6B6B]">{totalStats.avgPace}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm dark:bg-gray-800">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Calories</p>
					<p class="mt-2 text-xl font-bold text-[#2ECC71]">
						{totalStats.calories.toLocaleString()} kcal
					</p>
				</div>
			</div>
		{/if}

		<!-- Log swim button -->
		<div class="mb-6">
			<button
				onclick={() => (state.showForm = !state.showForm)}
				class="rounded-xl bg-[#1F41BB] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8]"
			>
				{state.showForm ? '✕ Cancel' : '+ Log Swim'}
			</button>
		</div>

		<!-- Log swim form -->
		{#if state.showForm}
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				<h2 class="mb-5 text-lg font-bold text-[#0D1B4B] dark:text-white">Log New Swim</h2>
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="log-distance" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Distance (meters)</label
							>
							<input
								id="log-distance"
								type="number"
								bind:value={state.newActivity.distance}
								min="0"
								step="100"
								placeholder="e.g., 1000"
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							/>
						</div>
						<div>
							<label for="log-duration" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Duration (minutes)</label
							>
							<input
								id="log-duration"
								type="number"
								bind:value={state.newActivity.duration}
								min="0"
								step="5"
								placeholder="e.g., 30"
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="log-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
							<input
								id="log-date"
								type="date"
								bind:value={state.newActivity.date}
								max={today}
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							/>
						</div>
						<div>
							<label for="log-time" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
							<input
								id="log-time"
								type="time"
								bind:value={state.newActivity.time}
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							/>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="log-swim-style" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Swim Style</label
							>
							<select
								id="log-swim-style"
								bind:value={state.newActivity.swimStyle}
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							>
								<option value="freestyle">Freestyle</option>
								<option value="breaststroke">Breaststroke</option>
								<option value="backstroke">Backstroke</option>
								<option value="butterfly">Butterfly</option>
								<option value="unspecified">Unspecified</option>
							</select>
						</div>
						<div>
							<label for="log-pool-size" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
								>Pool Size</label
							>
							<select
								id="log-pool-size"
								bind:value={state.newActivity.poolSize}
								class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
							>
								<option value={25}>25 m</option>
								<option value={50}>50 m</option>
								<option value={100}>100 m</option>
							</select>
						</div>
					</div>
					<div>
						<label for="log-notes" class="block text-sm font-medium text-gray-700 dark:text-gray-300"
							>Notes (optional)</label
						>
						<input
							id="log-notes"
							type="text"
							bind:value={state.newActivity.notes}
							placeholder="e.g., Morning swim, felt great"
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>
					<button
						onclick={submitActivity}
						class="w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8]"
					>
						Log Swim
					</button>
				</div>
			</div>
		{/if}

		<!-- Activities list -->
		{#if state.loading}
			<p class="text-center text-sm text-gray-400">Loading activities…</p>
		{:else if visibleActivities.length === 0}
			<div class="rounded-2xl bg-white p-10 text-center shadow-sm dark:bg-gray-800">
				<div class="mb-3 text-4xl">🏊</div>
				<p class="text-gray-400">No swims logged yet. Log your first swim to get started!</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each visibleActivities as activity}
					<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
						<!-- Header -->
						<div class="mb-3 flex items-start justify-between">
							<div>
								<h3 class="text-lg font-bold text-[#0D1B4B] dark:text-white">
									{formatDistance(activity.distance)}
								</h3>
								<p class="text-sm text-gray-400">{formatDate(activity.date)}</p>
							</div>
							<div class="text-right">
								<p class="text-lg font-semibold text-[#1F41BB]">
									{formatDuration(activity.duration)}
								</p>
								<p class="text-sm text-gray-400">
									{calcPace100m(activity.distance, activity.duration)}
								</p>
							</div>
						</div>

						<!-- Badges -->
						<div class="mb-3 flex flex-wrap gap-2">
							<span
								class="rounded-full bg-[#1F41BB]/10 px-3 py-1 text-xs font-medium text-[#1F41BB]"
							>
								🏊 {formatStyleLabel(activity.swimStyle)}
							</span>
							<span
								class="rounded-full bg-[#0ABFBC]/10 px-3 py-1 text-xs font-medium text-[#0ABFBC]"
							>
								🏊‍♂️ {activity.poolSize || 25}m pool
							</span>
							<span
								class="rounded-full bg-[#FF6B6B]/10 px-3 py-1 text-xs font-medium text-[#FF6B6B]"
							>
								🔥 {calcCalories(activity.duration)} kcal
							</span>
						</div>

						{#if activity.notes}
							<div class="mb-3 rounded-xl bg-[#F0F4FF] p-3 dark:bg-gray-700">
								<p class="text-sm text-gray-600 dark:text-gray-400">{activity.notes}</p>
							</div>
						{/if}

						<!-- Stats row -->
						<div class="grid grid-cols-3 gap-3 text-center">
							<div class="rounded-xl bg-[#F0F4FF] py-3 dark:bg-gray-700">
								<p class="text-xs text-gray-400">⏱️ Pace</p>
								<p class="text-sm font-semibold text-[#1F41BB]">
									{calcPace100m(activity.distance, activity.duration)}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] py-3 dark:bg-gray-700">
								<p class="text-xs text-gray-400">Speed</p>
								<p class="text-sm font-semibold text-[#0ABFBC]">
									{calcSpeed(activity.distance, activity.duration)}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] py-3 dark:bg-gray-700">
								<p class="text-xs text-gray-400">🔥 Calories</p>
								<p class="text-sm font-semibold text-[#FF6B6B]">
									{calcCalories(activity.duration)} kcal
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
