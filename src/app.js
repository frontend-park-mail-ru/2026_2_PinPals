import { routes } from './routes.js';

const root = document.getElementById('root');

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
        if (window.location.pathname === url) {
            return;
        }

        window.history.pushState(null, null, url);
        window.scrollTo(0, 0);
        renderPage();
    },
};

/**
 * Находит первый маршрут, чья регулярка совпала с текущим путём.
 *
 * @param {string} path
 * @returns {{ route: import('./routes.js').AppRoute, match: RegExpExecArray } | null}
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
 * Выполняет SPA-маршрутизацию и рендерит нужные экраны.
 */
function renderPage() {
    if (!root) {
        return;
    }

    root.innerHTML = '';

    const found = findRoute(window.location.pathname);
    if (!found) {
        return;
    }

    // pages возвращает массив: первый компонент - основная страница,
    // остальные рендерятся поверх (модальные окна).
    const pages = found.route.pages(found.match, { router });
    for (const page of pages) {
        root.append(page.render());
    }
}

window.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
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
window.addEventListener('popstate', renderPage);

// Первый рендер при загрузке страницы
renderPage();