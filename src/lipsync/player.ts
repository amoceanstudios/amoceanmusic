import type { Line } from './autoCues';
import type { Viseme } from '../rig/visemes';
import bank from '../audio/voices.json';
import { soundscape, type VoiceHandle } from '../audio/engine';
type VoicedLine = Line & {
    audio?: string;
};
const voices = bank as Record<string, VoicedLine>;
/** Recorded speech and its phonemes share one AudioContext sample clock. */
export class Player {
    private current: VoicedLine | null = null;
    private silent = true;
    private handle: VoiceHandle | null = null;
    private ticket = 0;
    private waiting = false;
    private utterance: SpeechSynthesisUtterance | null = null;
    private nativeStarted = false;
    private nativeDone = false;
    private nativeWall = 0;
    time = 0;
    scripted = false;
    lastCue = -1;
    get line() { return this.current; }
    set line(value: Line | null) { if (value === null) {
        this.cancelAudio();
        this.current = null;
        this.scripted = false;
    }
    else
        this.current = value; }
    get muted() { return this.silent; }
    set muted(value: boolean) { this.silent = value; if (value) {
        this.cancelAudio();
        soundscape.disable();
    } }
    get audio() { return soundscape.context; }
    get busy() { return this.current !== null; }
    get voiceMode() { return this.handle ? 'recorded' : this.utterance ? 'device' : this.waiting ? 'loading' : this.silent ? 'silent' : 'unavailable'; }
    start(line: Line, scripted = false) { if (this.busy)
        return false; this.current = voices[line.text] || line; this.time = 0; this.scripted = scripted; this.lastCue = -1; if (!this.silent)
        void this.play(); return true; }
    private cancelAudio() { this.ticket++; this.waiting = false; this.handle?.stop(); this.handle = null; if (this.utterance && 'speechSynthesis' in window) {
        this.utterance.onend = null;
        this.utterance.onerror = null;
        window.speechSynthesis.cancel();
    } this.utterance = null; this.nativeStarted = false; soundscape.setNativeSpeaking(false); }
    private async play() {
        if (!this.current || this.silent)
            return;
        this.cancelAudio();
        const ticket = this.ticket, line = this.current;
        this.waiting = true;
        try {
            if (!line.audio)
                throw new Error('Use device voice');
            const handle = await soundscape.voice(line.audio, this.time, () => ticket === this.ticket && !this.silent && this.current === line);
            if (ticket !== this.ticket || this.silent) {
                handle.stop();
                return;
            }
            this.handle = handle;
            this.waiting = false;
        }
        catch {
            if (ticket !== this.ticket || this.silent)
                return;
            this.waiting = false;
            this.deviceVoice(line);
        }
    }
    private deviceVoice(line: VoicedLine) { if (!('speechSynthesis' in window))
        return; const local = window.speechSynthesis.getVoices().filter(v => v.localService); const voice = local.find(v => /^en[-_]/i.test(v.lang)) || local[0]; if (!voice)
        return; const utterance = new SpeechSynthesisUtterance(line.text); utterance.voice = voice; utterance.lang = voice.lang; utterance.pitch = 1.35; utterance.rate = 1.06; utterance.volume = soundscape.levels.master * soundscape.levels.voice; this.utterance = utterance; this.nativeStarted = false; this.nativeDone = false; this.nativeWall = 0; utterance.onstart = () => { this.nativeStarted = true; soundscape.setNativeSpeaking(true); }; utterance.onend = () => { this.nativeDone = true; soundscape.setNativeSpeaking(false); }; utterance.onerror = () => { this.nativeDone = true; soundscape.setNativeSpeaking(false); }; utterance.onboundary = event => { if (!this.current)
        return; const ratio = event.charIndex / Math.max(1, line.text.length); this.time = Math.min(line.duration - .05, line.duration * ratio); }; window.speechSynthesis.speak(utterance); }
    async enable() { await soundscape.enable(); this.silent = false; if (this.busy) {
        this.time = 0;
        await this.play();
    } }
    step(dt: number) {
        if (!this.current)
            return;
        if (this.waiting)
            return;
        if (this.handle) {
            this.time = this.handle.time();
            if (this.handle.done() && this.time >= this.current.duration - .12)
                this.finish();
            return;
        }
        if (this.utterance) {
            this.nativeWall += dt;
            if (this.nativeDone) {
                this.finish();
                return;
            }
            if (!this.nativeStarted && this.nativeWall < 2)
                return;
            if (this.nativeWall > Math.max(15, this.current.duration * 2.5)) {
                this.cancelAudio();
                this.finish();
                return;
            }
            this.time = Math.min(this.current.duration - .08, this.time + dt);
            return;
        }
        this.time += dt;
        if (this.time >= this.current.duration)
            this.finish();
    }
    private finish() { this.line = null; this.time = 0; }
    get viseme(): Viseme { if (!this.current)
        return 'rest'; let index = 0; const lead = this.handle ? .025 : 2 / 24; this.current.cues.forEach((cue, i) => { if (cue.t <= this.time + lead)
        index = i; }); this.lastCue = index; return this.current.cues[index].v; }
}
