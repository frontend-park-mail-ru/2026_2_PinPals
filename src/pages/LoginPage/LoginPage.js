import { Input } from "../../components/Input/Input.js";
import { loginUser } from "../../api/user.js";

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';
const validatePassword = (val) => val.length >= 6 ? '' : 'Пароль минимум 6 символов';

export class LoginPage {
    constructor() {
        this.loginInput = new Input({
            label: '', type: 'text', name: 'username',
            placeholder: 'Логин', validator: validateRequired
        });
        this.passInput = new Input({
            label: '', type: 'password', name: 'password',
            placeholder: 'Пароль', validator: validatePassword
        });
    }

    render() {
        const template = Handlebars.templates['LoginPage.hbs'];
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'login-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');
        formContainer.append(this.loginInput.render());
        formContainer.append(this.passInput.render());

        // Глаз — переключаем пароль
        const eyeImg = wrapper.querySelector('.eye-icon-img');
        const passInputField = this.passInput.element.querySelector('input');

        if (eyeImg) {
            eyeImg.addEventListener('click', () => {
                if (passInputField.type === 'password') {
                    passInputField.type = 'text';
                    eyeImg.src = '/public/img/eye-open.png';
                } else {
                    passInputField.type = 'password';
                    eyeImg.src = '/public/img/eye-closed.png';
                }
            });
        }

        // Крестик — скрыть форму
        const closeBtn = wrapper.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            wrapper.style.display = 'none';
        });

        // Кнопка "Вход"
        const loginBtn = wrapper.querySelector('.btn-login');
        loginBtn.addEventListener('click', (e) => this.handleSubmit(e));

        // Кнопка "Регистрация" — переход на страницу регистрации
        const registerBtn = wrapper.querySelector('.btn-register');
        registerBtn.addEventListener('click', () => {
            window.location.hash = '#/signup';
        });

        // Ссылка "Забыли пароль?"
        const forgotLink = wrapper.querySelector('.forgot-link');
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Функция восстановления пароля будет добавлена позже');
        });

        return wrapper;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const isLoginValid = this.loginInput.validate();
        const isPassValid = this.passInput.validate();

        if (!isLoginValid || !isPassValid) return;

        try {
            const result = await loginUser(
                this.loginInput.getValue(),
                this.passInput.getValue()
            );
            alert(result.message);
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    }
}