// FIX: убраны несуществующие экспорты fetchPinInteractions и setPinSaved.
// FIX: добавлен недостающий импорт fetchPinLikesStatistics.
import { resolveImageUrl } from '../../api/user.js';
import {
    createPinComment,
    fetchPinById,
    fetchPinComments,
    fetchPinLikesStatistics,
    fetchPins,
    setPinLiked,
} from '../../api/user.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import { Header } from '../../components/Header/Header.js';
import template from './PinPage.hbs';

/** Страница просмотра одного пина. */
export class PinPage {
    /**
     * @param {string|number} pinId
     * @param {Object} [options]
     * @param {import('../../routes.js').Router} [options.router]
     */
    constructor(pinId, { router } = {}) {
        this.pinId = String(pinId);
        this.router = router;
        this.pin = null;
        this.element = null;
        this.header = null;
        this.loadingTimer = null;
        this.isDestroyed = false;
        this.interactions = { is_liked: false, likes_count: 0 };
        this.comments = [];
    }

    render() {
        const backUrl = this.router?.getBackUrl('/home') || '/home';
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({ backUrl });
        this.element = wrapper.firstElementChild;
        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        this.setupEvents();
        void this.loadData();
        return this.element;
    }

    /** Загружает данные пина с сервера. */
    async loadData() {
        this.loadingTimer = setTimeout(() => {
            this.element?.querySelector('#pinLoading')?.removeAttribute('hidden');
        }, 600);

        try {
            this.pin = await fetchPinById(this.pinId);
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.renderPin();
            void this.loadRecommendations();
            void this.loadPinDetails();
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.element.querySelector('#pinLoading').hidden = true;
            this.element.querySelector('#pinError').hidden = false;
            this.element.querySelector('#pinErrorMessage').textContent = error.message || 'Ошибка загрузки';
        } finally {
            clearTimeout(this.loadingTimer);
            this.loadingTimer = null;
        }
    }

    /** Загружает лайки и комментарии с backend. */
    async loadPinDetails() {
        const [likesResult, commentsResult] = await Promise.allSettled([
            // Используем контрактный метод получения статистики лайков
            fetchPinLikesStatistics(this.pinId),
            fetchPinComments(this.pinId),
        ]);
        if (this.isDestroyed || !this.element?.isConnected) return;

        if (likesResult.status === 'fulfilled') {
            // Наш бэкенд возвращает likes_count и liked_by_me
            this.interactions.likes_count = likesResult.value.likes_count;
            this.interactions.is_liked = likesResult.value.liked_by_me;
            this.updateLike();
        } else {
            this.showActionMessage('Не удалось загрузить статистику лайков.');
        }

        if (commentsResult.status === 'fulfilled') {
            this.comments = commentsResult.value;
            this.renderComments();
        }
    }

    /** Загружает рекомендации. */
    async loadRecommendations() {
        try {
            const result = await fetchPins(36);
            if (this.isDestroyed || !this.element?.isConnected) return;
            const otherPins = (result.pins || []).filter((pin) => String(pin.pin_id) !== this.pinId);
            this.renderRecommendations(otherPins);
        } catch (error) {
            console.warn('Не удалось загрузить рекомендации', error);
        }
    }

    /** Заполняет основной блок данными пина. */
    renderPin() {
        const img = this.element.querySelector('#pinMainImage');
        img.src = resolveImageUrl(this.pin.image_url);
        img.alt = this.pin.name || 'Пин';
        img.onerror = () => img.classList.add('pin-main-image--failed');

        const title = this.element.querySelector('#pinTitle');
        const name = this.pin.name || '';
        if (name && !/^pin\s*#?\s*\d+$/i.test(name.trim())) {
            title.textContent = name;
            title.hidden = false;
        } else {
            title.hidden = true;
        }

        const description = this.element.querySelector('#pinDescription');
        description.textContent = this.pin.description || '';
        description.hidden = !this.pin.description;

        const isMyPin = String(this.pin.creator_id) === localStorage.getItem('userId');
        const authorName = isMyPin ? (localStorage.getItem('userName') || 'Вы') : 'Автор пина';
        this.element.querySelector('#pinAuthorName').textContent = authorName;

        const avatar = this.element.querySelector('#pinAuthorAvatar');
        const avatarUrl = isMyPin ? localStorage.getItem('userAvatarUrl') : '';
        avatar.replaceChildren();
        if (avatarUrl) {
            const avatarImage = document.createElement('img');
            avatarImage.src = resolveImageUrl(avatarUrl);
            avatarImage.alt = '';
            avatar.append(avatarImage);
            avatar.classList.add('pin-author-avatar--image');
        } else {
            avatar.textContent = authorName.charAt(0).toUpperCase();
            avatar.classList.remove('pin-author-avatar--image');
        }

        this.element.querySelector('#pinLoading').hidden = true;
        this.element.querySelector('#pinLayout').hidden = false;
        this.updateLike();
        this.renderComments();
    }

    /** Отрисовывает рекомендации по бокам и снизу. */
    renderRecommendations(otherPins) {
        const sideBox = this.element.querySelector('#pinSideRecommendations');
        const bottomBox = this.element.querySelector('#pinBottomRecommendations');
        sideBox.replaceChildren();
        bottomBox.replaceChildren();
        otherPins.slice(0, 10).forEach((pin) => sideBox.append(new PinCard(pin).render()));
        otherPins.slice(10).forEach((pin) => bottomBox.append(new PinCard(pin).render()));
    }

    /** Подключает кнопки лайка, поделиться и комментариев. */
    setupEvents() {
        this.element.querySelector('[data-action="like"]').addEventListener('click', () => {
            void this.changeLike();
        });

        const shareButton = this.element.querySelector('[data-action="share"]');
        shareButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                shareButton.textContent = '✓';
                shareButton.classList.add('is-active');
                setTimeout(() => {
                    if (!this.isDestroyed) {
                        shareButton.textContent = '↗';
                        shareButton.classList.remove('is-active');
                    }
                }, 1500);
            } catch {
                this.showActionMessage('Не удалось скопировать ссылку.');
            }
        });

        this.element.querySelector('#pinCommentForm').addEventListener('submit', (event) => {
            void this.submitComment(event);
        });
    }

    /**
     * Меняет состояние лайка через API.
     * FIX: ответ приходит с полем liked_by_me, а не is_liked — маппим явно,
     * иначе сердечко не переключалось.
     */
    async changeLike() {
        const button = this.element.querySelector('[data-action="like"]');
        button.disabled = true;
        try {
            const result = await setPinLiked(this.pinId, !this.interactions.is_liked);
            this.interactions.likes_count = result.likes_count;
            this.interactions.is_liked = result.liked_by_me;
            this.updateLike();
            this.showActionMessage('');
        } catch (error) {
            this.showActionMessage(error.message || 'Не удалось изменить отметку «Нравится».');
        } finally {
            button.disabled = false;
        }
    }

    /** Отправляет новый комментарий на сервер. */
    async submitComment(event) {
        event.preventDefault();
        const input = this.element.querySelector('#pinCommentInput');
        const text = input.value.trim();
        if (!text) return;

        try {
            const comment = await createPinComment(this.pinId, text);
            this.comments.push(comment);
            input.value = '';
            this.renderComments();
            this.showActionMessage('');
        } catch (error) {
            this.showActionMessage(error.message || 'Не удалось добавить комментарий.');
        }
    }

    /** Обновляет кнопку лайка по данным сервера. */
    updateLike() {
        const button = this.element?.querySelector('[data-action="like"]');
        if (!button) return;
        button.classList.toggle('is-active', Boolean(this.interactions.is_liked));
        button.querySelector('.pin-heart').textContent = this.interactions.is_liked ? '♥' : '♡';
        button.querySelector('[data-like-count]').textContent = this.interactions.likes_count || 0;
        button.setAttribute('aria-pressed', String(Boolean(this.interactions.is_liked)));
    }

    /** Отрисовывает комментарии, полученные с сервера. */
    renderComments() {
        const list = this.element?.querySelector('#pinCommentsList');
        if (!list) return;
        list.replaceChildren();

        this.comments.forEach((comment) => {
            const item = document.createElement('article');
            item.className = 'pin-comment';
            const author = document.createElement('strong');
            author.textContent = comment.author || 'Пользователь';
            const text = document.createElement('p');
            text.textContent = comment.text || '';
            item.append(author, text);
            list.append(item);
        });
        this.element.querySelector('#pinCommentsCount').textContent = this.comments.length;
    }

    /** Показывает сообщение о результате действия. */
    showActionMessage(message) {
        const element = this.element?.querySelector('#pinActionMessage');
        if (!element) return;
        element.textContent = message;
        element.hidden = !message;
    }

    /** Обновляет шапку после изменения авторизации. */
    refreshHeader() {
        this.header?.refresh();
    }

    /** Очищает таймеры и ресурсы страницы. */
    destroy() {
        this.isDestroyed = true;
        clearTimeout(this.loadingTimer);
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}