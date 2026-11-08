import template from './BoardCard.hbs';

/**
 * Возвращает слово «пин» в правильной форме.
 *
 * @param {number} count
 * @returns {string}
 */
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

/**
 * Карточка доски с коллажем из трёх изображений.
 */
export class BoardCard {
    /**
     * @param {Object} board
     * @param {string} board.title - Название доски.
     * @param {number} board.pinsCount - Количество пинов на доске.
     * @param {string[]} [board.images] - Изображения для коллажа.
     */
    constructor({ title, pinsCount, images = [] }) {
        this.title = title || 'Без названия';
        this.pinsCount = Number(pinsCount) || 0;
        this.images = Array.isArray(images) ? images.filter(Boolean).slice(0, 3) : [];
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    /**
     * Создаёт DOM-элемент карточки.
     *
     * @returns {HTMLElement}
     */
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
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
