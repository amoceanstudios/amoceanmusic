import { palette as p } from './palette';
import { Spring } from '../physics/spring';
import type { Pose } from './skeleton';
const NS = 'http://www.w3.org/2000/svg';
export function tint(hex: string, factor: number) { const c = hex.replace('#', ''); return '#' + [0, 2, 4].map(i => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * factor))).toString(16).padStart(2, '0')).join(''); }
function light(hex: string, amount: number) { return '#' + [0, 2, 4].map(i => { const n = parseInt(hex.slice(1 + i, 3 + i), 16); return Math.round(n + (255 - n) * Math.max(0, Math.min(1, amount))).toString(16).padStart(2, '0'); }).join(''); }
/** Layered, lit 2.5D surfaces on the existing deformable rig; no mesh/texture downloads. */
export class VolumeRig {
    private yaw = new Spring(0, 48, 12);
    private light: SVGRadialGradientElement;
    private metal: SVGLinearGradientElement;
    private gaze = 0;
    private motion = 0;
    private reduced = false;
    private features: SVGGElement;
    private sheen: SVGPathElement;
    private materialMap = new Map<string, string>();
    constructor(private svg: SVGSVGElement, private bones: Map<string, SVGGElement>) {
        const defs = document.createElementNS(NS, 'defs');
        defs.id = 'jimmy-materials';
        svg.prepend(defs);
        const shadow = document.createElementNS(NS, 'filter');
        shadow.id = 'jimmy-head-shadow';
        shadow.setAttribute('x', '-25%');
        shadow.setAttribute('y', '-25%');
        shadow.setAttribute('width', '160%');
        shadow.setAttribute('height', '160%');
        shadow.innerHTML = `<feDropShadow dx=".5" dy="1.4" stdDeviation=".7" flood-color="${p.outline}" flood-opacity=".28"/>`;
        defs.append(shadow);
        bones.get('head')!.setAttribute('filter', 'url(#jimmy-head-shadow)');
        const radial = (id: string, color: string, highlight = 1.8) => { const g = document.createElementNS(NS, 'radialGradient'); g.id = id; g.setAttribute('cx', '30%'); g.setAttribute('cy', '24%'); g.setAttribute('r', '81%'); g.innerHTML = `<stop offset="0" stop-color="${light(color, (highlight - 1) * .26)}"/><stop offset=".35" stop-color="${light(color, .09)}"/><stop offset=".76" stop-color="${color}"/><stop offset="1" stop-color="${tint(color, .65)}"/>`; defs.append(g); return g; };
        this.light = radial('jimmy-fur-volume', p.fur, 2.25);
        radial('jimmy-muzzle-volume', p.belly, 1.85);
        radial('jimmy-eye-volume', p.white, 1);
        radial('jimmy-nose-volume', p.outline, 3);
        radial('jimmy-suit-volume', p.suit, 2.1);
        radial('jimmy-tie-volume', p.tie, 1.5);
        radial('jimmy-paper-volume', p.paper, 1);
        const tube = document.createElementNS(NS, 'linearGradient');
        tube.id = 'jimmy-tube-volume';
        tube.setAttribute('x1', '0%');
        tube.setAttribute('y1', '0%');
        tube.setAttribute('x2', '100%');
        tube.setAttribute('y2', '15%');
        tube.innerHTML = `<stop stop-color="${tint(p.fur, .45)}"/><stop offset=".28" stop-color="${light(p.fur, .13)}"/><stop offset=".47" stop-color="${light(p.fur, .23)}"/><stop offset=".78" stop-color="${p.fur}"/><stop offset="1" stop-color="${tint(p.fur, .6)}"/>`;
        defs.append(tube);
        this.metal = document.createElementNS(NS, 'linearGradient');
        this.metal.id = 'jimmy-frame-volume';
        this.metal.innerHTML = `<stop stop-color="${p.outline}"/><stop offset=".25" stop-color="${tint(p.belly, 1.3)}"/><stop offset=".5" stop-color="${p.ink}"/><stop offset=".7" stop-color="${p.ghost}"/><stop offset="1" stop-color="${p.outline}"/>`;
        defs.append(this.metal);
        const glass = document.createElementNS(NS, 'linearGradient');
        glass.id = 'jimmy-lens-volume';
        glass.setAttribute('x2', '80%');
        glass.setAttribute('y2', '100%');
        glass.innerHTML = `<stop stop-color="${p.white}" stop-opacity=".18"/><stop offset=".35" stop-color="${p.lens}" stop-opacity=".03"/><stop offset=".6" stop-color="${p.ghost}" stop-opacity=".10"/><stop offset="1" stop-color="${p.white}" stop-opacity=".08"/>`;
        defs.append(glass);
        for (const [color, id] of [[p.fur, 'jimmy-fur-volume'], [p.belly, 'jimmy-muzzle-volume'], [p.white, 'jimmy-eye-volume'], [p.suit, 'jimmy-suit-volume'], [p.tie, 'jimmy-tie-volume'], [p.paper, 'jimmy-paper-volume']] as const)
            this.materialMap.set(color.toLowerCase(), id);
        for (const [id, bone] of bones) {
            for (const shape of bone.querySelectorAll<SVGElement>(':scope > path,:scope > ellipse,:scope > g:not([data-bone]) > path,:scope > g:not([data-bone]) > ellipse')) {
                const fill = shape.getAttribute('fill');
                if (fill && this.materialMap.has(fill.toLowerCase()))
                    shape.setAttribute('fill', `url(#${this.materialMap.get(fill.toLowerCase())})`);
                if (shape.getAttribute('stroke') === p.fur)
                    shape.setAttribute('stroke', 'url(#jimmy-tube-volume)');
            }
            if (id === 'head')
                bone.querySelector(':scope > path:last-of-type')?.setAttribute('stroke-width', '1.7');
        }
        const head = bones.get('head')!;
        this.features = document.createElementNS(NS, 'g');
        this.features.id = 'jimmy-sculpted-face';
        this.features.innerHTML = `<path d="M-19 10Q-18 1-7 2Q1 4 7 1Q22 0 23 12Q21 25 1 26Q-16 25-19 10Z" fill="url(#jimmy-muzzle-volume)" stroke="${p.outline}" stroke-width=".9"/><path d="M-15 10Q-9 4-2 8" fill="none" stroke="${p.ghost}" stroke-opacity=".22" stroke-width="1"/><ellipse cx="5" cy="4" rx="9" ry="5.7" fill="url(#jimmy-nose-volume)" stroke="${p.outline}" stroke-width=".9"/><path d="M0 1Q5-2 10 0" fill="none" stroke="${p.glint}" stroke-width="1.1" stroke-opacity=".55"/>`;
        head.insertBefore(this.features, bones.get('mouth')!);
        this.sheen = document.createElementNS(NS, 'path');
        this.sheen.id = 'jimmy-head-rim';
        this.sheen.setAttribute('d', 'M-20-14Q-20-30-6-31Q3-33 11-29');
        this.sheen.setAttribute('fill', 'none');
        this.sheen.setAttribute('stroke', p.ghost);
        this.sheen.setAttribute('stroke-width', '1.8');
        this.sheen.setAttribute('stroke-opacity', '.25');
        head.insertBefore(this.sheen, head.querySelector('[data-bone]'));
        const glasses = bones.get('glasses')!;
        for (const lens of glasses.querySelectorAll('circle')) {
            lens.setAttribute('fill', 'url(#jimmy-lens-volume)');
            lens.setAttribute('fill-opacity', '1');
            lens.setAttribute('stroke', 'url(#jimmy-frame-volume)');
            lens.setAttribute('stroke-width', '1.6');
        }
        for (const line of glasses.querySelectorAll(':scope > path'))
            line.setAttribute('opacity', '.25');
        const glint = document.createElementNS(NS, 'path');
        glint.id = 'jimmy-glass-sheen';
        glint.setAttribute('d', 'M-19-5Q-15-10-10-9M5-5Q10-10 16-9');
        glint.setAttribute('fill', 'none');
        glint.setAttribute('stroke', p.glint);
        glint.setAttribute('stroke-width', '1.2');
        glint.setAttribute('opacity', '.35');
        glasses.append(glint);
        head.append(glasses); // Glass really sits in front of the eyes.
        const hips = bones.get('hips')!;
        const seam = document.createElementNS(NS, 'path');
        seam.setAttribute('d', 'M-9-2Q0 5 10-2');
        seam.setAttribute('fill', 'none');
        seam.setAttribute('stroke', tint(p.fur, .55));
        seam.setAttribute('stroke-width', '1.4');
        hips.insertBefore(seam, hips.querySelector('[data-bone]'));
        svg.dataset.renderStyle = '2.5d';
    }
    view(vx: number, dt: number, reduced: boolean, positionX: number, width: number) { this.reduced = reduced; const desired = reduced ? 0 : Math.max(-.7, Math.min(.7, vx * .0008 + (positionX / width - .5) * .35)); if (reduced)
        this.yaw.reset(0);
    else
        for (let i = 0; i < 4; i++)
            this.yaw.step(desired, dt / 4); this.gaze = this.yaw.value; this.light.setAttribute('cx', `${30 - this.gaze * 8}%`); this.light.setAttribute('cy', '24%'); this.features.setAttribute('transform', `translate(${this.gaze * 4},0) scale(${1 - Math.abs(this.gaze) * .06},1)`); this.sheen.setAttribute('stroke-opacity', String(.25 + Math.max(0, -this.gaze) * .1)); this.bones.get('glasses')!.querySelector('#jimmy-glass-sheen')!.setAttribute('transform', `translate(${this.gaze * 2},0)`); }
    project(pose: Pose) { const yaw = this.gaze, add = (id: string, x: number) => { pose[id] = { ...pose[id], tx: (pose[id]?.tx || 0) + x }; }; add('eyes', yaw * 3); add('eyelids', yaw * 3); add('glasses', yaw * 4); add('mouth', yaw * 4); add('browL', yaw * 3); add('browR', yaw * 3); add('earL', -yaw * 1.5); add('earR', -yaw * 1.5); pose.head = { ...pose.head, sx: (pose.head?.sx ?? 1) * (1 - Math.abs(yaw) * .045) }; }
}
