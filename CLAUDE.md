# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

**⚠️ IMPORTANT: User prefers concise responses**

- ✅ Be brief and to the point
- ✅ Highlight critical info with **bold** or emojis
- ✅ Skip verbose explanations unless asked
- ✅ Use bullet points over paragraphs
- ❌ Don't repeat information
- ❌ Don't over-explain simple concepts

Example:
```
❌ Bad: "I'm going to update the file. This will change the configuration
        to use the new system. The reason we're doing this is because..."

✅ Good: "Updating config to use new system."
```

## Project Overview

AI Diet is a multi-user web application for tracking calorie intake using **multiple AI providers** (Gemini, DeepSeek). Built with vanilla JavaScript, HTML, and CSS - no build tools required. Uses Firebase for authentication (Google OAuth + Email/Password) and cloud storage (Firestore). **Strategy Pattern** architecture for AI providers.

## Running the Application

**Local dev (for voice input):** Use `START-SERVER.bat` or `python -m http.server 8000`, then open `http://localhost:8000`.
**Direct file opening:** Works but disables voice (MediaRecorder needs localhost/HTTPS).
**Test API:** Open `test-api.html` to debug Gemini connectivity.

## Architecture

### Modular Structure (NEW)

```
├── ai-providers/          # Strategy Pattern implementation
│   ├── base-provider.js   # Abstract interface
│   ├── gemini-provider.js # Google Gemini implementation
│   ├── deepseek-provider.js # DeepSeek implementation
│   └── provider-factory.js # Factory for creating providers
├── services/
│   ├── ai-service.js      # Main orchestrator with fallback
│   ├── nutrition-parser.js # Parse AI responses
│   └── firestore-service.js # Database operations
├── analyzers/
│   ├── text-analyzer.js   # Text input handler
│   ├── photo-analyzer.js  # Image input handler
│   └── voice-analyzer.js  # Audio input handler
├── utils/
│   └── media-converter.js # Base64 conversion utilities
├── app.js                 # Main orchestration (1,074 lines, reduced from 1,404)
├── auth.js                # Authentication
├── firebase-config.js     # Firebase initialization
└── index.html             # UI structure
```

### Data Flow (UPDATED)

```
Firebase Auth → User logged in
  → User Input (text/photo/audio)
  → AIService (selects provider based on capability)
  → Analyzer (TextAnalyzer/PhotoAnalyzer/VoiceAnalyzer)
  → AI Provider (Gemini/DeepSeek with automatic fallback)
  → NutritionParser.parse()
  → addMealToFirestore()
  → Firestore real-time listener
  → updateSummary() + displayMeals()
```

### Key State Management

**AppState (app.js):**
- `currentUser` - Firebase user object (uid, email)
- `meals[]` - Today's meals (synced via real-time listener)
- `aiConfig` - Multi-provider configuration from Firestore
- `userData` - User profile (age, gender, weight, height, activity)
- `dailyGoals` - Calculated TDEE and macros
- `unsubscribeMealsListener` - Firestore listener cleanup function

**Firestore Structure:**
- `/config/aiProviders` - **NEW:** Multi-provider configuration with fallback
  ```javascript
  {
    defaultProvider: "gemini",
    providers: {
      gemini: { apiKey, models, apiVersions, capabilities },
      deepseek: { apiKey, models, endpoint, temperature, maxTokens, capabilities }
    },
    fallbackOrder: ["gemini", "deepseek"]
  }
  ```
- `/config/gemini` - **DEPRECATED:** Legacy single API key (backward compatible)
- `/users/{userId}/data/profile` - User profile + calculated goals
- `/users/{userId}/meals/{date}/items/{mealId}` - Meal entries
- `/users/{userId}/rateLimit/{date}` - API call counter (max 100/day for Gemini)

### Firebase Integration

**Auth (auth.js):** Google OAuth + Email/Password. Auth observer in `firebase-config.js` → `showMainApp()` or `showAuthUI()`.

**Service Layer (firestore-service.js):**
- `getAIProvidersConfig()` - **NEW:** Loads multi-provider config with legacy fallback
- `saveAIProvidersConfig(config)` - **NEW:** Saves provider configuration
- `updateDefaultProvider(name)` - **NEW:** Changes active provider
- `getApiKeyFromFirestore()` - **DEPRECATED:** Legacy single-key loader
- `saveUserProfile()` - Calculates goals
- `listenToTodayMeals()` - Real-time meal sync
- Rate limiting functions

**Init Flow:**
```
Auth change → initializeApp(user)
  → loadAIConfig()
  → aiService.initialize(config)
  → Loads profile, sets listener
OR clearAppData() on logout
```

### AI Provider Integration (NEW - Strategy Pattern)

**BaseAIProvider (base-provider.js):**
- Abstract interface defining `analyzeText()`, `analyzeImage()`, `analyzeAudio()`
- Capability checks: `supportsImages()`, `supportsAudio()`, `supportsText()`
- Health check: `healthCheck()`

**GeminiProvider (gemini-provider.js):**
- Implements full multimodal support (text, images, audio)
- Model fallback: `gemini-2.5-flash` → `gemini-2.5-flash-lite`
- API version fallback: `v1beta` → `v1`
- Returns raw AI response text

**DeepSeekProvider (deepseek-provider.js):**
- ⚠️ **TEXT ONLY** - no image/audio support
- Uses OpenAI-compatible API format
- Endpoint: `https://api.deepseek.com/chat/completions`
- Forces JSON output with `response_format: { type: 'json_object' }`
- Cheaper alternative for text analysis

**AIProviderFactory (provider-factory.js):**
- Creates provider instances: `createProvider(type, config)`
- Creates all providers: `createAllProviders(aiConfig)`
- Smart fallback: `getProviderWithFallback()`
- Capability-based selection: `getProviderByCapability()`

**AIService (ai-service.js):**
- Main orchestrator (singleton: `aiService`)
- Methods:
  - `initialize(aiConfig)` - Setup with config
  - `analyzeText(description)` - Text analysis
  - `analyzeImage(base64, context)` - Image analysis
  - `analyzeAudio(base64)` - Audio analysis
- Automatic provider selection based on capability
- Fallback to alternative provider on failure
- Health checks on initialization

**NutritionParser (nutrition-parser.js):**
- `parse(aiResponse)` - Extracts nutrition data from AI text
- Supports JSON and text formats
- Validates: structure, value ranges, minimums
- Creates prompts: `createFoodAnalysisPrompt()`, `createImageAnalysisPrompt()`, `createAudioAnalysisPrompt()`

### Analyzers (NEW)

**TextAnalyzer (text-analyzer.js):**
- `analyze(textInput)` - Validates and calls `aiService.analyzeText()`
- Returns `{name, calories, protein, carbs, fat}`

**PhotoAnalyzer (photo-analyzer.js):**
- `analyze(imageFile, context)` - Validates, converts to base64, analyzes
- Auto-compression for files >500KB (max 1024x1024, quality 0.8)
- Uses `MediaConverter.compressImage()` or `fileToBase64()`

**VoiceAnalyzer (voice-analyzer.js):**
- `analyze(audioBlob)` - Converts blob to base64, calls AI
- Uses `MediaConverter.blobToBase64()`
- Static helpers: `getSupportedAudioFormat()`, `isSupported()`

**MediaConverter (media-converter.js):**
- `fileToBase64(file)` - File → base64 string
- `blobToBase64(blob)` - Blob → base64 string
- `compressImage(file, maxW, maxH, quality)` - Smart image compression
- Validators: `isImageFile()`, `isAudioFile()`, `isVideoFile()`

### Nutrition Calculations

**BMR (Mifflin-St Jeor):** Male: `10×weight + 6.25×height - 5×age + 5`, Female: same minus 161
**TDEE:** `BMR × activity_factor`
**Macros:** Protein 30% (÷4), Carbs 40% (÷4), Fat 30% (÷9) of total calories

### UI Patterns

**Auth Toggle:** `authScreen` and `mainApp` switched via `display: none/block`. Auth state observer in `firebase-config.js` handles transitions.

**Settings Modal:**
- User data section (age, gender, weight, height, activity, goal)
- **NEW:** AI Provider selection with capability indicators
  - Radio buttons for provider selection
  - Visual indicators: 📝 Text, 📷 Images, 🎤 Audio
  - Warnings for limited providers (DeepSeek)
  - Live capability display

**Circular Progress:** SVG `stroke-dashoffset` animation for macro nutrients (radius 52, circumference = 2πr).

**Dynamic Updates:** `mealsList` regenerated on Firestore listener callback. Preserve element IDs: `authScreen`, `mainApp`, `loginForm`, `registerForm`, `userDataSection`, `mealsList`, `aiProvidersList`, `providerCapabilities`.

### Design System

**Colors:** Primary `#7B9F8E` (sage), Secondary `#8BA3C7` (blue), Calorie `#FFE5E5`, Protein `#E5F3FF`, Carbs `#FFF5E5`, Fat `#F0E5FF`
**Responsive:** 600px breakpoint for mobile

## Common Modifications

**Add new AI provider:**
1. Create new provider class extending `BaseAIProvider` in `ai-providers/`
2. Implement `analyzeText()`, `analyzeImage()`, `analyzeAudio()` methods
3. Add to `AIProviderFactory.createProvider()` switch statement
4. Add configuration to Firestore `/config/aiProviders`

**Change default provider:**
- UI: Settings → AI Provider → Select provider
- Code: `aiService.setDefaultProvider('name')`
- Firestore: Update `defaultProvider` field in `/config/aiProviders`

**New input type:**
1. Add tab in `index.html`
2. Create analyzer in `analyzers/` extending pattern
3. Add method to `AIService` if needed
4. Wire up in `app.js`

**Change macros:** Edit percentages in `calculateDailyGoals()`. Total must = 100%.

## Deployment

No build process required. Deploy these files:

**Core:**
- `index.html`, `app.js`, `styles.css`
- `auth.js`, `firebase-config.js`, `firestore-service.js`

**AI Providers (NEW):**
- `ai-providers/*.js` (base, gemini, deepseek, factory)

**Services (NEW):**
- `services/*.js` (ai-service, nutrition-parser)

**Analyzers (NEW):**
- `analyzers/*.js` (text, photo, voice)

**Utils (NEW):**
- `utils/*.js` (media-converter)

**Optional:**
- `netlify.toml`, `vercel.json` (platform configs)
- `START-SERVER.bat`, `test-api.html` (dev tools)
- `FIREBASE-SETUP.md`, `AI-PROVIDERS-SETUP.md` (documentation)

**Prerequisites:**
1. Configure Firebase project and update `firebase-config.js` (see `FIREBASE-SETUP.md`)
2. Set up AI providers in Firestore (see `AI-PROVIDERS-SETUP.md`)

Works on: GitHub Pages, Netlify, Vercel, Railway, any static host.

## Git Workflow

**⚠️ CRITICAL: Main branch = Production**

- ❌ **NEVER push to main** without explicit user approval
- ✅ **Commit locally** with proper commit messages
- ✅ **Wait for user testing** - user must test changes first
- ✅ **Push only after** user says "go git", "push to git", or similar confirmation
- 📋 **Process:**
  1. Make changes
  2. Commit locally (`git add . && git commit`)
  3. Tell user: "Changes committed locally, ready for testing"
  4. **WAIT** for user to test
  5. User says "go git" → then `git push origin main`

**Reasoning:** Every push to main goes live to production. User needs to verify changes work correctly before deployment.

## Important Constraints

- **Firebase required** - Authentication and Firestore database mandatory
- **Multi-user** - Each user has isolated data, shared AI provider configs
- **Rate limited** - Max 100 Gemini API calls per user per day
- **Daily data** - Meals stored per date, older dates remain in Firestore
- **Multi-AI support** - Gemini (full multimodal) or DeepSeek (text only)
- **Automatic fallback** - If primary provider fails, tries alternatives
- **Czech language** - UI text and alerts in Czech

## Key Changes from Original

**Refactoring (v2.0):**
- ✅ Reduced `app.js` from 1,404 → 1,074 lines (23.5% smaller)
- ✅ Extracted 330+ lines into modular architecture
- ✅ Strategy Pattern for AI providers (easy to add GPT-4, Claude, etc.)
- ✅ Automatic provider fallback on failure
- ✅ UI for switching AI providers
- ✅ DeepSeek support for cost optimization
- ✅ Better error handling and logging
- ✅ Backward compatible with legacy config

**File Structure:**
- **Before:** All in `app.js` (monolithic)
- **After:** Modular folders (providers, services, analyzers, utils)

**Configuration:**
- **Before:** `/config/gemini` with single API key
- **After:** `/config/aiProviders` with multi-provider support + fallback
