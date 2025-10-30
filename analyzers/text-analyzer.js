// =====================================
// TEXT ANALYZER
// =====================================
// Analyzuje textový popis jídla
// Deleguje práci na AIService

/**
 * Analyzátor textového vstupu
 * Zpracovává textový popis jídla od uživatele
 */
class TextAnalyzer {
    constructor() {
        console.log('📝 TextAnalyzer: Instance vytvořena');
    }

    /**
     * Analyzuje textový popis jídla
     * @param {string} textInput - Textový popis jídla od uživatele
     * @param {AbortController} abortController - Pro zrušení požadavku (optional)
     * @returns {Promise<Object>} Výživové údaje
     * @throws {Error} Při prázdném vstupu nebo chybě analýzy
     */
    async analyze(textInput, abortController = null) {
        console.log('📝 TextAnalyzer: Zahajuji analýzu textu');

        // Validace vstupu
        if (!textInput || typeof textInput !== 'string') {
            const errorMsg = 'Neplatný vstup - text je povinný';
            console.error(`❌ TextAnalyzer: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        const trimmedInput = textInput.trim();

        if (trimmedInput.length === 0) {
            const errorMsg = 'Zadejte prosím popis jídla';
            console.error(`❌ TextAnalyzer: ${errorMsg}`);
            throw new Error(errorMsg);
        }

        console.log('📝 TextAnalyzer: Input validován:', trimmedInput);

        try {
            // Deleguj analýzu na AIService
            console.log('🔄 TextAnalyzer: Volám AIService.analyzeText()');
            const nutritionData = await aiService.analyzeText(trimmedInput, null, abortController);

            if (!nutritionData) {
                const errorMsg = 'Nepodařilo se analyzovat jídlo. Zkuste popsat jídlo konkrétněji.';
                console.error(`❌ TextAnalyzer: ${errorMsg}`);
                throw new Error(errorMsg);
            }

            console.log('✅ TextAnalyzer: Analýza úspěšná:', nutritionData);
            return nutritionData;

        } catch (error) {
            console.error('❌ TextAnalyzer: Chyba při analýze:', error);

            // Propaguj AbortError
            if (error.name === 'AbortError') {
                throw error;
            }

            // Pokud je to už naše chyba, propaguj ji
            if (error.message.includes('Zadejte prosím') ||
                error.message.includes('Nepodařilo se analyzovat')) {
                throw error;
            }

            // Jinak obal do uživatelsky přívětivé chyby
            throw new Error(`Došlo k chybě při analýze textu: ${error.message}`);
        }
    }

    /**
     * Rychlá validace vstupu bez analýzy
     * @param {string} textInput - Text k validaci
     * @returns {boolean} True pokud je vstup validní
     */
    isValidInput(textInput) {
        return textInput &&
               typeof textInput === 'string' &&
               textInput.trim().length > 0;
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextAnalyzer;
}
