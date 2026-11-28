import './CreatePinPage.scss';
import { Header } from '../../components/Header/Header';
import { addPinsToBoard, createPin } from '../../api/user';
import template from './CreatePinPage.hbs';
import type { Router } from '../../routes';
import type { DomRoot } from '../../types/dom';
import { getErrorMessage } from '../../utils/errors';

/**
 * Страница создания пина.
 */
export class CreatePinPage {
    router?: Router;
    header: Header | null;
    element: DomRoot | null;
    selectedFile: File | null;
    previewUrl: string | null;
    boardId: string | null;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router]
     */
    constructor({ router }: { router?: Router } = {}) {
        this.router = router;
        this.header = null;
        this.element = null;
        this.selectedFile = null;
        this.previewUrl = null;
        this.boardId = new URLSearchParams(window.location.search).get('board');
    }

    /**
     * Создаёт DOM страницы и подключает обработчики формы.
     *
     * @returns {HTMLElement}
     */
    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild as DomRoot;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        this.setupEvents();

        return this.element;
    }

    /**
     * Подключает выбор файла и отправку формы.
     */
    setupEvents() {
        const fileInput = this.element.querySelector<HTMLInputElement>('#pinImageInput');
        const uploadLabel = this.element.querySelector<HTMLElement>('#pinUploadLabel');

        const descriptionInput = this.element.querySelector<HTMLTextAreaElement>('#pinDescriptionInput');
        const descriptionCounter = this.element.querySelector<HTMLElement>('#pinDescriptionCounter');

        fileInput.addEventListener('change', () => {
            const [file] = fileInput.files || [];
            this.setSelectedFile(file || null);
        });

        uploadLabel.addEventListener('dragover', (event) => {
            event.preventDefault();
            uploadLabel.classList.add('is-dragging');
        });

        uploadLabel.addEventListener('dragleave', () => {
            uploadLabel.classList.remove('is-dragging');
        });

        uploadLabel.addEventListener('drop', (event: DragEvent) => {
            event.preventDefault();
            uploadLabel.classList.remove('is-dragging');

            const [file] = event.dataTransfer?.files || [];

            if (file) {
                this.setSelectedFile(file);
            }
        });

        // Ограничение описания: 500 символов и 15 строк
        descriptionInput.addEventListener('input', () => {
            let value = descriptionInput.value;

            // Ограничиваем число строк
            const lines = value.split('\n');

            if (lines.length > 15) {
                value = lines.slice(0, 15).join('\n');
            }

            // Ограничиваем число символов
            if (value.length > 500) {
                value = value.slice(0, 500);
            }

            if (descriptionInput.value !== value) {
                descriptionInput.value = value;
            }

            if (descriptionCounter) {
                descriptionCounter.textContent = String(descriptionInput.value.length);
            }
        });

        this.element.querySelector<HTMLButtonElement>('#removePinImage')
            .addEventListener('click', () => {
                this.setSelectedFile(null);
                fileInput.value = '';
            });

        this.element.querySelector<HTMLFormElement>('#createPinForm')
            .addEventListener('submit', (event: Event) => {
                void this.createPin(event);
            });
    }

    /**
     * Показывает предпросмотр выбранного файла.
     *
     * @param {File|null} file
     */
    setSelectedFile(file: File | null): void {
        const error = this.element.querySelector('#pinImageError');
        const preview = this.element.querySelector<HTMLImageElement>('#pinImagePreview');
        const placeholder = this.element.querySelector('#pinUploadPlaceholder');
        const removeButton = this.element.querySelector('#removePinImage');

        error.textContent = '';
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
        const rejectFile = (message: string): void => {
            if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
            this.selectedFile = null;
            preview.removeAttribute('src');
            preview.hidden = true;
            placeholder.hidden = false;
            removeButton.hidden = true;
            error.textContent = message;
        };
        if (file && file.type && !allowedTypes.has(file.type.toLowerCase())) {
            rejectFile('Поддерживаются только JPEG, PNG, GIF и WebP.');
            return;
        }
        // Лимит API — 10 MiB. Формат файла дополнительно проверяется сервером по сигнатуре.
        if (file && file.size > 10 * 1024 * 1024) {
            rejectFile('Размер файла не должен превышать 10 МБ.');
            return;
        }

        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        this.selectedFile = file;

        if (file) {
            this.previewUrl = URL.createObjectURL(file);
            preview.src = this.previewUrl;
            preview.hidden = false;
            placeholder.hidden = true;
            removeButton.hidden = false;

            const image = new Image();

            image.onload = () => {
                const ratio = image.width / image.height;

                if (ratio < 0.5 || ratio > 1.8) {
                    rejectFile(
                        'Недопустимые пропорции изображения. ' +
                        'Загрузите изображение не слишком узкое и не слишком широкое.'
                    );
                }
            };

            image.onerror = () => {
                rejectFile('Не удалось прочитать изображение.');
            };

            image.src = this.previewUrl;
        } else {
            preview.removeAttribute('src');
            preview.hidden = true;
            placeholder.hidden = false;
            removeButton.hidden = true;
        }
    }

    /**
     * Проверяет форму и отправляет новый пин на backend.
     *
     * @param {SubmitEvent} event
     */
    async createPin(event: Event): Promise<void> {
        event.preventDefault();

        const titleInput = this.element.querySelector<HTMLInputElement>('#pinNameInput');
        const descriptionInput = this.element.querySelector<HTMLTextAreaElement>('#pinDescriptionInput');
        const tagsInput = this.element.querySelector<HTMLInputElement>('#pinTagsInput');
        const error = this.element.querySelector<HTMLElement>('#createPinError');
        const submitButton = this.element.querySelector<HTMLButtonElement>('#createPinSubmit');
        const imageError = this.element.querySelector<HTMLElement>('#pinImageError');

        error.hidden = true;
        imageError.textContent = '';

        if (localStorage.getItem('isAuth') !== 'true') {
            error.textContent = 'Войдите в аккаунт, чтобы создать пин.';
            error.hidden = false;
            return;
        }

        if (!this.selectedFile) {
            imageError.textContent = 'Сначала загрузите изображение.';
            return;
        }

        if (!titleInput.value.trim()) {
            error.textContent = 'Введите название пина.';
            error.hidden = false;
            titleInput.focus();
            return;
        }

        if (titleInput.value.trim().length > 40) {
            error.textContent = 'Название пина не должно превышать 40 символов.';
            error.hidden = false;
            titleInput.focus();
            return;
        }

        if (descriptionInput.value.length > 500) {
            error.textContent = 'Описание не должно превышать 500 символов.';
            error.hidden = false;
            descriptionInput.focus();
            return;
        }

        if (descriptionInput.value.split('\n').length > 15) {
            error.textContent = 'Описание не должно превышать 15 строк.';
            error.hidden = false;
            descriptionInput.focus();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Создание…';

        try {
            const createdPin = await createPin({
                name: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                tags: (tagsInput?.value || '')
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                fileObject: this.selectedFile,
            });

            const createdPinId = createdPin?.pin_id ?? createdPin?.pin?.pin_id;

            if (this.boardId && createdPinId) {
                try {
                    await addPinsToBoard(this.boardId, [createdPinId]);
                } catch {
                    this.router.navigateTo(`/pin/${encodeURIComponent(createdPinId)}`);
                    return;
                }

                this.router.navigateTo(`/board/${encodeURIComponent(this.boardId)}`);
                return;
            }

            this.router.navigateTo('/profile/pins');
        } catch (err: unknown) {
            error.textContent = getErrorMessage(err) || 'Не удалось создать пин.';
            error.hidden = false;

            submitButton.disabled = false;
            submitButton.textContent = 'Создать';
        }
    }

    /**
     * Обновляет шапку после изменения авторизации.
     */
    refreshHeader() {
        this.header?.refresh();
    }

    /**
     * Освобождает URL предпросмотра и шапку.
     */
    destroy() {
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
