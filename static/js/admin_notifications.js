import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, notificationCheckboxes, notificationRadios;

async function loadNotificationSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        // Загружаем чекбоксы
        notificationCheckboxes.forEach(checkbox => {
            if (settings.hasOwnProperty(checkbox.name)) {
                checkbox.checked = settings[checkbox.name];
            }
        });

        // Загружаем радио-кнопки
        notificationRadios.forEach(radio => {
            if (settings.hasOwnProperty(radio.name) && settings[radio.name] === radio.value) {
                radio.checked = true;
            }
        });
    }
}

async function saveNotificationSettings() {
    const currentSettings = await fetchData('admin_settings');
    if (!currentSettings) {
        alert('Не удалось загрузить текущие настройки. Сохранение отменено.');
        return;
    }

    const payload = { ...currentSettings };
    
    // Собираем значения чекбоксов
    notificationCheckboxes.forEach(checkbox => {
        payload[checkbox.name] = checkbox.checked;
    });

    // Собираем значения радио-кнопок
    // Сначала находим уникальные имена групп радио-кнопок
    const radioNames = new Set();
    notificationRadios.forEach(r => radioNames.add(r.name));
    
    radioNames.forEach(name => {
        const selected = document.querySelector(`input[name="${name}"]:checked`);
        if (selected) {
            payload[name] = selected.value;
        }
    });

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
    notificationCheckboxes = document.querySelectorAll('#notifications input[type="checkbox"]');
    notificationRadios = document.querySelectorAll('#notifications input[type="radio"]');

    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    loadNotificationSettings();
}