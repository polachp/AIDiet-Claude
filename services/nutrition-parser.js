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
        return (
            data &&
            typeof data === 'object' &&
            'name' in data &&
            'calories' in data &&
            'protein' in data &&
            'carbs' in data &&
            'fat' in data &&
            typeof data.calories === 'number' &&
            typeof data.protein === 'number' &&
            typeof data.carbs === 'number' &&
            typeof data.fat === 'number'
        );
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
        // Minimální kalorie (ignoruje velmi nízké hodnoty)
        if (data.calories < 5) {
            console.warn('⚠️ NutritionParser: Calories too low, likely not food:', data);
            return false;
        }

        // Všechna makra nesmí být nula
        if (data.protein === 0 && data.carbs === 0 && data.fat === 0) {
            console.warn('⚠️ NutritionParser: All macros are zero, likely not food:', data);
            return false;
        }

        // Maximální rozumné hodnoty (ochrana před chybami AI)
        if (data.calories > 10000 || data.protein > 500 || data.carbs > 1000 || data.fat > 500) {
            console.warn('⚠️ NutritionParser: Values too high, likely error:', data);
            return false;
        }

        return true;
    }

    /**
     * Vytvoří prompt pro AI analýzu jídla
     * @param {string} foodDescription - Popis jídla od uživatele
     * @returns {string} Formátovaný prompt
     */
    static createFoodAnalysisPrompt(foodDescription) {
        return `Analyzuj následující jídlo a vrať přesné nutriční hodnoty ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

Jídlo: ${foodDescription}

DŮLEŽITÉ - Odhad velikosti:
- Pokud je uvedeno množství (gramy, ml, kusy), použij ho přesně
- Pokud není uvedeno množství, předpokládej standardní porci:
  * Maso/ryba: ~150g
  * Příloha (rýže, brambory, těstoviny): ~200g vařené
  * Zelenina: ~150g
  * Pečivo: 1 kus = ~50-70g
  * Nápoje: standardní sklenice = 250ml

Vrať POUZE validní JSON objekt, žádný další text.`;
    }

    /**
     * Vytvoří prompt pro AI analýzu obrázku jídla
     * @param {string} additionalContext - Dodatečný kontext od uživatele (optional)
     * @returns {string} Formátovaný prompt
     */
    static createImageAnalysisPrompt(additionalContext = '') {
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
- Snaž se co nejpřesněji odhadnout množství`;

        if (additionalContext) {
            return `${basePrompt}\n\nDodatečný kontext: ${additionalContext}\n\nVrať POUZE validní JSON objekt.`;
        }

        return `${basePrompt}\n\nVrať POUZE validní JSON objekt.`;
    }

    /**
     * Vytvoří prompt pro AI analýzu audio vstupu
     * @returns {string} Formátovaný prompt
     */
    static createAudioAnalysisPrompt() {
        return `Přepiš toto audio a následně analyzuj zmíněné jídlo. Vrať výsledek ve formátu JSON:
{
  "name": "název jídla",
  "calories": celkové kalorie v kcal (číslo),
  "protein": gramy bílkovin (číslo),
  "carbs": gramy sacharidů (číslo),
  "fat": gramy tuků (číslo)
}

DŮLEŽITÉ - Odhad velikosti:
- Pokud uživatel uvede množství, použij ho přesně
- Pokud ne, předpokládaj standardní porci

Vrať POUZE validní JSON objekt, žádný další text.`;
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NutritionParser;
}
