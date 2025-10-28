// Authentication Functions for AI Diet App

// ==================== UI TOGGLING ====================

/**
 * Show main app (hide auth screen)
 * @param {Object} user - Firebase user object
 */
function showMainApp(user) {
    console.log('🔓 Showing main app for user:', user.email);

    // Hide auth screen
    document.getElementById('authScreen').style.display = 'none';

    // Show main app
    document.getElementById('mainApp').style.display = 'block';

    // Initialize app for logged-in user
    if (typeof initializeApp === 'function') {
        initializeApp(user);
    }
}

/**
 * Show auth UI (hide main app)
 */
function showAuthUI() {
    console.log('🔒 Showing auth UI');

    // Show auth screen
    document.getElementById('authScreen').style.display = 'flex';

    // Hide main app
    document.getElementById('mainApp').style.display = 'none';

    // Clear any sensitive data
    if (typeof clearAppData === 'function') {
        clearAppData();
    }
}

/**
 * Toggle between login and register forms
 */
function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    hideAuthMessage();
}

function showLoginForm() {
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    hideAuthMessage();
}

// ==================== AUTH MESSAGES ====================

/**
 * Show auth message (error or success)
 * @param {string} message - Message text
 * @param {string} type - 'error' or 'success'
 */
function showAuthMessage(message, type = 'error') {
    const messageEl = document.getElementById('authMessage');
    messageEl.textContent = message;
    messageEl.className = `auth-message ${type}`;
    messageEl.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            hideAuthMessage();
        }, 5000);
    }
}

function hideAuthMessage() {
    const messageEl = document.getElementById('authMessage');
    messageEl.style.display = 'none';
}

// ==================== EMAIL/PASSWORD AUTHENTICATION ====================

/**
 * Register with email and password
 */
async function registerWithEmail() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerPasswordConfirm').value;

    // Validation
    if (!email || !password || !confirmPassword) {
        showAuthMessage('Vyplňte prosím všechna pole.', 'error');
        return;
    }

    if (password.length < 6) {
        showAuthMessage('Heslo musí mít minimálně 6 znaků.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAuthMessage('Hesla se neshodují.', 'error');
        return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAuthMessage('Zadejte platnou emailovou adresu.', 'error');
        return;
    }

    try {
        hideAuthMessage();
        console.log('📝 Registering user:', email);

        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('✅ User registered:', user.uid);

        // Initialize user in Firestore
        await initializeNewUser(user.uid, user.email);

        showAuthMessage('Registrace úspěšná! Přihlašování...', 'success');

        // Auth state observer will handle the transition to main app
    } catch (error) {
        console.error('❌ Registration error:', error);

        // User-friendly error messages
        let errorMessage = 'Registrace se nezdařila. Zkuste to prosím znovu.';

        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Tento email je již registrován. Zkuste se přihlásit.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Neplatná emailová adresa.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Registrace pomocí emailu není povolena. Kontaktujte administrátora.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Heslo je příliš slabé. Použijte silnější heslo.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Chyba připojení k internetu. Zkontrolujte své připojení.';
                break;
        }

        showAuthMessage(errorMessage, 'error');
    }
}

/**
 * Login with email and password
 */
async function loginWithEmail() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Validation
    if (!email || !password) {
        showAuthMessage('Vyplňte prosím email a heslo.', 'error');
        return;
    }

    try {
        hideAuthMessage();
        console.log('🔐 Logging in user:', email);

        // Sign in with Firebase Auth
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('✅ User logged in:', user.uid);

        showAuthMessage('Přihlášení úspěšné!', 'success');

        // Auth state observer will handle the transition to main app
    } catch (error) {
        console.error('❌ Login error:', error);

        // User-friendly error messages
        let errorMessage = 'Přihlášení se nezdařilo. Zkuste to prosím znovu.';

        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                errorMessage = 'Nesprávný email nebo heslo.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Neplatná emailová adresa.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'Tento účet byl deaktivován.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Příliš mnoho neúspěšných pokusů. Zkuste to prosím později.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Chyba připojení k internetu. Zkontrolujte své připojení.';
                break;
        }

        showAuthMessage(errorMessage, 'error');
    }
}

// ==================== GOOGLE AUTHENTICATION ====================

/**
 * Login with Google
 */
async function loginWithGoogle() {
    try {
        hideAuthMessage();
        console.log('🔐 Logging in with Google...');

        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });

        // Sign in with popup
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        console.log('✅ User logged in with Google:', user.uid);

        // Initialize user in Firestore if new
        await initializeNewUser(user.uid, user.email);

        showAuthMessage('Přihlášení přes Google úspěšné!', 'success');

        // Auth state observer will handle the transition to main app
    } catch (error) {
        console.error('❌ Google login error:', error);

        // User-friendly error messages
        let errorMessage = 'Přihlášení přes Google se nezdařilo.';

        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'Přihlášení bylo zrušeno.';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Vyskakovací okno bylo blokováno prohlížečem. Povolte vyskakovací okna a zkuste to znovu.';
                break;
            case 'auth/account-exists-with-different-credential':
                errorMessage = 'Účet s tímto emailem již existuje. Zkuste se přihlásit jiným způsobem.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Chyba připojení k internetu. Zkontrolujte své připojení.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Přihlášení přes Google není povoleno. Kontaktujte administrátora.';
                break;
        }

        showAuthMessage(errorMessage, 'error');
    }
}

// ==================== LOGOUT ====================

/**
 * Logout current user
 */
async function logoutUser() {
    try {
        console.log('🚪 Logging out user...');
        await auth.signOut();
        console.log('✅ User logged out successfully');

        // Auth state observer will handle the transition to auth UI
    } catch (error) {
        console.error('❌ Logout error:', error);
        alert('Odhlášení se nezdařilo. Zkuste to prosím znovu.');
    }
}

// ==================== KEYBOARD SHORTCUTS ====================

// Enable Enter key for login/register
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');

    if (loginEmail) {
        loginEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginWithEmail();
        });
    }

    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginWithEmail();
        });
    }

    // Register form
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const registerPasswordConfirm = document.getElementById('registerPasswordConfirm');

    if (registerEmail) {
        registerEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') registerWithEmail();
        });
    }

    if (registerPassword) {
        registerPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') registerWithEmail();
        });
    }

    if (registerPasswordConfirm) {
        registerPasswordConfirm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') registerWithEmail();
        });
    }
});
