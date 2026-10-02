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
    if (password.length < 6) {
        return res.status(400).json({ error: 'Пароль минимум 6 символов' });
    }

    res.json({ success: true, message: 'Вы успешно зарегистрировались' });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порте ${PORT}`);
});