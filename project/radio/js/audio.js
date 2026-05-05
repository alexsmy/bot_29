let audioContext = null;
let analyser = null;
let audioSource = null;

// Функция для создания или получения существующего контекста
// Важно для iOS: использовать webkitAudioContext если AudioContext недоступен
function getOrCreateContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }
    return audioContext;
}

export function setupAudioAnalyser(radioPlayer) {
    const context = getOrCreateContext();
    
    if (!context) return { audioContext: null, analyser: null };

    // Всегда пытаемся возобновить контекст, если он приостановлен (требование iOS)
    if (context.state === "suspended") {
        context.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }

    if (!analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
    }

    // ВАЖНО: Создаем MediaElementSource только один раз для одного элемента audio.
    // Повторное создание вызовет ошибку.
    if (!audioSource && radioPlayer) {
        try {
            audioSource = context.createMediaElementSource(radioPlayer);
            audioSource.connect(analyser);
            analyser.connect(context.destination);
        } catch (error) {
            console.error("Ошибка подключения MediaElementSource:", error);
        }
    }

    return { audioContext: context, analyser };
}

// Функция "прогрева" для iOS. Вызывается при первом клике по странице.
export function unlockAudioContext() {
    const context = getOrCreateContext();
    if (context && context.state === "suspended") {
        context.resume().then(() => {
            // console.log("AudioContext unlocked/resumed");
        }).catch(e => {
            console.warn("Unlock failed:", e);
        });
    }
}

export function getAudioContext() {
    return audioContext;
}

export function getAnalyser() {
    return analyser;
}

export function resumeAudioContext() {
    if (audioContext && audioContext.state === "suspended") {
        return audioContext.resume();
    }
    return Promise.resolve();
}