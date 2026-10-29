import type { Signals } from './signals';
import type { Action } from './actions';
export type Rule = {
    id: string;
    cooldown: number;
    trigger: (s: Signals) => boolean;
    action: (s: Signals) => Action;
};
export const rules: Rule[] = [
    { id: 'message', cooldown: 20, trigger: s => s.emptyMessage, action: () => ({ id: 'message', kind: 'message', text: 'Your message is empty. I’m focusing the message field; write whatever feels right.' }) },
    { id: 'email', cooldown: 20, trigger: s => s.invalidEmail, action: () => ({ id: 'email', kind: 'email', text: 'That email doesn’t look complete. Missing an @ there? I’ll point it out.' }) },
    { id: 'back', cooldown: 60, trigger: s => s.visits > 1 && s.section === 0, action: () => ({ id: 'back', kind: 'back', text: 'Welcome back! I skipped the long spin. Your curiosity is still welcome.' }) },
    { id: 'nav', cooldown: 20, trigger: s => s.changes >= 3, action: () => ({ id: 'nav', kind: 'nav', text: 'Finding your way? I’m opening six little shortcuts.' }) },
    { id: 'hover', cooldown: 20, trigger: s => s.hoverTime > 1.5 && !!s.hoverText, action: s => ({ id: 'hover', kind: 'read', text: s.hoverText }) },
    { id: 'selection', cooldown: 20, trigger: s => s.selection.length > 0, action: () => ({ id: 'selection', kind: 'copy', text: 'Want a copy? I’ll show a button. Nothing is copied until you click.' }) },
    { id: 'narrow', cooldown: 120, trigger: s => s.width < 650, action: () => ({ id: 'narrow', kind: 'narrow', text: 'A smaller screen! I’m staying small and out of your way.' }) },
    { id: 'idle', cooldown: 25, trigger: s => s.idle > 8 && s.section < 5 && !s.focused, action: () => ({ id: 'idle', kind: 'next', text: 'Next one? Click Next when you’re ready.' }) }
];
