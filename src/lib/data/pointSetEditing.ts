import type { Point } from '$lib/types';
import type { PointSet } from '$lib/data/pointSets';

export type RawPoint = { x: number; y: number };
export const EMPTY_POINTS_JSON = '[\n\n]';

export function serializePointsForEditor(pointSet: PointSet): string {
  if (pointSet.points.length === 0) {
    return EMPTY_POINTS_JSON;
  }

  return JSON.stringify(
    pointSet.points.map((point) => ({
      x: point.position.x,
      y: point.position.y
    })),
    null,
    2
  );
}

export function nextGeneratedSetNumber(pointSets: PointSet[]): number {
  let max = 0;
  for (const set of pointSets) {
    const match = /^set-(\d+)$/.exec(set.id);
    if (!match) continue;
    max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export function generateRegularPolygonPoints(setNumber: number): RawPoint[] {
  const sides = Math.max(3, setNumber + 2);
  const centerX = 290;
  const centerY = 230;
  const radius = 95;
  const startAngle = -Math.PI / 2;

  return Array.from({ length: sides }, (_, index) => {
    const angle = startAngle + (index * 2 * Math.PI) / sides;
    return {
      x: Math.round(centerX + radius * Math.cos(angle)),
      y: Math.round(centerY + radius * Math.sin(angle))
    };
  });
}

export type PointSetDraftValidationResult =
  | {
      valid: true;
      id: string;
      label: string;
      rawPoints: RawPoint[];
    }
  | {
      valid: false;
      error: string;
    };

export function validatePointSetDraft(params: {
  previousId: string;
  editSetId: string;
  editSetLabel: string;
  pointsJson: string;
  availablePointSets: PointSet[];
}): PointSetDraftValidationResult {
  const trimmedId = params.editSetId.trim();
  const trimmedLabel = params.editSetLabel.trim();

  if (!trimmedId) {
    return { valid: false, error: 'Set ID is required.' };
  }
  if (!trimmedLabel) {
    return { valid: false, error: 'Set name is required.' };
  }

  const idConflict = params.availablePointSets.some(
    (set) => set.id === trimmedId && set.id !== params.previousId
  );
  if (idConflict) {
    return { valid: false, error: `Set ID "${trimmedId}" already exists.` };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(params.pointsJson);
  } catch {
    return { valid: false, error: 'Points JSON is invalid.' };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: 'Points JSON must be an array.' };
  }

  const rawPoints: RawPoint[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      return { valid: false, error: 'Each point must be an object with numeric x and y.' };
    }

    const x = (entry as { x?: unknown }).x;
    const y = (entry as { y?: unknown }).y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return { valid: false, error: 'Each point must include numeric x and y.' };
    }

    rawPoints.push({ x, y });
  }

  return {
    valid: true,
    id: trimmedId,
    label: trimmedLabel,
    rawPoints
  };
}

export type CanvasPointEditResult =
  | {
      changed: false;
    }
  | {
      changed: true;
      rawPoints: RawPoint[];
      status: string;
    };

export function applyCanvasPointEdit(params: {
  button: number;
  click: { x: number; y: number };
  currentPoints: Point[];
  hitPadding: number;
}): CanvasPointEditResult {
  const { button, click, currentPoints, hitPadding } = params;

  if (button === 2) {
    let targetIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    currentPoints.forEach((point, index) => {
      const radius = (point.radius ?? 6) + hitPadding;
      const dx = click.x - point.position.x;
      const dy = click.y - point.position.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= radius * radius && d2 < bestDistance) {
        bestDistance = d2;
        targetIndex = index;
      }
    });

    if (targetIndex === -1) {
      return { changed: false };
    }

    return {
      changed: true,
      rawPoints: currentPoints
        .filter((_, index) => index !== targetIndex)
        .map((point) => ({ x: point.position.x, y: point.position.y })),
      status: 'Point removed.'
    };
  }

  const overlapsExisting = currentPoints.some((point) => {
    const radius = (point.radius ?? 6) + hitPadding;
    const dx = click.x - point.position.x;
    const dy = click.y - point.position.y;
    return dx * dx + dy * dy <= radius * radius;
  });

  if (overlapsExisting) {
    return { changed: false };
  }

  return {
    changed: true,
    rawPoints: currentPoints
      .map((point) => ({ x: point.position.x, y: point.position.y }))
      .concat([{ x: Math.round(click.x), y: Math.round(click.y) }]),
    status: 'Point added.'
  };
}
