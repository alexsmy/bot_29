let audioContext = null;
let analyser = null;
let audioSource = null;
let attachedMediaElement = null;

function getOrCreateContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }
    return audioContext;
}

function connectGraph(radioPlayer) {
    const context = getOrCreateContext();

    if (!context || !radioPlayer) {
        return { audioContext: null, analyser: null };
    }

    if (context.state === "suspended") {
        context.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }

    if (!analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.42;
    }

    if (attachedMediaElement !== radioPlayer) {
        if (audioSource) {
            try {
                audioSource.disconnect();
            } catch (error) {
                console.warn("Не удалось отключить старый audioSource:", error);
            }
            audioSource = null;
        }

        attachedMediaElement = radioPlayer;
    }

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

export function setupAudioAnalyser(radioPlayer) {
    return connectGraph(radioPlayer);
}

export function unlockAudioContext() {
    const context = getOrCreateContext();
    if (context && context.state === "suspended") {
        context.resume().then(() => {
            // intentionally empty
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

export function prepareAudioContextForElement(radioPlayer) {
    if (!radioPlayer) return;
    radioPlayer.crossOrigin = "anonymous";
    radioPlayer.preload = "none";
    radioPlayer.setAttribute("playsinline", "true");
    radioPlayer.setAttribute("webkit-playsinline", "true");
}

export async function rebuildAudioAnalyser(radioPlayer) {
    const previousContext = audioContext;

    try {
        if (audioSource) {
            audioSource.disconnect();
        }
    } catch (error) {
        console.warn("Не удалось отключить audioSource перед пересборкой:", error);
    }

    try {
        if (analyser) {
            analyser.disconnect();
        }
    } catch (error) {
        console.warn("Не удалось отключить analyser перед пересборкой:", error);
    }

    audioSource = null;
    analyser = null;
    attachedMediaElement = null;

    if (previousContext && previousContext.state !== "closed") {
        try {
            await previousContext.close();
        } catch (error) {
            console.warn("Не удалось закрыть старый AudioContext:", error);
        }
    }

    audioContext = null;
    return setupAudioAnalyser(radioPlayer);
}
