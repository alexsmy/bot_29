import { setupFileEvents, resetApp } from './file_events.js';
import { setupSmartEvents } from './smart_events.js';
import { setupNavEvents } from './nav_events.js';
import { setupGenerateEvents } from './generate_events.js';

export { resetApp };

export function setupAllEvents() {
    setupFileEvents();
    setupSmartEvents();
    setupNavEvents();
    setupGenerateEvents();
}
