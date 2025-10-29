// =====================================
// BASE AI PROVIDER INTERFACE
// =====================================
// Abstraktní třída definující rozhraní pro všechny AI providery
// Implementuje Strategy Pattern pro výměnné AI služby

/**
 * Základní třída pro všechny AI providery
 * Všichni provideři musí implementovat tyto metody
 */
class BaseAIProvider {
    constructor(config) {
        if (this.constructor === BaseAIProvider) {
            throw new Error('BaseAIProvider je abstraktní třída a nelze ji instancovat přímo');
        }
        this.config = config;
        this.name = config.name || 'unknown';
    }

    /**
     * Analyzuje textový vstup
     * @param {string} prompt - Prompt pro AI
     * @returns {Promise<Object>} - Odpověď AI s výživovými údaji
     */
    async analyzeText(prompt) {
        throw new Error('analyzeText() musí být implementována v potomkovi');
    }

    /**
     * Analyzuje obrázek s textem
     * @param {string} prompt - Prompt pro AI
     * @param {string} imageBase64 - Base64 zakódovaný obrázek
     * @returns {Promise<Object>} - Odpověď AI s výživovými údaji
     */
    async analyzeImage(prompt, imageBase64) {
        if (!this.supportsImages()) {
            throw new Error(`${this.name} nepodporuje analýzu obrázků`);
        }
        throw new Error('analyzeImage() musí být implementována v potomkovi');
    }

    /**
     * Analyzuje audio vstup
     * @param {string} prompt - Prompt pro AI
     * @param {string} audioBase64 - Base64 zakódované audio
     * @returns {Promise<Object>} - Odpověď AI s výživovými údaji
     */
    async analyzeAudio(prompt, audioBase64) {
        if (!this.supportsAudio()) {
            throw new Error(`${this.name} nepodporuje analýzu audia`);
        }
        throw new Error('analyzeAudio() musí být implementována v potomkovi');
    }

    /**
     * Vrací, zda provider podporuje analýzu obrázků
     * @returns {boolean}
     */
    supportsImages() {
        return this.config.capabilities?.images || false;
    }

    /**
     * Vrací, zda provider podporuje analýzu audia
     * @returns {boolean}
     */
    supportsAudio() {
        return this.config.capabilities?.audio || false;
    }

    /**
     * Vrací, zda provider podporuje textovou analýzu
     * @returns {boolean}
     */
    supportsText() {
        return this.config.capabilities?.text || true;
    }

    /**
     * Kontrola dostupnosti API
     * @returns {Promise<boolean>}
     */
    async healthCheck() {
        try {
            // Základní implementace - potomci mohou přepsat
            return !!this.config.apiKey;
        } catch (error) {
            console.error(`Health check failed for ${this.name}:`, error);
            return false;
        }
    }

    /**
     * Získá název providera
     * @returns {string}
     */
    getName() {
        return this.name;
    }

    /**
     * Získá capabilities providera
     * @returns {Object}
     */
    getCapabilities() {
        return {
            text: this.supportsText(),
            images: this.supportsImages(),
            audio: this.supportsAudio()
        };
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseAIProvider;
}
