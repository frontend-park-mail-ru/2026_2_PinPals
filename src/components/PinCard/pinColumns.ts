import { renderPinBatches } from '../../utils/renderPinBatches';
import './pinColumns.scss';
import { PinCard } from './PinCard';
import type { Pin } from '../../types/models';

const rowHeight = 8;

export class PinColumns {
    private observer = new ResizeObserver(entries => {
        for (const { target, contentRect } of entries) {
            if (!contentRect.width) continue;
            const card = target as HTMLElement;
            const rows = Math.ceil((contentRect.height + rowHeight) / rowHeight);
            card.style.gridRowEnd = `span ${rows}`;
        }
    });

    append(grid: HTMLElement, pins: Pin[], renderCard = (pin: Pin) => new PinCard(pin).render()) {
        grid.classList.add('pin-columns');
        grid.style.setProperty('--pin-row-height', rowHeight + 'px');
        renderPinBatches(grid, pins, pin => {
            const card = renderCard(pin);
            this.observer.observe(card);
            return card;
        });
    }

    disconnect() {
        this.observer.disconnect();
    }
}
