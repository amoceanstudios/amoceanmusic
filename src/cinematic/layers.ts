import { palette } from '../rig/palette';
import type { StageFrame } from './staging';
/** Mask foreground silhouettes only in distant shots, keeping one shared SVG rig. */
export class DepthLayers {
    private mask: SVGMaskElement;
    private holes: SVGGElement;
    private portal: SVGEllipseElement;
    private shadow: SVGEllipseElement;
    constructor(private svg: SVGSVGElement, root: SVGGElement, ghosts: SVGGElement) { const ns = 'http://www.w3.org/2000/svg', defs = document.createElementNS(ns, 'defs'); this.mask = document.createElementNS(ns, 'mask'); this.mask.id = 'jimmy-depth-mask'; this.mask.setAttribute('maskUnits', 'userSpaceOnUse'); const bg = document.createElementNS(ns, 'rect'); bg.setAttribute('x', '-10000'); bg.setAttribute('y', '-10000'); bg.setAttribute('width', '20000'); bg.setAttribute('height', '20000'); bg.setAttribute('fill', 'white'); this.holes = document.createElementNS(ns, 'g'); this.mask.append(bg, this.holes); defs.append(this.mask); svg.prepend(defs); const plane = document.createElementNS(ns, 'g'); plane.id = 'jimmy-depth-plane'; svg.append(plane); plane.append(ghosts, root); this.portal = document.createElementNS(ns, 'ellipse'); this.portal.setAttribute('fill', palette.fur); this.portal.setAttribute('stroke', palette.belly); this.portal.setAttribute('stroke-width', '3'); this.shadow = document.createElementNS(ns, 'ellipse'); this.shadow.setAttribute('fill', palette.outline); svg.insertBefore(this.shadow, svg.children[1] || null); svg.insertBefore(this.portal, svg.children[1] || null); }
    render(shot: StageFrame, root: SVGGElement, ghosts: SVGGElement, x: number, y: number, scale: number, hidden: boolean) {
        this.svg.dataset.depth = shot.far ? 'far' : 'near';
        root.style.filter = shot.blur > .08 ? `blur(${shot.blur.toFixed(2)}px)` : '';
        this.holes.replaceChildren();
        if (shot.far) {
            for (const node of document.querySelectorAll<HTMLElement>('[data-jimmy-foreground]')) {
                const b = node.getBoundingClientRect();
                if (b.bottom < 0 || b.top > innerHeight)
                    continue;
                const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                for (const [k, v] of Object.entries({ x: b.left, y: b.top, width: b.width, height: b.height, rx: 4 }))
                    rect.setAttribute(k, String(v));
                rect.setAttribute('fill', 'black');
                this.holes.append(rect);
            }
        } // A mask is on the untransformed parent so DOM rectangles stay in viewport space.
        const parent = root.parentElement!;
        parent.setAttribute('mask', shot.far ? 'url(#jimmy-depth-mask)' : '');
        this.portal.setAttribute('cx', String(shot.portal.x));
        this.portal.setAttribute('cy', String(shot.portal.y + 55 * scale));
        this.portal.setAttribute('rx', String(12 + shot.portalOpacity * 35));
        this.portal.setAttribute('ry', String(4 + shot.portalOpacity * 9));
        this.portal.setAttribute('opacity', String(hidden ? 0 : shot.portalOpacity * .7));
        this.shadow.setAttribute('cx', String(x));
        this.shadow.setAttribute('cy', String(y + 60 * scale));
        this.shadow.setAttribute('rx', String(Math.max(3, 39 * scale)));
        this.shadow.setAttribute('ry', String(Math.max(1, 5 * scale)));
        this.shadow.setAttribute('opacity', hidden ? '0' : String(.08 * Math.min(1, scale)));
    }
}
