// =====================================
// DEEPSEEK AI PROVIDER
// =====================================
// Implementace DeepSeek API (OpenAI-compatible)
// Podporuje: POUZE text (ne obrázky ani audio)

/**
 * DeepSeek AI Provider
 * ⚠️ POZOR: Podporuje POUZE textovou analýzu, ne obrázky ani audio
 */
class DeepSeekProvider extends BaseAIProvider {
    constructor(config) {
        super({
            ...config,
            name: 'DeepSeek',
            capabilities: {
                text: true,
                images: false,  // DeepSeek nepodporuje obrázky
                audio: false    // DeepSeek nepodporuje audio
            }
        });

        // Unified models array format (same as Gemini)
        // Backward compatibility: pokud existuje config.model, použije se jako fallback
        this.models = config.models || (config.model ? [config.model] : ['deepseek-chat']);
        this.endpoint = config.endpoint || 'https://api.deepseek.com/chat/completions';
        this.temperature = config.temperature || 0.7;
        this.maxTokens = config.maxTokens || 1024;
    }

    /**
     * Analyzuje textový vstup
     */
    async analyzeText(prompt, abortController = null) {
        return await this._callDeepSeekAPI(prompt, abortController);
    }

    /**
     * Analyzuje obrázek - NEPODPOROVÁNO
     * @throws {Error} - DeepSeek nepodporuje obrázky
     */
    async analyzeImage(prompt, imageBase64, abortController = null) {
        throw new Error('DeepSeek nepodporuje analýzu obrázků. Použijte jiného providera (např. Gemini).');
    }

    /**
     * Analyzuje audio - NEPODPOROVÁNO
     * @throws {Error} - DeepSeek nepodporuje audio
     */
    async analyzeAudio(prompt, audioBase64, abortController = null) {
        throw new Error('DeepSeek nepodporuje analýzu audia. Použijte jiného providera (např. Gemini).');
    }

    /**
     * Interní metoda pro volání DeepSeek API
     * @private
     */
    async _callDeepSeekAPI(prompt, abortController = null) {
        if (!this.config.apiKey) {
            throw new Error('API klíč není dostupný');
        }

        // Kontrola zrušení
        if (abortController?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
        }

        try {
            const model = this.models[0]; // Use first model from array
            console.log(`🔄 DeepSeek: Calling ${model}`);

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'Jsi nutriční expert. Tvým úkolem je analyzovat jídla a vrátit přesné výživové hodnoty ve formátu JSON.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                    response_format: { type: 'json_object' }  // Vynucuje JSON výstup
                }),
                signal: abortController?.signal
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
                console.error(`❌ DeepSeek API error:`, errorData);
                throw new Error(`DeepSeek API selhalo: ${errorMessage}`);
            }

            const data = await response.json();

            // Validace odpovědi
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Neplatná odpověď z DeepSeek API');
            }

            const content = data.choices[0].message.content;
            console.log(`✅ DeepSeek: Success with ${model}`);
            console.log(`   Tokens used: ${data.usage?.total_tokens || 'N/A'} (cached: ${data.usage?.prompt_cache_hit_tokens || 0})`);

            return content;

        } catch (error) {
            console.error('❌ DeepSeek error:', error);
            throw error;
        }
    }

    /**
     * Health check - kontrola dostupnosti API
     */
    async healthCheck() {
        if (!this.config.apiKey) {
            return false;
        }

        try {
            const model = this.models[0]; // Use first model from array
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: 'test'
                        }
                    ],
                    max_tokens: 10
                })
            });

            return response.ok;
        } catch (error) {
            console.error('DeepSeek health check failed:', error);
            return false;
        }
    }

    /**
     * Vrací informaci o omezeních providera
     */
    getLimitations() {
        return {
            noImages: true,
            noAudio: true,
            textOnly: true,
            message: 'DeepSeek podporuje pouze textovou analýzu. Pro obrázky a audio použijte Gemini.'
        };
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeepSeekProvider;
}
