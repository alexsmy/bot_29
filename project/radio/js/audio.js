let audioContext = null;
let analyser = null;
let audioSource = null;
let gainNode = null;
let boundMediaElement = null;
let graphConnected = false;
let resumePromise = null;

function getAudioContextClass() {
    return window.AudioContext || window.webkitAudioContext || null;
}

function getOrCreateContext() {
    if (audioContext && audioContext.state !== "closed") {
        return audioContext;
    }

    const AudioContextClass = getAudioContextClass();
    if (!AudioContextClass) {
        return null;
    }

    audioContext = new AudioContextClass();
    return audioContext;
}

function safeDisconnect(node) {
    if (!node || typeof node.disconnect !== "function") {
        return;
    }

    try {
        node.disconnect();
    } catch (error) {
        // Safari may throw when disconnecting a node that is already detached.
    }
}

function ensureAnalyser(context) {
    if (!analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.45;
    }

    return analyser;
}

function ensureGainNode(context) {
    if (!gainNode) {
        gainNode = context.createGain();
        gainNode.gain.value = 1;
    }

    return gainNode;
}

function connectGraph(radioPlayer) {
    const context = getOrCreateContext();

    if (!context || !radioPlayer) {
        return { audioContext: null, analyser: null, gainNode: null };
    }

    if (boundMediaElement !== radioPlayer) {
        safeDisconnect(audioSource);
        safeDisconnect(gainNode);
        safeDisconnect(analyser);

        audioSource = null;
        analyser = null;
        gainNode = null;
        graphConnected = false;
        boundMediaElement = radioPlayer;
    }

    if (!audioSource) {
        try {
            radioPlayer.crossOrigin = "anonymous";
        } catch (error) {
            // Some browsers expose crossOrigin as read-only at runtime in strict contexts.
        }

        if (!radioPlayer.preload || radioPlayer.preload === "auto") {
            radioPlayer.preload = "metadata";
        }

        audioSource = context.createMediaElementSource(radioPlayer);
    }

    const analyserNode = ensureAnalyser(context);
    const outputGain = ensureGainNode(context);

    if (!graphConnected) {
        try {
            audioSource.connect(outputGain);
            outputGain.connect(analyserNode);
            analyserNode.connect(context.destination);
            graphConnected = true;
        } catch (error) {
            console.error("Ошибка подключения Web Audio графа:", error);
        }
    }

    return { audioContext: context, analyser: analyserNode, gainNode: outputGain };
}

function syncVolumeToGain(radioPlayer) {
    if (!gainNode || !radioPlayer) {
        return;
    }

    const volume = Number(radioPlayer.volume);
    const safeVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    gainNode.gain.value = radioPlayer.muted ? 0 : safeVolume;
}

async function ensureContextRunning() {
    const context = getOrCreateContext();
    if (!context) {
        return null;
    }

    if (context.state === "suspended") {
        if (!resumePromise) {
            resumePromise = context.resume().catch((error) => {
                console.warn("AudioContext resume failed:", error);
                throw error;
            }).finally(() => {
                resumePromise = null;
            });
        }

        await resumePromise;
    }

    return context;
}

function waitForMediaReady(mediaElement, timeoutMs = 2200) {
    if (!mediaElement) {
        return Promise.resolve();
    }

    if (typeof HTMLMediaElement !== "undefined" && mediaElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        let settled = false;

        const finish = () => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            resolve();
        };

        const cleanup = () => {
            mediaElement.removeEventListener("loadedmetadata", onReady);
            mediaElement.removeEventListener("loadeddata", onReady);
            mediaElement.removeEventListener("canplay", onReady);
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };

        const onReady = () => {
            finish();
        };

        mediaElement.addEventListener("loadedmetadata", onReady, { once: true });
        mediaElement.addEventListener("loadeddata", onReady, { once: true });
        mediaElement.addEventListener("canplay", onReady, { once: true });

        const timeoutId = window.setTimeout(() => {
            finish();
        }, timeoutMs);
    });
}

export function setupAudioAnalyser(radioPlayer) {
    const graph = connectGraph(radioPlayer);
    syncVolumeToGain(radioPlayer);
    return graph;
}

export function unlockAudioContext() {
    const context = getOrCreateContext();
    if (context && context.state === "suspended") {
        context.resume().catch((error) => {
            console.warn("Unlock failed:", error);
        });
    }
}

export function getAudioContext() {
    return audioContext;
}

export function getAnalyser() {
    return analyser;
}

export function getGainNode() {
    return gainNode;
}

export function setPlaybackVolume(volume, muted = false) {
    if (!gainNode) {
        return;
    }

    const safeVolume = Number.isFinite(Number(volume)) ? Math.min(1, Math.max(0, Number(volume))) : 1;
    gainNode.gain.value = muted ? 0 : safeVolume;
}

export function resumeAudioContext() {
    return ensureContextRunning();
}

export { waitForMediaReady, syncVolumeToGain };
