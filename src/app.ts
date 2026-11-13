
import './app.scss';
import { routes } from './routes';
import type { AppRoute, Router } from './routes';
import { Sidebar } from './components/Sidebar/Sidebar';

const root = document.getElementById('root');

/**
 * Текущий стек отрендеренных страниц.

 *
 * @type {Array<{ key: string, instance: { destroy?: () => void }, element: HTMLElement }>}
 */
type RenderedPage = {
    key: string;
    instance: {
        render: () => HTMLElement;
        destroy?: () => void;
        refreshHeader?: () => void;
    };
    element: HTMLElement;
};

const currentStack: RenderedPage[] = [];
let lastRenderedPathname = window.location.pathname;
let lastRenderedSearch = window.location.search;

/**
 * Роутер приложения. Передаётся страницам через конструктор,
 * чтобы они могли инициировать переходы без импорта из app.js
 * (это разрывает циклическую зависимость app - pages).
 */
const router: Router = {
    /**
     * @param {string} url
     */
    navigateTo(url) {
        const target = new URL(url, window.location.href);
        const currentLocation = `${window.location.pathname}${window.location.search}`;
        const targetLocation = `${target.pathname}${target.search}`;
        if (currentLocation === targetLocation) return;

        const samePathname = target.pathname === window.location.pathname;
        window.history.pushState({ from: currentLocation }, '', `${target.pathname}${target.search}${target.hash}`);
        if (samePathname) destroyFrom(0);
        lastRenderedPathname = window.location.pathname;
        lastRenderedSearch = window.location.search;
        window.scrollTo(0, 0);
        renderPage();
    },

    /**
     * @param {string} [fallback='/home']
     * @returns {string}
     */
    getBackUrl(fallback = '/home') {
        const candidate = window.history.state?.from;
        if (typeof candidate === 'string' && candidate.startsWith('/') && candidate !== window.location.pathname) {
            return candidate;
        }
        return fallback;
    },

    navigateBack(fallback = '/home') {
        const candidate = window.history.state?.from;
        if (typeof candidate === 'string' && candidate.startsWith('/') && candidate !== window.location.pathname) {
            window.history.back();
            return;
        }

        // При прямом открытии страницы предыдущей записи приложения может не быть.
        // В этом случае заменяем текущую запись, иначе следующий Back вернёт на неё.
        const target = new URL(fallback, window.location.href);
        window.history.replaceState({ from: null }, '', `${target.pathname}${target.search}${target.hash}`);
        destroyFrom(0);
        lastRenderedPathname = window.location.pathname;
        lastRenderedSearch = window.location.search;
        window.scrollTo(0, 0);
        renderPage();
    },

    refreshHeader() {
        for (const layer of currentStack) {
            layer.instance.refreshHeader?.();
        }
    },
 };

// API layer emits this event after a protected endpoint responds with 401.
window.addEventListener('app:auth-expired', () => router.refreshHeader());

/**
 * @param {string} path
 * @returns {{ route: import('./routes').AppRoute, match: RegExpExecArray } | null}
 */
function findRoute(path: string): { route: AppRoute; match: RegExpExecArray } | null {
    for (const route of routes) {
        // Сбрасываем lastIndex, чтобы регулярки с флагом g не «залипали»
        route.pattern.lastIndex = 0;

        const match = route.pattern.exec(path);
        if (match) {
            return { route, match };
        }
    }

    return null;
}

/**
 * Уничтожает слои старого стека начиная с индекса `from`.
 *
 * @param {number} from
 */
function destroyFrom(from: number): void {
    for (let i = currentStack.length - 1; i >= from; i -= 1) {
        const layer = currentStack[i];
        try {
            layer.instance.destroy?.();
        } catch (e: unknown) {
            console.warn('destroy() страницы упал', e);
        }
        layer.element.remove();
    }
    currentStack.length = from;
}

/**
 * Рендерит нужный стек страниц. Слои, чей ключ совпал с текущим стеком,
 * переиспользуются без пересоздания - это убирает мигание при переходах
 * между модалками (например, /signup -> /login: HomePage остаётся).
 */
function renderPage() {
    if (!root) {
        return;
    }

    const found = findRoute(window.location.pathname);
    if (!found) {
        destroyFrom(0);
        return;
    }

    const nextPages = found.route.pages(found.match, { router });

    // Ищем первое расхождение ключей.
    let i = 0;
    while (
        i < currentStack.length &&
        i < nextPages.length &&
        currentStack[i].key === nextPages[i].key
        ) {
        i += 1;
    }

    // Всё, что было дальше по стеку, снимаем.
    destroyFrom(i);

    // Остаток нового стека рендерим и пушим.
    for (let j = i; j < nextPages.length; j += 1) {
        const { key, instance } = nextPages[j];
        const element = instance.render();
        root.append(element);
        currentStack.push({ key, instance, element });
    }
}

window.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    const eventTarget = event.target as Node | null;
    const target = eventTarget instanceof Element ? eventTarget : eventTarget?.parentElement;
    const targetLink = target?.closest('a');
    const href = targetLink?.getAttribute('href');

    if (targetLink && targetLink.hasAttribute('data-router-back')) {
        event.preventDefault();
        router.navigateBack(targetLink.getAttribute('data-router-back') || href || '/home');
        return;
    }

    if (
        targetLink &&
        href &&
        href.startsWith('/') &&
        targetLink.target !== '_blank'
    ) {
        event.preventDefault();
        router.navigateTo(href);
    }
});

// Слушаем кнопки "Назад/Вперед" в браузере
window.addEventListener('popstate', () => {
    if (window.location.pathname === lastRenderedPathname && window.location.search !== lastRenderedSearch) {
        destroyFrom(0);
    }
    lastRenderedPathname = window.location.pathname;
    lastRenderedSearch = window.location.search;
    renderPage();
});

// Первый рендер при загрузке страницы
renderPage();
// Меню живёт вне стека страниц, поэтому доступно на любой странице
document.body.append(new Sidebar().render());

// Service Worker кэширует оболочку приложения и локальные ресурсы для запуска без сети.
function registerServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch((error: unknown) => console.warn('Не удалось зарегистрировать Service Worker:', error));
    }, { once: true });
}

async function updateNetworkStatus() {
    const status = document.getElementById('networkStatus');
    if (!status) return;
    try {
        await fetch('/manifest.webmanifest', { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(4000) });
        status.hidden = true;
    } catch {
        status.hidden = false;
    }
}

registerServiceWorker();
void updateNetworkStatus();
window.addEventListener('online', () => void updateNetworkStatus());
window.addEventListener('offline', () => void updateNetworkStatus());