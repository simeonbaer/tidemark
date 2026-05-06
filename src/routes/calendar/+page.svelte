<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Nav from '$lib/components/Nav.svelte';

	interface Activity {
		_id: string;
		distance: number;
		duration: number;
		notes: string;
	}

	interface ActivityByDate {
		date: string;
		count: number;
		activities: Activity[];
	}

	let state = $state({
		currentDate: new Date(),
		userId: null as string | null,
		userName: null as string | null,
		events: new Map<string, ActivityByDate>(),
		loading: true,
		selectedDay: null as string | null,
		selectedDayActivities: null as ActivityByDate | null
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');

		if (!state.userId) {
			await goto('/auth');
			return;
		}

		loadCalendarData();
	});

	async function loadCalendarData() {
		try {
			const response = await fetch(
				`/api/calendar?userId=${state.userId}&month=${state.currentDate.getMonth() + 1}&year=${state.currentDate.getFullYear()}`
			);
			const data = await response.json();

			if (!response.ok) {
				console.error('Failed to load calendar data');
				return;
			}

			state.events.clear();
			data.forEach((event: ActivityByDate) => {
				state.events.set(event.date, event);
			});
			state.events = state.events;
		} catch (error) {
			console.error('Error loading calendar:', error);
		} finally {
			state.loading = false;
		}
	}

	function getDaysInMonth(date: Date) {
		return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
	}

	function getFirstDayOfMonth(date: Date) {
		return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
	}

	function getDateString(day: number): string {
		const date = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth(), day);
		return date.toISOString().split('T')[0];
	}

	function previousMonth() {
		state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() - 1);
		state.loading = true;
		state.selectedDay = null;
		state.selectedDayActivities = null;
		loadCalendarData();
	}

	function nextMonth() {
		state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1);
		state.loading = true;
		state.selectedDay = null;
		state.selectedDayActivities = null;
		loadCalendarData();
	}

	function selectDay(dateStr: string) {
		state.selectedDay = dateStr;
		state.selectedDayActivities = state.events.get(dateStr) || null;
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
		return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
	}

	let monthName = $derived(
		state.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);
	let daysInMonth = $derived(getDaysInMonth(state.currentDate));
	let firstDay = $derived(getFirstDayOfMonth(state.currentDate));
	let days = $derived(Array.from({ length: daysInMonth }, (_, i) => i + 1));
	let paddedDays = $derived(Array.from({ length: firstDay }, () => null).concat(days));
	let dayTotal = $derived(
		state.selectedDayActivities?.activities.reduce((sum, a) => sum + a.distance, 0) ?? 0
	);
	let dayDuration = $derived(
		state.selectedDayActivities?.activities.reduce((sum, a) => sum + a.duration, 0) ?? 0
	);
</script>

<div class="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-6 pb-24 md:pb-6">
	<div class="mx-auto max-w-4xl">
		<Nav />

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Calendar -->
			<div class="rounded-lg bg-white p-6 shadow-2xl lg:col-span-2">
				<div class="mb-6 flex items-center justify-between">
					<button
						onclick={previousMonth}
						class="rounded bg-[#1F41BB] px-4 py-2 text-white transition hover:bg-[#1a38a8]"
					>
						← Previous
					</button>
					<h2 class="text-2xl font-bold text-gray-800">{monthName}</h2>
					<button
						onclick={nextMonth}
						class="rounded bg-[#1F41BB] px-4 py-2 text-white transition hover:bg-[#1a38a8]"
					>
						Next →
					</button>
				</div>

				{#if state.loading}
					<div class="text-center text-gray-600">Loading calendar...</div>
				{:else}
					<div class="grid grid-cols-7 gap-2">
						{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
							<div class="text-center font-bold text-gray-700">{day}</div>
						{/each}

						{#each paddedDays as day}
							{#if day === null}
								<div class="rounded bg-gray-100 p-3"></div>
							{:else}
								{@const dateStr = getDateString(day)}
								{@const dayData = state.events.get(dateStr)}
								{@const isSelected = state.selectedDay === dateStr}

								<button
									onclick={() => selectDay(dateStr)}
									class={`min-h-20 rounded p-2 text-center transition ${
										isSelected ? 'ring-2 ring-[#1F41BB]' : ''
									} ${
										dayData
											? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white'
											: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
									}`}
								>
									<div class="font-semibold">{day}</div>
									{#if dayData}
										<div class="mt-1 text-xs font-semibold">
											{dayData.count}
											{dayData.count === 1 ? 'swim' : 'swims'}
										</div>
										<div class="mt-1 text-xs">
											{formatDistance(dayData.activities.reduce((sum, a) => sum + a.distance, 0))}
										</div>
									{/if}
								</button>
							{/if}
						{/each}
					</div>

					<div class="mt-6 space-y-2">
						<p class="text-sm text-gray-600">
							<span class="inline-block h-3 w-3 rounded bg-gradient-to-br from-blue-400 to-purple-500"
							></span>
							Days with activities
						</p>
					</div>
				{/if}
			</div>

			<!-- Day Details Panel -->
			<div class="rounded-lg bg-white p-6 shadow-lg">
				{#if state.selectedDay && state.selectedDayActivities}
					<div>
						<h3 class="mb-4 text-lg font-bold text-gray-800">{formatDate(state.selectedDay)}</h3>

						<div class="space-y-3">
							{#each state.selectedDayActivities.activities as activity (activity._id)}
								<div class="rounded-lg bg-blue-50 p-4">
									<div class="flex items-start justify-between">
										<div>
											<div class="font-semibold text-gray-800">
												{formatDistance(activity.distance)}
											</div>
											<div class="text-sm text-gray-600">{formatDuration(activity.duration)}</div>
										</div>
										<div class="text-right text-xs text-gray-500">
											Pace:<br />
											{((activity.distance / activity.duration) * 60).toFixed(0)} m/min
										</div>
									</div>
									{#if activity.notes}
										<div class="mt-2 text-xs italic text-gray-600">{activity.notes}</div>
									{/if}
								</div>
							{/each}
						</div>

						<div class="mt-4 space-y-2 border-t pt-4">
							<div class="flex justify-between">
								<span class="text-sm text-gray-600">Day Total:</span>
								<span class="font-semibold text-gray-800">{formatDistance(dayTotal)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-sm text-gray-600">Day Duration:</span>
								<span class="font-semibold text-gray-800">{formatDuration(dayDuration)}</span>
							</div>
						</div>
					</div>
				{:else}
					<p class="text-center text-gray-500">Select a day to view activities</p>
				{/if}
			</div>
		</div>
	</div>
</div>
