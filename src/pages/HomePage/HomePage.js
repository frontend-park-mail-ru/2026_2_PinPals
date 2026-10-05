import { navigateTo } from "../../app.js";
import { fetchPins } from "../../api/user.js"; // Импортируем метод запроса пинов

export class HomePage {
    render() {
        const isAuth = localStorage.getItem('isAuth') === 'true';
        const userName = localStorage.getItem('userName') || 'Пользователь';

        const template = Handlebars.templates['HomePage.hbs'];
        // Изначально рендерим разметку без пинов
        const html = template({ isAuth, pins: [], userName });

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;

        // Делаем асинхронный запрос к Go-серверу
        fetchPins(30)
            .then(data => {
                const grid = wrapper.querySelector('.pins-grid');
                if (grid && data.pins) {
                    // Очищаем сетку от пустоты и рендерим реальные карточки
                    grid.innerHTML = data.pins.map(pin => `
                        <div class="pin-card">
                            <img src="${pin.image_url}" alt="${pin.name}" title="${pin.description || ''}">
                        </div>
                    `).join('');
                }
            })
            .catch(err => {
                console.error("Не удалось загрузить пины с бэкенда:", err);
            });

        // Кнопка логаута (очищаем токен тоже)
        const logoutBtn = wrapper.querySelector('#logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('isAuth');
                localStorage.removeItem('token'); // Важно удалять токен
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
