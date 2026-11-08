import { resolveImageUrl } from '../../api/user.js';
import {
    deleteBoard,
    fetchBoardById,
    fetchUserSavedPins,
    addPinsToBoard,
    updateBoard,
    removePinFromBoard,
} from '../../api/user.js';
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

function getVisibilityLabel(entryStatus) {
    const labels = {
        0: 'Публичный для всех',
        1: 'Для подписчиков',
        2: 'Приватный',
    };
    return labels[entryStatus] ?? labels[0];
}

export class BoardPage {
    constructor(boardId, { router } = {}) {
        this.boardId = String(boardId);
        this.router = router;
        this.board = null;
        this.element = null;
        this.header = null;
        this.isDestroyed = false;
        this.isOwner = false;

        this.savedPins = [];
        this.selectedPinIds = new Set();
        this.notice = new URLSearchParams(window.location.search).get('notice');
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

            this.board = result;
            const currentUserId = localStorage.getItem('userId');
            this.isOwner = String(this.board.creator_id) === String(currentUserId);

            this.element.querySelector('#boardTitle').textContent = this.board.name || 'Без названия';
            this.element.querySelector('#boardVisibility').textContent = getVisibilityLabel(this.board.entry_status);
            this.element.querySelector('#boardPinsCount').textContent = getPinsLabel(result.pins?.length || 0);
            this.element.querySelector('#boardDescription').textContent = this.board.description || '';

            this.element.querySelector('#boardDelete').hidden = !this.isOwner;
            this.element.querySelector('#boardAddPins').hidden = !this.isOwner;
            this.element.querySelector('#boardEdit').hidden = !this.isOwner;

            this.renderPins(result.pins || []);
            if (this.notice === 'pins') {
                this.showMessage('Доска создана, но не все выбранные пины удалось добавить. Их можно добавить через кнопку «Добавить пины».');
                this.notice = null;
            }
        } catch (error) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            this.showMessage(error.message || 'Не удалось загрузить доску.');
        }
    }

    renderPins(pins) {
        const grid = this.element.querySelector('#boardPinsGrid');
        grid.replaceChildren();

        const fragment = document.createDocumentFragment();
        pins.forEach((pin) => {
            const card = new PinCard(pin).render();
            // Кнопка удаления пина с доски — только для владельца
            if (this.isOwner) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'board-pin-remove';
                removeBtn.dataset.pinId = String(pin.pin_id);
                removeBtn.setAttribute('aria-label', 'Убрать пин с доски');
                removeBtn.textContent = '×';
                card.append(removeBtn);
            }
            fragment.append(card);
        });
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
        this.element.querySelector('#boardCreatePin').addEventListener('click', () => {
            this.router.navigateTo(`/create-pin?board=${encodeURIComponent(this.boardId)}`);
        });

        // Удаление пина с доски (делегирование)
        this.element.querySelector('#boardPinsGrid').addEventListener('click', (event) => {
            const removeBtn = event.target.closest('.board-pin-remove');
            if (!removeBtn) return;
            event.preventDefault();
            void this.removePinFromBoard(removeBtn.dataset.pinId, removeBtn);
        });

        // Удаление доски
        const deleteModal = this.element.querySelector('#deleteConfirmModal');
        this.element.querySelector('#boardDelete').addEventListener('click', () => {
            deleteModal.hidden = false;
        });
        const closeDelete = () => { deleteModal.hidden = true; };
        this.element.querySelector('#closeDeleteModal').addEventListener('click', closeDelete);
        this.element.querySelector('#cancelDeleteBtn').addEventListener('click', closeDelete);
        this.element.querySelector('#confirmDeleteBtn').addEventListener('click', () => void this.removeBoard());

        // Редактирование доски
        const editModal = this.element.querySelector('#editBoardModal');
        this.element.querySelector('#boardEdit').addEventListener('click', () => this.openEditModal());
        const closeEdit = () => { editModal.hidden = true; };
        this.element.querySelector('#editBoardClose').addEventListener('click', closeEdit);
        this.element.querySelector('#editBoardCancel').addEventListener('click', closeEdit);
        this.element.querySelector('#editBoardSave').addEventListener('click', () => void this.saveBoardEdit());

        // Добавление пинов
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

    openEditModal() {
        const modal = this.element.querySelector('#editBoardModal');
        this.element.querySelector('#editBoardName').value = this.board?.name || '';
        this.element.querySelector('#editBoardDescription').value = this.board?.description || '';
        this.element.querySelector('#editBoardEntryStatus').value = String(this.board?.entry_status ?? 0);
        this.showEditMessage('');
        modal.hidden = false;
    }

    showEditMessage(message) {
        const el = this.element?.querySelector('#editBoardMessage');
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;
    }

    /**
     * PATCH /desks/{id}. Отправляем только изменённые поля.
     * Если description очистили — передаём null, чтобы бэкенд удалил значение.
     */
    async saveBoardEdit() {
        const nameInput = this.element.querySelector('#editBoardName');
        const descriptionInput = this.element.querySelector('#editBoardDescription');
        const entryStatusSelect = this.element.querySelector('#editBoardEntryStatus');
        const saveBtn = this.element.querySelector('#editBoardSave');

        const name = nameInput.value.trim();
        if (!name) {
            this.showEditMessage('Название не может быть пустым.');
            nameInput.focus();
            return;
        }

        const patch = {};
        const prev = this.board || {};

        if (name !== (prev.name || '')) patch.name = name;

        const description = descriptionInput.value.trim();
        const prevDescription = prev.description || '';
        if (description !== prevDescription) {
            // Пустая строка → null, чтобы бэкенд очистил значение
            patch.description = description || null;
        }

        const entryStatus = Number(entryStatusSelect.value);
        if (entryStatus !== Number(prev.entry_status ?? 0)) {
            patch.entry_status = entryStatus;
        }

        if (!Object.keys(patch).length) {
            this.showEditMessage('Нет изменений.');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Сохранение…';

        try {
            await updateBoard(this.boardId, patch);
            if (this.isDestroyed) return;
            this.element.querySelector('#editBoardModal').hidden = true;
            await this.loadBoard();
        } catch (error) {
            this.showEditMessage(error.message || 'Не удалось сохранить доску.');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Сохранить';
        }
    }

    /**
     * DELETE /desks/{id}/pins/{pinID}.
     * Сам пин не удаляется, только отвязывается от доски.
     */
    async removePinFromBoard(pinId, button) {
        if (!this.isOwner) return;
        button.disabled = true;
        try {
            await removePinFromBoard(this.boardId, pinId);
            if (this.isDestroyed || !this.element?.isConnected) return;
            await this.loadBoard();
        } catch (error) {
            button.disabled = false;
            this.showMessage(error.message || 'Не удалось убрать пин с доски.');
        }
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

            const currentPinIds = new Set(
                (this.board?.pins || []).map((pin) => String(pin.pin_id))
            );
            const availablePins = this.savedPins.filter((pin) => !currentPinIds.has(String(pin.pin_id)));

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
                image.src = resolveImageUrl(pin.image_url);
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
            void this.loadBoard();
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