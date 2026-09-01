// notify.js — Toasts de feedback (remplace alert() / console.error muet)

/**
 * Affiche un toast éphémère en bas à droite.
 * @param {string} message  Texte à afficher.
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 * @param {number} [duration]  Durée en ms (défaut : 4000, 6000 pour les erreurs).
 */
function notify(message, type = 'info', duration) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    container.appendChild(toast);

    // Force le reflow pour déclencher la transition d'entrée.
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    const ttl = duration || (type === 'error' ? 6000 : 4000);
    const remove = () => {
        toast.classList.remove('toast-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        setTimeout(() => toast.remove(), 400);
    };
    setTimeout(remove, ttl);
    toast.addEventListener('click', remove);
}
