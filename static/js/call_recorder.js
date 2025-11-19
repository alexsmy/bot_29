export class CallRecorder {
    constructor(stream, logCallback, onChunkAvailable, options = {}) {
        this.originalStream = stream;
        this.log = logCallback;
        this.onChunkAvailable = onChunkAvailable;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.timeslice = options.timeslice || 0;
        
        // Контекст для ресемплинга (понижения качества)
        this.audioContext = null;
        this.processedStream = null;
        this.resampleDestination = null;

        // Целевая частота дискретизации для записи (8000 Гц, как вы просили)
        const TARGET_SAMPLE_RATE = 8000; 

        try {
            // 1. Создаем AudioContext с принудительной частотой 8000 Гц
            // Это заставит браузер (даже iOS) пересчитать звук в этот формат
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContextClass({
                sampleRate: TARGET_SAMPLE_RATE
            });

            // 2. Создаем источник из оригинального потока (который может быть 48000)
            const source = this.audioContext.createMediaStreamSource(this.originalStream);
            
            // 3. Создаем назначение (куда пойдет обработанный звук)
            this.resampleDestination = this.audioContext.createMediaStreamDestination();
            
            // 4. Соединяем: Микрофон -> [AudioContext 8kHz] -> Назначение
            source.connect(this.resampleDestination);
            
            // 5. Используем этот НОВЫЙ поток для записи
            this.processedStream = this.resampleDestination.stream;
            
            this.log('RECORDER', `Resampler initialized. Downsampling from hardware rate to ${TARGET_SAMPLE_RATE}Hz for recording.`);

        } catch (e) {
            this.log('ERROR', `Failed to initialize audio resampler: ${e}. Falling back to original stream.`);
            this.processedStream = this.originalStream;
        }

        // Настройки кодека для записи
        const recorderOptions = {
            mimeType: 'audio/webm;codecs=opus',
            // Битрейт 12 кбит/с оптимален для речи 8000 Гц (Opus очень эффективен)
            audioBitsPerSecond: 12000 
        };

        // Проверка поддержки mimeType (Safari на iOS поддерживает audio/mp4 или audio/webm в новых версиях)
        if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
            this.log('RECORDER', `MIME type ${recorderOptions.mimeType} is not supported.`);
            // Для iOS часто лучше работает audio/mp4, но попробуем оставить дефолт, если webm нет
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                recorderOptions.mimeType = 'audio/mp4';
                this.log('RECORDER', `Switched to audio/mp4 for iOS compatibility.`);
            } else {
                delete recorderOptions.mimeType; // Браузер выберет сам
            }
        }
        
        try {
            this.mediaRecorder = new MediaRecorder(this.processedStream, recorderOptions);
            
            // Логируем итоговые настройки, которые принял браузер
            const actualSettings = this.mediaRecorder.stream.getAudioTracks()[0].getSettings();
            this.log('RECORDER', `MediaRecorder initialized. Target SampleRate: ${TARGET_SAMPLE_RATE}Hz. Actual Track SampleRate: ${actualSettings.sampleRate || 'unknown'}Hz.`);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    if (this.timeslice > 0) {
                        this.log('RECORDER', `Chunk created (size: ${event.data.size}). Sending...`);
                        this.onChunkAvailable(new Blob([event.data], { type: this.mediaRecorder.mimeType }));
                    } else {
                        this.recordedChunks.push(event.data);
                    }
                }
            };
        } catch (e) {
            this.log('CRITICAL_ERROR', `Error creating MediaRecorder: ${e}`);
            this.mediaRecorder = null;
        }
    }

    start() {
        if (!this.mediaRecorder || this.isRecording) return;
        
        // Важно для iOS: AudioContext может быть в состоянии suspended, если не было явного жеста
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                this.log('RECORDER', 'AudioContext resumed successfully.');
            });
        }

        this.recordedChunks = [];
        this.mediaRecorder.start(this.timeslice > 0 ? this.timeslice : undefined);
        this.isRecording = true;
        this.log('RECORDER', `Recording started. Timeslice: ${this.timeslice}ms.`);
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                let finalBlob = null;
                if (this.timeslice === 0 && this.recordedChunks.length > 0) {
                    finalBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                    this.log('RECORDER', `Recording stopped. Final blob size: ${finalBlob.size} bytes.`);
                    this.onChunkAvailable(finalBlob);
                } else {
                    this.log('RECORDER', `Recording stopped (interval mode).`);
                }

                this.recordedChunks = [];
                this.isRecording = false;

                // Очистка ресурсов
                this.cleanup();

                resolve(finalBlob);
            };
            
            if (this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
            } else {
                this.cleanup();
                resolve(null);
            }
        });
    }

    cleanup() {
        // Останавливаем треки ресемплера
        if (this.processedStream) {
            this.processedStream.getTracks().forEach(track => track.stop());
        }
        // Закрываем AudioContext, чтобы не тратить батарею
        if (this.audioContext) {
            this.audioContext.close().then(() => {
                this.log('RECORDER', 'AudioContext closed.');
            });
            this.audioContext = null;
        }
        // Оригинальный стрим мы НЕ останавливаем здесь, так как он нужен для звонка!
    }
}