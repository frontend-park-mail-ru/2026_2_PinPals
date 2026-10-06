import { navigateTo } from '../../app.js';
import { fetchPins } from '../../api/user.js';

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
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';

        const template = Handlebars.templates['HomePage.hbs'];
        const html = template({
            isAuth,
            pins: [],
            userName,
        });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

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
                const card = document.createElement('div');
                card.className = 'pin-card';

                const image = document.createElement('img');

                image.src = pin.image_url;
                image.alt = pin.name ?? '';
                image.title = pin.description ?? '';
                image.loading = 'lazy';

                card.appendChild(image);
                fragment.appendChild(card);
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
            } catch (err) {
                console.error(
                    'Не удалось загрузить пины с бэкенда:',
                    err,
                );
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

        const logoutBtn = wrapper.querySelector('#logoutBtn');

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('isAuth');
                localStorage.removeItem('token');
                localStorage.removeItem('userName');

                navigateTo('/');
            });
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
