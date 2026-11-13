import './LoginPage.scss';
import '../pages.scss';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { loginUser } from '../../api/user';
import template from './LoginPage.hbs';

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';
const validatePassword = (val) => val.length >= 8 ? '' : 'Пароль минимум 8 символов';

/**
 * Класс, управляющий отображением и логикой работы страницы авторизации (входа) пользователя.
 */
export class LoginPage {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router] - роутер для переходов.
     */
    constructor({ router }: any = {}) {
        this.router = router;

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
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'login-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');
        formContainer.append(this.loginInput.render());
        this.loginInput.element.classList.add('password-gap');
        formContainer.append(this.passInput.render());

        const buttonsContainer = wrapper.querySelector('.buttons-container');
        buttonsContainer.append(this.loginBtn.render());
        buttonsContainer.append(this.registerBtn.render());

        // Крестик — закрыть модалку
        wrapper.querySelector('.close-btn').addEventListener('click', () => {
            this.router.navigateTo('/home');
        });

        this.loginBtn.element.addEventListener('click', (e) => this.handleSubmit(e));
        this.registerBtn.element.addEventListener('click', () => this.router.navigateTo('/signup'));

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

            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userName', result.user.name);
            localStorage.setItem('userId', String(result.user.user_id));
            localStorage.setItem('userTag', result.user.user_tag || '');
            localStorage.setItem('userAvatarUrl', result.user.avatar_url || '');

            this.router.refreshHeader();
            this.router.navigateTo('/home');
        } catch (error) {
            if (errorContainer) {
                errorContainer.textContent = 'Неверный логин или пароль';
            }
        } finally {
            this.loginBtn.setDisabled(false);
        }
    }
}