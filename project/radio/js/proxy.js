const STORAGE_KEY = "vibeRadioProxySettings";

const DEFAULT_SETTINGS = {
    audioStreams: false,
    searchQueries: false
};

function parseSettings(rawValue) {
    try {
        const parsed = JSON.parse(rawValue);
        return {
            audioStreams: Boolean(parsed?.audioStreams),
            searchQueries: Boolean(parsed?.searchQueries)
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function loadProxySettings() {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    if (!storedValue) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        return { ...DEFAULT_SETTINGS };
    }
    return parseSettings(storedValue);
}

export function saveProxySettings(settings) {
    const normalizedSettings = {
        audioStreams: Boolean(settings?.audioStreams),
        searchQueries: Boolean(settings?.searchQueries)
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedSettings));
    return normalizedSettings;
}

export function getProxySettings() {
    return loadProxySettings();
}

export function isAudioProxyEnabled() {
    return loadProxySettings().audioStreams;
}

export function isSearchProxyEnabled() {
    return loadProxySettings().searchQueries;
}

export function getAudioStreamUrl(rawUrl) {
    if (!rawUrl) return "";

    if (!isAudioProxyEnabled()) {
        return rawUrl;
    }

    if (rawUrl.startsWith("/api/radio/proxy/stream")) {
        return rawUrl;
    }

    return `/api/radio/proxy/stream?url=${encodeURIComponent(rawUrl)}`;
}

export function getSearchEndpoint(query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
        return "";
    }

    if (isSearchProxyEnabled()) {
        return `/api/radio/proxy/search?query=${encodeURIComponent(normalizedQuery)}`;
    }

    return `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(normalizedQuery)}`;
}

export function prepareAudioElement(audioElement) {
    if (!audioElement) return;

    audioElement.crossOrigin = "anonymous";
    audioElement.preload = "none";
    audioElement.setAttribute("playsinline", "true");
    audioElement.setAttribute("webkit-playsinline", "true");
    audioElement.setAttribute("x-webkit-airplay", "allow");
}

export function applyAudioStreamSource(audioElement, rawUrl) {
    if (!audioElement || !rawUrl) return "";

    prepareAudioElement(audioElement);
    audioElement.dataset.originalStreamUrl = rawUrl;

    const finalUrl = getAudioStreamUrl(rawUrl);
    audioElement.src = finalUrl;
    return finalUrl;
}

export function getStoredOriginalStreamUrl(audioElement) {
    return audioElement?.dataset?.originalStreamUrl || "";
}

export function isLikelyIOSSafari() {
    const ua = window.navigator?.userAgent || "";
    const platform = window.navigator?.platform || "";
    const isAppleTouch = /iPad|iPhone|iPod/.test(ua) || (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
    return Boolean(isAppleTouch && isSafari);
}
