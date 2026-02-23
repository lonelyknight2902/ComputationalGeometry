import type { AlgorithmState, Point } from '$lib/types';
import { cross, dist2 } from '../utils/geometry';

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
	pointDefault: 0x6b7280,
	pointGroup: [
		0x6366f1, // indigo
		0xec4899, // pink
		0xf97316, // orange
		0x14b8a6, // teal
		0xa855f7, // purple
		0xeab308, // yellow
		0x06b6d4, // cyan
		0x84cc16 // lime
	],
	hullVertex: 0xf59e0b,
	current: 0xef4444,
	nextBest: 0xffffff,
	start: 0x22c55e,
	finalHull: 0x22c55e
} as const;

// CSS colours matching the hex palette above (for inline HTML spans)
const CSS = {
	pointGroup: [
		'#6366f1',
		'#ec4899',
		'#f97316',
		'#14b8a6',
		'#a855f7',
		'#eab308',
		'#06b6d4',
		'#84cc16'
	],
	hullVertex: '#f59e0b',
	current: '#ef4444',
	nextBest: '#ffffff',
	start: '#22c55e',
	finalHull: '#22c55e',
	mono: '#94a3b8'
} as const;

const R = {
	default: 5,
	group: 6,
	hull: 7,
	current: 10,
	next: 9,
	start: 10,
	final: 8
} as const;

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function badge(text: string, bg: string, fg = '#000'): string {
	return `<span style="display:inline-block;padding:1px 6px;border-radius:4px;background:${bg};color:${fg};font-size:0.75rem;font-weight:600;font-family:monospace">${text}</span>`;
}

function chip(text: string, color: string): string {
	return (
		`<span style="display:inline-flex;align-items:center;gap:4px">` +
		`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>` +
		`<span style="font-family:monospace;font-size:0.8rem">${text}</span></span>`
	);
}

function mono(text: string): string {
	return `<code style="background:#1e293b;padding:1px 4px;border-radius:3px;font-size:0.8rem;color:${CSS.mono}">${text}</code>`;
}

function section(title: string, body: string): string {
	return (
		`<div style="margin-bottom:6px">` +
		`<div style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;margin-bottom:2px">${title}</div>` +
		`<div style="font-size:0.82rem;line-height:1.5;color:#e2e8f0">${body}</div>` +
		`</div>`
	);
}

function row(label: string, value: string): string {
	return (
		`<div style="display:flex;justify-content:space-between;gap:8px;font-size:0.8rem;padding:1px 0">` +
		`<span style="color:#94a3b8">${label}</span>` +
		`<span style="color:#e2e8f0;font-family:monospace">${value}</span>` +
		`</div>`
	);
}

function groupCss(hi: number): string {
	return CSS.pointGroup[hi % CSS.pointGroup.length];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupColor(hi: number): number {
	return C.pointGroup[hi % C.pointGroup.length];
}

function colorPoints(
	base: Point[],
	overrides: Record<string, { color?: number; radius?: number }>
): Point[] {
	return base.map((p) => {
		const o = overrides[p.id];
		return o ? { ...p, ...o } : p;
	});
}

function groupOverrides(
	groups: Point[][],
	miniHulls: Point[][]
): Record<string, { color: number; radius: number }> {
	const map: Record<string, { color: number; radius: number }> = {};
	groups.forEach((g, gi) => {
		const hullIds = new Set(miniHulls[gi]?.map((p) => p.id) ?? []);
		g.forEach((p) => {
			map[p.id] = {
				color: groupColor(gi),
				radius: hullIds.has(p.id) ? R.group : R.default
			};
		});
	});
	return map;
}

// ─── Graham scan ─────────────────────────────────────────────────────────────

function grahamScan(points: Point[]): Point[] {
	if (points.length <= 1) return points;
	const pts = [...points].sort((a, b) =>
		a.position.x === b.position.x ? a.position.y - b.position.y : a.position.x - b.position.x
	);
	const lower: Point[] = [];
	for (const p of pts) {
		while (
			lower.length >= 2 &&
			cross(lower.at(-2)!.position, lower.at(-1)!.position, p.position) <= 0
		)
			lower.pop();
		lower.push(p);
	}
	const upper: Point[] = [];
	for (let i = pts.length - 1; i >= 0; i--) {
		const p = pts[i];
		while (
			upper.length >= 2 &&
			cross(upper.at(-2)!.position, upper.at(-1)!.position, p.position) <= 0
		)
			upper.pop();
		upper.push(p);
	}
	upper.pop();
	lower.pop();
	return lower.concat(upper);
}

// ─── Chan's convex hull ───────────────────────────────────────────────────────

export function chansConvexHull(inputPoints: Point[]): AlgorithmState[] {
	const states: AlgorithmState[] = [];
	const n = inputPoints.length;

	const defaultPoints = inputPoints.map((p) => ({
		...p,
		color: C.pointDefault,
		radius: R.default
	}));

	// ── Trivial cases ─────────────────────────────────────────────────────────
	if (n <= 1) {
		states.push({
			points: defaultPoints,
			description: section(
				'Trivial Case',
				`Only ${mono(String(n))} point — it is trivially the convex hull.`
			)
		});
		return states;
	}
	if (n === 2) {
		states.push({
			points: defaultPoints.map((p) => ({ ...p, color: C.finalHull, radius: R.final })),
			lines: [
				{
					id: 'trivial',
					from: inputPoints[0].position,
					to: inputPoints[1].position,
					color: C.finalHull,
					width: 2
				}
			],
			description: section(
				'Trivial Case',
				`Only ${mono('2')} points — the hull is the segment between them.`
			)
		});
		return states;
	}

	return states;
}
