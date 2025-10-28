# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Diet is a multi-user web application for tracking calorie intake using Google Gemini API. Built with vanilla JavaScript, HTML, and CSS - no build tools required. Uses Firebase for authentication (Google OAuth + Email/Password) and cloud storage (Firestore). Centralized API key shared across all users.

## Running the Application

**Local dev (for voice input):** Use `START-SERVER.bat` or `python -m http.server 8000`, then open `http://localhost:8000`.
**Direct file opening:** Works but disables voice (MediaRecorder needs localhost/HTTPS).
**Test API:** Open `test-api.html` to debug Gemini connectivity.

## Architecture

### Data Flow
```
Firebase Auth → User logged in
  → User Input (text/photo/audio)
  → Gemini API (multimodal analysis)
  → parseNutritionData()
  → addMealToFirestore()
  → Firestore real-time listener
  → updateSummary() + displayMeals()
```

### Key State Management

**Global Variables (app.js):**
- `currentUser` - Firebase user object (uid, email)
- `meals[]` - Today's meals (synced via real-time listener)
- `apiKey` - Shared Gemini API key from Firestore `/config/gemini`
- `userData` - User profile (age, gender, weight, height, activity)
- `dailyGoals` - Calculated TDEE and macros
- `unsubscribeMealsListener` - Firestore listener cleanup function

**Firestore Structure:**
- `/config/gemini` - Shared API key (read-only for clients)
- `/users/{userId}/data/profile` - User profile + calculated goals
- `/users/{userId}/meals/{date}/items/{mealId}` - Meal entries
- `/users/{userId}/rateLimit/{date}` - API call counter (max 100/day)

### Firebase Integration

**Auth (auth.js):** Google OAuth + Email/Password. Auth observer in `firebase-config.js` → `showMainApp()` or `showAuthUI()`.
**Service Layer (firestore-service.js):** `getApiKeyFromFirestore()`, `saveUserProfile()` (calculates goals), `listenToTodayMeals()` (real-time), `addMealToFirestore()`, `deleteMealFromFirestore()`, rate limiting functions.
**Init Flow:** Auth change → `initializeApp(user)` loads API key, profile, sets listener OR `clearAppData()` on logout.

### Gemini API Integration

**Model Fallback:** Tries `gemini-2.5-flash` → `gemini-2.5-flash-lite` across `v1beta` and `v1` API versions.
**API Calls:** `callGeminiAPI(prompt, imageBase64)` and `callGeminiAPIWithAudio(prompt, audioBase64)` return `{name, calories, protein, carbs, fat}`.
**Voice Input:** MediaRecorder API records audio, Gemini transcribes + analyzes in one request. Requires localhost/HTTPS.

### Nutrition Calculations

**BMR (Mifflin-St Jeor):** Male: `10×weight + 6.25×height - 5×age + 5`, Female: same minus 161
**TDEE:** `BMR × activity_factor`
**Macros:** Protein 30% (÷4), Carbs 40% (÷4), Fat 30% (÷9) of total calories

### UI Patterns

**Auth Toggle:** `authScreen` and `mainApp` switched via `display: none/block`. Auth state observer in `firebase-config.js` handles transitions.
**Settings Modal:** Hidden by default, toggled via header button. Settings button in header.
**Circular Progress:** SVG `stroke-dashoffset` animation for macro nutrients (radius 52, circumference = 2πr).
**Dynamic Updates:** `mealsList` regenerated on Firestore listener callback. Preserve element IDs: `authScreen`, `mainApp`, `loginForm`, `registerForm`, `userDataSection`, `mealsList`.

### Design System

**Colors:** Primary `#7B9F8E` (sage), Secondary `#8BA3C7` (blue), Calorie `#FFE5E5`, Protein `#E5F3FF`, Carbs `#FFF5E5`, Fat `#F0E5FF`
**Responsive:** 600px breakpoint for mobile

## Common Modifications

**New input type:** Add tab in `index.html`, create `analyzeNewType()` → `callGeminiAPI()` → `parseNutritionData()` → `addMealToFirestore()`.
**Change macros:** Edit percentages in `calculateDailyGoals()`. Total must = 100%.
**New Gemini models:** Add to `modelsToTry` array in API functions.

## Deployment

No build process required. Deploy these files:
- `index.html`, `app.js`, `styles.css`, `auth.js`, `firebase-config.js`, `firestore-service.js`
- `netlify.toml`, `vercel.json` (optional, for respective platforms)
- `START-SERVER.bat`, `test-api.html`, `FIREBASE-SETUP.md` (dev tools, not needed in production)

**Prerequisites:** Configure Firebase project and update `firebase-config.js` with your credentials (see `FIREBASE-SETUP.md`).

Works on: GitHub Pages, Netlify, Vercel, Railway, any static host.

## Important Constraints

- **Firebase required** - Authentication and Firestore database mandatory
- **Multi-user** - Each user has isolated data, shared API key
- **Rate limited** - Max 100 Gemini API calls per user per day
- **Daily data** - Meals stored per date, older dates remain in Firestore
- **Gemini API required** - No offline fallback
- **Czech language** - UI text and alerts in Czech
