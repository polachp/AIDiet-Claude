// =====================================
// AI PROVIDER FACTORY
// =====================================
// Factory pattern pro vytváření AI providerů
// Centralizované místo pro instanciaci providerů

/**
 * Factory pro vytváření AI providerů
 * Implementuje Factory Pattern
 */
class AIProviderFactory {
    /**
     * Vytvoří instanci providera podle typu
     * @param {string} providerType - Typ providera ('gemini', 'deepseek', atd.)
     * @param {Object} config - Konfigurace providera
     * @returns {BaseAIProvider} Instance providera
     */
    static createProvider(providerType, config) {
        if (!providerType) {
            throw new Error('Provider type je povinný');
        }

        if (!config) {
            throw new Error('Config je povinná');
        }

        const type = providerType.toLowerCase();

        switch (type) {
            case 'gemini':
                return new GeminiProvider(config);

            case 'deepseek':
                return new DeepSeekProvider(config);

            // Zde lze snadno přidat další providery v budoucnu:
            // case 'openai':
            //     return new OpenAIProvider(config);
            // case 'claude':
            //     return new ClaudeProvider(config);

            default:
                throw new Error(`Nepodporovaný provider: ${providerType}. Podporované: gemini, deepseek`);
        }
    }

    /**
     * Vytvoří všechny dostupné providery ze systémové konfigurace
     * @param {Object} aiConfig - Kompletní AI konfigurace z Firestore
     * @returns {Map<string, BaseAIProvider>} Mapa providerů (name -> instance)
     */
    static createAllProviders(aiConfig) {
        const providers = new Map();

        if (!aiConfig || !aiConfig.providers) {
            console.warn('⚠️ Žádná konfigurace AI providerů');
            return providers;
        }

        for (const [providerName, providerConfig] of Object.entries(aiConfig.providers)) {
            // Přeskoč vypnuté providery
            if (providerConfig.enabled === false) {
                console.log(`⏭️ Provider ${providerName} je vypnutý, přeskakuji`);
                continue;
            }

            // Přeskoč providery bez API klíče
            if (!providerConfig.apiKey) {
                console.warn(`⚠️ Provider ${providerName} nemá API klíč, přeskakuji`);
                continue;
            }

            try {
                const provider = AIProviderFactory.createProvider(providerName, providerConfig);
                providers.set(providerName, provider);
                console.log(`✅ Provider ${providerName} vytvořen`);
            } catch (error) {
                console.error(`❌ Chyba při vytváření providera ${providerName}:`, error);
            }
        }

        return providers;
    }

    /**
     * Získá default providera
     * @param {Object} aiConfig - Kompletní AI konfigurace
     * @param {Map<string, BaseAIProvider>} providers - Dostupní provideři
     * @returns {BaseAIProvider|null} Default provider nebo null
     */
    static getDefaultProvider(aiConfig, providers) {
        if (!aiConfig || !aiConfig.defaultProvider) {
            console.warn('⚠️ Není nastaven defaultProvider');
            return null;
        }

        const defaultName = aiConfig.defaultProvider;
        const provider = providers.get(defaultName);

        if (!provider) {
            console.warn(`⚠️ Default provider "${defaultName}" není dostupný`);
            return null;
        }

        return provider;
    }

    /**
     * Získá providera s fallback
     * @param {Object} aiConfig - Kompletní AI konfigurace
     * @param {Map<string, BaseAIProvider>} providers - Dostupní provideři
     * @param {string} preferredProvider - Preferovaný provider (optional)
     * @returns {BaseAIProvider} Provider nebo vyhodí chybu
     */
    static getProviderWithFallback(aiConfig, providers, preferredProvider = null) {
        // Zkus preferovaného providera
        if (preferredProvider) {
            const provider = providers.get(preferredProvider);
            if (provider) {
                console.log(`✅ Používám preferovaného providera: ${preferredProvider}`);
                return provider;
            }
            console.warn(`⚠️ Preferovaný provider "${preferredProvider}" není dostupný, zkouším fallback`);
        }

        // Zkus default providera
        const defaultProvider = this.getDefaultProvider(aiConfig, providers);
        if (defaultProvider) {
            console.log(`✅ Používám default providera: ${aiConfig.defaultProvider}`);
            return defaultProvider;
        }

        // Zkus fallback pořadí
        if (aiConfig.fallbackOrder && Array.isArray(aiConfig.fallbackOrder)) {
            for (const providerName of aiConfig.fallbackOrder) {
                const provider = providers.get(providerName);
                if (provider) {
                    console.log(`✅ Používám fallback providera: ${providerName}`);
                    return provider;
                }
            }
        }

        // Zkus jakéhokoliv dostupného providera
        if (providers.size > 0) {
            const firstProvider = providers.values().next().value;
            console.log(`✅ Používám prvního dostupného providera: ${firstProvider.getName()}`);
            return firstProvider;
        }

        // Žádný provider není dostupný
        throw new Error('Žádný AI provider není dostupný. Zkontrolujte konfiguraci.');
    }

    /**
     * Získá providera podle capability
     * @param {Map<string, BaseAIProvider>} providers - Dostupní provideři
     * @param {string} capability - Požadovaná schopnost ('text', 'images', 'audio')
     * @returns {BaseAIProvider|null} Provider nebo null
     */
    static getProviderByCapability(providers, capability) {
        for (const [name, provider] of providers) {
            const capabilities = provider.getCapabilities();
            if (capabilities[capability]) {
                console.log(`✅ Nalezen provider s ${capability}: ${name}`);
                return provider;
            }
        }

        console.warn(`⚠️ Žádný provider nepodporuje ${capability}`);
        return null;
    }

    /**
     * Vypíše informace o dostupných providerech
     * @param {Map<string, BaseAIProvider>} providers - Dostupní provideři
     */
    static logProvidersInfo(providers) {
        console.log('📋 Dostupní AI provideři:');
        for (const [name, provider] of providers) {
            const caps = provider.getCapabilities();
            console.log(`  - ${name}: text=${caps.text}, images=${caps.images}, audio=${caps.audio}`);
        }
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIProviderFactory;
}
