import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, notificationCheckboxes;

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

async function saveNotificationSettings() {
    const currentSettings = await fetchData('admin_settings');
    if (!currentSettings) {
        alert('Не удалось загрузить текущие настройки. Сохранение отменено.');
        return;
    }

    const payload = {
        ...currentSettings
    };

    notificationCheckboxes.forEach(checkbox => {
        if (payload.hasOwnProperty(checkbox.name)) {
            payload[checkbox.name] = checkbox.checked;
        }
    });

    const dialogMethod = document.querySelector('input[name="dialog_delivery_method"]:checked').value;
    payload.notify_on_dialog_as_file = dialogMethod === 'file';
    payload.notify_on_dialog_as_message = dialogMethod === 'message';

    const summaryMethod = document.querySelector('input[name="summary_delivery_method"]:checked').value;
    payload.notify_on_summary_as_file = summaryMethod === 'file';
    payload.notify_on_summary_as_message = summaryMethod === 'message';

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
    notificationCheckboxes = document.querySelectorAll('#notifications-form input[type="checkbox"]');

    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    loadNotificationSettings();
}