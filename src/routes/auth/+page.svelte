<script lang="ts">
	import { goto } from '$app/navigation';

	let state = $state({
		activeTab: 'login' as 'login' | 'register',
		loginEmail: '',
		loginPassword: '',
		registerUsername: '',
		registerEmail: '',
		registerPassword: '',
		registerConfirmPassword: '',
		registerSkillLevel: 'beginner',
		loading: false,
		errorMessage: '',
		successMessage: ''
	});

	async function handleLogin() {
		if (!state.loginEmail || !state.loginPassword) {
			state.errorMessage = 'Please fill in all fields';
			return;
		}
		state.loading = true;
		state.errorMessage = '';
		try {
			const response = await fetch('/api/users/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: state.loginEmail, password: state.loginPassword })
			});
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Login failed';
				return;
			}
			localStorage.setItem('userId', data.userId);
			localStorage.setItem('userName', data.userName);
			await goto('/battle');
		} catch (err) {
			state.errorMessage = 'An error occurred. Please try again.';
			console.error(err);
		} finally {
			state.loading = false;
		}
	}

	async function handleRegister() {
		if (
			!state.registerUsername ||
			!state.registerEmail ||
			!state.registerPassword ||
			!state.registerConfirmPassword
		) {
			state.errorMessage = 'Please fill in all fields';
			return;
		}
		if (state.registerPassword !== state.registerConfirmPassword) {
			state.errorMessage = 'Passwords do not match';
			return;
		}
		if (state.registerPassword.length < 6) {
			state.errorMessage = 'Password must be at least 6 characters';
			return;
		}
		state.loading = true;
		state.errorMessage = '';
		try {
			const response = await fetch('/api/users/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username: state.registerUsername,
					email: state.registerEmail,
					password: state.registerPassword,
					skillLevel: state.registerSkillLevel
				})
			});
			const data = await response.json();
			if (!response.ok) {
				state.errorMessage = data.message || 'Registration failed';
				return;
			}
			state.successMessage = 'Registration successful! Please log in.';
			state.activeTab = 'login';
			state.registerUsername = '';
			state.registerEmail = '';
			state.registerPassword = '';
			state.registerConfirmPassword = '';
			state.loginEmail = '';
			state.loginPassword = '';
			setTimeout(() => {
				state.successMessage = '';
			}, 3000);
		} catch (err) {
			state.errorMessage = 'An error occurred. Please try again.';
			console.error(err);
		} finally {
			state.loading = false;
		}
	}

	function switchTab(tab: 'login' | 'register') {
		state.activeTab = tab;
		state.errorMessage = '';
		state.successMessage = '';
	}
</script>

<div class="flex min-h-screen">
	<!-- Left panel: branding (desktop only) -->
	<div
		class="relative hidden overflow-hidden bg-gradient-to-br from-[#0D1B4B] via-[#1F41BB] to-[#0ABFBC] md:flex md:w-1/2 md:flex-col md:items-center md:justify-center"
	>
		<!-- Decorative blobs -->
		<div class="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/5"></div>
		<div class="absolute -right-10 top-1/4 h-48 w-48 rounded-full bg-[#0ABFBC]/20 blur-2xl"></div>
		<div class="absolute bottom-24 left-20 h-40 w-40 rounded-full bg-white/10 blur-xl"></div>
		<div class="absolute right-24 top-16 h-24 w-24 rounded-full bg-[#0ABFBC]/30 blur-lg"></div>

		<!-- Branding content -->
		<div class="relative z-10 px-12 text-center">
			<img src="/logo.png" alt="Tidemark" class="mx-auto h-auto w-72 drop-shadow-xl" />
		</div>

		<!-- Wave decoration at bottom -->
		<div class="absolute bottom-0 left-0 right-0">
			<svg viewBox="0 0 1440 100" xmlns="http://www.w3.org/2000/svg" class="w-full">
				<path
					d="M0,50 C240,90 480,10 720,50 C960,90 1200,10 1440,50 L1440,100 L0,100 Z"
					fill="rgba(255,255,255,0.05)"
				/>
				<path
					d="M0,70 C360,30 720,90 1080,55 C1260,38 1360,75 1440,70 L1440,100 L0,100 Z"
					fill="rgba(255,255,255,0.08)"
				/>
			</svg>
		</div>
	</div>

	<!-- Right panel: form -->
	<div
		class="flex w-full flex-col items-center justify-center bg-[#F0F4FF] px-6 py-12 md:w-1/2"
	>
		<!-- Mobile logo (small screens only) -->
		<div class="mb-8 md:hidden">
			<img src="/logo.png" alt="Tidemark" class="mx-auto h-auto w-48 drop-shadow-lg" />
		</div>

		<div class="w-full max-w-md">
			<!-- Form card -->
			<div class="rounded-2xl bg-white p-8 shadow-xl">
				<!-- Tab switcher -->
				<div class="mb-6 flex rounded-xl bg-[#F0F4FF] p-1">
					<button
						onclick={() => switchTab('login')}
						class={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
							state.activeTab === 'login'
								? 'bg-[#1F41BB] text-white shadow-md'
								: 'text-gray-500 hover:text-gray-700'
						}`}
					>
						Login
					</button>
					<button
						onclick={() => switchTab('register')}
						class={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
							state.activeTab === 'register'
								? 'bg-[#1F41BB] text-white shadow-md'
								: 'text-gray-500 hover:text-gray-700'
						}`}
					>
						Register
					</button>
				</div>

				{#if state.errorMessage}
					<div class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
						{state.errorMessage}
					</div>
				{/if}
				{#if state.successMessage}
					<div class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
						{state.successMessage}
					</div>
				{/if}

				{#if state.activeTab === 'login'}
					<div class="space-y-4">
						<div>
							<label for="login-email" class="block text-sm font-medium text-[#0D1B4B]"
								>Email</label
							>
							<input
								id="login-email"
								type="email"
								bind:value={state.loginEmail}
								placeholder="Enter your email"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="login-password" class="block text-sm font-medium text-[#0D1B4B]"
								>Password</label
							>
							<input
								id="login-password"
								type="password"
								bind:value={state.loginPassword}
								placeholder="Enter your password"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<button
							onclick={handleLogin}
							disabled={state.loading}
							class="mt-2 w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-300"
						>
							{state.loading ? 'Logging in…' : 'Login'}
						</button>
					</div>
				{:else}
					<div class="space-y-4">
						<div>
							<label for="reg-username" class="block text-sm font-medium text-[#0D1B4B]"
								>Username</label
							>
							<input
								id="reg-username"
								type="text"
								bind:value={state.registerUsername}
								placeholder="Choose a username"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="reg-email" class="block text-sm font-medium text-[#0D1B4B]">Email</label>
							<input
								id="reg-email"
								type="email"
								bind:value={state.registerEmail}
								placeholder="Enter your email"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="reg-password" class="block text-sm font-medium text-[#0D1B4B]"
								>Password</label
							>
							<input
								id="reg-password"
								type="password"
								bind:value={state.registerPassword}
								placeholder="Min. 6 characters"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="reg-confirm" class="block text-sm font-medium text-[#0D1B4B]"
								>Confirm Password</label
							>
							<input
								id="reg-confirm"
								type="password"
								bind:value={state.registerConfirmPassword}
								placeholder="Repeat your password"
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							/>
						</div>
						<div>
							<label for="reg-skill" class="block text-sm font-medium text-[#0D1B4B]"
								>Skill Level</label
							>
							<select
								id="reg-skill"
								bind:value={state.registerSkillLevel}
								class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[#1F41BB] focus:outline-none focus:ring-2 focus:ring-[#1F41BB]/20"
							>
								<option value="beginner">Beginner</option>
								<option value="intermediate">Intermediate</option>
								<option value="advanced">Advanced</option>
								<option value="elite">Elite</option>
							</select>
						</div>
						<button
							onclick={handleRegister}
							disabled={state.loading}
							class="mt-2 w-full rounded-xl bg-[#1F41BB] py-3 text-sm font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-300"
						>
							{state.loading ? 'Registering…' : 'Create Account'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
