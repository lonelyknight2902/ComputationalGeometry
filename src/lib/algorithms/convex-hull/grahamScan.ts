import type { AlgorithmState, Point } from '$lib/types';
import { cross } from '../utils/geometry';

// ─── Colours ──────────────────────────────────────────────────────────────────

const C = {
	pointDefault: 0x6b7280,
	lower: 0x60a5fa, // blue   — lower hull edge
	upper: 0xa78bfa, // violet — upper hull edge
	popped: 0xef4444, // red    — being removed
	current: 0xffffff, // white  — point just being considered
	onHull: 0xf59e0b, // amber  — confirmed on partial hull
	start: 0x22c55e, // green  — leftmost anchor
	finalHull: 0x22c55e // green  — final hull vertices
} as const;

const CSS = {
	lower: '#60a5fa',
	upper: '#a78bfa',
	popped: '#ef4444',
	current: '#ffffff',
	onHull: '#f59e0b',
	start: '#22c55e',
	finalHull: '#22c55e',
	mono: '#94a3b8'
} as const;

const R = {
	default: 5,
	onHull: 7,
	current: 10,
	popped: 8,
	final: 8
} as const;

// ─── HTML helpers (mirror Chan's style) ───────────────────────────────────────

function badge(text: string, bg: string, fg = '#000'): string {
	return (
		`<span style="display:inline-block;padding:1px 6px;border-radius:4px;` +
		`background:${bg};color:${fg};font-size:0.75rem;font-weight:600;font-family:monospace">${text}</span>`
	);
}

function mono(text: string): string {
	return (
		`<code style="background:#1e293b;padding:1px 4px;border-radius:3px;` +
		`font-size:0.8rem;color:${CSS.mono}">${text}</code>`
	);
}

function section(title: string, body: string): string {
	return (
		`<div style="margin-bottom:6px">` +
		`<div style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;color:#64748b;` +
		`text-transform:uppercase;margin-bottom:2px">${title}</div>` +
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

function hullChain(pts: Point[], color: string): string {
	if (pts.length === 0) return '<span style="color:#475569;font-size:0.78rem">empty</span>';
	return pts.map((p) => badge(p.id, color, '#000')).join(' <span style="color:#475569">→</span> ');
}

// ─── Point styling helpers ────────────────────────────────────────────────────

function colorPoints(
	base: Point[],
	overrides: Record<string, { color?: number; radius?: number }>
): Point[] {
	return base.map((p) => {
		const o = overrides[p.id];
		return o ? { ...p, ...o } : p;
	});
}

function buildOverrides(
	allPoints: Point[],
	hullPts: Point[],
	currentId: string | null,
	poppedId: string | null,
	hullColor: number
): Record<string, { color: number; radius: number }> {
	const overrides: Record<string, { color: number; radius: number }> = {};

	allPoints.forEach((p) => {
		overrides[p.id] = { color: C.pointDefault, radius: R.default };
	});

	hullPts.forEach((p) => {
		overrides[p.id] = { color: hullColor, radius: R.onHull };
	});

	if (poppedId) overrides[poppedId] = { color: C.popped, radius: R.popped };
	if (currentId) overrides[currentId] = { color: C.current, radius: R.current };

	return overrides;
}

// ─── Graham scan visualizer ───────────────────────────────────────────────────

export function grahamScanVisualizer(points: Point[]): AlgorithmState[] {
	const states: AlgorithmState[] = [];

	const defaultPoints = points.map((p) => ({
		...p,
		color: C.pointDefault,
		radius: R.default
	}));

	// ── Trivial cases ─────────────────────────────────────────────────────────
	if (points.length <= 1) {
		states.push({
			points: defaultPoints,
			description: section(
				'Trivial Case',
				`Only ${mono(String(points.length))} point — trivially the convex hull.`
			)
		});
		return states;
	}
	if (points.length === 2) {
		states.push({
			points: defaultPoints.map((p) => ({ ...p, color: C.finalHull, radius: R.final })),
			lines: [
				{
					id: 'trivial',
					from: points[0].position,
					to: points[1].position,
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

	// ── Overview ──────────────────────────────────────────────────────────────
	states.push({
		points: defaultPoints,
		description:
			section('Graham Scan', `Running on ${mono(String(points.length))} points.`) +
			section(
				'Strategy',
				`<ol style="margin:0;padding-left:1.2em;line-height:1.8">` +
					`<li>Sort all points by x-coordinate (then y).</li>` +
					`<li>Sweep left→right building the <strong style="color:${CSS.lower}">lower hull</strong>, ` +
					`popping points that make a right turn.</li>` +
					`<li>Sweep right→left building the <strong style="color:${CSS.upper}">upper hull</strong>, ` +
					`same rule.</li>` +
					`<li>Concatenate → convex hull.</li>` +
					`</ol>`
			) +
			section('Complexity', row('Time', 'O(n log n)') + row('Bottleneck', 'initial sort'))
	});

	// ── Sort ──────────────────────────────────────────────────────────────────
	const sorted = [...points].sort((a, b) =>
		a.position.x === b.position.x ? a.position.y - b.position.y : a.position.x - b.position.x
	);

	// Color sorted order: leftmost = green, rest = default
	const sortOverrides: Record<string, { color: number; radius: number }> = {};
	sorted.forEach((p, i) => {
		sortOverrides[p.id] = {
			color: i === 0 ? C.start : C.pointDefault,
			radius: i === 0 ? R.current : R.default
		};
	});

	states.push({
		points: colorPoints(defaultPoints, sortOverrides),
		description:
			section(
				'Step 1 — Sort by X',
				`Points sorted left → right. The leftmost point ${badge(sorted[0].id, CSS.start)} will anchor both chains.`
			) +
			section(
				'Sorted order',
				sorted
					.map(
						(p, i) =>
							`<span style="display:inline-flex;align-items:center;gap:3px;margin:1px">` +
							`<span style="color:#475569;font-size:0.7rem">${i + 1}.</span>` +
							`${badge(p.id, i === 0 ? CSS.start : '#334155', i === 0 ? '#000' : CSS.mono)}` +
							`</span>`
					)
					.join(' ')
			)
	});

	// ── Lower hull ────────────────────────────────────────────────────────────
	states.push({
		points: colorPoints(defaultPoints, sortOverrides),
		description:
			section('Step 2 — Lower Hull', `Sweep <strong>left → right</strong>.`) +
			section(
				'Rule',
				`Before adding each point, pop the last hull point while the last three points make a ` +
					`<strong style="color:${CSS.popped}">right turn or are collinear</strong> ` +
					`(cross product ≤ 0). This guarantees the chain is always convex.`
			) +
			section('Edge color', `<span style="color:${CSS.lower}">■</span> Blue = lower hull edges`)
	});

	const lower: Point[] = [];

	for (const p of sorted) {
		// Pop loop
		while (
			lower.length >= 2 &&
			cross(lower[lower.length - 2].position, lower[lower.length - 1].position, p.position) <= 0
		) {
			const removed = lower.pop()!;

			const overrides = buildOverrides(points, lower, p.id, removed.id, C.lower);
			states.push({
				points: colorPoints(defaultPoints, overrides),
				lines: lower.slice(0, -1).map((pt, i) => ({
					id: `lower-pop-${i}`,
					from: pt.position,
					to: lower[i + 1].position,
					color: C.lower,
					width: 2
				})),
				description:
					section(
						`⬇ Lower Hull — Pop ${badge(removed.id, CSS.popped, '#fff')}`,
						`${badge(removed.id, CSS.popped, '#fff')} makes a <strong>right turn</strong> — ` +
							`it cannot be on the convex hull and is removed.`
					) +
					section(
						'Cross product',
						`${mono(`cross(..., ${removed.id}, ${p.id}) ≤ 0`)} → clockwise / collinear`
					) +
					section(
						'Lower chain',
						lower.length ? hullChain(lower, CSS.lower) : '<span style="color:#475569">empty</span>'
					)
			});
		}

		lower.push(p);

		const overrides = buildOverrides(points, lower, p.id, null, C.lower);
		states.push({
			points: colorPoints(defaultPoints, overrides),
			lines: lower.slice(0, -1).map((pt, i) => ({
				id: `lower-add-${i}`,
				from: pt.position,
				to: lower[i + 1].position,
				color: C.lower,
				width: 2
			})),
			description:
				section(
					`⬇ Lower Hull — Add ${badge(p.id, CSS.current)}`,
					`${badge(p.id, CSS.current)} makes a left turn — added to the lower chain.`
				) +
				section('Lower chain', hullChain(lower, CSS.lower)) +
				section('Progress', row('Points processed', `${sorted.indexOf(p) + 1} / ${sorted.length}`))
		});
	}

	// Lower hull complete
	states.push({
		points: colorPoints(defaultPoints, buildOverrides(points, lower, null, null, C.lower)),
		lines: lower.slice(0, -1).map((pt, i) => ({
			id: `lower-done-${i}`,
			from: pt.position,
			to: lower[i + 1].position,
			color: C.lower,
			width: 2
		})),
		description:
			section(
				'⬇ Lower Hull Complete',
				row('Vertices', String(lower.length)) +
					row('Eliminated', String(sorted.length - lower.length))
			) +
			section('Chain', hullChain(lower, CSS.lower)) +
			section(
				'Next',
				`Now building the <strong style="color:${CSS.upper}">upper hull</strong> sweeping right → left.`
			)
	});

	// ── Upper hull ────────────────────────────────────────────────────────────
	states.push({
		points: colorPoints(defaultPoints, buildOverrides(points, lower, null, null, C.lower)),
		lines: lower.slice(0, -1).map((pt, i) => ({
			id: `upper-intro-lower-${i}`,
			from: pt.position,
			to: lower[i + 1].position,
			color: C.lower,
			width: 1
		})),
		description:
			section('Step 3 — Upper Hull', `Sweep <strong>right → left</strong>. Same pop rule.`) +
			section(
				'Rule',
				`Pop while cross product ≤ 0. The lower hull stays visible ` + `(dimmed) for reference.`
			) +
			section('Edge color', `<span style="color:${CSS.upper}">■</span> Violet = upper hull edges`)
	});

	const upper: Point[] = [];

	for (let i = sorted.length - 1; i >= 0; i--) {
		const p = sorted[i];

		while (
			upper.length >= 2 &&
			cross(upper[upper.length - 2].position, upper[upper.length - 1].position, p.position) <= 0
		) {
			const removed = upper.pop()!;

			const overrides = buildOverrides(points, upper, p.id, removed.id, C.upper);
			// also dim lower hull pts
			lower.forEach((lp) => {
				if (!overrides[lp.id] || overrides[lp.id].color === C.pointDefault)
					overrides[lp.id] = { color: C.lower, radius: R.onHull };
			});

			states.push({
				points: colorPoints(defaultPoints, overrides),
				lines: [
					...lower.slice(0, -1).map((pt, li) => ({
						id: `upper-pop-lower-${li}`,
						from: pt.position,
						to: lower[li + 1].position,
						color: C.lower,
						width: 1
					})),
					...upper.slice(0, -1).map((pt, ui) => ({
						id: `upper-pop-${ui}`,
						from: pt.position,
						to: upper[ui + 1].position,
						color: C.upper,
						width: 2
					}))
				],
				description:
					section(
						`⬆ Upper Hull — Pop ${badge(removed.id, CSS.popped, '#fff')}`,
						`${badge(removed.id, CSS.popped, '#fff')} makes a <strong>right turn</strong> — removed.`
					) +
					section(
						'Cross product',
						`${mono(`cross(..., ${removed.id}, ${p.id}) ≤ 0`)} → clockwise / collinear`
					) +
					section(
						'Upper chain',
						upper.length ? hullChain(upper, CSS.upper) : '<span style="color:#475569">empty</span>'
					)
			});
		}

		upper.push(p);

		const overrides = buildOverrides(points, upper, p.id, null, C.upper);
		lower.forEach((lp) => {
			if (!overrides[lp.id] || overrides[lp.id].color === C.pointDefault)
				overrides[lp.id] = { color: C.lower, radius: R.onHull };
		});

		states.push({
			points: colorPoints(defaultPoints, overrides),
			lines: [
				...lower.slice(0, -1).map((pt, li) => ({
					id: `upper-add-lower-${li}`,
					from: pt.position,
					to: lower[li + 1].position,
					color: C.lower,
					width: 1
				})),
				...upper.slice(0, -1).map((pt, ui) => ({
					id: `upper-add-${ui}`,
					from: pt.position,
					to: upper[ui + 1].position,
					color: C.upper,
					width: 2
				}))
			],
			description:
				section(
					`⬆ Upper Hull — Add ${badge(p.id, CSS.current)}`,
					`${badge(p.id, CSS.current)} makes a left turn — added to the upper chain.`
				) +
				section('Upper chain', hullChain(upper, CSS.upper)) +
				section('Progress', row('Points processed', `${sorted.length - i} / ${sorted.length}`))
		});
	}

	// Upper hull complete
	states.push({
		points: colorPoints(
			defaultPoints,
			(() => {
				const o = buildOverrides(points, upper, null, null, C.upper);
				lower.forEach((lp) => {
					o[lp.id] = { color: C.lower, radius: R.onHull };
				});
				return o;
			})()
		),
		lines: [
			...lower.slice(0, -1).map((pt, i) => ({
				id: `upper-done-lower-${i}`,
				from: pt.position,
				to: lower[i + 1].position,
				color: C.lower,
				width: 1
			})),
			...upper.slice(0, -1).map((pt, i) => ({
				id: `upper-done-${i}`,
				from: pt.position,
				to: upper[i + 1].position,
				color: C.upper,
				width: 2
			}))
		],
		description:
			section(
				'⬆ Upper Hull Complete',
				row('Vertices', String(upper.length)) +
					row('Eliminated', String(sorted.length - upper.length))
			) +
			section('Upper chain', hullChain(upper, CSS.upper)) +
			section('Next', 'Concatenate lower + upper (dropping shared endpoints) to close the hull.')
	});

	// ── Merge ─────────────────────────────────────────────────────────────────
	upper.pop();
	lower.pop();
	const fullHull = lower.concat(upper);

	const finalOverrides: Record<string, { color: number; radius: number }> = {};
	points.forEach((p) => {
		finalOverrides[p.id] = { color: C.pointDefault, radius: R.default };
	});
	fullHull.forEach((p) => {
		finalOverrides[p.id] = { color: C.finalHull, radius: R.final };
	});

	states.push({
		points: colorPoints(defaultPoints, finalOverrides),
		lines: fullHull.map((p, i) => ({
			id: `final-${i}`,
			from: p.position,
			to: fullHull[(i + 1) % fullHull.length].position,
			color: C.finalHull,
			width: 3
		})),
		description:
			section(
				'✅ Convex Hull Complete',
				`Lower (${lower.length} pts) + Upper (${upper.length} pts) joined, ` +
					`shared endpoints removed.`
			) +
			section(
				'Result',
				row('Hull vertices (h)', String(fullHull.length)) +
					row('Input points (n)', String(points.length)) +
					row('Eliminated', String(points.length - fullHull.length)) +
					row('Complexity', 'O(n log n)')
			) +
			section(
				'Hull vertices',
				fullHull
					.map((p) => badge(p.id, CSS.finalHull, '#000'))
					.join(' <span style="color:#475569">→</span> ')
			)
	});

	return states;
}
