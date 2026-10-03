export class HomePage {
    render() {
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';

        const pins = Array.from({ length: 30 }, (_, i) => {
            const height = 300 + (i * 53) % 250;
            return `https://picsum.photos/300/${height}?random=${i + 1}`;
        });

        const template = Handlebars.templates['HomePage.hbs'];
        const html = template({ isAuth, pins, userName });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        const headerLoginBtn = wrapper.querySelector('#headerLoginBtn');
        if (headerLoginBtn) {
            headerLoginBtn.addEventListener('click', () => {
                window.location.hash = '#/login';
            });
        }

        const headerRegisterBtn = wrapper.querySelector('#headerRegisterBtn');
        if (headerRegisterBtn) {
            headerRegisterBtn.addEventListener('click', () => {
                window.location.hash = '#/signup';
            });
        }

        const logoutBtn = wrapper.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('isAuth');
                localStorage.removeItem('userName');
                window.location.reload();
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
