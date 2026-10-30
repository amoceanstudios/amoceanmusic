import type { Pose } from '../rig/skeleton';
import type { Gesture } from './director';

/** Distinct full-body business per function; no section clip is sampled here. */
export function acting(gesture:Gesture,age:number,reduced:boolean):Pose {
    const t=reduced?0:Math.max(0,age-1.3),beat=Math.sin(t*5),slow=Math.sin(t*2.4);
    const p:Pose={root:{rot:0},spine1:{rot:-4,sy:1+slow*.014},spine2:{rot:6},head:{rot:slow*2},fold:{rot:105},'upperArm.L':{rot:10},'foreArm.L':{rot:8},'upperArm.R':{rot:-10},'foreArm.R':{rot:-10},'thigh.L':{rot:0},'thigh.R':{rot:0}};
    const set=(id:string,rot:number)=>p[id]={rot};
    switch(gesture){
        case 'wave':set('upperArm.R',-150);set('foreArm.R',25+beat*23);set('hand.R',slow*20);set('head',-8);break;
        case 'conduct':set('upperArm.R',-70+slow*32);set('foreArm.R',-30+beat*35);set('upperArm.L',60-slow*25);set('foreArm.L',35-beat*20);set('spine2',6+slow*7);p.hips={ty:Math.abs(beat)*-3};break;
        case 'listen':set('upperArm.L',125);set('foreArm.L',-85);set('head',-12+slow*3);set('browL',-14);break;
        case 'hush':set('upperArm.R',-30);set('foreArm.R',-140);set('hand.R',-25);set('head',8);p.eyelids={sy:.7};break;
        case 'calculate':set('upperArm.R',-25);set('foreArm.R',110);set('hand.R',-85);set('upperArm.L',40);set('foreArm.L',-80+beat*8);set('head',10);p.hips={ty:-Math.abs(beat)*3};break;
        case 'write':set('upperArm.R',-60);set('foreArm.R',-40+beat*10);set('hand.R',-20+Math.sin(t*13)*15);set('upperArm.L',60);set('foreArm.L',90);set('head',8+slow*3);break;
        case 'time':set('upperArm.L',60);set('foreArm.L',80);set('upperArm.R',-35);set('foreArm.R',-100);set('head',15+slow*6);set('hand.R',beat*12);break;
        case 'read':set('upperArm.R',-25);set('foreArm.R',110);set('hand.R',-85);set('upperArm.L',35);set('foreArm.L',-110);set('head',8+slow*3);break;
        case 'inspect':set('head',-12+slow*4);set('spine1',-12);set('spine2',16);set('upperArm.L',60);set('foreArm.L',-90);set('browR',-20);break;
        case 'bow':{const bow=reduced?.18:Math.pow((1-Math.cos(Math.min(t,2)*Math.PI))/2,2);set('spine1',-6+bow*23);set('head',bow*18);set('upperArm.L',30+bow*45);set('upperArm.R',-30-bow*45);p.hips={ty:bow*5};break}
        case 'point':case 'present':set('upperArm.L',50);set('foreArm.L',-15);set('hand.L',-30);set('head',-5);break;
    }
    return p;
}
