
import '../components.scss';
import template from './Input.hbs';
import type { DomRoot } from '../../types/dom';

export interface InputOptions {
    label: string;
    type: string;
    name: string;
    placeholder: string;
    maxLength?: number;
    validator?: (value: string) => string;
}

/**
 * Класс, представляющий переиспользуемый компонент поля ввода со встроенной валидацией и переключателем видимости пароля.
 */
export class Input {
    label: string;
    type: string;
    name: string;
    placeholder: string;
    validator?: (value: string) => string;
    error: string;
    element: DomRoot | null;
    inputElement: HTMLInputElement | null;
    /**
     * Создает экземпляр компонента Input.
     *
     * @param {Object} options - Конфигурация поля ввода.
     * @param {string} options.label - Скрытый текстовый лейбл поля.
     * @param {string} options.type - HTML тип инпута ('text', 'password', 'date').
     * @param {string} options.name - Атрибут имени (name) и ID для связывания.
     * @param {string} options.placeholder - Плейсхолдер для поля.
     * @param {function} [options.validator] - Функция клиентской валидации, принимающая текущее значение поля ввода и возвращающая текст ошибки (или пустую строку).
     */
    constructor({ label, type, name, placeholder, validator }: InputOptions) {
        this.label = label;
        this.type = type;
        this.name = name;
        this.placeholder = placeholder;
        this.validator = validator;
        /** @type {string} Текущий текст ошибки валидации поля */
        this.error = '';
        /** @type {HTMLElement|null} Корневой DOM-контейнер инпута */
        this.element = null;
        /** @type {HTMLInputElement|null} Нативный инпут */
        this.inputElement = null;
    }

    /**
     * Генерирует разметку инпута, настраивает переключатель пароля ("глазик") и обработку ввода.
     *
     * @returns {HTMLElement} Сформированный DOM-элемент обертки инпута.
     */
    render() {
        const html = template({
            label: this.label,
            type: this.type,
            name: this.name,
            placeholder: this.placeholder,
            error: this.error,
            isPassword: this.type === 'password',
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild as DomRoot;
        this.inputElement = this.element.querySelector<HTMLInputElement>('input');

        this.inputElement.addEventListener('input', () => this.validate());

        const eyeButton = this.element.querySelector('.eye-icon-img');
        if (eyeButton) {
            eyeButton.addEventListener('click', () => {
                const makeVisible = this.inputElement.type === 'password';
                this.inputElement.type = makeVisible ? 'text' : 'password';
                eyeButton.classList.toggle('is-visible', makeVisible);
                eyeButton.setAttribute('aria-pressed', String(makeVisible));
            });
        }

        return this.element;
    }

    /**
     * Получает текущее текстовое значение из нативного HTML-поля ввода.
     *
     * @returns {string} Очищенное или исходное значение инпута.
     */
    getValue(): string {
        return this.inputElement.value;
    }

    /**
     * Запускает функцию валидации для поля ввода и обновляет интерфейс ошибок.
     *
     * @returns {boolean} Возвращает true, если значение поля корректно и ошибок нет.
     */
    validate(): boolean {
        if (this.validator) {
            this.error = this.validator(this.getValue());
            this.showError();
        }
        return !this.error;
    }

    /**
     * Выводит текущий текст ошибки в соответствующий DOM-элемент под инпутом.
     */
    showError() {
        const errorEl = this.element.querySelector('.error-msg');
        if (errorEl) errorEl.textContent = this.error;

        if (this.error) {
            this.element.classList.add('input-wrapper--error');
        } else {
            this.element.classList.remove('input-wrapper--error');
        }
    }
}