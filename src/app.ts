import './styles';
import { routes } from './routes';

const root = document.getElementById('root');

/**
 * Текущий стек отрендеренных страниц.

 *
 * @type {Array<{ key: string, instance: { destroy?: () => void }, element: HTMLElement }>}
 */
let currentStack = [];
let previousPath = null;
let lastRenderedPathname = window.location.pathname;
let lastRenderedSearch = window.location.search;

/**
 * Роутер приложения. Передаётся страницам через конструктор,
 * чтобы они могли инициировать переходы без импорта из app.js
 * (это разрывает циклическую зависимость app - pages).
 */
const router = {
    /**
     * @param {string} url
     */
    navigateTo(url) {
        const target = new URL(url, window.location.href);
        const currentLocation = `${window.location.pathname}${window.location.search}`;
        const targetLocation = `${target.pathname}${target.search}`;
        if (currentLocation === targetLocation) return;

        previousPath = currentLocation;
        const samePathname = target.pathname === window.location.pathname;
        window.history.pushState({ from: previousPath }, '', `${target.pathname}${target.search}${target.hash}`);
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
        const stateFrom = window.history.state?.from;
        const candidate = previousPath || stateFrom;

        if (candidate && candidate !== window.location.pathname && candidate.startsWith('/')) {
            return candidate;
        }

        return fallback;
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
function findRoute(path) {
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
function destroyFrom(from) {
    for (let i = currentStack.length - 1; i >= from; i -= 1) {
        const layer = currentStack[i];
        try {
            layer.instance.destroy?.();
        } catch (e) {
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
    previousPath = null;
    if (window.location.pathname === lastRenderedPathname && window.location.search !== lastRenderedSearch) {
        destroyFrom(0);
    }
    lastRenderedPathname = window.location.pathname;
    lastRenderedSearch = window.location.search;
    renderPage();
});

// Первый рендер при загрузке страницы
renderPage();

// Service Worker кэширует оболочку приложения и локальные ресурсы для запуска без сети.
function registerServiceWorker() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .catch((error) => console.warn('Не удалось зарегистрировать Service Worker:', error));
    }, { once: true });
}

function updateNetworkStatus() {
    const status = document.getElementById('networkStatus');
    if (status) {
        status.hidden = navigator.onLine;
    }
}

registerServiceWorker();
updateNetworkStatus();
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);