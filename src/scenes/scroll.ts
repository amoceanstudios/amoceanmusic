import { clamp } from '../physics/path';
export const ids = ['load', 'welcome', 'about', 'portfolio', 'contact', 'bye'];
export function scene() { const h = innerHeight, y = scrollY; let index = 0; document.querySelectorAll('main section').forEach((s, i) => { if (s.getBoundingClientRect().top < h * .52)
    index = i; }); const el = document.getElementById(ids[index])!, r = el.getBoundingClientRect(); return { index, progress: clamp((h * .52 - r.top) / (r.height * .98)), raw: clamp(-r.top / r.height), y }; }
