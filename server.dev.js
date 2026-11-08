import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// МОКИ API — только для локальной разработки.

// Фейковая база пользователей в памяти.
const users = new Map();
let nextMockUserId = 1;

// Мок: регистрация.
app.post('/api/v1/auth/register', (req, res) => {
    const { user_tag, name, password, birth_date } = req.body;

    if (!user_tag || !password) {
        return res.status(400).json({
            error: 'validation_error',
            fields: { user_tag: 'required', password: 'required' },
        });
    }

    if (users.has(user_tag)) {
        return res.status(409).json({ error: 'user already exists' });
    }

    const user = { user_id: nextMockUserId++, user_tag, name: name || user_tag, birth_date };
    users.set(user_tag, { ...user, password });

    res.status(201).json(user);
});

// Мок: логин.
app.post('/api/v1/auth/login', (req, res) => {
    const { user_tag, password } = req.body;
    const stored = users.get(user_tag);

    if (!stored || stored.password !== password) {
        return res.status(401).json({ error: 'invalid credentials' });
    }

    res.json({
        token: 'fake-jwt-token-' + user_tag,
        user: {
            user_id: stored.user_id,
            user_tag: stored.user_tag,
            name: stored.name,
            avatar_url: null,
        },
    });
});

// Мок: те же поля, что возвращает PinResponse в Go-бэкенде.
function makeMockPin(id) {
    return {
        pin_id: id,
        creator_id: 1,
        name: `Pin ${id}`,
        description: `Описание пина ${id}`,
        image_url: `https://picsum.photos/seed/${id}/400/${400 + (id % 5) * 100}`,
        created_at: new Date(Date.now() - id * 60_000).toISOString(),
    };
}

// Мок: лента пинов.
app.post('/api/v1/pins/search', (req, res) => {
    const requestedLimit = Number(req.body?.limit ?? 30);
    const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 30;

    const pins = Array.from({ length: limit }, (_, i) => makeMockPin(i + 1));
    res.json({ pins, next_cursor: null });
});

// Мок: получение отдельного пина по тому же маршруту, что и Go API.
app.get('/api/v1/pins/:pinID', (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!Number.isInteger(pinId) || pinId < 1 || pinId > 100) {
        return res.status(404).json({ error: 'pin not found' });
    }

    return res.json(makeMockPin(pinId));
});

// СТАТИКА И SPA-ФОЛБЭК

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`[dev] Server started on http://localhost:${PORT}`);
});