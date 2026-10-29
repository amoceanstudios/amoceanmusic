import { ids } from '../scenes/scroll';
export function minimap(go: (id: string) => void) { const nav = document.getElementById('mini-nav')!; for (const id of ids) {
    const a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = id;
    a.onclick = e => { e.preventDefault(); go(id); };
    nav.append(a);
} return nav; }
