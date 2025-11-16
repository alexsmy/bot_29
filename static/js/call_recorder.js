export class CallRecorder {
    // --- ИЗМЕНЕНИЕ: Конструктор теперь принимает onChunkAvailable и timeslice ---
    constructor(stream, logCallback, onChunkAvailable, options = {}) {
        this.stream = stream;
        this.log = logCallback;
        this.onChunkAvailable = onChunkAvailable;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.timeslice = options.timeslice || 0; // 0 означает запись одним файлом

        const recorderOptions = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: options.audioBitsPerSecond || 8000
        };

        if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
            this.log('RECORDER', `MIME type ${recorderOptions.mimeType} is not supported. Falling back to default.`);
            delete recorderOptions.mimeType;
        }
        
        try {
            this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
            this.log('RECORDER', `MediaRecorder initialized with options:`, recorderOptions);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    // Если включена интервальная запись, сразу отправляем чанк
                    if (this.timeslice > 0) {
                        this.log('RECORDER', `Chunk created (size: ${event.data.size}). Sending...`);
                        this.onChunkAvailable(new Blob([event.data], { type: this.mediaRecorder.mimeType }));
                    } else {
                        // Иначе, как и раньше, просто накапливаем
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
        this.recordedChunks = [];
        // --- ИЗМЕНЕНИЕ: Передаем timeslice в метод start ---
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
                // Если мы не использовали timeslice, то все чанки накоплены здесь
                if (this.timeslice === 0 && this.recordedChunks.length > 0) {
                    finalBlob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                    this.log('RECORDER', `Recording stopped. Final blob size: ${finalBlob.size} bytes.`);
                    // Отправляем финальный большой файл
                    this.onChunkAvailable(finalBlob);
                } else {
                    // Если использовали timeslice, финальный чанк уже был отправлен в ondataavailable
                    this.log('RECORDER', `Recording stopped (interval mode).`);
                }

                this.recordedChunks = [];
                this.isRecording = false;

                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.log('RECORDER', 'All tracks used for recording have been stopped.');
                }

                resolve(finalBlob); // Возвращаем blob только в режиме без timeslice
            };
            
            if (this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
            } else {
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                }
                resolve(null);
            }
        });
    }
}