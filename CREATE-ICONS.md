# 📱 PWA Icons - Jak Vytvořit

PWA potřebuje PNG ikony pro Android "Add to Home Screen".

## ✅ Nejrychlejší Způsob

### Varianta A: Online nástroj
1. Jdi na: https://realfavicongenerator.net/
2. Nahraj `favicon.svg`
3. Vygeneruje všechny ikony včetně manifest.json
4. Stáhni a nahraď

### Varianta B: ImageMagick (pokud máš)
```bash
# Vytvoř 192x192
magick convert favicon.svg -resize 192x192 icon-192.png

# Vytvoř 512x512
magick convert favicon.svg -resize 512x512 icon-512.png
```

### Varianta C: Photoshop/GIMP
1. Otevři `favicon.svg`
2. Export jako PNG:
   - `icon-192.png` (192x192)
   - `icon-512.png` (512x512)
3. Ulož do root projektu

---

## ⚠️ Důležité

Do té doby můžeš použít favicon.svg (funguje, ale Android preferuje PNG).

Po vytvoření ikon commitni soubory a push.
