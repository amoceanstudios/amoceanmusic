import { palette } from '../rig/palette';
import type { Sfx } from './engine';
/** Sound feedback is restrained and driven by the same events as the soundtrack. */
export class SoundVisuals {
    private group: SVGGElement;
    private halo: SVGCircleElement;
    private ring: SVGCircleElement;
    private impulse = 0;
    private since = 9;
    constructor(svg: SVGSVGElement) { const ns = svg.namespaceURI; this.group = document.createElementNS(ns, 'g') as SVGGElement; this.group.id = 'sound-visuals'; this.group.setAttribute('pointer-events', 'none'); this.halo = document.createElementNS(ns, 'circle') as SVGCircleElement; this.halo.setAttribute('fill', 'none'); this.halo.setAttribute('stroke', palette.belly); this.halo.setAttribute('stroke-width', '1'); this.ring = this.halo.cloneNode() as SVGCircleElement; this.group.append(this.halo, this.ring); svg.insertBefore(this.group, svg.firstChild); }
    effect(name: Sfx, amount: number) { if (['reveal', 'success', 'land', 'recoil', 'book-close', 'copy', 'nav'].includes(name)) {
        if (this.since < .22 && amount < this.impulse)
            return;
        this.impulse = Math.min(1, amount);
        this.since = 0;
    } }
    draw(dt: number, x: number, y: number, scale: number, voice: number, enabled: boolean, reduced: boolean) { this.since += dt; this.group.setAttribute('visibility', enabled && !reduced ? 'visible' : 'hidden'); this.group.setAttribute('transform', `translate(${x} ${y - 65 * scale})`); this.halo.setAttribute('r', String((46 + voice * 12) * scale)); this.halo.setAttribute('opacity', String(voice * .15)); this.ring.setAttribute('r', String((35 + this.since * 85) * scale)); this.ring.setAttribute('opacity', String(Math.max(0, .2 - this.since * .45) * this.impulse)); }
}
