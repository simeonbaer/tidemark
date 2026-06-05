<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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
		events: new Map<string, ActivityByDate>(),
		loading: true,
		selectedDay: null as string | null,
		selectedDayActivities: null as ActivityByDate | null
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
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
		if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
		return `${meters} m`;
	}

	function formatDuration(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
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

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">Calendar</h1>
			<p class="mt-1 text-sm text-white/60">Your swim history at a glance</p>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Calendar -->
			<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800 lg:col-span-2">
				<div class="mb-6 flex items-center justify-between">
					<button
						onclick={previousMonth}
						class="rounded-xl bg-[#F0F4FF] px-4 py-2 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400 dark:hover:bg-gray-600"
					>
						← Prev
					</button>
					<h2 class="text-lg font-bold text-[#0D1B4B] dark:text-white">{monthName}</h2>
					<button
						onclick={nextMonth}
						class="rounded-xl bg-[#F0F4FF] px-4 py-2 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400 dark:hover:bg-gray-600"
					>
						Next →
					</button>
				</div>

				{#if state.loading}
					<p class="text-center text-sm text-gray-400">Loading calendar…</p>
				{:else}
					<div class="grid grid-cols-7 gap-1.5">
						{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
							<div class="py-1 text-center text-xs font-semibold text-gray-400">{day}</div>
						{/each}

						{#each paddedDays as day}
							{#if day === null}
								<div class="rounded-xl bg-gray-50 p-2 opacity-0 dark:bg-gray-700/30"></div>
							{:else}
								{@const dateStr = getDateString(day)}
								{@const dayData = state.events.get(dateStr)}
								{@const isSelected = state.selectedDay === dateStr}

								<button
									onclick={() => selectDay(dateStr)}
									class={`min-h-16 rounded-xl p-2 text-center transition ${
										isSelected ? 'ring-2 ring-[#0ABFBC] ring-offset-1' : ''
									} ${
										dayData
											? 'bg-gradient-to-br from-[#1F41BB] to-[#0ABFBC] text-white shadow-sm'
											: 'bg-[#F0F4FF] text-gray-600 hover:bg-blue-100 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
									}`}
								>
									<div class="text-sm font-semibold">{day}</div>
									{#if dayData}
										<div class="mt-0.5 text-[10px] font-medium opacity-90">
											{dayData.count}
											{dayData.count === 1 ? 'swim' : 'swims'}
										</div>
										<div class="text-[10px] opacity-75">
											{formatDistance(dayData.activities.reduce((sum, a) => sum + a.distance, 0))}
										</div>
									{/if}
								</button>
							{/if}
						{/each}
					</div>

					<div class="mt-5 flex items-center gap-2 text-xs text-gray-400">
						<span
							class="inline-block h-3 w-3 rounded-sm bg-gradient-to-br from-[#1F41BB] to-[#0ABFBC]"
						></span>
						Days with activities
					</div>
				{/if}
			</div>

			<!-- Day detail panel -->
			<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				{#if state.selectedDay && state.selectedDayActivities}
					<h3 class="mb-4 text-base font-bold text-[#0D1B4B] dark:text-white">{formatDate(state.selectedDay)}</h3>
					<div class="space-y-3">
						{#each state.selectedDayActivities.activities as activity (activity._id)}
							<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
								<div class="flex items-start justify-between">
									<div>
										<p class="font-semibold text-[#0D1B4B] dark:text-white">{formatDistance(activity.distance)}</p>
										<p class="text-sm text-gray-400">{formatDuration(activity.duration)}</p>
									</div>
									<div class="text-right text-xs text-gray-400">
										{((activity.distance / activity.duration) * 60).toFixed(0)} m/min
									</div>
								</div>
								{#if activity.notes}
									<p class="mt-2 text-xs italic text-gray-400">{activity.notes}</p>
								{/if}
							</div>
						{/each}
					</div>
					<div class="mt-4 space-y-2 border-t pt-4 dark:border-gray-700">
						<div class="flex justify-between text-sm">
							<span class="text-gray-400">Day Total:</span>
							<span class="font-semibold text-[#0D1B4B] dark:text-white">{formatDistance(dayTotal)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-400">Day Duration:</span>
							<span class="font-semibold text-[#0D1B4B] dark:text-white">{formatDuration(dayDuration)}</span>
						</div>
					</div>
				{:else}
					<div class="flex h-48 flex-col items-center justify-center">
						<div class="mb-3 text-3xl">📅</div>
						<p class="text-center text-sm text-gray-400">Select a day to view activities</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
