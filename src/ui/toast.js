const host = () => document.getElementById('toasts');

export function toast(message, kind = 'info', ms = 4800) {
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`;
  el.setAttribute('role', kind === 'warn' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-mark" aria-hidden="true">${kind === 'warn' ? '!' : 'i'}</span><span></span>`;
  el.lastChild.textContent = message;
  host().appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
