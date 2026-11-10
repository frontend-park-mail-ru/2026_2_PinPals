import template from './SearchBar.hbs';

/**
 * Поле поиска. Не знает ничего о страницах и о том, что делать с запросом —
 * просто дебаунсит ввод и зовёт переданный onSearch.
 */
export class SearchBar {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {string} [options.placeholder='Поиск']
     * @param {string} [options.initialQuery='']
     * @param {number} [options.debounceMs=300]
     * @param {(query: string) => void} [options.onSearch]
     */
    constructor({ placeholder = 'Поиск', initialQuery = '', debounceMs = 300, onSearch }: any = {}) {
        this.placeholder = placeholder;
        this.initialQuery = initialQuery;
        this.debounceMs = debounceMs;
        this.onSearch = onSearch;
        this.timer = null;
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            placeholder: this.placeholder,
            value: this.initialQuery,
        });
        this.element = wrapper.firstElementChild;

        const input = this.element.querySelector('.search-input');
        input.addEventListener('input', () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => {
                // Если страницу уже размонтировали — не дёргаем колбэк
                if (!this.element?.isConnected) {
                    return;
                }
                this.onSearch?.(input.value.trim());
            }, this.debounceMs);
        });

        return this.element;
    }

    getValue() {
        return this.element?.querySelector('.search-input')?.value.trim() ?? '';
    }

    destroy() {
        clearTimeout(this.timer);
    }
}