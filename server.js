import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = 3000;

// Настройка прокси
app.use('/api', createProxyMiddleware({
    target: 'http://161.104.105.76:8000',
    changeOrigin: true
}));

// Статика из production-сборки Vite
app.use(express.static(path.join(__dirname, 'dist')));

// Главная страница фронтенда
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порте ${PORT}`);
});
