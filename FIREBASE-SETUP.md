# Firebase Setup - Instrukce

## 1. Vytvoření Firebase projektu

1. Jděte na [Firebase Console](https://console.firebase.google.com/)
2. Klikněte na **"Add project"** (Přidat projekt)
3. Zadejte název projektu (např. "AI Diet")
4. Volitelně vypněte Google Analytics (není potřeba pro tento projekt)
5. Klikněte **"Create project"**

## 2. Registrace webové aplikace

1. V Firebase Console klikněte na ikonu **</>** (Web)
2. Zadejte nickname aplikace (např. "AI Diet Web")
3. **NEKLIKEJTE** na "Also set up Firebase Hosting" (není potřeba)
4. Klikněte **"Register app"**
5. Zobrazí se vám **Firebase configuration object** - vypadá takto:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

6. **ZKOPÍRUJTE tyto hodnoty** a vložte je do souboru `firebase-config.js` (řádky 5-11)

## 3. Aktivace Authentication

1. V levém menu klikněte na **"Authentication"**
2. Klikněte **"Get started"**
3. V záložce **"Sign-in method"** povolte:
   - **Email/Password** - přepněte na ENABLED
   - **Google** - přepněte na ENABLED (zadejte support email)

## 4. Vytvoření Firestore Database

1. V levém menu klikněte na **"Firestore Database"**
2. Klikněte **"Create database"**
3. Vyberte **"Start in production mode"** (security rules nastavíme později)
4. Vyberte location (např. `europe-west3` pro Evropu)
5. Klikněte **"Enable"**

## 5. Nastavení Security Rules

1. V Firestore Database klikněte na záložku **"Rules"**
2. Nahraďte obsah tímto kódem:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Config collection - read only for authenticated users
    match /config/{document} {
      allow read: if request.auth != null;
      allow write: if false; // Only admins via Firebase Console
    }

    // Users collection - user can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Subcollections
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

3. Klikněte **"Publish"**

## 6. Přidání Gemini API key do Firestore

1. V Firestore Database klikněte na **"Data"**
2. Klikněte **"Start collection"**
3. Collection ID: `config`
4. Document ID: `gemini`
5. Přidejte field:
   - Field: `apiKey`
   - Type: `string`
   - Value: **VÁŠ GEMINI API KEY**
6. Klikněte **"Save"**

## 7. Hotovo!

Vaše aplikace je nyní připravena k použití. Otevřete `index.html` a měli byste vidět přihlašovací obrazovku.

## Troubleshooting

**Chyba: "Firebase: Error (auth/configuration-not-found)"**
- Zkontrolujte, že jste správně zkopírovali všechny hodnoty z Firebase config do `firebase-config.js`

**Chyba: "Missing or insufficient permissions"**
- Zkontrolujte, že jste správně nastavili Security Rules v kroku 5

**Přihlášení nefunguje:**
- Zkontrolujte, že jste povolili Email/Password a Google v Authentication (krok 3)
