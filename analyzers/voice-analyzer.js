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
    async analyze(audioBlob, abortController = null) {
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
            const nutritionData = await aiService.analyzeAudio(audioBase64, null, abortController);

            if (!nutritionData) {
                throw new Error('AI analýza nevrátila žádná data');
            }

            console.log('✅ VoiceAnalyzer: Analýza úspěšná', nutritionData);
            return nutritionData;

        } catch (error) {
            console.error('❌ VoiceAnalyzer: Chyba při analýze:', error);
            throw ErrorTranslator.handleError(
                error,
                'Nepodařilo se analyzovat hlasový vstup. Zkuste to prosím znovu.'
            );
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

        // Kontrola maximální velikosti (10MB)
        const maxSizeMB = 10;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (audioBlob.size > maxSizeBytes) {
            throw new Error(`Audio soubor je príliš velký (maximum ${maxSizeMB}MB)`);
        }

        console.log(`✅ VoiceAnalyzer: Audio blob validní (${Math.round(audioBlob.size / 1024)}KB, typ: ${audioBlob.type || 'neznámý'})`);
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
