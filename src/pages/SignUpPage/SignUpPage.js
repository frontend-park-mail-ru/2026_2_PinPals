import { Input } from "../../components/Input/Input.js";
import { Button } from "../../components/Button/Button.js";
import { signUpUser } from "../../api/user.js";

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';
const validatePassword = (val) => val.length >= 6 ? '' : 'Пароль слишком короткий';

export class SignUpPage {
    constructor() {
        this.loginInput = new Input({
            label: '', type: 'text', name: 'username',
            placeholder: 'Введите логин', validator: validateRequired
        });
        this.nicknameInput = new Input({
            label: '', type: 'text', name: 'nickname',
            placeholder: 'Придумайте ник', validator: validateRequired
        });
        this.passInput = new Input({
            label: '', type: 'password', name: 'password',
            placeholder: 'Создайте пароль', validator: validatePassword
        });
        this.dateInput = new Input({
            label: '', type: 'date', name: 'birthdate',
            placeholder: '', validator: validateRequired
        });

        this.submitBtn = new Button({ title: 'Зарегистрироваться' });
    }

    render() {
        const template = Handlebars.templates['SignUpPage.hbs'];
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'sign-up-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');
        formContainer.append(this.loginInput.render());
        formContainer.append(this.nicknameInput.render());
        formContainer.append(this.passInput.render());

        const passHint = document.createElement('div');
        passHint.className = 'field-hint';
        passHint.textContent = 'Не менее 6 символов';
        formContainer.append(passHint);

        formContainer.append(this.dateInput.render());
        formContainer.append(this.submitBtn.render());

        // Глаз
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

        // Крестик — закрыть модалку
        const closeBtn = wrapper.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            window.location.hash = '#/home';
        });

        this.submitBtn.element.addEventListener('click', (e) => this.handleSubmit(e));

        return wrapper;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const isLoginValid = this.loginInput.validate();
        const isNickValid = this.nicknameInput.validate();
        const isPassValid = this.passInput.validate();
        const isDateValid = this.dateInput.validate();
        if (!isLoginValid || !isNickValid || !isPassValid || !isDateValid) return;

        try {
            this.submitBtn.element.disabled = true;
            const result = await signUpUser(
                this.loginInput.getValue(),
                this.nicknameInput.getValue(),
                this.passInput.getValue(),
                this.dateInput.getValue()
            );
            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userName', this.nicknameInput.getValue());
            alert(result.message);

            window.location.hash = '#/home';
        } catch (error) {
            alert('Ошибка: ' + error.message);
        } finally {
            this.submitBtn.element.disabled = false;
        }
    }
}
