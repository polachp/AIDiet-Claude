// Firebase Configuration and Initialization
// Import the functions you need from the SDKs you need

// Firebase configuration object
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAin9KU4sDbyB_GxGC_yBf96CodHFgyna0",
  authDomain: "ai-diet-calories-count.firebaseapp.com",
  projectId: "ai-diet-calories-count",
  storageBucket: "ai-diet-calories-count.firebasestorage.app",
  messagingSenderId: "75977167085",
  appId: "1:75977167085:web:00db4ac5dd60318ed63ce4"
};

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
