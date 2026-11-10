import { Header } from '../../components/Header/Header';
import { addPinsToBoard, createBoard, fetchUserSavedPins, resolveImageUrl } from '../../api/user';
import { SavedPinsPicker } from '../../components/SavedPinsPicker/SavedPinsPicker';
import template from './CreateBoardPage.hbs';

/**
 * Страница создания доски с возможностью выбора своих пинов.
 */
export class CreateBoardPage {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router]
     */
    constructor({ router }: any = {}) {
        this.router = router;
        this.element = null;
        this.header = null;
        this.selectedPinIds = new Set();
        this.savedPinsPicker = null;
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
        this.savedPinsPicker = new SavedPinsPicker({
            loadPins: async () => {
                const userId = localStorage.getItem('userId');
                if (!userId) throw new Error('Войдите в аккаунт, чтобы выбрать свои пины.');
                return fetchUserSavedPins(userId);
            },
            preserveSelectionAfterConfirm: true,
            onConfirm: (ids, pins) => {
                this.selectedPinIds = new Set(ids);
                this.renderSelectedPinsPreview(pins);
            },
        });
        // Модалка находится непосредственно в body, чтобы её не перекрывали
        // stacking context, overflow и элементы разметки самой страницы.
        document.body.append(this.savedPinsPicker.render());

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

        // Окно выбора пинов управляется общим компонентом.
        this.element.querySelector('#openSavedPins')
            .addEventListener('click', () => void this.savedPinsPicker?.open());
    }

    /** Отображает выбранные пины в превью создаваемой доски. */
    renderSelectedPinsPreview(selectedPins) {
        const preview = this.element.querySelector('#createBoardPreviewImages');
        preview.replaceChildren();
        selectedPins.slice(0, 3).forEach((pin) => {
            const image = document.createElement('img');
            image.src = resolveImageUrl(pin.image_url);
            image.alt = pin.name || 'Превью доски';
            preview.append(image);
        });
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

            const boardId = board.desk_id ?? board.board_id ?? board.id;
            if (!boardId) {
                throw new Error('Сервер не вернул идентификатор созданной доски.');
            }

            // Если были выбраны пины, привязываем их к созданной доске
            if (this.selectedPinIds.size) {
                try {
                    await addPinsToBoard(boardId, [...this.selectedPinIds]);
                } catch {
                    // Доска уже создана. Не оставляем пользователя на форме,
                    // иначе повторная отправка создаст дубликат доски.
                    this.router.navigateTo(`/board/${encodeURIComponent(boardId)}?notice=pins`);
                    return;
                }
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
        this.savedPinsPicker?.destroy();
        this.savedPinsPicker = null;
        this.element = null;
    }
}