import { fetchData } from './admin_api.js';

let saveRecordingBtn, savedIndicator, form;
let enableTranscriptionCheckbox, enableDialogueCheckbox, enableSummaryCheckbox;

function updateDependencies() {
    const isTranscriptionEnabled = enableTranscriptionCheckbox.checked;
    
    enableDialogueCheckbox.disabled = !isTranscriptionEnabled;
    enableSummaryCheckbox.disabled = !isTranscriptionEnabled;

    // Визуально "серим" зависимые элементы
    enableDialogueCheckbox.closest('.setting-item').style.opacity = isTranscriptionEnabled ? '1' : '0.5';
    enableSummaryCheckbox.closest('.setting-item').style.opacity = isTranscriptionEnabled ? '1' : '0.5';

    if (!isTranscriptionEnabled) {
        enableDialogueCheckbox.checked = false;
        enableSummaryCheckbox.checked = false;
    }
}

async function loadRecordingSettings() {
    const settings = await fetchData('admin_settings');
    if (settings) {
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            if (settings.hasOwnProperty(checkbox.name)) {
                checkbox.checked = settings[checkbox.name];
            }
        });
        form.querySelector('select[name="audio_bitrate"]').value = settings['audio_bitrate'] || '16';
        updateDependencies();
    }
}

async function saveRecordingSettings() {
    const currentSettings = await fetchData('admin_settings');
    if (!currentSettings) {
        alert('Не удалось загрузить текущие настройки. Сохранение отменено.');
        return;
    }

    const payload = { ...currentSettings };

    form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        payload[checkbox.name] = checkbox.checked;
    });
    payload['audio_bitrate'] = parseInt(form.querySelector('select[name="audio_bitrate"]').value, 10);

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
    form = document.getElementById('recording-form');
    saveRecordingBtn = document.getElementById('save-recording-settings');
    savedIndicator = document.getElementById('recording-saved-indicator');
    
    enableTranscriptionCheckbox = form.querySelector('input[name="enable_transcription"]');
    enableDialogueCheckbox = form.querySelector('input[name="enable_dialogue_creation"]');
    enableSummaryCheckbox = form.querySelector('input[name="enable_summary_creation"]');

    enableTranscriptionCheckbox.addEventListener('change', updateDependencies);

    saveRecordingBtn.addEventListener('click', saveRecordingSettings);

    loadRecordingSettings();
}