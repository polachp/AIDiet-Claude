# 🎯 CO MUSÍŠ UDĚLAT TEĎKA

Vše je připravené! Teď následuj tyto kroky:

## ✅ Krok 1: Stáhni Service Account Keys

### Pro PROD projekt (ai-diet-calories-count):

1. Otevři: https://console.firebase.google.com/project/ai-diet-calories-count/settings/serviceaccounts/adminsdk
2. Klikni **"Generate new private key"**
3. Potvrdí popup
4. Stáhne se soubor: `ai-diet-calories-count-xxxxxx.json`
5. **Přejmenuj na:** `prod-service-account.json`
6. **Přesuň do:** `C:\Development\AIDiet-Claude\`

### Pro DEV projekt (ai-diet-dev):

1. Otevři: https://console.firebase.google.com/project/ai-diet-dev/settings/serviceaccounts/adminsdk
2. Klikni **"Generate new private key"**
3. Potvrdí popup
4. Stáhne se soubor: `ai-diet-dev-xxxxxx.json`
5. **Přejmenuj na:** `dev-service-account.json`
6. **Přesuň do:** `C:\Development\AIDiet-Claude\`

⚠️ **DŮLEŽITÉ:** Tyto soubory jsou automaticky gitignorované, takže se NIKDY necommitnou!

---

## ✅ Krok 2: Spusť Migration Script

V PowerShell v adresáři projektu:

```bash
node migrate-firestore.js
```

**Co se stane:**
- Připojí se k PROD Firestore
- Připojí se k DEV Firestore
- Zkopíruje VŠECHNA data (config, users, meals, atd.)
- Vypíše progress

**Očekávaný výstup:**
```
🔧 Initializing Firebase Admin SDK...

✅ PROD Firestore connected: ai-diet-calories-count
✅ DEV Firestore connected: ai-diet-dev

🚀 Starting Firestore migration from PROD to DEV
...
✅ ✅ ✅  MIGRATION COMPLETED SUCCESSFULLY!  ✅ ✅ ✅
```

⏱️ **Čas:** 10-30 sekund (záleží na množství dat)

---

## ✅ Krok 3: Ověř Data v Firebase Console

1. Otevři: https://console.firebase.google.com/project/ai-diet-dev/firestore
2. Zkontroluj, že existují:
   - ✅ `config/aiProviders`
   - ✅ `users/{userId}/data/profile`
   - ✅ `users/{userId}/meals/...`

Měl bys vidět **STEJNÁ data** jako v PROD projektu.

---

## ✅ Krok 4: Otestuj Localhost

```bash
START-SERVER.bat
```

Nebo:
```bash
python -m http.server 8000
```

1. Otevři: http://localhost:8000
2. **Otevři Console (F12)**
3. Měl bys vidět:
   ```
   🟢 Environment: DEVELOPMENT (localhost)
   📦 Using Firebase project: ai-diet-dev
   ```
4. Přihlaš se (použij stejný email/heslo jako v PROD)
5. **Měl bys vidět všechna svá data!**

---

## ✅ Krok 5: Ověř, že Vercel Používá PROD

1. Otevři aplikaci na Vercelu (v **JINÉM browseru** nebo Incognito)
2. **Otevři Console (F12)**
3. Měl bys vidět:
   ```
   🔴 Environment: PRODUCTION (tvoje-app.vercel.app)
   📦 Using Firebase project: ai-diet-calories-count
   ```

---

## ✅ Krok 6: Test Paralelního Používání

1. **Tab 1:** Localhost (http://localhost:8000) → Přihlášen
2. **Tab 2:** Vercel (https://tvoje-app.vercel.app) → Přihlášen

**Výsledek:**
- ✅ Obě záložky **zůstanou přihlášené**
- ✅ Žádné konflikty auth sessions!
- ✅ Localhost používá DEV databázi
- ✅ Vercel používá PROD databázi

---

## 🎉 HOTOVO!

Teď můžeš:
- ✅ Vyvíjet na localhostu bez ovlivnění produkce
- ✅ Mít otevřený localhost i Vercel současně
- ✅ Testovat změny v DEV před nasazením do PROD
- ✅ Experimentovat bez strachu z rozbitých dat

---

## 🧹 Volitelné: Vyčištění Po Migraci

Pokud už nebudeš znovu migrovat, můžeš smazat:

```bash
del prod-service-account.json
del dev-service-account.json
del migrate-firestore.js
```

⚠️ **Poznámka:** Tyto soubory jsou gitignorované, takže nepůjdou do gitu ani když je necháš.

---

## 📚 Další Informace

- Detailní návod: `MIGRATION-GUIDE.md`
- Troubleshooting: `MIGRATION-GUIDE.md` → sekce "Troubleshooting"

---

**Máš problém?** Řekni mi a pomůžu! 🚀
