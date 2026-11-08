import template from './Header.hbs';
import { SearchBar } from '../SearchBar/SearchBar';
import { logoutUser, resolveImageUrl } from '../../api/user';

/**
 * Шапка сайта: логотип, слот по центру, меню пользователя.
 */
export class Header {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {HTMLElement} [options.center] - что положить в центральный слот;
     *     по умолчанию — SearchBar с глобальным placeholder.
     * @param {import('../../routes').Router} [options.router] - роутер для переходов.
     */
    constructor({ center, router }: any = {}) {
        this.center = center;
        this.router = router;
        this.searchBar = null;
        this.element = null;
    }

    render() {
        this.element = this.buildElement();
        this.setupEvents();
        return this.element;
    }

    /**
     * Перерисовывает содержимое шапки, не пересоздавая экземпляр.
     * Нужно после логина/логаута: состояние берётся из localStorage.
     */
    refresh() {
        if (!this.element || !this.element.parentNode) {
            return;
        }

        this.searchBar?.destroy();
        this.searchBar = null;

        const nextElement = this.buildElement();
        this.element.replaceWith(nextElement);
        this.element = nextElement;
        this.setupEvents();
    }

    /**
     * Собирает DOM шапки по актуальному состоянию localStorage.
     *
     * @returns {HTMLElement}
     */
    buildElement() {
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';
        const rawAvatarUrl = isAuth ? (localStorage.getItem('userAvatarUrl') || '') : '';
        const userAvatarUrl = resolveImageUrl(rawAvatarUrl);

        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({ isAuth, userName, userAvatarUrl });
        const element = wrapper.firstElementChild;
        const avatarImage = element.querySelector('.user-avatar img');
        if (avatarImage) {
            avatarImage.addEventListener('error', () => avatarImage.remove(), { once: true });
        }

        const centerSlot = element.querySelector('.header-center');
        if (this.center) {
            centerSlot.append(this.center);
        } else {
            this.searchBar = new SearchBar();
            centerSlot.append(this.searchBar.render());
        }

        return element;
    }

    setupEvents() {
        const logoutBtn = this.element.querySelector('#logoutBtn');
        if (!logoutBtn) {
            return;
        }

        logoutBtn.addEventListener('click', async () => {
            try {
                await logoutUser();
            } catch (e) {
                console.warn('Серверный логаут не удался или сессия уже истекла', e);
            }

            localStorage.removeItem('isAuth');
            localStorage.removeItem('userName');
            localStorage.removeItem('userId');
            localStorage.removeItem('userTag');
            localStorage.removeItem('userAvatarUrl');

            // Сначала обновляем сам хедер (он уже в стеке и не пересоздастся),
            // а уже потом уходим на главную.
            this.refresh();
            this.router.navigateTo('/');
        });
    }

    destroy() {
        this.searchBar?.destroy();
    }
}