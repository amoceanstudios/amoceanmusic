import type { Reply } from './actions';
export const commands = 'Try: go to load / welcome / about / portfolio / contact / bye; read about; show work; copy email; quiet; sound on/off; help.';
export function distance(a: string, b: string) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++)
    d[0][j] = j; for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1])); return d[a.length][b.length]; }
export function intent(text: string): Reply { const q = text.trim().toLowerCase(); if (/sound.*off|mute/.test(q))
    return { text: 'Sound off.', intent: 'sound-off' }; if (/sound.*on/.test(q))
    return { text: 'Sound on — a little synthesized babble.', intent: 'sound-on' }; if (/quiet|be quiet|stil/.test(q))
    return { text: 'Quiet mode. I’ll park in the corner. Use the moon button to bring me back.', intent: 'quiet' }; if (/copy.*email/.test(q))
    return { text: 'Click Copy email to copy the demo address.', intent: 'copy-email' }; if (/read.*about/.test(q))
    return { text: 'I’ll read our short story.', intent: 'read-about' }; if (/show work|portfolio/.test(q))
    return { text: 'Let’s look at the work.', intent: 'go', target: 'portfolio' }; const words = q.split(/\s+/), ids = ['load', 'welcome', 'about', 'portfolio', 'contact', 'bye']; let target = ids.find(id => words.includes(id)); if (!target && (q.includes('go') || words.length === 1))
    target = ids.find(id => words.some(w => w.length >= 4 && distance(w, id) <= 1)); if (target)
    return { text: `I’m taking you to ${target}. You can undo the scroll.`, intent: 'go', target }; if (/help|commands/.test(q))
    return { text: commands, intent: 'help' }; return { text: 'I’m not sure — little shrug! ' + commands, intent: 'unknown' }; }
