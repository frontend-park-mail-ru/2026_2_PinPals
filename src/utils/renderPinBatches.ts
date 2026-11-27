import { PAGE_SIZE } from '../api/pageSize';
import type { Pin } from '../types/models';

export function renderPinBatches(grid: HTMLElement, pins: Pin[], renderCard: (pin: Pin) => HTMLElement) {
    let offset = 0;
    function appendBatch() {
        const cards = pins.slice(offset, offset + PAGE_SIZE).map(renderCard);
        grid.append(...cards);
        offset += cards.length;
        if (offset < pins.length) {
            requestAnimationFrame(() => {
                // Сетку могли очистить или заменить между порциями.
                if (grid.isConnected && cards[0].parentElement === grid) appendBatch();
            });
        }
    }
    appendBatch();
}
