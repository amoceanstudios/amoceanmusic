import { soundscape, type Sfx } from './engine';
const marks: {
    p: number;
    s: Sfx;
    strength?: number;
}[][] = [
    [{ p: .01, s: 'spin' }, { p: .52, s: 'land' }, { p: .57, s: 'recoil', strength: .6 }],
    [{ p: .17, s: 'recoil', strength: .4 }, { p: .35, s: 'whoosh' }, { p: .49, s: 'land', strength: .6 }, { p: .76, s: 'recoil' }],
    [{ p: .20, s: 'land' }, { p: .38, s: 'book-open' }, { p: .55, s: 'page' }, { p: .85, s: 'book-close' }, { p: .94, s: 'recoil', strength: .4 }],
    [], [{ p: .22, s: 'tie' }], [{ p: .58, s: 'whoosh', strength: .4 }, { p: .94, s: 'reveal', strength: .2 }]
];
export class AudioBeats {
    private scene = -1;
    private progress = 0;
    private triggered = new Set<number>();
    reset() { this.scene = -1; this.progress = 0; this.triggered.clear(); }
    update(scene: number, progress: number, pan: number, reduced: boolean) { if (scene !== this.scene) {
        this.scene = scene;
        this.progress = 0;
        this.triggered.clear();
        soundscape.setScene(scene);
    } const crossed = marks[scene].map((m, i) => ({ ...m, i })).filter(m => !this.triggered.has(m.i) && progress >= m.p && this.progress < m.p); if (crossed.length) {
        const selected = progress - this.progress > .25 ? crossed.slice(-1) : crossed;
        for (const m of crossed)
            this.triggered.add(m.i);
        if (!reduced)
            for (const m of selected)
                soundscape.event(m.s, pan, m.strength ?? 1);
    } this.progress = progress; }
}
