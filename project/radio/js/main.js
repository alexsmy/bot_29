import { setupAudioAnalyser, getAudioContext, getAnalyser, resumeAudioContext, unlockAudioContext } from "./audio.js";
import { initEqualizer } from "./equalizer.js";
import { renderFavorites, loadFavorites, addFavorite, removeFavorite, resetFavorites } from "./favorites.js";
import { initMenu } from "./menu.js";
import { initSearch } from "./search.js";
import { initDynamicBackground, setRandomTheme } from "./theme.js";
import { initPlayer } from "./player.js";
import { initInteractions } from "./interactions.js";

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

// Элементы нового плеера
const btnPlay = document.getElementById("btn-play");
const btnStop = document.getElementById("btn-stop");
const volumeSlider = document.getElementById("volume-slider");
const volumeIcon = document.getElementById("volume-icon");
const timerDisplay = document.getElementById("player-timer");

// Явно включаем CORS на старте, чтобы Web Audio корректно видел поток и на iPhone тоже.
radioPlayer.crossOrigin = "anonymous";

// Инициализация динамического фона при загрузке
initDynamicBackground();

// Инициализация микровзаимодействий (вибрация, анимации)
initInteractions();

const { startEqualizer } = initEqualizer({
    radioPlayer,
    columns,
    getAnalyser,
    getAudioContext
});

// Инициализация кастомного плеера
initPlayer({
    radioPlayer,
    btnPlay,
    btnStop,
    volumeSlider,
    volumeIcon,
    timerDisplay,
    radioLogo // Передаем логотип для управления свечением
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

// На iOS и в некоторых мобильных браузерах безопаснее стартовать/обновлять граф аудио
// в момент фактического перехода плеера в состояние playing.
radioPlayer.addEventListener("playing", () => {
    setupAudioAnalyser(radioPlayer);
    resumeAudioContext();
    startEqualizer();
});

// Глобальный обработчик для "разблокировки" AudioContext на iOS при первом взаимодействии
function handleFirstInteraction() {
    unlockAudioContext();
    // Удаляем обработчики после первого срабатывания
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
}

document.addEventListener('click', handleFirstInteraction);
document.addEventListener('touchstart', handleFirstInteraction);

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
    // Новые зависимости для Task 3 (Воспроизведение из поиска)
    radioLogo,
    openMenu,
    startEqualizer,
    setupAudioAnalyser: () => setupAudioAnalyser(radioPlayer),
    resumeAudioContext
});

renderFavorites(radioMenu);
