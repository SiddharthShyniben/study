<script lang="ts">
	import { user, authLoading } from '$lib/stores/auth';
	import { 
		createChapter, 
		createSubtopic, 
		getUserChapters, 
		getChapterSubtopics,
		deleteDocument 
	} from '$lib/firebase/firestore';
	import { 
		collection, 
		query, 
		where, 
		getDocs, 
		writeBatch 
	} from 'firebase/firestore';
	import { db } from '$lib/firebase/firestore';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy, tick } from 'svelte';

	interface SubtopicInput {
		name: string;
		difficulty: number;
		status: 'not_started' | 'learning' | 'reviewing' | 'mastered';
		tags: string;
	}

	interface ChapterInput {
		name: string;
		subtopics: SubtopicInput[];
	}

	interface SubjectInput {
		name: string;
		chapters: ChapterInput[];
	}

	let subjects: SubjectInput[] = [
		{
			name: '',
			chapters: [
				{
					name: '',
					subtopics: [
						{
							name: '',
							difficulty: 3,
							status: 'not_started',
							tags: ''
						}
					]
				}
			]
		}
	];

	let saving = false;
	let loading = true;
	let discarding = false;
	let saveError = '';
	
	// Collapsible state management
	let expandedSubjects: Set<number> = new Set();
	let expandedChapters: Set<string> = new Set();
	let expandedSubtopics: Set<string> = new Set();

	// Current selection for keyboard shortcuts
	let selectedSubjectIndex = 0;
	let selectedChapterIndex = 0;
	let focusedInput: HTMLInputElement | null = null;
	
	// References for auto-focusing new inputs
	let subjectInputRefs: HTMLInputElement[] = [];
	let chapterInputRefs: HTMLInputElement[] = [];
	let subtopicInputRefs: HTMLInputElement[] = [];

	$: if (!$authLoading && !$user) {
		goto('/login');
	}

	const handleKeydown = (event: KeyboardEvent) => {
		if (event.ctrlKey && event.key === 'Enter') {
			event.preventDefault();
			addChapterWithShortcut();
		} else if (event.shiftKey && event.key === 'Enter') {
			event.preventDefault();
			addSubtopicWithShortcut();
		}
	};

	const addChapterWithShortcut = async () => {
		if (selectedSubjectIndex >= 0 && selectedSubjectIndex < subjects.length) {
			addChapter(selectedSubjectIndex);
			expandedSubjects.add(selectedSubjectIndex);
			expandedSubjects = expandedSubjects;
			
			await tick();
			const newIndex = subjects[selectedSubjectIndex].chapters.length - 1;
			const chapterKey = `${selectedSubjectIndex}-${newIndex}`;
			const inputEl = document.querySelector(`[data-chapter-key="${chapterKey}"]`) as HTMLInputElement;
			inputEl?.focus();
		}
	};

	const addSubtopicWithShortcut = async () => {
		if (selectedSubjectIndex >= 0 && selectedSubjectIndex < subjects.length &&
			selectedChapterIndex >= 0 && selectedChapterIndex < subjects[selectedSubjectIndex].chapters.length) {
			addSubtopic(selectedSubjectIndex, selectedChapterIndex);
			expandedSubjects.add(selectedSubjectIndex);
			expandedChapters.add(`${selectedSubjectIndex}-${selectedChapterIndex}`);
			expandedSubjects = expandedSubjects;
			expandedChapters = expandedChapters;
			
			await tick();
			const newIndex = subjects[selectedSubjectIndex].chapters[selectedChapterIndex].subtopics.length - 1;
			const subtopicKey = `${selectedSubjectIndex}-${selectedChapterIndex}-${newIndex}`;
			const inputEl = document.querySelector(`[data-subtopic-key="${subtopicKey}"]`) as HTMLInputElement;
			inputEl?.focus();
		}
	};

	const updateSelection = (subjectIndex: number, chapterIndex: number = 0) => {
		selectedSubjectIndex = subjectIndex;
		selectedChapterIndex = chapterIndex;
	};

	const toggleSubject = (subjectIndex: number) => {
		if (expandedSubjects.has(subjectIndex)) {
			expandedSubjects.delete(subjectIndex);
		} else {
			expandedSubjects.add(subjectIndex);
		}
		expandedSubjects = expandedSubjects;
	};

	const toggleChapter = (subjectIndex: number, chapterIndex: number) => {
		const key = `${subjectIndex}-${chapterIndex}`;
		if (expandedChapters.has(key)) {
			expandedChapters.delete(key);
		} else {
			expandedChapters.add(key);
		}
		expandedChapters = expandedChapters;
	};

	const toggleSubtopic = (subjectIndex: number, chapterIndex: number, subtopicIndex: number) => {
		const key = `${subjectIndex}-${chapterIndex}-${subtopicIndex}`;
		if (expandedSubtopics.has(key)) {
			expandedSubtopics.delete(key);
		} else {
			expandedSubtopics.add(key);
		}
		expandedSubtopics = expandedSubtopics;
	};

	const loadExistingSyllabus = async () => {
		if (!$user) return;

		try {
			loading = true;
			const chapters = await getUserChapters($user.uid);
			
			if (chapters.length === 0) {
				loading = false;
				return;
			}

			const subjectMap = new Map<string, ChapterInput[]>();
			
			for (const chapter of chapters) {
				const subtopics = await getChapterSubtopics(chapter.id);
				
				const chapterInput: ChapterInput = {
					name: chapter.name,
					subtopics: subtopics.map(subtopic => ({
						name: subtopic.name,
						difficulty: subtopic.lastPerformanceRating,
						status: subtopic.status,
						tags: subtopic.tags.join(', ')
					}))
				};

				if (!subjectMap.has(chapter.subject)) {
					subjectMap.set(chapter.subject, []);
				}
				subjectMap.get(chapter.subject)!.push(chapterInput);
			}

			subjects = Array.from(subjectMap.entries()).map(([subjectName, chapters]) => ({
				name: subjectName,
				chapters
			}));

			if (subjects.length === 0) {
				resetForm();
			}
		} catch (error) {
			console.error('Error loading existing syllabus:', error);
			saveError = 'Failed to load existing syllabus';
		} finally {
			loading = false;
		}
	};

	const deleteAllUserData = async (): Promise<void> => {
		if (!$user) return;

		const chaptersQuery = query(
			collection(db, 'chapters'),
			where('userId', '==', $user.uid)
		);

		const subtopicsQuery = query(
			collection(db, 'subtopics'),
			where('userId', '==', $user.uid)
		);

		const [chaptersSnapshot, subtopicsSnapshot] = await Promise.all([
			getDocs(chaptersQuery),
			getDocs(subtopicsQuery)
		]);

		const allDocs = [...chaptersSnapshot.docs, ...subtopicsSnapshot.docs];
		
		for (let i = 0; i < allDocs.length; i += 500) {
			const batch = writeBatch(db);
			const batchDocs = allDocs.slice(i, i + 500);
			
			batchDocs.forEach(doc => {
				batch.delete(doc.ref);
			});
			
			await batch.commit();
		}
	};

	const saveSyllabus = async () => {
		if (!$user) {
			saveError = 'You must be logged in to save syllabus';
			return;
		}

		saveError = '';
		saving = true;

		try {
			await deleteAllUserData();

			for (const subject of subjects) {
				if (!subject.name.trim()) continue;

				for (const chapter of subject.chapters) {
					if (!chapter.name.trim()) continue;

					const chapterId = await createChapter({
						name: chapter.name.trim(),
						subject: subject.name.trim(),
						totalStudyTime: 0,
						userId: $user.uid
					});

					for (const subtopic of chapter.subtopics) {
						if (!subtopic.name.trim()) continue;

						const nextReviewDate = new Date();
						nextReviewDate.setDate(nextReviewDate.getDate() + 1);

						await createSubtopic({
							name: subtopic.name.trim(),
							parentChapterId: chapterId,
							easeFactor: 2.5,
							interval: 1,
							repetitions: 0,
							nextReviewDate: nextReviewDate,
							lastPerformanceRating: subtopic.difficulty,
							tags: subtopic.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
							status: subtopic.status,
							userId: $user.uid
						});
					}
				}
			}

			goto('/');
		} catch (error) {
			console.error('Error saving syllabus:', error);
			saveError = 'Failed to save syllabus. Please try again.';
		} finally {
			saving = false;
		}
	};

	const discardChanges = async () => {
		if (!$user) return;

		discarding = true;
		saveError = '';
		
		try {
			await loadExistingSyllabus();
		} catch (error) {
			console.error('Error discarding changes:', error);
			saveError = 'Failed to reload syllabus';
		} finally {
			discarding = false;
		}
	};

	const addSubject = async () => {
		subjects = [
			...subjects,
			{
				name: '',
				chapters: [
					{
						name: '',
						subtopics: [
							{
								name: '',
								difficulty: 3,
								status: 'not_started',
								tags: ''
							}
						]
					}
				]
			}
		];
		
		await tick();
		const newIndex = subjects.length - 1;
		const inputEl = document.querySelector(`[data-subject-index="${newIndex}"]`) as HTMLInputElement;
		inputEl?.focus();
	};

	const removeSubject = (subjectIndex: number) => {
		subjects = subjects.filter((_, i) => i !== subjectIndex);
	};

	const addChapter = async (subjectIndex: number) => {
		subjects[subjectIndex].chapters = [
			...subjects[subjectIndex].chapters,
			{
				name: '',
				subtopics: [
					{
						name: '',
						difficulty: 3,
						status: 'not_started',
						tags: ''
					}
				]
			}
		];
		subjects = subjects;
		
		await tick();
		const newIndex = subjects[subjectIndex].chapters.length - 1;
		const chapterKey = `${subjectIndex}-${newIndex}`;
		const inputEl = document.querySelector(`[data-chapter-key="${chapterKey}"]`) as HTMLInputElement;
		inputEl?.focus();
	};

	const removeChapter = (subjectIndex: number, chapterIndex: number) => {
		subjects[subjectIndex].chapters = subjects[subjectIndex].chapters.filter((_, i) => i !== chapterIndex);
		subjects = subjects;
	};

	const addSubtopic = async (subjectIndex: number, chapterIndex: number) => {
		subjects[subjectIndex].chapters[chapterIndex].subtopics = [
			...subjects[subjectIndex].chapters[chapterIndex].subtopics,
			{
				name: '',
				difficulty: 3,
				status: 'not_started',
				tags: ''
			}
		];
		subjects = subjects;
		
		await tick();
		const newIndex = subjects[subjectIndex].chapters[chapterIndex].subtopics.length - 1;
		const subtopicKey = `${subjectIndex}-${chapterIndex}-${newIndex}`;
		const inputEl = document.querySelector(`[data-subtopic-key="${subtopicKey}"]`) as HTMLInputElement;
		inputEl?.focus();
	};

	const removeSubtopic = (subjectIndex: number, chapterIndex: number, subtopicIndex: number) => {
		subjects[subjectIndex].chapters[chapterIndex].subtopics = subjects[subjectIndex].chapters[chapterIndex].subtopics.filter((_, i) => i !== subtopicIndex);
		subjects = subjects;
	};

	const resetForm = () => {
		subjects = [
			{
				name: '',
				chapters: [
					{
						name: '',
						subtopics: [
							{
								name: '',
								difficulty: 3,
								status: 'not_started',
								tags: ''
							}
						]
					}
				]
			}
		];
		saveError = '';
	};

	const isFormValid = () => {
		return subjects.some(subject => 
			subject.name.trim() && 
			subject.chapters.some(chapter => 
				chapter.name.trim() && 
				chapter.subtopics.some(subtopic => subtopic.name.trim())
			)
		);
	};

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		
		if ($user && !$authLoading) {
			loadExistingSyllabus();
		}
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
	});

	$: if (!$authLoading && $user && loading) {
		loadExistingSyllabus();
	}
</script>

<svelte:head>
	<title>Syllabus</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	{#if $authLoading || loading}
		<div class="flex items-center justify-center min-h-screen">
			<div class="text-center">
				<svg class="animate-spin h-12 w-12 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				<p class="mt-4 text-gray-600">{$authLoading ? 'Loading...' : 'Loading syllabus...'}</p>
			</div>
		</div>
	{:else if $user}
		<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
			<div class="text-center mb-8">
				<h1 class="text-3xl font-extrabold text-gray-900">Syllabus</h1>
				<p class="mt-2 text-gray-600">Organize your study topics</p>
				<p class="mt-1 text-xs text-gray-500">Ctrl+Enter: Add chapter • Shift+Enter: Add subtopic</p>
			</div>

			{#if saveError}
				<div class="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
					{saveError}
				</div>
			{/if}

			<div class="bg-white shadow rounded-lg p-6">
				{#each subjects as subject, subjectIndex}
					<div class="border-l-4 border-indigo-200 pl-4 mb-6">
						<div class="flex items-center space-x-2 mb-3">
							<button
								type="button"
								on:click={() => toggleSubject(subjectIndex)}
								class="flex items-center justify-center w-5 h-5 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
							>
								<svg class="w-3 h-3 transform transition-transform {expandedSubjects.has(subjectIndex) ? 'rotate-0' : '-rotate-90'}" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
								</svg>
							</button>
							<input
								type="text"
								bind:value={subject.name}
								data-subject-index={subjectIndex}
								disabled={saving || discarding}
								placeholder="Subject name"
								on:focus={() => updateSelection(subjectIndex)}
								class="flex-1 px-2 py-1 text-lg font-medium border-0 border-b border-gray-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:bg-gray-100"
							/>
							{#if subjects.length > 1}
								<button
									type="button"
									on:click={() => removeSubject(subjectIndex)}
									disabled={saving || discarding}
									class="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
								>
									×
								</button>
							{/if}
						</div>

						{#if expandedSubjects.has(subjectIndex)}
							<div class="ml-6 space-y-3">
								{#each subject.chapters as chapter, chapterIndex}
									<div class="border-l-2 border-gray-200 pl-3">
										<div class="flex items-center space-x-2 mb-2">
											<button
												type="button"
												on:click={() => toggleChapter(subjectIndex, chapterIndex)}
												class="flex items-center justify-center w-4 h-4 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
											>
												<svg class="w-2.5 h-2.5 transform transition-transform {expandedChapters.has(`${subjectIndex}-${chapterIndex}`) ? 'rotate-0' : '-rotate-90'}" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
												</svg>
											</button>
											<input
												type="text"
												bind:value={chapter.name}
												data-chapter-key="{subjectIndex}-{chapterIndex}"
												disabled={saving || discarding}
												placeholder="Chapter name"
												on:focus={() => updateSelection(subjectIndex, chapterIndex)}
												class="flex-1 px-2 py-1 border-0 border-b border-gray-200 focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:bg-gray-100"
											/>
											{#if subject.chapters.length > 1}
												<button
													type="button"
													on:click={() => removeChapter(subjectIndex, chapterIndex)}
													disabled={saving || discarding}
													class="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
												>
													×
												</button>
											{/if}
										</div>

										{#if expandedChapters.has(`${subjectIndex}-${chapterIndex}`)}
											<div class="ml-5 space-y-2">
												{#each chapter.subtopics as subtopic, subtopicIndex}
													<div class="flex items-center space-x-2 py-1">
														<button
															type="button"
															on:click={() => toggleSubtopic(subjectIndex, chapterIndex, subtopicIndex)}
															class="flex items-center justify-center w-3 h-3 rounded border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
														>
															<svg class="w-2 h-2 transform transition-transform {expandedSubtopics.has(`${subjectIndex}-${chapterIndex}-${subtopicIndex}`) ? 'rotate-0' : '-rotate-90'}" fill="currentColor" viewBox="0 0 20 20">
																<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
															</svg>
														</button>
														<input
															type="text"
															bind:value={subtopic.name}
															data-subtopic-key="{subjectIndex}-{chapterIndex}-{subtopicIndex}"
															disabled={saving || discarding}
															placeholder="Subtopic name"
															on:focus={() => updateSelection(subjectIndex, chapterIndex)}
															class="flex-1 px-2 py-1 text-sm border-0 border-b border-gray-100 focus:border-indigo-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-100"
														/>
														{#if expandedSubtopics.has(`${subjectIndex}-${chapterIndex}-${subtopicIndex}`)}
															<select
																bind:value={subtopic.difficulty}
																disabled={saving || discarding}
																class="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
															>
																<option value={1}>1</option>
																<option value={2}>2</option>
																<option value={3}>3</option>
																<option value={4}>4</option>
																<option value={5}>5</option>
															</select>
															<select
																bind:value={subtopic.status}
																disabled={saving || discarding}
																class="px-1 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
															>
																<option value="not_started">New</option>
																<option value="learning">Learning</option>
																<option value="reviewing">Reviewing</option>
																<option value="mastered">Mastered</option>
															</select>
														{/if}
														{#if chapter.subtopics.length > 1}
															<button
																type="button"
																on:click={() => removeSubtopic(subjectIndex, chapterIndex, subtopicIndex)}
																disabled={saving || discarding}
																class="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
															>
																×
															</button>
														{/if}
													</div>
												{/each}

												<button
													type="button"
													on:click={() => addSubtopic(subjectIndex, chapterIndex)}
													disabled={saving || discarding}
													class="w-full py-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
												>
													+ subtopic
												</button>
											</div>
										{/if}
									</div>
								{/each}

								<button
									type="button"
									on:click={() => addChapter(subjectIndex)}
									disabled={saving || discarding}
									class="w-full py-1 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
								>
									+ chapter
								</button>
							</div>
						{/if}
					</div>
				{/each}

				<button
					type="button"
					on:click={addSubject}
					disabled={saving || discarding}
					class="w-full py-2 text-gray-700 hover:text-gray-900 font-medium disabled:opacity-50"
				>
					+ subject
				</button>

				<div class="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-gray-200">
					<button
						type="button"
						on:click={saveSyllabus}
						disabled={saving || discarding || !isFormValid()}
						class="flex-1 bg-indigo-600 text-white py-2 px-4 rounded font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>

					<button
						type="button"
						on:click={discardChanges}
						disabled={saving || discarding}
						class="bg-yellow-100 text-yellow-800 py-2 px-4 rounded font-medium hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50"
					>
						{discarding ? 'Discarding...' : 'Discard'}
					</button>

					<button
						type="button"
						on:click={resetForm}
						disabled={saving || discarding}
						class="bg-gray-200 text-gray-800 py-2 px-4 rounded font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
					>
						Reset
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
