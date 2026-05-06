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

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
	<div class="w-full max-w-md rounded-lg bg-white p-8 shadow-2xl">
		<h1 class="mb-6 text-center text-3xl font-bold text-gray-800">Tidemark</h1>
		<p class="mb-8 text-center text-gray-600">Swim Battle Rankings</p>

		<div class="mb-6 flex border-b-2 border-gray-200">
			<button
				onclick={() => switchTab('login')}
				class={`flex-1 py-2 text-center font-semibold transition ${
					state.activeTab === 'login'
						? 'border-b-2 border-[#1F41BB] text-[#1F41BB]'
						: 'text-gray-600 hover:text-gray-800'
				}`}
			>
				Login
			</button>
			<button
				onclick={() => switchTab('register')}
				class={`flex-1 py-2 text-center font-semibold transition ${
					state.activeTab === 'register'
						? 'border-b-2 border-[#1F41BB] text-[#1F41BB]'
						: 'text-gray-600 hover:text-gray-800'
				}`}
			>
				Register
			</button>
		</div>

		{#if state.errorMessage}
			<div class="mb-4 rounded bg-red-100 p-3 text-red-700">{state.errorMessage}</div>
		{/if}

		{#if state.successMessage}
			<div class="mb-4 rounded bg-green-100 p-3 text-green-700">{state.successMessage}</div>
		{/if}

		{#if state.activeTab === 'login'}
			<div class="space-y-4">
				<div>
					<label for="login-email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						id="login-email"
						type="email"
						bind:value={state.loginEmail}
						placeholder="Enter your email"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<div>
					<label for="login-password" class="block text-sm font-medium text-gray-700"
						>Password</label
					>
					<input
						id="login-password"
						type="password"
						bind:value={state.loginPassword}
						placeholder="Enter your password"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<button
					onclick={handleLogin}
					disabled={state.loading}
					class="w-full rounded bg-[#1F41BB] py-2 font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-400"
				>
					{state.loading ? 'Logging in...' : 'Login'}
				</button>
			</div>
		{:else}
			<div class="space-y-4">
				<div>
					<label for="reg-username" class="block text-sm font-medium text-gray-700"
						>Username</label
					>
					<input
						id="reg-username"
						type="text"
						bind:value={state.registerUsername}
						placeholder="Choose a username"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<div>
					<label for="reg-email" class="block text-sm font-medium text-gray-700">Email</label>
					<input
						id="reg-email"
						type="email"
						bind:value={state.registerEmail}
						placeholder="Enter your email"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<div>
					<label for="reg-password" class="block text-sm font-medium text-gray-700">Password</label>
					<input
						id="reg-password"
						type="password"
						bind:value={state.registerPassword}
						placeholder="Enter your password (min. 6 characters)"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<div>
					<label for="reg-confirm-password" class="block text-sm font-medium text-gray-700"
						>Confirm Password</label
					>
					<input
						id="reg-confirm-password"
						type="password"
						bind:value={state.registerConfirmPassword}
						placeholder="Confirm your password"
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
					/>
				</div>
				<div>
					<label for="reg-skill-level" class="block text-sm font-medium text-gray-700"
						>Skill Level</label
					>
					<select
						id="reg-skill-level"
						bind:value={state.registerSkillLevel}
						class="mt-1 w-full rounded border border-gray-300 px-4 py-2 focus:border-[#1F41BB] focus:outline-none"
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
					class="w-full rounded bg-[#1F41BB] py-2 font-semibold text-white transition hover:bg-[#1a38a8] disabled:bg-gray-400"
				>
					{state.loading ? 'Registering...' : 'Register'}
				</button>
			</div>
		{/if}
	</div>
</div>
