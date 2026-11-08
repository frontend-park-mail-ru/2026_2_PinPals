import { Header } from '../../components/Header/Header.js';
import { addPinsToBoard, createBoard, fetchUserSavedPins } from '../../api/user.js';
import template from './CreateBoardPage.hbs';

/**
 * Страница создания доски с возможностью выбора сохранённых пинов.
 */
export class CreateBoardPage {
    /**
     * @param {Object} [options]
     * @param {import('../../routes.js').Router} [options.router]
     */
    constructor({ router } = {}) {
        this.router = router;
        this.element = null;
        this.header = null;
        this.savedPins = [];
        this.selectedPinIds = new Set();
        this.isDestroyed = false;
    }

    /**
     * Отрисовывает страницу и инициализирует компоненты.
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
     * Подключает обработчики событий.
     */
    setupEvents() {
        // Отправка формы создания доски
        this.element.querySelector('#createBoardForm')
            .addEventListener('submit', (e) => void this.submitBoard(e));

        // Управление модальным окном
        this.element.querySelector('#openSavedPins')
            .addEventListener('click', () => void this.openSavedPins());

        ['closeSavedPins', 'cancelSavedPins'].forEach((id) => {
            this.element.querySelector(`#${id}`).addEventListener('click', () => this.closeModal());
        });

        this.element.querySelector('#savedPinsModal').addEventListener('click', (e) => {
            if (e.target.id === 'savedPinsModal') {
                this.closeModal();
            }
        });

        // Выбор пинов в сетке модального окна
        this.element.querySelector('#savedPinsGrid').addEventListener('click', (e) => {
            const card = e.target.closest('[data-pin-id]');
            if (!card) return;

            const id = String(card.dataset.pinId);
            if (this.selectedPinIds.has(id)) {
                this.selectedPinIds.delete(id);
            } else {
                this.selectedPinIds.add(id);
            }

            card.classList.toggle('is-selected', this.selectedPinIds.has(id));
            card.setAttribute('aria-pressed', String(this.selectedPinIds.has(id)));
            this.updateCount();
        });

        // Подтверждение выбора пинов
        this.element.querySelector('#confirmSavedPins')
            .addEventListener('click', () => this.applySelection());
    }

    /**
     * Открывает модальное окно и загружает сохранённые пины текущего пользователя.
     */
    async openSavedPins() {
        const modal = this.element.querySelector('#savedPinsModal');
        const grid = this.element.querySelector('#savedPinsGrid');

        modal.hidden = false;
        grid.textContent = 'Загрузка сохранённых пинов…';

        try {
            const userId = localStorage.getItem('userId');
            if (!userId) {
                throw new Error('Войдите в аккаунт, чтобы выбрать сохранённые пины.');
            }

            this.savedPins = await fetchUserSavedPins(userId);
            if (this.isDestroyed) return;

            grid.replaceChildren();

            if (!this.savedPins.length) {
                grid.textContent = 'У вас пока нет сохранённых пинов.';
                return;
            }

            this.savedPins.forEach((pin) => {
                const isSelected = this.selectedPinIds.has(String(pin.pin_id));

                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'saved-pin-option';
                card.dataset.pinId = pin.pin_id;
                card.setAttribute('aria-pressed', String(isSelected));

                if (isSelected) {
                    card.classList.add('is-selected');
                }

                const image = document.createElement('img');
                image.src = pin.image_url;
                image.alt = pin.name || 'Сохраненный пин';
                image.loading = 'lazy';

                const check = document.createElement('span');
                check.className = 'saved-pin-check';

                card.append(image, check);
                grid.append(card);
            });

            this.updateCount();
        } catch (error) {
            grid.textContent = error.message || 'Не удалось загрузить пины.';
        }
    }

    /**
     * Обновляет счетчик выбранных элементов.
     */
    updateCount() {
        this.element.querySelector('#savedPinsSelectedCount').textContent = `Выбрано: ${this.selectedPinIds.size}`;
    }

    /**
     * Отображает до 3 первых выбранных пинов в превью доски.
     */
    applySelection() {
        const preview = this.element.querySelector('#createBoardPreviewImages');
        preview.replaceChildren();

        const selectedPins = this.savedPins.filter((pin) => this.selectedPinIds.has(String(pin.pin_id)));

        selectedPins.slice(0, 3).forEach((pin) => {
            const image = document.createElement('img');
            image.src = pin.image_url;
            image.alt = pin.name || 'Превью доски';
            preview.append(image);
        });

        this.closeModal();
    }

    /**
     * Закрывает модальное окно.
     */
    closeModal() {
        this.element.querySelector('#savedPinsModal').hidden = true;
    }

    /**
     * Отправляет запрос на создание доски и добавление в неё пинов.
     * @param {SubmitEvent} event
     */
    async submitBoard(event) {
        event.preventDefault();

        const titleInput = this.element.querySelector('#boardTitleInput');
        const errorContainer = this.element.querySelector('#createBoardError');
        const submitButton = this.element.querySelector('#createBoardSubmit');

        const title = titleInput.value.trim();
        errorContainer.hidden = true;

        if (!title) {
            errorContainer.textContent = 'Введите название доски.';
            errorContainer.hidden = false;
            titleInput.focus();
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Создание…';

        try {
            const visibility = this.element.querySelector('[name="visibility"]:checked').value;
            const board = await createBoard({ title, visibility });
            const boardId = board.board_id || board.id;

            // Если были выбраны пины, привязываем их к созданной доске
            if (this.selectedPinIds.size) {
                await addPinsToBoard(boardId, [...this.selectedPinIds]);
            }

            this.router.navigateTo(`/board/${encodeURIComponent(boardId)}`);
        } catch (err) {
            errorContainer.textContent = err.message || 'Не удалось создать доску.';
            errorContainer.hidden = false;

            submitButton.disabled = false;
            submitButton.textContent = 'Создать';
        }
    }

    /**
     * Синхронизирует состояние шапки.
     */
    refreshHeader() {
        this.header?.refresh();
    }

    /**
     * Очищает используемые ресурсы при размонтировании страницы.
     */
    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
