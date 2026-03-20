<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { PointSet } from '$lib/data/pointSets';

  export let collapsed = false;
  export let availablePointSets: PointSet[] = [];
  export let selectedPointSetId = '';
  export let selectedPointSet: PointSet | undefined;
  export let editMode = false;
  export let editSetId = '';
  export let editSetLabel = '';
  export let newSetPointsJson = '';
  export let editDraftValid: boolean | null = null;
  export let pointSetError = '';
  export let pointSetStatus = '';

  const dispatch = createEventDispatcher<{
    toggleCollapsed: void;
    pointSetChange: void;
    createBlankPointSet: void;
    toggleEditMode: void;
    deletePointSet: void;
    editorInput: void;
  }>();
</script>

{#if !collapsed}
  <div class="flex-none flex flex-col h-full w-72 bg-gray-900 border-l border-gray-800">
    <div class="p-3 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
      <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500">
        Point Sets
      </label>
      <button
        class="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        on:click={() => dispatch('toggleCollapsed')}
        title="Collapse point set panel"
      >
        →
      </button>
    </div>

    <div class="p-3 bg-gray-900 border-b border-gray-800 space-y-2">
      <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
        Active Set
      </label>
      <select
        bind:value={selectedPointSetId}
        on:change={() => dispatch('pointSetChange')}
        class="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2
               border border-gray-700 hover:border-gray-500 focus:border-blue-500
               focus:outline-none transition-colors cursor-pointer"
      >
        {#each availablePointSets as set}
          <option value={set.id}>{set.label}</option>
        {/each}
      </select>
      <div class="grid grid-cols-2 gap-2">
        <button
          class="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-400 transition-colors text-sm text-white"
          on:click={() => dispatch('createBlankPointSet')}
        >
          New Point Set
        </button>
        <button
          class={`w-full py-2 rounded-lg transition-colors text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed ${
            editMode
              ? 'bg-red-700 hover:bg-red-600 active:bg-red-500'
              : 'bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-500'
          }`}
          on:click={() => dispatch('toggleEditMode')}
          disabled={!selectedPointSet || selectedPointSet.readonly}
        >
          Edit
        </button>
      </div>
      <button
        class="w-full py-2 rounded-lg bg-red-700 hover:bg-red-600 active:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm text-white"
        on:click={() => dispatch('deletePointSet')}
        disabled={!selectedPointSet || selectedPointSet.readonly}
        title={selectedPointSet?.readonly ? 'Built-in set cannot be deleted' : 'Delete selected set'}
      >
        Delete Selected Set
      </button>
    </div>

    <div class="p-3 bg-gray-900 border-b border-gray-800 space-y-2">
      <label class="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1.5">
        Edit Points JSON
      </label>
      <input
        type="text"
        bind:value={editSetId}
        on:input={() => dispatch('editorInput')}
        placeholder="Set id"
        disabled={!editMode || !!selectedPointSet?.readonly}
        class="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2
               border border-gray-700 hover:border-gray-500 focus:border-blue-500 disabled:opacity-50
               focus:outline-none transition-colors"
      />
      <input
        type="text"
        bind:value={editSetLabel}
        on:input={() => dispatch('editorInput')}
        placeholder="Set name"
        disabled={!editMode || !!selectedPointSet?.readonly}
        class="w-full bg-gray-800 text-gray-100 text-sm rounded-lg px-3 py-2
               border border-gray-700 hover:border-gray-500 focus:border-blue-500 disabled:opacity-50
               focus:outline-none transition-colors"
      />
      <textarea
        bind:value={newSetPointsJson}
        on:input={() => dispatch('editorInput')}
        rows="9"
        wrap="off"
        spellcheck="false"
        disabled={!editMode || !!selectedPointSet?.readonly}
        class="w-full bg-gray-800 text-gray-100 text-xs font-mono rounded-lg px-3 py-2
               border border-gray-700 hover:border-gray-500 focus:border-blue-500 overflow-x-auto disabled:opacity-50
               focus:outline-none transition-colors"
      />
    </div>

    <div class="p-3 text-xs min-h-0 overflow-y-auto">
      {#if editMode && !selectedPointSet?.readonly}
        <p class="text-gray-400 whitespace-pre-line">Left click - Add point{"\n"}Right click - Remove point</p>
        <p class={editDraftValid === false ? 'text-red-400' : 'text-emerald-400'}>
          {editDraftValid === false ? 'Invalid syntax.' : 'Saved.'}
        </p>
      {/if}
      {#if pointSetError}
        <p class="text-red-400 mt-2">{pointSetError}</p>
      {/if}
      {#if pointSetStatus}
        <p class="text-emerald-400 mt-2">{pointSetStatus}</p>
      {/if}
    </div>
  </div>
{/if}

{#if collapsed}
  <button
    class="absolute top-3 right-0 h-16 w-8 rounded-l-lg border border-gray-700 border-r-0
           bg-gray-900 text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
    on:click={() => dispatch('toggleCollapsed')}
    title="Expand point set panel"
  >
    ←
  </button>
{/if}
