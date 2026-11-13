
import './ProfileEditPage.scss';
import {
    deleteMyProfile,
    fetchMyProfile,
    updateMyProfile,
    resolveAvatarUrl,
} from '../../api/user';
import { Header } from '../../components/Header/Header';
import template from './ProfileEditPage.hbs';
import type { User } from '../../types/models';
import type { Router } from '../../routes';
import type { DomRoot } from '../../types/dom';
import { getErrorMessage, isApiError } from '../../utils/errors';

/**
 * Страница редактирования и удаления профиля.
 * Эндпоинты:
 *  - GET/PATCH/DELETE /api/v1/users/me
 *  - POST /api/v1/users/me/avatar (multipart)
 */
export class ProfileEditPage {
    router?: Router;
    element: DomRoot | null;
    header: Header | null;
    profile: User | null;
    isDestroyed: boolean;
    pendingAvatarFile: File | null;
    previewObjectUrl: string | null;
    avatarCleared: boolean;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router]
     */
    constructor({ router }: { router?: Router } = {}) {
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
        this.element = wrapper.firstElementChild as DomRoot;

        this.header = new Header({ router: this.router, backFallback: '/profile' });
        this.element.prepend(this.header.render());

        this.setupEvents();
        this.setupAvatarUpload();

        const submitButton = this.element.querySelector<HTMLButtonElement>('#profileEditSubmit');
        const deleteButton = this.element.querySelector<HTMLButtonElement>('#profileDeleteButton');
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

            this.element.querySelector<HTMLInputElement>('#profileEditName').value = this.profile.name || '';
            this.element.querySelector<HTMLInputElement>('#profileEditTag').value = this.profile.user_tag || '';
            this.element.querySelector<HTMLInputElement>('#profileEditDescription').value = this.profile.description ?? '';

            // Сбрасываем локальные состояния аватара — они относятся к «ещё не сохранённому» выбору.
            this.pendingAvatarFile = null;
            this.avatarCleared = false;
            this.element.querySelector<HTMLInputElement>('#profileEditAvatarInput').value = '';
            this.updateAvatarPreview(this.profile.avatar_url || '');

            this.element.querySelector<HTMLButtonElement>('#profileEditSubmit').disabled = false;
            this.element.querySelector<HTMLButtonElement>('#profileDeleteButton').disabled = false;
        } catch (error: unknown) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            if (isApiError(error) && error.status === 401) {
                this.router.refreshHeader();
                this.router.navigateTo('/login');
                return;
            }
            this.showMessage(getErrorMessage(error) || 'Не удалось загрузить профиль.');
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
        const fileInput = this.element.querySelector<HTMLInputElement>('#profileEditAvatarInput');
        const dropzone = this.element.querySelector('#profileAvatarDropzone');
        const removeBtn = this.element.querySelector<HTMLButtonElement>('#profileAvatarRemoveBtn');
        const errorEl = this.element.querySelector('#profileAvatarError');

        const showError = (message: string): void => {
            if (!errorEl) return;
            errorEl.textContent = message;
            errorEl.hidden = !message;
        };

        const validateFile = (file: File): string => {
            const allowed = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
            if (file.type && !allowed.has(file.type.toLowerCase())) {
                return 'Поддерживаются только JPEG, PNG, GIF и WebP.';
            }
            if (file.size > 10 * 1024 * 1024) {
                return 'Размер файла не должен превышать 10 МБ.';
            }
            return '';
        };

        const applyFile = (file: File): void => {
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
        dropzone.addEventListener('drop', (event: DragEvent) => {
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
    renderLocalPreview(file: File): void {
        this.revokePreviewUrl();
        this.previewObjectUrl = URL.createObjectURL(file);
        this.updateAvatarPreview(this.previewObjectUrl, true);
        const removeBtn = this.element.querySelector<HTMLButtonElement>('#profileAvatarRemoveBtn');
        if (removeBtn) removeBtn.hidden = false;
    }

    /**
     * Обновляет картинку/плейсхолдер и кнопку «Удалить».
     *
     * @param {string} srcOrRawUrl — либо готовый objectURL (isLocalPreview=true),
     *   либо «сырое» значение avatar_url с сервера.
     * @param {boolean} [isLocalPreview=false]
     */
    updateAvatarPreview(srcOrRawUrl: string, isLocalPreview = false): void {
        const preview = this.element.querySelector<HTMLImageElement>('#profileAvatarPreview');
        const placeholder = this.element.querySelector('#profileAvatarPlaceholder');
        const removeBtn = this.element.querySelector<HTMLButtonElement>('#profileAvatarRemoveBtn');
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

    /** PATCH /users/me + (при необходимости) POST /users/me/avatar. */
    async submitForm(event: Event) {
        event.preventDefault();

        const nameInput = this.element.querySelector<HTMLInputElement>('#profileEditName');
        const tagInput = this.element.querySelector<HTMLInputElement>('#profileEditTag');
        const descriptionInput = this.element.querySelector<HTMLInputElement>('#profileEditDescription');
        const submitBtn = this.element.querySelector<HTMLButtonElement>('#profileEditSubmit');

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

        // Патч только из изменённых текстовых полей.
        const patch: Partial<Pick<User, 'name' | 'user_tag' | 'description' | 'avatar_url'>> = {};
        const prev = this.profile;

        if (name !== (prev?.name || '')) patch.name = name;
        if (userTag !== (prev?.user_tag || '')) patch.user_tag = userTag;

        const prevDescription = prev?.description || '';
        if (description !== prevDescription) patch.description = description || null;

        // Аватар: либо новый файл, либо явная очистка, либо ничего не менялось.
        const hasAvatarFile = this.pendingAvatarFile !== null;
        const hasAvatarRemove = this.avatarCleared && Boolean(prev?.avatar_url);
        const hasTextChanges = Object.keys(patch).length > 0;

        if (!hasAvatarFile && !hasAvatarRemove && !hasTextChanges) {
            this.showMessage('Нет изменений.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Сохранение…';

        try {
            // Если пользователь удалил аватар,
            // отправляем null в JSON-запросе.
            if (hasAvatarRemove) {
                patch.avatar_url = null;
            }

            // Отправляем все изменения одним запросом.
            // Без файла — JSON.
            // С файлом — multipart/form-data.
            const updated = await updateMyProfile(
                patch,
                hasAvatarFile ? this.pendingAvatarFile : null,
            );

            if (this.isDestroyed || !this.element?.isConnected) return;

            this.profile = updated;

            this.pendingAvatarFile = null;
            this.avatarCleared = false;

            this.revokePreviewUrl();

            this.element.querySelector<HTMLInputElement>('#profileEditAvatarInput').value = '';

            localStorage.setItem('userName', updated.name || '');
            localStorage.setItem('userTag', updated.user_tag || '');
            localStorage.setItem('userAvatarUrl', updated.avatar_url || '');

            this.updateAvatarPreview(updated.avatar_url || '');

            this.router.refreshHeader();

            this.showMessage('Профиль сохранён.', true);

        } catch (error: unknown) {
            this.showMessage(
                getErrorMessage(error) || 'Не удалось сохранить профиль.',
            );

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
    async deleteAccount(): Promise<void> {
        const confirmBtn = this.element.querySelector<HTMLButtonElement>('#profileDeleteConfirm');

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Удаление…';

        try {
            await deleteMyProfile();

        } catch (error: unknown) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Удалить';

            this.element.querySelector('#profileDeleteModal').hidden = true;

            this.showMessage(
                getErrorMessage(error) || 'Не удалось удалить аккаунт.',
            );

            return;
        }

        // Бэкенд уже отозвал JWT и очистил auth-cookie.
        // Убираем локальные данные пользователя.
        const authKeys = [
            'isAuth',
            'userName',
            'userId',
            'userTag',
            'userAvatarUrl',
            'followersCount',
            'userFollowersCount',
        ];

        authKeys.forEach((key) => {
            localStorage.removeItem(key);
        });

        this.router.refreshHeader();
        this.router.navigateTo('/');
    }

    showMessage(message: string, isSuccess = false): void {
        const el = this.element?.querySelector('#profileEditMessage');
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;

        // Переключаем классы в зависимости от статуса
        if (isSuccess) {
            el.classList.add('profile-modal-message--success');
        } else {
            el.classList.remove('profile-modal-message--success');
        }
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