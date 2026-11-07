import { SignUpPage } from './pages/SignUpPage/SignUpPage.js';
import { LoginPage } from './pages/LoginPage/LoginPage.js';
import { HomePage } from './pages/HomePage/HomePage.js';
import { PinPage } from './pages/PinPage/PinPage.js';

const root = document.getElementById('root');

/**
 * Выполняет SPA-маршрутизацию и рендерит нужный экран.
 */
function renderPage() {
    if (!root) {
        return;
    }

    root.innerHTML = '';
    const path = window.location.pathname;

    const pinRoute = path.match(/^\/pin\/(\d+)\/?$/);

    if (pinRoute) {
        root.append(new PinPage(pinRoute[1]).render());
        return;
    }

    // Авторизация и регистрация остаются модальными окнами поверх главной.
    root.append(new HomePage().render());

    if (path === '/signup') {
        root.append(new SignUpPage().render());
    } else if (path === '/login') {
        root.append(new LoginPage().render());
    }
}

/**
 * Переход между страницами без перезагрузки.
 *
 * @param {string} url - Ссылка перехода.
 */
export function navigateTo(url) {
    if (window.location.pathname === url) {
        return;
    }

    window.history.pushState(null, null, url);
    window.scrollTo(0, 0);
    renderPage();
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
        navigateTo(href);
    }
});

// Слушаем кнопки "Назад/Вперед" в браузере
window.addEventListener('popstate', renderPage);

// Первый рендер при загрузке страницы
renderPage();
