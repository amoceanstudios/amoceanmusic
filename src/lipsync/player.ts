import type { Line } from './autoCues';
import type { Viseme } from '../rig/visemes';
export class Player {
    line: Line | null = null;
    time = 0;
    scripted = false;
    muted = true;
    audio: AudioContext | null = null;
    lastCue = -1;
    start(line: Line, scripted = false) { if (this.busy)
        return false; this.line = line; this.time = 0; this.scripted = scripted; this.lastCue = -1; return true; }
    get busy() { return this.line !== null; }
    step(dt: number) { if (!this.line)
        return; this.time += dt; if (this.time >= this.line.duration) {
        this.line = null;
        this.scripted = false;
    } }
    get viseme(): Viseme { if (!this.line)
        return 'rest'; let index = 0; this.line.cues.forEach((c, i) => { if (c.t <= this.time + 2 / 24)
        index = i; }); if (index !== this.lastCue) {
        this.lastCue = index;
        if (!this.muted && index % 2 === 0)
            this.babble(this.line.cues[index].v);
    } return this.line.cues[index].v; }
    async enable() { this.audio ??= new AudioContext(); await this.audio.resume(); this.muted = false; }
    babble(v: Viseme) { if (!this.audio || v === 'rest')
        return; const a = this.audio, o = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o.type = 'triangle'; o.frequency.value = 145 + Math.random() * 75; f.type = 'bandpass'; f.frequency.value = { AA: 900, EE: 2100, OH: 650, OO: 450, MBP: 350, wide: 1300, grimace: 1700, rest: 400 }[v]; f.Q.value = 3; g.gain.setValueAtTime(.035, a.currentTime); g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .065); o.connect(f); f.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + .07); }
}
