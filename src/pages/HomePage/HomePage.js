import { navigateTo } from "../../app.js";

export class HomePage {
    render() {
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';

        const localImages = [
            '/public/img/logo_straight.png', // временно используем логотипы для теста
            '/public/img/main_logo.png'
        ];

        const pins = Array.from({ length: 30 }, (_, i) => {
            return localImages[i % localImages.length];
        });

        const template = Handlebars.templates['HomePage.hbs'];
        const html = template({ isAuth, pins, userName });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const headerLoginBtn = wrapper.querySelector('#headerLoginBtn');
        if (headerLoginBtn) {
            headerLoginBtn.addEventListener('click', () => {
                navigateTo('/login');
            });
        }

        const headerRegisterBtn = wrapper.querySelector('#headerRegisterBtn');
        if (headerRegisterBtn) {
            headerRegisterBtn.addEventListener('click', () => {
                navigateTo('/signup');
            });
        }

        const logoutBtn = wrapper.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('isAuth');
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
            item.addEventListener('click', (e) => {
                e.preventDefault();
            });
        });

        return wrapper;
    }
}
