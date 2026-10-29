import type { Signals } from '../assistant/signals';
export function setupForm(s: Signals) { const form = document.querySelector<HTMLFormElement>('#contact form')!, email = document.getElementById('email') as HTMLInputElement, msg = document.getElementById('message') as HTMLTextAreaElement, status = document.getElementById('form-status')!, err = document.getElementById('email-error')!; for (const field of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea')) {
    field.addEventListener('focus', () => { s.focused = field.id; s.blurred = ''; });
    field.addEventListener('blur', () => { s.focused = ''; s.blurred = field.id; if (field === email) {
        s.invalidEmail = email.value.length > 0 && !email.validity.valid;
        s.validation = s.invalidEmail ? 'email' : '';
        email.setAttribute('aria-invalid', String(s.invalidEmail));
        err.textContent = s.invalidEmail ? 'Please enter a complete email address.' : '';
    } });
    field.addEventListener('input', () => { field.removeAttribute('aria-invalid'); if (field === email) {
        s.invalidEmail = false;
        err.textContent = '';
    } if (field === msg)
        s.emptyMessage = false; status.textContent = ''; });
} form.addEventListener('submit', e => { e.preventDefault(); if (!msg.value.trim()) {
    s.emptyMessage = true;
    s.validation = 'message';
    msg.setAttribute('aria-invalid', 'true');
    status.textContent = 'Please write a message. Richie will point it out.';
    if (!s.focused)
        msg.focus();
    return;
} if (!form.checkValidity()) {
    form.reportValidity();
    s.validation = 'invalid';
    return;
} status.textContent = 'Sent locally — demo only. No message was transmitted.'; const undo = document.createElement('button'); undo.type = 'button'; undo.textContent = 'Undo sent status'; undo.onclick = () => { status.textContent = 'Sent status undone. Your text is unchanged.'; }; status.append(' ', undo); s.validation = 'sent'; }); }
