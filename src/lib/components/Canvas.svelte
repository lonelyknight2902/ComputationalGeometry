<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application } from 'pixi.js';
  import { Renderer } from '$lib/renderer/Renderer';
  import type { Point, AlgorithmState } from '$lib/types';
  import ControlBar from './ControlBar.svelte';
  import PointSetPanel from './PointSetPanel.svelte';
  import { chansConvexHull } from '$lib/algorithms/convex-hull/chansConvexHull';
  import { grahamScanVisualizer } from '$lib/algorithms/convex-hull/grahamScan';
  import {
    DEFAULT_POINT_SET_ID,
    createUserPointSet,
    deletePointSet,
    getPointSet,
    listPointSets,
    type PointSet
  } from '$lib/data/pointSets';
  import {
    applyCanvasPointEdit,
    EMPTY_POINTS_JSON,
    generateRegularPolygonPoints,
    nextGeneratedSetNumber,
    serializePointsForEditor,
    validatePointSetDraft
  } from '$lib/data/pointSetEditing';

  let canvasElement: HTMLCanvasElement;
  let canvasContainer: HTMLDivElement;
  let app: Application;
  let renderer: Renderer;
  let resizeObserver: ResizeObserver;
  let algorithmStates: AlgorithmState[] = [];
  let currentStep = 0;
  let ready = false;

  const algorithms = [
    { id: 'chan',    label: "Chan's Convex Hull", run: (pts: Point[]) => chansConvexHull(pts, useBinarySearch, skipSearchVisuals) },
    { id: 'graham', label: 'Graham Scan',         run: grahamScanVisualizer },
  ] as const;

  type AlgoId = typeof algorithms[number]['id'];
  let selectedAlgo: AlgoId = 'chan';
  let availablePointSets: PointSet[] = listPointSets();
  let selectedPointSetId = DEFAULT_POINT_SET_ID;
  let useBinarySearch = true;
  let skipSearchVisuals = true;
  let pointPanelCollapsed = false;
  let editMode = false;

  let editSetId = '';
  let editSetLabel = '';
  let newSetPointsJson = EMPTY_POINTS_JSON;
  let pointSetError = '';
  let pointSetStatus = '';
  let editDraftValid: boolean | null = null;
  const POINT_HIT_PADDING = 2;

  $: selectedPointSet = availablePointSets.find((set) => set.id === selectedPointSetId) ?? availablePointSets[0];

  function refreshPointSets() {
    availablePointSets = listPointSets();
  }

  function syncEditorFromSelectedSet(includePoints: boolean = true) {
    const pointSet = getPointSet(selectedPointSetId);
    editSetId = pointSet.id;
    editSetLabel = pointSet.label;
    if (includePoints) {
      newSetPointsJson = serializePointsForEditor(pointSet);
    }
  }

  function runAlgorithm() {
    const algo = algorithms.find(a => a.id === selectedAlgo)!;
    const pointSet = getPointSet(selectedPointSetId);
    algorithmStates = algo.run(pointSet.points);
    currentStep = 0;
    if (ready) renderer.render(algorithmStates[0]);
  }

  function getCanvasPosition(event: PointerEvent): { x: number; y: number } | null {
    if (!app) return null;
    const rect = canvasElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = ((event.clientX - rect.left) / rect.width) * app.screen.width;
    const y = ((event.clientY - rect.top) / rect.height) * app.screen.height;

    if (x < 0 || y < 0 || x > app.screen.width || y > app.screen.height) return null;
    return { x, y };
  }

  function saveCurrentSetPoints(rawPoints: Array<{ x: number; y: number }>, status: string) {
    if (!selectedPointSet || selectedPointSet.readonly) return;

    const saved = createUserPointSet({
      id: selectedPointSet.id,
      label: selectedPointSet.label,
      rawPoints
    });

    refreshPointSets();
    selectedPointSetId = saved.id;
    syncEditorFromSelectedSet();
    pointSetError = '';
    editDraftValid = true;
    pointSetStatus = status;
    runAlgorithm();
  }

  function persistEditorDraft(showStatus: boolean = false): boolean {
    if (!selectedPointSet || selectedPointSet.readonly) return false;

    const previousId = selectedPointSet.id;
    const draftValidation = validatePointSetDraft({
      previousId,
      editSetId,
      editSetLabel,
      pointsJson: newSetPointsJson,
      availablePointSets
    });
    if (!draftValidation.valid) {
      pointSetError = draftValidation.error;
      pointSetStatus = '';
      editDraftValid = false;
      return false;
    }

    try {
      const created = createUserPointSet({
        id: draftValidation.id,
        label: draftValidation.label,
        rawPoints: draftValidation.rawPoints
      });
      if (previousId !== draftValidation.id) {
        deletePointSet(previousId);
      }
      refreshPointSets();
      selectedPointSetId = created.id;
      pointSetError = '';
      pointSetStatus = showStatus ? `Updated "${created.label}".` : '';
      editDraftValid = true;
      runAlgorithm();
      return true;
    } catch (error) {
      pointSetError = error instanceof Error ? error.message : 'Failed to update point set.';
      pointSetStatus = '';
      editDraftValid = false;
      return false;
    }
  }

  function handleCanvasContextMenu(event: MouseEvent) {
    if (editMode) event.preventDefault();
  }

  function handleCanvasPointerDown(event: PointerEvent) {
    if (!editMode || !selectedPointSet || selectedPointSet.readonly) return;
    if (event.button !== 0 && event.button !== 2) return;

    const click = getCanvasPosition(event);
    if (!click) return;

    event.preventDefault();

    const currentPoints = getPointSet(selectedPointSetId).points;

    const result = applyCanvasPointEdit({
      button: event.button,
      click,
      currentPoints,
      hitPadding: POINT_HIT_PADDING
    });
    if (!result.changed) return;

    saveCurrentSetPoints(result.rawPoints, result.status);
  }

  onMount(async () => {
    refreshPointSets();
    if (!availablePointSets.some((set) => set.id === selectedPointSetId)) {
      selectedPointSetId = availablePointSets[0]?.id ?? DEFAULT_POINT_SET_ID;
    }
    syncEditorFromSelectedSet(true);

    app = new Application();
    await app.init({ view: canvasElement, backgroundColor: 0x111827 });
    app.renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    resizeObserver = new ResizeObserver(() => {
      app.renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    });
    resizeObserver.observe(canvasContainer);
    renderer = new Renderer(app);
    canvasElement.addEventListener('pointerdown', handleCanvasPointerDown);
    canvasElement.addEventListener('contextmenu', handleCanvasContextMenu);
    ready = true;
    runAlgorithm();
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    canvasElement?.removeEventListener('pointerdown', handleCanvasPointerDown);
    canvasElement?.removeEventListener('contextmenu', handleCanvasContextMenu);
  });

  function handleStepChange(e: CustomEvent<number>) {
    currentStep = e.detail;
    renderer.render(algorithmStates[currentStep]);
  }

  function handleAlgoChange() {
    runAlgorithm();
  }

  function handleSettingChange() {
    runAlgorithm();
  }

  function handlePointSetChange() {
    pointSetError = '';
    pointSetStatus = '';
    editMode = false;
    editDraftValid = null;
    syncEditorFromSelectedSet(true);
    runAlgorithm();
  }

  function handleCreateBlankPointSet() {
    pointSetError = '';
    pointSetStatus = '';

    const nextSetNumber = nextGeneratedSetNumber(availablePointSets);
    const generatedId = `set-${nextSetNumber}`;
    const generatedLabel = `Custom set ${nextSetNumber}`;
    const generatedPoints = generateRegularPolygonPoints(nextSetNumber);

    try {
      const created = createUserPointSet({
        id: generatedId,
        label: generatedLabel,
        rawPoints: generatedPoints
      });
      refreshPointSets();
      selectedPointSetId = created.id;
      editMode = false;
      editDraftValid = null;
      syncEditorFromSelectedSet(true);
      pointSetStatus = `Created "${created.label}".`;
      runAlgorithm();
    } catch (error) {
      pointSetError = error instanceof Error ? error.message : 'Failed to create point set.';
    }
  }

  function handleToggleEditMode() {
    pointSetError = '';
    pointSetStatus = '';

    if (!selectedPointSet) return;
    if (selectedPointSet.readonly) {
      pointSetError = 'Default set is read-only. Create a new set to edit.';
      editDraftValid = null;
      return;
    }

    editMode = !editMode;
    if (!editMode) {
      syncEditorFromSelectedSet(true);
      editDraftValid = null;
    } else {
      syncEditorFromSelectedSet(true);
      editDraftValid = true;
    }
    runAlgorithm();
  }

  function handleEditorInput() {
    if (!editMode || !selectedPointSet || selectedPointSet.readonly) return;
    persistEditorDraft();
  }

  function handleDeletePointSet() {
    pointSetError = '';
    pointSetStatus = '';

    const target = selectedPointSet;
    if (!target || target.readonly) return;

    const deleted = deletePointSet(target.id);
    if (!deleted) {
      pointSetError = 'Could not delete this point set.';
      return;
    }

    refreshPointSets();
    selectedPointSetId = availablePointSets[availablePointSets.length - 1]?.id ?? DEFAULT_POINT_SET_ID;
    editMode = false;
    editDraftValid = null;
    syncEditorFromSelectedSet(true);
    pointSetStatus = `Deleted "${target.label}".`;
    runAlgorithm();
  }
</script>

<div class="relative flex h-screen w-screen overflow-hidden bg-gray-950">
  <!-- Sidebar -->
  <div class="flex-none flex flex-col h-full w-72">

    <!-- Algorithm selector -->
    <div class="p-3 bg-gray-900 border-b border-gray-800 flex-none">
      <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
        Algorithm
      </label>
      <select
        bind:value={selectedAlgo}
        on:change={handleAlgoChange}
        class="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2
               border border-gray-700 hover:border-gray-500 focus:border-blue-500
               focus:outline-none transition-colors cursor-pointer"
      >
        {#each algorithms as algo}
          <option value={algo.id}>{algo.label}</option>
        {/each}
      </select>
    </div>

    {#if selectedAlgo === 'chan'}
      <div class="p-3 bg-gray-900 border-b border-gray-800 flex-none space-y-2 text-gray-300">
        <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
          Options
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            bind:checked={useBinarySearch}
            on:change={handleSettingChange}
            class="w-4 h-4 accent-blue-500 cursor-pointer rounded border-gray-700 bg-gray-800"
          />
          Use Binary Search
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer hover:text-white transition-colors">
          <input
            type="checkbox"
            bind:checked={skipSearchVisuals}
            on:change={handleSettingChange}
            class="w-4 h-4 accent-blue-500 cursor-pointer rounded border-gray-700 bg-gray-800"
          />
          Skip Search Visuals
        </label>
      </div>
    {/if}

    <!-- Control bar fills remaining height -->
    <div class="flex-1 min-h-0">
      <ControlBar
        states={algorithmStates}
        bind:currentStep={currentStep}
        disabled={editMode}
        on:stepChange={handleStepChange}
      />
    </div>
  </div>

  <!-- Canvas -->
  <div class="flex-1" bind:this={canvasContainer}>
    <canvas bind:this={canvasElement} class="h-full w-full cursor-crosshair"></canvas>
  </div>

  <PointSetPanel
    bind:collapsed={pointPanelCollapsed}
    {availablePointSets}
    bind:selectedPointSetId
    {selectedPointSet}
    {editMode}
    bind:editSetId
    bind:editSetLabel
    bind:newSetPointsJson
    {editDraftValid}
    {pointSetError}
    {pointSetStatus}
    on:toggleCollapsed={() => (pointPanelCollapsed = !pointPanelCollapsed)}
    on:pointSetChange={handlePointSetChange}
    on:createBlankPointSet={handleCreateBlankPointSet}
    on:toggleEditMode={handleToggleEditMode}
    on:deletePointSet={handleDeletePointSet}
    on:editorInput={handleEditorInput}
  />
</div>
