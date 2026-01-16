// =====================================
// AI DIET - MAIN APPLICATION
// =====================================

// =====================================
// GLOBAL STATE
// =====================================
const AppState = {
    meals: [],
    aiConfig: null,
    currentUser: null,
    userData: null,
    dailyGoals: null,
    isProcessing: false,
    unsubscribeMealsListener: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    selectedDate: null, // Current selected date (null = today)
    abortController: null, // For canceling API requests
    recordingStartTime: null, // Recording start timestamp
    recordingTimerInterval: null // Timer interval ID
};

// =====================================
// APP INITIALIZATION
// =====================================

/**
 * Initialize application after user login
 * @param {Object} user - Firebase user object
 */
async function initializeApp(user) {
    console.log('🚀 Initializing app for user:', user.email);
    AppState.currentUser = user;

    try {
        // Load data
        await loadAIConfig();
        await loadUserDataFromFirestore();

        // Setup listeners
        setupEventListeners();
        setupVoiceRecognition();

        // Update UI first (so date displays are ready)
        updateCurrentDate();
        updateSummary();
        updateWeeklyTrend();
        updateGreeting();

        // Setup meals listener last (will trigger UI updates)
        setupMealsListener();

        // Show settings for new users
        if (!AppState.userData) {
            setTimeout(() => {
                const settingsModal = document.getElementById('settingsModal');
                settingsModal.classList.add('active');
                alert('👋 Vítejte v AI Diet!\n\nPro začátek prosím nastavte osobní údaje (pro výpočet denního příjmu).');
            }, 500);
        }

        console.log('✅ App initialized successfully');
    } catch (error) {
        console.error('❌ App initialization error:', error);
        alert('Chyba při načítání dat. Zkuste se odhlásit a přihlásit znovu.');
    }
}

/**
 * Clear app data on logout
 */
function clearAppData() {
    console.log('🧹 Clearing app data');

    // Unsubscribe from listeners
    if (AppState.unsubscribeMealsListener) {
        AppState.unsubscribeMealsListener();
        AppState.unsubscribeMealsListener = null;
    }

    // Clear state
    Object.assign(AppState, {
        meals: [],
        aiConfig: null,
        currentUser: null,
        userData: null,
        dailyGoals: null,
        isProcessing: false,
        audioBlob: null
    });

    // Reset UI
    const mealsList = document.getElementById('mealsList');
    if (mealsList) {
        mealsList.innerHTML = '<p class="empty-state">Zatím žádná jídla. Přidejte své první jídlo!</p>';
    }
}

// =====================================
// EVENT LISTENERS SETUP
// =====================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Close dropdown menu when clicking outside
    document.addEventListener('click', (e) => {
        const dropdownMenu = document.getElementById('dropdownMenu');
        const menuBtn = document.getElementById('menuBtn');

        if (dropdownMenu && menuBtn &&
            !dropdownMenu.contains(e.target) &&
            !menuBtn.contains(e.target) &&
            dropdownMenu.classList.contains('active')) {
            dropdownMenu.classList.remove('active');
        }
    });

    // Text input - Enter key
    const textInput = document.getElementById('textInput');
    if (textInput) {
        textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !AppState.isProcessing) {
                e.preventDefault();
                analyzeText();
            }
        });
    }

    // Photo input - Auto-analyze on selection
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', () => {
            if (photoInput.files.length > 0 && !AppState.isProcessing) {
                analyzePhoto();
            }
        });
    }

    // Drag and drop for photos
    const photoTab = document.getElementById('photoTab');
    if (photoTab) {
        photoTab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            photoTab.style.backgroundColor = 'var(--bg-secondary)';
        });

        photoTab.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            photoTab.style.backgroundColor = '';
        });

        photoTab.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            photoTab.style.backgroundColor = '';

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/') && !AppState.isProcessing) {
                photoInput.files = files;
                analyzePhoto();
            }
        });
    }

    // Date navigation buttons are handled via inline onclick in HTML
}

// =====================================
// AI CONFIGURATION MANAGEMENT
// =====================================

/**
 * Load AI configuration and initialize AI service
 */
async function loadAIConfig() {
    try {
        AppState.aiConfig = await getAIProvidersConfig();
        await aiService.initialize(AppState.aiConfig);
        console.log('✅ AI Service initialized');

        // Populate UI with available providers
        populateAIProvidersList();
    } catch (error) {
        console.error('❌ Failed to initialize AI Service:', error);
        throw error;
    }
}

/**
 * Populate AI providers list in settings
 */
function populateAIProvidersList() {
    const providersList = document.getElementById('aiProvidersList');
    if (!providersList) return;

    const providers = aiService.getAvailableProviders();

    if (providers.length === 0) {
        providersList.innerHTML = '<p style="color: var(--text-secondary);">Žádný AI provider není dostupný</p>';
        return;
    }

    providersList.innerHTML = providers.map(provider => {
        const caps = provider.capabilities;
        const warnings = [];

        if (!caps.images) warnings.push('📷 Nepodporuje fotky');
        if (!caps.audio) warnings.push('🎤 Nepodporuje audio');

        const warningText = warnings.length > 0
            ? `<div style="font-size: 0.85em; color: #ff9800; margin-top: 4px;">${warnings.join(', ')}</div>`
            : '';

        return `
            <label style="display: flex; align-items: flex-start; padding: 12px; background: var(--bg-secondary); border-radius: 8px; cursor: pointer; border: 2px solid ${provider.isDefault ? 'var(--primary-color)' : 'transparent'};">
                <input
                    type="radio"
                    name="aiProvider"
                    value="${provider.name}"
                    ${provider.isDefault ? 'checked' : ''}
                    onchange="selectAIProvider('${provider.name}')"
                    style="margin-top: 2px; margin-right: 12px;"
                />
                <div style="flex: 1;">
                    <div style="font-weight: 600; color: var(--text-primary);">
                        ${provider.displayName}
                        ${provider.isDefault ? '<span style="font-size: 0.8em; color: var(--primary-color); margin-left: 8px;">✓ Výchozí</span>' : ''}
                    </div>
                    <div style="font-size: 0.85em; color: var(--text-secondary); margin-top: 4px;">
                        ${caps.text ? '📝' : ''}
                        ${caps.images ? '📷' : ''}
                        ${caps.audio ? '🎤' : ''}
                    </div>
                    ${warningText}
                </div>
            </label>
        `;
    }).join('');

    // Show capabilities of default provider
    const defaultProvider = providers.find(p => p.isDefault);
    if (defaultProvider) {
        updateProviderCapabilities(defaultProvider.capabilities);
    }
}

/**
 * Select AI provider
 */
function selectAIProvider(providerName) {
    try {
        aiService.setDefaultProvider(providerName);

        // Update capabilities display
        const providers = aiService.getAvailableProviders();
        const selected = providers.find(p => p.name === providerName);
        if (selected) {
            updateProviderCapabilities(selected.capabilities);
        }

        // Update config in Firestore
        updateDefaultProvider(providerName).catch(error => {
            console.error('Failed to save provider preference:', error);
        });

        console.log(`✅ Změněn AI provider na: ${providerName}`);

        // Show notification
        alert(`AI provider změněn na ${providerName}`);
    } catch (error) {
        console.error('Error selecting provider:', error);
        alert(`Chyba při změně providera: ${error.message}`);
    }
}

/**
 * Update provider capabilities display
 */
function updateProviderCapabilities(capabilities) {
    const capabilitiesDiv = document.getElementById('providerCapabilities');
    const capText = document.getElementById('capText');
    const capImages = document.getElementById('capImages');
    const capAudio = document.getElementById('capAudio');

    if (!capabilitiesDiv) return;

    capabilitiesDiv.style.display = 'block';

    capText.style.opacity = capabilities.text ? '1' : '0.3';
    capText.style.textDecoration = capabilities.text ? 'none' : 'line-through';

    capImages.style.opacity = capabilities.images ? '1' : '0.3';
    capImages.style.textDecoration = capabilities.images ? 'none' : 'line-through';

    capAudio.style.opacity = capabilities.audio ? '1' : '0.3';
    capAudio.style.textDecoration = capabilities.audio ? 'none' : 'line-through';
}

// =====================================
// USER DATA MANAGEMENT
// =====================================

// BMR coefficients (Oxford/Henry equation - 2005) - same as firestore-service.js
const BMR_COEFFICIENTS_PREVIEW = {
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

// Goal percentages for TDEE preview calculation
const GOAL_PERCENTAGES_PREVIEW = {
    'loss-aggressive': 0.80,
    'loss-moderate': 0.85,
    'loss-mild': 0.90,
    'maintain': 1.0
};

/**
 * Calculate BMR using Oxford/Henry equation (same as firestore-service.js)
 */
function calculateBMRPreview(gender, age, weight) {
    const coefficients = BMR_COEFFICIENTS_PREVIEW[gender] || BMR_COEFFICIENTS_PREVIEW.female;
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
 * Calculate and update TDEE preview in settings
 */
function updateTdeePreview() {
    const preview = document.getElementById('tdeePreview');
    if (!preview) return;

    const age = parseInt(document.getElementById('userAge').value);
    const gender = document.getElementById('userGender').value;
    const weight = parseFloat(document.getElementById('userWeight').value);
    const activity = parseFloat(document.getElementById('userActivity').value);
    const goal = document.getElementById('userGoal').value;

    // Need all values to calculate
    if (!age || !weight || !activity) {
        preview.innerHTML = '';
        return;
    }

    // BMR calculation (Oxford/Henry equation - same as firestore-service.js)
    const bmrRaw = calculateBMRPreview(gender, age, weight);
    const tdeeRaw = bmrRaw * activity;
    const goalPercent = GOAL_PERCENTAGES_PREVIEW[goal] || 1.0;
    const targetRaw = tdeeRaw * goalPercent;

    // Round to tens for display
    const bmr = Math.round(bmrRaw / 10) * 10;
    const tdee = Math.round(tdeeRaw / 10) * 10;
    const targetCalories = Math.round(targetRaw / 10) * 10;
    const deficit = targetCalories - tdee;

    let deficitHtml = '';
    if (deficit !== 0) {
        const deficitText = deficit > 0 ? `+${deficit}` : deficit;
        const deficitLabel = deficit > 0 ? 'Přebytek' : 'Deficit';
        deficitHtml = `
            <div class="tdee-preview-row">
                <span class="tdee-preview-label">${deficitLabel}</span>
                <span class="tdee-preview-value">${deficitText} kcal</span>
            </div>
        `;
    }

    preview.innerHTML = `
        <div class="tdee-preview-row">
            <span class="tdee-preview-label">BMR (bazální metabolismus)</span>
            <span class="tdee-preview-value">${bmr} kcal</span>
        </div>
        <div class="tdee-preview-row">
            <span class="tdee-preview-label">TDEE (udržovací)</span>
            <span class="tdee-preview-value">${tdee} kcal</span>
        </div>
        ${deficitHtml}
        <div class="tdee-preview-row">
            <span class="tdee-preview-label">Denní cíl</span>
            <span class="tdee-preview-value highlight">${targetCalories} kcal</span>
        </div>
    `;
}

/**
 * Save user profile data to Firestore
 */
async function saveUserData() {
    const age = parseInt(document.getElementById('userAge').value);
    const gender = document.getElementById('userGender').value;
    const weight = parseFloat(document.getElementById('userWeight').value);
    const activity = parseFloat(document.getElementById('userActivity').value);
    const goal = document.getElementById('userGoal').value;

    if (!age || !weight) {
        alert('Vyplňte prosím všechny údaje');
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const profileData = { age, gender, weight, activity, goal };
        const calculatedGoals = await saveUserProfile(AppState.currentUser.uid, profileData);

        AppState.userData = profileData;
        AppState.dailyGoals = calculatedGoals;

        // Aktualizuj userData v AIService pro personalizaci promptů
        aiService.setUserData(profileData);

        // Show styled info dialog with calculated goals
        showGoalsInfoDialog(calculatedGoals);

        updateSummary();
        updateWeeklyTrend();
    } catch (error) {
        console.error('Error saving user data:', error);
        alert('Chyba při ukládání údajů. Zkuste to prosím znovu.');
    }
}

/**
 * Load user profile from Firestore
 */
async function loadUserDataFromFirestore() {
    if (!AppState.currentUser) {
        console.warn('No current user, skipping user data load');
        return;
    }

    try {
        const profile = await getUserProfile(AppState.currentUser.uid);

        if (profile) {
            AppState.userData = {
                age: profile.age,
                gender: profile.gender,
                weight: profile.weight,
                activity: profile.activity,
                goal: profile.goal || 'maintain'
            };

            AppState.dailyGoals = profile.dailyGoals;

            // Předej userData do AIService pro personalizaci promptů
            aiService.setUserData(AppState.userData);

            // Load into form
            document.getElementById('userAge').value = AppState.userData.age;
            document.getElementById('userGender').value = AppState.userData.gender;
            document.getElementById('userWeight').value = AppState.userData.weight;
            document.getElementById('userActivity').value = AppState.userData.activity;
            document.getElementById('userGoal').value = AppState.userData.goal;

            // Update TDEE preview
            updateTdeePreview();

            console.log('✅ User data loaded from Firestore');
        } else {
            console.log('ℹ️ No user profile found (new user)');
            AppState.userData = null;
            AppState.dailyGoals = null;
            aiService.setUserData(null);
        }
    } catch (error) {
        console.error('❌ Failed to load user data:', error);
        throw error;
    }
}

// =====================================
// MEALS MANAGEMENT
// =====================================

/**
 * Setup real-time listener for meals
 */
function setupMealsListener() {
    if (!AppState.currentUser) {
        console.warn('No current user, skipping meals listener setup');
        return;
    }

    if (AppState.unsubscribeMealsListener) {
        AppState.unsubscribeMealsListener();
    }

    // Show skeleton immediately while loading
    showMealsSkeleton();

    const dateString = getSelectedDateString();
    AppState.unsubscribeMealsListener = listenToMealsForDate(
        AppState.currentUser.uid,
        dateString,
        (updatedMeals) => {
            console.log('📥 Meals updated from Firestore for', dateString, ':', updatedMeals.length);
            AppState.meals = updatedMeals;
            updateSummary();
            displayMeals();
        }
    );

    console.log('✅ Meals real-time listener setup complete for', dateString);

    // Update date displays after listener is set up
    updateSelectedDateDisplay();
    updateNavigationButtons();
}

/**
 * Add meal to Firestore
 * @returns {string|null} - Meal ID if successful, null otherwise
 */
async function addMeal(nutritionData) {
    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return null;
    }

    try {
        const canMakeCall = await checkRateLimit(AppState.currentUser.uid);
        if (!canMakeCall) {
            const remaining = await getRemainingApiCalls(AppState.currentUser.uid);
            alert(`❌ Dosáhli jste denního limitu API volání.\n\nZbývající volání dnes: ${remaining}`);
            return null;
        }

        const dateString = getSelectedDateString();
        const mealId = await addMealToFirestore(AppState.currentUser.uid, nutritionData, dateString);
        console.log('✅ Meal added successfully to', dateString);

        // Open edit modal for the new meal
        openMealEditModal('new', {
            id: mealId,
            ...nutritionData
        });

        // Update weekly trend (deferred to not block UI)
        updateWeeklyTrend();

        return mealId;
    } catch (error) {
        console.error('Error adding meal:', error);
        alert('Chyba při ukládání jídla. Zkuste to prosím znovu.');
        return null;
    }
}

/**
 * Delete meal from Firestore
 */
async function deleteMeal(id) {
    const confirmed = await showConfirmDialog('Smazat jídlo?', 'Tato akce je nevratná.');
    if (!confirmed) {
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const dateString = getSelectedDateString();
        await deleteMealFromFirestore(AppState.currentUser.uid, id, dateString);
        console.log('✅ Meal deleted successfully from', dateString);

        // Update weekly trend after deletion
        updateWeeklyTrend();
    } catch (error) {
        console.error('Error deleting meal:', error);
        alert('Chyba při mazání jídla. Zkuste to prosím znovu.');
    }
}

/**
 * Copy meal from past day to today
 */
async function copyMealToToday(meal) {
    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const mealData = {
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat
        };

        // Add to today (null = today's date string)
        const todayString = getTodayString();
        await addMealToFirestore(AppState.currentUser.uid, mealData, todayString);

        // Update food history
        await updateFoodHistory(AppState.currentUser.uid, mealData);

        console.log('✅ Meal copied to today:', mealData.name);

        // Update weekly trend
        updateWeeklyTrend();

        // Show toast notification
        showToast(`"${mealData.name}" přidáno do dneška`, 'success');

    } catch (error) {
        console.error('Error copying meal to today:', error);
        showToast('Chyba při kopírování jídla', 'error');
    }
}

/**
 * Copy current meal from modal to today (used in edit modal for past days)
 */
async function copyCurrentMealToToday() {
    if (!currentModalMealData) return;

    // Get current values from form (user might have edited them)
    const mealData = {
        name: document.getElementById('editMealName').value.trim(),
        calories: parseInt(document.getElementById('editMealCalories').value) || 0,
        protein: parseFloat(document.getElementById('editMealProtein').value) || 0,
        carbs: parseFloat(document.getElementById('editMealCarbs').value) || 0,
        fat: parseFloat(document.getElementById('editMealFat').value) || 0
    };

    // Confirm dialog with green button
    const confirmed = await showConfirmDialog(
        'Přidat do dneška?',
        `"${mealData.name}" (${mealData.calories} kcal) bude přidáno do dnešního dne.`,
        '📋',
        'Přidat',
        'btn-primary'
    );

    if (!confirmed) return;

    await copyMealToToday(mealData);

    // Close modal after copying
    closeMealEditModal(false);
}

/**
 * Show skeleton loading state for meals list
 */
function showMealsSkeleton() {
    const mealsList = document.getElementById('mealsList');
    if (!mealsList) return;

    const skeletonHTML = Array(3).fill(`
        <div class="skeleton-item">
            <div class="skeleton-left">
                <div class="skeleton-line title"></div>
                <div class="skeleton-line meta"></div>
            </div>
            <div class="skeleton-right">
                <div class="skeleton-macro"></div>
                <div class="skeleton-macro"></div>
                <div class="skeleton-macro"></div>
            </div>
        </div>
    `).join('');

    mealsList.innerHTML = skeletonHTML;
}

/**
 * Display meals in UI
 */
function displayMeals() {
    const mealsList = document.getElementById('mealsList');

    if (AppState.meals.length === 0) {
        mealsList.innerHTML = '<p class="empty-state">Zatím žádná jídla. Přidejte své první jídlo!</p>';
        return;
    }

    mealsList.innerHTML = AppState.meals.map(meal => {
        const caloriePercent = AppState.dailyGoals ?
            Math.round((meal.calories / AppState.dailyGoals.calories) * 100) : 0;

        const mealName = meal.name.charAt(0).toUpperCase() + meal.name.slice(1);

        // Escape meal data for onclick
        const mealJson = JSON.stringify(meal).replace(/'/g, "\\'");

        return `
        <div class="meal-item-compact" onclick='openMealEditModal("edit", ${mealJson})'>
            <div class="meal-left">
                <div class="meal-name-compact">${mealName}</div>
                <div class="meal-meta">
                    <span class="meal-percent-badge" data-percent="${caloriePercent}">${caloriePercent}%</span>
                    <span class="meal-calories">${meal.calories} kcal</span>
                </div>
            </div>
            <div class="meal-right">
                <span class="meal-macro-item">🥩 ${meal.protein} g</span>
                <span class="meal-macro-item">🌾 ${meal.carbs} g</span>
                <span class="meal-macro-item">🥑 ${meal.fat} g</span>
            </div>
            <button class="btn-delete-compact" onclick="event.stopPropagation(); deleteMeal('${meal.id}')" title="Smazat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M6 6v12a2 2 0 002 2h8a2 2 0 002-2V6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
        </div>
    `;
    }).join('');
}


// =====================================
// TEXT INPUT ANALYSIS
// =====================================

/**
 * Analyze text input using new TextAnalyzer
 */
async function analyzeText() {
    if (AppState.isProcessing) return;

    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) {
        alert('Zadejte prosím popis jídla');
        return;
    }

    AppState.isProcessing = true;
    AppState.abortController = new AbortController();
    showLoading(true, '📝 Analyzuji text...');

    try {
        const textAnalyzer = new TextAnalyzer();
        const nutritionData = await textAnalyzer.analyze(text, AppState.abortController);

        if (nutritionData) {
            // Show modal for review/edit before saving
            openMealEditModal('new', nutritionData);
            textInput.value = '';
        } else {
            alert('Nepodařilo se analyzovat jídlo. Zkuste to prosím znovu.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('✅ Text analysis canceled by user');
        } else {
            console.error('❌ Text analysis error:', error);
            alert(`Chyba při analýze: ${error.message}`);
        }
    } finally {
        AppState.isProcessing = false;
        showLoading(false);
    }
}

// =====================================
// PHOTO INPUT ANALYSIS
// =====================================

/**
 * Analyze photo input using new PhotoAnalyzer
 */
async function analyzePhoto() {
    if (AppState.isProcessing) return;

    const photoInput = document.getElementById('photoInput');
    const file = photoInput.files[0];

    if (!file) {
        alert('Vyberte prosím fotografii jídla');
        return;
    }

    AppState.isProcessing = true;
    AppState.abortController = new AbortController();
    showLoading(true, '📷 Analyzuji fotografii...');

    try {
        const photoAnalyzer = new PhotoAnalyzer();
        const nutritionData = await photoAnalyzer.analyze(file, '', AppState.abortController);

        if (nutritionData) {
            // Show modal for review/edit before saving
            openMealEditModal('new', nutritionData);
            photoInput.value = '';
        } else {
            alert('Nepodařilo se analyzovat fotografii. Zkuste to prosím znovu.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('✅ Photo analysis canceled by user');
        } else {
            console.error('❌ Photo analysis error:', error);
            alert(`Chyba při analýze fotografie: ${error.message}`);
        }
    } finally {
        AppState.isProcessing = false;
        showLoading(false);
    }
}


// =====================================
// VOICE INPUT ANALYSIS
// =====================================

/**
 * Setup voice recognition
 */
function setupVoiceRecognition() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('MediaRecorder not supported');
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.disabled = true;
            voiceBtn.textContent = '❌ Nepodporováno';
        }
    }
}

/**
 * Start voice recognition
 */
async function startVoiceRecognition() {
    const voiceBtn = document.getElementById('voiceBtn');

    // If already recording, this shouldn't happen (button should be hidden)
    if (AppState.mediaRecorder && AppState.mediaRecorder.state === 'recording') {
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        AppState.audioChunks = [];
        AppState.cancelRecordingFlag = false;
        AppState.mediaRecorder = new MediaRecorder(stream);

        AppState.mediaRecorder.ondataavailable = (event) => {
            AppState.audioChunks.push(event.data);
        };

        AppState.mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop());

            // Check if recording was canceled
            if (AppState.cancelRecordingFlag) {
                console.log('🛑 Recording canceled by user');
                AppState.cancelRecordingFlag = false;
                AppState.audioBlob = null;
                AppState.audioChunks = [];
                return;
            }

            AppState.audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });

            const sizeKB = (AppState.audioBlob.size / 1024).toFixed(2);
            console.log(`Nahrávka dokončena (${sizeKB} KB). Automaticky zpracovávám...`);

            voiceBtn.textContent = '🎤 Nahrát znovu';
            voiceBtn.style.background = '';

            // Analyze automatically
            analyzeVoice();
        };

        AppState.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            alert('Chyba při nahrávání: ' + event.error);
            showRecordingModal(false);
            voiceBtn.textContent = '🎤 Začít nahrávat';
            voiceBtn.style.background = '';
        };

        // Start recording and show modal
        AppState.mediaRecorder.start();
        showRecordingModal(true);

        voiceBtn.textContent = '🎤 Nahrávání...';
        voiceBtn.disabled = true;
        voiceBtn.style.opacity = '0.5';

    } catch (error) {
        console.error('Error accessing microphone:', error);
        let errorMsg = 'Nelze získat přístup k mikrofonu.\n\n';

        if (error.name === 'NotAllowedError') {
            errorMsg += 'Přístup k mikrofonu byl zamítnut.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'Mikrofon nebyl nalezen.';
        } else {
            errorMsg += 'Chyba: ' + error.message;
        }

        alert(errorMsg);
    }
}

/**
 * Analyze voice input using new VoiceAnalyzer
 */
async function analyzeVoice() {
    if (!AppState.audioBlob) {
        alert('Nejprve nahrajte audio');
        return;
    }

    if (AppState.isProcessing) return;

    AppState.isProcessing = true;
    AppState.abortController = new AbortController();
    showLoading(true, '🎤 Analyzuji hlasový vstup...');

    try {
        const voiceAnalyzer = new VoiceAnalyzer();
        const nutritionData = await voiceAnalyzer.analyze(AppState.audioBlob, AppState.abortController);

        if (nutritionData) {
            // Show modal for review/edit before saving
            openMealEditModal('new', nutritionData);
            // Reset audio state
            AppState.audioBlob = null;
            document.getElementById('voiceBtn').textContent = '🎤 Začít nahrávat';
        } else {
            alert('Nepodařilo se analyzovat audio. Zkuste to prosím znovu.');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('✅ Voice analysis canceled by user');
        } else {
            console.error('❌ Voice analysis error:', error);
            alert(`Chyba při analýze zvuku: ${error.message}`);
        }
    } finally {
        AppState.isProcessing = false;
        showLoading(false);
    }
}


// =====================================
// UI FUNCTIONS
// =====================================

// Confirm dialog state
let confirmDialogResolve = null;

/**
 * Show custom confirm dialog
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} icon - Emoji icon (default: 🗑️)
 * @param {string} confirmText - Text for confirm button (default: 'Smazat')
 * @param {string} confirmClass - CSS class for confirm button (default: 'btn-danger')
 * @returns {Promise<boolean>} - true if confirmed, false if cancelled
 */
function showConfirmDialog(title = 'Smazat jídlo?', message = 'Tato akce je nevratná.', icon = '🗑️', confirmText = 'Smazat', confirmClass = 'btn-danger') {
    return new Promise((resolve) => {
        confirmDialogResolve = resolve;

        document.getElementById('confirmDialogTitle').textContent = title;
        document.getElementById('confirmDialogMessage').textContent = message;
        document.querySelector('.confirm-dialog-icon').textContent = icon;

        // Update confirm button text and class
        const confirmBtn = document.querySelector('.confirm-dialog-actions .btn-danger, .confirm-dialog-actions .btn-primary');
        confirmBtn.textContent = confirmText;
        confirmBtn.className = confirmClass;

        document.getElementById('confirmDialog').classList.add('active');
    });
}

/**
 * Close confirm dialog
 * @param {boolean} confirmed - true if user confirmed
 */
function closeConfirmDialog(confirmed) {
    document.getElementById('confirmDialog').classList.remove('active');

    if (confirmDialogResolve) {
        confirmDialogResolve(confirmed);
        confirmDialogResolve = null;
    }
}

/**
 * Show info dialog with structured content
 * @param {string} title - Dialog title
 * @param {string} bodyHTML - HTML content for body
 * @param {string} icon - Icon character (default checkmark)
 */
function showInfoDialog(title, bodyHTML, icon = '✓') {
    document.getElementById('infoDialogTitle').textContent = title;
    document.getElementById('infoDialogBody').innerHTML = bodyHTML;
    document.querySelector('.info-dialog-icon').textContent = icon;
    document.getElementById('infoDialog').classList.add('active');
}

/**
 * Close info dialog
 */
function closeInfoDialog() {
    document.getElementById('infoDialog').classList.remove('active');
}

/**
 * Show nutrition goals info dialog
 * @param {object} goals - Calculated goals object
 */
function showGoalsInfoDialog(goals) {
    let bodyHTML = `
        <div class="info-dialog-row">
            <span class="info-dialog-label">BMR (bazální metabolismus)</span>
            <span class="info-dialog-value">${goals.bmr} kcal</span>
        </div>
        <div class="info-dialog-row">
            <span class="info-dialog-label">TDEE (udržovací kalorie)</span>
            <span class="info-dialog-value">${goals.tdee} kcal</span>
        </div>
    `;

    if (goals.deficit !== 0) {
        const deficitText = goals.deficit > 0 ? `+${goals.deficit}` : goals.deficit;
        const deficitLabel = goals.deficit > 0 ? 'Přebytek' : 'Deficit';
        bodyHTML += `
            <div class="info-dialog-row">
                <span class="info-dialog-label">${deficitLabel}</span>
                <span class="info-dialog-value">${deficitText} kcal/den</span>
            </div>
        `;
    }

    bodyHTML += `
        <div class="info-dialog-section">
            <div class="info-dialog-section-title">Denní cílové hodnoty</div>
            <div class="info-dialog-row highlight">
                <span class="info-dialog-label">Kalorie</span>
                <span class="info-dialog-value">${goals.calories} kcal</span>
            </div>
            <div class="info-dialog-row">
                <span class="info-dialog-label">Bílkoviny</span>
                <span class="info-dialog-value">${goals.protein} g</span>
            </div>
            <div class="info-dialog-row">
                <span class="info-dialog-label">Sacharidy</span>
                <span class="info-dialog-value">${goals.carbs} g</span>
            </div>
            <div class="info-dialog-row">
                <span class="info-dialog-label">Tuky</span>
                <span class="info-dialog-value">${goals.fat} g</span>
            </div>
        </div>
    `;

    showInfoDialog('Údaje uloženy', bodyHTML, '✓');
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    toastIcon.textContent = type === 'success' ? '✓' : '✕';
    toast.className = `toast toast-${type} active`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

/**
 * Toggle dropdown menu
 */
function toggleMenu() {
    const dropdownMenu = document.getElementById('dropdownMenu');
    dropdownMenu.classList.toggle('active');
}

/**
 * Toggle settings modal
 */
function toggleSettings() {
    const settingsModal = document.getElementById('settingsModal');
    settingsModal.classList.toggle('active');
}

/**
 * Switch between input tabs
 */
function switchTab(tabName, event) {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        const targetBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }

    document.getElementById(`${tabName}Tab`).classList.add('active');
}

/**
 * Update greeting section with user name
 */
function updateGreeting() {
    const greetingName = document.getElementById('userGreetingName');
    if (greetingName && AppState.currentUser) {
        // Try to get display name from Firebase, or use email prefix
        let name = AppState.currentUser.displayName;
        if (!name && AppState.currentUser.email) {
            name = AppState.currentUser.email.split('@')[0];
        }
        greetingName.textContent = name || 'uživateli';
    }
}

/**
 * Update summary display
 */
function updateSummary() {
    const totals = AppState.meals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    totals.calories = Math.round(totals.calories);
    totals.protein = Math.round(totals.protein);
    totals.carbs = Math.round(totals.carbs);
    totals.fat = Math.round(totals.fat);

    // Round to tens for display
    const displayCalories = Math.round(totals.calories / 10) * 10;
    document.getElementById('totalCalories').textContent = displayCalories;

    if (AppState.dailyGoals) {
        // Displayed percentage: relative to goal (100% = goal achieved)
        const caloriesPercent = Math.round((totals.calories / AppState.dailyGoals.calories) * 100);

        // Visual progress bar: scaled to TDEE (100% bar width = TDEE)
        const progressWidth = (totals.calories / AppState.dailyGoals.tdee) * 100;

        // Goal marker position: where the goal sits on the TDEE scale
        const markerPosition = (AppState.dailyGoals.calories / AppState.dailyGoals.tdee) * 100;

        const caloriesPercentageEl = document.getElementById('caloriesPercentage');
        caloriesPercentageEl.textContent = caloriesPercent + '%';
        // Round goal to tens for display
        const displayGoal = Math.round(AppState.dailyGoals.calories / 10) * 10;
        document.getElementById('caloriesGoalValue').textContent = displayGoal;

        const progressFill = document.getElementById('caloriesProgressFill');
        // Progress bar width based on TDEE (can go up to 100% = TDEE)
        progressFill.style.width = Math.min(progressWidth, 100) + '%';

        // Position the goal marker
        const goalMarker = document.getElementById('caloriesGoalMarker');
        if (goalMarker) {
            goalMarker.style.left = markerPosition + '%';
            goalMarker.style.right = 'auto';
        }

        // Color coding - iOS Style based on percentage relative to goal
        progressFill.style.background = getProgressColor(caloriesPercent);
        caloriesPercentageEl.style.color = '#FFFFFF';
        caloriesPercentageEl.style.fontWeight = caloriesPercent >= 95 ? '700' : '600';

        // Update BMR/TDEE meta info
        const caloriesMeta = document.getElementById('caloriesMeta');
        if (caloriesMeta) {
            caloriesMeta.innerHTML = `
                <span><span class="calories-meta-label">BMR:</span> ${AppState.dailyGoals.bmr} kcal</span>
                <span><span class="calories-meta-label">TDEE:</span> ${AppState.dailyGoals.tdee} kcal</span>
            `;
        }

        updateMacroBox('protein', totals.protein, AppState.dailyGoals.protein);
        updateMacroBox('carbs', totals.carbs, AppState.dailyGoals.carbs);
        updateMacroBox('fat', totals.fat, AppState.dailyGoals.fat);
    } else {
        document.getElementById('caloriesGoalValue').textContent = '?';
        document.getElementById('caloriesProgressFill').style.width = '0%';

        document.getElementById('totalProtein').textContent = totals.protein;
        document.getElementById('totalCarbs').textContent = totals.carbs;
        document.getElementById('totalFat').textContent = totals.fat;

        document.getElementById('proteinPercent').textContent = '-';
        document.getElementById('carbsPercent').textContent = '-';
        document.getElementById('fatPercent').textContent = '-';

        document.getElementById('proteinGoal').textContent = 'Nastavte osobní údaje';
        document.getElementById('carbsGoal').textContent = 'Nastavte osobní údaje';
        document.getElementById('fatGoal').textContent = 'Nastavte osobní údaje';
    }
}

// Progressive calorie intake colors (intuitive traffic light progression)
// Designed for dark UI - colors are vibrant but not harsh
const PROGRESS_COLORS = {
    minimal: 'rgba(255, 255, 255, 0.7)',  // 0-39% - Bílá/šedá - klidně, začínáš
    low: '#64B5F6',                        // 40-59% - Světle modrá - pohoda
    moderate: '#4CAF50',                   // 60-79% - Zelená - dobrý progress
    good: '#8BC34A',                       // 80-94% - Světle zelená - blížíš se
    warning: '#FFB300',                    // 95-104% - Žlutá/Amber - u hranice
    caution: '#FF9800',                    // 105-114% - Oranžová - lehce přes
    over: '#F44336'                        // 115%+ - Červená - hodně přes
};

// Macro-specific colors for normal range
const MACRO_COLORS = {
    protein: '#FF6B6B',
    carbs: '#FFB84D',
    fat: '#51CF66'
};

/**
 * Get progress bar color based on percentage - progressive palette
 * @param {number} percent - Percentage value
 * @returns {string} Color value
 */
function getProgressColor(percent) {
    if (percent >= 115) return PROGRESS_COLORS.over;      // Červená - hodně přes
    if (percent >= 105) return PROGRESS_COLORS.caution;   // Oranžová - lehce přes
    if (percent >= 95) return PROGRESS_COLORS.warning;    // Žlutá - u hranice
    if (percent >= 80) return PROGRESS_COLORS.good;       // Světle zelená - blížíš se
    if (percent >= 60) return PROGRESS_COLORS.moderate;   // Zelená - dobrý
    if (percent >= 40) return PROGRESS_COLORS.low;        // Modrá - pohoda
    return PROGRESS_COLORS.minimal;                       // Bílá - začínáš
}

/**
 * Get percentage style based on value
 * @param {number} percent - Percentage value
 * @param {string} type - Macro type for default color
 * @returns {Object} Style object with color and fontWeight
 */
function getPercentageStyle(percent, type) {
    if (percent >= 110) {
        return { color: PROGRESS_COLORS.over, fontWeight: '700' };
    }
    if (percent >= 95) {
        return { color: PROGRESS_COLORS.atGoal, fontWeight: '700' };
    }
    if (percent >= 80) {
        return { color: PROGRESS_COLORS.good, fontWeight: '600' };
    }
    // Normal range - use macro-specific color
    return { color: MACRO_COLORS[type] || 'var(--text-primary)', fontWeight: '700' };
}

/**
 * Update macro box display
 */
function updateMacroBox(type, current, goal) {
    const percent = Math.round((current / goal) * 100);
    const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);

    const totalElement = document.getElementById(`total${capitalizedType}`);
    const percentElement = document.getElementById(`${type}Percent`);
    const goalElement = document.getElementById(`${type}Goal`);

    if (totalElement) totalElement.textContent = current;
    if (percentElement) percentElement.textContent = percent + '%';
    if (goalElement) goalElement.textContent = `z ${goal} g`;

    if (percentElement) {
        const style = getPercentageStyle(percent, type);
        percentElement.style.color = style.color;
        percentElement.style.fontWeight = style.fontWeight;
    }
}

/**
 * Update weekly trend display
 */
async function updateWeeklyTrend() {
    const chartContainer = document.getElementById('weeklyTrendChart');
    if (!chartContainer) return;

    // Check if we have necessary data
    if (!AppState.currentUser || !AppState.dailyGoals) {
        chartContainer.innerHTML = '<div class="weekly-trend-loading">Nastavte osobní údaje pro zobrazení týdenního trendu</div>';
        return;
    }

    try {
        // Show loading state
        chartContainer.innerHTML = '<div class="weekly-trend-loading">Načítám data...</div>';

        // Fetch weekly summaries (optimized - uses dailySummaries with lazy migration)
        const weeklyData = await getWeeklySummaries(AppState.currentUser.uid);

        // Find max calories for scaling
        const maxCalories = Math.max(
            ...weeklyData.map(day => day.totalCalories),
            AppState.dailyGoals.calories
        );

        // Calculate goal line position (100% = goal)
        const goalLinePosition = (AppState.dailyGoals.calories / maxCalories) * 100;

        // Build HTML for chart
        let chartHTML = '<div class="weekly-trend-bars">';

        weeklyData.forEach(dayData => {
            const date = new Date(dayData.date + 'T00:00:00');
            const dayName = date.toLocaleDateString('cs-CZ', { weekday: 'short' }).toUpperCase();
            const dayDate = date.getDate() + '.' + (date.getMonth() + 1) + '.';

            const caloriesGoal = AppState.dailyGoals.calories;
            const percent = caloriesGoal > 0 ? Math.round((dayData.totalCalories / caloriesGoal) * 100) : 0;

            // Calculate bar height - based on goal percentage, capped at 100%
            const barHeight = Math.min(percent, 100);

            // Get bar color using same logic as daily summary
            const barColor = dayData.totalCalories > 0 ? getProgressColor(percent) : 'rgba(255, 255, 255, 0.08)';

            const selectedDateString = getSelectedDateString();
            const isSelected = dayData.date === selectedDateString;

            let columnClasses = 'trend-column';
            if (isSelected) columnClasses += ' selected';

            // Percent text color matches bar
            const percentColor = dayData.totalCalories > 0 ? barColor : 'var(--text-tertiary)';

            chartHTML += `
                <div class="${columnClasses}" data-date="${dayData.date}">
                    <div class="trend-bar-container">
                        <div class="trend-bar" style="height: ${barHeight}%; background: ${barColor};"></div>
                    </div>
                    <div class="trend-percent" style="color: ${percentColor};">${percent}%</div>
                    <div class="trend-day-name">${dayName}</div>
                    <div class="trend-day-date">${dayDate}</div>
                </div>
            `;
        });

        chartHTML += '</div>';
        chartHTML += `<div class="trend-goal-line" style="bottom: ${goalLinePosition}%"></div>`;

        chartContainer.innerHTML = chartHTML;

        // Add click handlers to each day column
        chartContainer.querySelectorAll('.trend-column').forEach(column => {
            column.addEventListener('click', () => {
                const clickedDate = column.dataset.date;
                if (clickedDate) {
                    navigateToDate(clickedDate);
                }
            });
        });
    } catch (error) {
        console.error('Error updating weekly trend:', error);
        chartContainer.innerHTML = '<div class="weekly-trend-loading">Chyba při načítání dat</div>';
    }
}

/**
 * Update only the selected state in weekly trend (without refetching data)
 */
function updateWeeklyTrendSelection() {
    const chartContainer = document.getElementById('weeklyTrendChart');
    if (!chartContainer) return;

    const selectedDateString = getSelectedDateString();

    chartContainer.querySelectorAll('.trend-column').forEach(column => {
        const columnDate = column.dataset.date;
        const isSelected = columnDate === selectedDateString;

        column.classList.remove('selected');
        if (isSelected) {
            column.classList.add('selected');
        }
    });
}

/**
 * Format a Date object to YYYY-MM-DD string using local time
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
function formatDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get today's date as YYYY-MM-DD string
 * @returns {string} Today's date string
 */
function getTodayString() {
    return formatDateString(new Date());
}

/**
 * Get current selected date as Date object
 */
function getSelectedDate() {
    if (AppState.selectedDate) {
        // Parse date string and create local date object
        const parts = AppState.selectedDate.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date();
}

/**
 * Get current selected date as string (YYYY-MM-DD)
 */
function getSelectedDateString() {
    return AppState.selectedDate || getTodayString();
}

/**
 * Check if selected date is today
 */
function isSelectedDateToday() {
    return getSelectedDateString() === getTodayString();
}

/**
 * Change selected date
 */
function changeDate(direction) {
    const currentDate = getSelectedDate();
    currentDate.setDate(currentDate.getDate() + direction);

    const newDateString = formatDateString(currentDate);
    const today = getTodayString();

    // Don't allow future dates
    if (newDateString > today) {
        return;
    }

    // Don't allow more than 6 days in the past
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    const minDate = formatDateString(sixDaysAgo);

    if (newDateString < minDate) {
        return;
    }

    // Set to new date (or null if it's today)
    AppState.selectedDate = (newDateString === today) ? null : newDateString;

    updateSelectedDateDisplay();
    updateWeeklyTrendSelection(); // Update weekly chart to highlight selected day
    setupMealsListener();
    updateNavigationButtons();
}

/**
 * Go to previous day
 */
function goToPreviousDay() {
    changeDate(-1);
}

/**
 * Go to next day
 */
function goToNextDay() {
    changeDate(1);
}

/**
 * Navigate directly to a specific date
 * @param {string} dateString - Date in YYYY-MM-DD format
 */
function navigateToDate(dateString) {
    const today = getTodayString();

    // Don't allow future dates
    if (dateString > today) {
        return;
    }

    // Set to new date (or null if it's today)
    AppState.selectedDate = (dateString === today) ? null : dateString;

    updateSelectedDateDisplay();
    updateWeeklyTrendSelection(); // Update weekly chart to highlight selected day
    setupMealsListener();
    updateNavigationButtons();
}

/**
 * Update selected date display
 */
function updateSelectedDateDisplay() {
    const selectedDateEl = document.getElementById('selectedDate');
    if (selectedDateEl) {
        if (isSelectedDateToday()) {
            selectedDateEl.textContent = 'Dnes';
        } else {
            const date = getSelectedDate();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);

            const daysDiff = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));

            const options = { weekday: 'short', day: 'numeric', month: 'numeric' };
            const dateStr = date.toLocaleDateString('cs-CZ', options);

            if (daysDiff === 1) {
                selectedDateEl.textContent = `Včera (${dateStr})`;
            } else if (daysDiff === 2) {
                selectedDateEl.textContent = `Předevčírem (${dateStr})`;
            } else {
                selectedDateEl.textContent = dateStr;
            }
        }
    }

    // Update meals list title and date
    const mealsListTitleEl = document.getElementById('mealsListTitle');
    const mealsListDateEl = document.getElementById('mealsListDate');

    if (mealsListTitleEl && mealsListDateEl) {
        const date = getSelectedDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((today - selectedDate) / (1000 * 60 * 60 * 24));

        const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
        const dateStr = date.toLocaleDateString('cs-CZ', options);

        if (isSelectedDateToday()) {
            mealsListTitleEl.textContent = `Seznam jídel dnes (${dateStr})`;
            mealsListDateEl.textContent = '';
        } else if (daysDiff === 1) {
            mealsListTitleEl.textContent = `Seznam jídel včera (${dateStr})`;
            mealsListDateEl.textContent = '';
        } else if (daysDiff === 2) {
            mealsListTitleEl.textContent = `Seznam jídel předevčírem (${dateStr})`;
            mealsListDateEl.textContent = '';
        } else {
            mealsListTitleEl.textContent = `Seznam jídel ${dateStr}`;
            mealsListDateEl.textContent = '';
        }
    }
}

/**
 * Update navigation buttons state
 */
function updateNavigationButtons() {
    const nextBtn = document.getElementById('nextDayBtn');
    if (nextBtn) {
        nextBtn.disabled = isSelectedDateToday();
    }
}

/**
 * Update current date display
 */
function updateCurrentDate() {
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = new Date().toLocaleDateString('cs-CZ', options);
        currentDateEl.textContent = dateStr;
    }
    updateSelectedDateDisplay();
    updateNavigationButtons();
}

/**
 * Show/hide loading modal with cancel option
 * @param {boolean} show - Show or hide the modal
 * @param {string} message - Custom loading message
 */
function showLoading(show, message = 'Analyzuji jídlo...') {
    const modal = document.getElementById('loadingModal');
    const messageEl = document.getElementById('loadingMessage');

    if (!modal) return;

    if (show) {
        if (messageEl) messageEl.textContent = message;
        modal.style.display = 'flex';

        // Setup cancel button
        const cancelBtn = document.getElementById('cancelAnalysisBtn');
        if (cancelBtn) {
            cancelBtn.onclick = cancelAnalysis;
        }
    } else {
        modal.style.display = 'none';
        AppState.abortController = null;
    }
}

/**
 * Cancel ongoing analysis
 */
function cancelAnalysis() {
    console.log('🛑 Canceling analysis...');

    if (AppState.abortController) {
        AppState.abortController.abort();
        AppState.abortController = null;
    }

    AppState.isProcessing = false;
    showLoading(false);
}

/**
 * Show/hide recording modal with timer
 */
function showRecordingModal(show) {
    const modal = document.getElementById('recordingModal');
    if (!modal) return;

    if (show) {
        modal.style.display = 'flex';
        AppState.recordingStartTime = Date.now();

        // Start timer
        updateRecordingTimer();
        AppState.recordingTimerInterval = setInterval(updateRecordingTimer, 100);

        // Setup buttons
        const stopBtn = document.getElementById('stopRecordingBtn');
        const cancelBtn = document.getElementById('cancelRecordingBtn');

        if (stopBtn) stopBtn.onclick = stopRecording;
        if (cancelBtn) cancelBtn.onclick = cancelRecording;
    } else {
        modal.style.display = 'none';

        // Clear timer
        if (AppState.recordingTimerInterval) {
            clearInterval(AppState.recordingTimerInterval);
            AppState.recordingTimerInterval = null;
        }

        AppState.recordingStartTime = null;

        // Reset timer display
        const timerEl = document.getElementById('recordingTimer');
        if (timerEl) timerEl.textContent = '00:00';
    }
}

/**
 * Update recording timer display
 */
function updateRecordingTimer() {
    if (!AppState.recordingStartTime) return;

    const elapsed = Date.now() - AppState.recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    const timerEl = document.getElementById('recordingTimer');
    if (timerEl) {
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
}

/**
 * Stop recording and proceed to analysis
 */
function stopRecording() {
    console.log('⏹️ Stopping recording...');

    if (AppState.mediaRecorder && AppState.mediaRecorder.state === 'recording') {
        AppState.mediaRecorder.stop();
    }

    showRecordingModal(false);

    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.disabled = false;
        voiceBtn.style.opacity = '1';
    }
}

/**
 * Cancel recording without analysis
 */
function cancelRecording() {
    console.log('🛑 Canceling recording...');

    if (AppState.mediaRecorder && AppState.mediaRecorder.state === 'recording') {
        // Stop recording but flag to NOT analyze
        AppState.cancelRecordingFlag = true;
        AppState.mediaRecorder.stop();
    }

    showRecordingModal(false);

    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.textContent = '🎤 Začít nahrávat';
        voiceBtn.style.background = '';
        voiceBtn.disabled = false;
        voiceBtn.style.opacity = '1';
    }
}

/**
 * Show/hide inline loading indicator
 */
function showInlineLoading(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'flex' : 'none';
    }
}

// =====================================
// MEAL EDIT MODAL
// =====================================

/**
 * Open modal for manual meal entry (without AI analysis)
 */
function openManualMealModal() {
    const modal = document.getElementById('mealEditModal');
    const title = document.getElementById('mealEditTitle');
    const deleteBtn = document.getElementById('mealEditDeleteBtn');
    const saveBtn = document.getElementById('mealEditSaveBtn');
    const cancelBtn = document.getElementById('mealEditCancelBtn');

    // Set mode to 'manual' - will create new meal on save
    document.getElementById('editMealMode').value = 'manual';
    document.getElementById('editMealId').value = '';

    // Clear form with default values
    document.getElementById('editMealName').value = '';
    document.getElementById('editMealProtein').value = '';
    document.getElementById('editMealCarbs').value = '';
    document.getElementById('editMealFat').value = '';

    // Setup calories slider with default value
    setupCaloriesSlider(300);

    // Setup macro inputs
    setupMacroInputs();

    // Configure UI for manual mode
    title.textContent = 'Přidat jídlo ručně';
    saveBtn.textContent = 'Přidat';
    cancelBtn.textContent = 'Zrušit';
    deleteBtn.style.display = 'none';

    // Reset favorite status
    currentMealFavoriteId = null;
    const favBtn = document.getElementById('mealFavoriteBtn');
    if (favBtn) {
        favBtn.classList.remove('active');
    }

    // Show modal
    modal.classList.add('active');

    // Focus on name input
    setTimeout(() => {
        document.getElementById('editMealName').focus();
    }, 100);
}

/**
 * Open meal edit modal
 * @param {string} mode - 'edit' for existing meal, 'new' for newly added meal
 * @param {Object} meal - Meal data (id, name, calories, protein, carbs, fat)
 */
// Store favoriteId for remove action
let currentModalFavoriteId = null;
// Store current meal data for copy to today
let currentModalMealData = null;

async function openMealEditModal(mode, meal) {
    const modal = document.getElementById('mealEditModal');
    const title = document.getElementById('mealEditTitle');
    const deleteBtn = document.getElementById('mealEditDeleteBtn');
    const saveBtn = document.getElementById('mealEditSaveBtn');
    const cancelBtn = document.getElementById('mealEditCancelBtn');
    const favoriteBtn = document.getElementById('mealFavoriteBtn');
    const removeFavoriteBtn = document.getElementById('removeFavoriteBtn');
    const copyToTodayBtn = document.getElementById('copyToTodayBtn');

    // Store favoriteId if opening from favorites list
    currentModalFavoriteId = meal.favoriteId || null;
    // Store meal data for copy to today
    currentModalMealData = meal;

    // Set mode
    document.getElementById('editMealMode').value = mode;
    document.getElementById('editMealId').value = meal.id || '';

    // Fill form
    document.getElementById('editMealName').value = meal.name || '';
    document.getElementById('editMealProtein').value = meal.protein || '';
    document.getElementById('editMealCarbs').value = meal.carbs || '';
    document.getElementById('editMealFat').value = meal.fat || '';

    // Setup calories with dynamic slider
    const calories = meal.calories || 100;
    setupCaloriesSlider(calories);

    // Setup macro inputs with percentages
    setupMacroInputs();

    // Configure UI based on mode
    const viewingPastDay = !isSelectedDateToday();

    // Reset save button state (in case previous save was in progress)
    saveBtn.disabled = false;
    saveBtn.classList.remove('saving');

    if (mode === 'edit') {
        title.textContent = 'Upravit jídlo';
        saveBtn.textContent = 'Uložit';
        cancelBtn.textContent = 'Zrušit';
        deleteBtn.style.display = 'block';
        favoriteBtn.style.display = 'flex';
        removeFavoriteBtn.style.display = 'none';
        // Show copy to today button only for past days
        copyToTodayBtn.style.display = viewingPastDay ? 'flex' : 'none';
        // Check favorite status for edit mode
        await checkMealFavoriteStatus(meal.name);
    } else if (currentModalFavoriteId) {
        // Opening from favorites - show remove button instead of star
        title.textContent = 'Přidat jídlo';
        saveBtn.textContent = 'Přidat';
        cancelBtn.textContent = 'Zrušit';
        deleteBtn.style.display = 'none';
        favoriteBtn.style.display = 'none';
        removeFavoriteBtn.style.display = 'flex';
        copyToTodayBtn.style.display = 'none';
    } else {
        // mode === 'new' or 'manual' without favoriteId
        title.textContent = 'Přidat jídlo';
        saveBtn.textContent = 'Přidat';
        cancelBtn.textContent = 'Zrušit';
        deleteBtn.style.display = 'none';
        favoriteBtn.style.display = 'flex';
        removeFavoriteBtn.style.display = 'none';
        copyToTodayBtn.style.display = 'none';
        // Check favorite status
        await checkMealFavoriteStatus(meal.name);
    }

    // Show modal
    modal.classList.add('active');
}

/**
 * Setup calories slider with dynamic range (±50% of current value)
 */
function setupCaloriesSlider(calories) {
    const slider = document.getElementById('editMealCaloriesSlider');
    const input = document.getElementById('editMealCalories');

    // Calculate dynamic range (±50%, minimum 50 kcal range)
    const minVal = Math.max(0, Math.round(calories * 0.5));
    const maxVal = Math.max(calories + 50, Math.round(calories * 1.5));

    slider.min = minVal;
    slider.max = maxVal;
    slider.value = calories;
    input.value = calories;

    // Sync slider → input
    slider.oninput = function() {
        input.value = this.value;
    };

    // Sync input → slider (and adjust range if needed)
    input.oninput = function() {
        const newVal = parseInt(this.value) || 0;
        // Expand range if value goes outside
        if (newVal < parseInt(slider.min)) {
            slider.min = Math.max(0, Math.round(newVal * 0.5));
        }
        if (newVal > parseInt(slider.max)) {
            slider.max = Math.round(newVal * 1.5);
        }
        slider.value = newVal;
    };
}

/**
 * Setup macro inputs with percentage display
 */
function setupMacroInputs() {
    const proteinInput = document.getElementById('editMealProtein');
    const carbsInput = document.getElementById('editMealCarbs');
    const fatInput = document.getElementById('editMealFat');

    const updatePercents = () => {
        // Percentage display elements are optional
        const proteinPercentEl = document.getElementById('editProteinPercent');
        const carbsPercentEl = document.getElementById('editCarbsPercent');
        const fatPercentEl = document.getElementById('editFatPercent');

        if (!proteinPercentEl || !carbsPercentEl || !fatPercentEl) return;

        const protein = parseFloat(proteinInput.value) || 0;
        const carbs = parseFloat(carbsInput.value) || 0;
        const fat = parseFloat(fatInput.value) || 0;

        // Calculate percentages based on daily goals
        if (AppState.dailyGoals) {
            const proteinPercent = Math.round((protein / AppState.dailyGoals.protein) * 100);
            const carbsPercent = Math.round((carbs / AppState.dailyGoals.carbs) * 100);
            const fatPercent = Math.round((fat / AppState.dailyGoals.fat) * 100);

            proteinPercentEl.textContent = proteinPercent + '%';
            carbsPercentEl.textContent = carbsPercent + '%';
            fatPercentEl.textContent = fatPercent + '%';
        }
    };

    proteinInput.oninput = updatePercents;
    carbsInput.oninput = updatePercents;
    fatInput.oninput = updatePercents;

    // Initial update
    updatePercents();
}

/**
 * Close meal edit modal
 * @param {boolean} deleteMeal - If true and mode is 'new', delete the meal
 */
function closeMealEditModal(deleteMeal = false) {
    const modal = document.getElementById('mealEditModal');
    const mode = document.getElementById('editMealMode').value;
    const mealId = document.getElementById('editMealId').value;

    // If closing new meal modal without saving, delete the meal
    if (mode === 'new' && mealId && deleteMeal !== false) {
        deleteMealSilent(mealId);
    }

    // Reset save button state
    const saveBtn = document.getElementById('mealEditSaveBtn');
    saveBtn.disabled = false;
    saveBtn.classList.remove('saving');

    modal.classList.remove('active');
}

/**
 * Save meal edit
 */
async function saveMealEdit() {
    const saveBtn = document.getElementById('mealEditSaveBtn');

    // Prevent double-click
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    saveBtn.classList.add('saving');
    saveBtn.textContent = 'Ukládám...';

    const mode = document.getElementById('editMealMode').value;
    const mealId = document.getElementById('editMealId').value;

    const mealData = {
        name: document.getElementById('editMealName').value.trim(),
        calories: parseInt(document.getElementById('editMealCalories').value) || 0,
        protein: parseFloat(document.getElementById('editMealProtein').value) || 0,
        carbs: parseFloat(document.getElementById('editMealCarbs').value) || 0,
        fat: parseFloat(document.getElementById('editMealFat').value) || 0
    };

    // Helper to reset button state
    const resetBtn = () => {
        saveBtn.disabled = false;
        saveBtn.classList.remove('saving');
        saveBtn.textContent = 'Uložit';
    };

    // Validate
    if (!mealData.name) {
        alert('Zadejte název jídla');
        resetBtn();
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen');
        resetBtn();
        return;
    }

    try {
        const dateString = getSelectedDateString();

        if (mode === 'manual' || mode === 'new') {
            // Manual entry or new meal from AI analysis - create new meal in Firestore
            await addMealToFirestore(AppState.currentUser.uid, mealData, dateString);
            console.log('✅ Meal added successfully');
        } else {
            // Update existing meal (edit mode)
            await updateMealInFirestore(AppState.currentUser.uid, mealId, mealData, dateString);
        }

        // Update food history
        await updateFoodHistory(AppState.currentUser.uid, mealData);

        console.log('✅ Meal saved successfully');

        // Close modal (don't delete meal - we just saved it)
        closeMealEditModal(false);

        // Update weekly trend after edit (calories may have changed)
        updateWeeklyTrend();

    } catch (error) {
        console.error('Error saving meal:', error);
        alert('Chyba při ukládání jídla');
        resetBtn();
    }
}

/**
 * Delete meal from edit modal
 */
async function deleteMealFromEdit() {
    const mealId = document.getElementById('editMealId').value;

    const confirmed = await showConfirmDialog('Smazat jídlo?', 'Tato akce je nevratná.');
    if (!confirmed) {
        return;
    }

    try {
        const dateString = getSelectedDateString();
        await deleteMealFromFirestore(AppState.currentUser.uid, mealId, dateString);
        console.log('✅ Meal deleted from edit modal');

        // Close modal
        const modal = document.getElementById('mealEditModal');
        modal.classList.remove('active');

        // Update weekly trend after deletion
        updateWeeklyTrend();

    } catch (error) {
        console.error('Error deleting meal:', error);
        alert('Chyba při mazání jídla');
    }
}

/**
 * Delete meal silently (without confirmation)
 */
async function deleteMealSilent(mealId) {
    if (!AppState.currentUser || !mealId) return;

    try {
        const dateString = getSelectedDateString();
        await deleteMealFromFirestore(AppState.currentUser.uid, mealId, dateString);
        console.log('✅ Meal deleted silently:', mealId);

        // Update weekly trend after deletion
        updateWeeklyTrend();
    } catch (error) {
        console.error('Error deleting meal silently:', error);
    }
}

// =====================================
// FOOD HISTORY & FAVORITES
// =====================================

/**
 * Current state for food history modal
 */
let currentFoodModalTab = 'history';
let currentMealFavoriteId = null;
let currentFoodListData = []; // Store loaded data for filtering

/**
 * Open food history modal (shows history tab)
 */
function openFoodHistoryModal() {
    document.getElementById('foodSearchInput').value = '';
    switchFoodModalTab('history');
    const modal = document.getElementById('foodHistoryModal');
    modal.classList.add('active');
}

/**
 * Open favorites modal (shows favorites tab)
 */
function openFavoritesModal() {
    document.getElementById('foodSearchInput').value = '';
    switchFoodModalTab('favorites');
    const modal = document.getElementById('foodHistoryModal');
    modal.classList.add('active');
}

/**
 * Close food history modal
 */
function closeFoodHistoryModal() {
    const modal = document.getElementById('foodHistoryModal');
    modal.classList.remove('active');
}

/**
 * Switch between history and favorites tabs
 */
async function switchFoodModalTab(tab) {
    currentFoodModalTab = tab;

    // Update tab buttons
    const historyTab = document.getElementById('historyTab');
    const favoritesTab = document.getElementById('favoritesTab');
    const title = document.getElementById('foodHistoryTitle');

    if (tab === 'history') {
        historyTab.classList.add('active');
        favoritesTab.classList.remove('active');
        title.textContent = 'Historie jídel';
    } else {
        historyTab.classList.remove('active');
        favoritesTab.classList.add('active');
        title.textContent = 'Oblíbená jídla';
    }

    // Load data
    await loadFoodList(tab);
}

/**
 * Load food list (history or favorites)
 */
async function loadFoodList(type) {
    const listContainer = document.getElementById('foodHistoryList');

    if (!AppState.currentUser) {
        listContainer.innerHTML = '<p class="empty-state">Nejste přihlášen</p>';
        return;
    }

    listContainer.innerHTML = '<p class="empty-state">Načítám...</p>';

    try {
        let foods = [];
        if (type === 'history') {
            foods = await getFoodHistory(AppState.currentUser.uid);
        } else {
            foods = await getFavoriteFoods(AppState.currentUser.uid);
        }

        // Store for filtering
        currentFoodListData = foods.map(food =>
            type === 'favorites' ? { ...food, favoriteId: food.id } : food
        );

        renderFoodList(currentFoodListData, type);

    } catch (error) {
        console.error('Error loading food list:', error);
        listContainer.innerHTML = '<p class="empty-state">Chyba při načítání</p>';
    }
}

/**
 * Render food list to DOM
 */
function renderFoodList(foods, type) {
    const listContainer = document.getElementById('foodHistoryList');

    if (foods.length === 0) {
        const searchValue = document.getElementById('foodSearchInput').value;
        const emptyMessage = searchValue
            ? 'Žádné výsledky.'
            : (type === 'history'
                ? 'Zatím žádná historie jídel.'
                : 'Zatím žádná oblíbená jídla.');
        listContainer.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
        return;
    }

    listContainer.innerHTML = foods.map(food => {
        const foodJson = JSON.stringify(food).replace(/'/g, "\\'").replace(/"/g, '&quot;');
        return `
            <div class="food-item" onclick="addFoodFromList(${foodJson})">
                <div class="food-item-info">
                    <span class="food-item-name">${food.name}</span>
                    <span class="food-item-calories">${food.calories} kcal</span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filter food list by search query
 */
function filterFoodList() {
    const searchValue = document.getElementById('foodSearchInput').value.toLowerCase().trim();

    if (!searchValue) {
        renderFoodList(currentFoodListData, currentFoodModalTab);
        return;
    }

    const filtered = currentFoodListData.filter(food =>
        food.name.toLowerCase().includes(searchValue)
    );

    renderFoodList(filtered, currentFoodModalTab);
}

/**
 * Add food from history/favorites list
 * Opens edit modal for review before saving (doesn't save immediately)
 */
function addFoodFromList(food) {
    closeFoodHistoryModal();

    const nutritionData = {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        favoriteId: food.favoriteId || null  // Pass favoriteId if from favorites
    };

    // Open modal for review - 'manual' mode creates new meal on save
    openMealEditModal('manual', nutritionData);
}

/**
 * Remove favorite food from list
 */
async function removeFavorite(favoriteId) {
    if (!AppState.currentUser) return;

    try {
        await removeFavoriteFood(AppState.currentUser.uid, favoriteId);
        // Reload the list
        await loadFoodList('favorites');
    } catch (error) {
        console.error('Error removing favorite:', error);
        alert('Chyba při odebírání z oblíbených');
    }
}

/**
 * Remove from favorites and close modal (used when opening favorite for adding)
 */
async function removeFromFavoritesAndClose() {
    if (!AppState.currentUser || !currentModalFavoriteId) return;

    const confirmed = await showConfirmDialog(
        'Odebrat z oblíbených?',
        'Jídlo bude odebráno z oblíbených.',
        '⭐'
    );

    if (!confirmed) return;

    try {
        await removeFavoriteFood(AppState.currentUser.uid, currentModalFavoriteId);
        closeMealEditModal(false);
    } catch (error) {
        console.error('Error removing favorite:', error);
        alert('Chyba při odebírání z oblíbených');
    }
}

/**
 * Toggle meal favorite status in edit modal
 */
async function toggleMealFavorite() {
    if (!AppState.currentUser) return;

    const mealName = document.getElementById('editMealName').value.trim();
    if (!mealName) {
        alert('Zadejte nejprve název jídla');
        return;
    }

    const mealData = {
        name: mealName,
        calories: parseInt(document.getElementById('editMealCalories').value) || 0,
        protein: parseFloat(document.getElementById('editMealProtein').value) || 0,
        carbs: parseFloat(document.getElementById('editMealCarbs').value) || 0,
        fat: parseFloat(document.getElementById('editMealFat').value) || 0
    };

    try {
        if (currentMealFavoriteId) {
            // Remove from favorites
            await removeFavoriteFood(AppState.currentUser.uid, currentMealFavoriteId);
            currentMealFavoriteId = null;
            updateFavoriteIcon(false);
        } else {
            // Add to favorites
            const id = await addFavoriteFood(AppState.currentUser.uid, mealData);
            currentMealFavoriteId = id;
            updateFavoriteIcon(true);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Chyba při změně oblíbených');
    }
}

/**
 * Update favorite icon in edit modal
 */
function updateFavoriteIcon(isFavorite) {
    const outlineIcon = document.getElementById('favoriteIconOutline');
    const filledIcon = document.getElementById('favoriteIconFilled');
    const btn = document.getElementById('mealFavoriteBtn');

    if (isFavorite) {
        outlineIcon.style.display = 'none';
        filledIcon.style.display = 'block';
        btn.classList.add('is-favorite');
        btn.title = 'Odebrat z oblíbených';
    } else {
        outlineIcon.style.display = 'block';
        filledIcon.style.display = 'none';
        btn.classList.remove('is-favorite');
        btn.title = 'Přidat do oblíbených';
    }
}

/**
 * Check favorite status when opening meal edit modal
 */
async function checkMealFavoriteStatus(mealName) {
    if (!AppState.currentUser || !mealName) {
        currentMealFavoriteId = null;
        updateFavoriteIcon(false);
        return;
    }

    try {
        const { isFavorite, favoriteId } = await checkIsFavorite(AppState.currentUser.uid, mealName);
        currentMealFavoriteId = favoriteId;
        updateFavoriteIcon(isFavorite);
    } catch (error) {
        console.error('Error checking favorite status:', error);
        currentMealFavoriteId = null;
        updateFavoriteIcon(false);
    }
}

// =====================================
// INITIALIZATION
// =====================================

console.log('✅ app.js loaded successfully');
