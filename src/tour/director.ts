import data from './stops.json' with {type:'json'};
import type { ToolId } from '../companion/tools';
import { soundscape } from '../audio/engine';

export type Gesture = 'wave'|'present'|'listen'|'hush'|'conduct'|'bow'|'point'|'inspect'|'calculate'|'write'|'time'|'read';
export type TourStop = {id:string;section:string;target:string;title:string;gesture:Gesture;text:string;panel:string;tool:string};
export const tourStops = data as TourStop[];
export type TourFrame = {x:number;y:number;size:number;z:number;roll:number;yaw:number;squash:number;travel:number;age:number;gesture:Gesture;aim:{x:number;y:number};target:string;frozen:boolean};
type Hooks = {wake:()=>void;say:(text:string)=>boolean;busy:()=>boolean;stopSpeech:()=>void;preview:(tool:ToolId)=>void;endPreview:()=>void;claimPreview:()=>void;available:()=>boolean};
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=(n:number)=>{n=clamp(n);return n*n*(3-2*n)};

/** The route is driven by live DOM bounds, never by the old section clips. */
export class TourDirector {
    status:'ready'|'playing'|'paused'|'finished'='ready';
    index=0;
    age=0;
    last:TourFrame|null=null;
    private prepared=false;
    private spoken=false;
    private endedAt=-1;
    private from={x:innerWidth*.8,y:innerHeight*.74};
    private startScroll=0;
    private destinationScroll=0;
    private priorScroll=scrollY;
    private auto=true;
    private readyAge=0;
    private panel='';
    private target:HTMLElement|null=null;
    private ui:HTMLElement;
    private ring:HTMLElement;
    private label:HTMLElement;
    private pauseButton:HTMLButtonElement;
    private requestedScroll=false;
    constructor(private hooks:Hooks,private reduced:MediaQueryList){
        this.ui=document.createElement('nav');this.ui.id='jimmy-tour';this.ui.setAttribute('aria-label','Rondleiding door Jimmy');
        this.ui.innerHTML='<span class="tour-kicker">JIMMY’S SITE TOUR</span><span id="tour-progress"></span><strong id="tour-title">Een nieuwe route door de hele site</strong><div><button id="tour-previous" aria-label="Vorige stop">←</button><button id="tour-pause">Start tour</button><button id="tour-next" aria-label="Volgende stop">→</button><button id="tour-stop">Stop</button><select id="tour-chapter" aria-label="Ga naar een hoofdstuk"><option value="entrance">Intro & geluid</option><option value="tool-chat">Alle tools</option><option value="about">About</option><option value="work-0">Portfolio</option><option value="email-link">Contact</option><option value="farewell">Afscheid</option></select></div><small id="tour-hint">Klik op Jimmy om zelf aan de slag te gaan.</small>';
        document.body.append(this.ui);
        this.ring=document.createElement('div');this.ring.id='tour-focus';this.ring.setAttribute('aria-hidden','true');this.ring.hidden=true;document.body.append(this.ring);
        this.label=this.ui.querySelector('#tour-title')!;this.pauseButton=this.ui.querySelector('#tour-pause')!;
        this.pauseButton.onclick=()=>this.status==='playing'?this.pause():this.status==='paused'?this.resume():this.start();
        this.ui.querySelector<HTMLButtonElement>('#tour-next')!.onclick=()=>this.jump(this.index+1);
        this.ui.querySelector<HTMLButtonElement>('#tour-previous')!.onclick=()=>this.jump(this.index-1);
        this.ui.querySelector<HTMLButtonElement>('#tour-stop')!.onclick=()=>this.stop();
        this.ui.querySelector<HTMLSelectElement>('#tour-chapter')!.onchange=e=>this.seek((e.target as HTMLSelectElement).value);
        // Real input immediately hands control back, including scrolling during a shot.
        for(const event of ['wheel','touchstart','pointerdown','keydown'] as const)document.addEventListener(event,e=>{
            const el=e.target as HTMLElement;
            if(el.closest('#jimmy-tour')||el.closest('#start-experience,#replay-tour'))return;
            if(event==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' ','Escape','Tab','/'].includes((e as KeyboardEvent).key))return;
            if(event==='wheel'&&Math.abs((e as WheelEvent).deltaY)<1)return;
            this.auto=false;
            if(this.status==='playing'){
                const claim=!!el.closest('#jimmy-dialog,#richie-hit,#jimmy-bag,#help,#cinema-action');
                this.pause(claim);
                if(!claim)this.hooks.endPreview();
            }
        },{capture:true,passive:true});
        this.reduced.addEventListener('change',()=>{if(this.reduced.matches&&this.status==='playing')this.pause()});
        this.sync();
    }
    get running(){return this.status==='playing'}
    get stopData(){return tourStops[this.index]}
    get diagnostics(){return {status:this.status,index:this.index,total:tourStops.length,id:this.stopData.id,target:this.stopData.target,gesture:this.stopData.gesture,age:this.age,frame:this.last}}
    start(){this.hooks.wake();this.hooks.endPreview();this.index=0;this.status='playing';this.auto=false;this.prepareReset();this.sync()}
    seek(id:string){const i=tourStops.findIndex(s=>s.id===id);if(i>=0)this.jump(i)}
    jump(i:number){this.hooks.wake();this.hooks.stopSpeech();if(i>=tourStops.length){this.finish();return}this.index=clamp(i,0,tourStops.length-1);this.status='playing';this.auto=false;this.prepareReset();this.sync()}
    pause(claim=false){if(this.status!=='playing')return;this.status='paused';this.auto=false;this.hooks.stopSpeech();this.ring.hidden=true;if(claim)this.hooks.claimPreview();this.sync()}
    resume(){this.hooks.wake();this.status='playing';this.prepared=false;this.spoken=false;this.endedAt=-1;this.age=0;if(this.last)this.from={x:this.last.x,y:this.last.y};this.sync()}
    stop(){this.status='ready';this.auto=false;this.hooks.stopSpeech();this.hooks.endPreview();this.cleanPanels();this.ring.hidden=true;this.last=null;this.sync()}
    private finish(){this.status='finished';this.hooks.stopSpeech();this.hooks.endPreview();this.cleanPanels();this.ring.hidden=true;this.last=null;this.sync()}
    private prepareReset(){if(this.last)this.from={x:this.last.x,y:this.last.y};this.age=0;this.spoken=false;this.endedAt=-1;this.prepared=false;this.ring.hidden=true;this.hooks.stopSpeech()}
    private cleanPanels(){if(this.panel==='mixer'){document.getElementById('audio-mixer')!.hidden=true;document.getElementById('mixer-toggle')!.setAttribute('aria-expanded','false')}this.panel='';this.target?.removeAttribute('data-tour-target');this.target=null;document.body.removeAttribute('data-tour-playing')}
    private prepare(){
        const s=this.stopData;
        if(s.panel!==this.panel){this.cleanPanels();if(s.panel!=='bag')this.hooks.endPreview();this.panel=s.panel}
        if(s.panel==='mixer'){document.getElementById('audio-mixer')!.hidden=false;document.getElementById('mixer-toggle')!.setAttribute('aria-expanded','true')}
        if(s.panel==='bag')this.hooks.preview((s.tool||'chat') as ToolId);
        const section=document.getElementById(s.section)!;
        this.startScroll=scrollY;this.destinationScroll=section.getBoundingClientRect().top+scrollY;
        // Fixed preview panels get their own internal scroll, never scroll the document into a dialog.
        const target=document.querySelector<HTMLElement>(s.target);
        if(target&&s.panel==='bag'){
            const dialog=document.getElementById('jimmy-dialog')!;const details=dialog.querySelector('details')!;details.open=!!target.closest('details')&&!target.matches('summary');dialog.scrollTop=0;
            const nav=document.getElementById('jimmy-tools')!;
            if(target.closest('#jimmy-tools'))nav.scrollTop=target.offsetTop-nav.clientHeight*.45;
            else if(target.getBoundingClientRect().bottom>dialog.getBoundingClientRect().bottom-20)dialog.scrollTop=target.offsetTop-dialog.clientHeight*.48;
        }
        this.prepared=true;document.body.dataset.tourPlaying='true';this.sync();
    }
    tick(dt:number,canPlay:boolean):TourFrame|null{
        if(document.hidden)return this.running?this.last:null;
        this.readyAge+=dt;
        if(this.auto&&this.readyAge>1.1){this.auto=false;if(!this.reduced.matches&&!location.hash&&canPlay)this.start()}
        if(!this.running)return null;
        if(!canPlay||!this.hooks.available()){this.pause(true);return null}
        // Unexpected programmatic navigation also yields. Our own scrolling is marked below.
        if(this.prepared&&!this.requestedScroll&&Math.abs(scrollY-this.priorScroll)>5){this.pause(true);this.priorScroll=scrollY;return null}
        this.requestedScroll=false;
        if(!this.prepared)this.prepare();
        this.age+=Math.min(dt,.05);
        const scrollU=this.reduced.matches?1:ease(this.age/1.1);
        const desired=this.startScroll+(this.destinationScroll-this.startScroll)*scrollU;
        if(Math.abs(scrollY-desired)>1){scrollTo({top:desired,behavior:'instant'});this.requestedScroll=true}
        this.priorScroll=scrollY;
        const s=this.stopData,el=document.querySelector<HTMLElement>(s.target);
        const rect=el?.getBoundingClientRect();
        if(!el||!rect||rect.width<1||rect.height<1){if(this.age>1.5)this.jump(this.index+1);return this.last}
        this.target?.removeAttribute('data-tour-target');this.target=el;el.dataset.tourTarget='true';
        // Fit the full actor beside the highlighted control, not on its text or input.
        const mobile=innerWidth<650,size=mobile?148:224;
        const aim={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
        const leftSpace=rect.left,rightSpace=innerWidth-rect.right;
        let goalX=rightSpace>size*.8?rect.right+size*.48:rect.left-size*.48;
        let goalY=clamp(aim.y+size*.35,130+size*.58,innerHeight-115);
        if(Math.max(leftSpace,rightSpace)<size*.65){goalX=clamp(aim.x, size*.4,innerWidth-size*.4);goalY=rect.top>innerHeight*.5?rect.top-size*.22:rect.bottom+size*.72}
        goalX=clamp(goalX,size*.38,innerWidth-size*.38);goalY=clamp(goalY,120+size*.55,innerHeight-115);
        if(s.panel==='bag'){
            const drawer=document.getElementById('jimmy-dialog')!.getBoundingClientRect();
            if(mobile){goalX=innerWidth*.79;goalY=Math.max(size*.9,drawer.top-15)}
            else goalX=Math.max(size*.45,drawer.left-size*.53);
        }
        const u=this.reduced.matches?1:clamp((this.age-.24)/1.06),e=ease(u),arc=Math.sin(u*Math.PI);
        const bend=(this.index%2?1:-1)*Math.min(70,innerWidth*.1);
        const arrival=this.index===0;
        this.last={x:this.from.x+(goalX-this.from.x)*e+bend*arc,y:this.from.y+(goalY-this.from.y)*e-arc*65,size:size*(arrival? .07+.93*e:1-.22*arc),z:-arc*1.6,roll:this.reduced.matches?0:arc*(this.index%2?.25:-.25),yaw:this.reduced.matches?0:arc*(this.index%2?.6:-.6),squash:this.reduced.matches?1:this.age<.24?1-Math.sin(this.age/.24*Math.PI)*.17:1+Math.sin((this.age-1.3)*22)*Math.exp(-Math.max(0,this.age-1.3)*8)*.12*(u===1?1:0),travel:arc,age:this.age,gesture:s.gesture,aim,target:s.id,frozen:this.reduced.matches};
        const visible=rect.bottom>0&&rect.top<innerHeight&&u>.96;
        this.ring.hidden=!visible;
        Object.assign(this.ring.style,{left:Math.max(3,rect.left-6)+'px',top:Math.max(3,rect.top-6)+'px',width:Math.min(innerWidth-6,rect.width+12)+'px',height:Math.min(innerHeight-6,rect.height+12)+'px'});
        if(this.age>1.45&&!this.spoken&&this.hooks.say(s.text)){this.spoken=true;soundscape.event('reveal',aim.x/innerWidth*2-1,.25)}
        if(this.spoken&&!this.hooks.busy()){if(this.endedAt<0)this.endedAt=this.age;if(this.age-this.endedAt>.65)this.jump(this.index+1)}
        return this.last;
    }
    private sync(){this.ui.dataset.status=this.status;this.label.textContent=this.status==='ready'?'Laat Jimmy je alles laten zien':this.status==='finished'?'De hele site gezien. Jouw beurt!':this.stopData.title;this.ui.querySelector('#tour-progress')!.textContent=`${this.index+1} / ${tourStops.length}`;(this.ui.querySelector('#tour-chapter') as HTMLSelectElement).value=this.stopData.panel==='bag'?'tool-chat':({about:'about',portfolio:'work-0',contact:'email-link',bye:'farewell'} as Record<string,string>)[this.stopData.section]||'entrance';this.pauseButton.textContent=this.running?'Pauze':this.status==='paused'?'Verder':'Start tour';this.ui.querySelector('#tour-hint')!.textContent=this.status==='paused'?'Jij hebt de regie. Verder hervat de rondleiding.':'Scrollen of ergens klikken pauzeert de tour.';document.body.dataset.tourStatus=this.status;if(!this.running)document.body.removeAttribute('data-tour-playing')}
}
