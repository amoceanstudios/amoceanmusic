import * as T from 'three';
import { JimmyModel } from './model';
import { acting } from '../tour/acting';
import type {TourFrame} from '../tour/director';
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
    tour: TourFrame|null;
    tourPreview: boolean;
    taskPose: boolean;
};
const ease = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
export class CinemaWorld {
    renderer: T.WebGLRenderer;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(38, 1, .05, 80);
    model = new JimmyModel();
    private routeHold:TourFrame|null=null;
    private routeSection=-1;
    private shotName="idle";
    private ambientAge=0;
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
    reset() { this.routeHold=null;this.ambientAge=0; }
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
        const route=f.tour;
        if(f.section!==this.routeSection){this.routeHold=null;this.routeSection=f.section;this.ambientAge=0}
        this.ambientAge+=f.dt;
        if(route)this.routeHold=route;
        const mobile=this.width<650,cinematic=f.section===0&&!f.open&&!f.manual&&!f.minimized;
        const t=route?.age??this.ambientAge;
        this.active=cinematic;
        this.shotName=route?'tour-'+route.target:f.open?'tool-focus':this.routeHold?'tour-hold':'companion';
        this.canvas.dataset.shot=this.shotName;
        this.model.root.visible=(route?true:f.visible)&&!f.minimized;
        this.camera.position.set(0,1.1,f.reduced?8.8:8.8-Math.sin(Math.min(t,5)*.2)*.08);
        this.camera.lookAt(0,1.1,0);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
        const held=!f.manual&&(!f.open||f.tourPreview)?this.routeHold:null;
        const stage=route||held;
        let pose:Pose;
        let z=0,size=mobile?160:230,px=this.width*.83,py=this.height*.76;
        if(stage){px=stage.x;py=stage.y;size=stage.size;z=route?stage.z:0;pose=acting(stage.gesture,route?stage.age:1.6,f.reduced||!route)}
        else if(f.manual){px=f.x;py=f.y;size=(mobile?170:230)*f.scale;pose=JSON.parse(JSON.stringify(f.pose))}
        else if(f.open){
            const r=document.getElementById('jimmy-dialog')!.getBoundingClientRect();
            px=mobile?this.width*.16:Math.max(110,r.left-115);py=mobile?this.height-115:Math.min(this.height-120,r.top+220);size=mobile?135:220;
            pose=acting(f.working?'calculate':'present',f.time,f.reduced);
        }else{
            // New companion blocking: small, readable, beside content. No legacy clip anchors or giant close-ups.
            const avoid=document.querySelector<HTMLElement>(['#cinema-copy','#welcome h1','#about .copy','#portfolio .grid','#contact .contact-copy','#bye h2'][Math.max(0,f.section)])?.getBoundingClientRect();
            if(avoid&&avoid.right<this.width-size*.6)px=Math.min(this.width-size*.38,avoid.right+size*.55);
            if(f.section===0){px=this.width*(mobile?.65:.64);py=this.height*.73;size=mobile?235:340}
            if(f.section===5)size*=Math.max(.001,f.scale/(mobile?.72:1.05));
            pose=acting(f.section===2?'read':f.section===4?'present':'wave',f.time,f.reduced);
        }
        const desired=this.screenPoint(px,py,z);
        if(!stage&&!f.manual&&this.prior.lengthSq()>0&&!f.reduced){
            const u=1-Math.exp(-f.dt*6);this.model.root.position.lerp(desired,u);
            if(this.ambientAge<1.2)this.model.root.position.y+=Math.sin(this.ambientAge/1.2*Math.PI)*f.dt*.8;
        }else this.model.root.position.copy(desired);
        const screenHeight=2*(this.camera.position.z-z)*Math.tan(T.MathUtils.degToRad(19));
        // The model is about 4.1 world units tall; keep the whole actor in the shot.
        this.model.root.scale.setScalar(size/this.height*screenHeight/4.1);
        this.model.root.rotation.set(0,stage?.yaw??(f.reduced?0:Math.sin(f.time*.5)*.08),stage?.roll??0);
        if(stage){this.model.root.scale.y*=stage.squash;this.model.root.scale.x/=Math.sqrt(stage.squash)}
        const gesture=stage?.gesture;
        if(!stage&&f.taskPose)pose=JSON.parse(JSON.stringify(f.pose));
        const reading=gesture==='read';
        this.model.pose(pose,f.time,f.viseme,f.section,f.reduced,f.working||gesture==='calculate',reading?1:f.book,reading?(Math.sin(t*1.7)*.5+.5):f.page);
        this.model.sceneProp(gesture,t,f.reduced);
        // Eye/head direction and two-bone pointing target the actual highlighted DOM rect.
        if(stage&&stage.travel<.08){
            this.scene.updateMatrixWorld(true);
            const aim=this.screenPoint(stage.aim.x,stage.aim.y,z);
            if(['present','point','inspect'].includes(stage.gesture))this.pointAt(aim);
            const local=this.model.root.worldToLocal(aim.clone());
            this.model.head.rotation.z+=T.MathUtils.clamp(local.x*.055,-.18,.18);
            this.model.head.rotation.y=T.MathUtils.clamp(local.x*.045,-.22,.22);
        }
        this.portal.visible = !!route && route.target==='entrance' && t < 2 && !f.reduced;
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
        if (route && route.age>.25 && route.age<.25+f.dt && !f.reduced) soundscape.event('whoosh',route.x/this.width*2-1,.45);
        const bagPoint = this.project(this.model.bag.getWorldPosition(new T.Vector3()));
        const bag = document.getElementById('jimmy-bag')!;
        bag.hidden=f.minimized||!this.model.root.visible;
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
            if(f.tourPreview){
                const drawer=document.getElementById('jimmy-dialog')!.getBoundingClientRect(),r=hit.getBoundingClientRect();
                // The actor may overlap the drawer visually, but its controls keep their hit area.
                if(mobile)hit.style.height=Math.max(20,Math.min(r.height,drawer.top-r.top-2))+'px';
                else hit.style.width=Math.max(20,Math.min(r.width,drawer.left-r.left-2))+'px';
                if(bagPoint.x>=drawer.left&&bagPoint.x<=drawer.right&&bagPoint.y>=drawer.top&&bagPoint.y<=drawer.bottom)bag.hidden=true;
            }
        }
    }
    private pointAt(target:T.Vector3){
        const local=this.model.root.worldToLocal(target.clone()),side=local.x>0?'R':'L';
        const upper=this.model.bones.get('upperArm.'+side)!,fore=this.model.bones.get('foreArm.'+side)!,hand=this.model.bones.get('hand.'+side)!;
        const joint=upper.parent!.worldToLocal(target.clone()).sub(upper.position);
        const a=fore.position.length(),b=hand.position.length(),d=T.MathUtils.clamp(Math.hypot(joint.x,joint.y),.06,a+b-.01);
        const elbow=(side==='R'?1:-1)*Math.acos(T.MathUtils.clamp((d*d-a*a-b*b)/(2*a*b),-1,1));
        const theta=Math.atan2(joint.y,joint.x)-Math.atan2(b*Math.sin(elbow),a+b*Math.cos(elbow));
        const restA=Math.atan2(fore.position.y,fore.position.x),restB=Math.atan2(hand.position.y,hand.position.x);
        upper.rotation.z=theta-restA;fore.rotation.z=elbow+restA-restB;hand.rotation.z=-.35;
    }
    face() { return this.project(this.mouth); }
    bounds(){
        const box=new T.Box3().setFromObject(this.model.root),points=[];
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(this.project(new T.Vector3(x,y,z)));
        return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
    }
    get diagnostics() { return { real3D: true, triangles: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls, shot: this.shotName, cameraZ: this.camera.position.z }; }
}
