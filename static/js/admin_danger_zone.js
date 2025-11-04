// static/js/admin_danger_zone.js

// Этот модуль отвечает за логику "Опасной зоны".

import { fetchData } from './admin_api.js';

export function initDangerZone() {
    // Кнопка для TRUNCATE (очистка данных)
    document.getElementById('wipe-db-btn').addEventListener('click', async () => {
        if (confirm('ВЫ УВЕРЕНЕНЫ, ЧТО ХОТИТЕ ОЧИСТИТЬ ВСЕ ДАННЫЕ В ТАБЛИЦАХ?\n\nЭто действие удалит всех пользователей, сессии и логи, но сохранит структуру базы данных.')) {
            const result = await fetchData('database', { method: 'DELETE' });
            if (result?.status === 'database cleared successfully') {
                alert('Данные базы данных очищены. Страница будет перезагружена.');
                window.location.reload();
            } else {
                alert('Произошла ошибка при очистке данных.');
            }
        }
    });

    // Блок для DROP (полное удаление таблиц)
    document.getElementById('drop-db-btn').addEventListener('click', async () => {
        if (!confirm('ВЫ УВЕРЕНЕНЫ, ЧТО ХОТИТЕ ПОЛНОСТЬЮ УДАЛИТЬ ВСЕ ТАБЛИЦЫ В БД?\n\nЭто необратимое действие. Приложение перестанет работать до следующего перезапуска. Использовать только для исправления схемы БД.')) {
            return;
        }

        // 1. Запрашиваем код подтверждения
        const requestResult = await fetchData('database/request-wipe-code', { method: 'POST' });
        if (requestResult?.status !== 'code_sent') {
            alert('Не удалось отправить код подтверждения. Проверьте логи сервера.');
            return;
        }

        // 2. Запрашиваем код у пользователя
        const code = prompt('Код подтверждения был отправлен вам в Telegram. Введите его для полного удаления базы данных (код действителен 2 минуты):');
        if (!code) {
            alert('Операция отменена.');
            return;
        }

        // 3. Отправляем запрос на удаление с кодом
        try {
            // --- ИЗМЕНЕНИЕ: Используем правильную глобальную переменную ---
            const wipeResult = await fetch(`/api/admin/database/wipe-with-code?token=${window.ADMIN_API_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code.trim() })
            });

            const resultJson = await wipeResult.json();

            if (wipeResult.ok && resultJson.status === 'database_dropped') {
                alert('База данных успешно удалена. Приложение сейчас может работать нестабильно. Пожалуйста, перезапустите сервер (сделайте Redeploy), чтобы пересоздать базу данных с новой схемой.');
                // Не перезагружаем страницу, так как она все равно будет выдавать ошибки до рестарта сервера
            } else {
                alert(`Ошибка: ${resultJson.detail || 'Неверный код или истек срок его действия.'}`);
            }
        } catch (error) {
            console.error('Fetch error for wipe-with-code:', error);
            alert('Произошла сетевая ошибка при попытке удаления базы данных.');
        }
    });
}