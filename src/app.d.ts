declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'virtual:pwa-register' {
	export function registerSW(options?: {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
	}): void;
}

declare module 'virtual:pwa-info' {
	export const pwaInfo: {
		webManifest: {
			linkTag: string;
		};
	} | undefined;
}

export { };
