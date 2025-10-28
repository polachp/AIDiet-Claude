// Globální proměnné
let meals = [];
let apiKey = '';
let recognition = null;
let userData = null;
let dailyGoals = null;
let isProcessing = false; // Prevent multiple submissions

// Inicializace při načtení stránky
document.addEventListener('DOMContentLoaded', () => {
    loadApiKey();
    loadUserData();
    loadMeals();
    updateCurrentDate();
    updateSummary();
    displayMeals();
    setupVoiceRecognition();
    setupAutoSubmitListeners();

    // Pokud není API klíč nebo osobní údaje, zobrazit nastavení
    const hasApiKey = localStorage.getItem('geminiApiKey');
    const hasUserData = localStorage.getItem('userData');

    if (!hasApiKey || !hasUserData) {
        // Zobrazit nastavení automaticky
        setTimeout(() => {
            const settingsModal = document.getElementById('settingsModal');
            settingsModal.classList.add('active');

            // Zobrazit info bublinu
            if (!hasApiKey && !hasUserData) {
                alert('👋 Vítejte v AI Diet!\n\nPro začátek prosím nastavte:\n1. Gemini API klíč (zdarma)\n2. Osobní údaje (pro výpočet denního příjmu)');
            } else if (!hasApiKey) {
                alert('⚠️ Nastavte prosím Gemini API klíč pro použití AI analýzy.');
            } else if (!hasUserData) {
                alert('💡 Tip: Nastavte osobní údaje pro výpočet doporučeného denního příjmu.');
            }
        }, 500);
    }
});

// === API KEY MANAGEMENT ===
function saveApiKey() {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) {
        alert('Zadejte prosím API klíč');
        return;
    }

    localStorage.setItem('geminiApiKey', key);
    apiKey = key;
    alert('API klíč byl uložen! Od teď se bude automaticky načítat.');

    // Zobrazit zelenou indikaci
    loadApiKey();
}

function loadApiKey() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        apiKey = savedKey;
        console.log('API klíč načten');

        // Zobrazit indikaci, že je klíč uložen - jen upravit API sekci
        const apiKeySection = document.getElementById('apiKeySection');
        if (apiKeySection) {
            apiKeySection.innerHTML = `
                <div style="padding: 12px 16px; background: #E8F5E9; border: 1px solid #C8E6C9; border-radius: 6px; color: #2C3E50;">
                    ✅ API klíč je uložen
                    <button onclick="changeApiKey()" style="margin-left: 10px; padding: 6px 12px; background: #fff; color: #2C3E50; border: 1px solid #E0E4E8; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
                        Změnit klíč
                    </button>
                    <button onclick="deleteApiKey()" style="margin-left: 5px; padding: 6px 12px; background: #7F8C8D; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s;">
                        Smazat klíč
                    </button>
                </div>
            `;
        }
    }
}

function deleteApiKey() {
    if (confirm('Opravdu chcete smazat uložený API klíč?')) {
        localStorage.removeItem('geminiApiKey');
        apiKey = '';
        alert('API klíč byl smazán');
        changeApiKey();
    }
}

function changeApiKey() {
    const apiKeySection = document.getElementById('apiKeySection');
    if (apiKeySection) {
        apiKeySection.innerHTML = `
            <div class="form-group">
                <label for="apiKey">Gemini API klíč:</label>
                <input type="password" id="apiKey" placeholder="Zadejte váš Gemini API klíč">
                <button onclick="saveApiKey()">💾 Uložit klíč</button>
                <small>Získejte zdarma na <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a></small>
            </div>
        `;
    }
}

// Funkce pro zobrazení/skrytí nastavení
function toggleSettings() {
    const settingsModal = document.getElementById('settingsModal');

    if (settingsModal.classList.contains('active')) {
        settingsModal.classList.remove('active');
    } else {
        settingsModal.classList.add('active');
    }
}

// === USER DATA MANAGEMENT ===
function saveUserData() {
    const age = parseInt(document.getElementById('userAge').value);
    const gender = document.getElementById('userGender').value;
    const weight = parseFloat(document.getElementById('userWeight').value);
    const height = parseInt(document.getElementById('userHeight').value);
    const activity = parseFloat(document.getElementById('userActivity').value);

    if (!age || !weight || !height) {
        alert('Vyplňte prosím všechny údaje');
        return;
    }

    userData = { age, gender, weight, height, activity };
    localStorage.setItem('userData', JSON.stringify(userData));

    // Spočítat denní cíle
    calculateDailyGoals();

    alert('Osobní údaje byly uloženy!\n\nVaše doporučené denní hodnoty:\n' +
          `Kalorie: ${dailyGoals.calories} kcal\n` +
          `Bílkoviny: ${dailyGoals.protein}g\n` +
          `Sacharidy: ${dailyGoals.carbs}g\n` +
          `Tuky: ${dailyGoals.fat}g`);

    // Obnovit zobrazení
    updateSummary();
}

function loadUserData() {
    const saved = localStorage.getItem('userData');
    if (saved) {
        userData = JSON.parse(saved);

        // Načíst do formuláře
        document.getElementById('userAge').value = userData.age;
        document.getElementById('userGender').value = userData.gender;
        document.getElementById('userWeight').value = userData.weight;
        document.getElementById('userHeight').value = userData.height;
        document.getElementById('userActivity').value = userData.activity;

        // Spočítat denní cíle
        calculateDailyGoals();
    }
}

// Výpočet BMR pomocí Mifflin-St Jeor rovnice
function calculateBMR() {
    if (!userData) return 2000; // Výchozí hodnota

    const { age, gender, weight, height } = userData;

    // Mifflin-St Jeor rovnice
    let bmr;
    if (gender === 'male') {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    return Math.round(bmr);
}

// Výpočet TDEE (Total Daily Energy Expenditure)
function calculateTDEE() {
    if (!userData) return 2000;

    const bmr = calculateBMR();
    const tdee = bmr * userData.activity;

    return Math.round(tdee);
}

// Výpočet doporučených makroživin
function calculateDailyGoals() {
    const calories = Math.round(calculateTDEE());

    // Doporučené rozdělení makroživin:
    // Protein: 25-30% (použijeme 30%)
    // Carbs: 40-50% (použijeme 40%)
    // Fat: 25-30% (použijeme 30%)

    const proteinCalories = calories * 0.30;
    const carbsCalories = calories * 0.40;
    const fatCalories = calories * 0.30;

    // Převod na gramy (protein: 4 kcal/g, carbs: 4 kcal/g, fat: 9 kcal/g)
    dailyGoals = {
        calories: Math.round(calories),
        protein: Math.round(proteinCalories / 4),
        carbs: Math.round(carbsCalories / 4),
        fat: Math.round(fatCalories / 9)
    };

    console.log('Daily goals calculated:', dailyGoals);
}

// === LOCAL STORAGE ===
function loadMeals() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const savedMeals = localStorage.getItem(`meals_${dateKey}`);

    if (savedMeals) {
        try {
            meals = JSON.parse(savedMeals);
            console.log('Načteno jídel:', meals.length);
        } catch (e) {
            console.error('Chyba při načítání jídel:', e);
            meals = [];
        }
    } else {
        console.log('Žádná uložená jídla pro dnešek');
        meals = [];
    }
}

function saveMeals() {
    const today = new Date();
    const dateKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    localStorage.setItem(`meals_${dateKey}`, JSON.stringify(meals));
    console.log('Uloženo jídel:', meals.length);
}

// === TAB SWITCHING ===
function switchTab(tabName, event) {
    // Deaktivovat všechny taby
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => tab.classList.remove('active'));
    contents.forEach(content => content.classList.remove('active'));

    // Aktivovat vybraný tab
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Pokud event není poskytnut, najít tab tlačítko podle názvu
        const targetBtn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
    }
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// === GEMINI API ===
async function callGeminiAPI(prompt, imageBase64 = null) {
    if (!apiKey) {
        alert('Prosím nastavte Gemini API klíč v sekci Nastavení');
        return null;
    }

    const modelsToTry = [
    // Doporučeno pro většinu úloh a Free Tier (zdarma):
    'gemini-2.5-flash',       // Všestranný, rychlý, cenově efektivní.
    'gemini-2.5-flash-lite',  // Nejrychlejší a nejúspornější model, skvělý pro vysokou propustnost.

];

    let requestBody;

    if (imageBase64) {
        // Request s obrázkem
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
        // Request jen s textem
        requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }]
        };
    }

    // Zkusit různé modely s různými API verzemi
    const apiVersions = ['v1beta', 'v1'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        for (const apiVersion of apiVersions) {
            try {
                console.log(`Trying ${apiVersion} model: ${modelName}`);
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

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
                    continue; // Zkusit další verzi API nebo model
                }

                const data = await response.json();
                const text = data.candidates[0].content.parts[0].text;
                console.log(`✅ Success with ${apiVersion}/models/${modelName}`);
                return text;

            } catch (error) {
                lastError = error.message;
                console.warn(`${apiVersion}/models/${modelName} error:`, error.message);
                // Pokračovat na další kombinaci
            }
        }
    }

    // Pokud jsme vyčerpali všechny možnosti
    console.error('All models failed. Last error:', lastError);
    alert(`Chyba při volání API: ${lastError}\n\nŽádný z modelů nefunguje. Zkuste:\n1. Ověřit API klíč na https://aistudio.google.com/app/apikey\n2. Povolit Gemini API v Google Cloud Console\n3. Vygenerovat nový API klíč`);
    return null;
}

// Funkce pro volání Gemini API s audio vstupem
async function callGeminiAPIWithAudio(prompt, audioBase64) {
    if (!apiKey) {
        alert('Prosím nastavte Gemini API klíč v sekci Nastavení');
        return null;
    }

    const modelsToTry = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
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

    // Zkusit různé modely s různými API verzemi
    const apiVersions = ['v1beta', 'v1'];
    let lastError = null;

    for (const modelName of modelsToTry) {
        for (const apiVersion of apiVersions) {
            try {
                console.log(`Trying ${apiVersion} model: ${modelName} with audio`);
                const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;

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

    // Pokud všechny modely selhaly
    console.error('All audio models failed. Last error:', lastError);
    alert(`Chyba při zpracování audio: ${lastError}\n\nZkuste:\n1. Zkontrolovat API klíč\n2. Audio může být příliš dlouhé\n3. Zkusit znovu nahrát`);
    return null;
}

function parseNutritionData(aiResponse) {
    try {
        console.log('Parsing AI response:', aiResponse);

        // Pokusí se najít JSON v odpovědi
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            console.log('Found JSON in response:', jsonMatch[0]);
            const parsed = JSON.parse(jsonMatch[0]);

            // Validace dat
            if (!parsed.name || typeof parsed.calories !== 'number' ||
                typeof parsed.protein !== 'number' ||
                typeof parsed.carbs !== 'number' ||
                typeof parsed.fat !== 'number') {
                console.error('Invalid data structure:', parsed);
                return null;
            }

            // Zaokrouhlit všechna čísla na celá čísla
            const result = {
                name: parsed.name,
                calories: Math.round(parsed.calories),
                protein: Math.round(parsed.protein),
                carbs: Math.round(parsed.carbs),
                fat: Math.round(parsed.fat)
            };

            // Validace rozumných hodnot - jídlo musí mít alespoň nějaké kalorie
            if (result.calories < 5) {
                console.warn('Calories too low, likely not food:', result);
                return null;
            }

            // Kontrola, že aspoň jedna makroživina je nenulová
            if (result.protein === 0 && result.carbs === 0 && result.fat === 0) {
                console.warn('All macros are zero, likely not food:', result);
                return null;
            }

            return result;
        }

        console.log('No JSON found, trying text parsing');
        // Fallback - pokusí se parsovat textovou odpověď
        const lines = aiResponse.toLowerCase();
        const result = {
            name: "Analyzované jídlo",
            calories: Math.round(parseInt(lines.match(/(\d+)\s*(kcal|kalori)/)?.[1] || '0')),
            protein: Math.round(parseInt(lines.match(/bílkovin[ya]?:?\s*(\d+)/)?.[1] || '0')),
            carbs: Math.round(parseInt(lines.match(/sacharid[yů]?:?\s*(\d+)/)?.[1] || '0')),
            fat: Math.round(parseInt(lines.match(/tuk[yů]?:?\s*(\d+)/)?.[1] || '0'))
        };

        console.log('Parsed from text:', result);

        // Validace rozumných hodnot
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

// === AUTO-SUBMIT LISTENERS ===
function setupAutoSubmitListeners() {
    // TEXT INPUT - Enter key listener
    const textInput = document.getElementById('textInput');
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !isProcessing) {
            e.preventDefault();
            analyzeText();
        }
    });

    // PHOTO INPUT - Auto-analyze on file selection
    const photoInput = document.getElementById('photoInput');
    photoInput.addEventListener('change', () => {
        if (photoInput.files.length > 0 && !isProcessing) {
            analyzePhoto();
        }
    });

    // Add drag and drop support for photos
    const photoTab = document.getElementById('photoTab');

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
        if (files.length > 0 && files[0].type.startsWith('image/') && !isProcessing) {
            photoInput.files = files;
            analyzePhoto();
        }
    });
}

// === TEXT INPUT ===
async function analyzeText() {
    if (isProcessing) return; // Prevent multiple submissions

    const textInput = document.getElementById('textInput');
    const text = textInput.value.trim();

    if (!text) {
        alert('Zadejte prosím popis jídla');
        return;
    }

    isProcessing = true;
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
        isProcessing = false;

        if (!response) {
            console.error('No response from API');
            alert('Nepodařilo se získat odpověď z API. Zkontrolujte API klíč a zkuste to znovu.');
            return;
        }

        console.log('API Response:', response);
        const nutritionData = parseNutritionData(response);

        if (!nutritionData) {
            console.error('Failed to parse nutrition data');
            alert('❌ Nerozpoznané jídlo\n\nText nebyl rozpoznán jako jídlo nebo nemá dostatečné nutriční hodnoty.\n\nZkuste:\n• Popsat jídlo konkrétněji\n• Uvést množství (např. "100g kuřecího masa")\n• Zadat jiné jídlo');
            return;
        }

        console.log('Adding meal:', nutritionData);
        addMeal(nutritionData);
        textInput.value = '';
        
    } catch (error) {
        console.error('Error in analyzeText:', error);
        alert('Došlo k chybě při analýze: ' + error.message);
        showLoading(false);
        isProcessing = false;
    }
}

// === PHOTO INPUT ===
async function analyzePhoto() {
    if (isProcessing) return; // Prevent multiple submissions

    const photoInput = document.getElementById('photoInput');
    const file = photoInput.files[0];

    if (!file) {
        alert('Vyberte prosím fotografii');
        return;
    }

    isProcessing = true;
    showInlineLoading('photoLoading', true);

    // Převod obrázku na base64
    const base64 = await fileToBase64(file);
    const base64Data = base64.split(',')[1]; // Odstranit data:image/jpeg;base64,

    // Zobrazit náhled
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = `<img src="${base64}" alt="Preview">`;

    const prompt = `Analyzuj jídlo na této fotografii a vrať nutriční hodnoty ve formátu JSON.

DŮLEŽITÉ - Odhad velikosti porce:
1. Porovnej jídlo s viditelným nádobím (talíř ~25cm, miska ~15cm, hrnek ~8cm průměr)
2. Využij viditelné příbory (lžíce ~15cm, vidlička ~18cm, nůž ~20cm)
3. Porovnej s běžnými předměty v okolí (telefon, ruka, stůl)
4. Použij standardní velikosti porcí (např. kuřecí prsa ~150g, hamburger ~120g, porce rýže ~200g vařené)
5. Odhadni objem jídla podle toho, kolik místa zabírá na talíři/v misce
6. Zohledni vrstvení a hloubku jídla, ne jen plochu

Pokud je velikost nejasná, preferuj konzervativní odhad běžné porce.

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
    isProcessing = false;

    if (response) {
        const nutritionData = parseNutritionData(response);
        if (nutritionData) {
            addMeal(nutritionData);
            photoInput.value = '';
            preview.innerHTML = '';
        } else {
            alert('❌ Nerozpoznané jídlo na fotografii\n\nNa fotce nebylo rozpoznáno jídlo s dostatečnými nutričními hodnotami.\n\nZkuste:\n• Vyfotit jídlo zblízka a ostře\n• Zajistit dobré osvětlení\n• Vyfotit jednodušší jídlo\n• Použít textový vstup místo fotky');
        }
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// === VOICE INPUT ===
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;

function setupVoiceRecognition() {
    // Zkontrolovat podporu MediaRecorder
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('MediaRecorder not supported');
        document.getElementById('voiceBtn').disabled = true;
        document.getElementById('voiceBtn').textContent = '❌ Nepodporováno';
    }
}

async function startVoiceRecognition() {
    const voiceBtn = document.getElementById('voiceBtn');

    // Pokud už nahrává, zastavit
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        return;
    }

    try {
        // Požádat o přístup k mikrofonu
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Vytvořit MediaRecorder
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Vytvořit blob z nahraných dat
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            // Zastavit stream
            stream.getTracks().forEach(track => track.stop());

            // Zobrazit info o nahrávce
            const sizeKB = (audioBlob.size / 1024).toFixed(2);
            console.log(`Nahrávka dokončena (${sizeKB} KB). Automaticky zpracovávám...`);

            voiceBtn.textContent = '🎤 Nahrát znovu';
            voiceBtn.style.background = '';

            // Auto-analyze the voice recording
            analyzeVoice();
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            alert('Chyba při nahrávání: ' + event.error);
            voiceBtn.textContent = '🎤 Začít nahrávat';
            voiceBtn.style.background = '';
        };

        // Začít nahrávat
        mediaRecorder.start();
        voiceBtn.textContent = '⏹️ Zastavit nahrávání';
        voiceBtn.style.background = '#f44336';

    } catch (error) {
        console.error('Error accessing microphone:', error);
        let errorMsg = 'Nelze získat přístup k mikrofonu.\n\n';

        if (error.name === 'NotAllowedError') {
            errorMsg += 'Přístup k mikrofonu byl zamítnut. Povolte přístup v nastavení prohlížeče.';
        } else if (error.name === 'NotFoundError') {
            errorMsg += 'Mikrofon nebyl nalezen. Zkontrolujte připojení mikrofonu.';
        } else {
            errorMsg += 'Chyba: ' + error.message;
        }

        alert(errorMsg);
    }
}

async function analyzeVoice() {
    if (isProcessing) return; // Prevent multiple submissions

    if (!audioBlob) {
        alert('Nejprve nahrajte hlasový vstup');
        return;
    }

    isProcessing = true;
    showInlineLoading('voiceLoading', true);

    try {
        // Převést audio na base64
        const audioBase64 = await blobToBase64(audioBlob);
        const audioBase64Data = audioBase64.split(',')[1]; // Odstranit data:audio/webm;base64,

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
- Pozorně poslouchej zmínky o množství (gramy, kusy, porce, talíř, miska)
- Pokud je řečeno množství, použij ho přesně
- Pokud není uvedeno množství, předpokládaj standardní porci:
  * Maso/ryba: ~150g
  * Příloha (rýže, brambory, těstoviny): ~200g vařené
  * Zelenina: ~150g
  * "Velká porce" = +50%, "Malá porce" = -30%
  * "Celý talíř" = běžná porce, "Půl talíře" = poloviční porce

Vrať POUZE validní JSON, bez dalšího textu.`;

        // Zavolat Gemini API s audio
        const response = await callGeminiAPIWithAudio(prompt, audioBase64Data);
        showInlineLoading('voiceLoading', false);
        isProcessing = false;

        if (response) {
            const nutritionData = parseNutritionData(response);
            if (nutritionData) {
                addMeal(nutritionData);
                audioBlob = null;
                document.getElementById('voiceBtn').textContent = '🎤 Začít nahrávat';
            } else {
                alert('❌ Nerozpoznané jídlo v hlasovém záznamu\n\nHlasový záznam nebyl rozpoznán jako popis jídla s dostatečnými nutričními hodnotami.\n\nZkuste:\n• Mluvit jasněji a pomaleji\n• Popsat jídlo konkrétněji s množstvím\n• Nahrát v tišším prostředí\n• Použít textový vstup místo hlasu');
                audioBlob = null;
                document.getElementById('voiceBtn').textContent = '🎤 Začít nahrávat';
            }
        }
    } catch (error) {
        showInlineLoading('voiceLoading', false);
        isProcessing = false;
        console.error('Error analyzing voice:', error);
        alert('Chyba při zpracování audio: ' + error.message);
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// === MEALS MANAGEMENT ===
function addMeal(nutritionData) {
    const meal = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...nutritionData
    };

    meals.push(meal);
    saveMeals();
    updateSummary();
    displayMeals();
}

function deleteMeal(id) {
    if (confirm('Opravdu chcete smazat toto jídlo?')) {
        meals = meals.filter(meal => meal.id !== id);
        saveMeals();
        updateSummary();
        displayMeals();
    }
}

function displayMeals() {
    const mealsList = document.getElementById('mealsList');

    if (meals.length === 0) {
        mealsList.innerHTML = '<p class="empty-state">Zatím žádná jídla. Přidejte své první jídlo!</p>';
        return;
    }

    mealsList.innerHTML = meals.map(meal => {
        // Vypočítat procento z denního příjmu
        const caloriePercent = dailyGoals ?
            Math.round((meal.calories / dailyGoals.calories) * 100) : 0;

        // Velké první písmeno názvu
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

function updateSummary() {
    const totals = meals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0)
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    // Zaokrouhlit všechny totals na celá čísla
    totals.calories = Math.round(totals.calories);
    totals.protein = Math.round(totals.protein);
    totals.carbs = Math.round(totals.carbs);
    totals.fat = Math.round(totals.fat);

    // Aktualizovat celkové kalorie
    document.getElementById('totalCalories').textContent = totals.calories;

    // Pokud máme denní cíle, zobrazit je
    if (dailyGoals) {
        const caloriesPercent = Math.round((totals.calories / dailyGoals.calories) * 100);

        // Aktualizovat hlavní kartu s procentem
        const caloriesPercentageEl = document.getElementById('caloriesPercentage');
        caloriesPercentageEl.textContent = caloriesPercent + '%';
        document.getElementById('caloriesGoalValue').textContent = dailyGoals.calories;

        // Aktualizovat progress bar - zobrazit skutečná procenta i nad 100%
        const progressFill = document.getElementById('caloriesProgressFill');
        progressFill.style.width = Math.min(caloriesPercent, 100) + '%'; // Progress bar max 100% šířky

        // Plynulé barevné varování podle úrovně (bez rámečků)
        if (caloriesPercent >= 120) {
            // 120%+ - tmavě červená (vážné překročení)
            progressFill.style.background = 'rgba(211, 47, 47, 0.95)';
            caloriesPercentageEl.style.color = '#D32F2F';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent >= 110) {
            // 110-119% - středně červená
            progressFill.style.background = 'rgba(229, 57, 53, 0.9)';
            caloriesPercentageEl.style.color = '#E53935';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent >= 101) {
            // 101-109% - světle červená (varování začíná)
            progressFill.style.background = 'rgba(239, 83, 80, 0.85)';
            caloriesPercentageEl.style.color = '#EF5350';
            caloriesPercentageEl.style.fontWeight = '700';
        } else if (caloriesPercent === 100) {
            // PŘESNĚ 100% - zelená (ideální)
            progressFill.style.background = 'rgba(76, 175, 80, 0.9)';
            caloriesPercentageEl.style.color = '#4CAF50';
            caloriesPercentageEl.style.fontWeight = '600';
        } else if (caloriesPercent >= 90) {
            // 90-99% - oranžová
            progressFill.style.background = 'rgba(255, 167, 38, 0.9)';
            caloriesPercentageEl.style.color = '#FF6F00';
            caloriesPercentageEl.style.fontWeight = '600';
        } else if (caloriesPercent >= 80) {
            // 80-89% - světle oranžová
            progressFill.style.background = 'rgba(255, 183, 77, 0.85)';
            caloriesPercentageEl.style.color = '#FF8F00';
            caloriesPercentageEl.style.fontWeight = '600';
        } else {
            // 0-79% - normální (šedá/bílá)
            progressFill.style.background = 'rgba(255, 255, 255, 0.9)';
            caloriesPercentageEl.style.color = 'var(--text-primary)';
            caloriesPercentageEl.style.fontWeight = '600';
        }

        // Aktualizovat makroživiny
        updateMacroBox('protein', totals.protein, dailyGoals.protein);
        updateMacroBox('carbs', totals.carbs, dailyGoals.carbs);
        updateMacroBox('fat', totals.fat, dailyGoals.fat);
    } else {
        // Bez cílů, zobrazit základní info
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

function updateMacroBox(type, current, goal) {
    // Zobrazit skutečná procenta i nad 100%
    const percent = Math.round((current / goal) * 100);

    // Aktualizovat texty v macro boxu
    const totalElement = document.getElementById(`total${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const percentElement = document.getElementById(`${type}Percent`);
    const goalElement = document.getElementById(`${type}Goal`);

    if (totalElement) totalElement.textContent = current;
    if (percentElement) percentElement.textContent = percent + '%';
    if (goalElement) goalElement.textContent = `z ${goal}g`;

    // Nastavit výšku rising fill pozadí - max 100% pro vizuální výplň
    const macroBox = document.querySelector(`.macro-box[data-macro="${type}"]`);
    if (macroBox) {
        const fillHeight = Math.min(percent, 100);
        macroBox.style.setProperty('--fill-height', fillHeight + '%');

        // Plynulé barevné varování podle úrovně (bez rámečků)
        if (percentElement) {
            if (percent >= 120) {
                // 120%+ - tmavě červená (vážné překročení)
                percentElement.style.color = '#D32F2F';
                percentElement.style.fontWeight = '700';
            } else if (percent >= 110) {
                // 110-119% - středně červená
                percentElement.style.color = '#E53935';
                percentElement.style.fontWeight = '700';
            } else if (percent >= 101) {
                // 101-109% - světle červená (varování začíná)
                percentElement.style.color = '#EF5350';
                percentElement.style.fontWeight = '700';
            } else if (percent === 100) {
                // PŘESNĚ 100% - zelená (ideální)
                percentElement.style.color = '#4CAF50';
                percentElement.style.fontWeight = '600';
            } else if (percent >= 90) {
                // 90-99% - oranžová
                percentElement.style.color = '#FF6F00';
                percentElement.style.fontWeight = '600';
            } else if (percent >= 80) {
                // 80-89% - světle oranžová
                percentElement.style.color = '#FF8F00';
                percentElement.style.fontWeight = '600';
            } else {
                // 0-79% - normální (šedá/bílá)
                percentElement.style.color = 'var(--text-primary)';
                percentElement.style.fontWeight = '500';
            }
        }
    }
}

// === UTILITY FUNCTIONS ===
function updateCurrentDate() {
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateStr = new Date().toLocaleDateString('cs-CZ', options);
        currentDateEl.textContent = dateStr;
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showInlineLoading(elementId, show) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = show ? 'flex' : 'none';
    }
}
