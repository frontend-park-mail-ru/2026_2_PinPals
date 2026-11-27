import { PAGE_SIZE } from '../../api/pageSize';
import { PinColumns } from '../../components/PinCard/pinColumns';
import { BoardCard } from '../../components/BoardCard/BoardCard';
import { Header } from '../../components/Header/Header';
import { search, type SearchType } from '../../api/search';
import type { Router } from '../../routes';
import template from './SearchPage.hbs';
import cards from './cards.hbs';
import './SearchPage.scss';

const labels = { pins: 'Пины', desks: 'Доски', users: 'Люди' };

export class SearchPage {
    private pinColumns = new PinColumns();
    private header: Header;
    private controller = new AbortController();

    constructor(router: Router) {
        this.header = new Header({ router });
    }

    render() {
        const params = new URLSearchParams(location.search);
        const query = (params.get('q') || '').trim();
        const requested = params.get('type');
        const type: SearchType = requested === 'users' || requested === 'desks' ? requested : 'pins';
        const tabs = Object.entries(labels).map(([key, label]) => ({
            label, active: type === key, href: '/search?' + new URLSearchParams({ q: query, type: key }),
        }));
        const needsLogin = type === 'users' && localStorage.getItem('isAuth') !== 'true';
        const page = document.createElement('div');
        page.className = 'search-page';
        page.innerHTML = template({ tabs, needsLogin });
        page.prepend(this.header.render());
        const status = page.querySelector<HTMLElement>('[role="status"]');
        const results = page.querySelector<HTMLElement>('.search-results');
        const retry = page.querySelector<HTMLButtonElement>('button.search-retry');
        const gridClass = { pins: 'pins-grid', desks: 'profile-boards-grid', users: 'search-users-grid' };
        results.classList.add(gridClass[type]);
        let offset = 0;

        const load = async () => {
            retry.hidden = true;
            status.textContent = 'Ищем…';
            try {
                do {
                    const data = await search(type, query, offset, PAGE_SIZE, this.controller.signal);
                    if (this.controller.signal.aborted) return;
                    let count: number;
                    if ('pins' in data) {
                        this.pinColumns.append(results, data.pins);
                        count = data.pins.length;
                    } else if ('desks' in data) {
                        results.append(...data.desks.map(desk => new BoardCard(desk).render()));
                        count = data.desks.length;
                    } else {
                        results.insertAdjacentHTML('beforeend', cards({ items: data.users }));
                        count = data.users.length;
                    }
                    offset += count;
                    if (count < PAGE_SIZE) break;
                } while (!this.controller.signal.aborted);
                status.textContent = offset ? '' : 'Ничего не найдено';
            } catch {
                if (this.controller.signal.aborted) return;
                status.textContent = 'Не удалось загрузить результаты.';
                retry.hidden = false;
            }
        };
        retry.addEventListener('click', load);
        if (!query || Array.from(query).length > 100) {
            status.textContent = 'Введите запрос длиной от 1 до 100 символов.';
        } else if (!needsLogin) {
            void load();
        }
        return page;
    }

    refreshHeader() {
        this.header.refresh();
    }

    destroy() {
        this.pinColumns.disconnect();
        this.controller.abort();
        this.header.destroy();
    }
}
