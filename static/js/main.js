import * as orchestrator from './call_orchestrator.js';

function loadIcons() {
    const iconPlaceholders = document.querySelectorAll('[data-icon-name]');
    if (typeof ICONS === 'undefined') {
        console.error('icons.js is not loaded or ICONS object is not defined.');
        return;
    }
    iconPlaceholders.forEach(placeholder => {
        const iconName = placeholder.dataset.iconName;
        if (ICONS[iconName]) {
            placeholder.innerHTML = ICONS[iconName];
        } else {
            console.warn(`Icon with name "${iconName}" not found.`);
        }
    });
}

async function main() {
    loadIcons();
    const path = window.location.pathname;
    console.log(`App loaded. Path: ${path}`);

    if (!path.startsWith('/call/')) {
        document.body.innerHTML = "<h1>Неверный URL</h1>";
        return;
    }
    
    const roomId = path.split('/')[2];
    let rtcConfig = null;
    let iceServerDetails = {};
    let recordingSettings = { is_enabled: false, audio_bitrate: 16000 };

    try {
        // ИСПРАВЛЕНИЕ: Запрашиваем /api/recording/settings вместо /api/recording/status
        const [iceResponse, recordingResponse] = await Promise.all([
            fetch('/api/ice-servers'),
            fetch('/api/recording/settings')
        ]);

        if (!iceResponse.ok) throw new Error(`Server responded with status ${iceResponse.status} for ICE servers`);
        const servers = await iceResponse.json();
        const peerConnectionConfig = servers.map(s => ({
            urls: s.urls,
            username: s.username,
            credential: s.credential
        }));
        rtcConfig = { iceServers: peerConnectionConfig, iceCandidatePoolSize: 10 };
        servers.forEach(s => {
            let provider = 'Unknown';
            if (s.source) {
                try { provider = new URL(s.source).hostname.replace(/^www\./, ''); } 
                catch (e) { provider = s.source; }
            } else if (s.provider) {
                provider = s.provider;
            }
            iceServerDetails[s.urls] = { region: s.region || 'global', provider: provider };
        });
        console.log("ICE servers configuration loaded.");

        if (recordingResponse.ok) {
            // ИСПРАВЛЕНИЕ: Обрабатываем новый формат ответа
            recordingSettings = await recordingResponse.json();
            console.log(`Call recording is ${recordingSettings.is_enabled ? 'ENABLED' : 'DISABLED'} with bitrate ${recordingSettings.audio_bitrate}.`);
        }

    } catch (error) {
        console.error(`[CRITICAL] Failed to fetch initial config: ${error.message}.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        };
    }

    // ИСПРАВЛЕНИЕ: Передаем весь объект с настройками записи
    orchestrator.initialize(roomId, rtcConfig, iceServerDetails, recordingSettings);
}

document.addEventListener('DOMContentLoaded', main);