import { getProxySettings, saveProxySettings } from "./proxy.js";

export function initProxySettingsModal({
    titleButton,
    modalOverlay,
    closeButton,
    cancelButton,
    applyButton,
    audioCheckbox,
    searchCheckbox,
    onApply
}) {
    if (!titleButton || !modalOverlay || !closeButton || !cancelButton || !applyButton || !audioCheckbox || !searchCheckbox) {
        return;
    }

    function syncFormFromStorage() {
        const settings = getProxySettings();
        audioCheckbox.checked = settings.audioStreams;
        searchCheckbox.checked = settings.searchQueries;
    }

    function openModal(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        syncFormFromStorage();
        modalOverlay.classList.add("show");
        modalOverlay.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
        modalOverlay.classList.remove("show");
        modalOverlay.setAttribute("aria-hidden", "true");
    }

    titleButton.addEventListener("click", openModal);
    titleButton.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            openModal(event);
        }
    });

    modalOverlay.addEventListener("click", (event) => {
        if (event.target === modalOverlay) {
            closeModal();
        }
    });

    closeButton.addEventListener("click", closeModal);
    cancelButton.addEventListener("click", closeModal);

    applyButton.addEventListener("click", () => {
        const previousSettings = getProxySettings();
        const nextSettings = saveProxySettings({
            audioStreams: audioCheckbox.checked,
            searchQueries: searchCheckbox.checked
        });

        closeModal();

        if (typeof onApply === "function") {
            onApply(nextSettings, previousSettings);
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modalOverlay.classList.contains("show")) {
            closeModal();
        }
    });

    syncFormFromStorage();
}
