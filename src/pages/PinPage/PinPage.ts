import { resolveImageUrl, resolveAvatarUrl, DEFAULT_AVATAR_URL } from '../../api/user';
import {
    addPinsToBoard,
    fetchMyDesks,
    createPinComment,
    fetchPinById,
    fetchPinComments,
    fetchPinLikesStatistics,
    fetchPins,
    setPinLiked,
    updatePin,
    deletePin,
} from '../../api/user';
import { PinCard } from '../../components/PinCard/PinCard';
import { Header } from '../../components/Header/Header';
import template from './PinPage.hbs';
const COMMENTS_UNAVAILABLE = 'Чатик пока не работает, но скоро будет :P';

/** Страница просмотра одного пина. */
export class PinPage {
    [key: string]: any;
    /**
     * @param {string|number} pinId
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router]
     */
    constructor(pinId, { router }: any = {}) {
        this.pinId = String(pinId);
        this.router = router;
        this.pin = null;
        this.element = null;
        this.header = null;
        this.loadingTimer = null;
        this.isDestroyed = false;
        this.interactions = { is_liked: false, likes_count: 0 };
        this.comments = [];
        this.recommendationsObservers = [];
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
            this.interactions.is_liked = Boolean(likesResult.value.liked_by_me ?? likesResult.value.is_liked ?? false);
            this.updateLike();
        } else {
            this.showActionMessage('Не удалось загрузить статистику лайков.');
        }

        if (commentsResult.status === 'fulfilled') {
            this.comments = commentsResult.value;
            this.setCommentComposerEnabled(true);
            this.renderComments();
        } else {
            const error = commentsResult.reason;
            const isMissingEndpoint = error?.status === 404;
            this.renderCommentsMessage(isMissingEndpoint
                ? COMMENTS_UNAVAILABLE
                : 'Не удалось загрузить комментарии.');
            if (isMissingEndpoint) this.setCommentComposerEnabled(false);
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
        const ownerActions = this.element.querySelector('#pinOwnerActions');
        if (ownerActions) ownerActions.hidden = !isMyPin;
        const authorName = isMyPin ? (localStorage.getItem('userName') || 'Вы') : 'Автор пина';
        this.element.querySelector('#pinAuthorName').textContent = authorName;

        const avatar = this.element.querySelector('#pinAuthorAvatar');
        const avatarUrl = isMyPin ? localStorage.getItem('userAvatarUrl') : '';
        avatar.replaceChildren();
        const avatarImage = document.createElement('img');
        avatarImage.src = resolveAvatarUrl(avatarUrl);
        avatarImage.alt = '';
        avatarImage.addEventListener('error', () => { avatarImage.src = DEFAULT_AVATAR_URL; }, { once: true });
        avatar.append(avatarImage);
        avatar.classList.add('pin-author-avatar--image');


        this.element.querySelector('#pinLoading').hidden = true;
        this.element.querySelector('#pinLayout').hidden = false;
        this.updateLike();
        this.renderComments();
    }

    /**
     * Две независимые бесконечные ленты рекомендаций
     */
    async loadRecommendations() {
        const PAGE_SIZE = 30;
        const BATCH_SIZE = 8;

        const sideBox = this.element?.querySelector('#pinSideRecommendations');
        const bottomBox = this.element?.querySelector('#pinBottomRecommendations');
        const sideSentinel = this.element?.querySelector('#pinSideRecommendationsSentinel');
        const bottomSentinel = this.element?.querySelector('#pinBottomRecommendationsSentinel');
        if (!sideBox || !bottomBox || !sideSentinel || !bottomSentinel) return;

        let nextCursor: any = null;
        const queue: any[] = [];
        let pagePromise: Promise<void> | null = null;
        let hasMore = true;
        const seen = new Set<string>([this.pinId]);

        const columnCount = (container: Element) => container.id === 'pinSideRecommendations' ? 2 : 4;
        const columnsByContainer = new Map<Element, HTMLElement[]>();
        const nextColumnByContainer = new Map<Element, number>();
        const getColumns = (container: Element) => {
            let columns = columnsByContainer.get(container);
            if (!columns) {
                columns = Array.from({ length: columnCount(container) }, () => {
                    const column = document.createElement('div');
                    column.className = 'pin-masonry-column';
                    container.appendChild(column);
                    return column;
                });
                columnsByContainer.set(container, columns);
                nextColumnByContainer.set(container, 0);
            }
            return columns;
        };
        const appendTo = (container: Element, pins: any[]) => {
            const columns = getColumns(container);
            let next = nextColumnByContainer.get(container) || 0;
            pins.forEach((pin) => {
                // Не пересчитываем раскладку при догрузке: уже показанные карточки остаются на месте.
                columns[next % columns.length].appendChild(new PinCard(pin).render());
                next += 1;
            });
            nextColumnByContainer.set(container, next);
        };

        const ensureQueue = async () => {
            if (queue.length || !hasMore || this.isDestroyed) return;

            if (!pagePromise) {
                pagePromise = (async () => {
                    const data = await fetchPins(PAGE_SIZE, nextCursor);
                    if (this.isDestroyed || !this.element?.isConnected) return;

                    const raw = data.pins || [];
                    if (!raw.length) {
                        // Конец выдачи: начинаем новый цикл с первой страницы,
                        // чтобы бесконечная лента не останавливалась на последнем пине.
                        if (seen.size <= 1) {
                            hasMore = false;
                            return;
                        }
                        seen.clear();
                        seen.add(this.pinId);
                        nextCursor = null;
                        const restarted = await fetchPins(PAGE_SIZE, null);
                        if (this.isDestroyed || !this.element?.isConnected) return;
                        const restartedPins = restarted.pins || [];
                        if (!restartedPins.length) {
                            hasMore = false;
                            return;
                        }
                        nextCursor = restarted.next_cursor ?? null;
                        const restartedFresh = restartedPins.filter((pin) => !seen.has(String(pin.pin_id)));
                        if (!restartedFresh.length) {
                            hasMore = false;
                            return;
                        }
                        restartedFresh.forEach((pin) => seen.add(String(pin.pin_id)));
                        queue.push(...restartedFresh);
                        return;
                    }

                    nextCursor = data.next_cursor ?? null;
                    let fresh = raw.filter((pin) => !seen.has(String(pin.pin_id)));

                    // Все пины текущего цикла уже показаны: начинаем следующий,
                    // но по-прежнему исключаем открытый пин из рекомендаций.
                    if (!fresh.length) {
                        seen.clear();
                        seen.add(this.pinId);
                        nextCursor = null;
                        const restarted = await fetchPins(PAGE_SIZE, null);
                        if (this.isDestroyed || !this.element?.isConnected) return;
                        const restartedPins = restarted.pins || [];
                        if (!restartedPins.length) {
                            hasMore = false;
                            return;
                        }
                        nextCursor = restarted.next_cursor ?? null;
                        fresh = restartedPins.filter((pin) => !seen.has(String(pin.pin_id)));
                    }

                    if (!fresh.length) {
                        hasMore = false;
                        return;
                    }
                    fresh.forEach((pin) => seen.add(String(pin.pin_id)));
                    queue.push(...fresh);
                })().finally(() => {
                    pagePromise = null;
                });
            }

            await pagePromise;
        };

        const appendBatch = async (container: Element, count = BATCH_SIZE) => {
            let remaining = count;
            while (remaining > 0 && hasMore && !this.isDestroyed && this.element?.isConnected) {
                if (!queue.length) await ensureQueue();
                if (!queue.length) break;
                const portion = queue.splice(0, Math.min(remaining, queue.length));
                appendTo(container, portion);
                remaining -= portion.length;
            }
        };

        // Сначала наполняем обе колонки, чтобы лента была видна без прокрутки.
        try {
            await appendBatch(sideBox, BATCH_SIZE);
            await appendBatch(bottomBox, BATCH_SIZE);
        } catch (error) {
            console.warn('Не удалось загрузить рекомендации', error);
        }

        if (!('IntersectionObserver' in window) || this.isDestroyed) return;

        const observeFeed = (container: Element, sentinel: Element) => {
            const observer = new IntersectionObserver((entries) => {
                if (this.isDestroyed || !sentinel.isConnected) {
                    observer.disconnect();
                    this.recommendationsObservers = this.recommendationsObservers.filter((item) => item !== observer);
                    return;
                }
                if (!entries.some((entry) => entry.isIntersecting)) return;

                void appendBatch(container, BATCH_SIZE)
                    .catch((error) => console.warn('Не удалось догрузить рекомендации', error))
                    .finally(() => {
                        // Повторное наблюдение важно, если после вставки карточек
                        // sentinel всё ещё остаётся в зоне rootMargin.
                        if (!this.isDestroyed && sentinel.isConnected) {
                            observer.unobserve(sentinel);
                            observer.observe(sentinel);
                        }
                    });
            }, { rootMargin: '800px 0px' });

            this.recommendationsObservers.push(observer);
            observer.observe(sentinel);
        };

        observeFeed(sideBox, sideSentinel);
        observeFeed(bottomBox, bottomSentinel);
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
                const original = shareButton.innerHTML;
                shareButton.innerHTML = '<svg class="icon pin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
                shareButton.classList.add('is-active');
                setTimeout(() => {
                    if (!this.isDestroyed) {
                        shareButton.innerHTML = original;
                        shareButton.classList.remove('is-active');
                    }
                }, 1500);
            } catch {
                this.showActionMessage('Не удалось скопировать ссылку.');
            }
        });

        const saveModal = this.element.querySelector('#pinSaveModal');
        this.element.querySelector('[data-action="save"]').addEventListener('click', () => void this.openSaveModal());
        this.element.querySelector('#pinSaveClose').addEventListener('click', () => { saveModal.hidden = true; });
        saveModal.addEventListener('click', (e) => { if (e.target === saveModal) saveModal.hidden = true; });

        const editModal = this.element.querySelector('#pinEditModal');
        const deleteModal = this.element.querySelector('#pinDeleteModal');
        this.element.querySelector('#pinEditButton').addEventListener('click', () => this.openEditPin());
        this.element.querySelector('#pinEditClose').addEventListener('click', () => { editModal.hidden = true; });
        this.element.querySelector('#pinEditCancel').addEventListener('click', () => { editModal.hidden = true; });
        editModal.addEventListener('click', (event) => { if (event.target === editModal) editModal.hidden = true; });
        this.element.querySelector('#pinEditForm').addEventListener('submit', (event) => void this.saveEditPin(event));
        this.element.querySelector('#pinDeleteButton').addEventListener('click', () => { deleteModal.hidden = false; });
        this.element.querySelector('#pinDeleteClose').addEventListener('click', () => { deleteModal.hidden = true; });
        this.element.querySelector('#pinDeleteCancel').addEventListener('click', () => { deleteModal.hidden = true; });
        deleteModal.addEventListener('click', (event) => { if (event.target === deleteModal) deleteModal.hidden = true; });
        this.element.querySelector('#pinDeleteConfirm').addEventListener('click', () => void this.deleteCurrentPin());

        this.element.querySelector('#pinCommentForm').addEventListener('submit', (event) => {
            void this.submitComment(event);
        });
    }

    openEditPin() {
        if (!this.pin || String(this.pin.creator_id) !== localStorage.getItem('userId')) return;
        this.element.querySelector('#pinEditName').value = this.pin.name || '';
        this.element.querySelector('#pinEditDescription').value = this.pin.description || '';
        this.element.querySelector('#pinEditMessage').hidden = true;
        this.element.querySelector('#pinEditModal').hidden = false;
    }

    async saveEditPin(event) {
        event.preventDefault();
        const submitButton = this.element.querySelector('#pinEditSubmit');
        const name = this.element.querySelector('#pinEditName').value.trim();
        const description = this.element.querySelector('#pinEditDescription').value.trim();
        if (!name) {
            this.showEditMessage('Укажите название пина.');
            return;
        }
        submitButton.disabled = true;
        try {
            const updatedPin = await updatePin(this.pinId, { name, description });
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.pin = updatedPin;
            this.renderPin();
            this.element.querySelector('#pinEditModal').hidden = true;
            this.showActionMessage('Пин обновлён.');
        } catch (error) {
            this.showEditMessage(error.message || 'Не удалось обновить пин.');
        } finally {
            submitButton.disabled = false;
        }
    }

    showEditMessage(message) {
        const element = this.element?.querySelector('#pinEditMessage');
        if (!element) return;
        element.textContent = message;
        element.hidden = !message;
    }

    async deleteCurrentPin() {
        if (!this.pin || String(this.pin.creator_id) !== localStorage.getItem('userId')) return;
        const button = this.element.querySelector('#pinDeleteConfirm');
        button.disabled = true;
        try {
            await deletePin(this.pinId);
            this.router?.navigateBack('/home');
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            button.disabled = false;
            const message = this.element.querySelector('#pinDeleteMessage');
            message.textContent = error.message || 'Не удалось удалить пин.';
            message.hidden = false;
        }
    }

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
            if (error?.status === 404) {
                this.setCommentComposerEnabled(false);
                this.renderCommentsMessage(COMMENTS_UNAVAILABLE);
                return;
            }
            this.showActionMessage(error.message || 'Не удалось добавить комментарий.');
        }
    }

    async openSaveModal() {
        if (localStorage.getItem('isAuth') !== 'true') {
            this.showActionMessage('Войдите в аккаунт, чтобы сохранить пин на доску.');
            return;
        }
        const modal = this.element.querySelector('#pinSaveModal');
        const list = this.element.querySelector('#pinSaveList');
        this.showSaveMessage('');
        list.textContent = 'Загружаем доски…';
        modal.hidden = false;

        try {
            const desks = await fetchMyDesks();
            if (this.isDestroyed || !this.element?.isConnected) return;
            list.replaceChildren();
            if (!desks.length) {
                list.textContent = 'У вас пока нет досок.';
                return;
            }
            desks.forEach((desk) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'pin-save-option';
                option.textContent = desk.name || 'Без названия';
                option.addEventListener('click', () => void this.saveToBoard(desk.desk_id, option));
                list.append(option);
            });
        } catch (error) {
            list.textContent = '';
            this.showSaveMessage(error.message || 'Не удалось загрузить доски.');
        }
    }

    async saveToBoard(deskId, option) {
        option.disabled = true;
        try {
            await addPinsToBoard(deskId, [this.pinId]);
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.element.querySelector('#pinSaveModal').hidden = true;
            const saveBtn = this.element.querySelector('[data-action="save"]');
            saveBtn.textContent = 'Сохранено ✓';
            setTimeout(() => { if (!this.isDestroyed && saveBtn) saveBtn.textContent = 'Сохранить'; }, 2000);
        } catch (error) {
            option.disabled = false;
            this.showSaveMessage(error.message || 'Не удалось сохранить пин.');
        }
    }

    showSaveMessage(message) {
        const el = this.element?.querySelector('#pinSaveMessage');
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;
    }

    /** Обновляет кнопку лайка по данным сервера. */
    updateLike() {
        const button = this.element?.querySelector('[data-action="like"]');
        if (!button) return;
        button.classList.toggle('is-active', Boolean(this.interactions.is_liked));
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
        if (!this.comments.length) this.renderCommentsMessage('Пока нет комментариев.');
        this.element.querySelector('#pinCommentsCount').textContent = this.comments.length;
    }

    /** Показывает честное состояние вместо пустого списка при ошибке API. */
    renderCommentsMessage(message) {
        const list = this.element?.querySelector('#pinCommentsList');
        if (!list) return;
        list.replaceChildren();
        const state = document.createElement('p');
        state.className = 'pin-comments-empty';
        state.textContent = message;
        list.append(state);
        const count = this.element.querySelector('#pinCommentsCount');
        if (count) count.textContent = this.comments.length;
    }

    /** Отключает отправку комментариев, если соответствующего API нет. */
    setCommentComposerEnabled(enabled) {
        const input = this.element?.querySelector('#pinCommentInput');
        const button = this.element?.querySelector('#pinCommentForm button[type="submit"]');
        if (input) {
            input.disabled = !enabled;
            input.placeholder = enabled ? 'Добавьте комментарий' : 'Комментарии пока недоступны';
        }
        if (button) button.disabled = !enabled;
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
        this.recommendationsObservers.forEach((observer) => observer.disconnect());
        this.recommendationsObservers = [];
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
