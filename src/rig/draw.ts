import {VolumeRig} from './volume';
import { palette as p } from './palette';
import { skeleton, idlePose, type Pose } from './skeleton';
import { mouthPath, morph, type Viseme } from './visemes';
import { bookMarkup, tieMarkup } from './props';
const NS = 'http://www.w3.org/2000/svg';
export class Rig {
    volume:VolumeRig;
    root: SVGGElement;
    bones = new Map<string, SVGGElement>();
    mouth: SVGPathElement;
    last: Viseme = 'rest';
    from: Viseme = 'rest';
    blend = 1;
    book: SVGGElement;
    tie: SVGGElement;
    suit: SVGElement[] = [];
    tear: SVGElement;
    glints: SVGElement[] = [];
    ghosts: SVGGElement;
    constructor(public svg: SVGSVGElement) {
        const create = (tag: string, html = '') => { const n = document.createElementNS(NS, tag); n.innerHTML = html; return n; };
        this.ghosts = create('g') as SVGGElement;
        svg.append(this.ghosts);
        this.root = create('g') as SVGGElement;
        this.root.setAttribute('stroke', p.outline);
        this.root.setAttribute('stroke-width', '1.5');
        this.root.setAttribute('stroke-linecap', 'round');
        this.root.setAttribute('stroke-linejoin', 'round');
        svg.append(this.root);
        for (const b of skeleton) {
            const g = create('g') as SVGGElement;
            g.dataset.bone = b.id;
            this.bones.set(b.id, g);
            (b.parent ? this.bones.get(b.parent)! : this.root).append(g);
        }
        const shape = (id: string, html: string) => this.bones.get(id)!.insertAdjacentHTML('afterbegin', html), limb = (d: string, width = 6) => `<path d="${d}" fill="none" stroke="${p.outline}" stroke-width="${width + 1.8}"/><path d="${d}" fill="none" stroke="${p.fur}" stroke-width="${width}"/>`;
        shape('hips', `<ellipse cy="-4" rx="12" ry="16" fill="${p.fur}"/>`);
        shape('spine1', `<path d="M-10 8C-13-9-18-28-7-39C5-44 14-30 12-14C10-2 14 11 8 16Q0 21-10 8Z" fill="${p.fur}"/><path d="M-4-27Q8-19 4 3" stroke="${p.belly}" stroke-width="9" fill="none"/>`);
        shape('spine2', `<path d="M-12 9C-17-3-16-17-7-24C7-32 19-16 14-2Q12 16-12 9Z" fill="${p.fur}"/>`);
        shape('neck', limb('M0 0Q-5-8 0-17', 8));
        shape('head', `<path d="M-25-9C-29-29-17-39-1-38C20-40 30-24 26-8C28 11 17 27 0 27C-19 27-29 12-25-9Z" fill="${p.fur}"/><ellipse cy="13" rx="20" ry="12" fill="${p.belly}"/><path d="M19-22Q29 7 14 22" stroke-width="4" fill="none"/>`);
        shape('earL', `<path d="M-5 0Q-12-18-5-27Q3-31 5-21L5 1Z" fill="${p.fur}"/>`);
        shape('fold', `<path d="M-5 1Q-13-19-4-27Q5-24 5-1Z" fill="${p.fur}"/><path d="M-3-4v-13" stroke="${p.belly}" stroke-width="3"/>`);
        shape('earR', `<path d="M-5 0Q-8-27 1-42Q10-38 7-19L5 0Z" fill="${p.fur}"/><path d="M1-9v-19" stroke="${p.belly}" stroke-width="3"/>`);
        for (const side of ['L', 'R']) {
            const sign = side === 'L' ? -1 : 1;
            shape('upperArm.' + side, limb(`M0 0Q${sign * 12} 14 ${sign * 8} 28`, 5.8));
            shape('foreArm.' + side, limb(`M0 0Q${sign * -5} 13 ${sign * 4} 25`, 4.9));
            shape('hand.' + side, `<path d="M-5-2Q-15-8-16-3Q-17 1-9 4Q-19 4-17 9Q-14 13-5 10Q-13 16-8 19Q-3 21 3 12Q12 4 5-4Q2-7-1-1Z" fill="${p.belly}"/>`);
            shape('thigh.' + side, limb(`M0 0Q${sign * 8} 16 ${sign * 5} 30`, 5));
            shape('shin.' + side, limb('M0 0Q-5 12 0 28', 4));
            shape('foot.' + side, `<path d="M-4-2Q-9 8-2 10L19 9Q28 5 21 2L4 1Z" fill="${p.belly}"/><path d="m8 3 13 1m-12 3 12 0" stroke-width="1"/>`);
        }
        shape('eyes', `<ellipse cx="-10" cy="-1" rx="8" ry="12" fill="${p.white}"/><ellipse cx="11" cy="-1" rx="8" ry="12" fill="${p.white}"/><g id="pupils" fill="${p.ink}" stroke="none"><ellipse cx="-8" cy="0" rx="3" ry="6"/><ellipse cx="13" cy="0" rx="3" ry="6"/></g>`);
        shape('eyelids', `<path id="lids" d="M-19-1h18M2-1h18" stroke-width="3" visibility="hidden"/>`);
        shape('glasses', `<g fill="${p.lens}" fill-opacity=".18" stroke="${p.ink}" stroke-width="1.4"><circle cx="-11" r="12"/><circle cx="12" r="12"/><path d="M1-2h0M-23-2l-4-4M24-2l3-4" fill="none"/></g><path d="m-18-5 6-4m17 4 6-4" stroke="${p.glint}" stroke-width="1.5"/>`);
        shape('browL', '<path d="M-7 0Q0-4 8-1" fill="none"/>');
        shape('browR', '<path d="M-7-1Q0-5 8 0" fill="none"/>');
        shape('tuft1', `<path d="M0 0Q-4-7 0-12" fill="none" stroke-width="3"/>`);
        shape('tuft2', `<path d="M0 0Q4-6 0-12" fill="none" stroke-width="3"/>`);
        shape('tuft3', `<path d="M0 0Q17-4 13 7Q7 13 0 9" fill="none" stroke-width="3"/><ellipse cx="-3" cy="18" rx="5" ry="3" fill="${p.fur}"/><path d="M0 0v17" stroke-width="2"/>`);
        this.mouth = create('path') as SVGPathElement;
        this.mouth.setAttribute('fill', p.mouth);
        this.mouth.setAttribute('stroke-width', '1');
        this.bones.get('mouth')!.append(this.mouth);
        this.book = create('g', bookMarkup) as SVGGElement;
        this.book.setAttribute('transform', 'translate(-6,2) rotate(-12)');
        this.bones.get('hand.R')!.append(this.book);
        this.tie = create('g', tieMarkup) as SVGGElement;
        this.bones.get('neck')!.append(this.tie);
        {
            const s = create('g', `<path d="M-12 16-15-26Q-12-44 0-48Q14-45 15-27L12 16Z" fill="${p.suit}"/><path d="m-7-42 8 28 7-28" fill="${p.shirt}" stroke-width="1"/>`);
            const parent = this.bones.get('spine1')!;
            parent.insertBefore(s, parent.querySelector('[data-bone]'));
            this.suit.push(s);
        }
        this.bones.get('neck')!.append(this.tie);
        {
            const s = create('g', `<path d="M-12 10-13-5-7-17 0-12 7-17 13-5 11 10Z" fill="${p.suit}"/><path d="m-7-16 7 13 7-13-7 5Z" fill="${p.shirt}" stroke-width="1"/>`);
            const parent = this.bones.get('spine2')!;
            parent.insertBefore(s, parent.querySelector('[data-bone]'));
            this.suit.push(s);
        }
        for (const side of ['L', 'R']) {
            const sign = side === 'L' ? -1 : 1;
            const s = create('g', `<path d="M0 0Q${sign * 12} 14 ${sign * 8} 26" fill="none" stroke="${p.suit}" stroke-width="7"/><path d="M${sign * 5} 26h7" stroke="${p.shirt}" stroke-width="3"/>`);
            const parent = this.bones.get('upperArm.' + side)!;
            parent.insertBefore(s, parent.querySelector('[data-bone]'));
            this.suit.push(s);
        }
        this.tear = create('path', '') as SVGElement;
        this.tear.setAttribute('d', 'M19 3Q30 21 21 23Q12 23 19 3Z');
        this.tear.setAttribute('fill', p.tear);
        this.tear.setAttribute('stroke-width', '1');
        this.bones.get('head')!.append(this.tear);
        for (const x of [-8, 13]) {
            const g = create('circle');
            g.setAttribute('cx', String(x));
            g.setAttribute('cy', '-4');
            g.setAttribute('r', '1');
            g.setAttribute('fill', p.glint);
            g.setAttribute('stroke', 'none');
            this.bones.get('eyes')!.append(g);
            this.glints.push(g);
        }
        this.volume=new VolumeRig(svg,this.bones);
    }
    pose(pose: Pose) { this.volume.project(pose);for (const b of skeleton) {
        const v = { ...idlePose[b.id], ...pose[b.id] };
        this.bones.get(b.id)!.setAttribute('transform', `translate(${b.x + (v.tx || 0)} ${b.y + (v.ty || 0)}) rotate(${v.rot || 0}) scale(${v.sx ?? 1} ${v.sy ?? 1})`);
    } }
    face(v: Viseme, dt: number, blink: boolean, sad: number, reduced: boolean) { if (v !== this.last) {
        this.from = this.last;
        this.last = v;
        this.blend = 0;
    } this.blend = Math.min(1, this.blend + dt * 24); this.mouth.setAttribute('d', mouthPath(morph(this.from, reduced ? 'rest' : v, this.blend))); this.bones.get('eyes')!.setAttribute('opacity', blink ? '0' : '1'); this.bones.get('glasses')!.setAttribute('opacity', '1'); this.svg.querySelector('#lids')!.setAttribute('visibility', blink ? 'visible' : 'hidden'); this.tear.setAttribute('opacity', String(sad)); for (const g of this.glints)
        g.setAttribute('r', String(1 + sad * 3)); }
    props(book: number, suit: boolean, page: number, tie: number) { this.book.setAttribute('visibility', book > 0 ? 'visible' : 'hidden'); this.book.setAttribute('opacity', String(Math.min(1, book * 3))); this.book.querySelector('#book-prop')!.setAttribute('transform', `scale(${Math.max(.03, book)} 1)`); this.book.querySelector('#page')!.setAttribute('transform', `scale(${Math.cos(page * Math.PI)} 1)`); this.tie.setAttribute('visibility', suit ? 'visible' : 'hidden'); this.tie.setAttribute('transform', `rotate(${tie})`); for (const s of this.suit)
        s.setAttribute('visibility', suit ? 'visible' : 'hidden'); }
    smear(on: boolean, dx: number, dy: number) { this.ghosts.replaceChildren(); if (!on)
        return; for (let i = 1; i <= 2; i++) {
        const g = this.root.cloneNode(true) as SVGGElement;
        g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
        g.setAttribute('opacity', String(.13 / i));
        g.style.translate = `${-dx * i * .018}px ${-dy * i * .018}px`;
        this.ghosts.append(g);
    } }
}
