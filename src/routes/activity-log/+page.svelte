<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface Activity {
		_id: string;
		userId: string;
		swimmer1: string;
		swimmer2: string;
		winnerId: string | null;
		sliderValue: number;
		createdAt: string;
	}

	let state = $state({
		activities: [] as Activity[],
		loading: true,
		errorMessage: '',
		userId: null as string | null,
		userName: null as string | null,
		newActivity: {
			swimmer1: '',
			swimmer2: '',
			winnerId: ''
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
		if (!state.newActivity.swimmer1 || !state.newActivity.swimmer2) {
			state.errorMessage = 'Please fill in swimmer names';
			return;
		}

		try {
			const response = await fetch('/api/activities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: state.userId,
					...state.newActivity
				})
			});

			const data = await response.json();

			if (!response.ok) {
				state.errorMessage = data.message || 'Failed to add activity';
				return;
			}

			state.newActivity = { swimmer1: '', swimmer2: '', winnerId: '' };
			state.showForm = false;
			state.errorMessage = '';
			loadActivities();
		} catch (error) {
			state.errorMessage = 'An error occurred while adding activity';
			console.error(error);
		}
	}

	function handleLogout() {
		localStorage.removeItem('userId');
		localStorage.removeItem('userName');
		goto('/auth');
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
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6">
	<div class="mx-auto max-w-4xl">
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
			<a href="/battle" class="rounded-lg bg-white bg-opacity-30 px-6 py-2 font-semibold text-white transition hover:bg-opacity-50">
				Battle
			</a>
			<a href="/activity-log" class="rounded-lg bg-white px-6 py-2 font-semibold text-blue-600">
				Activity Log
			</a>
			<a href="/calendar" class="rounded-lg bg-white bg-opacity-30 px-6 py-2 font-semibold text-white transition hover:bg-opacity-50">
				Calendar
			</a>
		</div>

		<!-- Add Activity Button -->
		<div class="mb-6">
			<button
				onclick={() => (state.showForm = !state.showForm)}
				class="rounded-lg bg-white px-6 py-3 font-semibold text-blue-600 transition hover:bg-opacity-90"
			>
				{state.showForm ? 'Cancel' : 'Add Activity'}
			</button>
		</div>

		<!-- Add Activity Form -->
		{#if state.showForm}
			<div class="mb-6 rounded-lg bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-800">Log Swim Battle</h2>
				{#if state.errorMessage}
					<div class="mb-4 rounded bg-red-100 p-3 text-red-700">{state.errorMessage}</div>
				{/if}
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700">Swimmer 1</label>
						<input
							type="text"
							bind:value={state.newActivity.swimmer1}
							placeholder="Enter swimmer name"
							class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Swimmer 2</label>
						<input
							type="text"
							bind:value={state.newActivity.swimmer2}
							placeholder="Enter swimmer name"
							class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700">Winner (optional)</label>
						<select
							bind:value={state.newActivity.winnerId}
							class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
						>
							<option value="">Select winner or draw</option>
							<option value="draw">Draw</option>
						</select>
					</div>
					<button
						onclick={submitActivity}
						class="w-full rounded bg-blue-500 py-2 font-semibold text-white transition hover:bg-blue-600"
					>
						Log Activity
					</button>
				</div>
			</div>
		{/if}

		<!-- Activities List -->
		{#if state.loading}
			<div class="text-center text-white">Loading activities...</div>
		{:else if state.activities.length === 0}
			<div class="rounded-lg bg-white p-6 text-center">
				<p class="text-gray-600">No activities logged yet.</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each state.activities as activity}
					<div class="rounded-lg bg-white p-6 shadow-lg">
						<div class="mb-3 flex items-center justify-between">
							<h3 class="text-lg font-bold text-gray-800">
								{activity.swimmer1} vs {activity.swimmer2}
							</h3>
							<span class="text-sm text-gray-500">{formatDate(activity.createdAt)}</span>
						</div>
						<div class="flex items-center justify-between">
							<div>
								{#if activity.winnerId}
									<p class="text-gray-700">
										Result: <span class="font-semibold">{activity.winnerId === activity.swimmer1 ? activity.swimmer1 : activity.swimmer2}</span>
										won
									</p>
								{:else}
									<p class="text-gray-700">Result: <span class="font-semibold">Draw</span></p>
								{/if}
							</div>
							<div class="text-right">
								<p class="text-sm text-gray-600">Confidence: {Math.abs(activity.sliderValue - 50)}%</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
