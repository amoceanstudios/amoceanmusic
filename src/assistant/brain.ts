import type { Signals } from './signals';
import { rules } from './rules';
import { intent } from './intents';
import type { Action, Reply } from './actions';
export interface AssistantBrain {
    observe(signal: Signals): void;
    decide(): Action | null;
    ask(text: string): Promise<Reply>;
}
export class LocalBrain implements AssistantBrain {
    signal: Signals | null = null;
    quiet = false;
    cooldowns = new Map<string, number>();
    now = 0;
    observe(s: Signals) { this.signal = { ...s }; }
    decide() { if (this.quiet || !this.signal)
        return null; for (const r of rules) {
        if (this.now - (this.cooldowns.get(r.id) ?? -Infinity) >= r.cooldown && r.trigger(this.signal)) {
            this.cooldowns.set(r.id, this.now);
            return r.action(this.signal);
        }
    } return null; }
    async ask(text: string) { return intent(text); }
}
