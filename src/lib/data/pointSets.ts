import type { Point } from '$lib/types';
import { browser } from '$app/environment';
import staticPointSetDefs from './staticPointSets.json';

type RawPoint = {
  id?: string;
  x: number;
  y: number;
  color?: number;
  radius?: number;
};

type StaticPointSetDefinition = {
  id: string;
  label: string;
  readonly?: boolean;
  rawPoints: RawPoint[];
};

export type PointSet = {
  id: string;
  label: string;
  points: Point[];
  readonly?: boolean;
};

const DEFAULT_COLOR = 0xffffff;
const DEFAULT_RADIUS = 6;
const STORAGE_KEY = 'compgeo.pointsets.v1';
const DEFAULT_BUILTIN_ID = 'default';

export function normalizePointSet(raw: RawPoint[]): Point[] {
  return raw.map((point, index) => ({
    id: point.id ?? `P${index + 1}`,
    position: { x: point.x, y: point.y },
    color: point.color ?? DEFAULT_COLOR,
    radius: point.radius ?? DEFAULT_RADIUS
  }));
}

const DEFAULT_BUILTIN_POINT_SET: PointSet = {
  id: 'default',
  label: 'Default',
  readonly: true,
  points: normalizePointSet([
    // Outer hull vertices (roughly octagonal)
    { id: 'A', x: 400, y: 60 },
    { id: 'B', x: 620, y: 100 },
    { id: 'C', x: 740, y: 260 },
    { id: 'D', x: 720, y: 440 },
    { id: 'E', x: 560, y: 540 },
    { id: 'F', x: 340, y: 560 },
    { id: 'G', x: 160, y: 460 },
    { id: 'H', x: 80, y: 280 },
    { id: 'I', x: 160, y: 110 },

    // Collinear point along the top edge (A→B) — stress-test degenerate case
    //                                                                          thanks codex for the random comments that no one asked for
    { id: 'J', x: 510, y: 80 },

    // Dense interior cluster
    { id: 'K', x: 380, y: 200 },
    { id: 'L', x: 420, y: 220 },
    { id: 'M', x: 400, y: 260 },
    { id: 'N', x: 360, y: 240 },
    { id: 'O', x: 440, y: 180 },

    // Scattered interior points
    { id: 'P', x: 540, y: 300 },
    { id: 'Q', x: 300, y: 350 },
    { id: 'R', x: 480, y: 420 },
    { id: 'S', x: 240, y: 200 },
    { id: 'T', x: 600, y: 200 },
    { id: 'U', x: 620, y: 380 },
    { id: 'V', x: 200, y: 380 },
    { id: 'W', x: 460, y: 320 },
    { id: 'X', x: 340, y: 440 },

    // Near-hull points (just inside the boundary — should be eliminated)
    { id: 'Y', x: 700, y: 160 },
    { id: 'Z', x: 180, y: 160 }
  ])
};

const STATIC_BUILTIN_POINT_SETS: PointSet[] = (staticPointSetDefs as StaticPointSetDefinition[])
  .filter((set) => set.id !== DEFAULT_BUILTIN_ID)
  .map((set) => ({
    id: set.id,
    label: set.label,
    readonly: set.readonly ?? true,
    points: normalizePointSet(set.rawPoints)
  }));

const BUILTIN_POINT_SETS: PointSet[] = [DEFAULT_BUILTIN_POINT_SET, ...STATIC_BUILTIN_POINT_SETS];
const BUILTIN_BY_ID = new Map(BUILTIN_POINT_SETS.map((set) => [set.id, set]));

function isProtectedBuiltIn(id: string): boolean {
  if (id === DEFAULT_BUILTIN_ID) return true;
  const builtin = BUILTIN_BY_ID.get(id);
  if (!builtin) return false;
  return builtin.readonly !== false;
}

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false;
  const point = value as Point;
  return (
    typeof point.id === 'string' &&
    typeof point.position?.x === 'number' &&
    typeof point.position?.y === 'number'
  );
}

function sanitizeUserPointSet(value: unknown): PointSet | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<PointSet>;
  if (typeof input.id !== 'string' || typeof input.label !== 'string' || !Array.isArray(input.points)) {
    return null;
  }
  if (!input.points.every((point) => isPoint(point))) return null;

  return {
    id: input.id,
    label: input.label,
    points: input.points.map((point) => ({
      id: point.id,
      position: { x: point.position.x, y: point.position.y },
      color: point.color ?? DEFAULT_COLOR,
      radius: point.radius ?? DEFAULT_RADIUS
    }))
  };
}

function readUserPointSets(): PointSet[] {
  if (!browser) return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((set) => sanitizeUserPointSet(set))
      .filter((set): set is PointSet => set !== null)
      .filter((set) => !isProtectedBuiltIn(set.id));
  } catch {
    return [];
  }
}

function writeUserPointSets(pointSets: PointSet[]): void {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pointSets));
}

export function listPointSets(): PointSet[] {
  const userSets = readUserPointSets();
  const userById = new Map(userSets.map((set) => [set.id, set]));

  const mergedBuiltins = BUILTIN_POINT_SETS.map((set) => userById.get(set.id) ?? set);
  const extraUserSets = userSets.filter((set) => !BUILTIN_BY_ID.has(set.id));

  return [...mergedBuiltins, ...extraUserSets];
}

export function saveUserPointSet(pointSet: Omit<PointSet, 'readonly'>): PointSet {
  if (isProtectedBuiltIn(pointSet.id)) {
    throw new Error(`Cannot overwrite built-in point set: ${pointSet.id}`);
  }

  const normalized: PointSet = {
    id: pointSet.id,
    label: pointSet.label,
    points: pointSet.points.map((point) => ({
      id: point.id,
      position: { x: point.position.x, y: point.position.y },
      color: point.color ?? DEFAULT_COLOR,
      radius: point.radius ?? DEFAULT_RADIUS
    }))
  };

  const userSets = readUserPointSets();
  const existingIndex = userSets.findIndex((set) => set.id === normalized.id);
  if (existingIndex >= 0) {
    userSets[existingIndex] = normalized;
  } else {
    userSets.push(normalized);
  }
  writeUserPointSets(userSets);
  return normalized;
}

export function createUserPointSet(input: {
  id: string;
  label: string;
  rawPoints: RawPoint[];
}): PointSet {
  return saveUserPointSet({
    id: input.id,
    label: input.label,
    points: normalizePointSet(input.rawPoints)
  });
}

export function deletePointSet(id: string): boolean {
  if (isProtectedBuiltIn(id)) return false;

  const userSets = readUserPointSets();
  const next = userSets.filter((set) => set.id !== id);
  if (next.length === userSets.length) return false;

  writeUserPointSets(next);
  return true;
}

export function getPointSet(id: string): PointSet {
  const pointSets = listPointSets();
  return pointSets.find((set) => set.id === id) ?? BUILTIN_POINT_SETS[0];
}

export const DEFAULT_POINT_SET_ID = BUILTIN_POINT_SETS[0].id;
