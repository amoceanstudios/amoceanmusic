export type Sfx = 'click' | 'hover' | 'focus' | 'type' | 'whoosh' | 'reveal' | 'land' | 'recoil' | 'spin' | 'book-open' | 'page' | 'book-close' | 'tie' | 'success' | 'error' | 'copy' | 'nav' | 'farewell';
export type Channel = 'master' | 'music' | 'voice' | 'sfx';
export type VoiceHandle = {
    time: () => number;
    done: () => boolean;
    stop: () => void;
};
const defaults = { master: .70, music: .40, voice: .90, sfx: .65 };
const harmonies = [[50, 57, 62, 65], [50, 57, 62, 69], [46, 53, 58, 62], [48, 55, 60, 64], [53, 60, 65, 69], [50, 57, 62, 65]];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
export class Soundscape {
    context: AudioContext | null = null;
    enabled = false;
    scene = 0;
    levels = { ...defaults };
    private master!: GainNode;
    private buses!: Record<'music' | 'voice' | 'sfx', GainNode>;
    private duck!: GainNode;
    private analyser!: AnalyserNode;
    private outputAnalyser!: AnalyserNode;
    private outputSamples: Float32Array<ArrayBuffer> = new Float32Array(256);
    private outputEnergy = 0;
    private samples: Float32Array<ArrayBuffer> = new Float32Array(256);
    private noise!: AudioBuffer;
    private reverb!: ConvolverNode;
    private flightGain!: GainNode;
    private flightFilter!: BiquadFilterNode;
    private buffers = new Map<string, Promise<AudioBuffer>>();
    private cooldown = new Map<string, number>();
    private pulses: {
        at: number;
        amount: number;
    }[] = [];
    private nextBeat = 0;
    private beat = 0;
    private sceneAt = 0;
    private voiceActive = false;
    private voiceSource: AudioBufferSourceNode | null = null;
    private hidden = false;
    private speakingNative = false;
    private lastLevel = 0;
    events: {
        name: string;
        at: number;
        scene: number;
    }[] = [];
    onEffect: ((s: Sfx, amount: number) => void) | null = null;
    energy = 0;
    constructor() { try {
        const saved = JSON.parse(localStorage.getItem('motion-music-mix') || 'null');
        for (const k of Object.keys(defaults) as Channel[])
            if (typeof saved?.[k] === 'number')
                this.levels[k] = Math.max(0, Math.min(1, saved[k]));
    }
    catch { } }
    async enable() { if (!this.context)
        this.create(); await this.context!.resume(); this.enabled = true; this.hidden = false; this.master.gain.cancelScheduledValues(this.now); this.master.gain.setTargetAtTime(this.levels.master, this.now, .08); this.nextBeat = this.now + .07; this.beat = 0; this.event('reveal', 0, .6); }
    disable() { this.enabled = false; this.pulses = []; this.energy = 0; this.outputEnergy = 0; if (this.context) {
        this.master.gain.cancelScheduledValues(this.now);
        this.master.gain.setTargetAtTime(0, this.now, .035);
    } this.stopVoice(); this.setNativeSpeaking(false); }
    get now() { return this.context?.currentTime || 0; }
    get available() { return this.enabled && this.context?.state === 'running' && !this.hidden; }
    private create() {
        const a = this.context = new AudioContext(), master = this.master = a.createGain(), limiter = a.createDynamicsCompressor();
        master.gain.value = 0;
        limiter.threshold.value = -8;
        limiter.knee.value = 4;
        limiter.ratio.value = 12;
        limiter.attack.value = .003;
        limiter.release.value = .12;
        master.connect(limiter);
        this.outputAnalyser = a.createAnalyser();
        this.outputAnalyser.fftSize = 512;
        limiter.connect(this.outputAnalyser);
        this.outputAnalyser.connect(a.destination);
        this.duck = a.createGain();
        this.duck.gain.value = 1;
        this.buses = { music: a.createGain(), voice: a.createGain(), sfx: a.createGain() };
        this.buses.music.connect(this.duck);
        this.duck.connect(master);
        this.buses.sfx.connect(master);
        this.analyser = a.createAnalyser();
        this.analyser.fftSize = 512;
        this.buses.voice.connect(this.analyser);
        this.analyser.connect(master);
        for (const k of ['music', 'voice', 'sfx'] as const)
            this.buses[k].gain.value = this.levels[k];
        this.noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
        const n = this.noise.getChannelData(0);
        for (let i = 0; i < n.length; i++)
            n[i] = (Math.random() * 2 - 1) * .6;
        this.reverb = a.createConvolver();
        const impulse = a.createBuffer(2, a.sampleRate * .85, a.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < data.length; i++)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3) * .18;
        }
        this.reverb.buffer = impulse;
        const wet = a.createGain();
        wet.gain.value = .22;
        this.reverb.connect(wet);
        wet.connect(master);
        this.duck.connect(this.reverb);
        this.buses.sfx.connect(this.reverb);
        const wind = a.createBufferSource();
        wind.buffer = this.noise;
        wind.loop = true;
        this.flightFilter = a.createBiquadFilter();
        this.flightFilter.type = 'bandpass';
        this.flightFilter.frequency.value = 650;
        this.flightFilter.Q.value = .65;
        this.flightGain = a.createGain();
        this.flightGain.gain.value = 0;
        wind.connect(this.flightFilter);
        this.flightFilter.connect(this.flightGain);
        this.flightGain.connect(this.buses.sfx);
        wind.start();
    }
    setLevel(channel: Channel, value: number) { this.levels[channel] = Math.max(0, Math.min(1, value)); if (this.context) {
        const node = channel === 'master' ? this.master : this.buses[channel];
        node.gain.setTargetAtTime(channel === 'master' && !this.enabled ? 0 : this.levels[channel], this.now, .04);
    } try {
        localStorage.setItem('motion-music-mix', JSON.stringify(this.levels));
    }
    catch { } }
    setScene(index: number) { if (this.scene === index)
        return; this.scene = index; this.sceneAt = this.now; this.pulses = []; this.beat = 0; if (this.context)
        this.nextBeat = this.now + .06; this.event(index === 5 ? 'farewell' : 'reveal', 0, .55); }
    setNativeSpeaking(value: boolean) { this.speakingNative = value; }
    private duckVoice(value: boolean) { if (this.voiceActive === value)
        return; this.voiceActive = value; this.duck.gain.setTargetAtTime(value ? .26 : 1, this.now, value ? .07 : .35); }
    async buffer(url: string) { if (!this.context)
        throw new Error('Audio not enabled'); let result = this.buffers.get(url); if (!result) {
        const decode = async (src: string) => { const r = await fetch(src); if (!r.ok)
            throw new Error('Voice asset unavailable'); return this.context!.decodeAudioData(await r.arrayBuffer()); };
        result = decode(url).catch(error => { if (url.endsWith('.ogg'))
            return decode(url.replace(/\.ogg$/, '.mp3')); throw error; });
        this.buffers.set(url, result);
        result.catch(() => this.buffers.delete(url));
    } return result; }
    async voice(url: string, offset = 0, valid = () => true): Promise<VoiceHandle> { const buffer = await this.buffer(url); if (!this.available || !valid())
        throw new Error('Audio disabled or superseded'); this.stopVoice(); const a = this.context!, source = a.createBufferSource(); source.buffer = buffer; source.connect(this.buses.voice); const start = a.currentTime + .025; let done = false; this.voiceSource = source; source.onended = () => { done = true; if (this.voiceSource === source)
        this.voiceSource = null; }; const safeOffset = Math.max(0, Math.min(buffer.duration - .01, offset)); source.start(start, safeOffset); return { time: () => Math.min(buffer.duration, safeOffset + Math.max(0, a.currentTime - start)), done: () => done, stop: () => { if (!done) {
            try {
                source.stop();
            }
            catch { }
            done = true;
        } if (this.voiceSource === source)
            this.voiceSource = null; } }; }
    stopVoice() { if (this.voiceSource) {
        try {
            this.voiceSource.stop();
        }
        catch { }
        this.voiceSource = null;
    } }
    async visibility(hidden: boolean) { this.hidden = hidden; if (!this.context || !this.enabled)
        return; if (hidden)
        await this.context.suspend();
    else {
        await this.context.resume();
        this.nextBeat = this.now + .05;
    } }
    private tone(freq: number, start: number, duration: number, gain: number, type: OscillatorType = 'sine', pan = 0, endFreq?: number, bus: 'music' | 'sfx' = 'sfx') { if (!this.context)
        return; const a = this.context, o = a.createOscillator(), g = a.createGain(), p = a.createStereoPanner(); o.type = type; o.frequency.setValueAtTime(Math.max(20, freq), start); if (endFreq)
        o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration); g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + Math.min(.018, duration * .15)); g.gain.exponentialRampToValueAtTime(.0001, start + duration); p.pan.value = Math.max(-1, Math.min(1, pan)); o.connect(g); g.connect(p); p.connect(this.buses[bus]); o.start(start); o.stop(start + duration + .02); o.onended = () => { o.disconnect(); g.disconnect(); p.disconnect(); }; }
    private breath(start: number, duration: number, gain: number, pan: number, from = 300, to = 2400) { const a = this.context!, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), p = a.createStereoPanner(); s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(from, start); f.frequency.exponentialRampToValueAtTime(to, start + duration); g.gain.setValueAtTime(.0001, start); g.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + duration * .48); g.gain.exponentialRampToValueAtTime(.0001, start + duration); p.pan.value = Math.max(-1, Math.min(1, pan)); s.connect(f); f.connect(g); g.connect(p); p.connect(this.buses.sfx); s.start(start); s.stop(start + duration); s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); }; }
    event(name: Sfx, pan = 0, amount = 1) { if (!this.available)
        return; const now = this.now, cooldown = name === 'hover' ? .12 : name === 'type' ? .055 : name === 'whoosh' ? .28 : .07; if (now - (this.cooldown.get(name) ?? -99) < cooldown)
        return; this.cooldown.set(name, now); this.events.push({ name, at: now, scene: this.scene }); if (this.events.length > 80)
        this.events.shift(); this.onEffect?.(name, amount); const t = now + .006, a = Math.max(.05, Math.min(1.6, amount)); switch (name) {
        case 'click':
            this.tone(970, t, .045, .095 * a, 'sine', pan, 660);
            this.tone(1900, t, .025, .025 * a, 'triangle', pan);
            break;
        case 'hover':
        case 'focus':
            this.tone(name === 'focus' ? 780 : 1280, t, .055, .027 * a, 'sine', pan, 1100);
            break;
        case 'type':
            this.breath(t, .022, .027 * a, pan, 3200, 1700);
            break;
        case 'whoosh':
            this.breath(t, .31, .32 * a, pan, 240, 3300);
            this.tone(170, t, .24, .03 * a, 'sine', pan, 390);
            break;
        case 'spin':
            this.breath(t, .75, .28 * a, pan, 280, 1800);
            [0, .13, .26].forEach((d, i) => this.tone(240 + i * 90, t + d, .19, .04 * a, 'triangle', pan, 600));
            break;
        case 'reveal':
        case 'nav':
            [0, 7, 12].forEach((n, i) => this.tone(midi(74 + n), t + i * .055, .55, .065 * a, 'sine', pan));
            this.breath(t, .24, .08 * a, pan, 600, 4200);
            break;
        case 'land':
            this.tone(125, t, .18, .27 * a, 'sine', pan, 42);
            this.breath(t, .085, .14 * a, pan, 500, 160);
            break;
        case 'recoil':
            this.tone(145, t, .32, .12 * a, 'triangle', pan, 650);
            this.tone(620, t + .07, .22, .045 * a, 'sine', pan, 220);
            break;
        case 'book-open':
            this.breath(t, .23, .18 * a, pan, 400, 2400);
            this.tone(430, t + .11, .06, .035 * a, 'triangle', pan);
            break;
        case 'page':
        case 'tie':
            this.breath(t, name === 'page' ? .19 : .13, .13 * a, pan, 1800, 700);
            break;
        case 'book-close':
            this.breath(t, .055, .25 * a, pan, 1200, 240);
            this.tone(170, t, .09, .12 * a, 'triangle', pan, 70);
            break;
        case 'success':
            [74, 78, 81, 86].forEach((n, i) => this.tone(midi(n), t + i * .09, .48, .095 * a, 'sine', pan));
            break;
        case 'error':
            this.tone(270, t, .11, .08 * a, 'triangle', pan, 200);
            this.tone(230, t + .13, .12, .06 * a, 'sine', pan, 170);
            break;
        case 'copy':
            this.tone(1050, t, .07, .07 * a, 'sine', pan);
            this.tone(1580, t + .07, .16, .05 * a, 'sine', pan);
            break;
        case 'farewell':
            [77, 74, 69, 62].forEach((n, i) => this.tone(midi(n), t + i * .15, .85, .07 * a, 'sine', pan));
            break;
    } }
    tick(speed: number, pan: number, spinning: boolean) {
        if (!this.available)
            return;
        const a = this.context!, now = a.currentTime;
        this.duckVoice(!!this.voiceSource || this.speakingNative);
        const wind = Math.min(.12, speed / 6000) + (spinning ? .055 : 0);
        this.flightGain.gain.setTargetAtTime(wind, now, .08);
        this.flightFilter.frequency.setTargetAtTime(350 + Math.min(2700, speed * 1.8), now, .1);
        this.analyser.getFloatTimeDomainData(this.samples);
        let sum = 0;
        for (const n of this.samples)
            sum += n * n;
        this.lastLevel = Math.min(1, Math.sqrt(sum / this.samples.length) * 6);
        this.energy += (this.lastLevel - this.energy) * .28;
        this.outputAnalyser.getFloatTimeDomainData(this.outputSamples);
        let outputSum = 0;
        for (const n of this.outputSamples)
            outputSum += n * n;
        this.outputEnergy = Math.sqrt(outputSum / this.outputSamples.length);
        for (const pulse of this.pulses.filter(p => p.at <= now + .02))
            this.onEffect?.('reveal', pulse.amount);
        this.pulses = this.pulses.filter(p => p.at > now + .02);
        if (this.nextBeat < now - .5)
            this.nextBeat = now + .04;
        const interval = this.scene === 2 || this.scene === 5 ? .56 : .43;
        while (this.nextBeat < now + .12) {
            const t = this.nextBeat, beat = this.beat++, chord = harmonies[this.scene], fade = this.scene === 5 ? Math.max(.06, Math.exp(-(now - this.sceneAt) * .2)) : 1;
            this.pulses.push({ at: t, amount: .25 * this.levels.music * fade });
            const note = chord[[0, 2, 1, 3, 2, 1, 3, 2][beat % 8]];
            this.tone(midi(note + 12), t, 1.2, .033 * fade, 'sine', (beat % 2 ? 1 : -1) * .5, undefined, 'music');
            this.tone(midi(note + 24), t, .62, .007 * fade, 'triangle', -.25, undefined, 'music');
            if (beat % 4 === 0) {
                this.tone(midi(chord[0] - 12), t, 1.7, .11 * fade, 'sine', 0, undefined, 'music');
                for (const n of chord)
                    this.tone(midi(n), t, 2.8, .012 * fade, 'sine', 0, undefined, 'music');
            }
            if (this.scene === 1 || this.scene === 3) {
                if (beat % 2 === 0)
                    this.tone(95, t, .14, .045, 'sine', 0, 38, 'music');
            }
            this.nextBeat += interval;
        }
    }
    get diagnostics() { return { enabled: this.enabled, state: this.context?.state || 'not-started', scene: this.scene, voiceActive: !!this.voiceSource, ducked: this.voiceActive, energy: this.energy, outputEnergy: this.outputEnergy, levels: { ...this.levels }, cachedVoices: this.buffers.size, events: [...this.events] }; }
}
export const soundscape = new Soundscape();
