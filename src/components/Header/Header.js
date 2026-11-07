import template from './Header.hbs';
import { SearchBar } from '../SearchBar/SearchBar.js';

/**
 * Шапка сайта: логотип, слот по центру, меню пользователя.
 */
export class Header {
    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.center] - что положить в центральный слот;
     *     по умолчанию — SearchBar с глобальным placeholder.
     * @param {import('../../routes.js').Router} [options.router] - роутер для переходов.
     */
    constructor({ center, router } = {}) {
        this.center = center;
        this.router = router;
        this.searchBar = null;
        /** @type {HTMLElement|null} */
        this.element = null;
    }

    render() {
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';
        const userAvatarUrl = isAuth ? (localStorage.getItem('userAvatarUrl') || '') : '';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({ isAuth, userName, userAvatarUrl });
        this.element = wrapper.firstElementChild;

        const centerSlot = this.element.querySelector('.header-center');
        if (this.center) {
            centerSlot.append(this.center);
        } else {
            this.searchBar = new SearchBar();
            centerSlot.append(this.searchBar.render());
        }

        this.setupEvents();
        return this.element;
    }

    setupEvents() {
        const logoutBtn = this.element.querySelector('#logoutBtn');
        if (!logoutBtn) {
            return;
        }

        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('isAuth');
            localStorage.removeItem('token');
            localStorage.removeItem('userName');
            localStorage.removeItem('userId');
            localStorage.removeItem('userTag');
            localStorage.removeItem('userAvatarUrl');

            this.router.navigateTo('/');
        });
    }

    destroy() {
        this.searchBar?.destroy();
    }
}