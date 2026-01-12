// =====================================
// AI SERVICE - HLAVNÍ ORCHESTRÁTOR
// =====================================
// Centrální služba pro práci s AI providery
// Řeší výběr providera, fallback, error handling

/**
 * Hlavní AI služba
 * Orchestruje všechny AI providery a zajišťuje fallback
 */
class AIService {
    // Map analysis type to capability name
    static CAPABILITY_MAP = {
        'text': 'text',
        'image': 'images',
        'audio': 'audio'
    };

    constructor() {
        this.providers = new Map();
        this.config = null;
        this.defaultProvider = null;
        this.userData = null;
    }

    /**
     * Nastaví uživatelská data pro personalizaci promptů
     * @param {Object} userData - Uživatelský profil (gender, weight, goal)
     */
    setUserData(userData) {
        this.userData = userData;
        console.log('✅ AIService: UserData nastavena pro personalizaci promptů');
    }

    /**
     * Inicializuje AI službu s konfigurací z Firestore
     * @param {Object} aiConfig - Kompletní konfigurace AI providerů
     */
    async initialize(aiConfig) {
        if (!aiConfig) {
            throw new Error('AI konfigurace je povinná');
        }

        this.config = aiConfig;

        // Vytvoř všechny dostupné providery
        this.providers = AIProviderFactory.createAllProviders(aiConfig);

        if (this.providers.size === 0) {
            throw new Error('Žádný AI provider není dostupný. Zkontrolujte konfiguraci v Firestore.');
        }

        // Nastav default providera
        this.defaultProvider = AIProviderFactory.getDefaultProvider(aiConfig, this.providers);

        // Vypiš info o providerech
        AIProviderFactory.logProvidersInfo(this.providers);

        // Health check všech providerů
        await this._performHealthChecks();

        console.log('✅ AIService: Inicializace dokončena');
    }

    /**
     * Analyzuje text
     * @param {string} foodDescription - Popis jídla
     * @param {string} preferredProvider - Preferovaný provider (optional)
     * @param {AbortController} abortController - Pro zrušení požadavku (optional)
     * @returns {Promise<Object>} Výživové údaje
     */
    async analyzeText(foodDescription, preferredProvider = null, abortController = null) {
        const prompt = NutritionParser.createFoodAnalysisPrompt(foodDescription, this.userData);
        return await this._analyzeWithFallback('text', prompt, null, preferredProvider, abortController);
    }

    /**
     * Analyzuje obrázek
     * @param {string} imageBase64 - Base64 obrázek
     * @param {string} additionalContext - Dodatečný kontext (optional)
     * @param {string} preferredProvider - Preferovaný provider (optional)
     * @param {AbortController} abortController - Pro zrušení požadavku (optional)
     * @returns {Promise<Object>} Výživové údaje
     */
    async analyzeImage(imageBase64, additionalContext = '', preferredProvider = null, abortController = null) {
        const prompt = NutritionParser.createImageAnalysisPrompt(additionalContext, this.userData);
        return await this._analyzeWithFallback('image', prompt, imageBase64, preferredProvider, abortController);
    }

    /**
     * Analyzuje audio
     * @param {string} audioBase64 - Base64 audio
     * @param {string} preferredProvider - Preferovaný provider (optional)
     * @param {AbortController} abortController - Pro zrušení požadavku (optional)
     * @returns {Promise<Object>} Výživové údaje
     */
    async analyzeAudio(audioBase64, preferredProvider = null, abortController = null) {
        const prompt = NutritionParser.createAudioAnalysisPrompt(this.userData);
        return await this._analyzeWithFallback('audio', prompt, audioBase64, preferredProvider, abortController);
    }

    /**
     * Interní metoda pro analýzu s fallback logikou
     * @private
     */
    async _analyzeWithFallback(analysisType, prompt, mediaData, preferredProvider, abortController = null) {
        // Kontrola zrušení před začátkem
        if (abortController?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
        }

        const requiredCapability = AIService.CAPABILITY_MAP[analysisType];
        let provider = null;

        // 1. Zkus preferovaného providera
        if (preferredProvider) {
            provider = this.providers.get(preferredProvider);
            if (provider && provider.getCapabilities()[requiredCapability]) {
                console.log(`✅ AIService: Používám preferovaného providera: ${preferredProvider}`);
            } else {
                console.warn(`⚠️ AIService: Preferovaný provider ${preferredProvider} nepodporuje ${analysisType}`);
                provider = null;
            }
        }

        // 2. Zkus default providera
        if (!provider && this.defaultProvider && this.defaultProvider.getCapabilities()[requiredCapability]) {
            provider = this.defaultProvider;
            console.log(`✅ AIService: Používám default providera: ${this.defaultProvider.getName()}`);
        }

        // 3. Zkus fallback podle capability
        if (!provider) {
            provider = AIProviderFactory.getProviderByCapability(this.providers, requiredCapability);
        }

        // 4. Žádný vhodný provider
        if (!provider) {
            throw new Error(`Žádný provider nepodporuje ${analysisType}. Zkontrolujte konfiguraci.`);
        }

        // Kontrola zrušení před analýzou
        if (abortController?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
        }

        // Proveď analýzu
        try {
            console.log(`🔄 AIService: Analyzing ${analysisType} with ${provider.getName()}`);

            let aiResponse;
            switch (analysisType) {
                case 'text':
                    aiResponse = await provider.analyzeText(prompt, abortController);
                    break;
                case 'image':
                    aiResponse = await provider.analyzeImage(prompt, mediaData, abortController);
                    break;
                case 'audio':
                    aiResponse = await provider.analyzeAudio(prompt, mediaData, abortController);
                    break;
                default:
                    throw new Error(`Nepodporovaný typ analýzy: ${analysisType}`);
            }

            // Kontrola zrušení po analýze
            if (abortController?.signal.aborted) {
                throw new DOMException('Request aborted', 'AbortError');
            }

            // Parsuj odpověď
            const nutritionData = NutritionParser.parse(aiResponse);

            if (!nutritionData) {
                throw new Error('Nepodařilo se parsovat odpověď AI');
            }

            console.log(`✅ AIService: Analýza úspěšná`, nutritionData);
            return nutritionData;

        } catch (error) {
            // Propaguj AbortError okamžitě
            if (error.name === 'AbortError') {
                throw error;
            }

            console.error(`❌ AIService: Chyba při analýze s ${provider.getName()}:`, error);

            // Zkus fallback na jiného providera
            return await this._tryFallbackProvider(analysisType, prompt, mediaData, provider.getName(), abortController);
        }
    }

    /**
     * Pokus o fallback na jiného providera
     * @private
     */
    async _tryFallbackProvider(analysisType, prompt, mediaData, failedProviderName, abortController = null) {
        // Kontrola zrušení
        if (abortController?.signal.aborted) {
            throw new DOMException('Request aborted', 'AbortError');
        }

        const requiredCapability = AIService.CAPABILITY_MAP[analysisType];

        console.log(`🔄 AIService: Zkouším fallback pro ${analysisType}`);

        // Najdi jiného providera s potřebnou capability
        for (const [name, provider] of this.providers) {
            if (name === failedProviderName) continue; // Přeskoč selhavšího
            if (!provider.getCapabilities()[requiredCapability]) continue;

            // Kontrola zrušení před každým pokusem
            if (abortController?.signal.aborted) {
                throw new DOMException('Request aborted', 'AbortError');
            }

            try {
                console.log(`🔄 AIService: Fallback na ${name}`);

                let aiResponse;
                switch (analysisType) {
                    case 'text':
                        aiResponse = await provider.analyzeText(prompt, abortController);
                        break;
                    case 'image':
                        aiResponse = await provider.analyzeImage(prompt, mediaData, abortController);
                        break;
                    case 'audio':
                        aiResponse = await provider.analyzeAudio(prompt, mediaData, abortController);
                        break;
                }

                const nutritionData = NutritionParser.parse(aiResponse);

                if (nutritionData) {
                    console.log(`✅ AIService: Fallback úspěšný s ${name}`);
                    return nutritionData;
                }

            } catch (error) {
                // Propaguj AbortError
                if (error.name === 'AbortError') {
                    throw error;
                }
                console.warn(`⚠️ AIService: Fallback s ${name} selhal:`, error.message);
            }
        }

        // Všichni provideři selhali
        throw new Error(`Analýza ${analysisType} selhala u všech dostupných providerů`);
    }

    /**
     * Provede health check všech providerů
     * @private
     */
    async _performHealthChecks() {
        console.log('🏥 AIService: Provádím health checks...');

        const checks = [];
        for (const [name, provider] of this.providers) {
            checks.push(
                provider.healthCheck()
                    .then(healthy => {
                        if (healthy) {
                            console.log(`✅ ${name}: Healthy`);
                        } else {
                            console.warn(`⚠️ ${name}: Unhealthy`);
                        }
                        return { name, healthy };
                    })
                    .catch(error => {
                        console.error(`❌ ${name}: Health check failed:`, error);
                        return { name, healthy: false };
                    })
            );
        }

        await Promise.all(checks);
    }

    /**
     * Získá informace o dostupných providerech
     * @returns {Array<Object>} Seznam providerů s jejich capabilities
     */
    getAvailableProviders() {
        const result = [];
        for (const [name, provider] of this.providers) {
            result.push({
                name: name,
                displayName: provider.getName(),
                capabilities: provider.getCapabilities(),
                isDefault: this.defaultProvider === provider
            });
        }
        return result;
    }

    /**
     * Změní default providera
     * @param {string} providerName - Název providera
     */
    setDefaultProvider(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new Error(`Provider ${providerName} není dostupný`);
        }
        this.defaultProvider = provider;
        console.log(`✅ AIService: Default provider změněn na ${providerName}`);
    }

    /**
     * Vrací aktuální konfiguraci
     * @returns {Object} Aktuální konfigurace
     */
    getConfig() {
        return this.config;
    }
}

// Singleton instance
const aiService = new AIService();

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = aiService;
}
