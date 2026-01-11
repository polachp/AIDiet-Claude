// =====================================
// ERROR TRANSLATOR UTILITY
// =====================================
// Centralized error message translation to Czech

/**
 * Utility for translating error messages to Czech
 */
class ErrorTranslator {
    // Common error patterns and their Czech translations
    static ERROR_PATTERNS = {
        network: 'Chyba pripojení k internetu',
        fetch: 'Chyba pripojení k síti',
        timeout: 'Operace trvala príliš dlouho',
        'rate limit': 'Denní limit API požadavku byl vyčerpán',
        quota: 'Denní limit API požadavku byl vyčerpán',
        'api key': 'Chyba autorizace API',
        unauthorized: 'Chyba autorizace API',
        parse: 'Nepodařilo se zpracovat odpověď',
        json: 'Nepodařilo se zpracovat odpověď',
        invalid: 'Neplatná data',
        file: 'Chyba při čtení souboru'
    };

    /**
     * Translate error message to Czech
     * @param {Error} error - Original error
     * @param {string} defaultMessage - Default message if no pattern matches
     * @returns {string} Czech error message
     */
    static translate(error, defaultMessage = 'Neznámá chyba') {
        if (!error) return defaultMessage;

        const message = error.message || '';
        const lowerMessage = message.toLowerCase();

        // Check if already in Czech (contains Czech characters)
        if (/[čšřžýáíéúůňťď]/i.test(message)) {
            return message;
        }

        // Find matching pattern
        for (const [pattern, translation] of Object.entries(this.ERROR_PATTERNS)) {
            if (lowerMessage.includes(pattern)) {
                return translation;
            }
        }

        return defaultMessage;
    }

    /**
     * Check if error is an AbortError
     * @param {Error} error - Error to check
     * @returns {boolean} True if AbortError
     */
    static isAbortError(error) {
        return error && error.name === 'AbortError';
    }

    /**
     * Handle error with translation, propagating AbortError unchanged
     * @param {Error} error - Original error
     * @param {string} defaultMessage - Default message
     * @returns {Error} Translated error or original AbortError
     */
    static handleError(error, defaultMessage) {
        if (this.isAbortError(error)) {
            return error;
        }
        return new Error(this.translate(error, defaultMessage));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorTranslator;
}
