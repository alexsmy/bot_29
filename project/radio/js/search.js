import { Icons } from "./icons.js";
import { Haptics } from "./interactions.js";

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
    // Новые зависимости для полноценного воспроизведения
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
        
        const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(query)}`;
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
                const isFavorite = favorites.some(fav => fav.name === station.name);
                const resultItem = document.createElement("div");
                resultItem.classList.add("search-result");
                
                // Добавляем анимацию появления
                resultItem.classList.add("stagger-item");
                resultItem.style.animationDelay = `${index * 0.03}s`; // Быстрый каскад
                
                resultItem.innerHTML = `
                    <img src="${station.favicon || 'https://via.placeholder.com/64'}" onerror="this.src='https://via.placeholder.com/64?text=Radio'" alt="${station.name}" />
                    <div class="info">
                        <span>${station.name}</span>
                        <div class="actions">
                            <button class="action-btn play-btn" title="Прослушать" 
                                data-url="${station.url_resolved}" 
                                data-name="${station.name}" 
                                data-logo="${station.favicon || ''}">
                                ${Icons.playCircle}
                            </button>
                            ${isFavorite
                                ? `<button class="action-btn del-btn" title="Удалить из избранного" data-name="${station.name}">${Icons.delete}</button>`
                                : `<button class="action-btn add-btn" title="Добавить в избранное" data-name="${station.name}" data-url="${station.url_resolved}" data-logo="${station.favicon}">${Icons.add}</button>`}
                        </div>
                    </div>
                `;
                searchResults.appendChild(resultItem);
            });

            const playButtons = searchResults.querySelectorAll(".play-btn");
            const addButtons = searchResults.querySelectorAll(".add-btn");
            const delButtons = searchResults.querySelectorAll(".del-btn");

            // --- ОБНОВЛЕННАЯ ЛОГИКА ВОСПРОИЗВЕДЕНИЯ (Task 3) ---
            playButtons.forEach(btn => {
                btn.addEventListener("click", () => {
                    const stationUrl = btn.dataset.url;
                    const stationName = btn.dataset.name;
                    const stationLogo = btn.dataset.logo;

                    // 1. Подготовка аудио контекста (важно для мобильных)
                    if (setupAudioAnalyser) setupAudioAnalyser();
                    if (resumeAudioContext) resumeAudioContext();

                    // 2. Запуск воспроизведения
                    radioPlayer.src = stationUrl;
                    radioPlayer.play().catch(error => {
                        console.error("Ошибка:", error);
                        alert("Ошибка потока");
                    });

                    // 3. Обновление UI (Логотип и Название)
                    if (openMenu) {
                        const btnTextSpan = openMenu.querySelector(".btn-text");
                        if (btnTextSpan) btnTextSpan.textContent = stationName;
                    }

                    if (radioLogo) {
                        const logoImg = radioLogo.querySelector("img");
                        const logoPlaceholder = radioLogo.querySelector(".logo-placeholder");
                        
                        radioLogo.style.display = "flex"; // Показываем контейнер

                        if (stationLogo) {
                            logoImg.src = stationLogo;
                            logoImg.style.display = "block";
                            if(logoPlaceholder) logoPlaceholder.style.display = "none";
                        } else {
                            logoImg.style.display = "none";
                            if(logoPlaceholder) logoPlaceholder.style.display = "flex";
                        }
                    }

                    // 4. Запуск визуализатора
                    if (startEqualizer) startEqualizer();

                    // 5. Закрытие модального окна поиска
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
                    
                    // Вибрация успеха
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
        if(confirm("Сбросить список станций к стандартному?")) {
            resetFavorites();
        }
    });
}