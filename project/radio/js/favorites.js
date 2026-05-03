const storageKey = "radioFavorites";

const defaultStations = [
    { name: "Шоколад 🍫", url: "https://choco.hostingradio.ru:10010/fm", logo: "https://radiopotok.ru/f/station_webp/256/780.webp" },
    { name: "Релакс FM 🤗", url: "http://pub0101.101.ru:8000/stream/reg/mp3/128/region_relax_73", logo: "https://radiopotok.ru/f/station_webp/256/597.webp" },
    { name: "Монте Карло 🎶", url: "http://montecarlo.hostingradio.ru/montecarlo128.mp3", logo: "https://radiopotok.ru/f/station_webp/256/603.webp" },
    { name: "ALEX 💗Best Lounge Music", url: "https://listen7.myradio24.com/avmarushak", logo: "https://top-radio.ru/assets/image/radio/180/radio-alex-best-lounge-music.jpg" },
    { name: "AIRPORT✈️ LOUNGE RADIO", url: "https://az1.mediacp.eu/listen/airport-lounge-radio/radio.mp3", logo: "https://favicon-generator.org/favicon-generator/htdocs/favicons/2023-12-16/9274e8a4803971186ff5c45359ab77a4.ico.png" }
];

export function loadFavorites() {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (stored === null) {
        localStorage.setItem(storageKey, JSON.stringify(defaultStations));
        return [...defaultStations];
    }
    return stored;
}

export function saveFavorites(favorites) {
    localStorage.setItem(storageKey, JSON.stringify(favorites));
}

export function renderFavorites(radioMenu) {
    const favorites = loadFavorites();
    radioMenu.innerHTML = "";

    if (favorites.length === 0) {
        radioMenu.innerHTML = `
            <div class="empty-favorites stagger-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <line x1="12" y1="11" x2="12" y2="17"></line>
                    <line x1="9" y1="14" x2="15" y2="14"></line>
                </svg>
                <span>Список избранного пуст</span>
                <span style="font-size: 0.8em; opacity: 0.7;">Добавьте станции через поиск</span>
            </div>
        `;
        return;
    }

    favorites.forEach((station, index) => {
        const button = document.createElement("button");
        button.value = station.url;
        button.classList.add("radio-menu-item");
        // Добавляем класс для анимации
        button.classList.add("stagger-item");
        // Устанавливаем задержку: каждый следующий элемент появляется на 50мс позже
        button.style.animationDelay = `${index * 0.05}s`;
        
        button.title = station.name; 
        button.innerHTML = `<img src="${station.logo}" alt="${station.name}" /><span>${station.name}</span>`;
        radioMenu.appendChild(button);
    });
}

export function resetFavorites(radioMenu) {
    localStorage.removeItem(storageKey);
    loadFavorites();
    renderFavorites(radioMenu);
}

export function addFavorite({ name, url, logo }) {
    const favorites = loadFavorites();
    if (!favorites.some(f => f.name === name)) {
        favorites.push({ name, url, logo });
        saveFavorites(favorites);
    }
}

export function removeFavorite(name) {
    const favorites = loadFavorites();
    const updatedFavorites = favorites.filter(station => station.name !== name);
    saveFavorites(updatedFavorites);
}