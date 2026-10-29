import type { Viseme } from '../rig/visemes';
export type Cue = {
    t: number;
    v: Viseme;
};
export type Line = {
    text: string;
    duration: number;
    cues: Cue[];
};
export function autoCues(text: string): Line { const cues: Cue[] = [{ t: 0, v: 'rest' }]; let t = .12; const map: Record<string, Viseme> = { a: 'AA', e: 'EE', i: 'EE', o: 'OH', u: 'OO', y: 'EE', m: 'MBP', b: 'MBP', p: 'MBP', f: 'grimace', v: 'grimace', w: 'OO' }; for (const word of text.split(/\s+/)) {
    for (const ch of word.toLowerCase()) {
        if (/[a-z]/.test(ch)) {
            cues.push({ t: +t.toFixed(3), v: map[ch] || 'rest' });
            t += 1 / 12;
        }
        else if (/[,.!?]/.test(ch)) {
            cues.push({ t: +t.toFixed(3), v: 'rest' });
            t += /[.!?]/.test(ch) ? .22 : .12;
        }
    }
    t += .055;
} cues.push({ t: +t.toFixed(3), v: 'rest' }); return { text, duration: t + .15, cues }; }
