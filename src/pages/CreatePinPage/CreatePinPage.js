import { Header } from '../../components/Header/Header.js';
import { createPin } from '../../api/user.js';
import template from './CreatePinPage.hbs';

/**
 * Сжимает выбранное изображение и возвращает Data URL для отправки на backend.
 * В рабочем backend вместо Data URL можно использовать multipart-загрузку.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            const maxSize = 1200;
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));

            const context = canvas.getContext('2d');
            if (!context) {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Не удалось обработать изображение.'));
                return;
            }

            context.fillStyle = '#FFFFFC';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Не удалось открыть выбранное изображение.'));
        };

        image.src = objectUrl;
    });
}

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
        if (file && !file.type.startsWith('image/')) {
            error.textContent = 'Выберите файл изображения.';
            return;
        }
        if (file && file.size > 15 * 1024 * 1024) {
            error.textContent = 'Размер файла не должен превышать 15 МБ.';
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
            const imageData = await compressImage(this.selectedFile);
            const boardId = new URLSearchParams(window.location.search).get('board');
            const pin = await createPin({
                name: titleInput.value.trim(),
                description: descriptionInput.value.trim(),
                tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                image_data: imageData,
                ...(boardId ? { board_id: boardId } : {}),
            });

            if (!pin?.pin_id) {
                throw new Error('Сервер не вернул созданный пин.');
            }

            this.router.navigateTo(boardId
                ? `/board/${encodeURIComponent(boardId)}`
                : '/profile/pins');
        } catch (err) {
            error.textContent = err.message || 'Не удалось создать пин. Попробуйте другое изображение.';
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
