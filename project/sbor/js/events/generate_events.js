import { els, state } from '../state.js';
import { prepareGeneration } from '../secrets.js';
import { executeGeneration } from '../generator.js';
import { resetApp } from './file_events.js';

export function setupGenerateEvents() {
    if (els.btnPrepareGen) {
        els.btnPrepareGen.addEventListener('click', () => {
            if (state.finalSelectedPaths.size === 0) {
                els.statusArea.style.display = 'block';
                els.statusArea.innerHTML = 'Нельзя перейти дальше: в сборке не выбрано ни одного файла.';
                return;
            }
            prepareGeneration(new Set(state.finalSelectedPaths));
        });
    }

    if (els.btnExecuteGen) {
        els.btnExecuteGen.addEventListener('click', () => {
            executeGeneration().catch(error => {
                console.error('Ошибка генерации:', error);
                els.loader.style.display = 'none';
                els.statusArea.style.display = 'block';
                els.statusArea.innerHTML = `<strong>Ошибка:</strong> ${error?.message || 'Не удалось сформировать итоговый файл.'}`;
            });
        });
    }

    if (els.downloadBtn) {
        els.downloadBtn.addEventListener('click', () => {
            if (typeof els.downloadBtn.__downloadHandler === 'function') {
                els.downloadBtn.__downloadHandler();
            }
        });
    }

    if (els.btnNewFile) {
        els.btnNewFile.addEventListener('click', () => {
            resetApp();
            window.location.reload();
        });
    }
}
