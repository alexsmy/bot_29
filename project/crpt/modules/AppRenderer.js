/**
 * Модуль рендеринга приложения.
 * Собирает HTML из компонентов и внедряет его в корневой элемент.
 */
import { HeaderComponent } from './components/Header.js';
import { EncryptionTabComponent } from './components/EncryptionTab.js';
import { DecryptionTabComponent } from './components/DecryptionTab.js';
import { KeyGenModalComponent } from './components/KeyGenModal.js';
import { ShareKeyModalComponent } from './components/ShareKeyModal.js';
import { ReceiveKeyModalComponent } from './components/ReceiveKeyModal.js';
import { CloudModalComponent } from './components/CloudModal.js'; // Импорт нового модального окна

export function renderApp() {
    const root = document.getElementById('app-root');
    if (!root) {
        console.error("Root element #app-root not found!");
        return;
    }

    // Собираем структуру приложения, добавляя новые модальные окна
    const appHTML = `
        <div class="app-container">
            ${HeaderComponent()}
            <main>
                ${EncryptionTabComponent()}
                ${DecryptionTabComponent()}
            </main>
        </div>

        ${KeyGenModalComponent()}
        ${ShareKeyModalComponent()}
        ${ReceiveKeyModalComponent()}
        ${CloudModalComponent()}
        
        <div id="toast-container"></div>
    `;

    root.innerHTML = appHTML;
}