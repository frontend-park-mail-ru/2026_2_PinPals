import template from './PinCard.hbs';

/**
 * Карточка одного пина в ленте.
 */
export class PinCard {
    /**
     * @param {Object} pin - Данные пина с бэкенда.
     * @param {string|number} [pin.pin_id] - ID пина из Go API.
     * @param {string|number} [pin.id] - ID из локального mock API.
     * @param {string} pin.image_url - URL изображения.
     * @param {string} [pin.name] - Название (идёт в alt).
     * @param {string} [pin.description] - Описание (идёт в title).
     */
    constructor(pin) {
        this.pin = pin;
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    /**
     * @returns {HTMLElement} Корневой DOM-элемент карточки.
     */
    render() {
        const pinId = this.pin.pin_id ?? this.pin.id;
        const html = template({
            url: pinId ? `/pin/${encodeURIComponent(pinId)}` : '/',
            imageUrl: this.pin.image_url,
            alt: this.pin.name ?? '',
            title: this.pin.description ?? '',
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;

        if (!pinId) {
            this.element.removeAttribute('href');
            this.element.setAttribute('aria-disabled', 'true');
        }

        return this.element;
    }
}
