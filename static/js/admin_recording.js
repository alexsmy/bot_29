import { fetchData } from './admin_api.js';

let saveRecordingBtn, savedIndicator, recordingCheckbox;

async function loadRecordingSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        recordingCheckbox.checked = settings['enable_call_recording'] || false;
    }
}

async function saveRecordingSettings() {
    const currentSettings = await fetchData('admin_settings');
    if (!currentSettings) {
        alert('Не удалось загрузить текущие настройки. Сохранение отменено.');
        return;
    }

    const payload = {
        ...currentSettings,
        enable_call_recording: recordingCheckbox.checked
    };

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

export function initRecording() {
    saveRecordingBtn = document.getElementById('save-recording-settings');
    savedIndicator = document.getElementById('recording-saved-indicator');
    recordingCheckbox = document.querySelector('#recording input[name="enable_call_recording"]');

    saveRecordingBtn.addEventListener('click', saveRecordingSettings);

    loadRecordingSettings();
}