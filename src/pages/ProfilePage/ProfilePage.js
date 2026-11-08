import { fetchPins } from '../../api/user.js';
import { Header } from '../../components/Header/Header.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import { BoardCard } from '../../components/BoardCard/BoardCard.js';
import template from './ProfilePage.hbs';


const MOCK_BOARDS = [
    { title: 'Котики', pinsCount: 10, imageIndexes: [0, 1, 2] },
    { title: 'Мультики', pinsCount: 42, imageIndexes: [3, 4, 5] },
    { title: 'Страх', pinsCount: 10, imageIndexes: [6, 7, 8] },
    { title: 'Фон на телефон', pinsCount: 2, imageIndexes: [9, 10] },
    { title: 'Я', pinsCount: 19, imageIndexes: [11, 12, 13] },
    { title: 'Еще логотипы', pinsCount: 3, imageIndexes: [14, 15, 16] },
];

/**
 * Безопасно читает массив ID сохранённых пинов из localStorage.
 *
 * @returns {string[]}
 */
function getSavedPinIds() {
    try {
        const savedPins = JSON.parse(localStorage.getItem('pickking:saved-pins') || '[]');
        return Array.isArray(savedPins) ? savedPins.map(String) : [];
    } catch {
        return [];
    }
}

/**
 * Возвращает правильную подпись количества подписчиков.
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
 * Подготавливает демонстрационные доски, используя изображения загруженных пинов.
 *
 * @param {Array<Object>} pins
 * @returns {Array<Object>}
 */
function makeMockBoards(pins) {
    return MOCK_BOARDS.map((board) => {
        const images = pins.length
            ? board.imageIndexes
                .map((index) => pins[index % pins.length]?.image_url)
                .filter(Boolean)
            : [];

        return {
            title: board.title,
            pinsCount: board.pinsCount,
            images,
        };
    });
}

export class ProfilePage {
    /**
     * @param {Object} options
     * @param {import('../../routes.js').Router} options.router
     * @param {'pins'|'boards'} [options.activeTab='pins']
     */
    constructor({ router, activeTab = 'pins' } = {}) {
        this.router = router;
        this.activeTab = activeTab === 'boards' ? 'boards' : 'pins';
        /** @type {HTMLElement|null} */
        this.element = null;
        /** @type {import('../../components/Header/Header.js').Header|null} */
        this.header = null;
        this.isDestroyed = false;
    }

    /**
     * Создаёт DOM страницы и запускает загрузку содержимого.
     *
     * @returns {HTMLElement}
     */
    render() {
        const userName = localStorage.getItem('userTag')
            || localStorage.getItem('userName')
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

    /**
     * Загружает данные для активной вкладки.
     */
    async loadContent() {
        try {
            const data = await fetchPins(100);
            if (this.isDestroyed || !this.element?.isConnected) return;

            if (this.activeTab === 'pins') {
                this.renderPins(data.pins || []);
            } else {
                this.renderBoards(makeMockBoards(data.pins || []));
            }
        } catch {
            if (this.isDestroyed || !this.element?.isConnected) return;

            if (this.activeTab === 'pins') {
                this.showContentMessage('Не удалось загрузить пины. Попробуйте обновить страницу.');
            } else {
                // Доски остаются видимыми даже без ответа API — с пустыми коллажами.
                this.renderBoards(makeMockBoards([]));
            }
        }
    }

    /**
     * Рендерит сетку пинов.
     *
     * @param {Array<Object>} pins
     */
    renderPins(pins) {
        const grid = this.element.querySelector('#profilePinsGrid');
        const savedIds = getSavedPinIds();
        const savedPins = savedIds.length
            ? pins.filter((pin) => savedIds.includes(String(pin.pin_id)))
            : [];
        // У текущего API нет отдельной выдачи сохранений — используем ленту,
        // пока пользователь ещё не сохранил пины локально или список не совпал.
        const visiblePins = savedPins.length ? savedPins : pins;

        grid.replaceChildren();
        const fragment = document.createDocumentFragment();
        visiblePins.forEach((pin) => fragment.append(new PinCard(pin).render()));
        grid.append(fragment);

        this.showContentMessage(visiblePins.length ? '' : 'Пока нет сохранённых пинов.');
    }

    /**
     * Рендерит сетку досок.
     *
     * @param {Array<Object>} boards
     */
    renderBoards(boards) {
        const grid = this.element.querySelector('#profileBoardsGrid');
        grid.replaceChildren();

        const fragment = document.createDocumentFragment();
        boards.forEach((board) => fragment.append(new BoardCard(board).render()));
        grid.append(fragment);

        this.showContentMessage('');
    }

    /**
     * Показывает или скрывает сообщение под сеткой.
     *
     * @param {string} message
     */
    showContentMessage(message) {
        const state = this.element.querySelector('#profileContentState');
        state.textContent = message;
        state.hidden = !message;
    }

    /**
     * Подключает обработчик кнопки создания.
     */
    setupEvents() {
        const button = this.element.querySelector('#profileActionButton');
        const message = this.element.querySelector('#profileActionMessage');

        button.addEventListener('click', () => {
            const type = this.activeTab === 'pins' ? 'pin' : 'board';
            window.dispatchEvent(new CustomEvent('pickking:create', { detail: { type } }));
            message.textContent = this.activeTab === 'pins'
                ? 'Форма создания пина пока не подключена.'
                : 'Форма создания доски пока не подключена.';
            message.hidden = false;
        });
    }

    /**
     * Обновляет шапку после изменения состояния авторизации.
     */
    refreshHeader() {
        this.header?.refresh();
    }

    /**
     * Освобождает ресурсы страницы перед переходом на другой маршрут.
     */
    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
