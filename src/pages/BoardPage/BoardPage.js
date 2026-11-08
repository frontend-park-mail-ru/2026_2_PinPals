import { deleteBoard, fetchBoardById, fetchUserSavedPins, addPinsToBoard } from '../../api/user.js';
import { Header } from '../../components/Header/Header.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import template from './BoardPage.hbs';

function getPinsLabel(count) {
    const value = Math.max(0, Number(count) || 0);
    const lastTwoDigits = value % 100;
    const lastDigit = value % 10;
    let word = 'пинов';
    if (lastTwoDigits < 11 || lastTwoDigits > 14) {
        if (lastDigit === 1) word = 'пин';
        else if (lastDigit >= 2 && lastDigit <= 4) word = 'пина';
    }
    return `${value} ${word}`;
}

function getVisibilityLabel(visibility) {
    const labels = {
        public: 'Публичный для всех',
        friends: 'Публичный для друзей',
        private: 'Приватный',
    };
    return labels[visibility] || labels.public;
}

export class BoardPage {
    constructor(boardId, { router } = {}) {
        this.boardId = String(boardId);
        this.router = router;
        this.board = null;
        this.element = null;
        this.header = null;
        this.isDestroyed = false;

        // Переменные для добавления пинов
        this.savedPins = [];
        this.selectedPinIds = new Set();
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        this.setupEvents();
        void this.loadBoard();
        return this.element;
    }

    async loadBoard() {
        try {
            const result = await fetchBoardById(this.boardId);
            if (this.isDestroyed || !this.element?.isConnected) return;

            this.board = result.board;
            const currentUserId = localStorage.getItem('userId');
            const isOwner = String(this.board.owner_id) === String(currentUserId);

            this.element.querySelector('#boardTitle').textContent = this.board.title || 'Без названия';
            this.element.querySelector('#boardVisibility').textContent = getVisibilityLabel(this.board.visibility);
            this.element.querySelector('#boardPinsCount').textContent = getPinsLabel(result.pins?.length ?? this.board.pins_count);
            this.element.querySelector('#boardDescription').textContent = this.board.description || '';

            // Показывать действия управления только владельцу
            this.element.querySelector('#boardDelete').hidden = !isOwner;
            this.element.querySelector('#boardAddPins').hidden = !isOwner;

            this.renderPins(result.pins || []);
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.showMessage(error.message || 'Не удалось загрузить доску.');
        }
    }

    renderPins(pins) {
        const grid = this.element.querySelector('#boardPinsGrid');
        grid.replaceChildren();

        const fragment = document.createDocumentFragment();
        pins.forEach((pin) => fragment.append(new PinCard(pin).render()));
        grid.append(fragment);

        this.showMessage(pins.length ? '' : 'В этой доске пока нет пинов.');
    }

    showMessage(message) {
        const messageElement = this.element?.querySelector('#boardMessage');
        if (!messageElement) return;
        messageElement.textContent = message;
        messageElement.hidden = !message;
    }

    setupEvents() {
        // Переход на создание нового пина
        this.element.querySelector('#boardCreatePin').addEventListener('click', () => {
            this.router.navigateTo(`/create-pin?board=${encodeURIComponent(this.boardId)}`);
        });

        // Модальное окно УДАЛЕНИЯ
        const deleteModal = this.element.querySelector('#deleteConfirmModal');
        this.element.querySelector('#boardDelete').addEventListener('click', () => {
            deleteModal.hidden = false;
        });
        const closeDelete = () => { deleteModal.hidden = true; };
        this.element.querySelector('#closeDeleteModal').addEventListener('click', closeDelete);
        this.element.querySelector('#cancelDeleteBtn').addEventListener('click', closeDelete);
        this.element.querySelector('#confirmDeleteBtn').addEventListener('click', () => void this.removeBoard());

        // Модальное окно ДОБАВЛЕНИЯ ПИНОВ
        this.element.querySelector('#boardAddPins').addEventListener('click', () => void this.openSavedPinsModal());

        const pinsModal = this.element.querySelector('#savedPinsModal');
        const closePinsModal = () => { pinsModal.hidden = true; };
        this.element.querySelector('#closeSavedPins').addEventListener('click', closePinsModal);
        this.element.querySelector('#cancelSavedPins').addEventListener('click', closePinsModal);

        this.element.querySelector('#savedPinsGrid').addEventListener('click', (e) => {
            const card = e.target.closest('[data-pin-id]');
            if (!card) return;
            const id = String(card.dataset.pinId);
            this.selectedPinIds.has(id) ? this.selectedPinIds.delete(id) : this.selectedPinIds.add(id);
            card.classList.toggle('is-selected', this.selectedPinIds.has(id));
            this.updateSavedPinsCount();
        });

        this.element.querySelector('#confirmSavedPins').addEventListener('click', () => void this.submitAddedPins());
    }

    async removeBoard() {
        const button = this.element.querySelector('#confirmDeleteBtn');
        button.disabled = true;
        try {
            await deleteBoard(this.boardId);
            if (!this.isDestroyed) {
                this.element.querySelector('#deleteConfirmModal').hidden = true;
                this.router.navigateTo('/profile/boards');
            }
        } catch (error) {
            button.disabled = false;
            this.showMessage(error.message || 'Не удалось удалить доску.');
        }
    }

    // Логика выбора и добавления пинов
    async openSavedPinsModal() {
        const modal = this.element.querySelector('#savedPinsModal');
        const grid = this.element.querySelector('#savedPinsGrid');
        modal.hidden = false;
        grid.textContent = 'Загрузка сохранённых пинов…';
        this.selectedPinIds.clear();

        try {
            const userId = localStorage.getItem('userId');
            this.savedPins = await fetchUserSavedPins(userId);
            if (this.isDestroyed) return;
            grid.replaceChildren();

            // Исключаем те пины, которые уже есть на этой доске (из сохраненного состояния с бэкенда)
            const currentPinIds = new Set((this.board?.pin_ids || []).map(String));
            const availablePins = this.savedPins.filter(pin => !currentPinIds.has(String(pin.pin_id)));

            if (!availablePins.length) {
                grid.textContent = 'Все ваши сохранённые пины уже добавлены на эту доску.';
                this.updateSavedPinsCount();
                return;
            }

            availablePins.forEach((pin) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'saved-pin-option';
                card.dataset.pinId = pin.pin_id;

                const image = document.createElement('img');
                image.src = pin.image_url;
                image.alt = pin.name || '';

                const check = document.createElement('span');
                check.className = 'saved-pin-check';

                card.append(image, check);
                grid.append(card);
            });
            this.updateSavedPinsCount();
        } catch (error) {
            grid.textContent = error.message || 'Не удалось загрузить пины.';
        }
    }

    updateSavedPinsCount() {
        this.element.querySelector('#savedPinsSelectedCount').textContent = `Выбрано: ${this.selectedPinIds.size}`;
    }

    async submitAddedPins() {
        if (!this.selectedPinIds.size) {
            this.element.querySelector('#savedPinsModal').hidden = true;
            return;
        }
        const button = this.element.querySelector('#confirmSavedPins');
        button.disabled = true;
        try {
            await addPinsToBoard(this.boardId, [...this.selectedPinIds]);
            this.element.querySelector('#savedPinsModal').hidden = true;
            void this.loadBoard(); // Перезагружаем контент доски
        } catch (error) {
            this.showMessage(error.message || 'Не удалось добавить пины.');
        } finally {
            button.disabled = false;
        }
    }

    refreshHeader() { this.header?.refresh(); }
    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.element = null;
    }
}
