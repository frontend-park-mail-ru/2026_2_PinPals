import { Input } from '../../components/Input/Input.js';
import { Button } from '../../components/Button/Button.js';
import { loginUser } from '../../api/user.js';
import { navigateTo } from '../../app.js';

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';
const validatePassword = (val) => val.length >= 8 ? '' : 'Пароль минимум 8 символов';

/**
 * Класс, управляющий отображением и логикой работы страницы авторизации (входа) пользователя.
 */
export class LoginPage {
    /**
     * Создает экземпляр страницы LoginPage и инициализирует дочерние компоненты ввода и кнопок.
     */
    constructor() {
        this.loginInput = new Input({
            label: '', type: 'text', name: 'username',
            placeholder: 'Логин', validator: validateRequired
        });
        this.passInput = new Input({
            label: '', type: 'password', name: 'password',
            placeholder: 'Пароль', validator: validatePassword
        });
        this.loginBtn = new Button({ title: 'Вход', type: 'button', className: 'btn btn-first' });
        this.registerBtn = new Button({ title: 'Регистрация', type: 'button', className: 'btn btn-second' });
    }

    /**
     * Рендерит DOM-структуру страницы логина, внедряет компоненты инпутов/кнопок и навешивает события взаимодействия.
     *
     * @returns {HTMLElement} Корневой DOM-элемент страницы авторизации.
     */
    render() {
        const template = Handlebars.templates['LoginPage.hbs'];
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'login-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');
        formContainer.append(this.loginInput.render());
        formContainer.append(this.passInput.render());

        const buttonsContainer = wrapper.querySelector('.buttons-container');
        buttonsContainer.append(this.loginBtn.render());
        buttonsContainer.append(this.registerBtn.render());

        // Крестик — закрыть модалку
        wrapper.querySelector('.close-btn').addEventListener('click', () => {
            navigateTo('/home');
        });

        this.loginBtn.element.addEventListener('click', (e) => this.handleSubmit(e));
        this.registerBtn.element.addEventListener('click', () => navigateTo('/signup'));

        // Забыли пароль
        const forgotLink = wrapper.querySelector('.forgot-link');
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Функция восстановления пароля будет добавлена позже');
        });

        this.element = wrapper;
        return wrapper;
    }

    /**
     * Обрабатывает событие отправки формы авторизации на Go-бэкенд.
     * Проводит клиентскую валидацию, отправляет запрос, сохраняет JWT сессию при успехе.
     *
     * @async
     * @param {Event} e - Объект события отправки (клик/submit).
     * @returns {Promise<void>}
     */
    async handleSubmit(e) {
        e.preventDefault();

        const isLoginValid = this.loginInput.validate();
        const isPassValid = this.passInput.validate();
        if (!isLoginValid || !isPassValid) return;

        // Находим контейнер ошибки и очищаем его перед новым запросом
        const errorContainer = this.element.querySelector('#serverError');
        if (errorContainer) errorContainer.textContent = '';

        try {
            this.loginBtn.setDisabled(true);

            const result = await loginUser(
                this.loginInput.getValue(),
                this.passInput.getValue()
            );

            // Сохраняем сессию и JWT-токен, пришедшие с бэкенда
            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('token', result.token);
            localStorage.setItem('userName', result.user.name);

            navigateTo('/home');
        } catch (error) {
            if (errorContainer) {
                errorContainer.textContent = error.message;
            }
        } finally {
            this.loginBtn.setDisabled(false);
        }
    }
}
