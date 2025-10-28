# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Diet is a single-page web application for tracking calorie intake using Google Gemini API. Built with vanilla JavaScript, HTML, and CSS - no build tools or frameworks required. All data stored client-side in LocalStorage.

## Running the Application

**Local Development (Required for voice input):**
```bash
# Double-click START-SERVER.bat (auto-detects Python/PHP/Node.js)
# OR manually:
python -m http.server 8000
# Then open http://localhost:8000
```

**Direct file opening** works but disables voice input (MediaRecorder requires localhost/HTTPS).

**Testing API Integration:**
Open `test-api.html` to debug Gemini API connectivity and model availability.

## Architecture

### Data Flow
```
User Input (text/photo/audio)
  → Gemini API (multimodal analysis)
  → parseNutritionData()
  → addMeal()
  → LocalStorage
  → updateSummary() + displayMeals()
```

### Key State Management

**Global State Variables (app.js:1-6):**
- `meals[]` - Array of meal objects for current day only
- `apiKey` - Gemini API key from LocalStorage
- `userData` - User's age, gender, weight, height, activity level
- `dailyGoals` - Calculated TDEE and macro targets

**LocalStorage Keys:**
- `geminiApiKey` - Persists across sessions
- `userData` - Persists across sessions
- `meals_{date}` - Per-day meal storage (e.g., `meals_Fri Dec 20 2024`)

### Gemini API Integration

**Model Fallback System (app.js:115-190):**
Automatically tries multiple models in order until one succeeds:
1. `gemini-2.5-flash` (preferred)
2. `gemini-2.5-flash-lite`
3. Falls back through both `v1beta` and `v1` API versions

**Three API Call Types:**
- `callGeminiAPI(prompt, imageBase64)` - Text and image analysis
- `callGeminiAPIWithAudio(prompt, audioBase64)` - Audio transcription + analysis
- Both return JSON: `{name, calories, protein, carbs, fat}`

### Voice Input Implementation

Uses **MediaRecorder API** (not Web Speech API) to record audio, then sends raw audio to Gemini multimodal API for transcription and nutrition analysis in a single request. This approach:
- Works in all modern browsers (not just Chrome)
- Requires localhost or HTTPS
- Handles Czech language via Gemini's multilingual capabilities

### Nutrition Calculations

**BMR Calculation (Mifflin-St Jeor equation in app.js:153-161):**
- Male: `10 × weight + 6.25 × height - 5 × age + 5`
- Female: `10 × weight + 6.25 × height - 5 × age - 161`

**TDEE:** `BMR × activity_factor`

**Macro Distribution (app.js:176-189):**
- Protein: 30% of calories (÷ 4 kcal/g = grams)
- Carbs: 40% of calories (÷ 4 kcal/g = grams)
- Fat: 30% of calories (÷ 9 kcal/g = grams)

### UI Patterns

**Settings Toggle (app.js:112-125):**
Settings section hidden by default. First-time users see auto-opened settings with onboarding alert. Button in header toggles visibility.

**Circular Progress SVG (styles.css:348-369):**
Macro nutrients displayed as circular progress indicators using SVG `stroke-dashoffset` animation:
```javascript
const circumference = 2 * Math.PI * 52; // radius = 52
const offset = circumference - (percent / 100) * circumference;
circle.style.strokeDashoffset = offset;
```

**Dynamic HTML Injection:**
API key section and meal list use `innerHTML` updates. Be careful when modifying these - maintain the element IDs:
- `apiKeySection` - Container for API key UI state
- `userDataSection` - Never gets replaced, only reads values
- `mealsList` - Fully regenerated on each meal change

### Design System

**Pastel Color Variables (styles.css:7-23):**
- Primary: `#7B9F8E` (sage green)
- Secondary: `#8BA3C7` (dusty blue)
- Calorie card: `#FFE5E5` (pale pink)
- Protein: `#E5F3FF` (pale blue)
- Carbs: `#FFF5E5` (pale orange)
- Fat: `#F0E5FF` (pale purple)

**Responsive Breakpoint:** 600px for mobile layout

## Common Modifications

**Adding a new input type:**
1. Add tab button in `index.html` with `switchTab('newtype')`
2. Add tab content div with id `newtypeTab`
3. Create `analyzeNewType()` function that calls `callGeminiAPI()`
4. Parse response with `parseNutritionData()` and call `addMeal()`

**Changing macro distribution:**
Modify percentages in `calculateDailyGoals()` (app.js:176-189). Ensure total = 100%.

**Supporting new Gemini models:**
Add model name to `modelsToTry` array in `callGeminiAPI()` or `callGeminiAPIWithAudio()`.

## Deployment

No build process required. Deploy these files directly:
- `index.html`, `app.js`, `styles.css` (required)
- `netlify.toml`, `vercel.json` (optional, for respective platforms)
- `START-SERVER.bat`, `test-api.html`, `README.md` (dev tools, not needed in production)

Works on: GitHub Pages, Netlify, Vercel, Railway, any static host.

## Important Constraints

- **No backend** - All data in LocalStorage (user-specific, not synced)
- **Daily data only** - Meals cleared each day (keyed by date string)
- **Single user** - No authentication or multi-user support
- **Gemini API required** - No offline fallback
- **Czech language** - UI text and alerts in Czech
