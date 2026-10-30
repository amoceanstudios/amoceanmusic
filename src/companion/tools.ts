export function calculate(source: string): number { const tokens = source.replace(/,/g, '.').match(/\d*\.?\d+(?:e[+-]?\d+)?|[()+*/%^\-]/gi) || []; if (tokens.join('') !== source.replace(/\s/g, '').replace(/,/g, '.') || tokens.length > 150)
    throw Error('Gebruik alleen getallen, haakjes en + − * / % ^.'); let i = 0; function atom(): number { const t = tokens[i++]; if (t === '(') {
    const v = expr();
    if (tokens[i++] !== ')')
        throw Error('Haakje ontbreekt.');
    return v;
} if (!t || !/^\d*\.?\d+(e[+-]?\d+)?$/i.test(t))
    throw Error('Ongeldige berekening.'); return Number(t); } function unary(): number { if (tokens[i] === '-') {
    i++;
    return -unary();
} if (tokens[i] === '+') {
    i++;
    return unary();
} return power(); } function power(): number { const a = atom(); return tokens[i] === '^' ? (i++, Math.pow(a, unary())) : a; } function term() { let v = unary(); while (['*', '/', '%'].includes(tokens[i])) {
    const op = tokens[i++], b = unary();
    v = op === '*' ? v * b : op === '/' ? v / b : v % b;
} return v; } function expr() { let v = term(); while (['+', '-'].includes(tokens[i])) {
    const op = tokens[i++], b = term();
    v = op === '+' ? v + b : v - b;
} return v; } const result = expr(); if (i !== tokens.length || !Number.isFinite(result))
    throw Error('Deze berekening heeft geen eindig resultaat.'); return Number(result.toPrecision(12)); }
export function duration(text: string) { if (/-\s*\d/.test(text))
    throw Error('Kies een positieve duur.'); const match = text.match(/(\d+(?:[.,]\d+)?)\s*(sec(?:onden)?|s|min(?:uten)?|m|uur|hours?|h)?/i); if (!match)
    throw Error('Bijvoorbeeld: 20 min.'); const n = Number(match[1].replace(',', '.')) * (/^h|uur/i.test(match[2] || '') ? 3600 : /^m/i.test(match[2] || '') ? 60 : 1); if (n <= 0 || n > 604800)
    throw Error('Kies 1 seconde tot 7 dagen.'); return Math.round(n * 1000); }
export function reminderTime(text: string, now = new Date()) { if (/morgen|tomorrow/i.test(text)) {
    const m = text.match(/(\d{1,2})[:.](\d{2})/);
    if (!m || +m[1] > 23 || +m[2] > 59)
        throw Error('Gebruik: morgen 09:00.');
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(+m[1], +m[2], 0, 0);
    return date.getTime();
} return now.getTime() + duration(text.replace(/^over\s+/i, '')); }
const units: Record<string, [
    string,
    number,
    number?
]> = { m: ['length', 1], cm: ['length', .01], km: ['length', 1000], mm: ['length', .001], inch: ['length', .0254], ft: ['length', .3048], mile: ['length', 1609.344], kg: ['mass', 1], g: ['mass', .001], lb: ['mass', .45359237], l: ['volume', 1], ml: ['volume', .001], c: ['temp', 1, 273.15], f: ['temp', 5 / 9, 255.3722222222], k: ['temp', 1, 0] };
export function convert(input: string) { const m = input.toLowerCase().match(/^\s*(-?[\d.,]+)\s*(\w+)\s+(?:naar|to|in)\s+(\w+)\s*$/); if (!m)
    throw Error('Bijvoorbeeld: 10 km naar mile, of 20 c naar f.'); const a = units[m[2]], b = units[m[3]]; if (!a || !b || a[0] !== b[0])
    throw Error('Deze eenheden kan ik niet combineren.'); return `${Number(((Number(m[1].replace(',', '.')) * a[1] + (a[2] || 0) - (b[2] || 0)) / b[1]).toFixed(6))} ${m[3]}`; }
export type ToolId = 'chat' | 'calculate' | 'search' | 'notes' | 'translate' | 'timer' | 'stopwatch' | 'reminder' | 'clipboard' | 'files' | 'image' | 'ocr' | 'dictation' | 'summarize' | 'rewrite' | 'spelling' | 'weather' | 'convert' | 'currency';
export const tools: {
    id: ToolId;
    label: string;
    group: string;
    hint: string;
}[] = [
    { id: 'chat', label: 'Vraag Jimmy', group: 'AI', hint: 'Een open vraag…' },
    { id: 'calculate', label: 'Calculator', group: 'Snel', hint: '(12 + 8) * 3' },
    { id: 'search', label: 'Web zoeken', group: 'Zoeken', hint: 'Zoekopdracht; opent zoekresultaten na jouw klik' },
    { id: 'notes', label: 'Notitieblok', group: 'Snel', hint: 'Je notitie; alleen lokaal opgeslagen' },
    { id: 'translate', label: 'Vertalen', group: 'AI', hint: 'Vertaal naar Engels: …' },
    { id: 'timer', label: 'Timer / keukentimer', group: 'Tijd', hint: '20 min' },
    { id: 'stopwatch', label: 'Stopwatch', group: 'Tijd', hint: 'Start, pauze en reset staan hieronder' },
    { id: 'reminder', label: 'Herinnering / agenda', group: 'Tijd', hint: 'morgen 09:00 | Bericht (lokale tijd)' },
    { id: 'clipboard', label: 'Clipboard', group: 'Bestanden', hint: 'Tekst om te kopiëren; plakken alleen na klik' },
    { id: 'files', label: 'Tekstbestand openen / opslaan', group: 'Bestanden', hint: 'Open lokaal .txt/.md/.csv of download deze tekst' },
    { id: 'image', label: 'Image generator', group: 'Zoeken', hint: 'Prompt voor je afbeelding; opent ChatGPT als shortcut' },
    { id: 'ocr', label: 'Tekst uit afbeelding', group: 'AI', hint: 'Kies een afbeelding; verzending pas na jouw AI-toestemming en OK' },
    { id: 'dictation', label: 'Dictatie', group: 'Bestanden', hint: 'Start microfoon alleen via de knop; browserafhankelijk' },
    { id: 'summarize', label: 'Samenvatten', group: 'AI', hint: 'Plak de tekst om samen te vatten' },
    { id: 'rewrite', label: 'Herschrijven', group: 'AI', hint: 'Bijvoorbeeld: maak vriendelijker: …' },
    { id: 'spelling', label: 'Spellingscheck', group: 'AI', hint: 'Tekst om te controleren' },
    { id: 'weather', label: 'Weer', group: 'Zoeken', hint: 'Plaatsnaam, bijvoorbeeld Amsterdam' },
    { id: 'convert', label: 'Eenheden omrekenen', group: 'Snel', hint: '10 km naar mile' },
    { id: 'currency', label: 'Valuta omrekenen', group: 'Zoeken', hint: '100 EUR naar USD' }
];
