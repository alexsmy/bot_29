import { fetchData } from './admin_api.js';

// ИСПРАВЛЕНИЕ: Создаем одну универсальную функцию для сохранения всех настроек
export async function saveAllSettings(indicatorId) {
    const indicator = document.getElementById(indicatorId);

    const payload = {
        // Вкладка "Уведомления"
        notify_on_room_creation: document.querySelector('input[name="notify_on_room_creation"]').checked,
        notify_on_call_start: document.querySelector('input[name="notify_on_call_start"]').checked,
        notify_on_call_end: document.querySelector('input[name="notify_on_call_end"]').checked,
        send_connection_report: document.querySelector('input[name="send_connection_report"]').checked,
        notify_on_connection_details: document.querySelector('input[name="notify_on_connection_details"]').checked,
        notify_on_audio_record: document.querySelector('input[name="notify_on_audio_record"]').checked,
        
        // Вкладка "Запись звонков"
        enable_call_recording: document.querySelector('#recording input[name="enable_call_recording"]').checked
    };

    const dialogMethod = document.querySelector('input[name="dialog_delivery_method"]:checked').value;
    payload.notify_on_dialog_as_file = (dialogMethod === 'file');
    payload.notify_on_dialog_as_message = (dialogMethod === 'message');

    const summaryMethod = document.querySelector('input[name="summary_delivery_method"]:checked').value;
    payload.notify_on_summary_as_file = (summaryMethod === 'file');
    payload.notify_on_summary_as_message = (summaryMethod === 'message');

    const result = await fetchData('admin_settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (result && result.status === 'ok') {
        indicator.classList.add('visible');
        setTimeout(() => indicator.classList.remove('visible'), 2000);
    } else {
        alert('Не удалось сохранить настройки.');
    }
}


async function loadRecordingSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        const recordingCheckbox = document.querySelector('#recording input[name="enable_call_recording"]');
        if (recordingCheckbox) {
            recordingCheckbox.checked = settings['enable_call_recording'] || false;
        }
    }
}

export function initRecording() {
    const saveRecordingBtn = document.getElementById('save-recording-settings');

    // ИСПРАВЛЕНИЕ: Кнопка теперь вызывает общую функцию сохранения
    saveRecordingBtn.addEventListener('click', () => saveAllSettings('recording-saved-indicator'));

    const navLink = document.querySelector('a[href="#recording"]');
    navLink.addEventListener('click', loadRecordingSettings);

    if (window.location.hash === '#recording') {
        loadRecordingSettings();
    }
}