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
 * @param {Object} profile - {age, gender, weight, height, activity, goal}
 * @returns {Object} Daily goals {calories, protein, carbs, fat, tdee, bmr, deficit}
 */
function calculateDailyGoalsFromProfile(profile) {
    const { age, gender, weight, activity, goal = 'maintain' } = profile;

    // BMR calculation (Oxford/Henry equation - 2005)
    // More accurate than Mifflin-St Jeor, based on 10,552 measurements worldwide
    let bmr;

    if (gender === 'male') {
        // Male Oxford/Henry equations by age group
        if (age < 30) {
            bmr = 16.0 * weight + 545;
        } else if (age < 60) {
            bmr = 14.2 * weight + 593;
        } else if (age < 70) {
            bmr = 13.0 * weight + 567;
        } else {
            bmr = 13.7 * weight + 481;
        }
    } else {
        // Female Oxford/Henry equations by age group
        if (age < 30) {
            bmr = 13.1 * weight + 558;
        } else if (age < 60) {
            bmr = 9.74 * weight + 694;
        } else if (age < 70) {
            bmr = 10.2 * weight + 572;
        } else {
            bmr = 10.0 * weight + 577;
        }
    }

    // TDEE = BMR * activity factor (maintenance calories)
    const tdee = Math.round(bmr * parseFloat(activity));

    // Apply percentage-based calorie adjustment based on goal
    let tdeePercentage = 1.0; // 100% = maintain
    switch (goal) {
        case 'loss-mild':
            tdeePercentage = 0.90; // -10%
            break;
        case 'loss-moderate':
            tdeePercentage = 0.85; // -15%
            break;
        case 'loss-aggressive':
            tdeePercentage = 0.80; // -20%
            break;
        case 'maintain':
        default:
            tdeePercentage = 1.0; // 0%
            break;
    }

    // Target calories (TDEE * percentage)
    const targetCalories = Math.round(tdee * tdeePercentage);
    const calorieAdjustment = targetCalories - tdee; // For display purposes

    // Macro distribution (30% protein, 40% carbs, 30% fat)
    const proteinCalories = targetCalories * 0.30;
    const carbsCalories = targetCalories * 0.40;
    const fatCalories = targetCalories * 0.30;

    return {
        calories: targetCalories,
        protein: Math.round(proteinCalories / 4), // 4 kcal per gram
        carbs: Math.round(carbsCalories / 4),     // 4 kcal per gram
        fat: Math.round(fatCalories / 9),         // 9 kcal per gram
        tdee: tdee,                               // Maintenance calories
        bmr: Math.round(bmr),                     // Basal metabolic rate
        deficit: calorieAdjustment                // Calorie adjustment (+/-)
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
 * Get date string for a specific date offset
 * @param {number} daysAgo - Number of days before today (0 = today)
 * @returns {string} Date string like "2024-12-20"
 */
function getDateString(daysAgo = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split('T')[0];
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
 * Get meals data for the last 7 days
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of objects with {date, meals, totalCalories}
 */
async function getWeeklyMealsData(userId) {
    try {
        const weekData = [];
        const promises = [];

        // Create promises for last 7 days (including today)
        for (let i = 6; i >= 0; i--) {
            const dateString = getDateString(i);
            const promise = (async () => {
                const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');
                const snapshot = await mealsRef.get();

                const meals = [];
                let totalCalories = 0;
                let totalProtein = 0;
                let totalCarbs = 0;
                let totalFat = 0;

                snapshot.forEach(doc => {
                    const meal = doc.data();
                    meals.push({
                        id: doc.id,
                        ...meal
                    });
                    totalCalories += meal.calories || 0;
                    totalProtein += meal.protein || 0;
                    totalCarbs += meal.carbs || 0;
                    totalFat += meal.fat || 0;
                });

                return {
                    date: dateString,
                    meals,
                    totalCalories,
                    totalProtein,
                    totalCarbs,
                    totalFat,
                    mealCount: meals.length
                };
            })();

            promises.push(promise);
        }

        // Wait for all promises to resolve
        const results = await Promise.all(promises);

        return results;
    } catch (error) {
        console.error('Error fetching weekly meals:', error);
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
