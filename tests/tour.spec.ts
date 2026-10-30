import {test,expect} from '@playwright/test';
import {tourStops} from '../src/tour/director';
import {acting} from '../src/tour/acting';
import voices from '../src/audio/voices.json' with {type:'json'};
test('the new route covers every tool, all site sections and narrated distinct performances',()=>{
    expect(new Set(tourStops.map(s=>s.id)).size).toBe(tourStops.length);
    expect(new Set(tourStops.map(s=>s.section)).size).toBe(6);
    expect(tourStops.filter(s=>s.id.startsWith('tool-'))).toHaveLength(19);
    for(const s of tourStops){const voice=(voices as any)[s.text];expect(voice?.audio,s.id).toBeTruthy();expect(voice.cues.at(-1).v).toBe('rest')}
    const gestures=[...new Set(tourStops.map(s=>s.gesture))];
    expect(new Set(gestures.map(g=>JSON.stringify(acting(g,2.3,false)))).size).toBeGreaterThan(9);
});
for(const width of [1440,390])test(`every route target is real and visible at ${width}px, previews never execute tools`,async({page})=>{
    test.setTimeout(90000);await page.setViewportSize({width,height:900});
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    let outgoing=0;page.on('request',r=>{if(r.method()==='POST')outgoing++});
    await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-renderer','webgl');
    await page.locator('#continue-silent').click();
    const result=await page.evaluate((stops)=>{
        const api=(window as any).motionMusic,failures:string[]=[];
        localStorage.setItem('jimmy-note','Keep my real note');
        for(const stop of stops){
            api.tour.seek(stop.id);for(let i=0;i<34;i++)api.tour.tick(.05,true);
            api.world.render({dt:.05,time:performance.now()/1000,section:['load','welcome','about','portfolio','contact','bye'].indexOf(stop.section),x:100,y:400,scale:1,pose:{},viseme:'rest',reduced:false,minimized:false,manual:false,open:api.companion.isOpen,working:false,visible:true,book:0,page:0,tour:api.tour.last,tourPreview:api.companion.isTourPreview,taskPose:false});
            const el=document.querySelector(stop.target) as HTMLElement|null,r=el?.getBoundingClientRect();
            if(!r||r.width<1||r.height<1||r.top<0||r.bottom>innerHeight-15||r.left<0||r.right>innerWidth+1)failures.push(stop.id+': '+JSON.stringify(r));
            if(r){const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);if(hit!==el&&!el?.contains(hit))failures.push(stop.id+': obscured by '+(hit as HTMLElement)?.id)}
            if(api.tour.status!=='playing')failures.push(stop.id+': '+api.tour.status);
        }
        api.tour.stop();
        return {failures,note:localStorage.getItem('jimmy-note'),ai:(document.getElementById('jimmy-ai') as HTMLInputElement).checked,status:document.getElementById('form-status')!.textContent};
    },tourStops);
    expect(result.failures).toEqual([]);expect(result.note).toBe('Keep my real note');expect(result.ai).toBe(false);expect(result.status).toBe('');expect(outgoing).toBe(0);expect(errors).toEqual([]);
});
test('automatic sequencing waits for speech, wheel yields immediately, resume and Stop work',async({page})=>{
    await page.goto('/');await expect.poll(()=>page.evaluate(()=>(window as any).motionMusic.tour.status)).toBe('playing');
    await page.evaluate(()=>{const a=(window as any).motionMusic;a.tour.seek('ask');for(let i=0;i<34;i++)a.tour.tick(.05,true)});
    expect(await page.evaluate(()=>(window as any).motionMusic.player.busy)).toBe(true);
    expect(await page.evaluate(()=>(window as any).motionMusic.tour.stopData.id)).toBe('ask');
    await page.evaluate(()=>{const a=(window as any).motionMusic;a.player.step(100);for(let i=0;i<16;i++)a.tour.tick(.05,true)});
    expect(await page.evaluate(()=>(window as any).motionMusic.tour.stopData.id)).toBe('sound');
    await page.mouse.wheel(0,250);await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','paused');
    await page.locator('#tour-pause').click();await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','playing');
    await page.locator('#tour-stop').click();await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','ready');
    await page.locator('#quiet').click();await expect(page.locator('#jimmy-portal')).toBeVisible();await page.locator('#tour-pause').click();await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','playing');expect(await page.evaluate(()=>(window as any).motionMusic.companion.minimized)).toBe(false);await page.locator('#tour-stop').click();
    await expect(page.locator('#tour-focus')).toBeHidden();
});
test('the actor uses the target route in real 3D, and clicking him hands over the controls',async({page})=>{
    test.setTimeout(60000);await page.goto('/');await page.locator('#continue-silent').click();
    await page.evaluate(()=>{const a=(window as any).motionMusic;a.tour.seek('tool-calculate')});
    await expect(page.locator('#jimmy-webgl')).toHaveAttribute('data-shot','tour-tool-calculate');
    await page.waitForTimeout(1800);expect(await page.evaluate(()=>(window as any).motionMusic.world.model.workBoard.visible)).toBe(true);
    await page.screenshot({path:'/tmp/jimmy-tour-calculator.png'});
    const hit=await page.locator('#richie-hit').boundingBox();await page.mouse.click(hit!.x+hit!.width*.5,hit!.y+hit!.height*.35);
    await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','paused');await expect(page.locator('#jimmy-dialog')).toBeVisible();
    await page.locator('#jimmy-input').fill('(12 + 8) * 3');await page.locator('#jimmy-run').click();await expect(page.locator('#jimmy-result')).toHaveText('60');
});
test('reduced motion starts idle, explicit tour uses cuts without flight or camera motion',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.waitForTimeout(1500);
    await expect(page.locator('#jimmy-tour')).toHaveAttribute('data-status','ready');
    await page.locator('#tour-chapter').selectOption('about');await page.waitForTimeout(200);
    const f=await page.evaluate(()=>(window as any).motionMusic.tour.last);
    expect(f.travel).toBeCloseTo(0);expect(f.roll).toBe(0);expect(f.squash).toBe(1);
    expect(await page.evaluate(()=>(window as any).motionMusic.world.diagnostics.cameraZ)).toBe(8.8);
    await page.screenshot({path:'/tmp/jimmy-tour-reduced.png'});
});
