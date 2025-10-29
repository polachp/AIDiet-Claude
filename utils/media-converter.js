// =====================================
// MEDIA CONVERTER UTILITIES
// =====================================
// Konverze souborů a blobů do base64

/**
 * Utility pro konverzi médií
 * Obsahuje pomocné funkce pro práci s audio, video, obrázky
 */
class MediaConverter {
    /**
     * Konvertuje File objekt na base64
     * @param {File} file - File objekt
     * @returns {Promise<string>} Base64 string (bez data URL prefixu)
     */
    static async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('File je povinný'));
                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                // Odstraň data URL prefix (např. "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };

            reader.onerror = () => {
                reject(new Error('Chyba při čtení souboru'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Konvertuje Blob na base64
     * @param {Blob} blob - Blob objekt
     * @returns {Promise<string>} Base64 string (bez data URL prefixu)
     */
    static async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            if (!blob) {
                reject(new Error('Blob je povinný'));
                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                // Odstraň data URL prefix
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };

            reader.onerror = () => {
                reject(new Error('Chyba při čtení blobu'));
            };

            reader.readAsDataURL(blob);
        });
    }

    /**
     * Konvertuje base64 string na Blob
     * @param {string} base64 - Base64 string
     * @param {string} mimeType - MIME type (např. 'image/jpeg', 'audio/webm')
     * @returns {Blob} Blob objekt
     */
    static base64ToBlob(base64, mimeType = 'application/octet-stream') {
        // Dekóduj base64
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    }

    /**
     * Validuje, zda je soubor obrázek
     * @param {File} file - File objekt
     * @returns {boolean}
     */
    static isImageFile(file) {
        if (!file || !file.type) return false;
        return file.type.startsWith('image/');
    }

    /**
     * Validuje, zda je soubor audio
     * @param {File} file - File objekt
     * @returns {boolean}
     */
    static isAudioFile(file) {
        if (!file || !file.type) return false;
        return file.type.startsWith('audio/');
    }

    /**
     * Validuje, zda je soubor video
     * @param {File} file - File objekt
     * @returns {boolean}
     */
    static isVideoFile(file) {
        if (!file || !file.type) return false;
        return file.type.startsWith('video/');
    }

    /**
     * Získá MIME type z base64 data URL
     * @param {string} dataUrl - Data URL (např. "data:image/jpeg;base64,...")
     * @returns {string|null} MIME type nebo null
     */
    static getMimeTypeFromDataUrl(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return null;

        const match = dataUrl.match(/^data:([^;]+);/);
        return match ? match[1] : null;
    }

    /**
     * Vytvoří data URL z base64 a MIME typu
     * @param {string} base64 - Base64 string
     * @param {string} mimeType - MIME type
     * @returns {string} Data URL
     */
    static createDataUrl(base64, mimeType) {
        return `data:${mimeType};base64,${base64}`;
    }

    /**
     * Komprimuje obrázek (pro optimalizaci uploadů)
     * @param {File} file - Obrázek File objekt
     * @param {number} maxWidth - Maximální šířka (default: 1024)
     * @param {number} maxHeight - Maximální výška (default: 1024)
     * @param {number} quality - Kvalita (0-1, default: 0.8)
     * @returns {Promise<string>} Base64 komprimovaného obrázku
     */
    static async compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            if (!MediaConverter.isImageFile(file)) {
                reject(new Error('Soubor není obrázek'));
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Výpočet nových rozměrů (zachování aspect ratio)
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Konverze na base64
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const base64 = dataUrl.split(',')[1];
                    resolve(base64);
                };

                img.onerror = () => {
                    reject(new Error('Chyba při načítání obrázku'));
                };
            };

            reader.onerror = () => {
                reject(new Error('Chyba při čtení souboru'));
            };
        });
    }

    /**
     * Získá informace o souboru
     * @param {File} file - File objekt
     * @returns {Object} Informace o souboru
     */
    static getFileInfo(file) {
        if (!file) return null;

        return {
            name: file.name,
            size: file.size,
            sizeKB: Math.round(file.size / 1024),
            sizeMB: Math.round((file.size / 1024 / 1024) * 100) / 100,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: new Date(file.lastModified),
            isImage: MediaConverter.isImageFile(file),
            isAudio: MediaConverter.isAudioFile(file),
            isVideo: MediaConverter.isVideoFile(file)
        };
    }
}

// Export pro použití v ostatních modulech
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaConverter;
}
