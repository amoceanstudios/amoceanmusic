import './style.css';
import { soundscape } from './audio/engine';
import { AudioBeats } from './audio/beats';
import { setupAudioUI } from './audio/ui';
import { SoundVisuals } from './audio/visuals';
import { Rig } from './rig/draw';
import type { Pose } from './rig/skeleton';
import { palette } from './rig/palette';
import { Spring } from './physics/spring';
import { catmull, clamp, safeAnchor, type Point } from './physics/path';
import { deform } from './physics/deform';
import { scene, ids } from './scenes/scroll';
import { clips, sample } from './scenes/director';
import { Player } from './lipsync/player';
import { autoCues, type Line } from './lipsync/autoCues';
import loadLine from './lipsync/lines/load.json';
import headerLine from './lipsync/lines/header.json';
import aboutLine from './lipsync/lines/about.json';
import portfolioLine from './lipsync/lines/portfolio.json';
import byeLine from './lipsync/lines/bye.json';
import { LocalBrain } from './assistant/brain';
import { initialSignals } from './assistant/signals';
import type { Action } from './assistant/actions';
import { Bubble } from './ui/bubble';
import { minimap } from './ui/minimap';
import { copyText, selectionChip } from './ui/chips';
import { setupForm } from './ui/form';
const svg = document.getElementById('overlay') as unknown as SVGSVGElement, rig = new Rig(svg), bubble = new Bubble(), player = new Player(), brain = new LocalBrain(), signals = initialSignals(), reduced = matchMedia('(prefers-reduced-motion: reduce)'), hit = document.getElementById('richie-hit')!, ask = document.getElementById('ask') as HTMLDialogElement;
const lines: (Line | null)[] = [loadLine as Line, headerLine as Line, aboutLine as Line, portfolioLine as Line, null, byeLine as Line];
let visits = 1;
try {
    visits = Number(localStorage.getItem('motion-music-visits') || 0) + 1;
    localStorage.setItem('motion-music-visits', String(visits));
}
catch { }
signals.visits = visits;
let time = 0, last = 0, acc = 0, index = -1, entered = 0, lastActivity = 0, lastScroll = scrollY, lastScrollTime = 0, lastDirection = 0, changes: number[] = [], hoverStart = 0, currentHover = '', pending: Action | null = null, pointUntil = 0, override: Point | null = null, overrideUntil = 0, scale = 1, scriptQueue: number[] = [], completed = new Set<number>(), activeScript = -1, shrugUntil = 0, footImpact = 0, lastVelocity = 0, smearFrames = 0, smearArmed = true, portfolioRelease = -1;
let pose: Pose = {}, current = scene(), renderPosition = { x: innerWidth * .5, y: innerHeight * .59 };
const x = new Spring(renderPosition.x), y = new Spring(renderPosition.y), ear = new Spring(105, 120, 8), tufts = [new Spring(0, 90, 6), new Spring(0, 90, 6), new Spring(0, 90, 6)], glassesX = new Spring(0, 200, 14), glassesY = new Spring(0, 200, 14), tie = new Spring(0, 80, 7);
const STEP = 1 / 24;
const springSnapshot = () => ({ x: x.value, y: y.value, ear: ear.value, gx: glassesX.value, gy: glassesY.value, tie: tie.value, tufts: tufts.map(t => t.value) });
let smoothPrevious = springSnapshot(), smoothCurrent = springSnapshot(), rootTransform = '';
const audioBeats = new AudioBeats(), soundVisuals = new SoundVisuals(svg);
const audioUI = setupAudioUI(toggleSound, startExperience);
soundscape.onEffect = (name, amount) => soundVisuals.effect(name, amount);
let previousClose = false;
async function startExperience() { player.line = null; await player.enable(); await soundscape.buffer(loadLine.audio); player.line = null; scriptQueue = []; completed.clear(); pending = null; visits = 1; index = -1; portfolioRelease = -1; audioBeats.reset(); lastActivity = time; scrollTo({ top: 0, behavior: 'instant' }); audioUI.status('Sound ready. Richie’s voice, music and effects are on.'); updateSoundButton(); }
function updateSoundButton() { document.body.dataset.audioOn = String(!player.muted); document.getElementById('sound')!.textContent = player.muted ? 'Sound off' : 'Sound on'; document.getElementById('sound')!.setAttribute('aria-pressed', String(!player.muted)); }
function announce(text: string, scripted = false) {
    if (player.busy)
        return false;
    const line = autoCues(text);
    player.start(line, scripted);
    bubble.show(text, time + line.duration + 3);
    return true;
}
function go(id: string) { const old = scrollY; document.getElementById(id)?.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' }); bubble.chip('Undo scroll', () => { scrollTo({ top: old, behavior: reduced.matches ? 'instant' : 'smooth' }); bubble.hide(); }); }
const nav = minimap(go), copy = selectionChip(async (text) => { const ok = await copyText(text); document.getElementById('live')!.textContent = ok ? 'Selected text copied. Clipboard changes cannot be undone here.' : 'Clipboard unavailable. Use your browser’s Copy command.'; copy.hide(); });
setupForm(signals);
function park(value: boolean) {
    brain.quiet = value;
    document.getElementById('quiet')!.setAttribute('aria-pressed', String(value));
    document.getElementById('quiet')!.textContent = value ? '☾ Quiet on' : '☾ Quiet';
    if (value) {
        pending = null;
        override = null;
        nav.hidden = true;
        copy.hide();
        if (!player.scripted) {
            player.line = null;
            bubble.hide();
        }
    }
    lastActivity = time;
}
document.getElementById('quiet')!.onclick = () => park(!brain.quiet);
async function toggleSound(on: boolean) { try {
    if (on) {
        await player.enable();
        audioUI.dismiss();
        audioUI.status('Sound on. Mix music, voice and effects here.');
    }
    else {
        player.muted = true;
        audioUI.status('All sound is muted.');
    }
    updateSoundButton();
}
catch {
    audioUI.status('Audio could not start. Tap Sound on to retry.');
    document.getElementById('live')!.textContent = 'Audio is unavailable in this browser.';
} }
document.getElementById('sound')!.onclick = () => void toggleSound(player.muted);
function openAsk() { lastActivity = time; ask.showModal(); (document.getElementById('question') as HTMLInputElement).focus(); }
hit.onclick = openAsk;
document.getElementById('help')!.onclick = openAsk;
addEventListener('keydown', e => {
    const el = e.target as HTMLElement;
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(el.tagName)) {
        e.preventDefault();
        openAsk();
    }
});
document.getElementById('ask-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('question') as HTMLInputElement;
    const reply = await brain.ask(input.value);
    document.getElementById('reply')!.textContent = reply.text;
    if (reply.intent === 'quiet')
        park(true);
    if (reply.intent === 'sound-on')
        await toggleSound(true);
    if (reply.intent === 'sound-off')
        await toggleSound(false);
    if (reply.intent === 'unknown')
        shrugUntil = time + 2;
    if (reply.intent === 'go') {
        ask.close();
        if (!player.busy)
            announce(reply.text);
        else
            document.getElementById('live')!.textContent = reply.text;
        go(reply.target!);
    }
    if (reply.intent === 'read-about') {
        ask.close();
        if (player.busy) {
            document.getElementById('live')!.textContent = 'I’ll finish this line, then read About.';
            scriptQueue.push(2);
        }
        else {
            completed.delete(2);
            go('about');
            scriptQueue.push(2);
        }
    }
    if (reply.intent === 'copy-email') {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'Copy email';
        b.onclick = async () => {
            const ok = await copyText('hello@motionmusic.example');
            b.textContent = ok ? 'Copied — demo email' : 'Use browser Copy instead';
            if (!ok)
                (document.getElementById('reply')!).textContent = 'hello@motionmusic.example';
        };
        document.getElementById('reply')!.append(b);
    }
});
for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const)
    addEventListener(event, () => lastActivity = time, { passive: true });
addEventListener('scroll', () => {
    lastActivity = time;
    const dy = scrollY - lastScroll, dir = Math.sign(dy);
    signals.speed = dy / Math.max(.016, time - lastScrollTime);
    signals.direction = dir;
    if (dir && lastDirection && dir !== lastDirection)
        changes.push(time);
    if (dir)
        lastDirection = dir;
    lastScroll = scrollY;
    lastScrollTime = time;
}, { passive: true });
document.querySelectorAll<HTMLElement>('[data-card]').forEach(el => { const enter = () => { currentHover = el.dataset.card!; hoverStart = time; }; const leave = () => { currentHover = ''; hoverStart = 0; }; el.addEventListener('pointerenter', enter); el.addEventListener('pointerleave', leave); el.addEventListener('focus', enter); el.addEventListener('blur', leave); });
function execute(a: Action) {
    if (!announce(a.text))
        return;
    const oldFocus = document.activeElement as HTMLElement | null, oldOverride = override, oldUntil = overrideUntil;
    let undo = () => { };
    if (a.kind === 'next') {
        pointUntil = time + 8;
        override = { x: innerWidth * .83, y: innerHeight * .83 };
        overrideUntil = time + 10;
        bubble.chip('Next ↓', () => go(ids[Math.min(5, current.index + 1)]));
        undo = () => { pointUntil = 0; override = oldOverride; overrideUntil = oldUntil; };
    }
    if (a.kind === 'nav') {
        nav.hidden = false;
        undo = () => nav.hidden = true;
    }
    if (a.kind === 'copy') {
        copy.show();
        undo = () => copy.hide();
    }
    if (a.kind === 'email' || a.kind === 'message') {
        const field = document.getElementById(a.kind === 'email' ? 'email' : 'message') as HTMLInputElement;
        const r = field.getBoundingClientRect();
        override = { x: Math.min(innerWidth - 35, r.right + 70), y: r.top + 50 };
        overrideUntil = time + 8;
        pointUntil = time + 8;
        if (a.kind === 'message') {
            field.focus();
            signals.emptyMessage = false;
        }
        if (a.kind === 'email')
            signals.invalidEmail = false;
        undo = () => { override = oldOverride; overrideUntil = oldUntil; pointUntil = 0; oldFocus?.focus(); };
    }
    if (a.kind === 'back') {
        undo = () => {
            visits = 1;
            completed.delete(0);
            entered = time;
            if (index !== 0)
                document.getElementById('load')!.scrollIntoView({ behavior: 'instant' });
        };
    }
    if (a.kind === 'narrow') {
        undo = () => { override = null; overrideUntil = 0; };
    }
    bubble.chip('Undo', () => {
        undo();
        bubble.hide();
        if (!player.scripted)
            player.line = null;
        lastActivity = time;
    });
    bubble.chip('Okay', () => { bubble.hide(); lastActivity = time; });
}
// Scripted speech is queued across scroll cuts; its real-time playhead never scrubs.
function startScript(i: number) {
    const l = lines[i];
    if (!l || player.busy)
        return false;
    player.start(l, true);
    activeScript = i;
    completed.add(i);
    bubble.show(l.text, time + l.duration + 3);
    return true;
}
const whirlwind = document.createElementNS(svg.namespaceURI, 'g');
whirlwind.setAttribute('stroke', palette.fur);
whirlwind.setAttribute('fill', 'none');
whirlwind.setAttribute('stroke-linecap', 'round');
for (let i = 0; i < 14; i++) {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', i % 3 === 0 ? 'M-8 0q8-9 16 0M0-8v-14' : 'M-12 0q12-6 24 0');
    path.setAttribute('stroke-width', i % 2 ? '3' : '5');
    whirlwind.append(path);
}
svg.insertBefore(whirlwind, rig.root);
function logic(dt: number) {
    if (document.hidden)
        return;
    smoothPrevious = smoothCurrent;
    time += dt;
    current = scene();
    if (current.index !== index) {
        index = current.index;
        entered = time;
        smearArmed = true;
        override = null;
        overrideUntil = 0;
        pointUntil = 0;
        if (index === 3)
            portfolioRelease = -1;
        if (index !== 0 && !completed.has(index) && lines[index])
            scriptQueue.push(index);
    }
    player.step(dt);
    if (player.busy)
        bubble.expiry = Math.max(bubble.expiry, time + 1.5);
    if (!player.busy && activeScript >= 0)
        activeScript = -1;
    let age = time - entered;
    let progress = current.progress;
    if (index === 0)
        progress = reduced.matches || visits > 1 ? 1 : clamp(age / 3.5);
    if (index === 1)
        progress = Math.max(progress, clamp(age / 4) * .96);
    if (index === 2)
        progress = Math.max(progress, clamp(age / 12) * .80);
    if (index === 3)
        progress = Math.max(progress, clamp(age / 4.8) * .95);
    if (index === 4)
        progress = Math.max(progress, clamp(age / 6));
    if (index === 5)
        progress = Math.max(progress, clamp(age / 6.5));
    if (!player.busy) {
        if (index === 0 && !completed.has(0) && (age > (reduced.matches || visits > 1 ? .3 : 2.4))) {
            if (visits > 1) {
                completed.add(0);
                pending = { id: 'back', kind: 'back', text: 'Welcome back! I skipped the long spin.' };
            }
            else
                startScript(0);
        }
        else if (scriptQueue.length) {
            const next = scriptQueue[0];
            const wait = next === 1 ? 2.8 : next === 2 ? 1.7 : next === 3 ? .3 : next === 5 ? .3 : 0;
            if (next !== index || age > wait) {
                scriptQueue.shift();
                if (!completed.has(next) || next === 2)
                    startScript(next);
            }
        }
    }
    if (signals.direction < 0 && time - lastScrollTime < 1.5 && index !== 0)
        progress = current.progress;
    const pan = clamp(x.value / innerWidth * 2 - 1, -1, 1);
    audioBeats.update(index, progress, pan, reduced.matches);
    const clip = clips[index];
    pose = sample(clip, reduced.matches ? .8 : progress);
    let target = catmull(clip.anchors.map(([a, b]) => ({ x: a / 100 * innerWidth, y: b / 100 * innerHeight })), progress);
    scale = innerWidth < 650 ? .72 : 1.05;
    let close = false;
    if (index === 3 && !brain.quiet && !reduced.matches) {
        const speakingClose = !completed.has(3) || activeScript === 3;
        if (speakingClose)
            portfolioRelease = -1;
        else if (portfolioRelease < 0) {
            portfolioRelease = time;
            soundscape.event('whoosh', 0, .6);
        }
        const pull = portfolioRelease < 0 ? 0 : clamp((time - portfolioRelease) / 1.2);
        close = pull < 1;
        if (close) {
            const u = pull * pull * (3 - 2 * pull);
            scale = 5.7 + (scale - 5.7) * u;
            target = { x: innerWidth * .5 + (target.x - innerWidth * .5) * u, y: (innerHeight * .55 + 110 * 5.7) * (1 - u) + target.y * u - Math.sin(pull * Math.PI) * 70 };
            if (speakingClose) {
                x.reset(target.x);
                y.reset(target.y);
            }
        }
    }
    if (brain.quiet) {
        target = { x: innerWidth - 35, y: innerHeight - 52 };
        scale = .42;
        pose = {};
    }
    else if (override && time < overrideUntil) {
        target = override;
        close = false;
        scale = innerWidth < 650 ? .65 : .9;
    }
    else if (innerWidth < 650 && !close && index !== 0) {
        target = { x: innerWidth - 55, y: innerHeight - 120 };
        scale = .62;
    }
    if (!close && index !== 0) {
        const boxes = [...document.querySelectorAll<HTMLElement>('[data-richie-avoid]')].map(e => e.getBoundingClientRect()).filter(r => r.bottom > 0 && r.top < innerHeight);
        const pivot = { x: target.x, y: target.y - 52 * scale };
        const free = safeAnchor(pivot, boxes, 70 * scale, 120 * scale, innerWidth, innerHeight);
        target = { x: free.x, y: free.y + 52 * scale };
    }
    // Literal near-collision: reserve the letter as an obstacle and stop the hand 5px away.
    if (index === 1 && progress > .35 && progress < .65 && innerWidth > 900 && !brain.quiet && !override) {
        const r = document.getElementById('letter-hitbox')!.getBoundingClientRect();
        target.x = Math.min(innerWidth - 60, r.right + 55 * scale + 5);
        target.y = r.bottom + 40;
    }
    const oldVX = x.velocity, oldVY = y.velocity;
    if (reduced.matches) {
        x.reset(target.x);
        y.reset(target.y);
    }
    else {
        for (let i = 0; i < 5; i++) {
            x.step(target.x, dt / 5);
            y.step(target.y + Math.sin(time * Math.PI * 1.2) * 6, dt / 5);
        }
    }
    if (!close && index !== 0 && !brain.quiet) {
        const obstacles = [...document.querySelectorAll<HTMLElement>('[data-richie-avoid]')].map(e => e.getBoundingClientRect()).filter(r => r.bottom > 0 && r.top < innerHeight);
        const free = safeAnchor({ x: x.value, y: y.value - 52 * scale }, obstacles, 70 * scale, 120 * scale, innerWidth, innerHeight);
        if (Math.hypot(free.x - x.value, free.y - (y.value - 52 * scale)) > 1) {
            x.reset(free.x);
            y.reset(free.y + 52 * scale);
        }
    }
    let speed = Math.hypot(x.velocity, y.velocity);
    const ax = (x.velocity - oldVX) / dt, ay = (y.velocity - oldVY) / dt;
    if (lastVelocity > 160 && speed < 75) {
        footImpact = 4;
        if (!reduced.matches)
            soundscape.event('land', pan, .45);
    }
    lastVelocity = speed;
    if (speed < 100)
        smearArmed = true;
    if (speed > 550 && smearArmed && !reduced.matches) {
        smearFrames = 2;
        smearArmed = false;
        soundscape.event('whoosh', pan, Math.min(1.2, speed / 800));
    }
    if (!reduced.matches) {
        for (let i = 0; i < 5; i++) {
            const h = dt / 5;
            ear.step(105 - clamp(ax * .006 + ay * .003, -40, 40), h);
            let prev = clamp(ax * .003, -25, 25) + Math.sin(time * 5) * 5;
            tufts.forEach(s => { s.step(prev, h); prev = s.value * .8; });
            glassesX.step(clamp(-ax * .0012, -5, 5), h);
            glassesY.step(clamp(-ay * .0012, -4, 4), h);
            tie.step(clamp(-ax * .006, -28, 28), h);
        }
    }
    else {
        ear.reset(105);
        tufts.forEach(t => t.reset(0));
        glassesX.reset(0);
        glassesY.reset(0);
        tie.reset(0);
    }
    pose.fold = { rot: ear.value };
    tufts.forEach((s, i) => pose['tuft' + (i + 1)] = { rot: s.value + (i === 2 ? Math.sign(x.velocity) * 10 : 0) });
    pose.glasses = { tx: glassesX.value, ty: glassesY.value };
    if (!reduced.matches) {
        pose.spine1 = { ...pose.spine1, sy: (pose.spine1?.sy ?? 1) * (1 + Math.sin(time * 2) * .02) };
        if (player.busy) {
            pose.head = { ...pose.head, ty: Math.sin(player.time * 12) * (1.3 + soundscape.energy * 2.4), rot: (pose.head?.rot || 0) + Math.sin(player.time * 7) * 2 };
            pose.browR = { ty: /[!?]/.test(player.line!.text) ? -4 : -1, rot: -6 };
            pose.tuft1 = { rot: (pose.tuft1?.rot || 0) + Math.sin(player.time * 12) * 4 };
        }
    }
    if (pointUntil > time) {
        pose['upperArm.R'] = { rot: -45 };
        pose['foreArm.R'] = { rot: -15 };
        pose['hand.R'] = { rot: 25 };
    }
    if (shrugUntil > time) {
        pose.shoulders = { ty: -5 };
        pose['upperArm.R'] = { rot: -100 };
        pose['foreArm.R'] = { rot: -50 };
        pose.head = { rot: 12 };
    }
    if (index === 5 && !reduced.matches && progress > .2 && progress < .65)
        pose.shoulders = { tx: Math.sin(time * 24) * 1.4, ty: Math.sin(time * 18) };
    if (footImpact > 0) {
        const squashes = [1, .92, 1.15, .7];
        pose.root = { ...pose.root, sy: squashes[footImpact - 1], sx: 1 / squashes[footImpact - 1] };
        footImpact--;
    }
    if (previousClose && !close && !reduced.matches)
        soundscape.event('reveal', pan, .75);
    previousClose = close;
    rig.pose(pose);
    const aboutOpen = index === 2 ? clamp((progress - .3) / .08) * (1 - clamp((progress - .80) / .08)) : 0;
    rig.props(aboutOpen, index === 4, index === 2 ? clamp((progress - .53) / .12) : 0, tie.value);
    const blink = time % 4.7 < .13;
    rig.face(player.viseme, dt, blink, index === 5 ? clamp((progress - .18) * 2) : 0, reduced.matches);
    let outerScale = scale;
    if (index === 5 && !brain.quiet)
        outerScale *= reduced.matches ? 1 : Math.max(.001, 1 - clamp((progress - .60) / .35));
    const deformation = deform(x.velocity, y.velocity), bank = reduced.matches ? 0 : deformation.bank;
    let deformTransform = '';
    if (!reduced.matches && speed > 100 && !close && !brain.quiet)
        deformTransform = ` rotate(${deformation.angle}) scale(${deformation.sx},${deformation.sy}) rotate(${-deformation.angle})`;
    renderPosition = { x: x.value, y: y.value };
    rig.root.setAttribute('transform', `translate(${x.value} ${y.value})${deformTransform} rotate(${bank}) scale(${outerScale})`);
    rig.smear(smearFrames > 0, x.velocity, y.velocity);
    if (smearFrames > 0)
        smearFrames--;
    const spinning = index === 0 && progress < .55 && visits === 1 && !reduced.matches;
    whirlwind.setAttribute('visibility', spinning ? 'visible' : 'hidden');
    whirlwind.setAttribute('transform', `translate(${x.value},${y.value - 55}) rotate(${time * 930})`);
    [...whirlwind.children].forEach((n, i) => { const a = i / 14 * Math.PI * 2, r = 35 + (i % 4) * 13; n.setAttribute('transform', `translate(${Math.cos(a) * r} ${Math.sin(a) * r * .65}) rotate(${i * 39})`); });
    rig.root.setAttribute('opacity', spinning ? '.32' : '1');
    const atom = index === 5 && progress > .94 && !reduced.matches && !brain.quiet;
    let dot = svg.querySelector('#atom');
    if (!dot) {
        dot = document.createElementNS(svg.namespaceURI, 'circle');
        dot.id = 'atom';
        dot.setAttribute('fill', palette.fur);
        svg.append(dot);
    }
    dot.setAttribute('cx', String(x.value));
    dot.setAttribute('cy', String(y.value - 1));
    dot.setAttribute('r', String(2.5 + Math.sin(time * 3) * .5));
    dot.setAttribute('visibility', atom ? 'visible' : 'hidden');
    const title = document.querySelector<HTMLElement>('h1')!;
    const titleP = index === 1 ? clamp(age / 1.1) : 1;
    title.style.opacity = String(reduced.matches ? 1 : titleP);
    title.style.transform = `scale(${.86 + .14 * titleP})`;
    document.querySelector<HTMLElement>('.portfolio-content')!.style.opacity = close ? '0' : '1';
    signals.section = index;
    signals.progress = current.progress;
    signals.idle = time - lastActivity;
    signals.hoverText = currentHover;
    signals.hoverTime = currentHover ? time - hoverStart : 0;
    signals.selection = getSelection()?.toString().trim() || '';
    signals.width = innerWidth;
    signals.reduced = reduced.matches;
    changes = changes.filter(t => time - t < 4);
    signals.changes = changes.length;
    brain.now = time;
    brain.observe(signals);
    if (!player.busy && scriptQueue.length === 0) {
        if (pending) {
            execute(pending);
            pending = null;
        }
        else {
            const action = brain.decide();
            if (action)
                execute(action);
        }
    }
    if (time > bubble.expiry && !player.busy)
        bubble.hide();
    if (!bubble.el.hidden)
        bubble.position(x.value, y.value - 165 * scale);
    const size = brain.quiet ? 40 : Math.max(40, 52 * scale);
    hit.style.width = size + 'px';
    hit.style.height = Math.min(220, 190 * scale) + 'px';
    hit.style.left = x.value - size / 2 + 'px';
    hit.style.top = Math.max(0, y.value - 170 * scale) + 'px';
    hit.hidden = close || atom;
    soundscape.tick(speed, pan, spinning);
    audioUI.update(index, soundscape.energy);
    smoothCurrent = springSnapshot();
    if (close || (Math.abs(x.velocity) + Math.abs(y.velocity) < 1 && Math.hypot(smoothCurrent.x - smoothPrevious.x, smoothCurrent.y - smoothPrevious.y) > 30))
        smoothPrevious = smoothCurrent;
    rootTransform = rig.root.getAttribute('transform') || '';
}
function frame(ms: number) {
    const dt = Math.min(.15, (ms - last) / 1000 || 0);
    last = ms;
    acc += dt;
    while (acc >= STEP) {
        logic(STEP);
        acc -= STEP;
    }
    // Interpolate springs only. Body/limb clips, mouth and smear exposures stay on 24 Hz ones.
    if (index >= 0 && !reduced.matches) {
        const alpha = acc / STEP, mix = (a: number, b: number) => a + (b - a) * alpha;
        rig.root.setAttribute('transform', rootTransform.replace(/^translate\([^)]*\)/, `translate(${mix(smoothPrevious.x, smoothCurrent.x)} ${mix(smoothPrevious.y, smoothCurrent.y)})`));
        const rotate = (id: string, value: number) => { const bone = rig.bones.get(id)!; bone.setAttribute('transform', (bone.getAttribute('transform') || '').replace(/rotate\([^)]*\)/, `rotate(${value})`)); };
        rotate('fold', mix(smoothPrevious.ear, smoothCurrent.ear));
        tufts.forEach((_, i) => rotate('tuft' + (i + 1), (pose['tuft' + (i + 1)]?.rot || 0) + mix(smoothPrevious.tufts[i], smoothCurrent.tufts[i]) - smoothCurrent.tufts[i]));
        rig.bones.get('glasses')!.setAttribute('transform', `translate(${mix(smoothPrevious.gx, smoothCurrent.gx)} ${-3 + mix(smoothPrevious.gy, smoothCurrent.gy)})`);
        rig.tie.setAttribute('transform', `rotate(${mix(smoothPrevious.tie, smoothCurrent.tie)})`);
    }
    soundVisuals.draw(dt, renderPosition.x, renderPosition.y, Math.min(1.1, scale), soundscape.energy, soundscape.enabled, reduced.matches);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { void soundscape.visibility(document.hidden).catch(() => { }); last = 0; acc = 0; });
// Useful for automated readiness checks; no debug menu is shown to visitors.
Object.assign(window, { motionMusic: { brain, signals, player, audio: soundscape, get state() { return { section: index, position: renderPosition, quiet: brain.quiet, time }; }, go } });
