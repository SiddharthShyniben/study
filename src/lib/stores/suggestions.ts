import { writable } from 'svelte/store';
import { generateSmartSuggestions } from '$lib/ai/suggestionsEngine';

interface SuggestionsState {
	suggestions: string[];
	loading: boolean;
	error: string | null;
	lastUpdated: Date | null;
}

const initialState: SuggestionsState = {
	suggestions: [],
	loading: false,
	error: null,
	lastUpdated: null
};

function createSuggestionsStore() {
	const { subscribe, set, update } = writable<SuggestionsState>(initialState);

	return {
		subscribe,

		async loadSuggestions(userId: string, forceRefresh = false) {
			update(state => ({ ...state, loading: true, error: null }));

			// Check if we have recent suggestions (less than 1 hour old)
			const now = new Date();
			const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

			if (!forceRefresh) {
				// Get current state synchronously
				let currentState: SuggestionsState | null = null;
				const unsubscribe = subscribe(state => {
					currentState = state;
				});
				unsubscribe();

				if (currentState &&
					currentState.lastUpdated &&
					currentState.lastUpdated > oneHourAgo &&
					currentState.suggestions.length > 0) {
					update(state => ({ ...state, loading: false }));
					return;
				}
			}

			try {
				const suggestions = await generateSmartSuggestions(userId);

				update(state => ({
					...state,
					suggestions,
					loading: false,
					error: null,
					lastUpdated: now
				}));
			} catch (error) {
				console.error('Error loading suggestions:', error);

				update(state => ({
					...state,
					suggestions: ["Unable to load suggestions at this time. Please try again later."],
					loading: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					lastUpdated: now
				}));
			}
		},

		refresh(userId: string) {
			return this.loadSuggestions(userId, true);
		},

		clear() {
			set(initialState);
		}
	};
}

export const suggestionsStore = createSuggestionsStore();
