// =====================================
// AI DIET - MAIN APPLICATION
// =====================================

// =====================================
// GLOBAL STATE
// =====================================
const AppState = {
    meals: [],
    apiKey: '',
    currentUser: null,
    userData: null,
    dailyGoals: null,
    isProcessing: false,
    unsubscribeMealsListener: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null
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
        await loadApiKeyFromFirestore();
        await loadUserDataFromFirestore();

        // Setup listeners
        setupMealsListener();
        setupEventListeners();
        setupVoiceRecognition();

        // Update UI
        updateCurrentDate();
        updateSummary();

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
        apiKey: '',
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
}

// =====================================
// API KEY MANAGEMENT
// =====================================

/**
 * Load API key from Firestore
 */
async function loadApiKeyFromFirestore() {
    try {
        AppState.apiKey = await getApiKeyFromFirestore();
        console.log('✅ API key loaded from Firestore');

        const apiKeySection = document.getElementById('apiKeySection');
        if (apiKeySection) {
            apiKeySection.innerHTML = `
                <div style="padding: 12px 16px; background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 6px; color: #2C3E50;">
                    ✅ API klíč je načten z centrální databáze
                    <p style="margin-top: 8px; font-size: 13px; color: #5F6368;">Všichni uživatelé sdílí společný API klíč</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('❌ Failed to load API key:', error);

        const apiKeySection = document.getElementById('apiKeySection');
        if (apiKeySection) {
            apiKeySection.innerHTML = `
                <div style="padding: 12px 16px; background: #FFEBEE; border: 1px solid #FFCDD2; border-radius: 6px; color: #C62828;">
                    ❌ Chyba při načítání API klíče
                    <p style="margin-top: 8px; font-size: 13px;">Kontaktujte administrátora</p>
                </div>
            `;
        }

        throw error;
    }
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

    if (!age || !weight || !height) {
        alert('Vyplňte prosím všechny údaje');
        return;
    }

    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const profileData = { age, gender, weight, height, activity };
        const calculatedGoals = await saveUserProfile(AppState.currentUser.uid, profileData);

        AppState.userData = profileData;
        AppState.dailyGoals = calculatedGoals;

        alert('Osobní údaje byly uloženy!\n\nVaše doporučené denní hodnoty:\n' +
              `Kalorie: ${AppState.dailyGoals.calories} kcal\n` +
              `Bílkoviny: ${AppState.dailyGoals.protein}g\n` +
              `Sacharidy: ${AppState.dailyGoals.carbs}g\n` +
              `Tuky: ${AppState.dailyGoals.fat}g`);

        updateSummary();
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
                activity: profile.activity
            };

            AppState.dailyGoals = profile.dailyGoals;

            // Load into form
            document.getElementById('userAge').value = AppState.userData.age;
            document.getElementById('userGender').value = AppState.userData.gender;
            document.getElementById('userWeight').value = AppState.userData.weight;
            document.getElementById('userHeight').value = AppState.userData.height;
            document.getElementById('userActivity').value = AppState.userData.activity;

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

    AppState.unsubscribeMealsListener = listenToTodayMeals(
        AppState.currentUser.uid,
        (updatedMeals) => {
            console.log('📥 Meals updated from Firestore:', updatedMeals.length);
            AppState.meals = updatedMeals;
            updateSummary();
            displayMeals();
        }
    );

    console.log('✅ Meals real-time listener setup complete');
}

/**
 * Add meal to Firestore
 */
async function addMeal(nutritionData) {
    if (!AppState.currentUser) {
        alert('Nejste přihlášen. Přihlaste se prosím.');
        return;
    }

    try {
        const canMakeCall = await checkRateLimit(AppState.currentUser.uid);
        if (!canMakeCall) {
            const remaining = await getRemainingApiCalls(AppState.currentUser.uid);
            alert(`❌ Dosáhli jste denního limitu API volání.\n\nZbývající volání dnes: ${remaining}`);
            return;
        }

        await addMealToFirestore(AppState.currentUser.uid, nutritionData);
        console.log('✅ Meal added successfully');
    } catch (error) {
        console.error('Error adding meal:', error);
        alert('Chyba při ukládání jídla. Zkuste to prosím znovu.');
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
        await deleteMealFromFirestore(AppState.currentUser.uid, id);
        console.log('✅ Meal deleted successfully');
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

        return `
        <div class="meal-item-compact">
            <div class="meal-left">
                <div class="meal-name-compact">${mealName}</div>
                <div class="meal-meta">
                    <span class="meal-percent-badge">${caloriePercent}%</span>
                    <span class="meal-calories">${meal.calories} kcal</span>
                </div>
            </div>
            <div class="meal-right">
                <span class="meal-macro-item">🥩 ${meal.protein}g</span>
                <span class="meal-macro-item">🌾 ${meal.carbs}g</span>
                <span class="meal-macro-item">🥑 ${meal.fat}g</span>
            </div>
            <button class="btn-delete-compact" onclick="deleteMeal(${meal.id})" title="Smazat">🗑️</button>
        </div>
    `;
    }).join('');
}

// =====================================
// GEMINI API INTEGRATION
// =====================================

/**
 * Call Gemini API with text or image
 */
async function callGeminiAPI(prompt, imageBase64 = null) {
    if (!AppState.apiKey) {
        alert('API klíč není dostupný. Kontaktujte administrátora.');
        return null;
    }

    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];

    let requestBody;

    if (imageBase64) {
        requestBody = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: imageBase64
                        }
                    }
                ]
            }]
        };
    } else {
        requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };
    }

    const apiVersions = ['v1beta', 'v1'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        for (const apiVersion of apiVersions) {
            try {
                console.log(`Trying ${apiVersion} model: ${modelName}`);
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${AppState.apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    lastError = errorData.error?.message || 'Neznámá chyba';
                    console.warn(`${apiVersion}/models/${modelName} failed:`, lastError);
                    continue;
                }

                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text;
                console.log(`✅ Success with ${apiVersion}/models/${modelName}`);
                return text;

            } catch (error) {
                lastError = error.message;
                console.warn(`${apiVersion}/models/${modelName} error:`, error.message);
            }
        }
    }

    console.error('All models failed. Last error:', lastError);
    alert(`Chyba při volání API: ${lastError}\n\nKontaktujte administrátora.`);
    return null;
}

/**
 * Call Gemini API with audio
 */
async function callGeminiAPIWithAudio(prompt, audioBase64) {
    if (!AppState.apiKey) {
        alert('API klíč není dostupný. Kontaktujte administrátora.');
        return null;
    }

    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ];

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: "audio/webm",
                        data: audioBase64
                    }
                }
            ]
        }]
    };

    const apiVersions = ['v1beta', 'v1'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        for (const apiVersion of apiVersions) {
            try {
                console.log(`Trying ${apiVersion} model: ${modelName} with audio`);
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${AppState.apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    lastError = errorData.error?.message || 'Neznámá chyba';
                    console.warn(`${apiVersion}/models/${modelName} failed:`, lastError);
                    continue;
                }

                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text;
                console.log(`✅ Success with ${apiVersion}/models/${modelName} (audio)`);
                return text;

            } catch (error) {
                lastError = error.message;
                console.warn(`${apiVersion}/models/${modelName} error:`, error.message);
            }
        }
    }

    console.error('All audio models failed. Last error:', lastError);
    alert(`Chyba při zpracování audio: ${lastError}`);
    return null;
}

/**
 * Parse nutrition data from AI response
 */
function parseNutritionData(aiResponse) {
    try {
        console.log('Parsing AI response:', aiResponse);

        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            console.log('Found JSON in response:', jsonMatch[0]);
            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.name || typeof parsed.calories !== 'number' ||
                typeof parsed.protein !== 'number' ||
                typeof parsed.carbs !== 'number' ||
                typeof parsed.fat !== 'number') {
                console.error('Invalid data structure:', parsed);
                return null;
            }

            const result = {
                name: parsed.name,
                calories: Math.round(parsed.calories),
                protein: Math.round(parsed.protein),
                carbs: Math.round(parsed.carbs),
                fat: Math.round(parsed.fat)
            };

            if (result.calories < 5) {
                console.warn('Calories too low, likely not food:', result);
                return null;
            }

            if (result.protein === 0 && result.carbs === 0 && result.fat === 0) {
                console.warn('All macros are zero, likely not food:', result);
                return null;
            }

            return result;
        }

        console.log('No JSON found, trying text parsing');
        const lines = aiResponse.toLowerCase();
        const result = {
            name: "Analyzované jídlo",
            calories: Math.round(parseInt(lines.match(/(\d+)\s*(kcal|kalori)/)?.[1] || '0')),
            protein: Math.round(parseInt(lines.match(/bílkovin[ya]?:?\s*(\d+)/)?.[1] || '0')),
            carbs: Math.round(parseInt(lines.match(/sacharid[yů]?:?\s*(\d+)/)?.[1] || '0')),
            fat: Math.round(parseInt(lines.match(/tuk[yů]?:?\s*(\d+)/)?.[1] || '0'))
        };

        console.log('Parsed from text:', result);

        if (result.calories < 5) {
            console.warn('Calories too low, likely not food:', result);
            return null;
        }

        return result;
    } catch (error) {
        console.error('Parsing error:', error);
        console.error('Original response:', aiResponse);
        return null;
    }
}

// =====================================
// TEXT INPUT ANALYSIS
// =====================================

/**
 * Analyze text input
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
    showLoading(true);

    const prompt = `Analyzuj následující jídlo a vrať přesné nutriční hodnoty ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

Jídlo: ${text}

DŮLEŽITÉ - Odhad velikosti:
- Pokud je uvedeno množství (gramy, ml, kusy), použij ho přesně
- Pokud není uvedeno množství, předpokládej standardní porci:
  * Maso/ryba: ~150g
  * Příloha (rýže, brambory, těstoviny): ~200g vařené
  * Zelenina: ~150g
  * Pečivo: 1 kus = ~50-70g
  * Jogurt: ~150g
  * Ovoce: střední kus ~100-150g

Vrať POUZE validní JSON, bez dalšího textu.`;

    try {
        const response = await callGeminiAPI(prompt);
        showLoading(false);
        AppState.isProcessing = false;

        if (!response) {
            console.error('No response from API');
            alert('Nepodařilo se získat odpověď z API.');
            return;
        }

        console.log('API Response:', response);
        const nutritionData = parseNutritionData(response);

        if (!nutritionData) {
            console.error('Failed to parse nutrition data');
            alert('❌ Nerozpoznané jídlo\n\nZkuste popsat jídlo konkrétněji.');
            return;
        }

        console.log('Adding meal:', nutritionData);
        addMeal(nutritionData);
        textInput.value = '';

    } catch (error) {
        console.error('Error in analyzeText:', error);
        alert('Došlo k chybě při analýze: ' + error.message);
        showLoading(false);
        AppState.isProcessing = false;
    }
}

// =====================================
// PHOTO INPUT ANALYSIS
// =====================================

/**
 * Analyze photo input
 */
async function analyzePhoto() {
    if (AppState.isProcessing) return;

    const photoInput = document.getElementById('photoInput');
    const file = photoInput.files[0];

    if (!file) {
        alert('Vyberte prosím fotografii');
        return;
    }

    AppState.isProcessing = true;
    showInlineLoading('photoLoading', true);

    try {
        const base64 = await fileToBase64(file);
        const base64Data = base64.split(',')[1];

        const preview = document.getElementById('photoPreview');
        preview.innerHTML = `<img src="${base64}" alt="Preview">`;

        const prompt = `Analyzuj jídlo na této fotografii a vrať nutriční hodnoty ve formátu JSON.

DŮLEŽITÉ - Odhad velikosti porce:
1. Porovnej jídlo s viditelným nádobím (talíř ~25cm, miska ~15cm)
2. Využij viditelné příbory (lžíce ~15cm, vidlička ~18cm)
3. Použij standardní velikosti porcí (např. kuřecí prsa ~150g)
4. Odhadni objem jídla podle toho, kolik místa zabírá na talíři

Vrať ve formátu JSON:
{
  "name": "název jídla/jídel na fotce",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

Vrať POUZE validní JSON, bez dalšího textu. Pokud je na fotce více jídel, sečti je.`;

        const response = await callGeminiAPI(prompt, base64Data);
        showInlineLoading('photoLoading', false);
        AppState.isProcessing = false;

        if (response) {
            const nutritionData = parseNutritionData(response);
            if (nutritionData) {
                addMeal(nutritionData);
                photoInput.value = '';
                preview.innerHTML = '';
            } else {
                alert('❌ Nerozpoznané jídlo na fotografii\n\nZkuste vyfotit jídlo zblízka a ostře.');
            }
        }
    } catch (error) {
        console.error('Error in analyzePhoto:', error);
        alert('Chyba při analýze fotografie: ' + error.message);
        showInlineLoading('photoLoading', false);
        AppState.isProcessing = false;
    }
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
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

    if (AppState.mediaRecorder && AppState.mediaRecorder.state === 'recording') {
        AppState.mediaRecorder.stop();
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        AppState.audioChunks = [];
        AppState.mediaRecorder = new MediaRecorder(stream);

        AppState.mediaRecorder.ondataavailable = (event) => {
            AppState.audioChunks.push(event.data);
        };

        AppState.mediaRecorder.onstop = async () => {
            AppState.audioBlob = new Blob(AppState.audioChunks, { type: 'audio/webm' });

            stream.getTracks().forEach(track => track.stop());

            const sizeKB = (AppState.audioBlob.size / 1024).toFixed(2);
            console.log(`Nahrávka dokončena (${sizeKB} KB). Automaticky zpracovávám...`);

            voiceBtn.textContent = '🎤 Nahrát znovu';
            voiceBtn.style.background = '';

            analyzeVoice();
        };

        AppState.mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            alert('Chyba při nahrávání: ' + event.error);
            voiceBtn.textContent = '🎤 Začít nahrávat';
            voiceBtn.style.background = '';
        };

        AppState.mediaRecorder.start();
        voiceBtn.textContent = '⏹️ Zastavit nahrávání';
        voiceBtn.style.background = '#f44336';

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
 * Analyze voice input
 */
async function analyzeVoice() {
    if (AppState.isProcessing) return;

    if (!AppState.audioBlob) {
        alert('Nejprve nahrajte hlasový vstup');
        return;
    }

    AppState.isProcessing = true;
    showInlineLoading('voiceLoading', true);

    try {
        const audioBase64 = await blobToBase64(AppState.audioBlob);
        const audioBase64Data = audioBase64.split(',')[1];

        const prompt = `Poslouchej tento audio záznam a:
1. Přepiš co říkám
2. Analyzuj popsané jídlo
3. Vrať nutriční hodnoty ve formátu JSON:

{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

DŮLEŽITÉ - Odhad velikosti z mluveného slova:
- Pozorně poslouchej zmínky o množství (gramy, kusy, porce)
- Pokud je řečeno množství, použij ho přesně
- Pokud není uvedeno, předpokládaj standardní porci

Vrať POUZE validní JSON, bez dalšího textu.`;

        const response = await callGeminiAPIWithAudio(prompt, audioBase64Data);
        showInlineLoading('voiceLoading', false);
        AppState.isProcessing = false;

        if (response) {
            const nutritionData = parseNutritionData(response);
            if (nutritionData) {
                addMeal(nutritionData);
                AppState.audioBlob = null;
                document.getElementById('voiceBtn').textContent = '🎤 Začít nahrávat';
            } else {
                alert('❌ Nerozpoznané jídlo v hlasovém záznamu\n\nZkuste mluvit jasněji.');
                AppState.audioBlob = null;
                document.getElementById('voiceBtn').textContent = '🎤 Začít nahrávat';
            }
        }
    } catch (error) {
        showInlineLoading('voiceLoading', false);
        AppState.isProcessing = false;
        console.error('Error analyzing voice:', error);
        alert('Chyba při zpracování audio: ' + error.message);
    }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// =====================================
// UI FUNCTIONS
// =====================================

/**
 * Toggle settings modal
 */
function toggleSettings() {
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal.classList.contains('active')) {
        settingsModal.classList.remove('active');
    } else {
        settingsModal.classList.add('active');
    }
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

    document.getElementById('totalCalories').textContent = totals.calories;

    if (AppState.dailyGoals) {
        const caloriesPercent = Math.round((totals.calories / AppState.dailyGoals.calories) * 100);

        const caloriesPercentageEl = document.getElementById('caloriesPercentage');
        caloriesPercentageEl.textContent = caloriesPercent + '%';
        document.getElementById('caloriesGoalValue').textContent = AppState.dailyGoals.calories;

        const progressFill = document.getElementById('caloriesProgressFill');
        progressFill.style.width = Math.min(caloriesPercent, 100) + '%';

        // Color coding
        if (caloriesPercent >= 120) {
            progressFill.style.background = 'rgba(211, 47, 47, 0.95)';
            caloriesPercentageEl.style.color = '#D32F2F';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent >= 110) {
            progressFill.style.background = 'rgba(229, 57, 53, 0.9)';
            caloriesPercentageEl.style.color = '#E53935';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent >= 101) {
            progressFill.style.background = 'rgba(239, 83, 80, 0.85)';
            caloriesPercentageEl.style.color = '#EF5350';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent === 100) {
            progressFill.style.background = 'rgba(76, 175, 80, 0.9)';
            caloriesPercentageEl.style.color = '#4CAF50';
            caloriesPercentageEl.style.fontWeight = '600';
        } else if (caloriesPercent >= 90) {
            progressFill.style.background = 'rgba(255, 167, 38, 0.9)';
            caloriesPercentageEl.style.color = '#FF6F00';
            caloriesPercentageEl.style.fontWeight = '600';
        } else if (caloriesPercent >= 80) {
            progressFill.style.background = 'rgba(255, 183, 77, 0.85)';
            caloriesPercentageEl.style.color = '#FF8F00';
            caloriesPercentageEl.style.fontWeight = '600';
        } else {
            progressFill.style.background = 'rgba(255, 255, 255, 0.9)';
            caloriesPercentageEl.style.color = 'var(--text-primary)';
            caloriesPercentageEl.style.fontWeight = '600';
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

/**
 * Update macro box display
 */
function updateMacroBox(type, current, goal) {
    const percent = Math.round((current / goal) * 100);

    const totalElement = document.getElementById(`total${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const percentElement = document.getElementById(`${type}Percent`);
    const goalElement = document.getElementById(`${type}Goal`);

    if (totalElement) totalElement.textContent = current;
    if (percentElement) percentElement.textContent = percent + '%';
    if (goalElement) goalElement.textContent = `z ${goal}g`;

    const macroBox = document.querySelector(`.macro-box[data-macro="${type}"]`);
    if (macroBox) {
        const fillHeight = Math.min(percent, 100);
        macroBox.style.setProperty('--fill-height', fillHeight + '%');

        if (percentElement) {
            if (percent >= 120) {
                percentElement.style.color = '#D32F2F';
                percentElement.style.fontWeight = '700';
            } else if (percent >= 110) {
                percentElement.style.color = '#E53935';
                percentElement.style.fontWeight = '700';
            } else if (percent >= 101) {
                percentElement.style.color = '#EF5350';
                percentElement.style.fontWeight = '700';
            } else if (percent === 100) {
                percentElement.style.color = '#4CAF50';
                percentElement.style.fontWeight = '600';
            } else if (percent >= 90) {
                percentElement.style.color = '#FF6F00';
                percentElement.style.fontWeight = '600';
            } else if (percent >= 80) {
                percentElement.style.color = '#FF8F00';
                percentElement.style.fontWeight = '600';
            } else {
                percentElement.style.color = 'var(--text-primary)';
                percentElement.style.fontWeight = '500';
            }
        }
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
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
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
// INITIALIZATION
// =====================================

console.log('✅ app.js loaded successfully');
