import * as T from 'three';
import { JimmyModel } from './model';
import { ShowDirector } from './show';
import type { Pose } from '../rig/skeleton';
import type { Viseme } from '../rig/visemes';
import { soundscape } from '../audio/engine';
export type WorldFrame = {
    dt: number;
    time: number;
    section: number;
    x: number;
    y: number;
    scale: number;
    pose: Pose;
    viseme: Viseme;
    reduced: boolean;
    minimized: boolean;
    manual: boolean;
    open: boolean;
    working: boolean;
    visible: boolean;
    book: number;
    page: number;
};
const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export class CinemaWorld {
    renderer: T.WebGLRenderer;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, 1, .05, 80);
    model = new JimmyModel();
    director = new ShowDirector();
    private portal = new T.Group();
    private floor: T.Mesh;
    private sparks: T.Points;
    private key: T.SpotLight;
    private rim: T.PointLight;
    private width = 0;
    private height = 0;
    private canvas: HTMLCanvasElement;
    private mouth = new T.Vector3();
    private rootScreen = new T.Vector3();
    private ray = new T.Raycaster();
    private active = false;
    private spin = 0;
    private failed = false;
    private ghosts: T.Group[] = [];
    private prior = new T.Vector3();
    private smearFrames = 0;
    private lastSmear = -10;
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'jimmy-webgl';
        this.canvas.setAttribute('aria-label', 'Jimmy, an animated three-dimensional character');
        this.canvas.setAttribute('role', 'img');
        this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = T.PCFSoftShadowMap;
        this.renderer.outputColorSpace = T.SRGBColorSpace;
        this.renderer.toneMapping = T.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.25;
        document.body.prepend(this.canvas);
        this.scene.fog = new T.FogExp2('#0a1021', .028);
        this.scene.add(new T.HemisphereLight('#b7d8ff', '#17213e', 2.0));
        this.key = new T.SpotLight('#ffe4bd', 65, 30, .8, .8, 1);
        this.key.position.set(-3.5, 6, 5);
        this.key.castShadow = true;
        this.key.shadow.mapSize.set(512, 512);
        this.key.shadow.bias = -.0005;
        this.key.target.position.set(0, 1, 0);
        this.scene.add(this.key, this.key.target);
        this.rim = new T.PointLight('#7c9cff', 40, 20, 1);
        this.rim.position.set(3, 3, -2);
        this.scene.add(this.rim);
        const fill = new T.PointLight('#7ed7ed', 9, 15, 1);
        fill.position.set(-3, 1, -1);
        this.scene.add(fill);
        this.floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshStandardMaterial({ color: '#111a2a', roughness: .82, metalness: .14, transparent: true, opacity: .9 }));
        this.floor.rotation.x = -Math.PI / 2;
        this.floor.position.y = -1.22;
        this.floor.receiveShadow = true;
        this.scene.add(this.floor);
        const ring = new T.Mesh(new T.TorusGeometry(.75, .035, 12, 96), new T.MeshBasicMaterial({ color: '#f5c57a' }));
        ring.scale.y = 1.4;
        this.portal.add(ring);
        const inner = new T.Mesh(new T.CircleGeometry(.72, 64), new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, uniforms: { clock: { value: 0 } }, vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'varying vec2 v;uniform float clock;void main(){vec2 p=v-.5;float r=length(p)*2.;float a=atan(p.y,p.x);float swirl=.5+.5*sin(a*4.-r*15.+clock*3.);float edge=smoothstep(.05,1.,r);vec3 c=mix(vec3(.035,.055,.17),vec3(.75,.43,.13),edge*edge*.8+swirl*.08);gl_FragColor=vec4(c,1.-smoothstep(.95,1.,r));}' }));
        inner.scale.y = 1.4;
        this.portal.add(inner);
        this.portal.position.set(-2.4, .6, -2);
        this.scene.add(this.portal);
        const particles = new Float32Array(150 * 3);
        for (let i = 0; i < 150; i++) {
            particles[i * 3] = (Math.random() - .5) * 24;
            particles[i * 3 + 1] = Math.random() * 10 - 1;
            particles[i * 3 + 2] = -4 - Math.random() * 10;
        }
        this.sparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(particles, 3)), new T.PointsMaterial({ color: '#c5d7f8', size: .025, transparent: true, opacity: .55, depthWrite: false }));
        this.scene.add(this.sparks, this.model.root);
        for (let i = 0; i < 2; i++) {
            const ghost = this.model.root.clone(true);
            ghost.traverse(o => {
                if (o instanceof T.Mesh) {
                    o.material = new T.MeshBasicMaterial({ color: '#607fb8', transparent: true, opacity: .13 / (i + 1), depthWrite: false });
                    o.castShadow = false;
                    o.receiveShadow = false;
                }
            });
            ghost.visible = false;
            this.ghosts.push(ghost);
            this.scene.add(ghost);
        }
        document.body.dataset.renderer = 'webgl';
        this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.failed = true; document.body.dataset.renderer = 'fallback'; document.getElementById('live')!.textContent = '3D-weergave onderbroken. De compatibele rig blijft beschikbaar.'; });
        this.canvas.addEventListener('webglcontextrestored', () => { this.failed = false; document.body.dataset.renderer = 'webgl'; });
    }
    reset() { this.director.reset(); }
    private project(p: T.Vector3) { const v = p.clone().project(this.camera); return { x: (v.x * .5 + .5) * innerWidth, y: (-.5 * v.y + .5) * innerHeight }; }
    private screenPoint(x: number, y: number, z: number) { this.ray.setFromCamera(new T.Vector2(x / innerWidth * 2 - 1, 1 - y / innerHeight * 2), this.camera); const out = new T.Vector3(); this.ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 0, 1), -z), out); return out; }
    render(f: WorldFrame) {
        if (this.failed)
            return;
        if (this.width !== innerWidth || this.height !== innerHeight) {
            this.width = innerWidth;
            this.height = innerHeight;
            this.renderer.setSize(this.width, this.height, false);
            this.camera.aspect = this.width / this.height;
        }
        const cinematic = f.section === 0 && !f.open && !f.manual && !f.minimized;
        this.active = cinematic;
        this.director.step(f.dt, cinematic, f.reduced);
        const t = this.director.time, mobile = this.width < 650;
        this.canvas.dataset.shot = cinematic ? this.director.shot : 'companion';
        this.model.root.visible = f.visible && !f.minimized;
        let pose: Pose = JSON.parse(JSON.stringify(f.pose));
        if (cinematic) {
            const enter = f.reduced ? 1 : ease(t / 3), fly = Math.max(0, Math.min(1, (t - 7.5) / 2.6));
            this.camera.position.set(f.reduced ? 0 : Math.sin(t * .13) * .25, 1.2, mobile ? 12 : f.reduced ? 8.8 : 8.8 - Math.min(t, 24) * .025);
            this.camera.lookAt(0, 1, 0);
            this.camera.updateProjectionMatrix();
            this.model.root.position.set(-2.1 * (1 - enter), -.06 + (f.reduced ? 0 : Math.sin(t * 2) * .018), -5 * (1 - enter));
            this.model.root.scale.setScalar((mobile ? .88 : 1) * (f.reduced ? 1 : .06 + .94 * enter));
            this.model.root.rotation.set(0, f.reduced ? -.12 : t < 3 ? (1 - enter) * Math.PI * 4 : Math.sin(t * .45) * .18, 0);
            pose.root = { rot: 0 };
            pose.head = { rot: 0 };
            pose['upperArm.R'] = { rot: -135 };
            pose['foreArm.R'] = { rot: Math.sin(t * 9) * 16 };
            pose['upperArm.L'] = { rot: 6 };
            pose['foreArm.L'] = { rot: 0 };
            pose['thigh.L'] = { rot: 0 };
            pose['thigh.R'] = { rot: 0 };
            if (!f.reduced && t < 3) {
                this.model.root.rotation.z = Math.sin(t * 8) * (1 - enter) * .8;
                this.model.root.scale.y *= 1 + Math.sin(t * 7) * (1 - enter) * .3;
            }
            if (!f.reduced && t > 7.5 && t < 10.2) {
                this.model.root.position.set(Math.sin(fly * Math.PI * 2) * 2.1, .25 + Math.sin(fly * Math.PI) * 1.4, -Math.sin(fly * Math.PI) * 1.8);
                this.model.root.rotation.y = Math.sin(fly * Math.PI) * 1.3;
                this.model.root.rotation.z = -Math.sin(fly * Math.PI * 2) * .65;
                pose['upperArm.L'] = { rot: 100 };
                pose['upperArm.R'] = { rot: -100 };
                pose['thigh.L'] = { rot: -25 };
                pose['thigh.R'] = { rot: 35 };
            }
            if (t >= 10.2 && t < 16) {
                pose.head = { rot: Math.sin((t - 10.2) * 3) * 7 };
                pose['upperArm.R'] = { rot: -60 };
                pose['foreArm.R'] = { rot: -65 };
            }
            if (t >= 16) {
                pose['upperArm.R'] = { rot: -25 };
                pose['foreArm.R'] = { rot: 110 };
                pose['hand.R'] = { rot: -85 };
                pose.head = { rot: Math.sin(t * 1.2) * 2 };
                this.model.root.rotation.y = -.15;
            }
        }
        else {
            this.camera.position.set(0, 1.1, 8.8);
            this.camera.lookAt(0, 1.1, 0);
            this.camera.updateProjectionMatrix();
            this.camera.updateMatrixWorld(true);
            const z = f.reduced ? 0 : Math.max(-2.5, Math.min(.8, (f.scale - 1) * 1.2));
            this.model.root.position.copy(this.screenPoint(f.x, f.y, z));
            const screenHeight = 2 * (8.8 - z) * Math.tan(T.MathUtils.degToRad(19));
            const factor = screenHeight / this.height / .018;
            this.model.root.scale.setScalar(f.scale * factor);
            this.model.root.rotation.set(0, f.reduced ? 0 : Math.sin(f.time * .4) * .12, 0);
        }
        if (f.reduced && cinematic) {
            pose.root = { rot: 0 };
            pose.head = { rot: 0 };
            pose['upperArm.R'] = { rot: -90 };
            pose['foreArm.R'] = { rot: -15 };
        }
        this.model.pose(pose, f.time, f.viseme, f.section, f.reduced, f.working || (cinematic && t >= 16 && t < 24), f.book, f.page);
        this.portal.visible = cinematic && t < 4.2 && !f.reduced;
        this.portal.scale.setScalar(.6 + Math.sin(Math.min(t, 3) / 3 * Math.PI) * .5);
        this.portal.rotation.z = f.reduced ? 0 : t * .16;
        const portalShader = (this.portal.children[1] as T.Mesh).material as T.ShaderMaterial;
        if (portalShader.uniforms)
            portalShader.uniforms.clock.value = t;
        this.floor.visible = cinematic;
        this.sparks.visible = cinematic;
        this.key.castShadow = cinematic;
        this.key.intensity = cinematic ? 65 : 52;
        this.rim.intensity = cinematic ? 40 : 26;
        this.renderer.setClearColor('#090e1b', 0);
        const velocity = this.model.root.position.clone().sub(this.prior);
        this.model.secondary(velocity.x / Math.max(.01, f.dt), velocity.y / Math.max(.01, f.dt), f.dt, f.reduced);
        if (!f.reduced && this.model.root.visible && velocity.length() / Math.max(.01, f.dt) > 3 && f.time - this.lastSmear > .7) {
            this.smearFrames = 2;
            this.lastSmear = f.time;
        }
        const copyPose = (a: T.Object3D, b: T.Object3D) => {
            b.position.copy(a.position);
            b.quaternion.copy(a.quaternion);
            b.scale.copy(a.scale);
            b.visible = a.visible;
            for (let j = 0; j < a.children.length; j++)
                copyPose(a.children[j], b.children[j]);
        };
        for (let i = 0; i < this.ghosts.length; i++) {
            const ghost = this.ghosts[i];
            ghost.visible = this.smearFrames > 0 && !f.reduced && this.model.root.visible;
            if (ghost.visible) {
                copyPose(this.model.root, ghost);
                ghost.position.sub(velocity.clone().multiplyScalar((i + 1) * 1.8));
            }
        }
        if (this.smearFrames > 0)
            this.smearFrames--;
        this.prior.copy(this.model.root.position);
        this.scene.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);
        this.model.bones.get('mouth')!.localToWorld(this.mouth.set(.34, 0, .65));
        this.model.bones.get('hips')!.getWorldPosition(this.rootScreen);
        this.renderer.render(this.scene, this.camera);
        this.canvas.dataset.meshes = String(this.renderer.info.render.triangles);
        if (cinematic && !f.reduced) {
            const effect = this.director.effect();
            if (effect)
                soundscape.event(effect, 0, .7);
        }
        const bagPoint = this.project(this.model.bag.getWorldPosition(new T.Vector3()));
        const bag = document.getElementById('jimmy-bag')!;
        bag.style.left = (bagPoint.x - 16) + 'px';
        bag.style.top = (bagPoint.y - 16) + 'px';
        const hip = this.project(this.rootScreen), head = this.project(this.model.head.getWorldPosition(new T.Vector3())), foot = this.project(this.model.bones.get('foot.R')!.getWorldPosition(new T.Vector3()));
        const hit = document.getElementById('richie-hit')!;
        if (!f.minimized && this.model.root.visible) {
            hit.hidden = false;
            const size = Math.max(60, Math.min(this.width * .8, Math.abs(foot.y - head.y) * .72));
            hit.style.left = (hip.x - size / 2) + 'px';
            hit.style.top = Math.max(65, head.y - 55) + 'px';
            hit.style.width = size + 'px';
            hit.style.height = Math.min(this.height - 80, Math.max(100, foot.y - head.y + 85)) + 'px';
        }
    }
    face() { return this.project(this.mouth); }
    get diagnostics() { return { real3D: true, triangles: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls, shot: this.director.shot, cameraZ: this.camera.position.z }; }
}
