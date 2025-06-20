import { writable, type Writable } from 'svelte/store';
import { onAuthStateChange } from '$lib/firebase/firebase';
import type { User } from 'firebase/auth';
import { browser } from '$app/environment';

export const user: Writable<User | null> = writable(null);
export const authLoading: Writable<boolean> = writable(true);

if (browser) {
	onAuthStateChange((firebaseUser) => {
		user.set(firebaseUser);
		authLoading.set(false);
	});
}
