/**
 * Модуль криптографии (AES-GCM + PBKDF2)
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Оптимизированная конвертация в Base64 для больших объемов данных
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192; 
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function getPasswordKey(password) {
    return await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
}

async function deriveKey(passwordKey, salt) {
    return await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 600000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export const AdvancedCryptoModule = {
    encrypt: async function(text, password) {
        if (!text) return "";
        
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const passwordKey = await getPasswordKey(password);
        const aesKey = await deriveKey(passwordKey, salt);
        
        const encodedText = encoder.encode(text);
        
        const encryptedContent = await crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            aesKey,
            encodedText
        );
        
        const encryptedBytes = new Uint8Array(encryptedContent);
        
        const payload = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
        payload.set(salt, 0);
        payload.set(iv, salt.length);
        payload.set(encryptedBytes, salt.length + iv.length);
        
        return bufferToBase64(payload);
    },

    decrypt: async function(encodedText, password) {
        if (!encodedText) return "";
        
        try {
            const payloadBuffer = base64ToBuffer(encodedText);
            const payload = new Uint8Array(payloadBuffer);
            
            if (payload.length < 45) {
                throw new Error("Неверный формат данных или код поврежден.");
            }

            const salt = payload.slice(0, 16);
            const iv = payload.slice(16, 28);
            const encryptedBytes = payload.slice(28);
            
            const passwordKey = await getPasswordKey(password);
            const aesKey = await deriveKey(passwordKey, salt);
            
            const decryptedContent = await crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                aesKey,
                encryptedBytes
            );
            
            return decoder.decode(decryptedContent);
        } catch (e) {
            throw new Error("Ошибка расшифровки: неверный ключ или данные повреждены.");
        }
    }
};