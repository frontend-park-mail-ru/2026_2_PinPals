/**
 * Класс, представляющий переиспользуемый компонент поля ввода со встроенной валидацией и переключателем видимости пароля.
 */
export class Input {
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
    constructor({ label, type, name, placeholder, validator }) {
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
        const template = Handlebars.templates['Input.hbs'];
        const html = template({
            label: this.label,
            type: this.type,
            name: this.name,
            placeholder: this.placeholder,
            error: this.error
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;
        this.inputElement = this.element.querySelector('input');

        this.inputElement.addEventListener('input', () => this.validate());

        const eyeImg = this.element.querySelector('.eye-icon-img');
        if (eyeImg) {
            eyeImg.addEventListener('click', () => {
                if (this.inputElement.type === 'password') {
                    this.inputElement.type = 'text';
                    eyeImg.src = '/public/img/eye-open.png';
                } else {
                    this.inputElement.type = 'password';
                    eyeImg.src = '/public/img/eye-closed.png';
                }
            });
        }

        return this.element;
    }

    /**
     * Получает текущее текстовое значение из нативного HTML-поля ввода.
     *
     * @returns {string} Очищенное или исходное значение инпута.
     */
    getValue() {
        return this.inputElement.value;
    }

    /**
     * Запускает функцию валидации для поля ввода и обновляет интерфейс ошибок.
     *
     * @returns {boolean} Возвращает true, если значение поля корректно и ошибок нет.
     */
    validate() {
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
    }
}
