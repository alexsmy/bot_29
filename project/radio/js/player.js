import { Icons } from "./icons.js";
import { Haptics } from "./interactions.js";

export function initPlayer({ radioPlayer, btnPlay, btnStop, volumeSlider, volumeIcon, timerDisplay, radioLogo }) {

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function updatePlayButton() {
        if (radioPlayer.paused) {
            btnPlay.innerHTML = Icons.play;
            btnPlay.style.paddingLeft = "4px";

            if (radioLogo) radioLogo.classList.remove("playing-glow");
        } else {
            btnPlay.innerHTML = Icons.pause;
            btnPlay.style.paddingLeft = "0";

            if (radioLogo) radioLogo.classList.add("playing-glow");
        }
    }

    btnStop.innerHTML = Icons.stop;

    function updateVolumeIcon() {
        const vol = radioPlayer.volume;
        if (vol === 0 || radioPlayer.muted) {
            volumeIcon.innerHTML = Icons.volumeMute;
        } else if (vol < 0.5) {
            volumeIcon.innerHTML = Icons.volumeLow;
        } else {
            volumeIcon.innerHTML = Icons.volumeHigh;
        }

        volumeIcon.classList.remove('pulse-anim');
        void volumeIcon.offsetWidth;
        volumeIcon.classList.add('pulse-anim');
    }

    async function requestPlayback() {
        try {
            await radioPlayer.play();
        } catch (error) {
            console.error("Ошибка воспроизведения:", error);
            try {
                await radioPlayer.play();
            } catch (retryError) {
                console.error("Повторное воспроизведение не удалось:", retryError);
            }
        }
    }

    btnPlay.addEventListener("click", () => {
        if (!radioPlayer.src) {
            alert("Сначала выберите радиостанцию из меню!");
            return;
        }

        if (radioPlayer.paused) {
            requestPlayback();
        } else {
            radioPlayer.pause();
        }
    });

    btnStop.addEventListener("click", () => {
        radioPlayer.pause();
        radioPlayer.currentTime = 0;
        timerDisplay.textContent = "00:00";
        updatePlayButton();
    });

    volumeSlider.addEventListener("input", (e) => {
        radioPlayer.volume = e.target.value;
        radioPlayer.muted = false;

        if (Math.random() > 0.7) Haptics.light();

        updateVolumeIcon();
    });

    let lastVolume = 1;
    volumeIcon.addEventListener("click", () => {
        if (radioPlayer.muted || radioPlayer.volume === 0) {
            radioPlayer.muted = false;
            radioPlayer.volume = lastVolume || 0.5;
            volumeSlider.value = radioPlayer.volume;
        } else {
            lastVolume = radioPlayer.volume;
            radioPlayer.muted = true;
            radioPlayer.volume = 0;
            volumeSlider.value = 0;
        }
        updateVolumeIcon();
    });

    radioPlayer.addEventListener("play", updatePlayButton);
    radioPlayer.addEventListener("pause", updatePlayButton);
    radioPlayer.addEventListener("volumechange", () => {
        volumeSlider.value = radioPlayer.volume;
    });

    radioPlayer.addEventListener("timeupdate", () => {
        if (!radioPlayer.paused) {
            timerDisplay.textContent = formatTime(radioPlayer.currentTime);
        }
    });

    updatePlayButton();
    updateVolumeIcon();
}
