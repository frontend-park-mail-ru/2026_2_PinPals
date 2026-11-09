import { resolveImageUrl,
    resolveAvatarUrl,
    DEFAULT_AVATAR_URL
} from '../../api/user';
import { Header } from '../../components/Header/Header';
import { PinCard } from '../../components/PinCard/PinCard';
import { BoardCard } from '../../components/BoardCard/BoardCard';
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
    [key: string]: any;
    /**
     * @param {Object} options
     * @param {import('../../routes').Router} options.router
     * @param {'pins'|'boards'} [options.activeTab='pins']
     */
    constructor({ router, activeTab = 'pins' }: any = {}) {
        this.router = router;
        this.activeTab = activeTab === 'boards' ? 'boards' : 'pins';
        this.element = null;
        this.header = null;
        this.isDestroyed = false;
        this.profile = null;
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
        const userAvatarUrl = resolveAvatarUrl(localStorage.getItem('userAvatarUrl') || '');
        const followersLabel = 'Подписчики: —';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            userName,
            userAvatarUrl,
            userInitial: userName.trim().charAt(0).toUpperCase() || 'П',
            followersLabel,
            isPinsTab: this.activeTab === 'pins',
            isBoardsTab: this.activeTab === 'boards',
            actionText: this.activeTab === 'pins' ? 'Создать пин' : 'Создать доску',
        });

        this.element = wrapper.firstElementChild;
        const initialAvatar = this.element.querySelector('.profile-avatar');
        if (initialAvatar) this.attachAvatarFallback(initialAvatar);
        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());

        this.setupEvents();
        void this.loadContent();
        return this.element;
    }

    /** Загружает содержимое вкладки с backend. */
    async loadContent() {
        try {
            // The profile endpoint is the source of truth. Do not rely only on
            // stale localStorage values after a refresh or profile update.
            this.profile = await fetchMyProfile();
            if (this.isDestroyed || !this.element?.isConnected) return;

            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userId', String(this.profile.user_id));
            localStorage.setItem('userName', this.profile.name || '');
            localStorage.setItem('userTag', this.profile.user_tag || '');
            localStorage.setItem('userAvatarUrl', this.profile.avatar_url || '');
            this.renderProfileSummary(this.profile);
            this.header?.refresh();

            if (this.activeTab === 'pins') {
                // Dev-only endpoint: not part of the documented API v1 contract.
                const pins = await fetchUserSavedPins(this.profile.user_id);
                if (this.isDestroyed || !this.element?.isConnected) return;
                this.renderPins(pins);
            } else {
                // Contract endpoint: includes private desks owned by current user.
                const boards = await fetchMyDesks();
                if (this.isDestroyed || !this.element?.isConnected) return;
                this.renderBoards(boards);
            }
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            if (error.status === 401) {
                this.header?.refresh();
                this.showContentMessage('Сессия истекла. Войдите в аккаунт, чтобы посмотреть свой профиль.');
                return;
            }
            this.showContentMessage(error.message || 'Не удалось загрузить данные профиля.');
        }
    }

    renderProfileSummary(profile) {
        const name = profile.name || profile.user_tag || 'Пользователь';
        const nameElement = this.element.querySelector('.profile-user-name');
        if (nameElement) nameElement.textContent = name;

        const followersElement = this.element.querySelector('.profile-followers');
        if (followersElement) {
            followersElement.textContent = Number.isFinite(profile.followers_count)
                ? formatFollowers(Number(profile.followers_count))
                : 'Подписчики: —';
        }

        const avatar = this.element.querySelector('.profile-avatar');
        if (avatar) {
            avatar.src = resolveAvatarUrl(profile.avatar_url);
            this.attachAvatarFallback(avatar);
        }
    }

    attachAvatarFallback(image) {
        image.addEventListener('error', () => {
            if (!image.src.endsWith(DEFAULT_AVATAR_URL)) image.src = DEFAULT_AVATAR_URL;
        }, { once: true });
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
