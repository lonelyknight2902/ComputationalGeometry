<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { AlgorithmState } from '$lib/types';

  export let states: AlgorithmState[] = [];
  export let currentStep = 0; // Export for control bar
  export let disabled = false;

  const dispatch = createEventDispatcher();

  // Automatically pause if a new algorithm/setting is loaded
  $: if (states) {
    pause();
  }
  let playing = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let speed = 500;

  $: currentState = states[currentStep];
  $: progress = states.length > 1 ? (currentStep / (states.length - 1)) * 100 : 0;
  $: atStart = currentStep === 0;
  $: atEnd = currentStep === states.length - 1;
  $: if (disabled) {
    pause();
  }

  function clearTimer() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function play() {
    if (playing || atEnd) return;
    playing = true;
    intervalId = setInterval(() => {
      if (currentStep < states.length - 1) {
        currentStep += 1;
        dispatch('stepChange', currentStep);
      } else {
        pause();
      }
    }, speed);
  }

  function pause() {
    playing = false;
    clearTimer();
  }

  function togglePlay() {
    playing ? pause() : play();
  }

  function nextStep() {
    if (atEnd) return;
    pause();
    currentStep += 1;
    dispatch('stepChange', currentStep);
  }

  function prevStep() {
    if (atStart) return;
    pause();
    currentStep -= 1;
    dispatch('stepChange', currentStep);
  }

  function reset() {
    pause();
    currentStep = 0;
    dispatch('stepChange', currentStep);
  }

  function goToEnd() {
    pause();
    currentStep = states.length - 1;
    dispatch('stepChange', currentStep);
  }

  function onScrub(e: Event) {
    pause();
    currentStep = Number((e.target as HTMLInputElement).value);
    dispatch('stepChange', currentStep);
  }

  function onSpeedChange() {
    if (playing) { clearTimer(); play(); }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (disabled) return;
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target instanceof HTMLElement && e.target.isContentEditable)
    ) {
      return;
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); nextStep(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prevStep(); }
    else if (e.key === ' ')    { e.preventDefault(); togglePlay(); }
    else if (e.key === 'r')    reset();
  }

  onDestroy(clearTimer);
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="w-72 h-full p-4 bg-gray-900 text-gray-100 flex flex-col gap-4 shadow-xl select-none">

  <!-- Description panel — grows to fill remaining height, scrolls if content overflows -->
  <div class="bg-gray-800 rounded-lg p-3 overflow-y-auto flex-1">
    {#if currentState}
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold uppercase tracking-widest text-gray-500">Info</span>
        <span class="text-xs font-mono text-blue-400">{currentStep + 1} / {states.length}</span>
      </div>
      <!-- {@html} is safe here: description is authored by our own algorithm code -->
      <div class="description-body">
        {@html currentState.description}
      </div>
    {:else}
      <p class="text-sm text-gray-500 italic">No states — add points and run.</p>
    {/if}
  </div>

  <!-- Progress scrubber -->
  <div class="flex flex-col gap-1">
    <div class="relative w-full h-1 bg-gray-700 rounded-full">
      <div
        class="absolute h-full bg-blue-500 rounded-full transition-all"
        style="width: {progress}%"
      />
    </div>
    <input
      type="range"
      min="0"
      max={Math.max(states.length - 1, 0)}
      value={currentStep}
      on:input={onScrub}
      disabled={states.length === 0 || disabled}
      class="w-full accent-blue-500 cursor-pointer disabled:opacity-40"
    />
  </div>

  <!-- Playback controls -->
  <div class="flex items-center justify-between gap-1">
    <button
      class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
      on:click={reset}
      disabled={atStart || states.length === 0 || disabled}
      title="Reset (R)"
    >⏮</button>

    <button
      class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
      on:click={prevStep}
      disabled={atStart || states.length === 0 || disabled}
      title="Previous (←)"
    >◀</button>

    <button
      class="w-12 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-bold"
      on:click={togglePlay}
      disabled={states.length === 0 || atEnd || disabled}
      title={playing ? 'Pause (Space)' : 'Play (Space)'}
    >{playing ? '⏸' : '▶'}</button>

    <button
      class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
      on:click={nextStep}
      disabled={atEnd || states.length === 0 || disabled}
      title="Next (→)"
    >▶|</button>

    <button
      class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
      on:click={goToEnd}
      disabled={atEnd || states.length === 0 || disabled}
      title="Jump to end"
    >⏭</button>
  </div>

  <!-- Speed control -->
  <div class="flex flex-col gap-1">
    <div class="flex justify-between text-xs text-gray-400">
      <span>Speed</span>
      <span class="font-mono">{speed}ms / step</span>
    </div>
    <input
      type="range" min="100" max="2000" step="100"
      bind:value={speed}
      on:change={onSpeedChange}
      disabled={disabled}
      class="w-full accent-blue-500"
    />
    <div class="flex justify-between text-xs text-gray-600">
      <span>Fast</span><span>Slow</span>
    </div>
  </div>

  <!-- Keyboard hints -->
  <div class="flex gap-3 text-gray-600 text-xs justify-center">
    <span>← → navigate</span>
    <span>Space play/pause</span>
    <span>R reset</span>
  </div>
</div>

<!-- Scoped styles for the HTML injected by the algorithm -->
<style>
  .description-body :global(code) {
    background: #1e293b;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .description-body :global(ol),
  .description-body :global(ul) {
    margin: 0;
    padding-left: 1.2em;
    line-height: 1.8;
  }

  .description-body :global(strong) {
    color: #f1f5f9;
  }

  .description-body :global(em) {
    color: #94a3b8;
  }
</style>