export const showLines = [{ at: 4.7, text: 'Ta-da! Actual depth. I knew I had another dimension in me.' }, { at: 10.4, text: 'Gravity and I have a complicated relationship. Mostly long distance.' }, { at: 17.2, text: 'See this handsome face? Click it. Calculator, notes, timers, or a big idea. I am your shortcut.' }];
export class ShowDirector {
    time = 0;
    private said = new Set<number>();
    private effects = new Set<number>();
    reset() { this.time = 0; this.said.clear(); this.effects.clear(); }
    step(dt: number, active: boolean, reduced: boolean) {
        if (active)
            this.time += Math.min(dt, .05);
    }
    line(busy: boolean) {
        if (busy)
            return null;
        const i = showLines.findIndex((l, i) => this.time >= l.at && !this.said.has(i));
        if (i < 0)
            return null;
        this.said.add(i);
        return showLines[i].text;
    }
    effect() {
        const beats = [.4, 2.6, 7.8, 10.1, 16.5];
        const i = beats.findIndex((t, i) => this.time >= t && !this.effects.has(i));
        if (i < 0)
            return null;
        this.effects.add(i);
        return ['spin', 'land', 'whoosh', 'recoil', 'reveal'][i] as 'spin' | 'land' | 'whoosh' | 'recoil' | 'reveal';
    }
    get shot() { return this.time < 3 ? 'arrival' : this.time < 7.5 ? 'hero' : this.time < 10 ? 'flyby' : this.time < 16 ? 'double-take' : this.time < 24 ? 'invitation' : 'hold'; }
}
export const sceneRemarks: Record<number, string> = { 1: 'Close call. I almost became a letter. Click me before I become punctuation.', 2: 'A book! Finally, a screen with absolutely no battery anxiety.', 3: 'Look around. I will be right here, pretending I am not showing off.', 4: 'I put on a tie. That is how seriously I take your brilliant ideas.', 5: 'Dramatic exit! Do not worry. The little portal is my return ticket.' };
