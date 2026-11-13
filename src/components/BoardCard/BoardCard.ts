import './BoardCard.scss';
import template from './BoardCard.hbs';
import { resolveImageUrl } from '../../api/user';

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
    [key: string]: any;
    /**
     * @param {Object} board - Объект доски, полученный от API.
     */
    constructor(board) {
        this.id = board.desk_id ?? board.board_id ?? board.id ?? '';
        this.title = board.name || board.title || 'Без названия';


        const hasPinsCount = Array.isArray(board.pins)
            || board.pins_count != null
            || board.pinsCount != null;
        this.pinsCount = Array.isArray(board.pins)
            ? board.pins.length
            : (Number(board.pins_count ?? board.pinsCount) || 0);
        this.pinsLabel = hasPinsCount ? getPinsLabel(this.pinsCount) : '';

        let images = (board.preview_images || board.images || []).filter(Boolean);
        if (!images.length && Array.isArray(board.pins)) {
            images = board.pins.map((pin) => pin.image_url).filter(Boolean);
        }
        if (!images.length && board.avatar_img_url) {
            images = [board.avatar_img_url];
        }
        this.images = images.slice(0, 3);

        this.element = null;
    }

    /** @returns {HTMLElement} */
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            id: encodeURIComponent(this.id),
            title: this.title,
            pinsLabel: this.pinsLabel,
            isSingleImage: this.images.length === 1,
            firstImage: resolveImageUrl(this.images[0]),
            secondImage: resolveImageUrl(this.images[1]),
            thirdImage: resolveImageUrl(this.images[2]),
        });
        this.element = wrapper.firstElementChild;
        return this.element;
    }
}