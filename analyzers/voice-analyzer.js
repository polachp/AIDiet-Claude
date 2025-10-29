// =====================================
// VOICE ANALYZER
// =====================================
// Analýza hlasových vstupů pomocí AI
// Konvertuje audio blob na base64 a posílá k analýze

/**
 * Voice Analyzer pro analýzu hlasových vstupů
 * Používá AIService pro analýzu audio dat
 */
class VoiceAnalyzer {
    /**
     * Analyzuje audio blob a vrací výživové údaje
     * @param {Blob} audioBlob - Audio nahrávka v Blob formátu
     * @returns {Promise<Object>} Výživové údaje {name, calories, protein, carbs, fat}
     * @throws {Error} Při chybě validace nebo analýzy
     */
    async analyze(audioBlob) {
        console.log('🎤 VoiceAnalyzer: Zahájení analýzy audio vstupu');

        try {
            // Validace vstupního blobu
            this._validateAudioBlob(audioBlob);

            console.log('🔄 VoiceAnalyzer: Konverze audio na base64');

            // Konverze audio blobu na base64
            const audioBase64 = await MediaConverter.blobToBase64(audioBlob);

            if (!audioBase64 || audioBase64.length === 0) {
                throw new Error('Nepodařilo se konvertovat audio na base64');
            }

            console.log(`✅ VoiceAnalyzer: Audio konvertováno (${Math.round(audioBase64.length / 1024)}KB)`);

            // Analýza audio pomocí AI služby
            console.log('🤖 VoiceAnalyzer: Odesílání audio k AI analýze');
            const nutritionData = await aiService.analyzeAudio(audioBase64);

            if (!nutritionData) {
                throw new Error('AI analýza nevrátila žádná data');
            }

            console.log('✅ VoiceAnalyzer: Analýza úspěšná', nutritionData);
            return nutritionData;

        } catch (error) {
            console.error('❌ VoiceAnalyzer: Chyba při analýze:', error);

            // Přeložení chyb do češtiny
            const czechError = this._translateError(error);
            throw new Error(czechError);
        }
    }

    /**
     * Validuje audio blob
     * @private
     * @param {Blob} audioBlob - Audio blob k validaci
     * @throws {Error} Pokud blob není validní
     */
    _validateAudioBlob(audioBlob) {
        if (!audioBlob) {
            throw new Error('Audio blob je povinný');
        }

        if (!(audioBlob instanceof Blob)) {
            throw new Error('Neplatný formát audio dat (musí být Blob)');
        }

        if (audioBlob.size === 0) {
            throw new Error('Audio soubor je prázdný');
        }

        // Kontrola maximální velikosti (např. 10MB)
        const maxSizeBytes = 10 * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`Audio soubor je příliš velký (maximum ${Math.round(maxSizeBytes / 1024 / 1024)}MB)`);
        }

        console.log(`✅ VoiceAnalyzer: Audio blob validní (${Math.round(audioBlob.size / 1024)}KB, typ: ${audioBlob.type || 'neznámý'})`);
    }

    /**
     * Přeloží anglické chybové hlášky do češtiny
     * @private
     * @param {Error} error - Původní chyba
     * @returns {string} České chybové hlášení
     */
    _translateError(error) {
        const errorMessage = error.message.toLowerCase();

        // Překlad běžných chybových hlášek
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
            return 'Chyba připojení k síti. Zkontrolujte internetové připojení.';
        }

        if (errorMessage.includes('timeout')) {
            return 'Analýza trvala příliš dlouho. Zkuste to prosím znovu.';
        }

        if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
            return 'Byl překročen denní limit API požadavků. Zkuste to zítra.';
        }

        if (errorMessage.includes('api key') || errorMessage.includes('unauthorized')) {
            return 'Chyba autorizace API. Kontaktujte správce systému.';
        }

        if (errorMessage.includes('audio') || errorMessage.includes('blob')) {
            return error.message; // Už je v češtině z validace
        }

        if (errorMessage.includes('parse') || errorMessage.includes('json')) {
            return 'Nepodařilo se rozpoznat jídlo z hlasové nahrávky. Zkuste to znovu s jasnějším popisem.';
        }

        // Pokud nemáme překlad, vrátíme originální hlášku
        return error.message || 'Neznámá chyba při analýze hlasového vstupu';
    }

    /**
     * Získá podporované audio formáty pro MediaRecorder
     * @returns {string} MIME typ nejlepšího podporovaného formátu
     */
    static getSupportedAudioFormat() {
        // Seznam preferovaných formátů (od nejlepšího)
        const formats = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
            'audio/wav'
        ];

        // Najdi první podporovaný formát
        for (const format of formats) {
            if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(format)) {
                console.log(`✅ VoiceAnalyzer: Podporovaný formát: ${format}`);
                return format;
            }
        }

        console.warn('⚠️ VoiceAnalyzer: Žádný preferovaný formát není podporován, použije se výchozí');
        return '';
    }

    /**
     * Kontroluje, zda je MediaRecorder API dostupné
     * @returns {boolean} True pokud je MediaRecorder podporován
     */
    static isSupported() {
        const supported = typeof MediaRecorder !== 'undefined' &&
                         typeof navigator.mediaDevices !== 'undefined' &&
                         typeof navigator.mediaDevices.getUserMedia !== 'undefined';

        if (!supported) {
            console.warn('⚠️ VoiceAnalyzer: MediaRecorder API není podporováno v tomto prohlížeči');
        }

        return supported;
    }

    /**
     * Získá informace o audio blobu
     * @param {Blob} audioBlob - Audio blob
     * @returns {Object} Informace o audio souboru
     */
    static getAudioInfo(audioBlob) {
        if (!audioBlob || !(audioBlob instanceof Blob)) {
            return null;
        }

        return {
            size: audioBlob.size,
            sizeKB: Math.round(audioBlob.size / 1024),
            sizeMB: Math.round((audioBlob.size / 1024 / 1024) * 100) / 100,
            type: audioBlob.type || 'unknown',
            isAudio: audioBlob.type.startsWith('audio/')
        };
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceAnalyzer;
}
