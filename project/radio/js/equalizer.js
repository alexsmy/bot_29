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
    let isAnimating = false;

    function updateEqualizer() {
        if (!isAnimating) {
            animationFrameId = null;
            return;
        }

        if (radioPlayer.paused) {
            columns.forEach(column => {
                column.style.height = "0%";
            });
        } else {
            const analyser = getAnalyser();
            const audioContext = getAudioContext();
            if (!analyser || !audioContext) {
                animationFrameId = requestAnimationFrame(updateEqualizer);
                return;
            }

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);

            const sampleRate = audioContext.sampleRate;
            const fftSize = analyser.fftSize;

            columns.forEach((column, index) => {
                let sum = 0;
                let count = 0;
                const range = frequencyRanges[index];

                for (let i = 0; i < analyser.frequencyBinCount; i++) {
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
        }

        animationFrameId = requestAnimationFrame(updateEqualizer);
    }

    function startEqualizer() {
        if (isAnimating) return;
        isAnimating = true;
        updateEqualizer();
    }

    function stopEqualizer() {
        isAnimating = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        columns.forEach(column => {
            column.style.height = "0%";
        });
    }

    return { startEqualizer, stopEqualizer };
}
