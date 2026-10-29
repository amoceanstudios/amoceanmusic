export type Point = {
    x: number;
    y: number;
};
export const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function catmull(points: Point[], t: number): Point { const n = points.length - 1, u = clamp(t) * n, i = Math.min(n - 1, Math.floor(u)), f = u - i, p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(n, i + 2)]; const value = (k: 'x' | 'y') => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f); return { x: value('x'), y: value('y') }; }
export type Box = {
    left: number;
    top: number;
    right: number;
    bottom: number;
};
export function intersects(p: Point, b: Box, w: number, h: number) { return p.x + w > b.left && p.x - w < b.right && p.y + h > b.top && p.y - h < b.bottom; }
export function safeAnchor(desired: Point, boxes: Box[], w: number, h: number, width: number, height: number) { const free = (p: Point) => !boxes.some(b => intersects(p, b, w, h)); if (free(desired))
    return desired; const candidates: Point[] = []; for (let y = h + 85; y < height - h - 15; y += 40)
    for (let x = w + 10; x < width - w - 10; x += 40)
        candidates.push({ x, y }); return candidates.filter(free).sort((a, b) => Math.hypot(a.x - desired.x, a.y - desired.y) - Math.hypot(b.x - desired.x, b.y - desired.y))[0] || { x: width - w - 10, y: height - h - 15 }; }
