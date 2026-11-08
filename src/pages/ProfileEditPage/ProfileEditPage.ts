import {
    deleteMyProfile,
    fetchMyProfile,
    logoutUser,
    updateMyProfile,
} from '../../api/user';
import { Header } from '../../components/Header/Header';
import template from './ProfileEditPage.hbs';

/**
 * Страница редактирования и удаления профиля.
 * Эндпоинты: GET/PATCH/DELETE /api/v1/users/me.
 */
export class ProfileEditPage {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router]
     */
    constructor({ router }: any = {}) {
        this.router = router;
        this.element = null;
        this.header = null;
        this.profile = null;
        this.isDestroyed = false;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());

        this.setupEvents();
        const submitButton = this.element.querySelector('#profileEditSubmit');
        const deleteButton = this.element.querySelector('#profileDeleteButton');
        if (submitButton) submitButton.disabled = true;
        if (deleteButton) deleteButton.disabled = true;
        void this.loadProfile();
        return this.element;
    }

    /** Загружает текущий профиль с сервера (GET /users/me). */
    async loadProfile() {
        try {
            this.profile = await fetchMyProfile();
            if (this.isDestroyed || !this.element?.isConnected) return;

            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userId', String(this.profile.user_id));
            localStorage.setItem('userName', this.profile.name || '');
            localStorage.setItem('userTag', this.profile.user_tag || '');
            localStorage.setItem('userAvatarUrl', this.profile.avatar_url || '');
            this.router.refreshHeader();

            this.element.querySelector('#profileEditName').value = this.profile.name || '';
            this.element.querySelector('#profileEditTag').value = this.profile.user_tag || '';
            this.element.querySelector('#profileEditDescription').value = this.profile.description ?? '';
            this.element.querySelector('#profileEditAvatar').value = this.profile.avatar_url || '';
            this.element.querySelector('#profileEditSubmit').disabled = false;
            this.element.querySelector('#profileDeleteButton').disabled = false;
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            if (error.status === 401) {
                this.showMessage('Сессия не найдена или истекла. Войдите в аккаунт, чтобы редактировать профиль.');
                const submitButton = this.element.querySelector('#profileEditSubmit');
                if (submitButton) submitButton.disabled = true;
            } else {
                this.showMessage(error.message || 'Не удалось загрузить профиль.');
            }
        }
    }

    setupEvents() {
        this.element.querySelector('#profileEditForm')
            .addEventListener('submit', (event) => void this.submitForm(event));

        const deleteModal = this.element.querySelector('#profileDeleteModal');
        this.element.querySelector('#profileDeleteButton').addEventListener('click', () => {
            deleteModal.hidden = false;
        });
        const closeModal = () => { deleteModal.hidden = true; };
        this.element.querySelector('#profileDeleteClose').addEventListener('click', closeModal);
        this.element.querySelector('#profileDeleteCancel').addEventListener('click', closeModal);
        this.element.querySelector('#profileDeleteConfirm').addEventListener('click', () => void this.deleteAccount());
    }

    /** PATCH /users/me — отправляет только изменённые поля. */
    async submitForm(event) {
        event.preventDefault();

        const nameInput = this.element.querySelector('#profileEditName');
        const tagInput = this.element.querySelector('#profileEditTag');
        const descriptionInput = this.element.querySelector('#profileEditDescription');
        const avatarInput = this.element.querySelector('#profileEditAvatar');
        const submitBtn = this.element.querySelector('#profileEditSubmit');

        const name = nameInput.value.trim();
        const userTag = tagInput.value.trim();
        const description = descriptionInput.value.trim();
        const avatarUrl = avatarInput.value.trim();

        this.showMessage('');

        if (!name) {
            this.showMessage('Имя не может быть пустым.');
            nameInput.focus();
            return;
        }
        if (!userTag) {
            this.showMessage('Никнейм не может быть пустым.');
            tagInput.focus();
            return;
        }

        // Формируем патч только из изменённых полей.
        // description/avatar_url передаём как null, если пользователь очистил поле.
        const patch: any = {};
        const prev = this.profile || {};

        if (name !== (prev.name || '')) patch.name = name;
        if (userTag !== (prev.user_tag || '')) patch.user_tag = userTag;

        const prevDescription = prev.description || '';
        if (description !== prevDescription) patch.description = description || null;

        const prevAvatar = prev.avatar_url || '';
        if (avatarUrl !== prevAvatar) patch.avatar_url = avatarUrl || null;

        if (!Object.keys(patch).length) {
            this.showMessage('Нет изменений.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Сохранение…';

        try {
            const updated = await updateMyProfile(patch);
            if (this.isDestroyed || !this.element?.isConnected) return;

            this.profile = updated;

            // Синхронизируем локальное состояние, чтобы Header и другие страницы
            // показали новые значения без полной перезагрузки.
            localStorage.setItem('userName', updated.name || '');
            localStorage.setItem('userTag', updated.user_tag || '');
            localStorage.setItem('userAvatarUrl', updated.avatar_url || '');

            this.router.refreshHeader();
            this.showMessage('Профиль сохранён.');
        } catch (error) {
            // 409 — занятый user_tag
            this.showMessage(error.message || 'Не удалось сохранить профиль.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Сохранить';
        }
    }

    /**
     * DELETE /users/me.
     * Внимание: по контракту бэкенд не отзывает JWT и не чистит cookie,
     * поэтому фронт сам сбрасывает локальную авторизацию и уходит на главную.
     */
    async deleteAccount() {
        const confirmBtn = this.element.querySelector('#profileDeleteConfirm');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Удаление…';

        try {
            await deleteMyProfile();
        } catch (error) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Удалить';
            this.element.querySelector('#profileDeleteModal').hidden = true;
            this.showMessage(error.message || 'Не удалось удалить аккаунт.');
            return;
        }

        // Пытаемся закрыть серверную сессию (logout), но не блокируемся на ошибке.
        try {
            await logoutUser();
        } catch {
            // сессия могла уже стать невалидной после soft-delete
        }

        localStorage.removeItem('isAuth');
        localStorage.removeItem('userName');
        localStorage.removeItem('userId');
        localStorage.removeItem('userTag');
        localStorage.removeItem('userAvatarUrl');

        this.router.refreshHeader();
        this.router.navigateTo('/');
    }

    showMessage(message) {
        const el = this.element?.querySelector('#profileEditMessage');
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;
    }

    refreshHeader() {
        this.header?.refresh();
    }

    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}