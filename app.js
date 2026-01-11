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

/**
 * Save user profile data to Firestore
 */
async function saveUserData() {
    const age = parseInt(document.getElementById('userAge').value);
    const gender = document.getElementById('userGender').value;
    const weight = parseFloat(document.getElementById('userWeight').value);
    const height = parseInt(document.getElementById('userHeight').value);
    const activity = parseFloat(document.getElementById('userActivity').value);
    const goal = document.getElementById('userGoal').value;

    if (!age || !weight || !height) {
        alert('Vyplňte prosím všechny údaje');
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const profileData = { age, gender, weight, height, activity, goal };
        const calculatedGoals = await saveUserProfile(AppState.currentUser.uid, profileData);

        AppState.userData = profileData;
        AppState.dailyGoals = calculatedGoals;

        // Build alert message with TDEE and deficit info
        let message = 'Osobní údaje byly uloženy!\n\n';
        message += `BMR (bazální metabolismus): ${calculatedGoals.bmr} kcal\n`;
        message += `TDEE (udržovací kalorie): ${calculatedGoals.tdee} kcal\n`;

        if (calculatedGoals.deficit !== 0) {
            const deficitText = calculatedGoals.deficit > 0 ? `+${calculatedGoals.deficit}` : calculatedGoals.deficit;
            message += `Deficit/Přebytek: ${deficitText} kcal/den\n\n`;
        } else {
            message += '\n';
        }

        message += 'Vaše denní cílové hodnoty:\n';
        message += `Kalorie: ${calculatedGoals.calories} kcal\n`;
        message += `Bílkoviny: ${calculatedGoals.protein} g\n`;
        message += `Sacharidy: ${calculatedGoals.carbs} g\n`;
        message += `Tuky: ${calculatedGoals.fat} g`;

        alert(message);

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
                height: profile.height,
                activity: profile.activity,
                goal: profile.goal || 'maintain'
            };

            AppState.dailyGoals = profile.dailyGoals;

            // Load into form
            document.getElementById('userAge').value = AppState.userData.age;
            document.getElementById('userGender').value = AppState.userData.gender;
            document.getElementById('userWeight').value = AppState.userData.weight;
            document.getElementById('userHeight').value = AppState.userData.height;
            document.getElementById('userActivity').value = AppState.userData.activity;
            document.getElementById('userGoal').value = AppState.userData.goal;

            console.log('✅ User data loaded from Firestore');
        } else {
            console.log('ℹ️ No user profile found (new user)');
            AppState.userData = null;
            AppState.dailyGoals = null;
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

    const dateString = getSelectedDateString();
    AppState.unsubscribeMealsListener = listenToMealsForDate(
        AppState.currentUser.uid,
        dateString,
        (updatedMeals) => {
            console.log('📥 Meals updated from Firestore for', dateString, ':', updatedMeals.length);
            AppState.meals = updatedMeals;
            updateSummary();
            updateWeeklyTrend();
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
    if (!confirm('Opravdu chcete smazat toto jídlo?')) {
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
    } catch (error) {
        console.error('Error deleting meal:', error);
        alert('Chyba při mazání jídla. Zkuste to prosím znovu.');
    }
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
        const mealJson = JSON.stringify(meal).replace(/'/g, "\\'").replace(/"/g, '&quot;');

        return `
        <div class="meal-item-compact" onclick="openMealEditModal('edit', ${mealJson})">
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
            <button class="btn-delete-compact" onclick="event.stopPropagation(); deleteMeal('${meal.id}')" title="Smazat">🗑️</button>
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
            await addMeal(nutritionData);
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
            await addMeal(nutritionData);
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
            await addMeal(nutritionData);
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

// iOS-style progress colors
const PROGRESS_COLORS = {
    over: '#FF3B30',    // iOS Red - exceeded goal
    atGoal: '#FF9500',  // iOS Orange - at goal
    good: '#34C759',    // iOS Green - good progress
    early: 'rgba(255, 255, 255, 0.9)' // White - early progress
};

// Macro-specific colors for normal range
const MACRO_COLORS = {
    protein: '#FF6B6B',
    carbs: '#FFB84D',
    fat: '#51CF66'
};

/**
 * Get progress bar color based on percentage
 * @param {number} percent - Percentage value
 * @returns {string} Color value
 */
function getProgressColor(percent) {
    if (percent >= 110) return PROGRESS_COLORS.over;
    if (percent >= 95) return PROGRESS_COLORS.atGoal;
    if (percent >= 80) return PROGRESS_COLORS.good;
    return PROGRESS_COLORS.early;
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

        // Fetch weekly data
        const weeklyData = await getWeeklyMealsData(AppState.currentUser.uid);
        const todayDateString = new Date().toISOString().split('T')[0];

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

            // Calculate bar height (percentage of max)
            const barHeight = maxCalories > 0 ? (dayData.totalCalories / maxCalories) * 100 : 0;

            // Determine bar style class
            let barClass = 'trend-bar';
            if (percent >= 95 && percent <= 105) {
                barClass += ' goal-reached';
            } else if (percent > 105) {
                barClass += ' over-goal';
            } else if (dayData.totalCalories > 0) {
                barClass += ' in-progress';
            } else {
                barClass += ' no-data';
            }

            const isToday = dayData.date === todayDateString;
            const isSelected = dayData.date === AppState.selectedDate;

            // If no date is selected (viewing today), mark today as selected
            const isTodayActive = isToday && !AppState.selectedDate;

            let columnClasses = 'trend-column';
            if (isToday) columnClasses += ' today';
            if (isSelected || isTodayActive) columnClasses += ' selected';

            chartHTML += `
                <div class="${columnClasses}">
                    <div class="trend-bar-container">
                        <div class="${barClass}" style="height: ${barHeight}%"></div>
                    </div>
                    <div class="trend-percent">${percent}%</div>
                    <div class="trend-day-name">${dayName}</div>
                    <div class="trend-day-date">${dayDate}</div>
                </div>
            `;
        });

        chartHTML += '</div>';
        chartHTML += `<div class="trend-goal-line" style="bottom: ${goalLinePosition}%"></div>`;

        chartContainer.innerHTML = chartHTML;
    } catch (error) {
        console.error('Error updating weekly trend:', error);
        chartContainer.innerHTML = '<div class="weekly-trend-loading">Chyba při načítání dat</div>';
    }
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
 * Open meal edit modal
 * @param {string} mode - 'edit' for existing meal, 'new' for newly added meal
 * @param {Object} meal - Meal data (id, name, calories, protein, carbs, fat)
 */
async function openMealEditModal(mode, meal) {
    const modal = document.getElementById('mealEditModal');
    const title = document.getElementById('mealEditTitle');
    const deleteBtn = document.getElementById('mealEditDeleteBtn');
    const saveBtn = document.getElementById('mealEditSaveBtn');
    const cancelBtn = document.getElementById('mealEditCancelBtn');

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
    if (mode === 'edit') {
        title.textContent = 'Upravit jídlo';
        saveBtn.textContent = 'Uložit';
        cancelBtn.textContent = 'Zrušit';
        deleteBtn.style.display = 'block';
    } else {
        // mode === 'new'
        title.textContent = 'Přidat jídlo';
        saveBtn.textContent = 'OK';
        cancelBtn.textContent = 'Zrušit';
        deleteBtn.style.display = 'none';
    }

    // Check favorite status
    await checkMealFavoriteStatus(meal.name);

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
        const protein = parseFloat(proteinInput.value) || 0;
        const carbs = parseFloat(carbsInput.value) || 0;
        const fat = parseFloat(fatInput.value) || 0;

        // Calculate percentages based on daily goals
        if (AppState.dailyGoals) {
            const proteinPercent = Math.round((protein / AppState.dailyGoals.protein) * 100);
            const carbsPercent = Math.round((carbs / AppState.dailyGoals.carbs) * 100);
            const fatPercent = Math.round((fat / AppState.dailyGoals.fat) * 100);

            document.getElementById('editProteinPercent').textContent = proteinPercent + '%';
            document.getElementById('editCarbsPercent').textContent = carbsPercent + '%';
            document.getElementById('editFatPercent').textContent = fatPercent + '%';
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

    modal.classList.remove('active');
}

/**
 * Save meal edit
 */
async function saveMealEdit() {
    const mode = document.getElementById('editMealMode').value;
    const mealId = document.getElementById('editMealId').value;

    const mealData = {
        name: document.getElementById('editMealName').value.trim(),
        calories: parseInt(document.getElementById('editMealCalories').value) || 0,
        protein: parseFloat(document.getElementById('editMealProtein').value) || 0,
        carbs: parseFloat(document.getElementById('editMealCarbs').value) || 0,
        fat: parseFloat(document.getElementById('editMealFat').value) || 0
    };

    // Validate
    if (!mealData.name) {
        alert('Zadejte název jídla');
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen');
        return;
    }

    try {
        const dateString = getSelectedDateString();

        if (mode === 'new') {
            // For new meal, it's already saved - just update it
            await updateMealInFirestore(AppState.currentUser.uid, mealId, mealData, dateString);
        } else {
            // Update existing meal
            await updateMealInFirestore(AppState.currentUser.uid, mealId, mealData, dateString);
        }

        // Update food history
        await updateFoodHistory(AppState.currentUser.uid, mealData);

        console.log('✅ Meal saved successfully');

        // Close modal without deleting
        const modal = document.getElementById('mealEditModal');
        modal.classList.remove('active');

    } catch (error) {
        console.error('Error saving meal:', error);
        alert('Chyba při ukládání jídla');
    }
}

/**
 * Delete meal from edit modal
 */
async function deleteMealFromEdit() {
    const mealId = document.getElementById('editMealId').value;

    if (!confirm('Opravdu chcete smazat toto jídlo?')) {
        return;
    }

    try {
        const dateString = getSelectedDateString();
        await deleteMealFromFirestore(AppState.currentUser.uid, mealId, dateString);
        console.log('✅ Meal deleted from edit modal');

        // Close modal
        const modal = document.getElementById('mealEditModal');
        modal.classList.remove('active');

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

/**
 * Open food history modal (shows history tab)
 */
function openFoodHistoryModal() {
    switchFoodModalTab('history');
    const modal = document.getElementById('foodHistoryModal');
    modal.classList.add('active');
}

/**
 * Open favorites modal (shows favorites tab)
 */
function openFavoritesModal() {
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

        if (foods.length === 0) {
            const emptyMessage = type === 'history'
                ? 'Zatím žádná historie jídel.'
                : 'Zatím žádná oblíbená jídla. Přidejte je hvězdičkou při přidání nebo editaci jídla.';
            listContainer.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
            return;
        }

        listContainer.innerHTML = foods.map(food => {
            const foodJson = JSON.stringify(food).replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const deleteBtn = type === 'favorites'
                ? `<button class="food-item-delete" onclick="event.stopPropagation(); removeFavorite('${food.id}')" title="Odebrat z oblíbených">✕</button>`
                : '';

            return `
                <div class="food-item" onclick="addFoodFromList(${foodJson})">
                    <div class="food-item-info">
                        <div class="food-item-name">${food.name}</div>
                        <div class="food-item-macros">
                            ${food.calories} kcal • 🥩 ${food.protein}g • 🌾 ${food.carbs}g • 🥑 ${food.fat}g
                        </div>
                    </div>
                    ${deleteBtn}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading food list:', error);
        listContainer.innerHTML = '<p class="empty-state">Chyba při načítání</p>';
    }
}

/**
 * Add food from history/favorites list
 */
async function addFoodFromList(food) {
    closeFoodHistoryModal();

    const nutritionData = {
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat
    };

    await addMeal(nutritionData);
}

/**
 * Remove favorite food
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
