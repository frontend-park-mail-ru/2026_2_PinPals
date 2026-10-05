Handlebars.registerHelper('isPassword', (type) => type === 'password');

import { SignUpPage } from './pages/SignUpPage/SignUpPage.js';
import { LoginPage } from './pages/LoginPage/LoginPage.js';
import { HomePage } from './pages/HomePage/HomePage.js';

const root = document.getElementById('root');

/**
 * Выполняет SPA-маршрутизацию и рендерит экраны.
 */
function renderPage() {

    root.innerHTML = '';
    const path = window.location.pathname;

    const homePage = new HomePage();
    root.append(homePage.render());

    if (path === '/signup') {
        const signUpPage = new SignUpPage();
        root.append(signUpPage.render());
    } else if (path === '/login') {
        const loginPage = new LoginPage();
        root.append(loginPage.render());
    }
}

/**
 * Переход между страницами без перезагрузки.
 *
 * @param {string} url - Ссылка перехода.
 */
export function navigateTo(url) {
    window.history.pushState(null, null, url);
    renderPage();
}

window.addEventListener('click', (e) => {
    const targetLink = e.target.closest('a');

    // Проверяем, локальная ли это ссылка (начинается с /)
    if (targetLink && targetLink.href && targetLink.getAttribute('href').startsWith('/')) {
        e.preventDefault(); // Запрещаем браузеру перезагружать страницу
        navigateTo(targetLink.getAttribute('href'));
    }
});

// Слушаем кнопки "Назад/Вперед" в браузере
window.addEventListener('popstate', renderPage);

// Первый рендер при загрузке страницы
renderPage();
