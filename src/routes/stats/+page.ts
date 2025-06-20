import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getUserStudySessions, getUserChapters, getChapterSubtopics } from '$lib/firebase/firestore';
import type { PageLoad } from './$types';
import type { User } from 'firebase/auth';

function waitForAuthUser(): Promise<User | null> {
	return new Promise((resolve) => {
		if (!browser) {
			resolve(null);
			return;
		}

		const auth = getAuth();

		// If user is already available, resolve immediately
		if (auth.currentUser) {
			resolve(auth.currentUser);
			return;
		}

		// Wait for auth state to be determined
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			unsubscribe();
			resolve(user);
		});
	});
}

export const load: PageLoad = async () => {
	if (!browser) {
		return {
			studySessions: [],
			subtopics: []
		};
	}

	const user = await waitForAuthUser();

	if (!user) {
		throw redirect(302, '/login');
	}

	try {
		const [sessions, chapters] = await Promise.all([
			getUserStudySessions(user.uid, 100),
			getUserChapters(user.uid)
		]);

		let allSubtopics = [];
		for (const chapter of chapters) {
			const subtopics = await getChapterSubtopics(chapter.id);
			allSubtopics.push(...subtopics);
		}

		return {
			studySessions: sessions,
			subtopics: allSubtopics
		};
	} catch (error) {
		console.error('Error loading stats data:', error);
		return {
			studySessions: [],
			subtopics: []
		};
	}
};
