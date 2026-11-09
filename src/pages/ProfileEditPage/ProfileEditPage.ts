import {
    deleteMyProfile,
    fetchMyProfile,
    logoutUser,
    updateMyProfile,
    resolveAvatarUrl,
} from '../../api/user';
import { Header } from '../../components/Header/Header';
import template from './ProfileEditPage.hbs';

/**
 * Страница редактирования и удаления профиля.
 * Эндпоинты:
 *  - GET/PATCH/DELETE /api/v1/users/me
 *  - POST /api/v1/users/me/avatar (multipart)
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
        /** @type {File|null} */
        this.pendingAvatarFile = null;
        /** @type {string|null} objectURL для локального предпросмотра */
        this.previewObjectUrl = null;
        /** @type {boolean} пользователь нажал «Удалить» */
        this.avatarCleared = false;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());

        this.setupEvents();
        this.setupAvatarUpload();

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

            // Сбрасываем локальные состояния аватара — они относятся к «ещё не сохранённому» выбору.
            this.pendingAvatarFile = null;
            this.avatarCleared = false;
            this.element.querySelector('#profileEditAvatarInput').value = '';
            this.updateAvatarPreview(this.profile.avatar_url || '');

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

    /**
     * Подключает выбор файла аватара: drag&drop, выбор по клику, предпросмотр, удаление.
     */
    setupAvatarUpload() {
        const fileInput = this.element.querySelector('#profileEditAvatarInput');
        const dropzone = this.element.querySelector('#profileAvatarDropzone');
        const removeBtn = this.element.querySelector('#profileAvatarRemoveBtn');
        const errorEl = this.element.querySelector('#profileAvatarError');

        const showError = (message) => {
            if (!errorEl) return;
            errorEl.textContent = message;
            errorEl.hidden = !message;
        };

        const validateFile = (file) => {
            const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
            if (file.type && !allowed.has(file.type.toLowerCase())) {
                return 'Поддерживаются только JPEG, PNG, GIF и WebP.';
            }
            if (file.size > 10 * 1024 * 1024) {
                return 'Размер файла не должен превышать 10 МБ.';
            }
            return '';
        };

        const applyFile = (file) => {
            const validation = validateFile(file);
            if (validation) {
                showError(validation);
                fileInput.value = '';
                return;
            }
            showError('');
            this.avatarCleared = false;
            this.pendingAvatarFile = file;
            this.renderLocalPreview(file);
        };

        fileInput.addEventListener('change', () => {
            const [file] = fileInput.files || [];
            if (file) applyFile(file);
        });

        // Drag&drop на кружок
        dropzone.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropzone.classList.add('is-dragging');
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('is-dragging');
        });
        dropzone.addEventListener('drop', (event) => {
            event.preventDefault();
            dropzone.classList.remove('is-dragging');
            const [file] = event.dataTransfer?.files || [];
            if (file) applyFile(file);
        });

        removeBtn.addEventListener('click', () => {
            // Отменяем и локальный выбор, и текущее значение с сервера.
            this.revokePreviewUrl();
            this.pendingAvatarFile = null;
            this.avatarCleared = true;
            fileInput.value = '';
            showError('');
            this.updateAvatarPreview('');
            // Кнопка «Удалить» больше не нужна — превью уже пустое.
            removeBtn.hidden = true;
        });
    }

    /** Создаёт objectURL и показывает предпросмотр выбранного файла. */
    renderLocalPreview(file) {
        this.revokePreviewUrl();
        this.previewObjectUrl = URL.createObjectURL(file);
        this.updateAvatarPreview(this.previewObjectUrl, true);
        const removeBtn = this.element.querySelector('#profileAvatarRemoveBtn');
        if (removeBtn) removeBtn.hidden = false;
    }

    /**
     * Обновляет картинку/плейсхолдер и кнопку «Удалить».
     *
     * @param {string} srcOrRawUrl — либо готовый objectURL (isLocalPreview=true),
     *   либо «сырое» значение avatar_url с сервера.
     * @param {boolean} [isLocalPreview=false]
     */
    updateAvatarPreview(srcOrRawUrl, isLocalPreview = false) {
        const preview = this.element.querySelector('#profileAvatarPreview');
        const placeholder = this.element.querySelector('#profileAvatarPlaceholder');
        const removeBtn = this.element.querySelector('#profileAvatarRemoveBtn');
        if (!preview || !placeholder) return;

        const hasValue = Boolean(srcOrRawUrl);
        preview.onerror = null;

        if (hasValue) {
            preview.src = isLocalPreview ? srcOrRawUrl : resolveAvatarUrl(srcOrRawUrl);
            preview.hidden = false;
            placeholder.hidden = true;
            preview.onerror = () => {
                preview.hidden = true;
                placeholder.hidden = false;
            };
        } else {
            preview.removeAttribute('src');
            preview.hidden = true;
            placeholder.hidden = false;
        }

        if (removeBtn) removeBtn.hidden = !hasValue;
    }

    revokePreviewUrl() {
        if (this.previewObjectUrl) {
            URL.revokeObjectURL(this.previewObjectUrl);
            this.previewObjectUrl = null;
        }
    }

    /** PATCH /users/me — единый запрос (JSON или multipart) в зависимости от изменений. */
    async submitForm(event) {
        event.preventDefault();

        const nameInput = this.element.querySelector('#profileEditName');
        const tagInput = this.element.querySelector('#profileEditTag');
        const descriptionInput = this.element.querySelector('#profileEditDescription');
        const submitBtn = this.element.querySelector('#profileEditSubmit');

        const name = nameInput.value.trim();
        const userTag = tagInput.value.trim();
        const description = descriptionInput.value.trim();

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

        const patch: any = {};
        const prev = this.profile || {};

        if (name !== (prev.name || '')) patch.name = name;
        if (userTag !== (prev.user_tag || '')) patch.user_tag = userTag;

        const prevDescription = prev.description || '';
        if (description !== prevDescription) patch.description = description || null;

        // Новый файл → загружаем. Пользователь нажал «Удалить» → чистим.
        const avatarFile = this.pendingAvatarFile;
        const shouldClearAvatar = this.avatarCleared && Boolean(prev.avatar_url);
        if (shouldClearAvatar) {
            patch.avatar_url = null;
        }

        const hasAvatarChanges = Boolean(avatarFile) || shouldClearAvatar;
        if (!hasAvatarChanges && !Object.keys(patch).length) {
            this.showMessage('Нет изменений.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Сохранение…';

        try {
            // Один запрос: либо JSON, либо unified multipart PATCH.
            const updated = await updateMyProfile(patch, avatarFile);
            if (this.isDestroyed || !this.element?.isConnected) return;

            this.profile = updated;
            this.pendingAvatarFile = null;
            this.avatarCleared = false;
            this.revokePreviewUrl();
            this.element.querySelector('#profileEditAvatarInput').value = '';

            localStorage.setItem('userName', updated.name || '');
            localStorage.setItem('userTag', updated.user_tag || '');
            localStorage.setItem('userAvatarUrl', updated.avatar_url || '');

            this.updateAvatarPreview(updated.avatar_url || '');
            this.router.refreshHeader();
            this.showMessage('Профиль сохранён.');
        } catch (error) {
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
        this.revokePreviewUrl();
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
