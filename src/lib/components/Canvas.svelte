<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Application } from 'pixi.js';
  import { Renderer } from '$lib/renderer/Renderer';
  import type { Point, AlgorithmState } from '$lib/types';
  import ControlBar from './ControlBar.svelte';
  import { chansConvexHull } from '$lib/algorithms/convex-hull/chansConvexHull';
  import { grahamScanVisualizer } from '$lib/algorithms/convex-hull/grahamScan';

  let canvasElement: HTMLCanvasElement;
  let canvasContainer: HTMLDivElement;
  let app: Application;
  let renderer: Renderer;
  let resizeObserver: ResizeObserver;
  let algorithmStates: AlgorithmState[] = [];
  let currentStep = 0;
  let ready = false;

  const algorithms = [
    { id: 'chan',    label: "Chan's Convex Hull", run: chansConvexHull },
    { id: 'graham', label: 'Graham Scan',         run: grahamScanVisualizer },
  ] as const;

  type AlgoId = typeof algorithms[number]['id'];
  let selectedAlgo: AlgoId = 'chan';

  const testPoints: Point[] = [
    // Outer hull vertices (roughly octagonal)
    { id: 'A',  position: { x: 400, y:  60 }, color: 0xffffff, radius: 6 },
    { id: 'B',  position: { x: 620, y: 100 }, color: 0xffffff, radius: 6 },
    { id: 'C',  position: { x: 740, y: 260 }, color: 0xffffff, radius: 6 },
    { id: 'D',  position: { x: 720, y: 440 }, color: 0xffffff, radius: 6 },
    { id: 'E',  position: { x: 560, y: 540 }, color: 0xffffff, radius: 6 },
    { id: 'F',  position: { x: 340, y: 560 }, color: 0xffffff, radius: 6 },
    { id: 'G',  position: { x: 160, y: 460 }, color: 0xffffff, radius: 6 },
    { id: 'H',  position: { x:  80, y: 280 }, color: 0xffffff, radius: 6 },
    { id: 'I',  position: { x: 160, y: 110 }, color: 0xffffff, radius: 6 },

    // Collinear points along the top edge (A→B) — stress-test degenerate case
    { id: 'J',  position: { x: 510, y:  80 }, color: 0xffffff, radius: 6 },

    // Dense interior cluster
    { id: 'K',  position: { x: 380, y: 200 }, color: 0xffffff, radius: 6 },
    { id: 'L',  position: { x: 420, y: 220 }, color: 0xffffff, radius: 6 },
    { id: 'M',  position: { x: 400, y: 260 }, color: 0xffffff, radius: 6 },
    { id: 'N',  position: { x: 360, y: 240 }, color: 0xffffff, radius: 6 },
    { id: 'O',  position: { x: 440, y: 180 }, color: 0xffffff, radius: 6 },

    // Scattered interior points
    { id: 'P',  position: { x: 540, y: 300 }, color: 0xffffff, radius: 6 },
    { id: 'Q',  position: { x: 300, y: 350 }, color: 0xffffff, radius: 6 },
    { id: 'R',  position: { x: 480, y: 420 }, color: 0xffffff, radius: 6 },
    { id: 'S',  position: { x: 240, y: 200 }, color: 0xffffff, radius: 6 },
    { id: 'T',  position: { x: 600, y: 200 }, color: 0xffffff, radius: 6 },
    { id: 'U',  position: { x: 620, y: 380 }, color: 0xffffff, radius: 6 },
    { id: 'V',  position: { x: 200, y: 380 }, color: 0xffffff, radius: 6 },
    { id: 'W',  position: { x: 460, y: 320 }, color: 0xffffff, radius: 6 },
    { id: 'X',  position: { x: 340, y: 440 }, color: 0xffffff, radius: 6 },

    // Near-hull points (just inside the boundary — should be eliminated)
    { id: 'Y',  position: { x: 700, y: 160 }, color: 0xffffff, radius: 6 },
    { id: 'Z',  position: { x: 180, y: 160 }, color: 0xffffff, radius: 6 },
  ];

  function runAlgorithm() {
    const algo = algorithms.find(a => a.id === selectedAlgo)!;
    algorithmStates = algo.run(testPoints);
    currentStep = 0;
    if (ready) renderer.render(algorithmStates[0]);
  }

  onMount(async () => {
    app = new Application();
    await app.init({ view: canvasElement, backgroundColor: 0x111827 });
    app.renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    resizeObserver = new ResizeObserver(() => {
      app.renderer.resize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    });
    resizeObserver.observe(canvasContainer);
    renderer = new Renderer(app);
    ready = true;
    runAlgorithm();
  });

  onDestroy(() => resizeObserver?.disconnect());

  function handleStepChange(e: CustomEvent<number>) {
    currentStep = e.detail;
    renderer.render(algorithmStates[currentStep]);
  }

  function handleAlgoChange() {
    runAlgorithm();
  }
</script>

<div class="flex h-screen w-screen overflow-hidden bg-gray-950">
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

    <!-- Control bar fills remaining height -->
    <div class="flex-1 min-h-0">
      <ControlBar
        states={algorithmStates}
        on:stepChange={handleStepChange}
      />
    </div>
  </div>

  <!-- Canvas -->
  <div class="flex-1" bind:this={canvasContainer}>
    <canvas bind:this={canvasElement} class="h-full w-full cursor-crosshair"></canvas>
  </div>
</div>