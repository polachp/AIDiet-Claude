// =====================================
// GEMINI AI PROVIDER
// =====================================
// Implementace Google Gemini API
// Podporuje: text, obrázky, audio

/**
 * Gemini AI Provider
 * Podporuje multimodální analýzu (text, obrázky, audio)
 */
class GeminiProvider extends BaseAIProvider {
    constructor(config) {
        super({
            ...config,
            name: 'Gemini',
            capabilities: {
                text: true,
                images: true,
                audio: true
            }
        });

        this.models = config.models || ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
        this.apiVersions = config.apiVersions || ['v1beta', 'v1'];
        this.baseUrl = 'https://generativelanguage.googleapis.com';
    }

    /**
     * Analyzuje textový vstup
     */
    async analyzeText(prompt) {
        return await this._callGeminiAPI(prompt, null, null);
    }

    /**
     * Analyzuje obrázek s textem
     */
    async analyzeImage(prompt, imageBase64) {
        return await this._callGeminiAPI(prompt, imageBase64, 'image');
    }

    /**
     * Analyzuje audio vstup
     */
    async analyzeAudio(prompt, audioBase64) {
        return await this._callGeminiAPI(prompt, audioBase64, 'audio');
    }

    /**
     * Interní metoda pro volání Gemini API
     * @private
     */
    async _callGeminiAPI(prompt, mediaBase64 = null, mediaType = null) {
        if (!this.config.apiKey) {
            throw new Error('API klíč není dostupný');
        }

        const requestBody = this._buildRequestBody(prompt, mediaBase64, mediaType);
        let lastError = null;

        // Zkouší různé modely a API verze
        for (const modelName of this.models) {
            for (const apiVersion of this.apiVersions) {
                try {
                    console.log(`🔄 Gemini: Trying ${apiVersion}/models/${modelName}${mediaType ? ` (${mediaType})` : ''}`);

                    const url = `${this.baseUrl}/${apiVersion}/models/${modelName}:generateContent?key=${this.config.apiKey}`;

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
                        console.warn(`⚠️ Gemini ${apiVersion}/${modelName} failed:`, lastError);
                        continue;
                    }

                    const data = await response.json();

                    // Validace odpovědi
                    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                        lastError = 'Neplatná odpověď z API';
                        console.warn(`⚠️ Gemini ${apiVersion}/${modelName}: Invalid response structure`);
                        continue;
                    }

                    const text = data.candidates[0].content.parts[0].text;
                    console.log(`✅ Gemini: Success with ${apiVersion}/${modelName}`);
                    return text;

                } catch (error) {
                    lastError = error.message;
                    console.warn(`⚠️ Gemini ${apiVersion}/${modelName} error:`, error.message);
                }
            }
        }

        // Všechny pokusy selhaly
        console.error('❌ Gemini: All models failed. Last error:', lastError);
        throw new Error(`Gemini API selhalo: ${lastError}`);
    }

    /**
     * Vytvoří request body podle typu média
     * @private
     */
    _buildRequestBody(prompt, mediaBase64, mediaType) {
        const parts = [{ text: prompt }];

        if (mediaBase64) {
            let mimeType;
            switch (mediaType) {
                case 'image':
                    mimeType = 'image/jpeg';
                    break;
                case 'audio':
                    mimeType = 'audio/webm';
                    break;
                default:
                    throw new Error(`Nepodporovaný typ média: ${mediaType}`);
            }

            parts.push({
                inline_data: {
                    mime_type: mimeType,
                    data: mediaBase64
                }
            });
        }

        return {
            contents: [{
                parts: parts
            }]
        };
    }

    /**
     * Health check - kontrola dostupnosti API
     */
    async healthCheck() {
        if (!this.config.apiKey) {
            return false;
        }

        try {
            // Jednoduchý test s minimálním promptem
            const testPrompt = 'test';
            const url = `${this.baseUrl}/v1/models/${this.models[0]}:generateContent?key=${this.config.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: testPrompt }]
                    }]
                })
            });

            return response.ok;
        } catch (error) {
            console.error('Gemini health check failed:', error);
            return false;
        }
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeminiProvider;
}
