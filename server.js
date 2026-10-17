const express = require('express');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = 3000;

// Настройка прокси
app.use('/api', createProxyMiddleware({
    target: 'http://161.104.105.76:8000',
    changeOrigin: true
}));

// app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Главная страница фронтенда
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порте ${PORT}`);
});
