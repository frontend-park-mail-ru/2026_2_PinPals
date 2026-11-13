import './SignUpPage.scss';
import '../pages.scss';
import { Input } from '../../components/Input/Input';
import { Button } from '../../components/Button/Button';
import { signUpUser, loginUser } from '../../api/user';
import template from './SignUpPage.hbs';

const validateRequired = (val) => val.trim().length > 0 ? '' : 'Поле обязательно';

const validatePassword = (val) => {
    if (val.length < 8) return 'Пароль минимум 8 символов';
    if (!/\p{L}/u.test(val)) return 'Пароль должен содержать хотя бы одну букву';
    return '';
};

const MIN_AGE = 13;

/**
 * Считает точный возраст в годах с учётом дня/месяца рождения.
 * @param {Date} birthDate
 * @param {Date} today
 * @returns {number}
 */
function calculateAge(birthDate, today) {
    let age = today.getFullYear() - birthDate.getFullYear();

    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) {
        age--;
    }

    return age;
}

const validateBirthdate = (val) => {
    if (!val.trim()) return 'Поле обязательно';

    // Парсим "YYYY-MM-DD" как локальную дату
    const [year, month, day] = val.split('-').map(Number);
    if (!year || !month || !day) {
        return 'Некорректная дата';
    }

    const selectedDate = new Date(year, month - 1, day);

    // Проверяем, что дата реально существует
    if (
        selectedDate.getFullYear() !== year ||
        selectedDate.getMonth() !== month - 1 ||
        selectedDate.getDate() !== day
    ) {
        return 'Некорректная дата';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate > today) {
        return 'Дата рождения не может быть в будущем';
    }

    const age = calculateAge(selectedDate, today);

    if (age < MIN_AGE) {
        return `Регистрация доступна с ${MIN_AGE} лет`;
    }


    return '';
};

/**
 * Валидатор совпадения паролей.
 * Принимает функцию-геттер значения основного пароля.
 */
const makePasswordMatchValidator = (getPassword) => (val) => {
    if (!val.trim()) return 'Поле обязательно';
    return val === getPassword() ? '' : 'Пароли не совпадают';
};

/**
 * Класс, управляющий отображением и логикой работы страницы создания учетной записи (регистрации).
 */
export class SignUpPage {
    [key: string]: any;
    /**
     * @param {Object} [options]
     * @param {import('../../routes').Router} [options.router] - роутер для переходов.
     */
    constructor({ router }: any = {}) {
        this.router = router;

        this.loginInput = new Input({
            label: '',
            type: 'text',
            name: 'username',
            placeholder: 'Логин',
            validator: validateRequired,
        });

        this.passInput = new Input({
            label: '',
            type: 'password',
            name: 'password',
            placeholder: 'Пароль',
            validator: validatePassword,
        });

        // Поле повтор пароля - валидируется после основного
        this.passConfirmInput = new Input({
            label: '',
            type: 'password',
            name: 'password_confirm',
            placeholder: 'Пароль еще раз',
            validator: makePasswordMatchValidator(() => this.passInput.getValue()),
        });

        this.dateInput = new Input({
            label: '',
            type: 'date',
            name: 'birthdate',
            placeholder: 'Введите дату рождения',
            validator: validateBirthdate,
        });

        this.submitBtn = new Button({
            title: 'Вход',
            type: 'button',
            className: 'btn btn-first',
        });
    }

    /**
     * Рендерит форму регистрации, навешивает ограничения браузерного календаря и инициализирует слушатели кликов.
     *
     * @returns {HTMLElement} Корневой DOM-элемент страницы регистрации.
     */
    render() {
        const html = template({});

        const wrapper = document.createElement('div');
        wrapper.className = 'sign-up-page';
        wrapper.innerHTML = html;

        const formContainer = wrapper.querySelector('.form-container');

        // 1. Логин + подсказка снизу
        formContainer.append(this.loginInput.render());
        const usernameInput = this.loginInput.element.querySelector('input');
        if (usernameInput) usernameInput.maxLength = 64;
        const loginHint = document.createElement('div');
        loginHint.className = 'field-hint';
        loginHint.textContent = 'Логин должен быть уникальным';
        formContainer.append(loginHint);

        // 2. Пароль
        formContainer.append(this.passInput.render());

        this.passInput.element.classList.add('password-gap');

        // 3. Повтор пароля + подсказка снизу
        formContainer.append(this.passConfirmInput.render());
        const passHint = document.createElement('div');
        passHint.className = 'field-hint';
        passHint.textContent = 'Не менее 8 символов, включая хотя бы одну букву';
        formContainer.append(passHint);

        // 4. Дата рождения
        formContainer.append(this.dateInput.render());

        const birthdateHint = document.createElement('div');
        birthdateHint.className = 'field-hint field-hint--tight';
        birthdateHint.textContent = 'Введите дату рождения';
        formContainer.append(birthdateHint);

        // Ограничиваем выбор в самом календаре браузера
        const dateInputElement = this.dateInput.element.querySelector('input');
        if (dateInputElement) {
            const today = new Date();

            const maxDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            dateInputElement.setAttribute('max', maxDateStr);
        }

        // 5. Кнопка
        formContainer.append(this.submitBtn.render());

        // Крестик - закрыть модалку
        const closeBtn = wrapper.querySelector('.close-btn');
        closeBtn.addEventListener('click', () => {
            this.router.navigateTo('/home');
        });

        this.submitBtn.element.addEventListener('click', (e) => this.handleSubmit(e));

        this.element = wrapper;
        return wrapper;
    }

    /**
     * Обрабатывает отправку данных на регистрацию.
     * После успешной регистрации выполняет автоматическую авторизацию пользователя (логин) для сохранения сессии.
     *
     * @async
     * @param {Event} e - Объект события клика.
     * @returns {Promise<void>}
     */
    async handleSubmit(e) {
        e.preventDefault();

        const isLoginValid = this.loginInput.validate();
        const isPassValid = this.passInput.validate();
        const isPassConfirmValid = this.passConfirmInput.validate();
        const isDateValid = this.dateInput.validate();

        if (!isLoginValid || !isPassValid || !isPassConfirmValid || !isDateValid) return;

        // Находим контейнер для серверной ошибки и очищаем его перед запросом
        const errorContainer = this.element.querySelector('#serverError');
        if (errorContainer) errorContainer.textContent = '';

        try {
            this.submitBtn.setDisabled(true);

            const rawDate = this.dateInput.getValue();
            const username = this.loginInput.getValue();
            const password = this.passInput.getValue();

            // Регистрируем пользователя
            await signUpUser(username, username, password, rawDate);

            // Автоматически логиним (бэкенд установит HttpOnly cookie)
            const loginResult = await loginUser(username, password);

            // Сохраняем состояние без поиска JWT-токена в JSON
            localStorage.setItem('isAuth', 'true');
            localStorage.setItem('userName', loginResult.user.name);
            localStorage.setItem('userId', String(loginResult.user.user_id));
            localStorage.setItem('userTag', loginResult.user.user_tag || '');
            localStorage.setItem('userAvatarUrl', loginResult.user.avatar_url || '');

            this.router.refreshHeader();
            this.router.navigateTo('/home');
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