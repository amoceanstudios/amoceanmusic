import type { Clip } from '../clips/types';
import type { Pose } from '../rig/skeleton';
import { load } from '../clips/load';
import { header } from '../clips/header';
import { about } from '../clips/about';
import { portfolio } from '../clips/portfolio';
import { contact } from '../clips/contact';
import { bye } from '../clips/bye';
import { clamp } from '../physics/path';
export const clips = [load, header, about, portfolio, contact, bye];
export function sample(clip: Clip, t: number): Pose { let i = 0; while (i < clip.keys.length - 2 && clip.keys[i + 1].t <= t)
    i++; const a = clip.keys[i], b = clip.keys[i + 1]; let u = clamp((t - a.t) / (b.t - a.t)); if (a.ease === 'hold')
    u = 0;
else if (a.ease === 'elastic')
    u = u === 0 || u === 1 ? u : 1 - Math.pow(2, -7 * u) * Math.cos(u * 10);
else if (a.ease !== 'linear')
    u = u * u * (3 - 2 * u); const out: Pose = {}; for (const id of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
    out[id] = {};
    for (const key of ['rot', 'sx', 'sy', 'tx', 'ty'] as const) {
        const fallback = key === 'sx' || key === 'sy' ? 1 : 0;
        const x = a.pose[id]?.[key] ?? fallback, y = b.pose[id]?.[key] ?? fallback;
        out[id][key] = x + (y - x) * u;
    }
} return out; }
