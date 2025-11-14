// bot_29-main/static/js/admin_notifications.js
import { fetchData } from './admin_api.js';
import { saveAllSettings } from './admin_recording.js'; // Импортируем общую функцию сохранения

let notificationsForm;

async function loadNotificationSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        const checkboxes = notificationsForm.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (settings.hasOwnProperty(checkbox.name)) {
                checkbox.checked = settings[checkbox.name];
            }
        });

        document.querySelector('input[name="dialog_delivery_method"][value="file"]').checked = settings.notify_on_dialog_as_file;
        document.querySelector('input[name="dialog_delivery_method"][value="message"]').checked = settings.notify_on_dialog_as_message;
        
        document.querySelector('input[name="summary_delivery_method"][value="file"]').checked = settings.notify_on_summary_as_file;
        document.querySelector('input[name="summary_delivery_method"][value="message"]').checked = settings.notify_on_summary_as_message;
    }
}

export function initNotifications() {
    notificationsForm = document.getElementById('notifications-form');
    const saveNotificationsBtn = document.getElementById('save-notification-settings');
    
    // ИСПРАВЛЕНИЕ: Кнопка теперь вызывает общую функцию сохранения
    saveNotificationsBtn.addEventListener('click', () => saveAllSettings('settings-saved-indicator'));

    // Загружаем настройки при инициализации
    const navLink = document.querySelector('a[href="#notifications"]');
    navLink.addEventListener('click', loadNotificationSettings);

    if (window.location.hash === '#notifications') {
        loadNotificationSettings();
    }
}