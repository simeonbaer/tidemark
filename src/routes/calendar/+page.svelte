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

	interface InviteUser {
		_id: string;
		username: string;
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

	let state = $state({
		currentDate: new Date(),
		userId: null as string | null,
		userName: null as string | null,
		events: new Map<string, ActivityByDate>(),
		loading: true,
		selectedDay: null as string | null,
		selectedDayActivities: null as ActivityByDate | null,
		// Invite modal
		showInviteModal: false,
		inviteUsers: [] as InviteUser[],
		inviteToUser: null as InviteUser | null,
		inviteTime: '08:00',
		inviteLocation: '',
		inviteMessage: '',
		inviteSending: false,
		inviteSuccess: false,
		inviteError: '',
		// Accepted invites for calendar overlay
		acceptedInvites: [] as Invite[]
	});

	onMount(async () => {
		state.userId = localStorage.getItem('userId');
		state.userName = localStorage.getItem('userName');
		if (!state.userId) {
			await goto('/auth');
			return;
		}
		await Promise.all([loadCalendarData(), loadInviteUsers(), loadAcceptedInvites()]);
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

	async function loadInviteUsers() {
		try {
			const response = await fetch(`/api/users?excludeUserId=${state.userId}`);
			if (!response.ok) return;
			state.inviteUsers = await response.json();
		} catch (error) {
			console.error('Error loading users:', error);
		}
	}

	async function loadAcceptedInvites() {
		try {
			const response = await fetch(`/api/invites?userId=${state.userId}`);
			if (!response.ok) return;
			const all: Invite[] = await response.json();
			state.acceptedInvites = all.filter((inv) => inv.status === 'accepted');
		} catch (error) {
			console.error('Error loading invites:', error);
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
		state.showInviteModal = false;
		loadCalendarData();
		loadAcceptedInvites();
	}

	function nextMonth() {
		state.currentDate = new Date(state.currentDate.getFullYear(), state.currentDate.getMonth() + 1);
		state.loading = true;
		state.selectedDay = null;
		state.selectedDayActivities = null;
		state.showInviteModal = false;
		loadCalendarData();
		loadAcceptedInvites();
	}

	function selectDay(dateStr: string) {
		state.selectedDay = dateStr;
		state.selectedDayActivities = state.events.get(dateStr) || null;
		// Reset and open invite modal
		state.inviteToUser = null;
		state.inviteTime = '08:00';
		state.inviteLocation = '';
		state.inviteMessage = '';
		state.inviteSuccess = false;
		state.inviteError = '';
		state.showInviteModal = true;
	}

	function openInviteModal() {
		state.inviteToUser = null;
		state.inviteTime = '08:00';
		state.inviteLocation = '';
		state.inviteMessage = '';
		state.inviteSuccess = false;
		state.inviteError = '';
		state.showInviteModal = true;
	}

	async function sendInvite() {
		if (!state.inviteToUser) {
			state.inviteError = 'Please select a swimmer to invite';
			return;
		}
		if (!state.inviteTime) {
			state.inviteError = 'Please enter a time';
			return;
		}
		if (!state.inviteLocation.trim()) {
			state.inviteError = 'Please enter a location';
			return;
		}
		state.inviteSending = true;
		state.inviteError = '';
		try {
			const response = await fetch('/api/invites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fromUserId: state.userId,
					fromUsername: state.userName,
					toUserId: state.inviteToUser._id,
					toUsername: state.inviteToUser.username,
					date: state.selectedDay,
					time: state.inviteTime,
					location: state.inviteLocation.trim(),
					message: state.inviteMessage.trim()
				})
			});
			if (!response.ok) {
				const data = await response.json();
				state.inviteError = data.message || 'Failed to send invite';
				return;
			}
			state.inviteSuccess = true;
		} catch (error) {
			state.inviteError = 'Failed to send invite';
			console.error(error);
		} finally {
			state.inviteSending = false;
		}
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
		return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
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
	let acceptedInvitesByDate = $derived.by(() => {
		const map = new Map<string, Invite[]>();
		state.acceptedInvites.forEach((inv) => {
			const key = inv.date.split('T')[0];
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(inv);
		});
		return map;
	});
</script>

<div class="p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<!-- Page header -->
		<div
			class="mb-6 rounded-2xl bg-gradient-to-r from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] p-6 shadow-lg"
		>
			<h1 class="text-2xl font-bold text-white">Calendar</h1>
			<p class="mt-1 text-sm text-white/60">Click any day to invite a friend to swim</p>
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
								{@const invitesForDay = acceptedInvitesByDate.get(dateStr) || []}

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
									{#if invitesForDay.length > 0}
										<div class="mt-0.5 text-[10px]">🤝</div>
									{/if}
								</button>
							{/if}
						{/each}
					</div>

					<div class="mt-5 flex flex-wrap items-center gap-5 text-xs text-gray-400">
						<div class="flex items-center gap-2">
							<span
								class="inline-block h-3 w-3 rounded-sm bg-gradient-to-br from-[#1F41BB] to-[#0ABFBC]"
							></span>
							Days with activities
						</div>
						<div class="flex items-center gap-1.5">
							<span>🤝</span>
							Accepted swim invite
						</div>
					</div>
				{/if}
			</div>

			<!-- Day detail panel -->
			<div class="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
				{#if state.selectedDay}
					<h3 class="mb-4 text-base font-bold text-[#0D1B4B] dark:text-white">
						{formatDate(state.selectedDay)}
					</h3>

					{#if state.selectedDayActivities}
						<div class="space-y-3">
							{#each state.selectedDayActivities.activities as activity (activity._id)}
								<div class="rounded-xl bg-[#F0F4FF] p-4 dark:bg-gray-700">
									<div class="flex items-start justify-between">
										<div>
											<p class="font-semibold text-[#0D1B4B] dark:text-white">
												{formatDistance(activity.distance)}
											</p>
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
								<span class="font-semibold text-[#0D1B4B] dark:text-white"
									>{formatDistance(dayTotal)}</span
								>
							</div>
							<div class="flex justify-between text-sm">
								<span class="text-gray-400">Day Duration:</span>
								<span class="font-semibold text-[#0D1B4B] dark:text-white"
									>{formatDuration(dayDuration)}</span
								>
							</div>
						</div>
					{:else}
						<p class="mb-2 text-sm text-gray-400">No swims recorded</p>
					{/if}

					<!-- Accepted invites for this day -->
					{@const dayInvites = acceptedInvitesByDate.get(state.selectedDay) || []}
					{#if dayInvites.length > 0}
						<div class="mt-4 border-t pt-4 dark:border-gray-700">
							<p class="mb-2 text-xs font-bold uppercase tracking-wide text-[#0ABFBC]">
								Swim Invites
							</p>
							<div class="space-y-2">
								{#each dayInvites as invite (invite._id)}
									<div class="rounded-xl bg-teal-50 p-3 dark:bg-teal-900/20">
										<p class="text-sm font-semibold text-[#0D1B4B] dark:text-white">
											{invite.fromUserId === state.userId
												? `With ${invite.toUsername}`
												: `With ${invite.fromUsername}`}
										</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											{invite.time} · {invite.location}
										</p>
										{#if invite.message}
											<p class="mt-1 text-xs italic text-gray-400">"{invite.message}"</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<button
						onclick={openInviteModal}
						class="mt-4 w-full rounded-xl bg-[#F0F4FF] py-2.5 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100 dark:bg-gray-700 dark:text-blue-400 dark:hover:bg-gray-600"
					>
						+ Invite to Swim on This Day
					</button>
				{:else}
					<div class="flex h-48 flex-col items-center justify-center">
						<div class="mb-3 text-3xl">📅</div>
						<p class="text-center text-sm text-gray-400">
							Select a day to view activities or invite a friend
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Invite Modal -->
{#if state.showInviteModal && state.selectedDay}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
			<!-- Header -->
			<div class="mb-5 flex items-start justify-between">
				<div>
					<h2 class="text-lg font-bold text-[#0D1B4B] dark:text-white">Invite to Swim</h2>
					<p class="mt-0.5 text-sm text-gray-400">{formatDate(state.selectedDay)}</p>
				</div>
				<button
					onclick={() => (state.showInviteModal = false)}
					aria-label="Close modal"
					class="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
				>
					✕
				</button>
			</div>

			{#if state.inviteSuccess}
				<!-- Success state -->
				<div class="flex flex-col items-center py-6 text-center">
					<div class="mb-3 text-5xl">✅</div>
					<p class="text-lg font-semibold text-[#0D1B4B] dark:text-white">Invite Sent!</p>
					<p class="mt-1 text-sm text-gray-400">
						{state.inviteToUser?.username} will be notified of your invite.
					</p>
					<button
						onclick={() => (state.showInviteModal = false)}
						class="mt-5 rounded-xl bg-[#1F41BB] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a38a8]"
					>
						Close
					</button>
				</div>
			{:else}
				{#if state.inviteError}
					<div
						class="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
					>
						{state.inviteError}
					</div>
				{/if}

				<div class="space-y-4">
					<!-- User select -->
					<div>
						<label
							for="invite-user"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Invite swimmer <span class="text-red-400">*</span>
						</label>
						<select
							id="invite-user"
							value={state.inviteToUser?._id ?? ''}
							onchange={(e) => {
								const id = (e.target as HTMLSelectElement).value;
								state.inviteToUser = state.inviteUsers.find((u) => u._id === id) || null;
							}}
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						>
							<option value="">Select a swimmer…</option>
							{#each state.inviteUsers as user (user._id)}
								<option value={user._id}>{user.username}</option>
							{/each}
						</select>
					</div>

					<!-- Time -->
					<div>
						<label
							for="invite-time"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Time <span class="text-red-400">*</span>
						</label>
						<input
							id="invite-time"
							type="time"
							bind:value={state.inviteTime}
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<!-- Location -->
					<div>
						<label
							for="invite-location"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Location <span class="text-red-400">*</span>
						</label>
						<input
							id="invite-location"
							type="text"
							bind:value={state.inviteLocation}
							placeholder="e.g. Hallenbad Winterthur"
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<!-- Message -->
					<div>
						<label
							for="invite-message"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Message <span class="text-xs text-gray-400">(optional)</span>
						</label>
						<input
							id="invite-message"
							type="text"
							bind:value={state.inviteMessage}
							placeholder="e.g. Let's do some laps together!"
							class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						/>
					</div>

					<button
						onclick={sendInvite}
						disabled={state.inviteSending}
						class="w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-300"
					>
						{state.inviteSending ? 'Sending…' : 'Send Invite'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
