import { tools, calculate, convert, duration, reminderTime, type ToolId } from './tools';
import { intent } from '../assistant/intents';
import { palette } from '../rig/palette';
import { AIClient } from './ai';
import { soundscape } from '../audio/engine';
import type { Pose } from '../rig/skeleton';
type Hooks = {
    go: (id: string) => void;
    say: (text: string) => void;
    stop: () => void;
    quiet: (value: boolean) => void;
    section: () => string;
    read: () => void;
    sound: (on: boolean) => Promise<void>;
};
type Reminder = {
    id: string;
    at: number;
    label: string;
};
export class Companion {
    onReenter:(()=>void)|null=null;
    manual: {
        x: number;
        y: number;
    } | null = null;
    minimized = false;
    forceIdle = false;
    state: 'idle' | 'working' | 'success' | 'error' = 'idle';
    tool: ToolId = 'chat';
    private born = performance.now();
    private changed = 0;
    private dragging = false;
    private offset = { x: 0, y: 0 };
    private start = { x: 0, y: 0 };
    private moved = false;
    private ai = new AIClient();
    private dialog: HTMLDialogElement;
    private input: HTMLTextAreaElement;
    private result: HTMLElement;
    private portal: HTMLButtonElement;
    private bag: HTMLButtonElement;
    private tray: HTMLElement;
    private reminders: Reminder[] = [];
    private noteUndo = '';
    private undoAction: (() => void) | null = null;
    private selectedFile: File | null = null;
    private image = '';
    private task = 0;
    private recognition: any = null;
    private watchStart = 0;
    private watchElapsed = 0;
    private watchRunning = false;
    private fired = new Set<string>();
    private interval: number;
    private timerPanel: HTMLElement;
    private portalArt: SVGEllipseElement;
    private prop: SVGGElement | null = null;
    constructor(private hooks: Hooks) {
        this.portalArt = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        this.portalArt.setAttribute('fill', palette.fur);
        this.portalArt.setAttribute('stroke', palette.belly);
        this.portalArt.setAttribute('stroke-width', '4');
        document.getElementById('overlay')!.prepend(this.portalArt);
        try {
            this.reminders = JSON.parse(localStorage.getItem('jimmy-reminders') || '[]').filter((r: Reminder) => typeof r.at === 'number' && Number.isFinite(r.at) && typeof r.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(r.id) && typeof r.label === 'string' && r.label.length < 300 && r.at > Date.now() - 86400000).slice(0, 20);
        }
        catch { }
        const box = document.createElement('div');
        box.innerHTML = `<button id="jimmy-portal" hidden aria-label="Jimmy terughalen">✦</button><button id="jimmy-bag" aria-label="Open Jimmy’s tas" title="Tools en vragen">▣</button><div id="jimmy-task" role="status" hidden><span></span><button id="jimmy-stop">Stop</button></div><dialog id="jimmy-dialog"><header><strong>Jimmy’s tas</strong><button id="jimmy-follow" title="Stop vaste plaatsing en volg de pagina">Volg</button><button id="jimmy-minimize" title="Minimaliseren">−</button><button id="jimmy-close" aria-label="Tas sluiten">×</button></header><label>Zoek een tool<input id="jimmy-filter" type="search" placeholder="rekenen, timer, vertalen…"></label><nav id="jimmy-tools" aria-label="Tools"></nav><h3 id="jimmy-title">Vraag Jimmy</h3><label for="jimmy-input">Opdracht of tekst</label><textarea id="jimmy-input" rows="4" placeholder="Een open vraag…"></textarea><input id="jimmy-file" type="file" hidden><div class="jimmy-actions"><button id="jimmy-run">OK ↗</button><button id="jimmy-cancel">Stop</button><button id="jimmy-selection">Gebruik selectie</button></div><div id="jimmy-extras"></div><pre id="jimmy-result" role="status" aria-live="polite"></pre><div class="jimmy-actions"><button id="jimmy-copy">Kopieer resultaat</button><button id="jimmy-undo">Undo</button><button id="jimmy-okay">Okay</button></div><details><summary>AI en privacy</summary><label><input id="jimmy-ai" type="checkbox"> AI toestaan voor mijn opdracht en sectienaam</label><label>Toegangscode (alleen deze sessie)<input id="jimmy-code" type="password" autocomplete="off"></label><p>Alleen na OK worden jouw opdracht en eventueel gekozen afbeelding naar de AI-provider gestuurd. Geen formulierinhoud of volledige pagina. Zonder AI blijven lokale tools werken. Weer en valuta gebruiken na OK Open-Meteo en Frankfurter; zoeken opent alleen na een klik een externe site.</p></details><p class="jimmy-small">/ opent de tas · Ctrl/⌘ + Enter voert uit · Escape sluit. Herinneringen klinken alleen zolang deze pagina open is; exporteer een agenda-item voor daarbuiten.</p></dialog><aside id="jimmy-timers" aria-label="Timers en herinneringen"></aside>`;
        document.body.append(box);
        const $ = (id: string) => document.getElementById(id)!;
        this.dialog = $('jimmy-dialog') as HTMLDialogElement;
        this.input = $('jimmy-input') as HTMLTextAreaElement;
        this.result = $('jimmy-result');
        this.portal = $('jimmy-portal') as HTMLButtonElement;
        this.bag = $('jimmy-bag') as HTMLButtonElement;
        this.tray = $('jimmy-task');
        this.timerPanel = $('jimmy-timers');
        $('jimmy-follow').onclick=()=>{this.manual=null;this.output('Ik volg de pagina weer.');};
        this.portal.onclick = () => { this.minimized = false; this.forceIdle = true; hooks.quiet(false); this.born = performance.now();this.onReenter?.(); soundscape.event('reveal'); };
        this.bag.onclick = () => this.open();
        $('jimmy-minimize').onclick = () => { this.setMinimized(true); this.dialog.close(); };
        $('jimmy-close').onclick = () => this.dialog.close();
        $('jimmy-run').onclick = () => void this.run();
        $('jimmy-cancel').onclick = $('jimmy-stop').onclick = () => this.stop(true);
        $('jimmy-okay').onclick = () => this.dialog.close();
        $('jimmy-undo').onclick = () => { this.stop(); this.undoAction?.(); this.undoAction = null; this.result.textContent = 'Taak gestopt / resultaat gesloten. Kopieën en externe tabbladen kun je hier niet terugdraaien.'; };
        $('jimmy-copy').onclick = () => void this.copy(this.result.textContent || '');
        $('jimmy-selection').onclick = () => { this.input.value = getSelection()?.toString() || ''; };
        $('jimmy-ai').onchange = e => { this.ai.enabled = (e.target as HTMLInputElement).checked; if (!this.ai.enabled)
            this.stop(); };
        $('jimmy-code').oninput = e => this.ai.code = (e.target as HTMLInputElement).value;
        $('jimmy-filter').oninput = e => this.renderTools((e.target as HTMLInputElement).value);
        this.input.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void this.run();
        } });
        this.dialog.addEventListener('close', () => this.recognition?.stop());
        $('jimmy-file').onchange = async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f)
            return; this.selectedFile = f; if (this.tool === 'ocr') {
            if (!['image/png', 'image/jpeg', 'image/webp'].includes(f.type) || f.size > 2800000) {
                this.output('Kies PNG/JPEG/WebP tot 2,8 MB.', true);
                return;
            }
            this.image = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });
            this.output(`Afbeelding gekozen: ${f.name}. Nog niets verzonden. Klik OK met AI ingeschakeld voor OCR.`);
        }
        else {
            if (f.size > 200000) {
                this.output('Tekstbestand te groot (max. 200 kB).', true);
                return;
            }
            this.input.value = await f.text();
            this.output(`Lokaal geopend: ${f.name}.`);
        } };
        this.renderTools('');
        this.select('chat');
        const hit = $('richie-hit');
        hit.style.touchAction = 'none';
        hit.onpointerdown = e => { if (e.button !== 0)
            return; this.dragging = true; this.moved = false; this.start = { x: e.clientX, y: e.clientY }; const r = hit.getBoundingClientRect(); this.offset = { x: e.clientX - (r.left + r.width / 2), y: e.clientY - (r.top + r.height * .90) }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
        hit.onpointermove = e => { if (!this.dragging)
            return; if (Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 6)
            this.moved = true; if (this.moved)
            this.manual = { x: Math.max(40, Math.min(innerWidth - 40, e.clientX - this.offset.x)), y: Math.max(190, Math.min(innerHeight - 60, e.clientY - this.offset.y)) }; };
        hit.onpointerup = () => { this.dragging = false; if (this.moved)
            soundscape.event('recoil', 0, .5); };
        hit.onpointercancel = () => this.dragging = false;
        hit.onclick = () => { if (!this.moved)
            this.open(); this.moved = false; };
        this.bag.onpointerdown=hit.onpointerdown;this.bag.onpointermove=hit.onpointermove;this.bag.onpointerup=hit.onpointerup;this.bag.onpointercancel=hit.onpointercancel;this.bag.onclick=hit.onclick;
        hit.setAttribute('aria-label', 'Jimmy: klik voor tools of sleep naar een vrije plek');
        document.addEventListener('keydown', e => { if (e.key === '/' && !(e.target as HTMLElement).closest('input,textarea,dialog')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this.open();
        } if (e.key === 'Escape')
            this.recognition?.stop(); }, true);
        this.interval = window.setInterval(() => this.tickTimers(), 250);
        this.tickTimers();
    }
    get isOpen(){return this.dialog.open}
    get intro() { return (performance.now() - this.born) / 1000 < 1.6 && !this.minimized; }
    setMinimized(v: boolean) { this.minimized = v; if (v)
        this.stop(); this.portal.hidden = !v; }
    open() { if (!this.dialog.open)
        this.dialog.showModal(); this.input.focus(); soundscape.event('nav', 0, .5); }
    private renderTools(q: string) { const nav = document.getElementById('jimmy-tools')!; nav.replaceChildren(); for (const group of [...new Set(tools.map(t => t.group))]) {
        const selected = tools.filter(t => t.group === group && (t.label + ' ' + t.id).toLowerCase().includes(q.toLowerCase()));
        if (!selected.length)
            continue;
        const label = document.createElement('small');
        label.textContent = group;
        nav.append(label);
        for (const t of selected) {
            const b = document.createElement('button');
            b.textContent = t.label;
            b.type = 'button';
            b.onclick = () => this.select(t.id);
            nav.append(b);
        }
    } }
    private select(id: ToolId) { this.stop(); this.tool = id; this.image = ''; this.selectedFile = null; const t = tools.find(t => t.id === id)!; document.getElementById('jimmy-title')!.textContent = t.label; this.input.placeholder = t.hint; this.input.value = ''; this.result.textContent = ''; const extras = document.getElementById('jimmy-extras')!; extras.replaceChildren(); const button = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.type = 'button'; b.onclick = fn; extras.append(b); }; if (id === 'notes')
        try {
            this.input.value = localStorage.getItem('jimmy-note') || '';
        }
        catch { } if (id === 'clipboard')
        button('Plakken na toestemming', () => void navigator.clipboard.readText().then(t => { this.input.value = t; }).catch(() => this.output('Plakken niet toegestaan. Gebruik Ctrl/⌘ + V.', true))); if (id === 'files' || id === 'ocr')
        button(id === 'ocr' ? 'Kies afbeelding' : 'Open tekstbestand', () => { const f = document.getElementById('jimmy-file') as HTMLInputElement; f.accept = id === 'ocr' ? 'image/png,image/jpeg,image/webp' : '.txt,.md,.csv'; f.value = ''; f.click(); }); if (id === 'files')
        button('Download tekst', () => this.download(this.input.value, 'jimmy-notitie.txt', 'text/plain')); if (id === 'image' || id === 'search')
        button(id === 'image' ? 'Open image generator ↗' : 'Open zoekresultaten ↗', () => { const q = encodeURIComponent(this.input.value); window.open(id === 'image' ? `https://chatgpt.com/?q=${q}` : `https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer'); this.output('Nieuw tabblad geopend na jouw klik. Geen zoekresultaten door Jimmy gelezen.'); this.setState('success'); }); if (id === 'dictation')
        this.result.textContent = 'Je browser kan spraak naar zijn eigen spraakdienst sturen. Klik alleen op Start als je daarmee akkoord bent.'; if (id === 'dictation')
        button('Start / stop microfoon', () => this.dictate()); if (id === 'stopwatch') {
        button('Start / pauze', () => { if (this.watchRunning)
            this.watchElapsed += Date.now() - this.watchStart;
        else
            this.watchStart = Date.now(); this.watchRunning = !this.watchRunning; });
        button('Reset', () => { this.watchRunning = false; this.watchElapsed = 0; this.output('Stopwatch gereset.'); });
    } if (id === 'reminder')
        button('Download laatste agenda-item', () => { const r = this.reminders.at(-1); if (!r) {
            this.output('Maak eerst een herinnering.', true);
            return;
        } const stamp = (n: number) => new Date(n).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); const safe = r.label.replace(/[\r\n]/g, ' ').replace(/([,;\\])/g, '\\$1'); this.download(`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Motion Music//Jimmy//NL\r\nBEGIN:VEVENT\r\nUID:${r.id}@motionmusic.example\r\nDTSTAMP:${stamp(Date.now())}\r\nDTSTART:${stamp(r.at)}\r\nDTEND:${stamp(r.at + 60000)}\r\nSUMMARY:${safe}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`, 'jimmy-herinnering.ics', 'text/calendar'); }); }
    private output(text: string, error = false) { this.result.textContent = text; this.hooks.say(text.length>180?'Ik laat het je in de tas zien.':text); this.setState(error ? 'error' : 'success'); }
    private setState(state: typeof this.state) { this.state = state; this.changed = performance.now(); this.tray.hidden = state !== 'working'; this.tray.querySelector('span')!.textContent = `Jimmy gebruikt: ${tools.find(t => t.id === this.tool)?.label}…`; if (state === 'success' || state === 'error')
        soundscape.event(state === 'success' ? 'success' : 'error', 0, .45); }
    stop(cancelSpeech = false) { if (cancelSpeech) {
        this.hooks.stop();
        if (this.watchRunning) {
            this.watchElapsed += Date.now() - this.watchStart;
            this.watchRunning = false;
        }
    } this.task++; this.ai.stop(); this.recognition?.stop(); this.recognition = null; this.state = 'idle'; this.tray.hidden = true; }
    private async copy(text: string) { try {
        await navigator.clipboard.writeText(text);
        this.output('Gekopieerd na jouw klik.');
        soundscape.event('copy');
    }
    catch {
        this.output('Clipboard niet beschikbaar. Selecteer tekst en kopieer handmatig.', true);
    } }
    private download(text: string, name: string, type: string) { const u = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
    async run(): Promise<void> {
        const raw = this.input.value.trim();
        if (this.tool === 'chat') {
            const fast = intent(raw);
            if (fast.intent === 'go') {
                this.hooks.go(fast.target!);
                this.output(fast.text);
                return;
            }
            if (fast.intent === 'read-about') {
                this.hooks.read();
                this.output('Ik lees About; sluit de tas om te kijken.');
                return;
            }
            if (fast.intent === 'sound-on' || fast.intent === 'sound-off') {
                await this.hooks.sound(fast.intent === 'sound-on');
                this.output(fast.text);
                return;
            }
            if (fast.intent === 'copy-email') {
                this.output('hello@motionmusic.example — gebruik Kopieer resultaat.');
                return;
            }
            if (fast.intent === 'quiet') {
                this.hooks.quiet(true);
                this.setMinimized(true);
                this.dialog.close();
                return;
            }
            if (fast.intent === 'help') {
                this.output('Gebruik de tas-tools, /calc, /timer, /translate, /ai, /go about, of vraag iets met AI ingeschakeld.');
                return;
            }
        }
        const match = raw.match(/^\/(\w+)\s*([\s\S]*)$/);
        if (match) {
            const aliases: Record<string, ToolId> = { calc: 'calculate', zoek: 'search', note: 'notes', timer: 'timer', translate: 'translate', ai: 'chat', weather: 'weather' };
            const id = aliases[match[1]] || tools.find(t => t.id === match[1])?.id;
            if (id) {
                this.select(id);
                this.input.value = match[2];
                return this.run();
            }
            if (match[1] === 'go') {
                this.hooks.go(match[2]);
                this.output('Ik navigeer; scroll terug om dit ongedaan te maken.');
                return;
            }
        }
        const ticket = ++this.task;
        this.setState('working');
        this.hooks.say(`Even ${tools.find(t => t.id === this.tool)!.label.toLowerCase()}…`);
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            if (ticket !== this.task)
                return;
            let answer = '';
            switch (this.tool) {
                case 'calculate':
                    answer = String(calculate(raw));
                    break;
                case 'convert':
                    answer = convert(raw);
                    break;
                case 'notes':
                    try {
                        this.noteUndo = localStorage.getItem('jimmy-note') || '';
                        localStorage.setItem('jimmy-note', this.input.value);
                        const previous = this.noteUndo;
                        this.undoAction = () => { try {
                            localStorage.setItem('jimmy-note', previous);
                            this.input.value = previous;
                        }
                        catch { } };
                        answer = 'Notitie lokaal opgeslagen. Undo herstelt de vorige versie.';
                    }
                    catch {
                        throw Error('Lokale opslag niet beschikbaar; download je notitie.');
                    }
                    break;
                case 'timer':
                case 'reminder': {
                    if (this.reminders.length >= 20)
                        throw Error('Maximaal 20 timers. Verwijder er eerst één.');
                    const [when, ...label] = raw.split('|');
                    const at = this.tool === 'timer' ? Date.now() + duration(when) : reminderTime(when);
                    const id = crypto.randomUUID();
                    this.reminders.push({ id, at, label: label.join('|').trim() || 'Jimmy-herinnering' });
                    this.undoAction = () => { this.reminders = this.reminders.filter(r => r.id !== id); this.saveReminders(); };
                    this.saveReminders();
                    answer = `Ingesteld: ${new Date(at).toLocaleString()}. Werkt als deze pagina open blijft; agenda-export kan ook.`;
                    break;
                }
                case 'stopwatch':
                    this.watchStart = Date.now();
                    this.watchRunning = true;
                    answer = 'Stopwatch loopt. Gebruik Start / pauze of Reset.';
                    break;
                case 'clipboard':
                    await this.copy(raw);
                    return;
                case 'files':
                    answer = this.selectedFile ? `Lokaal bestand: ${this.selectedFile.name}. Gebruik Download tekst om wijzigingen op te slaan.` : 'Kies Open tekstbestand of Download tekst. Geen bestanden worden automatisch geüpload.';
                    break;
                case 'search':
                case 'image':
                    answer = 'Gebruik de knop hierboven: alleen jouw klik opent de externe website.';
                    break;
                case 'dictation':
                    answer = 'Klik Start / stop microfoon. Browser kan zijn eigen spraakdienst gebruiken; toestemming vereist.';
                    break;
                case 'weather': {
                    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(raw)}&count=1`, { signal: AbortSignal.timeout(12000) }).then(r => { if (!r.ok)
                        throw Error('Weerzoekdienst niet beschikbaar.'); return r.json(); });
                    const p = geo.results?.[0];
                    if (!p)
                        throw Error('Plaats niet gevonden.');
                    const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,wind_speed_10m`, { signal: AbortSignal.timeout(12000) }).then(r => { if (!r.ok)
                        throw Error('Weerdienst niet beschikbaar.'); return r.json(); });
                    answer = `${p.name}: ${w.current.temperature_2m} °C, wind ${w.current.wind_speed_10m} km/u. Meting: ${w.current.time}. Bron: Open-Meteo.`;
                    break;
                }
                case 'currency': {
                    const m = raw.match(/^([\d.,]+)\s*([a-z]{3})\s+(?:naar|to|in)\s+([a-z]{3})$/i);
                    if (!m)
                        throw Error('Gebruik: 100 EUR naar USD.');
                    const r = await fetch(`https://api.frankfurter.dev/v1/latest?base=${m[2].toUpperCase()}&symbols=${m[3].toUpperCase()}`, { signal: AbortSignal.timeout(12000) }).then(async (r) => { if (!r.ok)
                        throw Error('Valutakoers niet beschikbaar.'); return r.json(); });
                    const rate = r.rates[m[3].toUpperCase()];
                    if (!Number.isFinite(rate))
                        throw Error('Deze valuta is niet beschikbaar.');
                    answer = `${(Number(m[1].replace(',', '.')) * rate).toFixed(2)} ${m[3].toUpperCase()} · referentiekoers ${r.date}, Frankfurter/ECB; geen live handelskoers.`;
                    break;
                }
                default:
                    if (this.tool === 'ocr' && !this.image)
                        throw Error('Kies eerst een afbeelding.');
                    if (!raw && this.tool !== 'ocr')
                        throw Error('Schrijf eerst je vraag of tekst.');
                    answer = await this.ai.ask(this.tool, raw, this.hooks.section(), this.tool === 'ocr' ? this.image : undefined);
            }
            if (ticket === this.task)
                this.output(answer);
        }
        catch (error) {
            if (ticket === this.task)
                this.output(error instanceof Error ? error.message : 'Dit lukte niet. Probeer opnieuw.', true);
        }
    }
    private dictate() { if (this.recognition) {
        this.recognition.stop();
        this.recognition = null;
        return;
    } const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Recognition) {
        this.output('Dictatie wordt door deze browser niet ondersteund. Gebruik de microfoon van je toetsenbord.', true);
        return;
    } const r = this.recognition = new Recognition(); r.lang = 'nl-NL'; r.interimResults = false; r.continuous = true; r.onresult = (event: any) => { for (let i = event.resultIndex; i < event.results.length; i++)
        if (event.results[i].isFinal)
            this.input.value += (this.input.value ? ' ' : '') + event.results[i][0].transcript; }; r.onerror = () => { this.output('Microfoon niet beschikbaar of toestemming geweigerd.', true); this.recognition = null; }; r.onend = () => { this.recognition = null; if (this.state === 'working')
        this.setState('idle'); }; r.start(); this.setState('working'); this.result.textContent = 'Microfoon actief. Stop stopt de opname; de browser kan een spraakdienst gebruiken.'; }
    private saveReminders() { try {
        localStorage.setItem('jimmy-reminders', JSON.stringify(this.reminders));
    }
    catch { } this.tickTimers(); }
    private tickTimers() { const now = Date.now(); if (this.tool === 'stopwatch' && this.watchRunning)
        this.result.textContent = `${((this.watchElapsed + now - this.watchStart) / 1000).toFixed(1)} s`; for (const row of this.timerPanel.querySelectorAll<HTMLElement>('[data-timer]'))
        if (!this.reminders.some(r => r.id === row.dataset.timer))
            row.remove(); for (const r of this.reminders) {
        let row = this.timerPanel.querySelector<HTMLElement>(`[data-timer="${r.id}"]`);
        if (!row) {
            row = document.createElement('div');
            row.dataset.timer = r.id;
            const label = document.createElement('span'), cancel = document.createElement('button');
            cancel.textContent = '×';
            cancel.setAttribute('aria-label', 'Verwijder ' + r.label);
            cancel.onclick = () => { this.reminders = this.reminders.filter(x => x.id !== r.id); this.saveReminders(); };
            row.append(label, cancel);
            this.timerPanel.append(row);
        }
        row.querySelector('span')!.textContent = `${r.label}: ${r.at <= now ? 'Tijd!' : Math.ceil((r.at - now) / 1000) + ' s'}`;
        if (r.at <= now && !this.fired.has(r.id)) {
            this.fired.add(r.id);
            let fired = false;
            try {
                fired = !!sessionStorage.getItem('jimmy-fired-' + r.id);
                sessionStorage.setItem('jimmy-fired-' + r.id, '1');
            }
            catch { }
            if (!fired) {
                soundscape.event('success');
                this.hooks.say(r.label + ': tijd!');
                this.portal.classList.add('attention');
            }
        }
    } }
    attach(hand: SVGGElement) { const ns = 'http://www.w3.org/2000/svg'; this.prop = document.createElementNS(ns, 'g'); this.prop.innerHTML = `<rect x="-21" y="0" width="50" height="31" rx="4" fill="${palette.paper}" stroke="${palette.outline}" stroke-width="2"/><text x="4" y="21" text-anchor="middle" font-size="17" fill="${palette.ink}" stroke="none">…</text>`; hand.append(this.prop); }
    frame(pose: Pose, section: number, age: number) {
        const t = (performance.now() - this.born) / 1000, taskTime = (performance.now() - this.changed) / 1000, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.portal.hidden = !(this.minimized || section === 5 && !this.forceIdle);
        this.portal.setAttribute('aria-label', this.minimized ? 'Jimmy terughalen' : 'Jimmy uit het afscheid-portaal terughalen');
        if (this.forceIdle && section !== 5)
            this.forceIdle = false;
        if (this.forceIdle) {
            pose.root = { sx: 1, sy: 1, rot: 0 };
            pose.head = { rot: 0 };
        }
        if (this.intro) {
            pose.root = { rot: reduced ? 0 : Math.sin(t * 8) * 10 * Math.exp(-t * 2), sx: reduced ? 1 : Math.max(.05, Math.min(1.2, t * 2)), sy: reduced ? 1 : Math.max(.05, 1 + Math.sin(t * 10) * .22 * Math.exp(-t)) };
            pose['upperArm.R'] = { rot: -140 };
            pose['foreArm.R'] = { rot: reduced ? 0 : Math.sin(t * 14) * 20 };
        }
        if (this.prop) {
            this.prop.setAttribute('visibility', this.state === 'working' ? 'visible' : 'hidden');
            this.prop.querySelector('text')!.textContent = this.tool === 'calculate' ? '±' : this.tool === 'timer' || this.tool === 'reminder' ? '◷' : this.tool === 'notes' ? '✎' : '…';
        }
        if (this.state === 'working') {
            pose['upperArm.R'] = { rot: -35 };
            pose['foreArm.R'] = { rot: 125 };
            pose['hand.R'] = { rot: -90 };
            pose.head = { rot: reduced ? 8 : 8 + Math.sin(taskTime * 5) * 4 };
            pose['browR'] = { ty: -4 };
            if (!reduced)
                pose.spine2 = { rot: 7 + Math.sin(taskTime * 7) * 3 };
        }
        if ((this.state === 'success' || this.state === 'error') && taskTime < 1.2 && !reduced) {
            const wave = Math.sin(taskTime * 12) * Math.exp(-taskTime * 2);
            pose.root = { sy: 1 - wave * .15, sx: 1 + wave * .12, ty: -Math.abs(wave) * 15 };
            pose['upperArm.L'] = { rot: this.state === 'success' ? 125 : -65 };
            pose['upperArm.R'] = { rot: this.state === 'success' ? -125 : 65 };
            pose.head = { rot: this.state === 'error' ? Math.sin(taskTime * 18) * 15 : 0 };
        }
        if (this.state !== 'working' && taskTime > 2)
            this.state = 'idle';
        this.bag.hidden = this.minimized;
    }
    position(x: number, y: number, scale: number) { this.portalArt.setAttribute('cx', String(x)); this.portalArt.setAttribute('cy', String(y + 60 * scale)); this.portalArt.setAttribute('rx', String(45 * scale)); this.portalArt.setAttribute('ry', String(11 * scale)); this.portalArt.setAttribute('opacity','0'); this.bag.style.left = Math.max(5, Math.min(innerWidth - 42, x + 26 * scale)) + 'px'; this.bag.style.top = Math.max(75, Math.min(innerHeight - 45, y - 60 * scale)) + 'px'; }
}
