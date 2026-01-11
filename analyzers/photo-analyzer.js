// =====================================
// PHOTO ANALYZER
// =====================================
// Analyzuje obrázky jídel pomocí AI
// Validace, komprese, konverze a analýza

/**
 * PhotoAnalyzer třída pro analýzu obrázků jídel
 * Používá MediaConverter pro práci se soubory a AIService pro AI analýzu
 */
class PhotoAnalyzer {
    /**
     * Analyzuje obrázek jídla a vrací výživové údaje
     * @param {File} imageFile - Obrázek File objekt
     * @param {string} additionalContext - Dodatečný kontext pro AI (optional)
     * @returns {Promise<Object>} Výživové údaje
     * @throws {Error} Při chybě validace nebo analýzy
     */
    async analyze(imageFile, additionalContext = '', abortController = null) {
        console.log('📸 PhotoAnalyzer: Zahajuji analýzu obrázku');

        try {
            // 1. Validace souboru
            this._validateImageFile(imageFile);

            // 2. Získání informací o souboru
            const fileInfo = MediaConverter.getFileInfo(imageFile);
            console.log('📸 PhotoAnalyzer: Informace o souboru:', fileInfo);

            // 3. Konverze na base64 s kompresí
            const imageBase64 = await this._convertToBase64(imageFile, fileInfo);

            // 4. Analýza pomocí AI služby
            console.log('📸 PhotoAnalyzer: Odesílám do AI služby...');
            const nutritionData = await aiService.analyzeImage(imageBase64, additionalContext, null, abortController);

            if (!nutritionData) {
                throw new Error('AI služba nevrátila platná data');
            }

            console.log('✅ PhotoAnalyzer: Analýza úspěšná:', nutritionData);
            return nutritionData;

        } catch (error) {
            console.error('❌ PhotoAnalyzer: Chyba při analýze:', error);
            throw this._handleError(error);
        }
    }

    /**
     * Validuje, zda je soubor platný obrázek
     * @private
     * @param {File} imageFile - Soubor k validaci
     * @throws {Error} Pokud soubor není platný
     */
    _validateImageFile(imageFile) {
        if (!imageFile) {
            throw new Error('Nebyl vybrán žádný soubor');
        }

        if (!MediaConverter.isImageFile(imageFile)) {
            throw new Error('Vybraný soubor není obrázek');
        }

        // Kontrola velikosti (max 10 MB)
        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (imageFile.size > maxSize) {
            throw new Error('Obrázek je příliš velký (max 10 MB)');
        }

        console.log('✅ PhotoAnalyzer: Validace souboru úspěšná');
    }

    /**
     * Konvertuje obrázek na base64 s kompresí
     * @private
     * @param {File} imageFile - Obrázek File objekt
     * @param {Object} fileInfo - Informace o souboru
     * @returns {Promise<string>} Base64 string
     */
    async _convertToBase64(imageFile, fileInfo) {
        console.log('🔄 PhotoAnalyzer: Konvertuji obrázek na base64...');

        try {
            // Pokud je soubor menší než 500 KB, nekompresi
            if (fileInfo.sizeKB < 500) {
                console.log('📸 PhotoAnalyzer: Soubor je malý, použiji bez komprese');
                return await MediaConverter.fileToBase64(imageFile);
            }

            // Jinak použij kompresi
            console.log('📸 PhotoAnalyzer: Soubor je velký, kompresuji...');
            const compressed = await MediaConverter.compressImage(
                imageFile,
                1024, // maxWidth
                1024, // maxHeight
                0.8   // quality
            );

            console.log('✅ PhotoAnalyzer: Komprese dokončena');
            return compressed;

        } catch (error) {
            console.error('❌ PhotoAnalyzer: Chyba při konverzi:', error);
            throw new Error('Nepodařilo se zpracovat obrázek');
        }
    }

    /**
     * Zpracuje chybu a vrátí uživatelsky přívětivou zprávu
     * @private
     * @param {Error} error - Původní chyba
     * @returns {Error} Upravená chyba
     */
    _handleError(error) {
        return ErrorTranslator.handleError(
            error,
            'Nepodařilo se analyzovat obrázek. Zkuste to prosím znovu.'
        );
    }

}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhotoAnalyzer;
}
