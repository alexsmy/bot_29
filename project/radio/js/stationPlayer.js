export async function startStationPlayback({
    radioPlayer,
    stationUrl,
    setupAudioAnalyser,
    resumeAudioContext,
    startEqualizer
}) {
    if (!radioPlayer || !stationUrl) {
        return false;
    }

    // На iOS/Safari полезно явно включать CORS до установки source.
    radioPlayer.crossOrigin = "anonymous";
    radioPlayer.src = stationUrl;

    if (typeof setupAudioAnalyser === "function") {
        setupAudioAnalyser();
    }

    if (typeof resumeAudioContext === "function") {
        try {
            await resumeAudioContext();
        } catch (error) {
            console.warn("AudioContext resume failed:", error);
        }
    }

    try {
        await radioPlayer.play();
    } catch (error) {
        console.error("Ошибка воспроизведения аудио:", error);
        return false;
    }

    if (typeof startEqualizer === "function") {
        startEqualizer();
    }

    return true;
}
