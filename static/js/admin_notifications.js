// static/js/admin_notifications.js

// Этот модуль отвечает за логику раздела "Уведомления".

import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, notificationCheckboxes;

async function loadNotificationSettings() {
    const settings = await fetchData('notification_settings');
    if (settings) {
        notificationCheckboxes.forEach(checkbox => {
            checkbox.checked = settings[checkbox.name] || false;
        });
    }
}

async function saveNotificationSettings() {
    const payload = {};
    notificationCheckboxes.forEach(checkbox => {
        payload[checkbox.name] = checkbox.checked;
    });

    const result = await fetchData('notification_settings', {
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
    notificationCheckboxes = document.querySelectorAll('.notification-settings-form input[type="checkbox"]');

    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    loadNotificationSettings();
}