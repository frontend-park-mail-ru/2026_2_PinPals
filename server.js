const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Принимаем только JSON
app.use(express.json());

app.use(express.static(path.join(__dirname)));

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// API: регистрация
app.post('/api/signup', (req, res) => {
    const { username, nickname, password, birthdate } = req.body;

    if (!username || !nickname || !password || !birthdate) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    }

    const parsedDate = new Date(birthdate);
    // Проверка на Invalid Date
    if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Некорректный формат даты' });
    }

    const today = new Date();
    let age = today.getFullYear() - parsedDate.getFullYear();
    if (today.getMonth() < parsedDate.getMonth() ||
        (today.getMonth() === parsedDate.getMonth() && today.getDate() < parsedDate.getDate())) {
        age--;
    }
    if (age > 120) {
        return res.status(400).json({ error: 'Указан недопустимый возраст' });
    }

    res.json({ success: true, message: 'Вы успешно зарегистрировались' });
});

app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порте ${PORT}`);
});

// API: авторизация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Заполните все поля' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль минимум 8 символов' });
    }

    // Пока заглушка
    if (username !== 'admin' || password !== '12345678') {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    res.json({ success: true, message: 'Вы успешно вошли в систему' });
});
