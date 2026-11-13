
import './SearchBar.scss';
import template from './SearchBar.hbs';
import type { DomRoot } from '../../types/dom';

export interface SearchBarOptions {
    placeholder?: string;
    initialQuery?: string;
    debounceMs?: number;
    onSearch?: (query: string) => void;
}

/**
 * Поле поиска. Не знает ничего о страницах и о том, что делать с запросом —
 * просто дебаунсит ввод и зовёт переданный onSearch.
 */
export class SearchBar {
    placeholder: string;
    initialQuery: string;
    debounceMs: number;
    onSearch?: (query: string) => void;
    timer: ReturnType<typeof setTimeout> | null;
    element: DomRoot | null;
    /**
     * @param {Object} [options]
     * @param {string} [options.placeholder='Поиск']
     * @param {string} [options.initialQuery='']
     * @param {number} [options.debounceMs=300]
     * @param {(query: string) => void} [options.onSearch]
     */
    constructor({ placeholder = 'Поиск', initialQuery = '', debounceMs = 300, onSearch }: SearchBarOptions = {}) {
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
        this.element = wrapper.firstElementChild as DomRoot;

        const input = this.element.querySelector<HTMLInputElement>('.search-input');
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

    getValue(): string {
        return this.element?.querySelector<HTMLInputElement>('.search-input')?.value.trim() ?? '';
    }

    destroy(): void {
        clearTimeout(this.timer);
    }
}