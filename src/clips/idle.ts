import type { Pose } from '../rig/skeleton';
export function idle(time: number): Pose { return { 'spine1': { sy: 1 + Math.sin(time * 2.2) * .02 }, head: { rot: Math.sin(time * 1.3) * 2 } }; }
