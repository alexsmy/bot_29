import { Icons } from "./icons.js";
import { Haptics } from "./interactions.js";
import { applyAudioStreamSource, getSearchEndpoint } from "./proxy.js";

async function playWithRetry(radioPlayer) {
    try {
        await radioPlayer.play();
    } catch (error) {
        console.warn("Ошибка воспроизведения потока, повторяем попытку:", error);
        try {
            await radioPlayer.play();
        } catch (retryError) {
            console.error("Повтор воспроизведения не удался:", retryError);
            alert("Ошибка потока");
        }
    }
}

export function initSearch({
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
    renderFavorites,
    resetFavorites,

    radioLogo,
    openMenu,
    startEqualizer,
    setupAudioAnalyser,
    resumeAudioContext
}) {
    searchButton.addEventListener("click", () => {
        searchModal.classList.add("show");
        searchInput.focus();
    });

    closeModal.addEventListener("click", () => {
        searchModal.classList.remove("show");
    });

    searchModal.addEventListener("click", (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove("show");
        }
    });

    searchStart.addEventListener("click", async () => {
        const query = searchInput.value.trim();
        if (!query) return;

        searchResults.innerHTML = '<p style="text-align:center; color:#666;">Поиск...</p>';

        const url = getSearchEndpoint(query);
        if (!url) {
            searchResults.innerHTML = '<p style="text-align:center; color:#666;">Введите запрос для поиска</p>';
            return;
        }

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.length === 0) {
                searchResults.innerHTML = '<p style="text-align:center; color:#666;">Ничего не найдено</p>';
                return;
            }

            searchResults.innerHTML = `<p style="margin-bottom:10px; font-size:0.9rem; color:#666;">Найдено станций: ${data.length}</p>`;
            const favorites = loadFavorites();

            data.forEach((station, index) => {
                const stationStreamUrl = station.url_resolved || station.url || "";
                const isFavorite = favorites.some(fav => fav.name === station.name);
                const resultItem = document.createElement("div");
                resultItem.classList.add("search-result");

                resultItem.classList.add("stagger-item");
                resultItem.style.animationDelay = `${index * 0.03}s`;

                resultItem.innerHTML = `
                    <img src="${station.favicon || 'https://via.placeholder.com/64'}" onerror="this.src='https://via.placeholder.com/64?text=Radio'" alt="${station.name}" />
                    <div class="info">
                        <span>${station.name}</span>
                        <div class="actions">
                            <button class="action-btn play-btn" title="Прослушать"
                                data-url="${stationStreamUrl}"
                                data-name="${station.name}"
                                data-logo="${station.favicon || ''}">
                                ${Icons.playCircle}
                            </button>
                            ${isFavorite
                                ? `<button class="action-btn del-btn" title="Удалить из избранного" data-name="${station.name}">${Icons.delete}</button>`
                                : `<button class="action-btn add-btn" title="Добавить в избранное" data-name="${station.name}" data-url="${stationStreamUrl}" data-logo="${station.favicon || ''}">${Icons.add}</button>`}
                        </div>
                    </div>
                `;
                searchResults.appendChild(resultItem);
            });

            const playButtons = searchResults.querySelectorAll(".play-btn");
            const addButtons = searchResults.querySelectorAll(".add-btn");
            const delButtons = searchResults.querySelectorAll(".del-btn");

            playButtons.forEach(btn => {
                btn.addEventListener("click", async () => {
                    const stationUrl = btn.dataset.url;
                    const stationName = btn.dataset.name;
                    const stationLogo = btn.dataset.logo;

                    applyAudioStreamSource(radioPlayer, stationUrl);

                    if (setupAudioAnalyser) setupAudioAnalyser();
                    if (resumeAudioContext) await resumeAudioContext();

                    await playWithRetry(radioPlayer);

                    if (openMenu) {
                        const btnTextSpan = openMenu.querySelector(".btn-text");
                        if (btnTextSpan) btnTextSpan.textContent = stationName;
                    }

                    if (radioLogo) {
                        const logoImg = radioLogo.querySelector("img");
                        const logoPlaceholder = radioLogo.querySelector(".logo-placeholder");

                        radioLogo.style.display = "flex";

                        if (stationLogo) {
                            logoImg.src = stationLogo;
                            logoImg.style.display = "block";
                            if (logoPlaceholder) logoPlaceholder.style.display = "none";
                        } else {
                            logoImg.style.display = "none";
                            if (logoPlaceholder) logoPlaceholder.style.display = "flex";
                        }
                    }

                    if (startEqualizer) startEqualizer();

                    searchModal.classList.remove("show");
                });
            });

            addButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    addFavorite({
                        name: btn.dataset.name,
                        url: btn.dataset.url,
                        logo: btn.dataset.logo
                    });

                    Haptics.success();

                    renderFavorites();

                    const parent = btn.parentElement;
                    btn.remove();
                    const delBtn = document.createElement('button');
                    delBtn.className = 'action-btn del-btn';
                    delBtn.innerHTML = Icons.delete;
                    delBtn.dataset.name = btn.dataset.name;
                    delBtn.addEventListener('click', () => {
                        removeFavorite(delBtn.dataset.name);
                        renderFavorites();
                        searchStart.click();
                    });
                    parent.appendChild(delBtn);
                });
            });

            delButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    removeFavorite(btn.dataset.name);
                    renderFavorites();
                    searchStart.click();
                });
            });

        } catch (error) {
            console.error("Ошибка при поиске:", error);
            searchResults.innerHTML = '<p style="color:red; text-align:center;">Ошибка соединения с сервером радио</p>';
        }
    });

    resetDefault.addEventListener("click", () => {
        if (confirm("Сбросить список станций к стандартному?")) {
            resetFavorites();
        }
    });
}
