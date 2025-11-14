import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, notificationCheckboxes, dialogRadioButtons, summaryRadioButtons;

async function loadNotificationSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        notificationCheckboxes.forEach(checkbox => {
            checkbox.checked = settings[checkbox.name] || false;
        });

        document.querySelector('input[name="dialog_delivery_method"][value="file"]').checked = settings.notify_on_dialog_as_file;
        document.querySelector('input[name="dialog_delivery_method"][value="message"]').checked = settings.notify_on_dialog_as_message;
        
        document.querySelector('input[name="summary_delivery_method"][value="file"]').checked = settings.notify_on_summary_as_file;
        document.querySelector('input[name="summary_delivery_method"][value="message"]').checked = settings.notify_on_summary_as_message;
    }
}

// ИСПРАВЛЕНИЕ: Логика сохранения полностью переписана
async function saveNotificationSettings() {
    // 1. Создаем новый пустой объект для настроек
    const payload = {};

    // 2. Заполняем его значениями из всех чекбоксов
    notificationCheckboxes.forEach(checkbox => {
        payload[checkbox.name] = checkbox.checked;
    });

    // 3. Определяем и записываем значения для radio-кнопок диалога
    const dialogMethod = document.querySelector('input[name="dialog_delivery_method"]:checked').value;
    payload.notify_on_dialog_as_file = dialogMethod === 'file';
    payload.notify_on_dialog_as_message = dialogMethod === 'message';

    // 4. Определяем и записываем значения для radio-кнопок саммари
    const summaryMethod = document.querySelector('input[name="summary_delivery_method"]:checked').value;
    payload.notify_on_summary_as_file = summaryMethod === 'file';
    payload.notify_on_summary_as_message = summaryMethod === 'message';

    // 5. Отправляем на сервер полностью сформированный объект
    const result = await fetchData('admin_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (result && result.status === 'ok') {
        savedIndicator.classList.add('visible');
        setTimeout(() => savedIndicator.classList.remove('visible'), 2000);
    } else {
        alert('Не удалось сохранить настройки.');
    }
}

export function initNotifications() {
    saveNotificationsBtn = document.getElementById('save-notification-settings');
    savedIndicator = document.getElementById('settings-saved-indicator');
    // Исключаем radio-кнопки из этого списка
    notificationCheckboxes = document.querySelectorAll('#notifications-form input[type="checkbox"]');
    dialogRadioButtons = document.querySelectorAll('input[name="dialog_delivery_method"]');
    summaryRadioButtons = document.querySelectorAll('input[name="summary_delivery_method"]');


    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    loadNotificationSettings();
}