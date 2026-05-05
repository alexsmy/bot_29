import { isLikelyIOSSafari } from "./proxy.js";

const DEFAULT_STATE = "idle";

function getAverageAbsDeviation(timeDomainData) {
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
        sum += Math.abs(timeDomainData[i] - 128);
    }
    return sum / timeDomainData.length;
}

function getAverageFrequencyEnergy(frequencyData) {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i];
    }
    return sum / frequencyData.length;
}

export function createEqualizerDiagnostics({
    radioPlayer,
    getAnalyser,
    getAudioContext,
    onRecoveryNeeded
}) {
    const root = document.documentElement;
    let rafId = null;
    let active = false;
    let warned = false;
    let lastCurrentTime = 0;
    let silentFrames = 0;
    let sampleStartTime = 0;

    function setState(state, note = "") {
        root.dataset.equalizerState = state;
        root.dataset.equalizerNote = note;
    }

    function stopInternal(state = DEFAULT_STATE) {
        active = false;
        silentFrames = 0;
        lastCurrentTime = 0;
        sampleStartTime = 0;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (state) {
            setState(state);
        }
    }

    function analyzeFrame() {
        if (!active) {
            return;
        }

        const analyser = getAnalyser();
        const audioContext = getAudioContext();
        if (!analyser || !audioContext) {
            setState("waiting", "no-analyser");
            rafId = requestAnimationFrame(analyzeFrame);
            return;
        }

        if (radioPlayer.paused || radioPlayer.ended) {
            stopInternal("idle");
            return;
        }

        const timeDomainData = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteTimeDomainData(timeDomainData);
        analyser.getByteFrequencyData(frequencyData);

        const avgDeviation = getAverageAbsDeviation(timeDomainData);
        const avgEnergy = getAverageFrequencyEnergy(frequencyData);
        const currentTime = Number.isFinite(radioPlayer.currentTime) ? radioPlayer.currentTime : 0;

        if (!sampleStartTime) {
            sampleStartTime = performance.now();
        }

        const elapsed = performance.now() - sampleStartTime;
        const timeProgress = currentTime > lastCurrentTime + 0.01;

        if (timeProgress) {
            lastCurrentTime = currentTime;
        }

        const looksMuted = avgDeviation < 2.5 && avgEnergy < 2.5;
        if (looksMuted && timeProgress) {
            silentFrames += 1;
        } else if (!looksMuted) {
            silentFrames = 0;
            setState("active");
        }

        if (elapsed > 1600 && silentFrames >= 12) {
            const note = isLikelyIOSSafari()
                ? "ios-safari-silent-analyser"
                : "silent-analyser";

            setState("degraded", note);

            if (!warned) {
                warned = true;
                console.warn(
                    "[VibeRadio] Equalizer self-check detected silence while playback is advancing.",
                    {
                        note,
                        audioContextState: audioContext.state,
                        currentTime,
                        avgDeviation,
                        avgEnergy,
                        src: radioPlayer.currentSrc || radioPlayer.src
                    }
                );

                if (typeof onRecoveryNeeded === "function") {
                    onRecoveryNeeded({
                        reason: note,
                        currentTime,
                        src: radioPlayer.currentSrc || radioPlayer.src
                    });
                }
            }
        }

        if (elapsed < 1600 && looksMuted) {
            setState("checking", "sampling");
        }

        rafId = requestAnimationFrame(analyzeFrame);
    }

    function start() {
        active = true;
        warned = false;
        silentFrames = 0;
        lastCurrentTime = radioPlayer.currentTime || 0;
        sampleStartTime = performance.now();
        setState("checking", "initializing");

        if (rafId) {
            cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(analyzeFrame);
    }

    function stop() {
        stopInternal(DEFAULT_STATE);
    }

    function markHealthy() {
        setState("active");
    }

    function markSuspended(note = "suspended") {
        setState("waiting", note);
    }

    return {
        start,
        stop,
        markHealthy,
        markSuspended
    };
}
