import { startStationPlayback } from "./playback.js";

export function initMenu({
    openMenu,
    radioMenu,
    radioPlayer,
    body,
    radioLogo,
    setRandomTheme,
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

        const stationName = button.querySelector("span")?.textContent || "";
        const selectedStationLogo = button.querySelector("img")?.src || "";

        try {
            await startStationPlayback({
                radioPlayer,
                stationUrl: selectedStationUrl,
                stationName,
                stationLogo: selectedStationLogo,
                radioLogo,
                openMenu,
                setRandomTheme,
                startEqualizer
            });
        } catch (error) {
            alert("Не удалось запустить поток станции.");
            return;
        }

        setTimeout(() => {
            radioMenu.classList.remove("show");
        }, 300);
    });
}
