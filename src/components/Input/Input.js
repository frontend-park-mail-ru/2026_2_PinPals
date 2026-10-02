export class Input {
    constructor({ label, type, name, placeholder, validator }) {
        this.label = label;
        this.type = type;
        this.name = name;
        this.placeholder = placeholder;
        this.validator = validator;
        this.error = '';
        this.element = null;
        this.inputElement = null;
    }

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

        return this.element;
    }

    getValue() {
        return this.inputElement.value;
    }

    validate() {
        if (this.validator) {
            this.error = this.validator(this.getValue());
            this.showError();
        }
        return !this.error;
    }

    showError() {
        const errorEl = this.element.querySelector('.error-msg');
        if (errorEl) errorEl.textContent = this.error;
    }
}