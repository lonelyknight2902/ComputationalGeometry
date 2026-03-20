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

// ─── Graham scan sub-algorithm ───────────────────────────────────────────────

function grahamScanGroup(pts: Point[]): Point[] {
	if (pts.length <= 2) return pts;

	const sorted = [...pts].sort((a, b) =>
		a.position.x === b.position.x ? a.position.y - b.position.y : a.position.x - b.position.x
	);

	const lower: Point[] = [];
	for (const p of sorted) {
		while (
			lower.length >= 2 &&
			cross(lower[lower.length - 2].position, lower[lower.length - 1].position, p.position) <= 0
		) {
			lower.pop();
		}
		lower.push(p);
	}

	const upper: Point[] = [];
	for (let i = sorted.length - 1; i >= 0; i--) {
		const p = sorted[i];
		while (
			upper.length >= 2 &&
			cross(upper[upper.length - 2].position, upper[upper.length - 1].position, p.position) <= 0
		) {
			upper.pop();
		}
		upper.push(p);
	}

	upper.pop();
	lower.pop();
	return lower.concat(upper);
}

// ─── Chan's convex hull ───────────────────────────────────────────────────────

export function chansConvexHull(inputPoints: Point[], useBinarySearch: boolean, skipSearchVisuals: boolean = false): AlgorithmState[] {
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

	// ── Overview ──────────────────────────────────────────────────────────────
	states.push({
		points: defaultPoints,
		description:
			section('Chan\'s Convex Hull', `Running on ${mono(String(n))} points.`) +
			section(
				'Strategy',
				`<ol style="margin:0;padding-left:1.2em;line-height:1.8">` +
					`<li>Partition points into ${mono('k')} groups (roughly √n).</li>` +
					`<li>Compute convex hull for each group via Graham Scan.</li>` +
					`<li>Merge mini-hulls via Jarvis March on hull vertices only.</li>` +
					`</ol>`
			) +
			section('Complexity', row('Time', 'O(n log h)') + row('Advantage', 'Output-sensitive: h = hull size'))
	});

	// ── Partition into k groups ───────────────────────────────────────────────
	const k = Math.max(2, Math.ceil(Math.sqrt(n)));
	const groupSize = Math.ceil(n / k);
	const groups: Point[][] = [];

	for (let i = 0; i < k; i++) {
		groups.push(inputPoints.slice(i * groupSize, (i + 1) * groupSize));
	}

	states.push({
		points: (() => {
			const overrides: Record<string, { color: number; radius: number }> = {};
			groups.forEach((g, gi) => {
				g.forEach((p) => {
					overrides[p.id] = {
						color: groupColor(gi),
						radius: R.group
					};
				});
			});
			return colorPoints(defaultPoints, overrides);
		})(),
		description:
			section(
				'Step 1 — Partition',
				`Points divided into ${mono(String(k))} groups (each colored differently).`
			) +
			section(
				'Group sizes',
				groups
					.map(
						(g, gi) =>
							`${chip(`G${gi + 1}`, groupCss(gi))}: ${mono(String(g.length))} points`
					)
					.join(' | ')
			) +
			section(
				'Next',
				`Compute hull for each group independently using <strong>Graham Scan</strong>.`
			)
	});

	// ── Build mini-hulls for each group via Graham Scan ────────────────────────
	const miniHulls: Point[][] = [];

	for (let gi = 0; gi < groups.length; gi++) {
		const group = groups[gi];
		const miniHull = grahamScanGroup(group);
		miniHulls.push(miniHull);

		const overrides = groupOverrides(groups, miniHulls);
		states.push({
			points: colorPoints(defaultPoints, overrides),
			lines: miniHull.map((p, i) => ({
				id: `group-${gi}-edge-${i}`,
				from: p.position,
				to: miniHull[(i + 1) % miniHull.length].position,
				color: groupColor(gi),
				width: 2
			})),
			description:
				section(
					`Step 2 — Graham Scan: Group ${chip(`G${gi + 1}`, groupCss(gi))}`,
					`Mini-hull computed (${mono(String(miniHull.length))} vertices from ${mono(String(group.length))} points).`
				) +
				section(
					'Hull vertices',
					miniHull.map((p) => badge(p.id, groupCss(gi), '#000')).join(' → ')
				) +
				section(
					'Progress',
					row('Completed', `${gi + 1} / ${k}`) +
						row('Total mini-hulls', `${miniHulls.length}`)
				)
		});
	}

	// ── Jarvis March (gift wrapping) on mini-hull vertices ───────────────────

	// Find leftmost point among all mini-hull vertices (anchor for wrapping)
	const leftmost = miniHulls
		.flat()
		.reduce((a, b) => (b.position.x < a.position.x ? b : a));

	const finalHull: Point[] = [leftmost];

	states.push({
		points: (() => {
			const overrides: Record<string, { color: number; radius: number }> = {};
			inputPoints.forEach((p) => {
				overrides[p.id] = { color: C.pointDefault, radius: R.default };
			});
			miniHulls.flat().forEach((p) => {
				overrides[p.id] = { color: C.hullVertex, radius: R.hull };
			});
			overrides[leftmost.id] = { color: C.start, radius: R.start };
			return colorPoints(defaultPoints, overrides);
		})(),
		lines: miniHulls.flatMap((hull, gi) =>
			hull.map((p, i) => ({
				id: `group-hull-${gi}-edge-${i}`,
				from: p.position,
				to: hull[(i + 1) % hull.length].position,
				color: groupColor(gi),
				width: 1
			}))
		),
		description:
			section(
				'Step 3 — Jarvis March (Gift Wrapping)',
				`Start from leftmost mini-hull vertex ${badge(leftmost.id, CSS.start)}.`
			) +
			section(
				'Mini-hull vertices only',
				`Merge now considers only ${mono(String(miniHulls.flat().length))} hull vertices, not all ${mono(String(n))} points.`
			) +
			section(
				'Method',
				`For each wrapped vertex, find the next vertex via counter-clockwise orientation test.`
			)
	});

	let current = leftmost;

	// Wrapping loop: iterate until we return to the start
	for (let step = 0; step < 1000; step++) {
		// Find the point with the most counter-clockwise angle from current
		let nextPoint: Point | null = null;

		// Show each candidate being tested
		for (const miniHull of miniHulls) {
            
            // 1. Determine the path of candidates to check
            let candidatesToCheck: Point[] = [];

            const currentIdxInHull = miniHull.findIndex((p) => p.id === current.id);

            if (currentIdxInHull !== -1) {
                // O(1) Same-hull shortcut (Going backwards: i - 1)
                candidatesToCheck = [miniHull[(currentIdxInHull - 1 + miniHull.length) % miniHull.length]];
            } else if (useBinarySearch) {
                // O(log k) Binary search path (yields the few probed points)
                candidatesToCheck = getBinarySearchPath(current, miniHull);
                
                // If skipping visuals, just grab the final tangent from the path
                if (skipSearchVisuals && candidatesToCheck.length > 0) {
                    candidatesToCheck = [candidatesToCheck[candidatesToCheck.length - 1]];
                }
            } else {
                // O(k) Linear scan (yields all points)
                candidatesToCheck = miniHull;
                
                // If skipping visuals, we must mathematically find the best point first
                // because the last element of miniHull is just an arbitrary point, not the tangent!
                if (skipSearchVisuals) {
                    let best = candidatesToCheck[0];
                    for (let i = 1; i < candidatesToCheck.length; i++) {
                        const p = candidatesToCheck[i];
                        const o = cross(current.position, best.position, p.position);
                        if (o > 0 || (o === 0 && dist2(current.position, p.position) > dist2(current.position, best.position))) {
                            best = p;
                        }
                    }
                    candidatesToCheck = [best];
                }
            }
			for (const candidate of candidatesToCheck) {
				if (candidate.id === current.id) continue;

				// State BEFORE deciding on this candidate
				const overrides_test: Record<string, { color: number; radius: number }> = {};
				inputPoints.forEach((p) => {
					overrides_test[p.id] = { color: C.pointDefault, radius: R.default };
				});

				miniHulls.flat().forEach((p) => {
					const inFinalHull = finalHull.some((fp) => fp.id === p.id);
					overrides_test[p.id] = {
						color: inFinalHull ? C.finalHull : C.hullVertex,
						radius: inFinalHull ? R.final : R.hull
					};
				});

				overrides_test[current.id] = { color: C.current, radius: R.current };
				overrides_test[candidate.id] = { color: C.nextBest, radius: R.next };

				if (nextPoint && nextPoint.id !== candidate.id) {
					overrides_test[nextPoint.id] = { color: C.hullVertex, radius: R.hull };
				}

				const o = nextPoint ? cross(current.position, nextPoint.position, candidate.position) : 1;
				const isReplaced =
					nextPoint &&
					(o > 0 ||
						(o === 0 &&
							dist2(current.position, candidate.position) >
								dist2(current.position, nextPoint.position)));

				const isInitial = !nextPoint;

				states.push({
					points: colorPoints(defaultPoints, overrides_test),
					lines: [
						// Group hulls in background
						...miniHulls.flatMap((hull, gi) =>
							hull.map((p, i) => ({
								id: `group-hull-test-${gi}-edge-${i}`,
								from: p.position,
								to: hull[(i + 1) % hull.length].position,
								color: groupColor(gi),
								width: 1
							}))
						),
						// Final hull so far (only connect adjacent vertices, don't close)
						...finalHull.slice(0, -1).map((p, i) => ({
							id: `final-edge-test-${i}`,
							from: p.position,
							to: finalHull[i + 1].position,
							color: C.finalHull,
							width: 2
						})),
						// Test line from current to candidate
						{
							id: `test-candidate`,
							from: current.position,
							to: candidate.position,
							color: isReplaced || isInitial ? C.nextBest : C.current,
							width: 2
						},
						// Comparison line if there's already a candidate
						...(nextPoint && !isInitial
							? [
									{
										id: `test-comparison`,
										from: current.position,
										to: nextPoint.position,
										color: C.hullVertex,
										width: 1
									}
								]
							: [])
					],
					description:
						section(
							`🔍 Test candidate ${badge(candidate.id, CSS.nextBest)}`,
							isInitial
								? `First candidate found — ${badge(candidate.id, CSS.nextBest)} is the initial choice.`
								: isReplaced
									? `${badge(candidate.id, CSS.nextBest)} makes a <strong>more counter-clockwise</strong> angle ` +
										`than ${badge(nextPoint!.id, CSS.hullVertex)} — it becomes the new best.`
									: `${badge(candidate.id, CSS.nextBest)} is <strong>clockwise or collinear</strong> with respect to ` +
										`${badge(nextPoint!.id, CSS.hullVertex)} — kept as is.`
						) +
						section(
							'Cross product',
							isInitial
								? `— (first candidate, no comparison yet)`
								: `${mono(`cross(${current.id}, ${nextPoint!.id}, ${candidate.id}) = ${o.toFixed(0)}`)} ` +
										`→ ${o > 0 ? '<strong style="color:#ef4444">clockwise</strong>' : o === 0 ? '<strong>collinear</strong>' : '<strong style="color:#22c55e">counter-clockwise</strong>'}`
						) +
						section(
							'Current best',
							nextPoint ? badge(nextPoint.id, CSS.hullVertex) : '<span style="color:#475569">none</span>'
						)
				});

				if (!nextPoint) {
					nextPoint = candidate;
				} else {
					const o_final = cross(current.position, nextPoint.position, candidate.position);

					if (
						o_final > 0 ||
						(o_final === 0 &&
							dist2(current.position, candidate.position) >
								dist2(current.position, nextPoint.position))
					) {
						nextPoint = candidate;
					}
				}
			}
		}

		if (!nextPoint || nextPoint.id === leftmost.id) {
			// Hull is complete
			break;
		}

		finalHull.push(nextPoint);

		// Final state for this wrapping step
		const overrides_final: Record<string, { color: number; radius: number }> = {};
		inputPoints.forEach((p) => {
			overrides_final[p.id] = { color: C.pointDefault, radius: R.default };
		});

		miniHulls.flat().forEach((p) => {
			const inFinalHull = finalHull.some((fp) => fp.id === p.id);
			overrides_final[p.id] = {
				color: inFinalHull ? C.finalHull : C.hullVertex,
				radius: inFinalHull ? R.final : R.hull
			};
		});

		states.push({
			points: colorPoints(defaultPoints, overrides_final),
			lines: [
				// Group hulls in background (faded)
				...miniHulls.flatMap((hull, gi) =>
					hull.map((p, i) => ({
						id: `group-hull-confirm-${gi}-edge-${i}`,
						from: p.position,
						to: hull[(i + 1) % hull.length].position,
						color: groupColor(gi),
						width: 1
					}))
				),
				// Final hull in foreground (only connect adjacent vertices, don't close yet)
				...finalHull.slice(0, -1).map((p, i) => ({
					id: `final-edge-confirm-${i}`,
					from: p.position,
					to: finalHull[i + 1].position,
					color: C.finalHull,
					width: 2
				}))
			],
			description:
				section(
					`✅ Wrap confirmed — Add ${badge(nextPoint.id, CSS.finalHull, '#000')}`,
					`${badge(nextPoint.id, CSS.finalHull, '#000')} was the most counter-clockwise from ${badge(current.id, CSS.current)}.`
				) +
				section(
					'Final hull progress',
					finalHull.map((p) => badge(p.id, CSS.finalHull, '#000')).join(' → ')
				) +
				section('Vertices', row('On hull', String(finalHull.length)))
		});

		current = nextPoint;
	}

	// ── Final result ──────────────────────────────────────────────────────────

	const finalOverrides: Record<string, { color: number; radius: number }> = {};
	inputPoints.forEach((p) => {
		finalOverrides[p.id] = { color: C.pointDefault, radius: R.default };
	});
	finalHull.forEach((p) => {
		finalOverrides[p.id] = { color: C.finalHull, radius: R.final };
	});

	states.push({
		points: colorPoints(defaultPoints, finalOverrides),
		lines: [
			// Group hulls in background (faded)
			...miniHulls.flatMap((hull, gi) =>
				hull.map((p, i) => ({
					id: `group-hull-final-${gi}-edge-${i}`,
					from: p.position,
					to: hull[(i + 1) % hull.length].position,
					color: groupColor(gi),
					width: 1
				}))
			),
			// Final hull in foreground (bold)
			...finalHull.map((p, i) => ({
				id: `final-complete-${i}`,
				from: p.position,
				to: finalHull[(i + 1) % finalHull.length].position,
				color: C.finalHull,
				width: 3
			}))
		],
		description:
			section(
				'✅ Chan\'s Algorithm Complete',
				`${k} mini-hulls merged via Jarvis March on ${miniHulls.flat().length} vertices.`
			) +
			section(
				'Result',
				row('Hull vertices (h)', String(finalHull.length)) +
					row('Input points (n)', String(n)) +
					row('Eliminated', String(n - finalHull.length)) +
					row('Complexity', 'O(n log h)')
			) +
			section(
				'Hull vertices',
				finalHull
					.map((p) => badge(p.id, CSS.finalHull, '#000'))
					.join(' <span style="color:#475569">→</span> ')
			)
	});

	return states;
}


    /**
     * Returns the sequence of points tested during the binary search.
     * The last point in the returned array is the final tangent.
     */    
   
    function getBinarySearchPath(current: Point, miniHull: Point[]): Point[] {
		const n = miniHull.length;
		if (n === 1) return [miniHull[0]];

		const path: Point[] = [];
		const p = current.position;

		// 'geq' and 'leq' with epsilon for stability
		const EPS = 1e-9;
		const geq = (val: number, limit: number) => val >= limit - EPS;
		const leq = (val: number, limit: number) => val <= limit + EPS;

		// --- 1. Split into Lower (Ps[0]) and Upper (Ps[1]) Layers ---
		// Graham Scan usually puts leftmost at index 0. We find rightmost to split.
		let mIdx = 0;
		for (let i = 1; i < n; i++) {
			if (miniHull[i].position.x > miniHull[mIdx].position.x) mIdx = i;
		}

		const lowerLayer = miniHull.slice(0, mIdx + 1); // Left to Right
		const upperLayer = miniHull.slice(mIdx, n).concat([miniHull[0]]); // Right to Left
		const layers = [lowerLayer, upperLayer];

		// lk is the offset used to map layer indices back to the original P array
		const offset = mIdx; 
		
		// 'tang' finds the local extrema based on weight 'w'
		const tang = (l: number, r: number, w: number, layer: Point[], layerOffset: number): number => {
			let res = l;
			const low = l;
			const high = r;

			while (l <= r) {
				const m = Math.floor((l + r) / 2);
				const globalIdx = (m + layerOffset) % n;
				
				// Record visualization path
				if (path.length === 0 || path[path.length - 1].id !== miniHull[globalIdx].id) {
					path.push(miniHull[globalIdx]);
				}

				const curr = miniHull[globalIdx].position;
				const next = miniHull[(globalIdx + 1) % n].position;
				const prev = miniHull[(globalIdx - 1 + n) % n].position;

				const a = cross(p, curr, next) * w;
				const b = cross(p, curr, prev) * w;

				if (geq(a, 0) && geq(b, 0)) return m;
				if (geq(a, 0)) {
					r = m - 1;
					res = m;
				} else {
					l = m + 1;
				}
			}
			return res;
		};

		// 'bs' splits a layer into points left of p.x and right of p.x
		const bs = (layer: Point[], w: number): number => {
			let l = 0, r = layer.length - 1;
			let res = 0;
			const targetX = p.x * w;
			while (l <= r) {
				const m = Math.floor((l + r) / 2);
				if (layer[m].position.x * w >= targetX - EPS) {
					r = m - 1;
				} else {
					res = m;
					l = m + 1;
				}
			}
			return res;
		};
		
		// Split points in layers based on p.x
		const t1 = bs(layers[0], 1);
		const t2 = bs(layers[1], -1);

		// For Jarvis/Chan, we primarily need the Right Tangent (u1, u2)

		const u1 = tang(0, t1, -1, layers[0], 0);
		const u2 = tang(0, t2, -1, layers[1], offset);

		let left: Point = miniHull[u1]; // start with u1

		// Validate u1
		let idx = u1;
		let curr = miniHull[idx].position;
		let prev = miniHull[(idx - 1 + n) % n].position;
		let next = miniHull[(idx + 1) % n].position;

		if (
			leq(cross(p, curr, prev), 0) &&
			leq(cross(p, curr, next), 0)
		) {
			left = miniHull[idx];
		}

		// Validate u2
		idx = (u2 + offset) % n;
		curr = miniHull[idx].position;
		prev = miniHull[(idx - 1 + n) % n].position;
		next = miniHull[(idx + 1) % n].position;

		if (
			leq(cross(p, curr, prev), 0) &&
			leq(cross(p, curr, next), 0)
		) {
			left = miniHull[idx];
		}

		// The binary search might land on the closer of two collinear tangent points.
        // Because the hull is strictly convex, we only need to check its immediate neighbors.
        let finalTangent = left;
        const leftIdx = miniHull.findIndex(pt => pt.id === left.id);
        const nextPt = miniHull[(leftIdx + 1) % n];
        const prevPt = miniHull[(leftIdx - 1 + n) % n];

        // Check if the next point is collinear and further away
        if (Math.abs(cross(p, finalTangent.position, nextPt.position)) <= EPS) {
            if (dist2(p, nextPt.position) > dist2(p, finalTangent.position)) {
                finalTangent = nextPt;
            }
        } 
        // Check if the prev point is collinear and further away
        else if (Math.abs(cross(p, finalTangent.position, prevPt.position)) <= EPS) {
            if (dist2(p, prevPt.position) > dist2(p, finalTangent.position)) {
                finalTangent = prevPt;
            }
        }

        // Push the confirmed furthest tangent to the path
        if (path.length === 0 || path[path.length - 1].id !== finalTangent.id) {
            path.push(finalTangent);
        }

        return path;
    }