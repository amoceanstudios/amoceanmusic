import { soundscape, type Channel } from './engine';
export function setupAudioUI(toggle: (on: boolean) => Promise<void>, start: () => Promise<void>) {
    const host = document.createElement('div');
    host.className = 'audio-controls';
    host.innerHTML = `<button id="mixer-toggle" aria-expanded="false" aria-controls="audio-mixer" title="Audio mixer">Mix</button><div id="audio-mixer" hidden><strong>Your sound mix</strong><p>Original local voice · adaptive score · motion SFX</p>${(['master', 'music', 'voice', 'sfx'] as Channel[]).map(id => `<label>${{ master: 'Master', music: 'Music', voice: 'Jimmy’s voice', sfx: 'Sound effects' }[id]}<input data-channel="${id}" type="range" min="0" max="100" value="${Math.round(soundscape.levels[id] * 100)}"><output>${Math.round(soundscape.levels[id] * 100)}%</output></label>`).join('')}<button id="replay-tour" type="button">Replay experience ↺</button><span class="audio-status" id="audio-status" role="status">Sound is off. Start when you’re ready.</span><div class="audio-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>`;
    document.querySelector('.controls')!.append(host);
    const mixer = host.querySelector<HTMLElement>('#audio-mixer')!, button = host.querySelector<HTMLButtonElement>('#mixer-toggle')!;
    host.querySelector<HTMLButtonElement>('#replay-tour')!.onclick = async () => { mixer.hidden = true; await start().catch(() => { document.getElementById('audio-status')!.textContent = 'Audio could not start. Try Sound on again.'; }); };
    button.onclick = () => { mixer.hidden = !mixer.hidden; button.setAttribute('aria-expanded', String(!mixer.hidden)); };
    host.querySelectorAll<HTMLInputElement>('[data-channel]').forEach(input => { input.setAttribute('aria-label', input.dataset.channel + ' volume'); input.addEventListener('input', () => { soundscape.setLevel(input.dataset.channel as Channel, Number(input.value) / 100); input.nextElementSibling!.textContent = input.value + '%'; }); });
    document.addEventListener('pointerdown', e => { if (!host.contains(e.target as Node)) {
        mixer.hidden = true;
        button.setAttribute('aria-expanded', 'false');
    } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') {
        mixer.hidden = true;
        button.setAttribute('aria-expanded', 'false');
    } if (e.key.toLowerCase() === 'm' && !(e.ctrlKey || e.metaKey || e.altKey) && !(e.target as HTMLElement).closest('input,textarea,dialog')) {
        void toggle(!soundscape.enabled);
    } });
    const invite = document.createElement('aside');
    invite.id = 'audio-invite';
    invite.innerHTML = '<span class="audio-kicker">BEST EXPERIENCED WITH SOUND</span><h2>Jimmy.<br>Lights. Camera. Play.</h2><p>A cartoon voice, a cinematic score, and a world that answers back.</p><div><button id="start-experience">Start experience ↗</button><button id="continue-silent">Continue silently</button></div><small>Headphones welcome. Volume starts gently.</small>';
    document.body.append(invite);
    let dismissed = false;
    invite.querySelector<HTMLButtonElement>('#continue-silent')!.onclick = () => { dismissed = true; invite.hidden = true; };
    invite.querySelector<HTMLButtonElement>('#start-experience')!.onclick = async () => { const b = invite.querySelector<HTMLButtonElement>('#start-experience')!; b.disabled = true; b.textContent = 'Getting Jimmy ready…'; try {
        await start();
        dismissed = true;
        invite.hidden = true;
    }
    catch {
        b.disabled = false;
        b.textContent = 'Try sound again';
        document.getElementById('audio-status')!.textContent = 'Audio could not start. You can continue silently.';
    } };
    document.addEventListener('click', e => { const el = (e.target as HTMLElement).closest('button,a'); if (!el || el.id === 'sound' || el.id === 'start-experience' || el.closest('#audio-mixer'))
        return; const rect = el.getBoundingClientRect(); soundscape.event('click', (rect.left + rect.width / 2) / innerWidth * 2 - 1, .7); });
    let lastHover: Element | null = null;
    document.addEventListener('pointerover', e => { const el = (e.target as HTMLElement).closest('button,a,[data-card]'); if (el && el !== lastHover) {
        lastHover = el;
        soundscape.event('hover', 0, .8);
    } });
    document.addEventListener('focusin', e => { if ((e.target as HTMLElement).matches('input,textarea'))
        soundscape.event('focus', 0, .55); });
    document.addEventListener('input', e => { if ((e.target as HTMLElement).matches('#contact input,#contact textarea'))
        soundscape.event('type', 0, .5); });
    return { update(section: number, level: number) { invite.hidden = dismissed || section !== 0 || soundscape.enabled; host.style.setProperty('--voice-energy', String(level)); }, status(text: string) { document.getElementById('audio-status')!.textContent = text; }, dismiss() { dismissed = true; invite.hidden = true; } };
}
