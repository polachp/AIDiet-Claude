# Firebase Refactoring - Souhrn Změn

## ✅ Dokončené Úkoly

### 1. Firebase Integrace
- ✅ Přidán Firebase SDK (v9 compat mode)
- ✅ Vytvořen `firebase-config.js` pro konfiguraci a inicializaci
- ✅ Vytvořen `firestore-service.js` se všemi databázovými operacemi
- ✅ Vytvořen `auth.js` s autentizačními funkcemi

### 2. Authentication System
- ✅ Přihlášení přes Google OAuth
- ✅ Registrace/Přihlášení pomocí Email/Heslo
- ✅ Odhlášení
- ✅ Real-time auth state observer
- ✅ UI s login/register formuláři

### 3. Data Migration (LocalStorage → Firestore)
- ✅ **API Key**: Nyní z Firestore `/config/gemini` (společný pro všechny uživatele)
- ✅ **User Profile**: Z Firestore `/users/{userId}/data/profile`
- ✅ **Meals**: Z Firestore `/users/{userId}/meals/{date}/items` s real-time listenerem
- ✅ Automatická synchronizace meals přes Firestore listener

### 4. Security & Rate Limiting
- ✅ Firestore Security Rules - jen přihlášení uživatelé mohou číst/psát svá data
- ✅ Rate limiting - max 100 API volání/den na uživatele
- ✅ API key chráněn v Firestore (read-only pro klienty)

### 5. UI Changes
- ✅ Auth screen s login/register formuláři
- ✅ Logout button v hlavičce
- ✅ API key sekce zobrazuje "Načteno z centrální databáze"
- ✅ Pastelový gradient background na auth screenu
- ✅ Responsive design pro mobilní zařízení

## 📁 Nové Soubory

1. **firebase-config.js** - Firebase konfigurace a inicializace
2. **firestore-service.js** - Všechny Firestore operace (CRUD)
3. **auth.js** - Autentizační funkce
4. **FIREBASE-SETUP.md** - Kompletní návod pro Firebase setup

## 🔧 Upravené Soubory

1. **index.html**
   - Přidána auth UI sekce
   - Main app skrytý dokud není uživatel přihlášen
   - Přidány Firebase SDK skripty
   - Logout button v hlavičce

2. **app.js**
   - Odstraněny LocalStorage operace
   - Přidány `initializeApp()` a `clearAppData()` funkce
   - API key nyní z Firestore
   - User data nyní z Firestore
   - Meals nyní s real-time Firestore listenerem
   - Rate limiting v `addMeal()`

3. **styles.css**
   - Přidány styly pro auth UI
   - Logout button styly
   - Header actions layout

## 🎯 Co Je Třeba Udělat Pro Spuštění

### Krok 1: Vytvořit Firebase Projekt
Následujte návod v `FIREBASE-SETUP.md`:
1. Vytvořte Firebase projekt na https://console.firebase.google.com/
2. Registrujte webovou aplikaci
3. Zkopírujte Firebase config do `firebase-config.js` (řádky 5-11)

### Krok 2: Aktivovat Authentication
1. Povolte Email/Password authentication
2. Povolte Google authentication

### Krok 3: Vytvořit Firestore Database
1. Vytvořte Firestore databázi v production mode
2. Nastavte Security Rules (viz `FIREBASE-SETUP.md`)

### Krok 4: Přidat Gemini API Key do Firestore
1. V Firestore vytvořte collection `config`
2. Vytvořte document `gemini` s fieldem `apiKey` = váš Gemini API key

### Krok 5: Testování
1. Otevřete aplikaci v prohlížeči
2. Měli byste vidět login screen
3. Zaregistrujte se nebo se přihlaste přes Google
4. Po přihlášení byste měli vidět hlavní aplikaci
5. Otestujte přidání jídla, mazání, nastavení profilu

## 🔄 Datový Flow

### Před Refactoringem:
```
User → LocalStorage (API key, userData, meals_{date})
```

### Po Refactoringu:
```
User → Firebase Auth → Firestore
                        ├─ /config/gemini (API key)
                        ├─ /users/{userId}/data/profile
                        └─ /users/{userId}/meals/{date}/items
                                          └─ Real-time listener → UI update
```

## 🚀 Výhody Nového Systému

1. **Multi-user**: Každý uživatel má svá data
2. **Real-time sync**: Změny se projeví okamžitě
3. **Cloud backup**: Data nejsou v LocalStorage, jsou v cloudu
4. **Bezpečnost**: API key skrytý, Security Rules
5. **Rate limiting**: Ochrana před zneužitím API
6. **Authentication**: Google OAuth + Email/Password

## ⚠️ Poznámky

- **LocalStorage data**: Stará data z LocalStorage zůstanou v prohlížeči, ale aplikace je už nepoužívá
- **Migrace**: Uživatelé začínají s čistými daty (žádná migrace starých dat)
- **Rate limit**: 100 API volání/den na uživatele (upravitelné v `firestore-service.js:227`)
- **API key**: Je společný pro všechny uživatele - spravuje ho admin přes Firebase Console

## 🐛 Troubleshooting

**Aplikace se nenačte:**
- Zkontrolujte konzoli prohlížeče (F12)
- Ověřte, že Firebase config je správně vyplněn v `firebase-config.js`

**Nelze se přihlásit:**
- Zkontrolujte, že je Authentication povolen v Firebase Console
- Pro Google OAuth zkontrolujte, že je nastaven support email

**Chyba "Missing or insufficient permissions":**
- Zkontrolujte Security Rules v Firestore

**API calls nefungují:**
- Zkontrolujte, že je Gemini API key správně uložen v `/config/gemini`
- Otevřte konzoli a podívejte se na chybové hlášky
