# 🔄 Firestore Migration Guide - PROD to DEV

This guide explains how to copy Firestore data from **PRODUCTION** to **DEVELOPMENT** Firebase project.

## 📋 Prerequisites

Before running the migration:

1. ✅ **DEV Firebase project created** (`ai-diet-dev`)
2. ✅ **Authentication enabled** (Email/Password + Google)
3. ✅ **Firestore Database enabled** (test mode is fine)
4. ✅ **Service account keys downloaded:**
   - `prod-service-account.json` (from ai-diet-calories-count)
   - `dev-service-account.json` (from ai-diet-dev)
5. ✅ **firebase-admin installed:** `npm install firebase-admin`

## 🚀 How to Run Migration

### Step 1: Download Service Account Keys

#### For PROD project:
1. Firebase Console → **ai-diet-calories-count** → ⚙️ Project Settings
2. **Service accounts** tab → **Generate new private key**
3. Download and rename to: `prod-service-account.json`
4. Place in project root: `C:\Development\AIDiet-Claude\`

#### For DEV project:
1. Firebase Console → **ai-diet-dev** → ⚙️ Project Settings
2. **Service accounts** tab → **Generate new private key**
3. Download and rename to: `dev-service-account.json`
4. Place in project root: `C:\Development\AIDiet-Claude\`

⚠️ **IMPORTANT:** These files are automatically ignored by git (.gitignore)

### Step 2: Run Migration Script

```bash
node migrate-firestore.js
```

**What it does:**
- Connects to PROD Firestore (`ai-diet-calories-count`)
- Connects to DEV Firestore (`ai-diet-dev`)
- Copies ALL collections, documents, and subcollections
- Preserves document structure and IDs
- Shows progress in console

**Expected output:**
```
🔧 Initializing Firebase Admin SDK...

✅ PROD Firestore connected: ai-diet-calories-count
✅ DEV Firestore connected: ai-diet-dev

🚀 Starting Firestore migration from PROD to DEV

📋 Found 2 root collections:

════════════════════════════════════════════════════════════
📦 Processing: /config
════════════════════════════════════════════════════════════

📁 Copying collection: config
  Found 1 documents
  ✅ Copied document: config/aiProviders

════════════════════════════════════════════════════════════
📦 Processing: /users
════════════════════════════════════════════════════════════

📁 Copying collection: users
  Found 3 documents
  ✅ Copied document: users/abc123
    📁 Copying collection: users/abc123/data
      ✅ Copied document: users/abc123/data/profile
    📁 Copying collection: users/abc123/meals
      ...

✅ ✅ ✅  MIGRATION COMPLETED SUCCESSFULLY!  ✅ ✅ ✅
```

### Step 3: Verify in Firebase Console

1. Open Firebase Console: https://console.firebase.google.com/
2. Select **ai-diet-dev** project
3. Go to **Firestore Database**
4. Verify collections exist:
   - ✅ `/config/aiProviders`
   - ✅ `/users/{userId}/data/profile`
   - ✅ `/users/{userId}/meals/{date}/items/...`

### Step 4: Clean Up (Optional)

After successful migration, you can delete:
```bash
del prod-service-account.json
del dev-service-account.json
del migrate-firestore.js
```

⚠️ **Note:** These files are already gitignored, so they won't be committed even if you keep them.

## 🎯 How Environment Switching Works

After migration, the app automatically uses the correct Firebase project:

### On Localhost (`http://localhost:8000`):
```javascript
🟢 Environment: DEVELOPMENT (localhost)
📦 Using Firebase project: ai-diet-dev
```

### On Vercel (Production):
```javascript
🔴 Environment: PRODUCTION (your-app.vercel.app)
📦 Using Firebase project: ai-diet-calories-count
```

**Implementation:** See `firebase-config.js` → `getFirebaseConfig()` function

## ✅ Benefits

- ✅ **No auth conflicts** - localhost and Vercel use different Firebase projects
- ✅ **Safe testing** - break DEV database without affecting PROD
- ✅ **Isolated data** - DEV users ≠ PROD users
- ✅ **Automatic switching** - no manual config changes needed

## 🐛 Troubleshooting

### Error: "Cannot find module 'firebase-admin'"
```bash
npm install firebase-admin
```

### Error: "Service account key not found"
- Check file names: `prod-service-account.json`, `dev-service-account.json`
- Check file location: must be in project root
- Re-download from Firebase Console if needed

### Error: "Permission denied"
- Verify service account has **Firebase Admin** role
- Check Firestore is enabled in DEV project
- Ensure you're project owner/editor in both projects

### Migration hangs or takes too long
- Normal for large databases (3+ users with lots of meals)
- Check network connection
- Monitor Firebase Console quota usage

## 📚 Related Documentation

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Service Accounts](https://cloud.google.com/iam/docs/service-accounts)

## ⚠️ Security Notes

- **NEVER commit service account JSON files** to git
- **NEVER share service account keys** publicly
- **Delete service accounts** after migration if no longer needed
- Service accounts have **full admin access** to Firebase project

---

**Need help?** Check console output for detailed error messages.
