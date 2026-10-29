export type Viseme = 'rest' | 'MBP' | 'AA' | 'EE' | 'OH' | 'OO' | 'wide' | 'grimace';
// Every mouth is the same 12-vertex closed topology; morphing never changes point count.
const specs: Record<Viseme, [
    number,
    number
]> = { rest: [8, 1], MBP: [7, 2], AA: [8, 10], EE: [13, 4], OH: [6, 10], OO: [4, 7], wide: [15, 9], grimace: [12, 2] };
export function points(v: Viseme) { const [w, h] = specs[v]; return Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return [Math.cos(a) * w, Math.sin(a) * h]; }); }
export function morph(a: Viseme, b: Viseme, t: number) { const x = points(a), y = points(b); return x.map((p, i) => p.map((n, j) => n + (y[i][j] - n) * t)); }
export function mouthPath(p: number[][]) { return 'M' + p.map(n => n.join(',')).join('L') + 'Z'; }
