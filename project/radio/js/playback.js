import { setupAudioAnalyser, resumeAudioContext, waitForMediaReady, syncVolumeToGain } from "./audio.js";

function updateSelectedStationUI({ openMenu, radioLogo, stationName, stationLogo }) {
    if (openMenu) {
        const btnTextSpan = openMenu.querySelector(".btn-text");
        if (btnTextSpan && stationName) {
            btnTextSpan.textContent = stationName;
        }
    }

    if (!radioLogo) {
        return;
    }

    const logoImg = radioLogo.querySelector("img");
    const logoPlaceholder = radioLogo.querySelector(".logo-placeholder");

    radioLogo.style.display = "flex";

    if (stationLogo && logoImg) {
        logoImg.src = stationLogo;
        logoImg.style.display = "block";
        if (logoPlaceholder) {
            logoPlaceholder.style.display = "none";
        }
    } else if (logoImg) {
        logoImg.style.display = "none";
        if (logoPlaceholder) {
            logoPlaceholder.style.display = "flex";
        }
    }
}

export async function startStationPlayback({
    radioPlayer,
    stationUrl,
    stationName,
    stationLogo,
    radioLogo,
    openMenu,
    setRandomTheme,
    startEqualizer
}) {
    if (!radioPlayer || !stationUrl) {
        return false;
    }

    radioPlayer.crossOrigin = "anonymous";
    radioPlayer.preload = "metadata";

    updateSelectedStationUI({
        openMenu,
        radioLogo,
        stationName,
        stationLogo
    });

    radioPlayer.src = stationUrl;
    radioPlayer.load();

    setupAudioAnalyser(radioPlayer);
    void resumeAudioContext();
    syncVolumeToGain(radioPlayer);

    const playPromise = radioPlayer.play();
    if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((error) => {
            console.error("Ошибка воспроизведения аудио:", error);
        });
    }

    void waitForMediaReady(radioPlayer).catch(() => {});

    if (typeof setRandomTheme === "function") {
        setRandomTheme();
    }

    if (typeof startEqualizer === "function") {
        startEqualizer();
    }

    return true;
}
