import type { AlgorithmState, Line, Point } from '$lib/types';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';

export class Renderer {
	private app: Application;
	private container!: Container;
	private tooltip: Container | null = null;

	constructor(app: Application) {
		this.app = app;
		this.createContainer();
	}

	render(state: AlgorithmState) {
		this.container.removeChildren();
		this.tooltip = null;

		if (state.lines) {
			for (const line of state.lines) {
				this.drawLine(line);
			}
		}
		for (const point of state.points) {
			this.drawPoint(point);
		}
	}

	drawPoint(point: Point) {
		const radius = point.radius ?? 5;
		const color = point.color ?? 0x6b7280;

		const circle = new Graphics()
			.circle(point.position.x, point.position.y, radius)
			.fill(color)
			.stroke({ color: 0x000000, alpha: 0.4, width: 1.5 });

		circle.interactive = true;
		circle.cursor = 'pointer';
		circle.on('pointerover', () => this.showTooltip(point));
		circle.on('pointerout', () => this.hideTooltip());

		this.container.addChild(circle);
	}

	drawLine(line: Line) {
		const graphics = new Graphics()
			.moveTo(line.from.x, line.from.y)
			.lineTo(line.to.x, line.to.y)
			.stroke({ color: line.color ?? 0x000000, width: line.width ?? 2 });
		this.container.addChild(graphics);
	}

	createContainer(): void {
		this.container = new Container();
		this.app.stage.addChild(this.container);
		this.container.x = this.app.screen.width / 2;
		this.container.y = this.app.screen.height / 2;
		this.container.pivot.x = this.app.screen.width / 2;
		this.container.pivot.y = this.app.screen.height / 2;
	}

	// ── Tooltip ───────────────────────────────────────────────────────────────

	private showTooltip(point: Point) {
		this.hideTooltip(true);

		const PAD_X = 10;
		const PAD_Y = 8;
		const RADIUS = 6;
		const DOT_R = 5;
		const color = point.color ?? 0x6b7280;

		// ── Label text  (bold id) ─────────────────────────────────────────────
		const labelText = new Text({
			text: point.id,
			style: new TextStyle({
				fontSize: 13,
				fontWeight: '700',
				fontFamily: 'ui-monospace, monospace',
				fill: 0xf1f5f9
			})
		});

		// ── Sub text  (coordinates) ───────────────────────────────────────────
		const subText = new Text({
			text: `${point.position.x}, ${point.position.y}`,
			style: new TextStyle({
				fontSize: 11,
				fontFamily: 'ui-monospace, monospace',
				fill: 0x94a3b8
			})
		});

		// Layout
		const contentW = Math.max(labelText.width, subText.width) + DOT_R * 2 + 8;
		const contentH = labelText.height + subText.height + 2;
		const boxW = contentW + PAD_X * 2;
		const boxH = contentH + PAD_Y * 2;

		// ── Background card ───────────────────────────────────────────────────
		const bg = new Graphics()
			.roundRect(0, 0, boxW, boxH, RADIUS)
			.fill({ color: 0x0f172a, alpha: 0.92 })
			.stroke({ color: 0x334155, width: 1 });

		// ── Colored dot matching the point ────────────────────────────────────
		const dot = new Graphics()
			.circle(PAD_X + DOT_R, PAD_Y + labelText.height / 2, DOT_R)
			.fill(color);

		// Position texts
		const textX = PAD_X + DOT_R * 2 + 8;
		labelText.x = textX;
		labelText.y = PAD_Y;
		subText.x = textX;
		subText.y = PAD_Y + labelText.height + 2;

		// ── Caret (small triangle pointing down-left toward the point) ────────
		const caretSize = 6;
		const caret = new Graphics()
			.poly([0, 0, caretSize, 0, 0, caretSize])
			.fill({ color: 0x0f172a, alpha: 0.92 });
		caret.x = 12;
		caret.y = boxH - 1;

		// ── Assemble container ────────────────────────────────────────────────
		const tip = new Container();
		tip.addChild(bg, dot, labelText, subText, caret);

		// Position above-right of the point, nudge inward if near edge
		const px = point.position.x;
		const py = point.position.y;
		const sw = this.app.screen.width;

		let tx = px + 14;
		let ty = py - boxH - 10;

		// flip horizontally if too close to right edge
		if (tx + boxW > sw - 8) tx = px - boxW - 14;
		// flip vertically if above top edge
		if (ty < 8) ty = py + 14;

		tip.x = tx;
		tip.y = ty;
		tip.alpha = 0;

		this.container.addChild(tip);
		this.tooltip = tip;
		this.animateAlpha(tip, 0, 1, 150);
	}

	private hideTooltip(immediate = false) {
		if (!this.tooltip) return;
		const tip = this.tooltip;
		this.tooltip = null;

		if (immediate) {
			this.container.removeChild(tip);
			return;
		}

		this.animateAlpha(tip, 1, 0, 120, () => {
			this.container.removeChild(tip);
		});
	}

	private animateAlpha(
		target: Container,
		from: number,
		to: number,
		duration: number,
		onComplete?: () => void
	) {
		const start = performance.now();
		const animate = (time: number) => {
			const progress = Math.min((time - start) / duration, 1);
			// ease-out quad
			const eased = 1 - (1 - progress) * (1 - progress);
			target.alpha = from + (to - from) * eased;
			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				onComplete?.();
			}
		};
		requestAnimationFrame(animate);
	}
}
