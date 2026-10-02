export class Button {
    constructor({ title }) {
        this.title = title;
        this.element = null;
    }

    render() {
        const template = Handlebars.templates['Button.hbs'];
        const html = template({ title: this.title });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        this.element = wrapper.firstElementChild;

        return this.element;
    }
}