// Firestore Service Layer
// All database operations for AI Diet app

// ==================== API KEY OPERATIONS ====================

/**
 * Get Gemini API key from Firestore config
 * @returns {Promise<string>} API key
 */
async function getApiKeyFromFirestore() {
    try {
        const docRef = db.collection('config').doc('gemini');
        const doc = await docRef.get();

        if (doc.exists) {
            return doc.data().apiKey;
        } else {
            throw new Error('API key not found in Firestore. Please add it via Firebase Console.');
        }
    } catch (error) {
        console.error('Error fetching API key:', error);
        throw error;
    }
}

// ==================== USER PROFILE OPERATIONS ====================

/**
 * Get user profile from Firestore
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile data
 */
async function getUserProfile(userId) {
    try {
        const docRef = db.collection('users').doc(userId).collection('data').doc('profile');
        const doc = await docRef.get();

        if (doc.exists) {
            return doc.data();
        } else {
            return null; // New user, no profile yet
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        throw error;
    }
}

/**
 * Save user profile to Firestore
 * @param {string} userId - User ID
 * @param {Object} profileData - Profile data {age, gender, weight, height, activity}
 * @returns {Promise<void>}
 */
async function saveUserProfile(userId, profileData) {
    try {
        // Calculate daily goals
        const dailyGoals = calculateDailyGoalsFromProfile(profileData);

        const dataToSave = {
            ...profileData,
            dailyGoals,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(userId).collection('data').doc('profile').set(dataToSave, { merge: true });

        console.log('✅ User profile saved');
        return dailyGoals;
    } catch (error) {
        console.error('Error saving user profile:', error);
        throw error;
    }
}

/**
 * Calculate daily goals from profile data
 * @param {Object} profile - {age, gender, weight, height, activity}
 * @returns {Object} Daily goals {calories, protein, carbs, fat}
 */
function calculateDailyGoalsFromProfile(profile) {
    const { age, gender, weight, height, activity } = profile;

    // BMR calculation (Mifflin-St Jeor equation)
    let bmr;
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // TDEE = BMR * activity factor
    const tdee = Math.round(bmr * parseFloat(activity));

    // Macro distribution (30% protein, 40% carbs, 30% fat)
    const proteinCalories = tdee * 0.30;
    const carbsCalories = tdee * 0.40;
    const fatCalories = tdee * 0.30;

    return {
        calories: tdee,
        protein: Math.round(proteinCalories / 4), // 4 kcal per gram
        carbs: Math.round(carbsCalories / 4),     // 4 kcal per gram
        fat: Math.round(fatCalories / 9)          // 9 kcal per gram
    };
}

// ==================== MEALS OPERATIONS ====================

/**
 * Get today's date string (for meal collection key)
 * @returns {string} Date string like "2024-12-20"
 */
function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Get all meals for today
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of meal objects
 */
async function getMealsForToday(userId) {
    try {
        const dateString = getTodayDateString();
        const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');
        const snapshot = await mealsRef.orderBy('timestamp', 'desc').get();

        const meals = [];
        snapshot.forEach(doc => {
            meals.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return meals;
    } catch (error) {
        console.error('Error fetching meals:', error);
        throw error;
    }
}

/**
 * Add a new meal
 * @param {string} userId - User ID
 * @param {Object} mealData - {name, calories, protein, carbs, fat}
 * @returns {Promise<string>} Document ID of created meal
 */
async function addMealToFirestore(userId, mealData) {
    try {
        const dateString = getTodayDateString();
        const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');

        const mealToSave = {
            ...mealData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            date: dateString
        };

        const docRef = await mealsRef.add(mealToSave);
        console.log('✅ Meal added:', docRef.id);

        // Increment API call counter for rate limiting
        await incrementApiCallCounter(userId);

        return docRef.id;
    } catch (error) {
        console.error('Error adding meal:', error);
        throw error;
    }
}

/**
 * Delete a meal
 * @param {string} userId - User ID
 * @param {string} mealId - Meal document ID
 * @returns {Promise<void>}
 */
async function deleteMealFromFirestore(userId, mealId) {
    try {
        const dateString = getTodayDateString();
        await db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items').doc(mealId).delete();
        console.log('✅ Meal deleted:', mealId);
    } catch (error) {
        console.error('Error deleting meal:', error);
        throw error;
    }
}

/**
 * Listen to real-time updates for today's meals
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to receive meals array
 * @returns {Function} Unsubscribe function
 */
function listenToTodayMeals(userId, callback) {
    const dateString = getTodayDateString();
    const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');

    return mealsRef.orderBy('timestamp', 'desc').onSnapshot(
        (snapshot) => {
            const meals = [];
            snapshot.forEach(doc => {
                meals.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(meals);
        },
        (error) => {
            console.error('Error listening to meals:', error);
        }
    );
}

// ==================== RATE LIMITING ====================

/**
 * Check if user has exceeded daily API call limit
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} True if within limit, false if exceeded
 */
async function checkRateLimit(userId) {
    try {
        const dateString = getTodayDateString();
        const rateLimitRef = db.collection('users').doc(userId).collection('rateLimit').doc(dateString);
        const doc = await rateLimitRef.get();

        const MAX_CALLS_PER_DAY = 100; // Adjust as needed

        if (doc.exists) {
            const callCount = doc.data().callCount || 0;
            return callCount < MAX_CALLS_PER_DAY;
        } else {
            return true; // No record yet, allow
        }
    } catch (error) {
        console.error('Error checking rate limit:', error);
        return true; // On error, allow (fail open)
    }
}

/**
 * Increment API call counter for rate limiting
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function incrementApiCallCounter(userId) {
    try {
        const dateString = getTodayDateString();
        const rateLimitRef = db.collection('users').doc(userId).collection('rateLimit').doc(dateString);

        await rateLimitRef.set({
            callCount: firebase.firestore.FieldValue.increment(1),
            lastCall: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.error('Error incrementing API call counter:', error);
    }
}

/**
 * Get remaining API calls for today
 * @param {string} userId - User ID
 * @returns {Promise<number>} Remaining calls
 */
async function getRemainingApiCalls(userId) {
    try {
        const dateString = getTodayDateString();
        const rateLimitRef = db.collection('users').doc(userId).collection('rateLimit').doc(dateString);
        const doc = await rateLimitRef.get();

        const MAX_CALLS_PER_DAY = 100;

        if (doc.exists) {
            const callCount = doc.data().callCount || 0;
            return Math.max(0, MAX_CALLS_PER_DAY - callCount);
        } else {
            return MAX_CALLS_PER_DAY;
        }
    } catch (error) {
        console.error('Error getting remaining API calls:', error);
        return 0;
    }
}

// ==================== INITIALIZATION ====================

/**
 * Initialize user data on first login
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
async function initializeNewUser(userId, email) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            // Create user document
            await userRef.set({
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ New user initialized:', userId);
        }
    } catch (error) {
        console.error('Error initializing user:', error);
    }
}
