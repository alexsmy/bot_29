// static/js/call_recorder.js

export class CallRecorder {
    constructor(stream, logCallback, options = {}) {
        this.stream = stream;
        this.log = logCallback;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        // ИЗМЕНЕНИЕ: Добавляем свойство для хранения времени начала
        this.startTime = null;

        const recorderOptions = {
            mimeType: 'audio/webm;codecs=opus',
            ...options
        };

        if (!MediaRecorder.isTypeSupported(recorderOptions.mimeType)) {
            this.log(`[RECORDER] MIME type ${recorderOptions.mimeType} is not supported. Falling back to default.`);
            delete recorderOptions.mimeType;
        }
        
        try {
            this.mediaRecorder = new MediaRecorder(this.stream, recorderOptions);
            this.log(`[RECORDER] MediaRecorder initialized with options: ${JSON.stringify(recorderOptions)}`);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
        } catch (e) {
            this.log(`[RECORDER] Error creating MediaRecorder: ${e}`);
            this.mediaRecorder = null;
        }
    }

    // ИЗМЕНЕНИЕ: Метод start теперь принимает и сохраняет timestamp
    start(timestamp) {
        if (!this.mediaRecorder || this.isRecording) return;
        this.startTime = timestamp;
        this.recordedChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.log(`[RECORDER] Recording started at timestamp ${this.startTime}.`);
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType });
                this.recordedChunks = [];
                this.isRecording = false;
                this.log(`[RECORDER] Recording stopped. Blob size: ${blob.size} bytes.`);
                // ИЗМЕНЕНИЕ: Возвращаем объект с blob и временем начала
                resolve({ blob, startTime: this.startTime });
            };
            
            if (this.mediaRecorder.state === "recording") {
                this.mediaRecorder.stop();
            } else {
                resolve(null);
            }
        });
    }
}