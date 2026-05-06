<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';

	interface Activity {
		_id: string;
		userId: string;
		distance: number;
		duration: number;
		date: string;
		notes: string;
		createdAt: string;
	}

	let state = $state({
		activities: [] as Activity[],
		loading: true,
		errorMessage: '',
		successMessage: '',
		userId: null as string | null,
		userName: null as string | null,
		newActivity: {
			distance: 0,
			duration: 0,
			date: new Date().toISOString().split('T')[0],
			notes: ''
		},
		showForm: false
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');

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

			state.successMessage = 'Activity logged successfully!';
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

	function calculatePace(meters: number, minutes: number): string {
		if (minutes === 0) return '—';
		const pacePerKm = (minutes * 1000) / meters;
		const paceMinutes = Math.floor(pacePerKm);
		const paceSeconds = Math.round((pacePerKm - paceMinutes) * 60);
		return `${paceMinutes}:${paceSeconds.toString().padStart(2, '0')}/km`;
	}

	function getTotalStats(): { distance: number; duration: number; activities: number } {
		return {
			distance: state.activities.reduce((sum, a) => sum + (a.distance || 0), 0),
			duration: state.activities.reduce((sum, a) => sum + (a.duration || 0), 0),
			activities: state.activities.length
		};
	}
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6 pb-24 md:pb-6">
	<div class="mx-auto max-w-4xl">
		<Nav />

		{#if state.errorMessage}
			<div class="mb-4 rounded-lg bg-red-100 p-4 text-red-700">{state.errorMessage}</div>
		{/if}

		{#if state.successMessage}
			<div class="mb-4 rounded-lg bg-green-100 p-4 text-green-700">{state.successMessage}</div>
		{/if}

		<!-- Statistics -->
		{#if state.activities.length > 0}
			{@const stats = getTotalStats()}
			<div class="mb-6 grid grid-cols-3 gap-4">
				<div class="rounded-lg bg-white p-6 shadow-lg">
					<div class="text-sm text-gray-600">Total Distance</div>
					<div class="mt-2 text-3xl font-bold text-[#1F41BB]">{formatDistance(stats.distance)}</div>
				</div>
				<div class="rounded-lg bg-white p-6 shadow-lg">
					<div class="text-sm text-gray-600">Total Duration</div>
					<div class="mt-2 text-3xl font-bold text-purple-600">{formatDuration(stats.duration)}</div>
				</div>
				<div class="rounded-lg bg-white p-6 shadow-lg">
					<div class="text-sm text-gray-600">Total Swims</div>
					<div class="mt-2 text-3xl font-bold text-green-600">{stats.activities}</div>
				</div>
			</div>
		{/if}

		<!-- Add Activity Button -->
		<div class="mb-6">
			<button
				onclick={() => (state.showForm = !state.showForm)}
				class="rounded-lg bg-white px-6 py-3 font-semibold text-[#1F41BB] transition hover:bg-opacity-90"
			>
				{state.showForm ? '✕ Cancel' : '+ Log Swim'}
			</button>
		</div>

		<!-- Add Activity Form -->
		{#if state.showForm}
			<div class="mb-6 rounded-lg bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-800">Log New Swim</h2>
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
								class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
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
								class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
							/>
						</div>
					</div>
					<div>
						<label for="log-date" class="block text-sm font-medium text-gray-700">Date</label>
						<input
							id="log-date"
							type="date"
							bind:value={state.newActivity.date}
							class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
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
							class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
						/>
					</div>
					<button
						onclick={submitActivity}
						class="w-full rounded bg-[#1F41BB] py-2 font-semibold text-white transition hover:bg-[#1a38a8]"
					>
						Log Swim
					</button>
				</div>
			</div>
		{/if}

		<!-- Activities List -->
		{#if state.loading}
			<div class="text-center text-white">Loading activities...</div>
		{:else if state.activities.length === 0}
			<div class="rounded-lg bg-white p-8 text-center shadow-lg">
				<p class="text-gray-600">No swims logged yet. Log your first swim to get started!</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each state.activities as activity}
					<div class="rounded-lg bg-white p-6 shadow-lg">
						<div class="mb-3 flex items-start justify-between">
							<div>
								<h3 class="text-lg font-bold text-gray-800">{formatDistance(activity.distance)}</h3>
								<p class="text-sm text-gray-500">{formatDate(activity.date)}</p>
							</div>
							<div class="text-right">
								<p class="text-lg font-semibold text-[#1F41BB]">{formatDuration(activity.duration)}</p>
								<p class="text-sm text-gray-500">
									Pace: {calculatePace(activity.distance, activity.duration)}
								</p>
							</div>
						</div>

						{#if activity.notes}
							<div class="mt-3 rounded bg-gray-50 p-3">
								<p class="text-sm text-gray-700">{activity.notes}</p>
							</div>
						{/if}

						<div class="mt-3 grid grid-cols-3 gap-2 text-center">
							<div class="rounded bg-blue-50 py-2">
								<div class="text-xs text-gray-600">Avg Speed</div>
								<div class="text-sm font-semibold text-[#1F41BB]">
									{((activity.distance / activity.duration) * 60).toFixed(0)} m/min
								</div>
							</div>
							<div class="rounded bg-purple-50 py-2">
								<div class="text-xs text-gray-600">Efficiency</div>
								<div class="text-sm font-semibold text-purple-600">
									{(activity.distance / Math.max(activity.duration, 1)).toFixed(1)} m/m
								</div>
							</div>
							<div class="rounded bg-green-50 py-2">
								<div class="text-xs text-gray-600">Distance/Hr</div>
								<div class="text-sm font-semibold text-green-600">
									{formatDistance((activity.distance / activity.duration) * 60)}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
