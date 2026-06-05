import { writable } from 'svelte/store';

export const pendingInviteCount = writable<number>(0);
