import { Input } from "../../components/Input/Input.js";
import { Button } from "../../components/Button/Button.js";
import { signUpUser } from "../../api/user.js";
import { navigateTo } from "../../app.js";

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';
const validatePassword = (val) => val.length >= 8 ? '' : 'Пароль слишком короткий';
const validateBirthdate = (val) => {
    if (!val.trim()) return 'Поле обязательно';

    const selectedDate = new Date(val);
    const today = new Date();

    if (selectedDate > today) {
        return 'Дата рождения не может быть в будущем';
    }

    // Защита от слишком старых дат
    const minDate = new Date();
    minDate.setFullYear(today.getFullYear() - 120);
    if (selectedDate < minDate) {
        return 'Пожалуйста, укажите корректную дату';
    }

    return '';
};

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
            placeholder: '', validator: validateBirthdate
        });

        this.submitBtn = new Button({
            title: 'Зарегистрироваться',
            type: 'button',
            className: 'btn btn-first'
        });
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
        passHint.textContent = 'Не менее 8 символов';
        formContainer.append(passHint);

        formContainer.append(this.dateInput.render());

        // Ограничиваем выбор в самом календаре браузера
        const dateInputElement = this.dateInput.element.querySelector('input');
        if (dateInputElement) {
            const today = new Date();

            // Максимальная дата - сегодняшний день
            const maxDateStr = today.toISOString().split('T')[0];

            // Максимальный возраст - 120
            const minYear = today.getFullYear() - 120;
            const minDateStr = `${minYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            dateInputElement.setAttribute('max', maxDateStr);
            dateInputElement.setAttribute('min', minDateStr);
        }

        formContainer.append(this.submitBtn.render());

        // Крестик — закрыть модалку
        const closeBtn = wrapper.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            navigateTo('/home');
        });

        this.submitBtn.element.addEventListener('click', (e) => this.handleSubmit(e));

        this.element = wrapper;
        return wrapper;
    }

    async handleSubmit(e) {
        e.preventDefault();

        const isLoginValid = this.loginInput.validate();
        const isNickValid = this.nicknameInput.validate();
        const isPassValid = this.passInput.validate();
        const isDateValid = this.dateInput.validate();
        if (!isLoginValid || !isNickValid || !isPassValid || !isDateValid) return;

        // Находим контейнер для серверной ошибки и очищаем его перед запросом
        const errorContainer = this.element.querySelector('#serverError');
        if (errorContainer) errorContainer.textContent = '';

        try {
            this.submitBtn.setDisabled(true);

            const rawDate = this.dateInput.getValue();
            const formattedDate = rawDate ? `${rawDate}T00:00:00Z` : '';

            const result = await signUpUser(
                this.loginInput.getValue(),
                this.nicknameInput.getValue(),
                this.passInput.getValue(),
                formattedDate
            );

            // Сохраняем сессию
            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userName', this.nicknameInput.getValue());

            navigateTo('/home');
        } catch (error) {
            // Выводим ошибку бэкенда текстом прямо в интерфейс формы
            if (errorContainer) {
                errorContainer.textContent = error.message;
            }
        } finally {
            this.submitBtn.setDisabled(false);
        }
    }
}
