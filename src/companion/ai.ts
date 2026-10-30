export class AIClient {
    enabled = false;
    code = '';
    private controller: AbortController | null = null;
    stop() { this.controller?.abort(); this.controller = null; }
    async ask(task: string, text: string, section: string, image?: string) { if (!this.enabled)
        throw Error('AI staat uit. Zet AI expliciet aan; de lokale tools blijven zonder AI werken.'); if (!this.code)
        throw Error('Vul je toegangscode in. De beheerder stelt de AI-sleutel en toegangscode in bij Netlify.'); this.stop(); const controller = this.controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 45000); try {
        const r = await fetch('/.netlify/functions/jimmy', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jimmy-Code': this.code }, signal: controller.signal, body: JSON.stringify({ task, text, section, image }) });
        const data = await r.json().catch(() => ({ error: 'AI-endpoint niet beschikbaar. Gebruik de Netlify-deployment.' }));
        if (!r.ok)
            throw Error(data.error || 'AI-aanvraag mislukt.');
        return String(data.reply);
    }
    finally {
        clearTimeout(timeout);
        if (this.controller === controller)
            this.controller = null;
    } }
}
