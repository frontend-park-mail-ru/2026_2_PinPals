/**
 * Класс, представляющий переиспользуемый компонент кнопки.
 */
export class Button {
    /**
     * Создает экземпляр компонента Button.
     *
     * @param {Object} options - Конфигурация компонента.
     * @param {string} options.title - Текстовое содержимое (лейбл) кнопки.
     * @param {string} [options.type='button'] - Атрибут типа HTML-кнопки ('button', 'submit', 'reset').
     * @param {function} [options.onClick] - Функция-обработчик события клика.
     * @param {string} [options.className='btn btn-primary'] - CSS-классы для стилизации кнопки.
     */
    constructor({ title, type = 'button', onClick, className = 'btn btn-primary' }) {
        this.title = title;
        this.type = type;
        this.onClick = onClick;
        this.className = className;
        /** @type {HTMLElement|null} Ссылка на корневой элемент кнопки после рендеринга */
        this.element = null;
    }

    /**
     * Генерирует HTML-разметку кнопки на основе Handlebars-шаблона и вешает обработчик клика.
     *
     * @returns {HTMLElement} Корневой DOM-элемент кнопки.
     */
    render() {
        const template = Handlebars.templates['Button.hbs'];
        const html = template({
            title: this.title,
            type: this.type,
            className: this.className
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;

        if (this.onClick) {
            this.element.addEventListener('click', this.onClick);
        }

        return this.element;
    }

    /**
     * Изменяет состояние доступности кнопки (блокирует или разблокирует ее).
     *
     * @param {boolean} disabled - Флаг блокировки кнопки.
     */
    setDisabled(disabled) {
        if (this.element) {
            this.element.disabled = disabled;
        }
    }
}
