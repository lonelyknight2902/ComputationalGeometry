import type { Vector2 } from '$lib/types';

export function cross(o: Vector2, a: Vector2, b: Vector2): number {
	return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

export function dist2(a: Vector2, b: Vector2): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}
