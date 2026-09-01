// auth.js — Authentification Appwrite (session unique, persistante)
//
// Objectif : fermer l'accès aux collections Appwrite (permissions -> rôle `users`).
// L'app exige une session avant de charger quoi que ce soit. La session Appwrite
// dure ~1 an : le login n'est demandé qu'une fois par navigateur.

let currentUser = null;

async function getCurrentUser() {
    try {
        return await account.get();
    } catch {
        return null;
    }
}

async function doLogin(email, password) {
    // Ferme une éventuelle session résiduelle invalide avant d'en ouvrir une.
    try {
        await account.deleteSession('current');
    } catch {
        /* pas de session : normal */
    }
    await account.createEmailPasswordSession(email, password);
    currentUser = await account.get();
    return currentUser;
}

async function doLogout() {
    try {
        await account.deleteSession('current');
    } catch {
        /* ignore */
    }
    currentUser = null;
    location.reload();
}

function showLoginScreen(message) {
    const screen = document.getElementById('loginScreen');
    const appEl = document.querySelector('.app-container');
    if (appEl) appEl.hidden = true;
    if (!screen) return;
    screen.hidden = false;

    const form = document.getElementById('loginForm');
    const errEl = document.getElementById('loginError');
    const btn = form.querySelector('button[type="submit"]');
    if (message && errEl) errEl.textContent = message;

    form.onsubmit = async (e) => {
        e.preventDefault();
        errEl.textContent = '';
        btn.disabled = true;
        btn.textContent = 'Connexion…';
        try {
            await doLogin(
                document.getElementById('loginEmail').value.trim(),
                document.getElementById('loginPassword').value
            );
            location.reload();
        } catch (err) {
            errEl.textContent =
                err && err.code === 401
                    ? 'Identifiants incorrects.'
                    : 'Connexion impossible. Réessayez.';
            btn.disabled = false;
            btn.textContent = 'Se connecter';
        }
    };
    document.getElementById('loginEmail')?.focus();
}

function showApp() {
    const screen = document.getElementById('loginScreen');
    const appEl = document.querySelector('.app-container');
    if (screen) screen.hidden = true;
    if (appEl) appEl.hidden = false;

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.hidden = false;
        btnLogout.onclick = doLogout;
        const label = document.getElementById('logoutLabel');
        if (label && currentUser) label.textContent = currentUser.name || currentUser.email;
    }
}

// Point d'entrée : vérifie la session AVANT de démarrer l'app.
async function bootstrap() {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    currentUser = await getCurrentUser();
    if (!currentUser) {
        showLoginScreen();
        return;
    }
    showApp();
    if (typeof init === 'function') await init();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
