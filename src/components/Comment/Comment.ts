import template from './Comment.hbs';

/**
 * Один комментарий под пином.
 */
export class Comment {
    [key: string]: any;
    /**
     * @param {Object} comment
     * @param {string} comment.author - Имя автора.
     * @param {string} comment.text - Текст комментария.
     */
    constructor({ author, text }) {
        this.author = author;
        this.text = text;
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            author: this.author,
            text: this.text,
        });
        this.element = wrapper.firstElementChild;
        return this.element;
    }
}