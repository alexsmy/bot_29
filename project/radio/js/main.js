import { setupAudioAnalyser, getAudioContext, getAnalyser, resumeAudioContext, unlockAudioContext, rebuildAudioAnalyser, prepareAudioContextForElement } from "./audio.js";
import { initEqualizer } from "./equalizer.js";
import { renderFavorites, loadFavorites, addFavorite, removeFavorite, resetFavorites } from "./favorites.js";
import { initMenu } from "./menu.js";
import { initSearch } from "./search.js";
import { initDynamicBackground, setRandomTheme } from "./theme.js";
import { initPlayer } from "./player.js";
import { initInteractions } from "./interactions.js";
import { applyAudioStreamSource, getAudioStreamUrl, getStoredOriginalStreamUrl, getProxySettings } from "./proxy.js";
import { createEqualizerDiagnostics } from "./diagnostics.js";
import { initProxySettingsModal } from "./settings.js";

const openMenu = document.getElementById("open-menu");
const radioMenu = document.getElementById("radio-menu");
const radioPlayer = document.getElementById("radio-player");
const body = document.body;
const columns = document.querySelectorAll('.column div');
const radioLogo = document.getElementById("radio-logo");
const searchButton = document.getElementById("search-button");
const searchModal = document.getElementById("search-modal");
const searchInput = document.getElementById("search-input");
const searchStart = document.getElementById("search-start");
const searchResults = document.getElementById("search-results");
const closeModal = document.getElementById("close-modal");
const resetDefault = document.getElementById("reset-default");
const appTitle = document.getElementById("app-title");
const proxyModal = document.getElementById("proxy-modal");
const proxyClose = document.getElementById("proxy-close");
const proxyCancel = document.getElementById("proxy-cancel");
const proxyApply = document.getElementById("proxy-apply");
const proxyAudio = document.getElementById("proxy-audio-streams");
const proxySearch = document.getElementById("proxy-search-queries");

const btnPlay = document.getElementById("btn-play");
const btnStop = document.getElementById("btn-stop");
const volumeSlider = document.getElementById("volume-slider");
const volumeIcon = document.getElementById("volume-icon");
const timerDisplay = document.getElementById("player-timer");

prepareAudioContextForElement(radioPlayer);
initDynamicBackground();
initInteractions();

const { startEqualizer, stopEqualizer } = initEqualizer({
    radioPlayer,
    columns,
    getAnalyser,
    getAudioContext
});

const equalizerDiagnostics = createEqualizerDiagnostics({
    radioPlayer,
    getAnalyser,
    getAudioContext,
    onRecoveryNeeded: async () => {
        const currentUrl = getStoredOriginalStreamUrl(radioPlayer);
        if (!currentUrl) {
            return;
        }

        const isPlaying = !radioPlayer.paused;
        try {
            await rebuildAudioAnalyser(radioPlayer);
            applyAudioStreamSource(radioPlayer, currentUrl);
            await resumeAudioContext();
            if (isPlaying) {
                await radioPlayer.play().catch((error) => console.warn("Повторный запуск после восстановления не удался:", error));
            }
        } catch (error) {
            console.warn("Не удалось восстановить аудиограф после self-check:", error);
        }
    }
});

initPlayer({
    radioPlayer,
    btnPlay,
    btnStop,
    volumeSlider,
    volumeIcon,
    timerDisplay,
    radioLogo
});

initMenu({
    openMenu,
    radioMenu,
    radioPlayer,
    body,
    radioLogo,
    setRandomTheme,
    setupAudioAnalyser: () => setupAudioAnalyser(radioPlayer),
    resumeAudioContext,
    startEqualizer,
    renderFavorites: () => renderFavorites(radioMenu)
});

radioPlayer.addEventListener("error", () => {
    console.error("Ошибка воспроизведения аудио");
});

radioPlayer.addEventListener('play', () => {
    resumeAudioContext();
    setupAudioAnalyser(radioPlayer);
    startEqualizer();
    equalizerDiagnostics.start();
});

radioPlayer.addEventListener('pause', () => {
    stopEqualizer();
    equalizerDiagnostics.stop();
});

radioPlayer.addEventListener('ended', () => {
    stopEqualizer();
    equalizerDiagnostics.stop();
});

function handleFirstInteraction() {
    unlockAudioContext();

    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
}

document.addEventListener('click', handleFirstInteraction);
document.addEventListener('touchstart', handleFirstInteraction);

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !radioPlayer.paused) {
        resumeAudioContext();
        setupAudioAnalyser(radioPlayer);
        startEqualizer();
    }
});

initSearch({
    searchButton,
    searchModal,
    searchInput,
    searchStart,
    searchResults,
    closeModal,
    resetDefault,
    radioPlayer,
    loadFavorites,
    addFavorite,
    removeFavorite,
    renderFavorites: () => renderFavorites(radioMenu),
    resetFavorites: () => resetFavorites(radioMenu),

    radioLogo,
    openMenu,
    startEqualizer,
    setupAudioAnalyser: () => setupAudioAnalyser(radioPlayer),
    resumeAudioContext
});

initProxySettingsModal({
    titleButton: appTitle,
    modalOverlay: proxyModal,
    closeButton: proxyClose,
    cancelButton: proxyCancel,
    applyButton: proxyApply,
    audioCheckbox: proxyAudio,
    searchCheckbox: proxySearch,
    onApply: async (nextSettings, previousSettings) => {
        const audioProxyChanged = nextSettings.audioStreams !== previousSettings.audioStreams;
        const currentOriginalUrl = getStoredOriginalStreamUrl(radioPlayer);

        if (audioProxyChanged && currentOriginalUrl) {
            const wasPlaying = !radioPlayer.paused;
            const currentTime = radioPlayer.currentTime;
            applyAudioStreamSource(radioPlayer, currentOriginalUrl);
            setupAudioAnalyser(radioPlayer);

            if (wasPlaying) {
                try {
                    await resumeAudioContext();
                    await radioPlayer.play();
                } catch (error) {
                    console.warn("Не удалось перезапустить поток после смены режима прокси:", error);
                }
            } else {
                radioPlayer.currentTime = currentTime || 0;
            }
        }

        if (nextSettings.searchQueries !== previousSettings.searchQueries) {
            console.info("[VibeRadio] Server search proxy:", nextSettings.searchQueries ? "enabled" : "disabled");
        }
    }
});

renderFavorites(radioMenu);
