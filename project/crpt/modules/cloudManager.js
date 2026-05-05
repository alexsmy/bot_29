import { showToast } from './notifications.js';

// Изменен путь к новому Python API
const API_URL = '/api/crpt';

export const CloudManager = {

    async saveToCloud(encryptedData) {
        try {
            const response = await fetch(`${API_URL}/save`, {
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

    async loadFromCloud(id) {
        try {
            const response = await fetch(`${API_URL}/load?id=${encodeURIComponent(id)}`, {
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