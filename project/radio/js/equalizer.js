const frequencyRanges = [
    { from: 20, to: 250 },
    { from: 250, to: 500 },
    { from: 500, to: 2000 },
    { from: 2000, to: 8000 },
    { from: 8000, to: 20000 }
];

const levelScaleFactor = 0.8;

export function initEqualizer({ radioPlayer, columns, getAnalyser, getAudioContext }) {
    let animationFrameId = null;
    let isRunning = false;

    function clearColumns() {
        columns.forEach((column) => {
            column.style.height = "0%";
        });
    }

    function updateEqualizer() {
        if (!isRunning) {
            animationFrameId = null;
            clearColumns();
            return;
        }

        if (!radioPlayer || radioPlayer.paused) {
            clearColumns();
            animationFrameId = window.requestAnimationFrame(updateEqualizer);
            return;
        }

        const analyser = getAnalyser();
        const audioContext = getAudioContext();

        if (!analyser || !audioContext) {
            clearColumns();
            animationFrameId = window.requestAnimationFrame(updateEqualizer);
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const sampleRate = audioContext.sampleRate;
        const fftSize = analyser.fftSize;

        columns.forEach((column, index) => {
            const range = frequencyRanges[index];
            let sum = 0;
            let count = 0;

            for (let i = 0; i < analyser.frequencyBinCount; i += 1) {
                const frequency = Math.floor((i * sampleRate) / fftSize);
                if (frequency >= range.from && frequency < range.to) {
                    sum += dataArray[i];
                    count += 1;
                }
            }

            const avg = count > 0 ? sum / count : 0;
            let percent = (avg / 255) * 100 * levelScaleFactor;
            percent = Math.min(percent, 95);

            column.style.height = `${percent}%`;
        });

        animationFrameId = window.requestAnimationFrame(updateEqualizer);
    }

    function startEqualizer() {
        if (isRunning) {
            return;
        }

        isRunning = true;
        updateEqualizer();
    }

    function stopEqualizer() {
        isRunning = false;
        if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        clearColumns();
    }

    return { startEqualizer, stopEqualizer };
}
