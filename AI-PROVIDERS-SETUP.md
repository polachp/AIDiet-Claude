# AI Providers Setup Guide

Tato příručka popisuje, jak nakonfigurovat AI providery v Firestore databázi pro aplikaci AI Diet.

## 📋 Přehled

Aplikace nyní podporuje **více AI providerů** pomocí Strategy Pattern:
- **Gemini** (Google) - podporuje text, obrázky, audio
- **DeepSeek** - podporuje pouze text (levnější alternativa)

## 🔧 Konfigurace Firestore

### Struktura Dokumentu

V Firestore vytvořte dokument s touto strukturou:

**Cesta:** `/config/aiProviders`

```json
{
  "defaultProvider": "gemini",
  "fallbackOrder": ["gemini", "deepseek"],
  "providers": {
    "gemini": {
      "enabled": true,
      "apiKey": "VÁŠ_GEMINI_API_KLÍČ",
      "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
      "apiVersions": ["v1beta", "v1"],
      "capabilities": {
        "text": true,
        "images": true,
        "audio": true
      }
    },
    "deepseek": {
      "enabled": false,
      "apiKey": "VÁŠ_DEEPSEEK_API_KLÍČ",
      "models": ["deepseek-chat"],
      "endpoint": "https://api.deepseek.com/chat/completions",
      "temperature": 0.7,
      "maxTokens": 1024,
      "capabilities": {
        "text": true,
        "images": false,
        "audio": false
      }
    }
  }
}
```

## 🚀 Krok za Krokem

### 1. Získání API Klíčů

#### Gemini API (Google)
1. Přejděte na https://makersuite.google.com/app/apikey
2. Vytvořte nový API klíč
3. Zkopírujte klíč

#### DeepSeek API
1. Přejděte na https://platform.deepseek.com/api_keys
2. Zaregistrujte se / přihlaste se
3. Vytvořte nový API klíč
4. Zkopírujte klíč

### 2. Vytvoření Konfigurace ve Firestore

#### Pomocí Firebase Console:

1. Otevřete Firebase Console: https://console.firebase.google.com/
2. Vyberte váš projekt
3. V levém menu klikněte na **Firestore Database**
4. Klikněte na **Start collection**
5. **Collection ID:** `config`
6. **Document ID:** `aiProviders`
7. Přidejte pole podle struktury výše

#### Pomocí Firebase CLI nebo kódu:

```javascript
// Jednoduché nastavení pouze s Gemini
await db.collection('config').doc('aiProviders').set({
  defaultProvider: 'gemini',
  providers: {
    gemini: {
      enabled: true,
      apiKey: 'VÁŠ_GEMINI_KLÍČ',
      models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      apiVersions: ['v1beta', 'v1'],
      capabilities: {
        text: true,
        images: true,
        audio: true
      }
    }
  },
  fallbackOrder: ['gemini']
});
```

## ⚙️ Popis Polí

### Hlavní Konfigurace

| Pole | Typ | Popis |
|------|-----|-------|
| `defaultProvider` | string | Výchozí AI provider (např. "gemini", "deepseek") |
| `fallbackOrder` | array | Pořadí providerů pro fallback při selhání |
| `providers` | object | Konfigurace jednotlivých providerů |

### Provider Konfigurace (Gemini)

| Pole | Typ | Popis |
|------|-----|-------|
| `enabled` | boolean | Zda je provider aktivní |
| `apiKey` | string | API klíč pro Google Gemini |
| `models` | array | Seznam modelů k vyzkoušení (fallback) |
| `apiVersions` | array | Verze API k vyzkoušení |
| `capabilities` | object | Podporované funkce (text/images/audio) |

### Provider Konfigurace (DeepSeek)

| Pole | Typ | Popis |
|------|-----|-------|
| `enabled` | boolean | Zda je provider aktivní |
| `apiKey` | string | API klíč pro DeepSeek |
| `models` | array | Seznam modelů (výchozí: ["deepseek-chat"]) |
| `endpoint` | string | API endpoint URL |
| `temperature` | number | Teplota generování (0-2, výchozí: 0.7) |
| `maxTokens` | number | Max délka odpovědi (výchozí: 1024) |
| `capabilities` | object | Podporované funkce (text/images/audio) |

## 🔄 Migrace ze Staré Konfigurace

Pokud používáte starou konfiguraci (`/config/gemini` s pouze `apiKey`), aplikace automaticky vytvoří fallback config.

**Stará struktura (bude fungovat, ale doporučujeme migrovat):**
```
/config/gemini
{
  apiKey: "VÁŠ_KLÍČ"
}
```

**Nová struktura (doporučeno):**
```
/config/aiProviders
{
  defaultProvider: "gemini",
  providers: {
    gemini: {
      enabled: true,
      apiKey: "VÁŠ_KLÍČ",
      ...
    }
  }
}
```

## 💡 Tipy a Doporučení

### Pouze Gemini (základní setup)
Pokud nechcete používat více providerů, stačí nastavit pouze Gemini:

```json
{
  "defaultProvider": "gemini",
  "providers": {
    "gemini": {
      "enabled": true,
      "apiKey": "VÁŠ_KLÍČ",
      "models": ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
      "apiVersions": ["v1beta", "v1"],
      "capabilities": {
        "text": true,
        "images": true,
        "audio": true
      }
    }
  },
  "fallbackOrder": ["gemini"]
}
```

### Hybrid Setup (Gemini + DeepSeek)
Pro úsporu nákladů používejte DeepSeek pro text a Gemini pro obrázky/audio:

```json
{
  "defaultProvider": "deepseek",
  "providers": {
    "deepseek": {
      "enabled": true,
      "apiKey": "DEEPSEEK_KLÍČ",
      "models": ["deepseek-chat"],
      "endpoint": "https://api.deepseek.com/chat/completions",
      "temperature": 0.7,
      "maxTokens": 1024,
      "capabilities": {
        "text": true,
        "images": false,
        "audio": false
      }
    },
    "gemini": {
      "enabled": true,
      "apiKey": "GEMINI_KLÍČ",
      "models": ["gemini-2.5-flash-lite"],
      "apiVersions": ["v1"],
      "capabilities": {
        "text": true,
        "images": true,
        "audio": true
      }
    }
  },
  "fallbackOrder": ["deepseek", "gemini"]
}
```

**Poznámka:** Aplikace automaticky použije Gemini pro fotky a audio, i když je nastaven DeepSeek jako výchozí.

### Bezpečnost API Klíčů

⚠️ **DŮLEŽITÉ:** API klíče jsou uloženy v Firestore a viditelné pro klienty.

**Doporučené zabezpečení:**
1. Použijte **Firestore Security Rules** pro omezení přístupu
2. API klíče by měly mít **omezený scope** (pouze potřebné API)
3. Nastavte **rate limiting** na úrovni providera
4. Pravidelně **rotujte klíče**

**Příklad Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /config/{document} {
      // Pouze čtení pro přihlášené uživatele
      allow read: if request.auth != null;
      // Pouze admini mohou zapisovat
      allow write: if request.auth != null &&
                      request.auth.token.admin == true;
    }
  }
}
```

## 🧪 Testování Konfigurace

### 1. Kontrola v Console
Po přihlášení do aplikace otevřete Developer Console (F12) a zkontrolujte:

```
✅ AI Providers config loaded from Firestore
✅ Provider gemini vytvořen
✅ AIService: Inicializace dokončena
📋 Dostupní AI provideři:
  - gemini: text=true, images=true, audio=true
```

### 2. Test v UI
1. Přihlaste se do aplikace
2. Otevřete **Nastavení** (ikona ⚙️ v pravém horním rohu)
3. Sjeďte dolů na sekci **AI Provider**
4. Měli byste vidět dostupné providery s ikonkami funkcí
5. Zkuste přepnout mezi providery

### 3. Test Analýzy
- **Text:** Zadejte "jablko" → mělo by vrátit nutriční hodnoty
- **Foto:** Nahrajte obrázek jídla → mělo by analyzovat
- **Audio:** Nahrajte "řízek s brambory" → mělo by přepsat a analyzovat

## 🐛 Troubleshooting

### Chyba: "AI providers config not found"
- Zkontrolujte, že dokument `/config/aiProviders` existuje
- Ověřte správnost názvu kolekce a dokumentu
- Zkontrolujte Firestore Security Rules

### Chyba: "Žádný AI provider není dostupný"
- Zkontrolujte, že alespoň jeden provider má `enabled: true`
- Ověřte, že API klíč je vyplněný
- Zkontrolujte konzoli pro detailní chybovou hlášku

### DeepSeek nepodporuje obrázky/audio
- To je očekávané chování
- DeepSeek API zatím nemá multimodální podporu
- Použijte Gemini pro analýzu obrázků a audia

### Provider fallback nefunguje
- Zkontrolujte `fallbackOrder` v konfiguraci
- Ověřte, že záložní provider je `enabled: true`
- Zkontrolujte konzoli pro detaily o fallback pokusu

## 📚 Další Informace

- [Gemini API Dokumentace](https://ai.google.dev/docs)
- [DeepSeek API Dokumentace](https://api-docs.deepseek.com/)
- [Firebase Firestore Dokumentace](https://firebase.google.com/docs/firestore)

## 🔄 Změny Oproti Původní Verzi

**Před:**
- Pouze Gemini API
- Hardcoded konfigurace v kódu
- Žádná možnost přepínání

**Po:**
- Více AI providerů (Gemini, DeepSeek, snadno rozšiřitelné)
- Konfigurace v Firestore
- UI přepínač v nastavení
- Automatický fallback při selhání
- Strategy Pattern architektura
