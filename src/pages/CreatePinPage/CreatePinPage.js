import { Header } from '../../components/Header/Header.js';
import { addPinsToBoard, createPin } from '../../api/user.js';
import template from './CreatePinPage.hbs';

/**
 * Страница создания пина.
 */
export class CreatePinPage {
    /**
     * @param {Object} [options]
     * @param {import('../../routes.js').Router} [options.router]
     */
    constructor({ router } = {}) {
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
        this.element = wrapper.firstElementChild;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        this.setupEvents();

        return this.element;
    }

    /**
     * Подключает выбор файла и отправку формы.
     */
    setupEvents() {
        const fileInput = this.element.querySelector('#pinImageInput');
        const uploadLabel = this.element.querySelector('#pinUploadLabel');

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

        uploadLabel.addEventListener('drop', (event) => {
            event.preventDefault();
            uploadLabel.classList.remove('is-dragging');
            const [file] = event.dataTransfer?.files || [];
            if (file) this.setSelectedFile(file);
        });

        this.element.querySelector('#removePinImage').addEventListener('click', () => {
            this.setSelectedFile(null);
            fileInput.value = '';
        });

        this.element.querySelector('#createPinForm').addEventListener('submit', (event) => {
            void this.createPin(event);
        });
    }

    /**
     * Показывает предпросмотр выбранного файла.
     *
     * @param {File|null} file
     */
    setSelectedFile(file) {
        const error = this.element.querySelector('#pinImageError');
        const preview = this.element.querySelector('#pinImagePreview');
        const placeholder = this.element.querySelector('#pinUploadPlaceholder');
        const removeButton = this.element.querySelector('#removePinImage');

        error.textContent = '';
        const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
        const rejectFile = (message) => {
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
    async createPin(event) {
        event.preventDefault();
        const titleInput = this.element.querySelector('#pinNameInput');
        const descriptionInput = this.element.querySelector('#pinDescriptionInput');
        const tagsInput = this.element.querySelector('#pinTagsInput');
        const error = this.element.querySelector('#createPinError');
        const submitButton = this.element.querySelector('#createPinSubmit');

        error.hidden = true;
        if (!this.selectedFile) {
            this.element.querySelector('#pinImageError').textContent = 'Сначала загрузите изображение.';
            return;
        }
        if (!titleInput.value.trim()) {
            error.textContent = 'Введите название пина.';
            error.hidden = false;
            titleInput.focus();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Создание…';

        try {
            // Передаем нативный сохраненный объект файла (`this.selectedFile`) прямо в API
            const createdPin = await createPin({
                name: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                fileObject: this.selectedFile,
            });

            const createdPinId = createdPin?.pin_id ?? createdPin?.pin?.pin_id;
            if (this.boardId && createdPinId) {
                try {
                    await addPinsToBoard(this.boardId, [createdPinId]);
                } catch {
                    // Пин уже загружен. Не разрешаем повторно отправить файл
                    // из-за ошибки отдельного запроса привязки к доске.
                    this.router.navigateTo(`/pin/${encodeURIComponent(createdPinId)}`);
                    return;
                }
                this.router.navigateTo(`/board/${encodeURIComponent(this.boardId)}`);
                return;
            }

            this.router.navigateTo('/profile/pins');
        } catch (err) {
            error.textContent = err.message || 'Не удалось создать пин.';
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