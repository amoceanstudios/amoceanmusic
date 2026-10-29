export class Bubble {
    el = document.getElementById('speech')!;
    text = document.getElementById('speech-text')!;
    chips = document.getElementById('chips')!;
    expiry = 0;
    show(text: string, expiry: number) { this.text.textContent = text; document.getElementById('live')!.textContent = text; this.el.hidden = false; this.expiry = expiry; this.chips.replaceChildren(); }
    chip(label: string, fn: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; this.chips.append(b); return b; }
    hide() { this.el.hidden = true; this.chips.replaceChildren(); }
    position(x: number, y: number) { const w = this.el.offsetWidth || 280, h = this.el.offsetHeight || 120; this.el.style.left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2)) + 'px'; this.el.style.top = Math.max(78, Math.min(innerHeight - h - 15, y - h - 22)) + 'px'; }
}
