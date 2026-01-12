// =====================================
// NUTRITION DATA PARSER
// =====================================
// Parsování výživových dat z AI odpovědí
// Nezávislý na konkrétním AI provideru

/**
 * Parser pro výživové údaje z AI odpovědí
 * Podporuje JSON i textový formát
 */
class NutritionParser {
    // Required fields for nutrition data
    static REQUIRED_FIELDS = ['name', 'calories', 'protein', 'carbs', 'fat'];

    // Validation limits
    static LIMITS = {
        minCalories: 5,
        maxCalories: 10000,
        maxProtein: 500,
        maxCarbs: 1000,
        maxFat: 500
    };
    /**
     * Parsuje AI odpověď a extrahuje výživové údaje
     * @param {string} aiResponse - Textová odpověď z AI
     * @returns {Object|null} Výživové údaje nebo null při chybě
     */
    static parse(aiResponse) {
        if (!aiResponse || typeof aiResponse !== 'string') {
            console.error('❌ NutritionParser: Neplatná odpověď');
            return null;
        }

        try {
            console.log('🔍 NutritionParser: Parsing AI response');

            // Pokus 1: Parsování JSON formátu
            const jsonResult = this._parseJSON(aiResponse);
            if (jsonResult) {
                console.log('✅ NutritionParser: Parsed from JSON');
                return jsonResult;
            }

            // Pokus 2: Parsování textového formátu
            const textResult = this._parseText(aiResponse);
            if (textResult) {
                console.log('✅ NutritionParser: Parsed from text');
                return textResult;
            }

            console.error('❌ NutritionParser: Nepodařilo se parsovat odpověď');
            return null;

        } catch (error) {
            console.error('❌ NutritionParser: Parsing error:', error);
            console.error('Original response:', aiResponse);
            return null;
        }
    }

    /**
     * Parsuje JSON formát z AI odpovědi
     * @private
     */
    static _parseJSON(aiResponse) {
        try {
            // Hledání JSON objektu v textu
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);

            // Validace struktury
            if (!this._validateStructure(parsed)) {
                console.warn('⚠️ NutritionParser: Invalid JSON structure:', parsed);
                return null;
            }

            // Normalizace dat
            const result = this._normalizeData(parsed);

            // Validace hodnot
            if (!this._validateValues(result)) {
                return null;
            }

            return result;

        } catch (error) {
            // JSON parsing selhal, zkusí se textový formát
            return null;
        }
    }

    /**
     * Parsuje textový formát z AI odpovědi
     * @private
     */
    static _parseText(aiResponse) {
        try {
            const lines = aiResponse.toLowerCase();

            const result = {
                name: this._extractName(aiResponse) || "Analyzované jídlo",
                calories: Math.round(this._extractNumber(lines, /(\d+)\s*(kcal|kalori)/)),
                protein: Math.round(this._extractNumber(lines, /bílkovin[ya]?:?\s*(\d+)/)),
                carbs: Math.round(this._extractNumber(lines, /sacharid[yů]?:?\s*(\d+)/)),
                fat: Math.round(this._extractNumber(lines, /tuk[yů]?:?\s*(\d+)/))
            };

            console.log('🔍 NutritionParser: Parsed from text:', result);

            // Validace hodnot
            if (!this._validateValues(result)) {
                return null;
            }

            return result;

        } catch (error) {
            console.error('❌ NutritionParser: Text parsing error:', error);
            return null;
        }
    }

    /**
     * Extrahuje název jídla z textu
     * @private
     */
    static _extractName(text) {
        // Hledá pattern "name": "..." nebo název: ...
        const nameMatch = text.match(/(?:name|název)["\s:]+([^"}\n,]+)/i);
        return nameMatch ? nameMatch[1].trim() : null;
    }

    /**
     * Extrahuje číslo z textu podle regex patternu
     * @private
     */
    static _extractNumber(text, pattern) {
        const match = text.match(pattern);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Validuje strukturu parsovaných dat
     * @private
     */
    static _validateStructure(data) {
        if (!data || typeof data !== 'object') return false;

        // Check all required fields exist
        const hasAllFields = this.REQUIRED_FIELDS.every(field => field in data);
        if (!hasAllFields) return false;

        // Check numeric fields are numbers
        const numericFields = ['calories', 'protein', 'carbs', 'fat'];
        return numericFields.every(field => typeof data[field] === 'number');
    }

    /**
     * Normalizuje data (zaokrouhlení, type conversion)
     * @private
     */
    static _normalizeData(data) {
        return {
            name: String(data.name || "Analyzované jídlo").trim(),
            calories: Math.round(Number(data.calories) || 0),
            protein: Math.round(Number(data.protein) || 0),
            carbs: Math.round(Number(data.carbs) || 0),
            fat: Math.round(Number(data.fat) || 0)
        };
    }

    /**
     * Validuje hodnoty (rozumné rozsahy)
     * @private
     */
    static _validateValues(data) {
        const limits = this.LIMITS;

        // Minimální kalorie (ignoruje velmi nízké hodnoty)
        if (data.calories < limits.minCalories) {
            console.warn('⚠️ NutritionParser: Calories too low, likely not food:', data);
            return false;
        }

        // Všechna makra nesmí být nula
        if (data.protein === 0 && data.carbs === 0 && data.fat === 0) {
            console.warn('⚠️ NutritionParser: All macros are zero, likely not food:', data);
            return false;
        }

        // Maximální rozumné hodnoty (ochrana před chybami AI)
        const exceedsLimits =
            data.calories > limits.maxCalories ||
            data.protein > limits.maxProtein ||
            data.carbs > limits.maxCarbs ||
            data.fat > limits.maxFat;

        if (exceedsLimits) {
            console.warn('⚠️ NutritionParser: Values too high, likely error:', data);
            return false;
        }

        return true;
    }

    /**
     * Vypočítá multiplikátor porce podle uživatelského profilu
     * @param {Object} userData - Uživatelský profil
     * @returns {number} Multiplikátor (0.8 - 1.5)
     */
    static _getPortionMultiplier(userData) {
        if (!userData) return 1.0;

        let multiplier = 1.0;

        // Podle pohlaví
        if (userData.gender === 'male') multiplier *= 1.15;
        else if (userData.gender === 'female') multiplier *= 0.9;

        // Podle váhy
        const weight = userData.weight || 75;
        if (weight > 95) multiplier *= 1.15;
        else if (weight > 85) multiplier *= 1.1;
        else if (weight > 75) multiplier *= 1.05;
        else if (weight < 55) multiplier *= 0.9;
        else if (weight < 65) multiplier *= 0.95;

        // Omez na rozumný rozsah
        return Math.max(0.7, Math.min(1.6, multiplier));
    }

    /**
     * Vytvoří text s porcemi přizpůsobenými uživateli
     * @param {Object} userData - Uživatelský profil
     * @returns {string} Text s velikostmi porcí
     */
    static _getPortionText(userData) {
        const m = this._getPortionMultiplier(userData);

        const meat = Math.round(180 * m);
        const sideDish = Math.round(220 * m);
        const vegetables = Math.round(150 * m);

        let context = '';
        if (userData) {
            const gender = userData.gender === 'male' ? 'muž' : 'žena';
            const goal = userData.goal === 'gain' ? 'nabírání' : userData.goal === 'lose' ? 'hubnutí' : 'udržení';
            context = `\n(Uživatel: ${gender}, ${userData.weight || '?'}kg, cíl: ${goal})`;
        }

        return `DŮLEŽITÉ - Odhad velikosti porce:${context}
- Pokud je uvedeno množství (gramy, ml, kusy), použij ho přesně
- Pokud není uvedeno množství, předpokládej tyto porce:
  * Maso/ryba: ~${meat}g
  * Příloha (rýže, brambory, těstoviny): ~${sideDish}g vařené
  * Zelenina: ~${vegetables}g
  * Pečivo: 1 kus = ~60g
  * Nápoje: standardní sklenice = 250ml`;
    }

    /**
     * Vytvoří prompt pro AI analýzu jídla
     * @param {string} foodDescription - Popis jídla od uživatele
     * @param {Object} userData - Uživatelský profil (optional)
     * @returns {string} Formátovaný prompt
     */
    static createFoodAnalysisPrompt(foodDescription, userData = null) {
        const portionText = this._getPortionText(userData);

        return `Analyzuj následující jídlo a vrať přesné nutriční hodnoty ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

Jídlo: ${foodDescription}

${portionText}

Vrať POUZE validní JSON objekt, žádný další text.`;
    }

    /**
     * Vytvoří prompt pro AI analýzu obrázku jídla
     * @param {string} additionalContext - Dodatečný kontext od uživatele (optional)
     * @param {Object} userData - Uživatelský profil (optional)
     * @returns {string} Formátovaný prompt
     */
    static createImageAnalysisPrompt(additionalContext = '', userData = null) {
        const m = this._getPortionMultiplier(userData);
        const meat = Math.round(180 * m);
        const sideDish = Math.round(220 * m);

        let userContext = '';
        if (userData) {
            const gender = userData.gender === 'male' ? 'muž' : 'žena';
            const goal = userData.goal === 'gain' ? 'nabírání' : userData.goal === 'lose' ? 'hubnutí' : 'udržení';
            userContext = `\n- Uživatel: ${gender}, ${userData.weight || '?'}kg, cíl: ${goal}`;
            userContext += `\n- Očekávaná porce masa: ~${meat}g, přílohy: ~${sideDish}g`;
        }

        const basePrompt = `Analyzuj jídlo na tomto obrázku a vrať přesné nutriční hodnoty ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

DŮLEŽITÉ:
- Odhadni velikost porce na základě vizuální analýzy
- Pokud je na obrázku více jídel, sečti všechny dohromady
- Snaž se co nejpřesněji odhadnout množství${userContext}`;

        if (additionalContext) {
            return `${basePrompt}\n\nDodatečný kontext: ${additionalContext}\n\nVrať POUZE validní JSON objekt.`;
        }

        return `${basePrompt}\n\nVrať POUZE validní JSON objekt.`;
    }

    /**
     * Vytvoří prompt pro AI analýzu audio vstupu
     * @param {Object} userData - Uživatelský profil (optional)
     * @returns {string} Formátovaný prompt
     */
    static createAudioAnalysisPrompt(userData = null) {
        const portionText = this._getPortionText(userData);

        return `Přepiš toto audio a následně analyzuj zmíněné jídlo. Vrať výsledek ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

${portionText}

Vrať POUZE validní JSON objekt, žádný další text.`;
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionParser;
}
