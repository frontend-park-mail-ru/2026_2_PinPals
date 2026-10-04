export class Button {
    constructor({ title, type = 'button', onClick }) {
        this.title = title;
        this.type = type;
        this.onClick = onClick;
        this.element = null;
    }

    render() {
        const template = Handlebars.templates['Button.hbs'];
        const html = template({ title: this.title, type: this.type });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;

        if (this.onClick) {
            this.element.addEventListener('click', this.onClick);
        }

        return this.element;
    }

    setDisabled(disabled) {
        if (this.element) {
            this.element.disabled = disabled;
        }
    }
}
