import './Sidebar.scss';
import template from './Sidebar.hbs';

const STORAGE_KEY = 'sidebarCollapsed';

/**
 * Боковое меню. Создаётся один раз в app.ts и живёт поверх любых страниц.
 * Ссылки обрабатывает глобальный обработчик кликов роутера.
 */
export class Sidebar {
    private element: HTMLElement | null = null;

    render(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});
        this.element = wrapper.firstElementChild as HTMLElement;

        const toggle = this.element.querySelector<HTMLButtonElement>('#sidebarToggle');
        let collapsed = this.readInitialState();

        const apply = () => {
            document.body.classList.toggle('sidebar-collapsed', collapsed);
            toggle?.setAttribute('aria-expanded', String(!collapsed));
        };
        apply();

        toggle?.addEventListener('click', () => {
            collapsed = !collapsed;
            apply();
            try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch { /* ignore */ }
        });

        return this.element;
    }

    private readInitialState(): boolean {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved !== null) return saved === 'true';
        } catch { /* localStorage недоступен */ }
        return window.innerWidth <= 768; // на телефонах по умолчанию скрыто
    }
}