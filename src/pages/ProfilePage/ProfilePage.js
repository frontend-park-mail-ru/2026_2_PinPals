import { fetchUserBoards, fetchUserSavedPins } from '../../api/user.js';
import { Header } from '../../components/Header/Header.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import { BoardCard } from '../../components/BoardCard/BoardCard.js';
import template from './ProfilePage.hbs';

/**
 * Возвращает подпись количества подписчиков.
 *
 * @param {number} count
 * @returns {string}
 */
function formatFollowers(count) {
    const value = Math.max(0, Number(count) || 0);
    const lastTwoDigits = value % 100;
    const lastDigit = value % 10;
    let word = 'подписчиков';

    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
        if (lastDigit === 1) word = 'подписчик';
        else if (lastDigit >= 2 && lastDigit <= 4) word = 'подписчика';
    }

    return `${value} ${word}`;
}

/**
 * Страница профиля с вкладками «Пины» и «Доски».
 */
export class ProfilePage {
    /**
     * @param {Object} options
     * @param {import('../../routes.js').Router} options.router
     * @param {'pins'|'boards'} [options.activeTab='pins']
     */
    constructor({ router, activeTab = 'pins' } = {}) {
        this.router = router;
        this.activeTab = activeTab === 'boards' ? 'boards' : 'pins';
        this.element = null;
        this.header = null;
        this.isDestroyed = false;
    }

    /**
     * Создаёт DOM страницы и запускает загрузку данных с API.
     *
     * @returns {HTMLElement}
     */
    render() {
        const userName = localStorage.getItem('userName')
            || localStorage.getItem('userTag')
            || 'Пользователь';
        const userAvatarUrl = localStorage.getItem('userAvatarUrl') || '';
        const followersCount = localStorage.getItem('followersCount')
            || localStorage.getItem('userFollowersCount')
            || '0';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            userName,
            userAvatarUrl,
            userInitial: userName.trim().charAt(0).toUpperCase() || 'П',
            followersLabel: formatFollowers(Number(followersCount)),
            isPinsTab: this.activeTab === 'pins',
            isBoardsTab: this.activeTab === 'boards',
            actionText: this.activeTab === 'pins' ? 'Создать пин' : 'Создать доску',
        });

        this.element = wrapper.firstElementChild;
        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());

        this.setupEvents();
        void this.loadContent();
        return this.element;
    }

    /** Загружает содержимое вкладки с backend. */
    async loadContent() {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            this.showContentMessage('Войдите в аккаунт, чтобы посмотреть свои сохранения.');
            return;
        }

        try {
            if (this.activeTab === 'pins') {
                const pins = await fetchUserSavedPins(userId);
                if (this.isDestroyed || !this.element?.isConnected) return;
                this.renderPins(pins);
            } else {
                const boards = await fetchUserBoards(userId);
                if (this.isDestroyed || !this.element?.isConnected) return;
                this.renderBoards(boards);
            }
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.showContentMessage(error.message || 'Не удалось загрузить данные профиля.');
        }
    }

    /**
     * Рендерит сохранённые пины, полученные с сервера.
     *
     * @param {Array<Object>} pins
     */
    renderPins(pins) {
        const grid = this.element.querySelector('#profilePinsGrid');
        grid.replaceChildren();

        const fragment = document.createDocumentFragment();
        pins.forEach((pin) => fragment.append(new PinCard(pin).render()));
        grid.append(fragment);
        this.showContentMessage(pins.length ? '' : 'Пока нет сохранённых пинов.');
    }

    /**
     * Рендерит доски, полученные с сервера.
     *
     * @param {Array<Object>} boards
     */
    renderBoards(boards) {
        const grid = this.element.querySelector('#profileBoardsGrid');
        grid.replaceChildren();

        const fragment = document.createDocumentFragment();
        boards.forEach((board) => fragment.append(new BoardCard(board).render()));
        grid.append(fragment);
        this.showContentMessage(boards.length ? '' : 'Пока нет досок. Создайте первую доску.');
    }

    /**
     * Показывает или скрывает сообщение под сеткой.
     *
     * @param {string} message
     */
    showContentMessage(message) {
        const state = this.element?.querySelector('#profileContentState');
        if (!state) return;
        state.textContent = message;
        state.hidden = !message;
    }

    /** Подключает обработчики элементов страницы. */
    setupEvents() {
        this.element.querySelector('#profileActionButton').addEventListener('click', () => {
            if (this.activeTab === 'pins') {
                this.router.navigateTo('/create-pin');
                return;
            }
            this.router.navigateTo('/create-board');
        });
    }

    /** Обновляет шапку после изменения авторизации. */
    refreshHeader() {
        this.header?.refresh();
    }

    /** Освобождает ресурсы страницы. */
    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
