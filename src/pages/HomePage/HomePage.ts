import { fetchPins } from '../../api/user';
import { PinCard } from '../../components/PinCard/PinCard';
import { Header } from '../../components/Header/Header';
import template from './HomePage.hbs';

const PAGE_SIZE = 30;

export class HomePage {
    [key: string]: any;
    constructor({ router }: any = {}) {
        this.router = router;
        this.header = null;
        this.observer = null;
    }

    render() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = template({});

        const homePage = wrapper.querySelector('.home-page');
        if (homePage) {
            this.header = new Header({ router: this.router });
            homePage.prepend(this.header.render());
        }

        const grid = wrapper.querySelector('.pins-grid');
        const loadError = wrapper.querySelector<HTMLElement>('#pinsLoadError');

        let nextCursor = null;
        let isLoading = false;
        let hasMore = true;
        let sentinel: HTMLElement | null = null;

        const appendPins = (pins) => {
            if (!grid) return;
            const fragment = document.createDocumentFragment();
            for (const pin of pins) fragment.appendChild(new PinCard(pin).render());
            grid.appendChild(fragment);
        };

        const loadPins = async () => {
            if (!grid || isLoading || !hasMore) return;
            isLoading = true;

            try {
                const data = await fetchPins(PAGE_SIZE, nextCursor);
                const pins = data.pins || [];

                if (!pins.length) {
                    // Совсем пустая лента: больше не запрашиваем.
                    if (nextCursor === null) {
                        hasMore = false;
                        return;
                    }
                    // Дошли до конца: следующий запрос начнёт ленту заново.
                    nextCursor = null;
                    return;
                }

                appendPins(pins);
                // Если next_cursor пришёл пустым, курсор остаётся null,
                // и следующая порция снова начнётся с самого начала. Лента бесконечная.
                nextCursor = data.next_cursor ?? null;
            } catch (error) {
                hasMore = false;
                if (loadError) {
                    loadError.textContent = 'Не удалось загрузить пины. Проверьте подключение и обновите страницу.';
                    loadError.hidden = false;
                }
            } finally {
                isLoading = false;
                // Если sentinel всё ещё на экране, observer сам не сработает,
                // поэтому перезапускаем наблюдение, чтобы подгрузка продолжилась.
                if (hasMore && sentinel && this.observer) {
                    this.observer.unobserve(sentinel);
                    this.observer.observe(sentinel);
                }
            }
        };

        void loadPins();

        if (grid && 'IntersectionObserver' in window) {
            sentinel = document.createElement('div');
            sentinel.className = 'pins-load-more-sentinel';
            sentinel.setAttribute('aria-hidden', 'true');
            grid.after(sentinel);

            this.observer = new IntersectionObserver((entries) => {
                if (!sentinel?.isConnected) { this.observer?.disconnect(); return; }
                if (entries.some((entry) => entry.isIntersecting)) void loadPins();
            }, { rootMargin: '500px 0px' });

            this.observer.observe(sentinel);
        }

        return wrapper;
    }

    refreshHeader() { this.header?.refresh(); }

    destroy() {
        this.header?.destroy();
        this.header = null;
        this.observer?.disconnect();
        this.observer = null;
    }
}
