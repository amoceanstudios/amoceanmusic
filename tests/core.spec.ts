import { test, expect } from '@playwright/test';
import { autoCues } from '../src/lipsync/autoCues';
import { catmull, safeAnchor, intersects } from '../src/physics/path';
import { Spring } from '../src/physics/spring';
import { LocalBrain } from '../src/assistant/brain';
import { rules } from '../src/assistant/rules';
import { intent } from '../src/assistant/intents';
import { points } from '../src/rig/visemes';
import { sample, clips } from '../src/scenes/director';
const signal = () => ({ section: 2, progress: .5, speed: 0, direction: 0, changes: 0, idle: 0, hoverText: '', hoverTime: 0, invalidEmail: false, emptyMessage: false, selection: '', reduced: false, width: 1440, visits: 1, focused: '', validation: '', blurred: '' });
test('spring overshoots then settles without instability', () => { const s = new Spring(); let max = 0; for (let i = 0; i < 1000; i++) {
    s.step(100, 1 / 120);
    max = Math.max(max, s.value);
} expect(max).toBeGreaterThan(100); expect(s.value).toBeCloseTo(100, 5); });
test('Catmull endpoints and obstacle avoidance', () => { const p = [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }]; expect(catmull(p, 0)).toEqual(p[0]); expect(catmull(p, 1)).toEqual(p[2]); const b = { left: 100, top: 100, right: 300, bottom: 300 }, f = safeAnchor({ x: 200, y: 200 }, [b], 30, 60, 800, 700); expect(intersects(f, b, 30, 60)).toBe(false); });
test('visemes share topology; cues are monotonic and close', () => { const l = autoCues('Welcome to motion music!'); expect(l.cues.length).toBeGreaterThan(15); expect(l.cues.at(-1)?.v).toBe('rest'); for (let i = 1; i < l.cues.length; i++)
    expect(l.cues[i].t).toBeGreaterThan(l.cues[i - 1].t); for (const v of ['rest', 'MBP', 'AA', 'EE', 'OH', 'OO', 'wide', 'grimace'] as const)
    expect(points(v)).toHaveLength(12); });
test('at least four rules produce undoable local actions and honor cooldown', () => { for (const [id, patch] of [['idle', { idle: 9 }], ['nav', { changes: 3 }], ['hover', { hoverTime: 2, hoverText: 'Hello' }], ['email', { invalidEmail: true }], ['message', { emptyMessage: true }], ['selection', { selection: 'text' }]] as const) {
    const b = new LocalBrain();
    b.now = 10;
    b.observe({ ...signal(), ...patch });
    const a = b.decide();
    expect(a?.id).toBe(id);
    expect(b.decide()).toBeNull();
    b.now = 10 + rules.find(r => r.id === id)!.cooldown;
    expect(b.decide()).not.toBeNull();
} expect(rules.every(r => r.cooldown >= 20)).toBe(true); });
test('quiet blocks proactive rules; fuzzy intent matching stays local', async () => { const b = new LocalBrain(); b.quiet = true; b.observe({ ...signal(), idle: 20 }); expect(b.decide()).toBeNull(); expect((await b.ask('go to abotu')).intent).toBe('unknown'); expect(intent('go to abot').target).toBe('about'); expect(intent('copy email').intent).toBe('copy-email'); expect(intent('nonsense').text).toContain('Try:'); });
test('all clips scrub repeatably in either direction', () => { for (const clip of clips) {
    const first = sample(clip, .2);
    sample(clip, .9);
    expect(sample(clip, .2)).toEqual(first);
    for (const p of Object.values(sample(clip, .6)))
        for (const n of Object.values(p))
            expect(Number.isFinite(n)).toBe(true);
} });
