import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { DEFAULT_BACKEND_TARGETS, resolveBackendService } from './proxy-routing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// В Docker указывайте адреса сервисов по DNS-именам из общей Docker-сети.
// При локальном запуске на хосте используются опубликованные порты 8001–8003.
const apiMode = String(process.env.API_MODE || 'backend').trim().toLowerCase();
const mockApiPort = Number(process.env.MOCK_API_PORT) || 3001;
const mockApiTarget = process.env.API_TARGET || `http://127.0.0.1:${mockApiPort}`;
const backendTargets = apiMode === 'mock'
    ? { auth: mockApiTarget, pin: mockApiTarget, user: mockApiTarget }
    : {
        auth: process.env.AUTH_API_TARGET || DEFAULT_BACKEND_TARGETS.auth,
        pin: process.env.PIN_API_TARGET || DEFAULT_BACKEND_TARGETS.pin,
        user: process.env.USER_API_TARGET || DEFAULT_BACKEND_TARGETS.user,
    };

const backendProxies = Object.fromEntries(
    Object.entries(backendTargets).map(([service, target]) => [service, createProxyMiddleware({
        target,
        changeOrigin: true,
        on: {
            error(error, _req, res) {
                console.error(`Proxy error (${service} -> ${target}):`, error.message);
                if (!res.headersSent) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({
                        message: `Backend service "${service}" is unavailable.`,
                    }));
                }
            },
        },
    })]),
);

// Не подключаем proxy через app.use('/api', ...): Express удаляет
// смонтированный префикс из req.url. Прокси вызывается без mount path,
// поэтому Go получает исходный /api/v1/... или /images/... URL.
app.use((req, res, next) => {
    const service = resolveBackendService(req.path);
    if (!service) return next();
    return backendProxies[service](req, res, next);
});

// Не отдаём index.html в ответ на неизвестный API/image URL.
app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/images/')) {
        return res.status(404).json({ message: 'API route not found.' });
    }
    return next();
});

// Статика из production-сборки Vite.
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback.
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Frontend server started on http://localhost:${PORT}`);
    console.log(`API mode: ${apiMode}`);
    console.log('Backend targets:', backendTargets);
});
