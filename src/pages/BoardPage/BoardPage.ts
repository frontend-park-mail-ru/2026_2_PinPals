import './BoardPage.scss';
import {
    addPinsToBoard,
    deleteBoard,
    fetchBoardById,
    fetchUserSavedPins,
    removePinFromBoard,
    updateBoard,
} from '../../api/user';
import { Header } from '../../components/Header/Header';
import { PinCard } from '../../components/PinCard/PinCard';
import { SavedPinsPicker } from '../../components/SavedPinsPicker/SavedPinsPicker';
import template from './BoardPage.hbs';

const CLOSE_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

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
        1: 'Для подписчиков (доступ пока не поддерживается)',
        2: 'Приватный',
    };
    return labels[entryStatus] ?? labels[0];
}

export class BoardPage {
    [key: string]: any;
    constructor(boardId, { router }: any = {}) {
        this.boardId = String(boardId);
        this.router = router;
        this.board = null;
        this.element = null;
        this.header = null;
        this.isDestroyed = false;
        this.isOwner = false;

        this.savedPinsPicker = null;
        this.notice = new URLSearchParams(window.location.search).get('notice');
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild;

        this.header = new Header({ router: this.router });
        this.element.prepend(this.header.render());
        this.savedPinsPicker = new SavedPinsPicker({
            loadPins: async () => {
                const userId = localStorage.getItem('userId');
                if (!userId) throw new Error('Войдите в аккаунт, чтобы выбрать свои пины.');
                return fetchUserSavedPins(userId);
            },
            excludePinIds: () => (this.board?.pins || []).map((pin) => pin.pin_id),
            onConfirm: async (ids) => {
                await addPinsToBoard(this.boardId, ids);
                await this.loadBoard();
            },
        });
        // Модалка находится непосредственно в body, чтобы её не перекрывали
        // stacking context, overflow и элементы разметки самой страницы.
        document.body.append(this.savedPinsPicker.render());
        this.setupEvents();
        void this.loadBoard();
        return this.element;
    }

    async loadBoard() {
        try {
            const result = await fetchBoardById(this.boardId);
            if (this.isDestroyed || !this.element?.isConnected) return;

            // Пины могут прийти под разными ключами, берём первый непустой массив.
            const raw: any = result;
            const pins = [raw.pins, raw.desk_pins, raw.items].find((value) => Array.isArray(value)) || [];

            this.board = { ...result, pins };
            const currentUserId = localStorage.getItem('userId');
            this.isOwner = String(this.board.creator_id) === String(currentUserId);

            this.element.querySelector('#boardTitle').textContent = this.board.name || 'Без названия';
            this.element.querySelector('#boardVisibility').textContent = getVisibilityLabel(this.board.entry_status);
            this.element.querySelector('#boardPinsCount').textContent = getPinsLabel(pins.length || result.pins_count || 0);
            this.element.querySelector('#boardDescription').textContent = this.board.description || '';

            this.element.querySelector('#boardDelete').hidden = !this.isOwner;
            this.element.querySelector('#boardAddPins').hidden = !this.isOwner;
            this.element.querySelector('#boardEdit').hidden = !this.isOwner;

            this.renderPins(pins);
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

        // Динамически определяем количество колонок в зависимости от ширины экрана
        const columnCount = window.innerWidth <= 600 ? 2 : window.innerWidth <= 900 ? 3 : window.innerWidth <= 1200 ? 4 : 6;

        // Создаем элементы колонок внутри сетки
        const columns = Array.from({ length: columnCount }, () => {
            const column = document.createElement('div');
            column.className = 'pin-masonry-column';
            grid.appendChild(column);
            return column;
        });

        let nextColumn = 0;

        pins.forEach((pin) => {
            const card = new PinCard(pin).render();
            // Кнопка удаления пина с доски — только для владельца
            if (this.isOwner) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'board-pin-remove';
                removeBtn.dataset.pinId = String(pin.pin_id);
                removeBtn.setAttribute('aria-label', 'Убрать пин с доски');
                removeBtn.innerHTML = CLOSE_ICON;
                card.append(removeBtn);
            }

            // Распределяем пины поочередно по колонкам
            columns[nextColumn % columns.length].appendChild(card);
            nextColumn += 1;
        });

        this.showMessage(pins.length ? '' : 'В этой доске пока нет пинов.');
    }


    showMessage(message) {
        const messageElement = this.element?.querySelector('#boardMessage');
        if (!messageElement) return;
        messageElement.textContent = message;
        messageElement.hidden = !message;
    }

    setupEvents() {
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
        this.element.querySelector('#boardAddPins').addEventListener('click', () => void this.savedPinsPicker?.open());
    }

    openEditModal() {
        const modal = this.element.querySelector('#editBoardModal');
        this.element.querySelector('#editBoardName').value = this.board?.name || '';
        this.element.querySelector('#editBoardDescription').value = this.board?.description || '';

        const status = String(this.board?.entry_status ?? 0);
        this.element.querySelectorAll('input[name="editEntryStatus"]').forEach((radio) => {
            radio.checked = radio.value === status;
        });

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
     * Если description очистили, передаём null, чтобы бэкенд удалил значение.
     */
    async saveBoardEdit() {
        const nameInput = this.element.querySelector('#editBoardName');
        const descriptionInput = this.element.querySelector('#editBoardDescription');
        const saveBtn = this.element.querySelector('#editBoardSave');

        const name = nameInput.value.trim();
        if (!name) {
            this.showEditMessage('Название не может быть пустым.');
            nameInput.focus();
            return;
        }

        const patch: any = {};
        const prev = this.board || {};

        if (name !== (prev.name || '')) patch.name = name;

        const description = descriptionInput.value.trim();
        if (description !== (prev.description || '')) {
            patch.description = description || null;
        }

        const checked = this.element.querySelector('input[name="editEntryStatus"]:checked');
        const entryStatus = checked ? Number(checked.value) : Number(prev.entry_status ?? 0);
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

    refreshHeader() { this.header?.refresh(); }

    destroy() {
        this.isDestroyed = true;
        this.header?.destroy();
        this.header = null;
        this.savedPinsPicker?.destroy();
        this.savedPinsPicker = null;
        this.element = null;
    }
}