import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, notificationsForm;

async function loadNotificationSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        // Устанавливаем значения для всех checkbox
        const checkboxes = notificationsForm.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (settings.hasOwnProperty(checkbox.name)) {
                checkbox.checked = settings[checkbox.name];
            }
        });

        // Устанавливаем значения для radio-кнопок
        document.querySelector('input[name="dialog_delivery_method"][value="file"]').checked = settings.notify_on_dialog_as_file;
        document.querySelector('input[name="dialog_delivery_method"][value="message"]').checked = settings.notify_on_dialog_as_message;
        
        document.querySelector('input[name="summary_delivery_method"][value="file"]').checked = settings.notify_on_summary_as_file;
        document.querySelector('input[name="summary_delivery_method"][value="message"]').checked = settings.notify_on_summary_as_message;
    }
}

// ИСПРАВЛЕНИЕ: Логика сохранения полностью переписана для корректной отправки всех полей
async function saveNotificationSettings() {
    // 1. Создаем новый объект payload, который будет содержать все ключи, ожидаемые Pydantic моделью.
    const payload = {
        notify_on_room_creation: document.querySelector('input[name="notify_on_room_creation"]').checked,
        notify_on_call_start: document.querySelector('input[name="notify_on_call_start"]').checked,
        notify_on_call_end: document.querySelector('input[name="notify_on_call_end"]').checked,
        send_connection_report: document.querySelector('input[name="send_connection_report"]').checked,
        notify_on_connection_details: document.querySelector('input[name="notify_on_connection_details"]').checked,
        notify_on_audio_record: document.querySelector('input[name="notify_on_audio_record"]').checked,
        // Эти поля будут перезаписаны ниже, но мы их инициализируем для полноты
        notify_on_dialog_as_file: false,
        notify_on_dialog_as_message: false,
        notify_on_summary_as_file: false,
        notify_on_summary_as_message: false,
        // Поле для записи звонков, которое не относится к уведомлениям, но является частью настроек
        enable_call_recording: document.querySelector('#recording input[name="enable_call_recording"]').checked
    };

    // 2. Определяем и записываем значения для radio-кнопок диалога
    const dialogMethod = document.querySelector('input[name="dialog_delivery_method"]:checked').value;
    payload.notify_on_dialog_as_file = (dialogMethod === 'file');
    payload.notify_on_dialog_as_message = (dialogMethod === 'message');

    // 3. Определяем и записываем значения для radio-кнопок саммари
    const summaryMethod = document.querySelector('input[name="summary_delivery_method"]:checked').value;
    payload.notify_on_summary_as_file = (summaryMethod === 'file');
    payload.notify_on_summary_as_message = (summaryMethod === 'message');

    // 4. Отправляем на сервер полностью сформированный объект
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
    notificationsForm = document.getElementById('notifications-form');
    saveNotificationsBtn = document.getElementById('save-notification-settings');
    savedIndicator = document.getElementById('settings-saved-indicator');
    
    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    // Загружаем настройки при инициализации
    loadNotificationSettings();
}