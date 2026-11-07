import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Адрес настоящего Go-бэкенда берём из окружения.
const API_TARGET = process.env.API_TARGET;
if (!API_TARGET) {
    console.error('API_TARGET is not set. Production server cannot start.');
    process.exit(1);
}

app.use('/api', createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
}));

// Статика из production-сборки Vite.
app.use(express.static(path.join(__dirname, 'dist')));

// Главная страница фронтенда
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server started on http://localhost:${PORT}`);
});
