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
	}

	const now = new Date();
	const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

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
			notes: ''
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
					date: new Date(state.newActivity.date).toISOString(),
					notes: state.newActivity.notes
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
				date: new Date().toISOString().split('T')[0],
				notes: ''
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

	function calculatePace(meters: number, minutes: number): string {
		if (minutes === 0) return '—';
		const pacePerKm = (minutes * 1000) / meters;
		const paceMinutes = Math.floor(pacePerKm);
		const paceSeconds = Math.round((pacePerKm - paceMinutes) * 60);
		return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`;
	}

	let visibleActivities = $derived(
		state.activities.filter((a) => {
			const actDate = new Date(a.date);
			const endOfToday = new Date();
			endOfToday.setHours(23, 59, 59, 999);
			return actDate <= endOfToday;
		})
	);

	function getTotalStats() {
		return {
			distance: visibleActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
			duration: visibleActivities.reduce((sum, a) => sum + (a.duration || 0), 0),
			activities: visibleActivities.length
		};
	}
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
			<div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.errorMessage}</div>
		{/if}
		{#if state.successMessage}
			<div class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
				{state.successMessage}
			</div>
		{/if}

		<!-- Stats -->
		{#if visibleActivities.length > 0}
			{@const stats = getTotalStats()}
			<div class="mb-6 grid grid-cols-3 gap-4">
				<div class="rounded-2xl bg-white p-5 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Distance</p>
					<p class="mt-2 text-2xl font-bold text-[#1F41BB]">{formatDistance(stats.distance)}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Duration</p>
					<p class="mt-2 text-2xl font-bold text-[#0ABFBC]">{formatDuration(stats.duration)}</p>
				</div>
				<div class="rounded-2xl bg-white p-5 shadow-sm">
					<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Total Swims</p>
					<p class="mt-2 text-2xl font-bold text-[#0D1B4B]">{stats.activities}</p>
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
			<div class="mb-6 rounded-2xl bg-white p-6 shadow-sm">
				<h2 class="mb-5 text-lg font-bold text-[#0D1B4B]">Log New Swim</h2>
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="log-distance" class="block text-sm font-medium text-gray-700"
								>Distance (meters)</label
							>
							<input
								id="log-distance"
								type="number"
								bind:value={state.newActivity.distance}
								min="0"
								step="100"
								placeholder="e.g., 1000"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="log-duration" class="block text-sm font-medium text-gray-700"
								>Duration (minutes)</label
							>
							<input
								id="log-duration"
								type="number"
								bind:value={state.newActivity.duration}
								min="0"
								step="5"
								placeholder="e.g., 30"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
					</div>
					<div>
						<label for="log-date" class="block text-sm font-medium text-gray-700">Date</label>
						<input
							id="log-date"
							type="date"
							bind:value={state.newActivity.date}
							max={today}
							class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
						/>
					</div>
					<div>
						<label for="log-notes" class="block text-sm font-medium text-gray-700"
							>Notes (optional)</label
						>
						<input
							id="log-notes"
							type="text"
							bind:value={state.newActivity.notes}
							placeholder="e.g., Morning swim, felt great"
							class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
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
			<div class="rounded-2xl bg-white p-10 text-center shadow-sm">
				<div class="mb-3 text-4xl">🏊</div>
				<p class="text-gray-400">No swims logged yet. Log your first swim to get started!</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each visibleActivities as activity}
					<div class="rounded-2xl bg-white p-6 shadow-sm">
						<div class="mb-3 flex items-start justify-between">
							<div>
								<h3 class="text-lg font-bold text-[#0D1B4B]">
									{formatDistance(activity.distance)}
								</h3>
								<p class="text-sm text-gray-400">{formatDate(activity.date)}</p>
							</div>
							<div class="text-right">
								<p class="text-lg font-semibold text-[#1F41BB]">
									{formatDuration(activity.duration)}
								</p>
								<p class="text-sm text-gray-400">
									Pace: {calculatePace(activity.distance, activity.duration)}
								</p>
							</div>
						</div>

						{#if activity.notes}
							<div class="mt-3 rounded-xl bg-[#F0F4FF] p-3">
								<p class="text-sm text-gray-600">{activity.notes}</p>
							</div>
						{/if}

						<div class="mt-4 grid grid-cols-3 gap-3 text-center">
							<div class="rounded-xl bg-[#F0F4FF] py-3">
								<p class="text-xs text-gray-400">Avg Speed</p>
								<p class="text-sm font-semibold text-[#1F41BB]">
									{((activity.distance / activity.duration) * 60).toFixed(0)} m/min
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] py-3">
								<p class="text-xs text-gray-400">Efficiency</p>
								<p class="text-sm font-semibold text-[#0ABFBC]">
									{(activity.distance / Math.max(activity.duration, 1)).toFixed(1)} m/m
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] py-3">
								<p class="text-xs text-gray-400">Distance/Hr</p>
								<p class="text-sm font-semibold text-[#0D1B4B]">
									{formatDistance((activity.distance / activity.duration) * 60)}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
