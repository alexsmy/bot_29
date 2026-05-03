/**
 * Модуль для работы с серверным API (Облаком)
 */
import { showToast } from './notifications.js';

// Путь к нашему PHP скрипту. Если он лежит в корне, оставляем так.
const API_URL = './api.php'; 

export const CloudManager = {
    /**
     * Отправляет зашифрованные данные на сервер
     * @param {string} encryptedData - Base64 строка
     * @returns {Promise<string|null>} - Возвращает ID файла или null при ошибке
     */
    async saveToCloud(encryptedData) {
        try {
            const response = await fetch(`${API_URL}?action=save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain'
                },
                body: encryptedData
            });

            const result = await response.json();
            
            if (result.success) {
                return result.id;
            } else {
                throw new Error(result.error || 'Неизвестная ошибка сервера');
            }
        } catch (error) {
            console.error('Cloud Save Error:', error);
            showToast("Ошибка сохранения в облако: " + error.message, "error");
            return null;
        }
    },

    /**
     * Загружает зашифрованные данные с сервера по ID
     * @param {string} id - 8-значный идентификатор
     * @returns {Promise<string|null>} - Возвращает зашифрованную строку или null
     */
    async loadFromCloud(id) {
        try {
            const response = await fetch(`${API_URL}?action=load&id=${encodeURIComponent(id)}`, {
                method: 'GET'
            });

            const result = await response.json();
            
            if (result.success) {
                return result.data;
            } else {
                throw new Error(result.error || 'Файл не найден');
            }
        } catch (error) {
            console.error('Cloud Load Error:', error);
            showToast("Ошибка загрузки из облака: " + error.message, "error");
            return null;
        }
    }
};