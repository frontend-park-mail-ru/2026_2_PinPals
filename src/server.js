const express = require('express');
const path = require('path');
const Handlebars = require('handlebars');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

// require('../templates.js');

app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/src', express.static(path.join(__dirname, '../src')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'))
});

function renderLogin(res, error) {
    // const template = Handlebars.templates['login.hbs'];
    const filePath = path.join(__dirname, '../views/login.hbs');
    const source = fs.readFileSync(filePath, 'utf-8');
    const template = Handlebars.compile(source);
    const html = template({ error: error || null });
    res.send(html);
}

app.get('/login', (req, res) => {
    renderLogin(res, null);
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || username.trim() === '') {
        return renderLogin(res, 'Введите логин');
    }
    if (!password || password.trim() === '') {
        return renderLogin(res, 'Введите пароль');
    }

    if (username !== 'admin' || password !== '12345') {
        return renderLogin(res, 'Неверный логин или пароль');
    }

    res.send('Добро пожаловать, ' + username + '!');
});


app.listen(PORT, () => {
    console.log(`Сервер запущен по порте ${PORT}`);
});
