import { fetchPins } from '../../api/user';
import { PinCard } from '../../components/PinCard/PinCard';
import { Header } from '../../components/Header/Header';
import template from './HomePage.hbs';

const PAGE_SIZE = 30;

export class HomePage {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router] - роутер для переходов.
     */
    constructor({ router }: any = {}) {
        this.router = router;
        /** @type {import('../../components/Header/Header').Header|null} */
        this.header = null;
        /** @type {IntersectionObserver|null} */
        this.observer = null;
    }

    render() {
        const html = template({ pins: [] });
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const homePage = wrapper.querySelector('.home-page');
        if (homePage) {
            this.header = new Header({ router: this.router });
            homePage.prepend(this.header.render());
        }

        const grid = wrapper.querySelector('.pins-grid');

        let nextCursor = null;
        let isLoading = false;
        let hasMore = true;
        const loadError = wrapper.querySelector<HTMLElement>('#pinsLoadError');

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
            } catch (error) {
                hasMore = false;
                if (loadError) {
                    loadError.textContent = 'Не удалось загрузить пины. Проверьте подключение и обновите страницу.';
                    loadError.hidden = false;
                }
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

            this.observer = new IntersectionObserver(
                (entries) => {
                    if (!sentinel.isConnected) {
                        this.observer?.disconnect();
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

            this.observer.observe(sentinel);
        }

        const toggle = wrapper.querySelector('#sidebarToggle');

        if (toggle && homePage) {
            toggle.addEventListener('click', () => {
                homePage.classList.toggle('sidebar-collapsed');
            });
        }

        return wrapper;
    }

    /**
     * Перерисовывает встроенный Header по актуальному состоянию localStorage.
     * Вызывается роутером из `router.refreshHeader()` после логина.
     */
    refreshHeader() {
        this.header?.refresh();
    }

    destroy() {
        this.header?.destroy();
        this.header = null;

        this.observer?.disconnect();
        this.observer = null;
    }
}