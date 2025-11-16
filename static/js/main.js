import * as orchestrator from './call_orchestrator.js';
// --- ИЗМЕНЕНИЕ: Импортируем наш новый логгер ---
import * as logger from './call_logger.js';

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
    
    if (!path.startsWith('/call/')) {
        document.body.innerHTML = "<h1>Неверный URL</h1>";
        return;
    }
    
    const roomId = path.split('/')[2];
    // --- ИЗМЕНЕНИЕ: Инициализируем логгер сразу с ID комнаты ---
    logger.init(roomId);
    logger.log('APP_LIFECYCLE', `App loaded. Path: ${path}`);

    let rtcConfig = null;
    let iceServerDetails = {};
    let isRecordingEnabled = false;

    try {
        const [iceResponse, recordingResponse] = await Promise.all([
            fetch('/api/ice-servers'),
            fetch('/api/recording/status')
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
        logger.log('APP_LIFECYCLE', "ICE servers configuration loaded.");

        if (recordingResponse.ok) {
            const recordingStatus = await recordingResponse.json();
            isRecordingEnabled = recordingStatus.is_enabled;
            logger.log('APP_LIFECYCLE', `Call recording is ${isRecordingEnabled ? 'ENABLED' : 'DISABLED'}.`);
        }

    } catch (error) {
        logger.log('CRITICAL_ERROR', `Failed to fetch initial config: ${error.message}.`);
        alert("Не удалось загрузить конфигурацию сети. Качество звонка может быть низким.");
        rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        };
    }

    orchestrator.initialize(roomId, rtcConfig, iceServerDetails, isRecordingEnabled);
}

document.addEventListener('DOMContentLoaded', main);