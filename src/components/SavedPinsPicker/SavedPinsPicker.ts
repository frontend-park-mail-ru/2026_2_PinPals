
import './SavedPinsPicker.scss';
import template from './SavedPinsPicker.hbs';
import { resolveImageUrl } from '../../api/user';
import type { Pin } from '../../types/models';

type SavedPinsPickerOptions = {
    loadPins: () => Promise<Pin[]>;
    excludePinIds?: () => Array<string | number>;
    onConfirm: (selectedIds: string[], selectedPins: Pin[]) => Promise<void> | void;
    title?: string;
    confirmText?: string;
    preserveSelectionAfterConfirm?: boolean;
};

/** Унифицированное окно выбора пинов пользователя для страниц досок. */
export class SavedPinsPicker {
    private options: SavedPinsPickerOptions;
    private element: HTMLElement | null = null;
    private pins: Pin[] = [];
    private selectedPinIds = new Set<string>();
    private isDestroyed = false;
    private previousBodyOverflow: string | null = null;
    private returnFocusTo: HTMLElement | null = null;

    constructor(options: SavedPinsPickerOptions) {
        this.options = options;
    }

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({
            title: this.options.title || 'Выберите пины',
            confirmText: this.options.confirmText || 'Добавить выбранные',
        });
        this.element = wrapper.firstElementChild as HTMLElement;
        this.element.setAttribute('aria-hidden', 'true');

        // Единый делегированный обработчик не зависит от того, в каком месте
        // страницы размещён компонент, и работает для динамически созданных карточек.
        this.element.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;

            if (target.closest('[data-picker-close], [data-picker-cancel]')) {
                this.close();
                return;
            }
            if (target.closest('[data-picker-confirm]')) {
                void this.confirm();
                return;
            }
            if (target.closest('[data-pin-id]')) {
                this.togglePin(event);
                return;
            }
            if (target === this.element) this.close();
        });

        this.updateCount();
        return this.element;
    }

    async open(): Promise<void> {
        if (!this.element || this.isDestroyed || !this.element.hidden) return;
        const modal = this.element;
        const grid = modal.querySelector<HTMLElement>('[data-picker-grid]');
        const error = modal.querySelector<HTMLElement>('[data-picker-error]');
        if (!grid) return;

        this.returnFocusTo = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        modal.hidden = false;
        modal.setAttribute('aria-hidden', 'false');
        grid.textContent = 'Загрузка ваших пинов…';
        this.pins = [];
        if (error) {
            error.hidden = true;
            error.textContent = '';
        }
        this.updateCount();

        try {
            const pins = await this.options.loadPins();
            if (this.isDestroyed || !this.element?.isConnected || modal.hidden) return;
            const excluded = new Set((this.options.excludePinIds?.() || []).map(String));
            this.pins = pins.filter((pin) => !excluded.has(String(pin.pin_id)));
            grid.replaceChildren();

            if (!this.pins.length) {
                grid.textContent = pins.length
                    ? 'Все доступные пины уже добавлены.'
                    : 'У вас пока нет пинов.';
                return;
            }

            const fragment = document.createDocumentFragment();
            for (const pin of this.pins) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'saved-pin-option';
                card.dataset.pinId = String(pin.pin_id);
                const isSelected = this.selectedPinIds.has(String(pin.pin_id));
                card.classList.toggle('is-selected', isSelected);
                card.setAttribute('aria-pressed', String(isSelected));
                card.setAttribute('aria-label', pin.name || `Пин ${pin.pin_id}`);

                const image = document.createElement('img');
                image.src = resolveImageUrl(pin.image_url);
                image.alt = pin.name || 'Сохранённый пин';
                image.loading = 'lazy';
                image.onerror = () => {
                    image.alt = 'Не удалось загрузить изображение';
                    card.classList.add('has-image-error');
                };

                const check = document.createElement('span');
                check.className = 'saved-pin-check';
                check.setAttribute('aria-hidden', 'true');
                card.append(image, check);
                fragment.append(card);
            }
            grid.append(fragment);
            this.updateCount();
        } catch (cause: unknown) {
            if (this.isDestroyed || !this.element?.isConnected) return;
            grid.textContent = '';
            if (error) {
                error.textContent = cause instanceof Error ? cause.message : 'Не удалось загрузить пины.';
                error.hidden = false;
            }
        }
    }

    private togglePin(event: Event): void {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const card = target.closest<HTMLButtonElement>('[data-pin-id]');
        if (!card) return;
        const id = String(card.dataset.pinId);
        if (this.selectedPinIds.has(id)) this.selectedPinIds.delete(id);
        else this.selectedPinIds.add(id);
        card.classList.toggle('is-selected', this.selectedPinIds.has(id));
        card.setAttribute('aria-pressed', String(this.selectedPinIds.has(id)));
        this.updateCount();
    }

    private updateCount(): void {
        const count = this.element?.querySelector<HTMLElement>('[data-picker-count]');
        if (count) count.textContent = `Выбрано: ${this.selectedPinIds.size}`;
        const confirmButton = this.element?.querySelector<HTMLButtonElement>('[data-picker-confirm]');
        if (confirmButton) confirmButton.disabled = this.selectedPinIds.size === 0;
    }

    private async confirm(): Promise<void> {
        const button = this.element?.querySelector<HTMLButtonElement>('[data-picker-confirm]');
        const error = this.element?.querySelector<HTMLElement>('[data-picker-error]');
        if (!button || !this.selectedPinIds.size || button.disabled) return;

        button.disabled = true;
        const originalText = button.textContent || 'Добавить выбранные';
        button.textContent = 'Добавление…';
        if (error) {
            error.hidden = true;
            error.textContent = '';
        }

        try {
            const ids = [...this.selectedPinIds];
            const pins = this.pins.filter((pin) => this.selectedPinIds.has(String(pin.pin_id)));
            await this.options.onConfirm(ids, pins);
            if (!this.options.preserveSelectionAfterConfirm) this.selectedPinIds.clear();
            this.close();
        } catch (cause: unknown) {
            if (error) {
                error.textContent = cause instanceof Error ? cause.message : 'Не удалось применить выбор пинов.';
                error.hidden = false;
            }
        } finally {
            if (button.isConnected) {
                button.textContent = originalText;
                button.disabled = this.selectedPinIds.size === 0;
            }
        }
    }

    close(): void {
        const modal = this.element;
        if (modal) {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
        }
        if (this.previousBodyOverflow !== null) {
            document.body.style.overflow = this.previousBodyOverflow;
            this.previousBodyOverflow = null;
        }
        if (this.returnFocusTo?.isConnected) this.returnFocusTo.focus();
        this.returnFocusTo = null;
    }

    destroy(): void {
        this.isDestroyed = true;
        this.close();
        this.element?.remove();
        this.element = null;
        this.pins = [];
        this.selectedPinIds.clear();
    }
}