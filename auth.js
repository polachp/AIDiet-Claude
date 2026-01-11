// Authentication Functions for AI Diet App

// Firebase Auth error codes to Czech messages
const AUTH_ERROR_MESSAGES = {
    // Registration errors
    'auth/email-already-in-use': 'Tento email je již registrován. Zkuste se přihlásit.',
    'auth/weak-password': 'Heslo je príliš slabé. Použijte silnější heslo.',

    // Login errors
    'auth/user-not-found': 'Nesprávný email nebo heslo.',
    'auth/wrong-password': 'Nesprávný email nebo heslo.',
    'auth/user-disabled': 'Tento účet byl deaktivován.',
    'auth/too-many-requests': 'Príliš mnoho neúspěšných pokusů. Zkuste to prosím později.',

    // Common errors
    'auth/invalid-email': 'Neplatná emailová adresa.',
    'auth/network-request-failed': 'Chyba pripojení k internetu. Zkontrolujte své pripojení.',
    'auth/operation-not-allowed': 'Tato operace není povolena. Kontaktujte administrátora.',

    // Google-specific errors
    'auth/popup-closed-by-user': 'Prihlášení bylo zrušeno.',
    'auth/popup-blocked': 'Vyskakovací okno bylo blokováno prohlížečem. Povolte vyskakovací okna a zkuste to znovu.',
    'auth/account-exists-with-different-credential': 'Účet s tímto emailem již existuje. Zkuste se prihlásit jiným zpusobem.'
};

/**
 * Get Czech error message for Firebase auth error
 * @param {Error} error - Firebase auth error
 * @param {string} defaultMessage - Default message if error code not found
 * @returns {string} Czech error message
 */
function getAuthErrorMessage(error, defaultMessage) {
    return AUTH_ERROR_MESSAGES[error.code] || defaultMessage;
}

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
        const errorMessage = getAuthErrorMessage(error, 'Registrace se nezdařila. Zkuste to prosím znovu.');
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
        const errorMessage = getAuthErrorMessage(error, 'Prihlášení se nezdařilo. Zkuste to prosím znovu.');
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
        const errorMessage = getAuthErrorMessage(error, 'Prihlášení pres Google se nezdařilo.');
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

/**
 * Add Enter key handler to an element
 * @param {string} elementId - Element ID
 * @param {Function} handler - Function to call on Enter
 */
function addEnterKeyHandler(elementId, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handler();
        });
    }
}

// Enable Enter key for login/register
document.addEventListener('DOMContentLoaded', () => {
    // Login form
    addEnterKeyHandler('loginEmail', loginWithEmail);
    addEnterKeyHandler('loginPassword', loginWithEmail);

    // Register form
    addEnterKeyHandler('registerEmail', registerWithEmail);
    addEnterKeyHandler('registerPassword', registerWithEmail);
    addEnterKeyHandler('registerPasswordConfirm', registerWithEmail);
});
