export interface Vector2 {
	x: number;
	y: number;
}

export interface Point {
	id: string;
	position: Vector2;
	color?: number;
	radius?: number;
}

export interface Line {
	id: string;
	from: Vector2;
	to: Vector2;
	color?: number;
	width?: number;
}

export interface AlgorithmState {
	points: Point[];
	lines?: Line[];
	highlightedPointIds?: string[];
	description: string;
}
