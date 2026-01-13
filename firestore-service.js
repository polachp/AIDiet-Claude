// Firestore Service Layer
// All database operations for AI Diet app

// ==================== API KEY OPERATIONS ====================

/**
 * Get Gemini API key from Firestore config
 * @deprecated Use getAIProvidersConfig() instead
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

/**
 * Get AI Providers configuration from Firestore
 * @returns {Promise<Object>} AI providers config
 * Structure:
 * {
 *   defaultProvider: "gemini",
 *   providers: {
 *     gemini: { apiKey: "...", enabled: true, models: [...], ... },
 *     deepseek: { apiKey: "...", enabled: false, ... }
 *   },
 *   fallbackOrder: ["gemini", "deepseek"]
 * }
 */
async function getAIProvidersConfig() {
    try {
        const docRef = db.collection('config').doc('aiProviders');
        const doc = await docRef.get();

        if (doc.exists) {
            const config = doc.data();
            console.log('✅ AI Providers config loaded from Firestore');
            return config;
        } else {
            // Fallback: pokus o starý formát (pouze Gemini)
            console.warn('⚠️ aiProviders config not found, trying legacy format...');
            const legacyKey = await getApiKeyFromFirestore();

            // Vytvoř default config pro zpětnou kompatibilitu
            return {
                defaultProvider: 'gemini',
                providers: {
                    gemini: {
                        apiKey: legacyKey,
                        enabled: true,
                        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
                        apiVersions: ['v1beta', 'v1'],
                        capabilities: {
                            text: true,
                            images: true,
                            audio: true
                        }
                    }
                },
                fallbackOrder: ['gemini']
            };
        }
    } catch (error) {
        console.error('❌ Error fetching AI providers config:', error);
        throw error;
    }
}

/**
 * Save AI Providers configuration to Firestore
 * @param {Object} config - AI providers configuration
 * @returns {Promise<void>}
 */
async function saveAIProvidersConfig(config) {
    try {
        const docRef = db.collection('config').doc('aiProviders');
        await docRef.set(config, { merge: true });
        console.log('✅ AI Providers config saved to Firestore');
    } catch (error) {
        console.error('❌ Error saving AI providers config:', error);
        throw error;
    }
}

/**
 * Update default AI provider
 * @param {string} providerName - Provider name ('gemini', 'deepseek', etc.)
 * @returns {Promise<void>}
 */
async function updateDefaultProvider(providerName) {
    try {
        const docRef = db.collection('config').doc('aiProviders');
        await docRef.update({
            defaultProvider: providerName
        });
        console.log(`✅ Default provider updated to: ${providerName}`);
    } catch (error) {
        console.error('❌ Error updating default provider:', error);
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

// BMR coefficients (Oxford/Henry equation - 2005)
// Format: [multiplier, constant] for each age bracket
const BMR_COEFFICIENTS = {
    male: {
        30: [16.0, 545],   // age < 30
        60: [14.2, 593],   // age 30-59
        70: [13.0, 567],   // age 60-69
        Infinity: [13.7, 481]  // age 70+
    },
    female: {
        30: [13.1, 558],   // age < 30
        60: [9.74, 694],   // age 30-59
        70: [10.2, 572],   // age 60-69
        Infinity: [10.0, 577]  // age 70+
    }
};

// Goal to TDEE percentage mapping
const GOAL_PERCENTAGES = {
    'loss-mild': 0.90,      // -10%
    'loss-moderate': 0.85,  // -15%
    'loss-aggressive': 0.80, // -20%
    'maintain': 1.0          // 0%
};

/**
 * Calculate BMR using Oxford/Henry equation
 * @param {string} gender - 'male' or 'female'
 * @param {number} age - Age in years
 * @param {number} weight - Weight in kg
 * @returns {number} BMR in kcal
 */
function calculateBMR(gender, age, weight) {
    const coefficients = BMR_COEFFICIENTS[gender] || BMR_COEFFICIENTS.female;
    const ageBrackets = Object.keys(coefficients).map(Number).sort((a, b) => a - b);

    for (const bracket of ageBrackets) {
        if (age < bracket) {
            const [multiplier, constant] = coefficients[bracket];
            return multiplier * weight + constant;
        }
    }

    // Fallback to last bracket
    const lastBracket = ageBrackets[ageBrackets.length - 1];
    const [multiplier, constant] = coefficients[lastBracket];
    return multiplier * weight + constant;
}

/**
 * Calculate daily goals from profile data
 * @param {Object} profile - {age, gender, weight, height, activity, goal}
 * @returns {Object} Daily goals {calories, protein, carbs, fat, tdee, bmr, deficit}
 */
function calculateDailyGoalsFromProfile(profile) {
    const { age, gender, weight, activity, goal = 'maintain' } = profile;

    // BMR calculation (Oxford/Henry equation - 2005)
    const bmr = calculateBMR(gender, age, weight);

    // TDEE = BMR * activity factor (maintenance calories)
    const tdee = Math.round(bmr * parseFloat(activity));

    // Apply percentage-based calorie adjustment based on goal
    const tdeePercentage = GOAL_PERCENTAGES[goal] || 1.0;

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
        return snapshotToArray(snapshot);
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

// ==================== DAILY SUMMARIES ====================

/**
 * Recalculate and save daily summary for a specific date
 * Called automatically after add/update/delete meal operations
 * @param {string} userId - User ID
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {Promise<Object>} The calculated summary
 */
async function recalculateDailySummary(userId, dateString) {
    try {
        // Get all meals for the date
        const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');
        const snapshot = await mealsRef.get();

        // Calculate totals
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let mealCount = 0;

        snapshot.forEach(doc => {
            const meal = doc.data();
            totalCalories += meal.calories || 0;
            totalProtein += meal.protein || 0;
            totalCarbs += meal.carbs || 0;
            totalFat += meal.fat || 0;
            mealCount++;
        });

        const summary = {
            totalCalories,
            totalProtein,
            totalCarbs,
            totalFat,
            mealCount,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Save to dailySummaries collection
        const summaryRef = db.collection('users').doc(userId).collection('dailySummaries').doc(dateString);
        await summaryRef.set(summary);

        console.log('📊 Daily summary updated for', dateString, ':', totalCalories, 'kcal');
        return summary;
    } catch (error) {
        console.error('Error recalculating daily summary:', error);
        // Don't throw - this is a secondary operation, shouldn't break main flow
        return null;
    }
}

/**
 * Get daily summary (with lazy migration fallback)
 * @param {string} userId - User ID
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @returns {Promise<Object>} Summary object
 */
async function getDailySummary(userId, dateString) {
    try {
        const summaryRef = db.collection('users').doc(userId).collection('dailySummaries').doc(dateString);
        const doc = await summaryRef.get();

        if (doc.exists) {
            // Summary exists - return it
            return { date: dateString, ...doc.data() };
        } else {
            // Lazy migration: calculate and save summary
            console.log('📊 Lazy migration: calculating summary for', dateString);
            const summary = await recalculateDailySummary(userId, dateString);
            return { date: dateString, ...summary };
        }
    } catch (error) {
        console.error('Error getting daily summary:', error);
        return { date: dateString, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealCount: 0 };
    }
}

/**
 * Get weekly summaries (optimized - 7 parallel requests to summaries, not meals)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of daily summaries
 */
async function getWeeklySummaries(userId) {
    try {
        const promises = [];

        // Get summaries for last 7 days in parallel
        for (let i = 6; i >= 0; i--) {
            const dateString = getDateString(i);
            promises.push(getDailySummary(userId, dateString));
        }

        return await Promise.all(promises);
    } catch (error) {
        console.error('Error fetching weekly summaries:', error);
        throw error;
    }
}

// ==================== MEAL CRUD OPERATIONS ====================

/**
 * Add a new meal
 * @param {string} userId - User ID
 * @param {Object} mealData - {name, calories, protein, carbs, fat}
 * @param {string} dateString - Optional date string (YYYY-MM-DD), defaults to today
 * @returns {Promise<string>} Document ID of created meal
 */
async function addMealToFirestore(userId, mealData, dateString = null) {
    try {
        if (!dateString) {
            dateString = getTodayDateString();
        }
        const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');

        const mealToSave = {
            ...mealData,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            date: dateString
        };

        const docRef = await mealsRef.add(mealToSave);
        console.log('✅ Meal added:', docRef.id, 'for date:', dateString);

        // Increment API call counter for rate limiting
        await incrementApiCallCounter(userId);

        // Update daily summary (fire and forget - don't await)
        recalculateDailySummary(userId, dateString);

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
 * @param {string} dateString - Optional date string (YYYY-MM-DD), defaults to today
 * @returns {Promise<void>}
 */
async function deleteMealFromFirestore(userId, mealId, dateString = null) {
    try {
        if (!dateString) {
            dateString = getTodayDateString();
        }
        await db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items').doc(mealId).delete();
        console.log('✅ Meal deleted:', mealId, 'from date:', dateString);

        // Update daily summary (fire and forget - don't await)
        recalculateDailySummary(userId, dateString);
    } catch (error) {
        console.error('Error deleting meal:', error);
        throw error;
    }
}

/**
 * Update an existing meal
 * @param {string} userId - User ID
 * @param {string} mealId - Meal document ID
 * @param {Object} mealData - Updated meal data (name, calories, protein, carbs, fat)
 * @param {string} dateString - Optional date string (YYYY-MM-DD), defaults to today
 * @returns {Promise<void>}
 */
async function updateMealInFirestore(userId, mealId, mealData, dateString = null) {
    try {
        if (!dateString) {
            dateString = getTodayDateString();
        }
        const mealRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items').doc(mealId);

        await mealRef.update({
            name: mealData.name,
            calories: mealData.calories,
            protein: mealData.protein,
            carbs: mealData.carbs,
            fat: mealData.fat,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Meal updated:', mealId, 'for date:', dateString);

        // Update daily summary (fire and forget - don't await)
        recalculateDailySummary(userId, dateString);
    } catch (error) {
        console.error('Error updating meal:', error);
        throw error;
    }
}

/**
 * Convert Firestore snapshot to array of documents with IDs
 * @param {QuerySnapshot} snapshot - Firestore query snapshot
 * @returns {Array} Array of document objects with id field
 */
function snapshotToArray(snapshot) {
    const items = [];
    snapshot.forEach(doc => {
        items.push({
            id: doc.id,
            ...doc.data()
        });
    });
    return items;
}

/**
 * Listen to real-time updates for today's meals
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function to receive meals array
 * @returns {Function} Unsubscribe function
 */
function listenToTodayMeals(userId, callback) {
    return listenToMealsForDate(userId, getTodayDateString(), callback);
}

/**
 * Listen to real-time updates for meals on a specific date
 * @param {string} userId - User ID
 * @param {string} dateString - Date string (YYYY-MM-DD)
 * @param {Function} callback - Callback function to receive meals array
 * @returns {Function} Unsubscribe function
 */
function listenToMealsForDate(userId, dateString, callback) {
    const mealsRef = db.collection('users').doc(userId).collection('meals').doc(dateString).collection('items');

    return mealsRef.orderBy('timestamp', 'desc').onSnapshot(
        (snapshot) => callback(snapshotToArray(snapshot)),
        (error) => console.error('Error listening to meals:', error)
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

// ==================== FOOD HISTORY & FAVORITES ====================

/**
 * Get favorite foods for user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of favorite food objects
 */
async function getFavoriteFoods(userId) {
    try {
        const favoritesRef = db.collection('users').doc(userId).collection('favorites');
        const snapshot = await favoritesRef.orderBy('addedAt', 'desc').get();
        return snapshotToArray(snapshot);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        return [];
    }
}

/**
 * Add food to favorites
 * @param {string} userId - User ID
 * @param {Object} foodData - {name, calories, protein, carbs, fat}
 * @returns {Promise<string>} Document ID
 */
async function addFavoriteFood(userId, foodData) {
    try {
        const favoritesRef = db.collection('users').doc(userId).collection('favorites');

        // Check if already exists (by name, case-insensitive)
        const existing = await favoritesRef
            .where('nameLower', '==', foodData.name.toLowerCase())
            .get();

        if (!existing.empty) {
            // Update existing favorite
            const docId = existing.docs[0].id;
            await favoritesRef.doc(docId).update({
                ...foodData,
                nameLower: foodData.name.toLowerCase(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Favorite updated:', docId);
            return docId;
        }

        // Add new favorite
        const docRef = await favoritesRef.add({
            ...foodData,
            nameLower: foodData.name.toLowerCase(),
            addedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Favorite added:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('Error adding favorite:', error);
        throw error;
    }
}

/**
 * Remove food from favorites
 * @param {string} userId - User ID
 * @param {string} favoriteId - Favorite document ID
 * @returns {Promise<void>}
 */
async function removeFavoriteFood(userId, favoriteId) {
    try {
        await db.collection('users').doc(userId).collection('favorites').doc(favoriteId).delete();
        console.log('✅ Favorite removed:', favoriteId);
    } catch (error) {
        console.error('Error removing favorite:', error);
        throw error;
    }
}

/**
 * Check if food is in favorites (by name)
 * @param {string} userId - User ID
 * @param {string} foodName - Food name
 * @returns {Promise<{isFavorite: boolean, favoriteId: string|null}>}
 */
async function checkIsFavorite(userId, foodName) {
    try {
        const favoritesRef = db.collection('users').doc(userId).collection('favorites');
        const snapshot = await favoritesRef
            .where('nameLower', '==', foodName.toLowerCase())
            .limit(1)
            .get();

        if (snapshot.empty) {
            return { isFavorite: false, favoriteId: null };
        }

        return { isFavorite: true, favoriteId: snapshot.docs[0].id };
    } catch (error) {
        console.error('Error checking favorite:', error);
        return { isFavorite: false, favoriteId: null };
    }
}

/**
 * Get food history (last 10 unique foods)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of recent food objects
 */
async function getFoodHistory(userId) {
    try {
        const historyRef = db.collection('users').doc(userId).collection('foodHistory');
        const snapshot = await historyRef.orderBy('lastUsed', 'desc').limit(10).get();
        return snapshotToArray(snapshot);
    } catch (error) {
        console.error('Error fetching food history:', error);
        return [];
    }
}

/**
 * Add or update food in history
 * Called when a meal is added
 * @param {string} userId - User ID
 * @param {Object} foodData - {name, calories, protein, carbs, fat}
 * @returns {Promise<void>}
 */
async function updateFoodHistory(userId, foodData) {
    try {
        const historyRef = db.collection('users').doc(userId).collection('foodHistory');

        // Check if food already exists in history (by name)
        const existing = await historyRef
            .where('nameLower', '==', foodData.name.toLowerCase())
            .get();

        if (!existing.empty) {
            // Update existing entry
            const docId = existing.docs[0].id;
            await historyRef.doc(docId).update({
                ...foodData,
                nameLower: foodData.name.toLowerCase(),
                lastUsed: firebase.firestore.FieldValue.serverTimestamp(),
                useCount: firebase.firestore.FieldValue.increment(1)
            });
        } else {
            // Add new entry
            await historyRef.add({
                ...foodData,
                nameLower: foodData.name.toLowerCase(),
                lastUsed: firebase.firestore.FieldValue.serverTimestamp(),
                useCount: 1
            });

            // Clean up old history entries (keep only 10)
            await cleanupFoodHistory(userId);
        }
    } catch (error) {
        console.error('Error updating food history:', error);
        // Non-critical - don't throw
    }
}

/**
 * Clean up food history to keep only 10 entries
 * @param {string} userId - User ID
 */
async function cleanupFoodHistory(userId) {
    try {
        const historyRef = db.collection('users').doc(userId).collection('foodHistory');
        const snapshot = await historyRef.orderBy('lastUsed', 'desc').get();

        if (snapshot.size > 10) {
            const toDelete = [];
            let count = 0;
            snapshot.forEach(doc => {
                count++;
                if (count > 10) {
                    toDelete.push(doc.ref);
                }
            });

            // Delete in batch
            const batch = db.batch();
            toDelete.forEach(ref => batch.delete(ref));
            await batch.commit();

            console.log(`✅ Cleaned up ${toDelete.length} old history entries`);
        }
    } catch (error) {
        console.error('Error cleaning up food history:', error);
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
