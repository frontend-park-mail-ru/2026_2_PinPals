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
        // Оставляем type: 'password', чтобы сработал хелпер в шаблоне
        this.passInput = new Input({
            label: '', type: 'password', name: 'password',
            placeholder: 'Создайте пароль', validator: validatePassword
        });
        // Ставим тип 'date' для вызова стандартного календаря браузера
        this.dateInput = new Input({
            label: '', type: 'date', name: 'birthdate',
            placeholder: '', validator: validateRequired
        });

        this.submitBtn = new Button({ title: 'Войти' });
    }

    render() {
        const template = Handlebars.templates['SignUpPage.hbs'];
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'sign-up-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');

        // Вставляем все компоненты по очереди
        formContainer.append(this.loginInput.render());
        formContainer.append(this.nicknameInput.render());
        formContainer.append(this.passInput.render());

        // Добавляем текстовую подсказку под паролем
        const passHint = document.createElement('div');
        passHint.className = 'field-hint';
        passHint.textContent = 'Не менее 6 символов';
        formContainer.append(passHint);

        formContainer.append(this.dateInput.render());
        formContainer.append(this.submitBtn.render());

        // ГЛАЗА: Работа с картинкой
        const eyeImg = wrapper.querySelector('.eye-icon-img');
        const passInputField = this.passInput.element.querySelector('input');

        if (eyeImg) {
            eyeImg.addEventListener('click', () => {
                if (passInputField.type === 'password') {
                    passInputField.type = 'text';
                    eyeImg.src = '/public/img/eye-open.png'; // Путь к картинке закрытого глаза
                } else {
                    passInputField.type = 'password';
                    eyeImg.src = '/public/img/eye-closed.png';   // Путь к картинке открытого глаза
                }
            });
        }

        // КРЕСТИК: Очищаем и скрываем форму
        const closeBtn = wrapper.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            wrapper.style.display = 'none';
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
                this.loginInput.getValue(),      // username
                this.nicknameInput.getValue(),   // nickname
                this.passInput.getValue(),       // password
                this.dateInput.getValue()        // birthdate
            );
            alert(result.message);
        } catch (error) {
            alert('Ошибка: ' + error.message);
        } finally {
            this.submitBtn.element.disabled = false;
        }
    }
}
