const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware'); // Добавить
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// НАСТРОЙКА ПРОКСИ: все запросы к /api уйдут на бэкенд Go
app.use('/api', createProxyMiddleware({
    target: 'http://161.104.105.76:8000',
    changeOrigin: true,
    // Принудительно возвращаем /api в начало пути перед отправкой на Go-бэкенд
    pathRewrite: {
        '^/api': '/api'
    }
}));

// Главная страница фронтенда
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порте ${PORT}`);
});
