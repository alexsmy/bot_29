const assetVersion = new URL(import.meta.url).searchParams.get("v") || String(Date.now());
const withVersion = (path) => `${path}${path.includes("?") ? "&" : "?"}v=${encodeURIComponent(assetVersion)}`;

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

const btnPlay = document.getElementById("btn-play");
const btnStop = document.getElementById("btn-stop");
const volumeSlider = document.getElementById("volume-slider");
const volumeIcon = document.getElementById("volume-icon");
const timerDisplay = document.getElementById("player-timer");

async function bootstrap() {
    const [
        audioMod,
        equalizerMod,
        favoritesMod,
        menuMod,
        searchMod,
        themeMod,
        playerMod,
        interactionsMod,
        playbackMod
    ] = await Promise.all([
        import(withVersion("./audio.js")),
        import(withVersion("./equalizer.js")),
        import(withVersion("./favorites.js")),
        import(withVersion("./menu.js")),
        import(withVersion("./search.js")),
        import(withVersion("./theme.js")),
        import(withVersion("./player.js")),
        import(withVersion("./interactions.js")),
        import(withVersion("./playback.js"))
    ]);

    const {
        setupAudioAnalyser,
        getAudioContext,
        getAnalyser,
        resumeAudioContext,
        unlockAudioContext
    } = audioMod;

    const { initEqualizer } = equalizerMod;
    const {
        renderFavorites,
        loadFavorites,
        addFavorite,
        removeFavorite,
        resetFavorites
    } = favoritesMod;
    const { initMenu } = menuMod;
    const { initSearch } = searchMod;
    const { initDynamicBackground, setRandomTheme } = themeMod;
    const { initPlayer } = playerMod;
    const { initInteractions } = interactionsMod;
    const { startStationPlayback } = playbackMod;

    initDynamicBackground();
    initInteractions();

    const { startEqualizer } = initEqualizer({
        radioPlayer,
        columns,
        getAnalyser,
        getAudioContext
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
        startEqualizer,
        renderFavorites: () => renderFavorites(radioMenu),
        startStationPlayback
    });

    radioPlayer.addEventListener("error", () => {
        console.error("Ошибка воспроизведения аудио");
    });

    radioPlayer.addEventListener('play', () => {
        resumeAudioContext();
    });

    function handleFirstInteraction() {
        unlockAudioContext();

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
        radioLogo,
        openMenu,
        startEqualizer,
        startStationPlayback
    });

    renderFavorites(radioMenu);
}

bootstrap().catch((error) => {
    console.error("Radio bootstrap failed:", error);
});
