import { Spring } from '../physics/spring';
import { clamp, type Point } from '../physics/path';
export type BubbleStyle = 'normal' | 'whisper' | 'cheer' | 'thinking';
export class Bubble {
    el = document.getElementById('speech')!;
    text = document.getElementById('speech-text')!;
    chips = document.getElementById('chips')!;
    expiry = 0;
    private tail: SVGSVGElement;
    private path: SVGPathElement;
    private x = new Spring(0, 130, 20);
    private y = new Spring(0, 130, 20);
    private pop = new Spring(1, 180, 16);
    private ready = false;
    private clock = 0;
    private style: BubbleStyle = 'normal';
    constructor() { const ns = 'http://www.w3.org/2000/svg'; this.tail = document.createElementNS(ns, 'svg'); this.tail.id = 'speech-tail'; this.tail.setAttribute('aria-hidden', 'true'); this.path = document.createElementNS(ns, 'path'); this.tail.append(this.path); document.body.append(this.tail); }
    show(text: string, expiry: number, style?: BubbleStyle) { this.text.textContent = text; document.getElementById('live')!.textContent = text; this.el.hidden = false; this.expiry = expiry; this.chips.replaceChildren(); this.style = style || (/…$|even |ik zoek/i.test(text) ? 'thinking' : /[!]/.test(text) ? 'cheer' : 'normal'); this.el.dataset.style = this.style; this.pop.reset(.86); this.ready = false; }
    chip(label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; this.chips.append(b); return b; }
    hide() { this.el.hidden = true; this.tail.style.display = 'none'; this.chips.replaceChildren(); this.ready = false; }
    position(x: number, y: number) { this.follow({ x, y }, 1, true, 1 / 24); }
    follow(face: Point, depth: number, reduced: boolean, dt: number) {
        if (this.el.hidden) {
            this.tail.style.display = 'none';
            return;
        }
        this.tail.style.display = 'block';
        this.clock += dt;
        const w = this.el.offsetWidth || 280, h = this.el.offsetHeight || 120, scale = reduced ? 1 : clamp(.93 + depth * .05, .94, 1.06);
        const width = w * scale, height = h * scale;
        const inset = 14;
        const candidates = [{ x: face.x - width * .6, y: face.y - height - 115 * clamp(depth, .6, 1.7) }, { x: face.x + 55, y: face.y - height * .7 }, { x: face.x - width - 55, y: face.y - height * .7 }, { x: face.x - width * .5, y: face.y + 55 },{x:face.x-width*.5,y:78}].map((p, priority) => ({ priority, x: clamp(p.x, inset, Math.max(inset, innerWidth - width - inset)), y: clamp(p.y, 78, Math.max(78, innerHeight - height - inset)) }));
        const obstacles = [...document.querySelectorAll<HTMLElement>('[data-richie-avoid],#jimmy-dialog[open],.controls')].map(n => n.getBoundingClientRect()).filter(b => b.bottom > 0 && b.top < innerHeight);
        const actor = document.querySelector<SVGElement>('#jimmy-depth-plane >g:last-child')?.getBoundingClientRect();
        if (actor)
            obstacles.push(actor);
        const score = (p: Point & {
            priority: number;
        }) => [0, 90, 90, 240, 30][p.priority] + obstacles.reduce((sum, b) => sum + Math.max(0, Math.min(p.x + width, b.right) - Math.max(p.x, b.left)) * Math.max(0, Math.min(p.y + height, b.bottom) - Math.max(p.y, b.top)), 0) + Math.hypot(p.x + width / 2 - face.x, p.y + height - face.y) * .02;
        const target = candidates.sort((a, b) => score(a) - score(b))[0];
        if (!this.ready || reduced) {
            this.x.reset(target.x);
            this.y.reset(target.y);
            this.ready = true;
        }
        for (let i = 0; i < 3; i++) {
            this.x.step(target.x, dt / 3);
            this.y.step(target.y, dt / 3);
            this.pop.step(1, dt / 3);
        } // Clamp after lag too, including viewport resizes and tool panel changes.
        const left = clamp(this.x.value, inset, Math.max(inset, innerWidth - width - inset)), top = clamp(this.y.value, 78, Math.max(78, innerHeight - height - inset));
        const breath = reduced ? 0 : Math.sin(this.clock * 2) * .004, pop = reduced ? 1 : this.pop.value;
        const sx = scale * (pop + breath), sy = scale * (2 - pop - breath);
        this.el.style.left = left + 'px';
        this.el.style.top = top + 'px';
        this.el.style.transformOrigin = '50% 100%';
        this.el.style.transform = `scale(${sx},${sy})`;
        this.el.style.setProperty('--bubble-breath', String(breath));
        const cx = left + width / 2, cy = top + height / 2;
        const dx = face.x - cx, dy = face.y - cy;
        let base: Point, normal: Point;
        if (Math.abs(dx / (width / 2)) > Math.abs(dy / (height / 2))) {
            base = { x: dx > 0 ? left + width - 3 : left + 3, y: clamp(face.y, top + 20, top + height - 20) };
            normal = { x: 0, y: 1 };
        }
        else {
            base = { x: clamp(face.x, left + 25, left + width - 25), y: dy > 0 ? top + height - 3 : top + 3 };
            normal = { x: 1, y: 0 };
        }
        const dist = Math.hypot(face.x - base.x, face.y - base.y);
        const side = cx < face.x ? -1 : 1;
        const tip = { x: face.x + side * 22 * clamp(depth, .55, 5.7), y: face.y + 2 }, size = this.style === 'whisper' ? 5 : 10;
        const bend = { x: (base.x + tip.x) / 2 + side * 22 * clamp(depth, .6, 1.7), y: (base.y + tip.y) / 2 };
        this.path.setAttribute('d', `M${base.x - normal.x * size},${base.y - normal.y * size} Q${bend.x},${bend.y} ${tip.x},${tip.y} Q${bend.x + normal.x * 7},${bend.y + normal.y * 7} ${base.x + normal.x * size},${base.y + normal.y * size}Z`);
        this.path.setAttribute('opacity', dist > Math.max(300,180*depth) ? '0' : '.99');
        this.tail.dataset.style = this.style;
        this.el.dataset.tailTarget = `${Math.round(tip.x)},${Math.round(tip.y)}`;
    }
}
