const COLOR_CONFIG = {
    minLightness: 30,
    maxLightness: 65,
    minSaturation: 60,
    maxSaturation: 100,

    minDuration: 8,
    maxDuration: 22
};

let blobs = [];
let baseBackgroundInterval = null;

const random = (min, max) => Math.random() * (max - min) + min;

function getRandomColor() {
    const hue = Math.floor(random(0, 360));
    const saturation = Math.floor(random(COLOR_CONFIG.minSaturation, COLOR_CONFIG.maxSaturation));
    const lightness = Math.floor(random(COLOR_CONFIG.minLightness, COLOR_CONFIG.maxLightness));

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function initDynamicBackground() {
    const container = document.getElementById('dynamic-background');
    if (!container) return;

    container.innerHTML = '';
    blobs = [];

    for (let i = 0; i < 4; i++) {
        const blob = document.createElement('div');
        blob.classList.add('bg-blob');
        container.appendChild(blob);

        const blobObj = {
            element: blob,
            timeoutId: null
        };

        blobs.push(blobObj);

        animateBlob(blobObj, true);
    }

    startBaseBackgroundAnimation(container);
}

function animateBlob(blobObj, immediate = false) {
    const el = blobObj.element;

    const duration = random(COLOR_CONFIG.minDuration, COLOR_CONFIG.maxDuration);

    const color = getRandomColor();

    const x = random(-20, 80);
    const y = random(-20, 80);

    const size = random(40, 90);
    const sizeUnit = 'vmin';

    el.style.transition = `all ${duration}s ease-in-out`;

    if (immediate) {
        el.style.transition = 'none';
        requestAnimationFrame(() => {
             el.style.transition = `all ${duration}s ease-in-out`;
        });
    }

    el.style.backgroundColor = color;
    el.style.width = `${size}${sizeUnit}`;
    el.style.height = `${size}${sizeUnit}`;
    el.style.transform = `translate(${x}vw, ${y}vh)`;

    if (blobObj.timeoutId) clearTimeout(blobObj.timeoutId);

    blobObj.timeoutId = setTimeout(() => {
        animateBlob(blobObj);
    }, duration * 1000);
}

function startBaseBackgroundAnimation(container) {
    const updateBase = () => {

        const hue = Math.floor(random(0, 360));
        const sat = random(40, 60);
        const light = random(5, 12);

        container.style.backgroundColor = `hsl(${hue}, ${sat}%, ${light}%)`;
    };

    updateBase();

    if (baseBackgroundInterval) clearInterval(baseBackgroundInterval);

    baseBackgroundInterval = setInterval(updateBase, 15000);
}

export function setRandomTheme() {
    blobs.forEach(blobObj => {

        if (blobObj.timeoutId) clearTimeout(blobObj.timeoutId);

        animateBlob(blobObj);
    });

    const container = document.getElementById('dynamic-background');
    if (container) {

        const hue = Math.floor(random(0, 360));
        container.style.backgroundColor = `hsl(${hue}, 50%, 8%)`;
    }
}
