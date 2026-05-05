import { applyAudioStreamSource } from "./proxy.js";

async function playWithRetry(radioPlayer, resumeAudioContext) {
    try {
        await radioPlayer.play();
    } catch (error) {
        console.warn("Первичная попытка воспроизведения не удалась, пробуем восстановить AudioContext:", error);
        if (typeof resumeAudioContext === "function") {
            try {
                await resumeAudioContext();
            } catch (resumeError) {
                console.warn("Не удалось возобновить AudioContext:", resumeError);
            }
        }

        try {
            await radioPlayer.play();
        } catch (retryError) {
            console.error("Ошибка воспроизведения аудио:", retryError);
        }
    }
}

export function initMenu({
    openMenu,
    radioMenu,
    radioPlayer,
    body,
    radioLogo,
    setRandomTheme,
    setupAudioAnalyser,
    resumeAudioContext,
    startEqualizer,
    renderFavorites
}) {
    openMenu.addEventListener("click", (e) => {
        e.stopPropagation();
        radioMenu.classList.toggle("show");
        if (radioMenu.classList.contains("show")) {
            renderFavorites();
        }
    });

    document.addEventListener("click", (e) => {
        if (!radioMenu.contains(e.target) && !openMenu.contains(e.target)) {
            radioMenu.classList.remove("show");
        }
    });

    radioMenu.addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) {
            return;
        }

        const selectedStationUrl = button.value;
        if (!selectedStationUrl) {
            return;
        }

        applyAudioStreamSource(radioPlayer, selectedStationUrl);
        setupAudioAnalyser();
        await playWithRetry(radioPlayer, resumeAudioContext);
        startEqualizer();

        if (setRandomTheme) {
            setRandomTheme();
        }

        const stationName = button.querySelector("span");
        if (stationName) {
            const btnTextSpan = openMenu.querySelector(".btn-text");
            if (btnTextSpan) btnTextSpan.textContent = stationName.textContent;
        }

        setTimeout(() => {
            radioMenu.classList.remove("show");
        }, 300);

        const selectedStationLogo = button.querySelector("img");
        const logoImg = radioLogo.querySelector("img");
        const logoPlaceholder = radioLogo.querySelector(".logo-placeholder");

        radioLogo.style.display = "flex";

        if (selectedStationLogo && selectedStationLogo.src) {
            logoImg.src = selectedStationLogo.src;
            logoImg.style.display = "block";
            if (logoPlaceholder) logoPlaceholder.style.display = "none";
        } else {
            logoImg.style.display = "none";
            if (logoPlaceholder) logoPlaceholder.style.display = "flex";
        }
    });
}
