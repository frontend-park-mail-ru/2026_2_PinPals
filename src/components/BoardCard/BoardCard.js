import template from './BoardCard.hbs';

/** Возвращает корректную подпись количества пинов. */
function getPinsLabel(count) {
    const value = Math.max(0, Number(count) || 0);
    const lastTwoDigits = value % 100;
    const lastDigit = value % 10;
    let word = 'пинов';

    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
        if (lastDigit === 1) word = 'пин';
        else if (lastDigit >= 2 && lastDigit <= 4) word = 'пина';
    }
    return `${value} ${word}`;
}

/** Карточка доски с коллажем из трёх изображений. */
export class BoardCard {
    /**
     * @param {Object} board - Объект доски, полученный от API.
     */
    constructor(board) {
        this.id = board.board_id ?? board.id ?? '';
        this.title = board.title || 'Без названия';
        this.pinsCount = Number(board.pins_count ?? board.pinsCount) || 0;
        this.images = (board.preview_images || board.images || []).filter(Boolean).slice(0, 3);
        this.element = null;
    }

    /** @returns {HTMLElement} */
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            id: encodeURIComponent(this.id),
            title: this.title,
            pinsLabel: getPinsLabel(this.pinsCount),
            isSingleImage: this.images.length === 1,
            firstImage: this.images[0] || '',
            secondImage: this.images[1] || '',
            thirdImage: this.images[2] || '',
        });
        this.element = wrapper.firstElementChild;
        return this.element;
    }
}
