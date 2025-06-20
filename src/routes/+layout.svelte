<script>
	import '../app.css';
	import { pwaInfo } from 'virtual:pwa-info';
	import { onMount } from 'svelte';
	import { initializeFCM } from '$lib/firebase/fcm';
	import { logout } from '$lib/firebase/firebase';
	import { user, authLoading } from '$lib/stores/auth';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let fcmInitialized = false;
	let mobileMenuOpen = false;

	const navLinks = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/track', label: 'Study', icon: '📚' },
		{ href: '/stats', label: 'Stats', icon: '📊' },
		{ href: '/suggestions', label: 'Suggestions', icon: '💡' },
		{ href: '/goals', label: 'Goals', icon: '🎯' },
		{ href: '/setup/syllabus', label: 'Setup', icon: '⚙️' }
	];

	const handleLogout = async () => {
		try {
			await logout();
			goto('/login');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	};

	const toggleMobileMenu = () => {
		mobileMenuOpen = !mobileMenuOpen;
	};

	const closeMobileMenu = () => {
		mobileMenuOpen = false;
	};

	$: currentPath = $page.url.pathname;

	onMount(async () => {
		// Initialize PWA service worker
		if (pwaInfo) {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({
				immediate: true,
				onNeedRefresh() {
					console.log('PWA update available');
				},
				onOfflineReady() {
					console.log('PWA ready to work offline');
				}
			});
		}

		// Initialize FCM separately (it will register its own service worker)
		if (!fcmInitialized) {
			fcmInitialized = true;
			await initializeFCM();
		}
	});

	$: webManifest = pwaInfo ? pwaInfo.webManifest.linkTag : '';
</script>

<svelte:head>
	<meta name="theme-color" content="#ffffff" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="apple-mobile-web-app-title" content="SvelteKit PWA" />
	<meta name="description" content="SvelteKit Progressive Web App" />
	<meta name="format-detection" content="telephone=no" />
	<meta name="msapplication-TileColor" content="#ffffff" />
	<meta name="msapplication-tap-highlight" content="no" />
	<link rel="apple-touch-icon" href="/icon-192x192.png" />
	<link rel="mask-icon" href="/favicon.svg" color="#ffffff" />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<!-- Global Navbar -->
<nav class="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex justify-between items-center h-16">
			<!-- Logo/Brand -->
			<div class="flex items-center">
				<a href="/" class="flex items-center space-x-2 text-xl font-bold text-indigo-600">
					<span>📚</span>
					<span class="hidden sm:block">StudyTracker</span>
				</a>
			</div>

			<!-- Desktop Navigation -->
			<div class="hidden md:flex items-center space-x-8">
				{#each navLinks as link}
					<a
						href={link.href}
						class="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 {
							currentPath === link.href || (link.href !== '/' && currentPath.startsWith(link.href))
								? 'text-indigo-600 bg-indigo-50 border-b-2 border-indigo-600'
								: 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
						}"
					>
						<span class="text-base">{link.icon}</span>
						<span>{link.label}</span>
					</a>
				{/each}
			</div>

			<!-- Desktop Auth Actions -->
			<div class="hidden md:flex items-center space-x-4">
				{#if $authLoading}
					<div class="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
				{:else if $user}
					<div class="flex items-center space-x-3">
						<span class="text-sm text-gray-700">Hello, {$user.email?.split('@')[0]}</span>
						<button
							on:click={handleLogout}
							class="bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
						>
							Logout
						</button>
					</div>
				{:else}
					<a
						href="/login"
						class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
					>
						Login
					</a>
				{/if}
			</div>

			<!-- Mobile Menu Button -->
			<div class="md:hidden">
				<button
					on:click={toggleMobileMenu}
					class="text-gray-700 hover:text-indigo-600 focus:outline-none focus:text-indigo-600"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						{#if mobileMenuOpen}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						{/if}
					</svg>
				</button>
			</div>
		</div>

		<!-- Mobile Menu -->
		{#if mobileMenuOpen}
			<div class="md:hidden border-t border-gray-200 py-4">
				<div class="space-y-1">
					{#each navLinks as link}
						<a
							href={link.href}
							on:click={closeMobileMenu}
							class="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 {
								currentPath === link.href || (link.href !== '/' && currentPath.startsWith(link.href))
									? 'text-indigo-600 bg-indigo-50'
									: 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50'
							}"
						>
							<span>{link.icon}</span>
							<span>{link.label}</span>
						</a>
					{/each}
				</div>

				<!-- Mobile Auth Actions -->
				<div class="border-t border-gray-200 pt-4 mt-4">
					{#if $authLoading}
						<div class="px-3 py-2">
							<div class="w-24 h-8 bg-gray-200 rounded animate-pulse"></div>
						</div>
					{:else if $user}
						<div class="px-3 py-2 space-y-2">
							<p class="text-sm text-gray-700">Hello, {$user.email?.split('@')[0]}</p>
							<button
								on:click={() => { handleLogout(); closeMobileMenu(); }}
								class="w-full bg-gray-100 text-gray-700 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors text-left"
							>
								Logout
							</button>
						</div>
					{:else}
						<div class="px-3 py-2">
							<a
								href="/login"
								on:click={closeMobileMenu}
								class="block w-full bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors text-center"
							>
								Login
							</a>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</nav>

<!-- Page Content -->
<main class="min-h-screen bg-gray-50">
	<slot />
</main>

<style>
	:global(html) {
		height: 100%;
	}
	
	:global(body) {
		height: 100%;
		margin: 0;
	}
</style>
