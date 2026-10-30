import { clamp, type Point } from '../physics/path';
import { Spring } from '../physics/spring';
export type StageInput = {
    scene: number;
    target: Point;
    position: Point;
    width: number;
    height: number;
    close: boolean;
    focus: boolean;
    manual: boolean;
    minimized: boolean;
    reduced: boolean;
    scrollSpeed: number;
};
export type StageFrame = {
    target: Point;
    scale: number;
    blur: number;
    far: boolean;
    anticipation: number;
    travel: number;
    portal: Point;
    portalOpacity: number;
    justLaunched: boolean;
    exiting: boolean;
};
const vectors = [{ x: 1, y: -1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: -1 }];
const smooth = (t: number) => t * t * (3 - 2 * t);
/** A single shot director: wind-up → curved travel in depth → settle/hold. */
export class Staging {
    private minimized = false;
    private exitAge = 9;
    private exitFrom: Point = { x: 0, y: 0 };
    private scene = -1;
    private elapsed = 0;
    private from: Point = { x: 0, y: 0 };
    private origin: Point = { x: 0, y: 0 };
    private first = true;
    private launched = false;
    private focus = new Spring(1, 65, 13);
    private restart = false;
    last: StageFrame | null = null;
    reenter() { this.restart = true; }
    step(input: StageInput, dt: number): StageFrame {
        const i = input;
        if (i.minimized && !this.minimized) {
            this.exitAge = 0;
            this.exitFrom = { ...i.position };
        }
        if (!i.minimized)
            this.exitAge = 9;
        this.minimized = i.minimized;
        this.exitAge += dt;
        const exiting = i.minimized && !i.reduced && this.exitAge < .22;
        if (i.scene !== this.scene || this.restart) {
            const v = vectors[i.scene % vectors.length];
            this.first = this.scene < 0 || this.restart;
            this.scene = i.scene;
            this.restart = false;
            this.elapsed = 0;
            this.launched = false;
            this.from = this.first ? { x: clamp(i.target.x + v.x * i.width * .32, 35, i.width - 35), y: clamp(i.target.y + v.y * i.height * .30, 110, i.height - 100) } : { ...i.position };
            this.origin = { ...this.from };
        }
        this.elapsed += dt;
        const quiet = i.reduced || i.minimized || i.manual || i.close;
        const age = this.elapsed, u = clamp((age - .22) / 1.45), ease = smooth(u), v = vectors[this.scene % vectors.length];
        const wind = age < .22 ? Math.sin(clamp(age / .22) * Math.PI) : 0;
        const active = !quiet && u < 1;
        let target = { ...i.target };
        let distanceScale = 1;
        if (active) {
            const arc = Math.sin(u * Math.PI);
            target = { x: this.from.x + (i.target.x - this.from.x) * ease + v.y * arc * Math.min(80, i.width * .09) - v.x * wind * 12, y: this.from.y + (i.target.y - this.from.y) * ease - arc * Math.min(105, i.height * .14) - v.y * wind * 10 };
            distanceScale = this.first ? .035 + .965 * ease : 1 - .48 * Math.sin(u * Math.PI);
            distanceScale *= 1 + Math.sin(u * Math.PI * 3) * .055;
        }
        const focusGoal = i.focus && !i.minimized && !i.close ? (i.width < 650 ? 1.04 : 1.24) : 1;
        if (i.reduced)
            this.focus.reset(1);
        else
            for (let n = 0; n < 4; n++)
                this.focus.step(focusGoal, dt / 4);
        if (!quiet) {
            target.x += clamp(i.scrollSpeed * .002, -8, 8) * (1 - distanceScale);
            target.y += Math.sin(age * 2.2) * 2 * (1 - distanceScale);
        }
        if (exiting) {
            const e = smooth(clamp(this.exitAge / .22));
            target = { x: this.exitFrom.x + (i.width - 35 - this.exitFrom.x) * e, y: this.exitFrom.y + (i.height - 50 - this.exitFrom.y) * e - Math.sin(e * Math.PI) * 60 };
            distanceScale = Math.max(.003, 1 - e);
        }
        const launch = active && age >= .22 && !this.launched;
        if (launch)
            this.launched = true;
        return this.last = { target, scale: exiting ? distanceScale : quiet ? 1 : distanceScale * this.focus.value, blur: quiet ? 0 : Math.max(0, 1 - distanceScale) * 2.3, far: active && distanceScale < .72, anticipation: quiet ? 0 : wind, travel: active ? Math.sin(u * Math.PI) : 0, portal: this.origin, portalOpacity: quiet ? 0 : this.first ? Math.max(0, 1 - age / 1.25) : Math.max(0, 1 - age / .6) * .35, justLaunched: launch || (exiting && this.exitAge <= dt * 1.1), exiting };
    }
}
