import * as T from 'three';
import { Spring } from '../physics/spring';
import { skeleton, type Pose } from '../rig/skeleton';
import type { Viseme } from '../rig/visemes';
const materials = { blue: new T.MeshPhysicalMaterial({ color: '#203675', roughness: .78, clearcoat: .04 }), belly: new T.MeshStandardMaterial({ color: '#a3b4cb', roughness: .94 }), dark: new T.MeshStandardMaterial({ color: '#091329', roughness: .5 }), white: new T.MeshPhysicalMaterial({ color: '#fffaf0', roughness: .2, clearcoat: .6 }), iris: new T.MeshPhysicalMaterial({ color: '#3b79a4', roughness: .18 }), gold: new T.MeshStandardMaterial({ color: '#ebba58', metalness: .65, roughness: .26 }), suit: new T.MeshStandardMaterial({ color: '#202d43', roughness: .8 }), paper: new T.MeshStandardMaterial({ color: '#fff1cc' }), pink: new T.MeshStandardMaterial({ color: '#c17091' }), mouth: new T.MeshStandardMaterial({ color: '#100d23', roughness: 1 }), glass: new T.MeshPhysicalMaterial({ color: '#c2ddff', transparent: true, opacity: .12, roughness: .03, metalness: .1, depthWrite: false, clearcoat: 1 }) };
const sphere = new T.SphereGeometry(1, 24, 16);
export class JimmyModel {
    private earLag = new Spring(0, 120, 8);
    private hairLag = new Spring(0, 90, 6);
    private glassLag = new Spring(0, 200, 14);
    private tieLag = new Spring(0, 80, 7);
    private tear!: T.Mesh;
    root = new T.Group();
    bones = new Map<string, T.Group>();
    mouth: T.Mesh;
    teeth: T.Mesh;
    tongue: T.Mesh;
    eyes: T.Group;
    workBoard = new T.Group();
    book = new T.Group();
    page = new T.Group();
    tie = new T.Group();
    suits: T.Mesh[] = [];
    head: T.Group;
    bag: T.Mesh;
    constructor() {
        for (const b of skeleton) {
            const g = new T.Group();
            g.name = b.id;
            g.position.set(b.x * .018, -b.y * .018, 0);
            this.bones.set(b.id, g);
            (b.parent ? this.bones.get(b.parent)! : this.root).add(g);
        }
        const mesh = (parent: T.Object3D, mat: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) => { const m = new T.Mesh(sphere, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
        const bone = (id: string) => this.bones.get(id)!;
        const tube = (parent: T.Object3D, points: T.Vector3[], r: number, mat: T.Material) => { const m = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, r, 8, false), mat); m.castShadow = true; parent.add(m); const cap = new T.Mesh(new T.SphereGeometry(r, 10, 8), mat); cap.position.copy(points.at(-1)!); cap.castShadow = true; parent.add(cap); return m; };
        mesh(bone('hips'), materials.suit, 0, 0, 0, .33, .27, .26);
        mesh(bone('spine1'), materials.blue, 0, 0, 0, .40, .61, .29);
        mesh(bone('spine1'), materials.belly, 0, -.04, .23, .25, .44, .10);
        mesh(bone('spine2'), materials.blue, 0, .02, 0, .37, .37, .25);
        mesh(bone('neck'), materials.blue, 0, .08, 0, .17, .26, .17);
        this.head = bone('head');
        this.tear = mesh(this.head, new T.MeshPhysicalMaterial({ color: '#acdafa', transparent: true, opacity: .75, roughness: .08, clearcoat: 1 }), .44, -.15, .35, .045, .10, .05);
        mesh(this.head, materials.blue, 0, 0, 0, .60, .61, .46);
        mesh(this.head, materials.belly, 0, -.26, .38, .40, .25, .25);
        mesh(this.head, materials.dark, .02, -.13, .66, .13, .095, .12);
        this.eyes = bone('eyes');
        for (const sign of [-1, 1]) {
            const eye = new T.Group();
            eye.name = 'eye' + sign;
            eye.position.set(sign * .225, .07, .39);
            this.eyes.add(eye);
            mesh(eye, materials.white, 0, 0, 0, .225, .29, .20);
            mesh(eye, materials.iris, .025, -.015, .185, .111, .15, .031);
            mesh(eye, materials.dark, .026, -.014, .211, .066, .105, .023);
            mesh(eye, materials.white, -.005, .044, .23, .027, .036, .014);
            const glasses = bone('glasses');
            const ring = new T.Mesh(new T.TorusGeometry(.25, .018, 10, 52), materials.dark);
            ring.position.set(sign * .24, .06, .655);
            ring.scale.y = 1.1;
            glasses.add(ring);
            mesh(glasses, materials.glass, sign * .24, .06, .652, .24, .266, .015);
        }
        tube(bone('glasses'), [new T.Vector3(-.015, .065, .66), new T.Vector3(0, .10, .68), new T.Vector3(.015, .065, .66)], .014, materials.gold);
        for (const sign of [-1, 1])
            tube(bone('glasses'), [new T.Vector3(sign * .48, .07, .64), new T.Vector3(sign * .59, .08, .2), new T.Vector3(sign * .54, .07, -.1)], .016, materials.dark);
        for (const side of ['L', 'R']) {
            const s = side === 'L' ? -1 : 1;
            const ear = bone('ear' + side);
            mesh(ear, materials.blue, 0, .20, 0, .125, side === 'L' ? .33 : .55, .11);
            mesh(ear, materials.belly, 0, .21, .078, .068, side === 'L' ? .23 : .40, .04);
            for (const part of ['upperArm.', 'foreArm.', 'thigh.', 'shin.']) {
                const arm = part.includes('Arm'), length = part === 'upperArm.' ? .50 : part === 'foreArm.' ? .45 : part === 'thigh.' ? .54 : .50;
                const g = bone(part + side);
                if (part === 'foreArm.' || part === 'shin.')
                    mesh(g, materials.blue, 0, 0, 0, arm ? .092 : .112, arm ? .092 : .112, arm ? .092 : .112);
                const m = new T.Mesh(new T.CapsuleGeometry(arm ? .075 : .095, length - .15, 8, 16), materials.blue);
                m.position.set(s * (part === 'upperArm.' ? .07 : .035), -length / 2, 0);
                m.rotation.z = s * .10;
                m.castShadow = true;
                g.add(m);
            }
            const hand = bone('hand.' + side);
            const palm = mesh(hand, materials.blue, 0, -.04, .02, .15, .17, .10);
            for (let i = 0; i < 3; i++) {
                const dx = (i - 1) * .10;
                tube(hand, [new T.Vector3(dx, -.12, 0), new T.Vector3(dx * 1.8, -.24, .035), new T.Vector3(dx * 1.9, -.31 + (i % 2) * .035, .07)], .048, materials.blue);
            }
            tube(hand, [new T.Vector3(s * .10, -.04, .01), new T.Vector3(s * .23, -.09, .045), new T.Vector3(s * .27, -.15, .08)], .055, materials.blue);
            mesh(bone('foot.' + side), materials.blue, .055, -.035, .12, .20, .10, .30);
            mesh(bone('foot.' + side), materials.white, .055, -.09, .13, .195, .035, .28);
        }
        mesh(bone('fold'), materials.blue, -.02, .20, 0, .115, .29, .11);
        for (const side of ['L', 'R'])
            tube(bone('brow' + side), [new T.Vector3(-.13, 0, .46), new T.Vector3(0, .075, .5), new T.Vector3(.14, .01, .46)], .035, materials.dark);
        tube(bone('tuft1'), [new T.Vector3(0, 0, 0), new T.Vector3(-.045, .1, 0), new T.Vector3(0, .22, 0)], .027, materials.dark);
        tube(bone('tuft2'), [new T.Vector3(0, 0, 0), new T.Vector3(.04, .11, 0), new T.Vector3(0, .22, 0)], .027, materials.dark);
        tube(bone('tuft3'), [new T.Vector3(0, 0, 0), new T.Vector3(.19, .04, 0), new T.Vector3(.24, -.09, 0), new T.Vector3(.10, -.12, 0)], .029, materials.dark);
        this.mouth = mesh(bone('mouth'), materials.mouth, 0, -.04, .60, .17, .025, .045);
        this.teeth = mesh(this.mouth, materials.white, 0, .45, .1, .70, .16, .8);
        this.tongue = mesh(this.mouth, materials.pink, 0, -.55, .2, .62, .27, .8);
        const board = new T.Mesh(new T.BoxGeometry(.62, .45, .08), materials.gold);
        this.workBoard.add(board);
        const screen = new T.Mesh(new T.BoxGeometry(.48, .18, .02), materials.dark);
        screen.position.set(0, .08, .05);
        this.workBoard.add(screen);
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 256;
        labelCanvas.height = 96;
        const ctx = labelCanvas.getContext('2d')!;
        ctx.fillStyle = '#0a172b';
        ctx.fillRect(0, 0, 256, 96);
        ctx.fillStyle = '#f8df9e';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('2 + 2 = 4', 128, 62);
        const texture = new T.CanvasTexture(labelCanvas);
        texture.colorSpace = T.SRGBColorSpace;
        const label = new T.Mesh(new T.PlaneGeometry(.46, .16), new T.MeshBasicMaterial({ map: texture }));
        label.position.set(0, .08, .066);
        this.workBoard.add(label);
        for (let i = 0; i < 3; i++) {
            const b = new T.Mesh(new T.BoxGeometry(.09, .07, .03), materials.white);
            b.position.set((i - 1) * .15, -.12, .06);
            this.workBoard.add(b);
        }
        this.workBoard.position.set(0, -.1, .16);
        this.workBoard.rotation.x = -.4;
        bone('hand.R').add(this.workBoard);
        const bookMat = materials.gold;
        const cover = new T.Mesh(new T.BoxGeometry(.65, .46, .08), bookMat);
        this.book.add(cover);
        const pages = new T.Mesh(new T.BoxGeometry(.60, .40, .065), materials.paper);
        pages.position.z = .045;
        this.book.add(pages);
        const right = pages.clone();
        right.position.set(.30, 0, 0);
        this.page.add(right);
        this.book.add(this.page);
        this.book.position.set(-.18, -.08, .14);
        this.book.rotation.x = -.6;
        bone('hand.R').add(this.book);
        const tie = new T.Mesh(new T.ConeGeometry(.09, .65, 4), materials.gold);
        tie.rotation.z = Math.PI;
        tie.position.set(0, -.34, .25);
        this.tie.add(tie);
        bone('neck').add(this.tie);
        for (const id of ['spine1', 'spine2']) {
            const g = bone(id), suit = mesh(g, materials.suit, 0, 0, .015, id === 'spine1' ? .405 : .38, id === 'spine1' ? .60 : .35, .295);
            this.suits.push(suit);
        }
        this.bag = mesh(bone('hips'), materials.gold, .34, .12, -.03, .20, .25, .12);
    }
    pose(pose: Pose, time: number, viseme: Viseme, section: number, reduced: boolean, working: boolean, bookOpen: number, page: number) {
        for (const b of skeleton) {
            const g = this.bones.get(b.id)!, v = pose[b.id] || {};
            g.position.set((b.x + (v.tx || 0)) * .018, -(b.y + (v.ty || 0)) * .018, 0);
            g.rotation.z = -(v.rot || 0) * Math.PI / 180;
            g.scale.set(v.sx ?? 1, v.sy ?? 1, Math.sqrt(Math.abs((v.sx ?? 1) * (v.sy ?? 1))));
        }
        this.bones.get('earL')!.rotation.z += .2;
        this.bones.get('earR')!.rotation.z -= .13;
        this.bones.get('upperArm.L')!.rotation.x = .12;
        this.bones.get('upperArm.R')!.rotation.x = -.1;
        this.tear.visible = section === 5;
        this.tear.position.y = -.15 - (reduced ? 0 : (time % 3) * .08);
        this.head.rotation.x = reduced ? 0 : Math.sin(time * (viseme === 'rest' ? 1 : 10)) * .025;
        this.head.rotation.y = reduced ? 0 : Math.sin(time * .7) * .11;
        const blink = !reduced && time % 4.7 < .12;
        this.eyes.scale.y = blink ? .08 : 1;
        const shapes: Record<Viseme, [
            number,
            number
        ]> = { rest: [.17, .026], MBP: [.14, .018], AA: [.15, .145], EE: [.23, .065], OH: [.105, .14], OO: [.08, .10], wide: [.25, .15], grimace: [.21, .035] };
        const [w, h] = shapes[reduced ? 'rest' : viseme];
        this.mouth.scale.set(w, h, .055);
        this.teeth.visible = ['EE', 'wide', 'grimace'].includes(viseme);
        this.tongue.visible = ['AA', 'wide'].includes(viseme);
        this.book.visible = bookOpen > 0;
        this.book.scale.x = Math.max(.03, bookOpen);
        this.page.rotation.y = page * Math.PI;
        this.workBoard.visible = working;
        this.tie.visible = section === 4;
        for (const suit of this.suits)
            suit.visible = section === 4;
        this.tie.rotation.z = reduced ? 0 : Math.sin(time * 3) * .09;
    }
    secondary(vx: number, vy: number, dt: number, reduced: boolean) { const target = Math.max(-.5, Math.min(.5, -vx * .09 + vy * .04)); const springs = [this.earLag, this.hairLag, this.glassLag, this.tieLag]; if (reduced)
        springs.forEach(s => s.reset(0));
    else
        for (let i = 0; i < 4; i++) {
            this.earLag.step(target, Math.min(dt, .05) / 4);
            this.hairLag.step(target * 1.3, Math.min(dt, .05) / 4);
            this.glassLag.step(target * .15, Math.min(dt, .05) / 4);
            this.tieLag.step(target * .7, Math.min(dt, .05) / 4);
        } this.bones.get('fold')!.rotation.z += this.earLag.value; this.bones.get('tuft1')!.rotation.z += this.hairLag.value; this.bones.get('glasses')!.position.x += this.glassLag.value; this.tie.rotation.z += this.tieLag.value; }
}
