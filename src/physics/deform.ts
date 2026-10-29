import { clamp } from './path';
export function deform(vx: number, vy: number) { const speed = Math.hypot(vx, vy), s = clamp(1 + speed * .0025, 1, 1.6); return { sx: s, sy: 1 / s, angle: Math.atan2(vy, vx) * 180 / Math.PI, bank: clamp(vx * .04, -25, 25), speed }; }
