// Firebase Configuration and Initialization
// Import the functions you need from the SDKs you need

// ==================== MULTI-ENVIRONMENT SETUP ====================
// Automatically switches between DEV and PROD based on hostname

// 🔴 PRODUCTION Firebase Config (Vercel, GitHub Pages, etc.)
const firebaseConfigProd = {
  apiKey: "AIzaSyAin9KU4sDbyB_GxGC_yBf96CodHFgyna0",
  authDomain: "ai-diet-calories-count.firebaseapp.com",
  projectId: "ai-diet-calories-count",
  storageBucket: "ai-diet-calories-count.firebasestorage.app",
  messagingSenderId: "75977167085",
  appId: "1:75977167085:web:00db4ac5dd60318ed63ce4"
};

// 🟢 DEVELOPMENT Firebase Config (localhost)
const firebaseConfigDev = {
  apiKey: "AIzaSyBwVANu2ED26sEQxCOv2WahEmNK67MqijI",
  authDomain: "ai-diet-dev.firebaseapp.com",
  projectId: "ai-diet-dev",
  storageBucket: "ai-diet-dev.firebasestorage.app",
  messagingSenderId: "459622516977",
  appId: "1:459622516977:web:19a42430f9d406d1c68150"
};

/**
 * Get Firebase config based on current environment
 * @returns {Object} Firebase configuration object
 */
function getFirebaseConfig() {
  const hostname = window.location.hostname;

  // Check if running on localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('🟢 Environment: DEVELOPMENT (localhost)');
    console.log('📦 Using Firebase project: ai-diet-dev');
    return firebaseConfigDev;
  } else {
    console.log('🔴 Environment: PRODUCTION (' + hostname + ')');
    console.log('📦 Using Firebase project: ai-diet-calories-count');
    return firebaseConfigProd;
  }
}

// Select appropriate config
const firebaseConfig = getFirebaseConfig();

// Initialize Firebase
let app;
let auth;
let db;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();

    // Set persistence to LOCAL to remember user across sessions
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            console.log('✅ Firebase Auth persistence set to LOCAL');
        })
        .catch((error) => {
            console.error('❌ Error setting persistence:', error);
        });

    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// Auth state observer
let currentUser = null;

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User logged in:', user.email);
        currentUser = user;
        onUserLoggedIn(user);
    } else {
        console.log('❌ User logged out');
        currentUser = null;
        onUserLoggedOut();
    }
});

// Callback functions (will be implemented in app.js)
function onUserLoggedIn(user) {
    // Hide auth UI, show main app
    if (typeof showMainApp === 'function') {
        showMainApp(user);
    }
}

function onUserLoggedOut() {
    // Show auth UI, hide main app
    if (typeof showAuthUI === 'function') {
        showAuthUI();
    }
}

// Helper function to get current user
function getCurrentUser() {
    return currentUser;
}

// Helper function to check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}
