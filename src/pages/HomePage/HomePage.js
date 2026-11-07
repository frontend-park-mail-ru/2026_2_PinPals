import { fetchPins } from '../../api/user.js';
import { PinCard } from '../../components/PinCard/PinCard.js';
import { Header } from '../../components/Header/Header.js';
import template from './HomePage.hbs';

const PAGE_SIZE = 30;

/**
 * Класс, управляющий отображением главной страницы и бесконечной ленты.
 */
export class HomePage {
    /**
     * Рендерит разметку главной страницы и загружает пины с бэкенда.
     *
     * @returns {HTMLElement} Корневой элемент страницы.
     */
    render() {
        const html = template({ pins: [] });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const homePage = wrapper.querySelector('.home-page');
        if (homePage) {
            homePage.prepend(new Header().render());
        }

        const grid = wrapper.querySelector('.pins-grid');

        let nextCursor = null;
        let isLoading = false;
        let hasMore = true;

        const appendPins = (pins) => {
            if (!grid) {
                return;
            }

            const fragment = document.createDocumentFragment();

            for (const pin of pins) {
                fragment.appendChild(new PinCard(pin).render());
            }

            grid.appendChild(fragment);
        };

        const loadPins = async () => {
            if (!grid || isLoading || !hasMore) {
                return;
            }

            isLoading = true;

            try {
                const data = await fetchPins(PAGE_SIZE, nextCursor);

                appendPins(data.pins);

                nextCursor = data.next_cursor ?? null;
                hasMore = nextCursor !== null;
            } catch {
                hasMore = false;
            } finally {
                isLoading = false;
            }
        };

        void loadPins();

        if (grid && 'IntersectionObserver' in window) {
            const sentinel = document.createElement('div');
            sentinel.className = 'pins-load-more-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');

            grid.after(sentinel);

            const observer = new IntersectionObserver(
                (entries) => {
                    if (!sentinel.isConnected) {
                        observer.disconnect();
                        return;
                    }

                    if (entries.some((entry) => entry.isIntersecting)) {
                        void loadPins();
                    }
                },
                {
                    rootMargin: '500px 0px',
                },
            );

            observer.observe(sentinel);
        }

        const root = wrapper.querySelector('.home-page');
        const toggle = wrapper.querySelector('#sidebarToggle');

        if (toggle && root) {
            toggle.addEventListener('click', () => {
                root.classList.toggle('sidebar-collapsed');
            });
        }

        wrapper.querySelectorAll('.sidebar-item[data-action]').forEach((item) => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
            });
        });

        return wrapper;
    }
}