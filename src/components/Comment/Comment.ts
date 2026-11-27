import template from './Comment.hbs';

/**
 * Один комментарий под пином.
 */
export class Comment {
    author: string;
    text: string;
    element: HTMLElement | null;
    /**
     * @param {Object} comment
     * @param {string} comment.author - Имя автора.
     * @param {string} comment.text - Текст комментария.
     */
    constructor({ author, text }: { author: string; text: string }) {
        this.author = author;
        this.text = text;
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            author: this.author,
            text: this.text,
        });
        this.element = wrapper.firstElementChild as HTMLElement;
        return this.element;
    }
}