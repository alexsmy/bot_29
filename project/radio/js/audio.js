let audioContext = null;
let analyser = null;
let audioSource = null;
let attachedMediaElement = null;
let attachPromise = null;

function getOrCreateContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }
    return audioContext;
}

function isIosWebKit() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";

    return /iPad|iPhone|iPod/.test(ua) ||
        (platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function canAttachMediaElement(radioPlayer) {
    if (!radioPlayer) {
        return false;
    }

    if (!radioPlayer.crossOrigin) {
        radioPlayer.crossOrigin = "anonymous";
    }

    return true;
}

function attachMediaElementSource(radioPlayer) {
    const context = getOrCreateContext();

    if (!context || !analyser || !radioPlayer) {
        return false;
    }

    if (audioSource && attachedMediaElement === radioPlayer) {
        return true;
    }

    try {
        audioSource = context.createMediaElementSource(radioPlayer);
        audioSource.connect(analyser);
        analyser.connect(context.destination);
        attachedMediaElement = radioPlayer;
        return true;
    } catch (error) {
        console.error("Ошибка подключения MediaElementSource:", error);
        audioSource = null;
        attachedMediaElement = null;
        return false;
    }
}

function waitForCanPlayAndAttach(radioPlayer) {
    if (attachPromise) {
        return attachPromise;
    }

    attachPromise = new Promise((resolve) => {
        const finish = () => {
            if (radioPlayer) {
                radioPlayer.removeEventListener("canplay", onReady);
                radioPlayer.removeEventListener("loadeddata", onReady);
                radioPlayer.removeEventListener("playing", onReady);
            }

            const ok = attachMediaElementSource(radioPlayer);
            attachPromise = null;
            resolve(ok);
        };

        const onReady = () => {
            finish();
        };

        if (!radioPlayer) {
            attachPromise = null;
            resolve(false);
            return;
        }

        const readyState = typeof radioPlayer.readyState === "number" ? radioPlayer.readyState : 0;
        if (readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            finish();
            return;
        }

        radioPlayer.addEventListener("canplay", onReady, { once: true });
        radioPlayer.addEventListener("loadeddata", onReady, { once: true });
        radioPlayer.addEventListener("playing", onReady, { once: true });
    });

    return attachPromise;
}

export function setupAudioAnalyser(radioPlayer) {
    const context = getOrCreateContext();

    if (!context) {
        return { audioContext: null, analyser: null, ready: Promise.resolve(false) };
    }

    if (context.state === "suspended" || context.state === "interrupted") {
        context.resume().catch(e => console.warn("AudioContext resume failed:", e));
    }

    if (!analyser) {
        analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.4;
    }

    let ready = Promise.resolve(true);

    if (canAttachMediaElement(radioPlayer)) {
        if (isIosWebKit()) {
            ready = waitForCanPlayAndAttach(radioPlayer);
        } else {
            ready = Promise.resolve(attachMediaElementSource(radioPlayer));
        }
    }

    return {
        audioContext: context,
        analyser,
        ready
    };
}

export function unlockAudioContext() {
    const context = getOrCreateContext();
    if (context && (context.state === "suspended" || context.state === "interrupted")) {
        context.resume().catch((e) => {
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
    if (audioContext && (audioContext.state === "suspended" || audioContext.state === "interrupted")) {
        return audioContext.resume();
    }
    return Promise.resolve();
}