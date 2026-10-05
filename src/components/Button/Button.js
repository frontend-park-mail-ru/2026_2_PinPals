export class Button {
    constructor({ title, type = 'button', onClick, className = 'btn btn-primary' }) {
        this.title = title;
        this.type = type;
        this.onClick = onClick;
        this.className = className;
        this.element = null;
    }

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

    setDisabled(disabled) {
        if (this.element) {
            this.element.disabled = disabled;
        }
    }
}
