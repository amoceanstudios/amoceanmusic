export async function copyText(text: string) { try {
    await navigator.clipboard.writeText(text);
    return true;
}
catch {
    return false;
} }
export function selectionChip(onCopy: (text: string) => void) { const button = document.getElementById('copy-chip')!; let selected = ''; document.addEventListener('selectionchange', () => { const s = getSelection(); selected = s?.toString().trim() || ''; if (!selected)
    button.hidden = true;
else {
    const r = s!.rangeCount ? s!.getRangeAt(0).getBoundingClientRect() : null;
    if (r) {
        button.style.left = Math.max(8, Math.min(innerWidth - 160, r.left)) + 'px';
        button.style.top = Math.min(innerHeight - 50, Math.max(75, r.bottom + 8)) + 'px';
    }
} }); button.addEventListener('pointerdown', e => e.preventDefault()); button.onclick = () => onCopy(selected); return { show: () => { button.hidden = false; }, hide: () => { button.hidden = true; } }; }
