import { fetchData } from './admin_api.js';

let saveNotificationsBtn, savedIndicator, form;

async function loadNotificationSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = settings[checkbox.name] || false;
        });
        form.querySelectorAll('.format-toggle').forEach(toggle => {
            const key = toggle.dataset.key;
            const value = settings[key] || 'file';
            toggle.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.value === value);
            });
        });
    }
}

async function saveNotificationSettings() {
    const payload = {};
    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        payload[checkbox.name] = checkbox.checked;
    });
    form.querySelectorAll('.format-toggle').forEach(toggle => {
        const key = toggle.dataset.key;
        const activeButton = toggle.querySelector('button.active');
        payload[key] = activeButton ? activeButton.dataset.value : 'file';
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
    form = document.getElementById('notifications-form');
    saveNotificationsBtn = document.getElementById('save-notification-settings');
    savedIndicator = document.getElementById('settings-saved-indicator');

    saveNotificationsBtn.addEventListener('click', saveNotificationSettings);

    form.addEventListener('click', (e) => {
        const button = e.target.closest('.format-toggle button');
        if (button) {
            const parent = button.parentElement;
            parent.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
        }
    });

    loadNotificationSettings();
}