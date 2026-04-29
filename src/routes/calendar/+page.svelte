<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	interface CalendarEvent {
		date: string;
		count: number;
	}

	let state = $state({
		currentDate: new Date(),
		userId: null as string | null,
		userName: null as string | null,
		events: new Map<string, number>(),
		loading: true
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
			data.forEach((event: CalendarEvent) => {
				state.events.set(event.date, event.count);
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
		loadCalendarData();
	}

	function nextMonth() {
		state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1);
		state.loading = true;
		loadCalendarData();
	}

	function handleLogout() {
		localStorage.removeItem('userId');
		localStorage.removeItem('userName');
		goto('/auth');
	}

	let monthName = $derived(
		state.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
	);
	let daysInMonth = $derived(getDaysInMonth(state.currentDate));
	let firstDay = $derived(getFirstDayOfMonth(state.currentDate));
	let days = $derived(Array.from({ length: daysInMonth }, (_, i) => i + 1));
	let paddedDays = $derived(Array.from({ length: firstDay }, () => null).concat(days));
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
			<a
				href="/battle"
				class="bg-opacity-30 hover:bg-opacity-50 rounded-lg bg-white px-6 py-2 font-semibold text-white transition"
			>
				Battle
			</a>
			<a
				href="/activity-log"
				class="bg-opacity-30 hover:bg-opacity-50 rounded-lg bg-white px-6 py-2 font-semibold text-white transition"
			>
				Activity Log
			</a>
			<a href="/calendar" class="rounded-lg bg-white px-6 py-2 font-semibold text-blue-600">
				Calendar
			</a>
		</div>

		<!-- Calendar -->
		<div class="rounded-lg bg-white p-6 shadow-2xl">
			<div class="mb-6 flex items-center justify-between">
				<button
					onclick={previousMonth}
					class="rounded bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
				>
					← Previous
				</button>
				<h2 class="text-2xl font-bold text-gray-800">{monthName}</h2>
				<button
					onclick={nextMonth}
					class="rounded bg-blue-500 px-4 py-2 text-white transition hover:bg-blue-600"
				>
					Next →
				</button>
			</div>

			{#if state.loading}
				<div class="text-center text-gray-600">Loading calendar...</div>
			{:else}
				<div class="grid grid-cols-7 gap-2">
					<!-- Day headers -->
					{#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
						<div class="text-center font-bold text-gray-700">{day}</div>
					{/each}

					<!-- Days -->
					{#each paddedDays as day}
						{#if day === null}
							<div class="rounded bg-gray-100 p-3"></div>
						{:else}
							{@const dateStr = getDateString(day)}
							{@const eventCount = state.events.get(dateStr) || 0}
							<div
								class={`rounded p-3 text-center font-semibold ${
									eventCount > 0
										? 'bg-gradient-to-br from-blue-400 to-purple-500 text-white'
										: 'bg-gray-100 text-gray-700'
								}`}
							>
								<div>{day}</div>
								{#if eventCount > 0}
									<div class="text-xs">{eventCount} {eventCount === 1 ? 'battle' : 'battles'}</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>

				<div class="mt-6 space-y-2">
					<p class="text-sm text-gray-600">
						<span class="inline-block h-3 w-3 rounded bg-gradient-to-br from-blue-400 to-purple-500"
						></span>
						Days with battles
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
