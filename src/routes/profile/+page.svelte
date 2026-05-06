<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

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

	function monthImprovement(
		thisMonth: number,
		lastMonth: number
	): { pct: number; improved: boolean } {
		if (lastMonth === 0) return { pct: thisMonth > 0 ? 100 : 0, improved: thisMonth > 0 };
		const raw = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
		return { pct: Math.abs(raw), improved: raw >= 0 };
	}

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
			<div class="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{state.errorMessage}</div>
		{/if}
		{#if state.successMessage}
			<div class="mb-4 rounded-xl bg-green-50 p-4 text-sm text-green-700">
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
			<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<!-- Left column: avatar + monthly progress -->
				<div class="space-y-4">
					<div class="rounded-2xl bg-white p-6 shadow-sm">
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
								class="mt-3 cursor-pointer rounded-lg bg-[#F0F4FF] px-4 py-2 text-sm font-medium text-[#1F41BB] transition hover:bg-blue-100"
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
							<h2 class="text-xl font-bold text-[#0D1B4B]">{state.profile.username}</h2>
							<p class="mt-1 text-sm capitalize text-gray-500">{state.profile.skillLevel}</p>
							<p class="mt-1 text-xs text-gray-400">{state.profile.email}</p>
						</div>
					</div>

					<!-- Monthly improvement -->
					<div class="rounded-2xl bg-white p-5 shadow-sm">
						<p class="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">
							Monthly Progress
						</p>
						<p class="text-2xl font-bold text-[#0D1B4B]">
							{formatDistance(state.profile.stats.thisMonthDistance)}
						</p>
						<p class="mt-0.5 text-xs text-gray-400">this month</p>
						{#if state.profile.stats.lastMonthDistance > 0 || state.profile.stats.thisMonthDistance > 0}
							<div class="mt-2 flex items-center gap-1.5">
								<span
									class={`text-sm font-bold ${imp.improved ? 'text-[#2ECC71]' : 'text-[#FF6B6B]'}`}
								>
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

				<!-- Right column: stats + edit -->
				<div class="space-y-6 lg:col-span-2">
					<!-- Swim stats -->
					<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
						<div class="rounded-2xl bg-white p-5 shadow-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Distance</p>
							<p class="mt-2 text-2xl font-bold text-[#1F41BB]">
								{formatDistance(state.profile.stats.totalDistance)}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Duration</p>
							<p class="mt-2 text-2xl font-bold text-[#0ABFBC]">
								{formatDuration(state.profile.stats.totalDuration)}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Swims</p>
							<p class="mt-2 text-2xl font-bold text-[#0D1B4B]">
								{state.profile.stats.totalSwims}
							</p>
						</div>
						<div class="rounded-2xl bg-white p-5 shadow-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-400">Battles</p>
							<p class="mt-2 text-2xl font-bold text-[#FF6B6B]">
								{state.profile.stats.battleCount}
							</p>
						</div>
					</div>

					<!-- Battle record -->
					<div class="rounded-2xl bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
							Battle Record
						</h3>
						<div class="grid grid-cols-3 gap-4">
							<div class="rounded-xl bg-green-50 p-4 text-center">
								<p class="text-xs font-medium text-green-600">Won</p>
								<p class="mt-1 text-2xl font-bold text-[#2ECC71]">
									{state.profile.stats.battlesWon}
								</p>
							</div>
							<div class="rounded-xl bg-red-50 p-4 text-center">
								<p class="text-xs font-medium text-red-500">Lost</p>
								<p class="mt-1 text-2xl font-bold text-[#FF6B6B]">
									{state.profile.stats.battlesLost}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] p-4 text-center">
								<p class="text-xs font-medium text-gray-500">Win Rate</p>
								<p class="mt-1 text-2xl font-bold text-[#1F41BB]">
									{state.profile.stats.winRate}%
								</p>
							</div>
						</div>
					</div>

					<!-- Personal bests -->
					<div class="rounded-2xl bg-white p-6 shadow-sm">
						<h3 class="mb-4 text-xs font-bold uppercase tracking-wide text-gray-400">
							Personal Bests
						</h3>
						<div class="grid grid-cols-2 gap-4">
							<div class="rounded-xl bg-[#F0F4FF] p-4">
								<p class="text-xs font-medium text-gray-500">Best Single Distance</p>
								<p class="mt-1 text-xl font-bold text-[#1F41BB]">
									{state.profile.stats.personalBestDistance > 0
										? formatDistance(state.profile.stats.personalBestDistance)
										: '—'}
								</p>
							</div>
							<div class="rounded-xl bg-[#F0F4FF] p-4">
								<p class="text-xs font-medium text-gray-500">Best Pace</p>
								<p class="mt-1 text-xl font-bold text-[#0ABFBC]">
									{formatPace(state.profile.stats.personalBestPace)}
								</p>
							</div>
						</div>
					</div>

					<!-- Edit form -->
					<div class="rounded-2xl bg-white p-6 shadow-sm">
						<h3 class="mb-5 text-lg font-bold text-[#0D1B4B]">Edit Profile</h3>
						<div class="space-y-4">
							<div>
								<label for="edit-username" class="block text-sm font-medium text-gray-700"
									>Username</label
								>
								<input
									id="edit-username"
									type="text"
									bind:value={state.editUsername}
									class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
								/>
							</div>
							<div>
								<label for="edit-skill" class="block text-sm font-medium text-gray-700"
									>Skill Level</label
								>
								<select
									id="edit-skill"
									bind:value={state.editSkillLevel}
									class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
								>
									{#each skillLevels as level}
										<option value={level}
											>{level.charAt(0).toUpperCase() + level.slice(1)}</option
										>
									{/each}
								</select>
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
		{/if}
	</div>
</div>
