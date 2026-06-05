import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const initial = browser ? localStorage.getItem('darkMode') === 'true' : false;

export const darkMode = writable<boolean>(initial);

if (browser) {
	if (initial) {
		document.documentElement.classList.add('dark');
		document.documentElement.classList.remove('light');
	}

	darkMode.subscribe((isDark) => {
		document.documentElement.classList.toggle('dark', isDark);
		document.documentElement.classList.toggle('light', !isDark);
		localStorage.setItem('darkMode', String(isDark));
	});
}
