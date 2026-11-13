import '../components.scss';
import template from './Button.hbs';

export interface ButtonOptions {
    title: string;
    type?: 'button' | 'submit' | 'reset';
    onClick?: (event: MouseEvent) => void;
    className?: string;
}

/**
 * Класс, представляющий переиспользуемый компонент кнопки.
 */
export class Button {
    title: string;
    type: 'button' | 'submit' | 'reset';
    onClick?: (event: MouseEvent) => void;
    className: string;
    element: HTMLButtonElement | null;
    /**
     * Создает экземпляр компонента Button.
     *
     * @param {Object} options - Конфигурация компонента.
     * @param {string} options.title - Текстовое содержимое (лейбл) кнопки.
     * @param {string} [options.type='button'] - Атрибут типа HTML-кнопки ('button', 'submit', 'reset').
     * @param {function} [options.onClick] - Функция-обработчик события клика.
     * @param {string} [options.className='btn btn-primary'] - CSS-классы для стилизации кнопки.
     */
    constructor({ title, type = 'button', onClick, className = 'btn btn-primary' }: ButtonOptions) {
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
    render(): HTMLButtonElement {
        const html = template({
            title: this.title,
            type: this.type,
            className: this.className
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild as HTMLButtonElement;

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
    setDisabled(disabled: boolean): void {
        if (this.element) {
            this.element.disabled = disabled;
        }
    }
}