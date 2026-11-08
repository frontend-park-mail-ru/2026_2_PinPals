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

/** Унифицированное окно выбора сохранённых пинов для страниц досок. */
export class SavedPinsPicker {
    private options: SavedPinsPickerOptions;
    private element: HTMLElement | null = null;
    private pins: Pin[] = [];
    private selectedPinIds = new Set<string>();
    private isDestroyed = false;

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
        this.element.querySelector('[data-picker-close]')?.addEventListener('click', () => this.close());
        this.element.querySelector('[data-picker-cancel]')?.addEventListener('click', () => this.close());
        this.element.querySelector('[data-picker-modal]')?.addEventListener('click', (event) => {
            if (event.target === this.element?.querySelector('[data-picker-modal]')) this.close();
        });
        this.element.querySelector('[data-picker-grid]')?.addEventListener('click', (event) => this.togglePin(event));
        this.element.querySelector('[data-picker-confirm]')?.addEventListener('click', () => void this.confirm());
        return this.element;
    }

    async open(): Promise<void> {
        if (!this.element) return;
        const modal = this.element.querySelector<HTMLElement>('[data-picker-modal]');
        const grid = this.element.querySelector<HTMLElement>('[data-picker-grid]');
        const error = this.element.querySelector<HTMLElement>('[data-picker-error]');
        if (!modal || !grid) return;

        modal.hidden = false;
        grid.textContent = 'Загрузка сохранённых пинов…';
        this.pins = [];
        if (error) { error.hidden = true; error.textContent = ''; }
        this.updateCount();

        try {
            const pins = await this.options.loadPins();
            if (this.isDestroyed || !this.element?.isConnected) return;
            const excluded = new Set((this.options.excludePinIds?.() || []).map(String));
            this.pins = pins.filter((pin) => !excluded.has(String(pin.pin_id)));
            grid.replaceChildren();

            if (!this.pins.length) {
                grid.textContent = pins.length
                    ? 'Все сохранённые пины уже добавлены.'
                    : 'У вас пока нет сохранённых пинов.';
                return;
            }

            for (const pin of this.pins) {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'saved-pin-option';
                card.dataset.pinId = String(pin.pin_id);
                const isSelected = this.selectedPinIds.has(String(pin.pin_id));
                card.classList.toggle('is-selected', isSelected);
                card.setAttribute('aria-pressed', String(isSelected));
                const image = document.createElement('img');
                image.src = resolveImageUrl(pin.image_url);
                image.alt = pin.name || 'Сохранённый пин';
                image.loading = 'lazy';
                const check = document.createElement('span');
                check.className = 'saved-pin-check';
                card.append(image, check);
                grid.append(card);
            }
        } catch (cause) {
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
    }

    private async confirm(): Promise<void> {
        const button = this.element?.querySelector<HTMLButtonElement>('[data-picker-confirm]');
        const error = this.element?.querySelector<HTMLElement>('[data-picker-error]');
        if (!button || !this.selectedPinIds.size) {
            this.close();
            return;
        }
        button.disabled = true;
        if (error) error.hidden = true;
        try {
            const ids = [...this.selectedPinIds];
            const pins = this.pins.filter((pin) => this.selectedPinIds.has(String(pin.pin_id)));
            await this.options.onConfirm(ids, pins);
            if (!this.options.preserveSelectionAfterConfirm) this.selectedPinIds.clear();
            this.close();
        } catch (cause) {
            if (error) {
                error.textContent = cause instanceof Error ? cause.message : 'Не удалось применить выбор пинов.';
                error.hidden = false;
            }
        } finally {
            button.disabled = false;
        }
    }

    close(): void {
        const modal = this.element?.querySelector<HTMLElement>('[data-picker-modal]');
        if (modal) modal.hidden = true;
    }

    destroy(): void {
        this.isDestroyed = true;
        this.element = null;
        this.pins = [];
        this.selectedPinIds.clear();
    }
}
