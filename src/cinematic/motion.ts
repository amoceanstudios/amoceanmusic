import { Spring } from '../physics/spring';
import type { Pose } from '../rig/skeleton';
import type { StageFrame } from './staging';
/** Secondary offsets are additive: existing scene and task poses remain authoritative. */
export class CinematicMotion {
    private arms = [new Spring(0, 48, 7), new Spring(0, 40, 6)];
    private neck = new Spring(0, 65, 9);
    apply(pose: Pose, shot: StageFrame, time: number, vx: number, vy: number, reduced: boolean, working: boolean) { if (reduced) {
        this.arms.forEach(s => s.reset(0));
        this.neck.reset(0);
        return;
    } const add = (bone: string, key: 'rot' | 'tx' | 'ty', v: number) => { pose[bone] = { ...pose[bone], [key]: (pose[bone]?.[key] || 0) + v }; }; const stretch = shot.travel; add('spine1', 'rot', -shot.anticipation * 9 + stretch * 8); add('spine2', 'rot', shot.anticipation * 12 - stretch * 11); add('hips', 'ty', shot.anticipation * 5); for (let j = 0; j < 2; j++) {
        const target = Math.max(-18, Math.min(18, vx * .025 + vy * .008)) * (j ? 1 : -1);
        const lag = this.arms[j];
        for (let n = 0; n < 4; n++)
            lag.step(target, 1 / 96);
        if (!working) {
            add('upperArm.' + (j ? 'R' : 'L'), 'rot', lag.value);
            add('foreArm.' + (j ? 'R' : 'L'), 'rot', lag.value * .45 + Math.sin(time * 2.3 + j) * 2);
            add('hand.' + (j ? 'R' : 'L'), 'rot', Math.sin(time * 2.1 + j) * 2);
        }
    } for (let n = 0; n < 4; n++)
        this.neck.step(-vx * .008, 1 / 96); add('neck', 'rot', Math.max(-6, Math.min(6, this.neck.value))); add('head', 'rot', Math.sin(time * .8) * 1.2); add('earR', 'rot', Math.sin(time * 3.1) * 1.7); add('foot.L', 'rot', Math.sin(time * 1.7) * 1.1); add('foot.R', 'rot', Math.sin(time * 1.7 + .8) * 1.1); add('browL', 'ty', Math.sin(time * .7) * .5); }
}
