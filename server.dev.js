import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Mock API принимает сжатые изображения в Data URL.
app.use(express.json({ limit: '20mb' }));

// -----------------------------------------------------------------------------
// Упрощённая серверная база данных.
// В браузере данные досок, пинов, сохранений, лайков и комментариев не хранятся.
// При подключении настоящей БД эти Map заменяются запросами к ней.
// -----------------------------------------------------------------------------
const users = new Map();
const usersById = new Map();
const tokens = new Map();
const pins = new Map();
const boards = new Map();
const savedPins = new Map();
const likedPins = new Map();
const comments = new Map();

let nextUserId = 2;
let nextPinId = 101;
let nextBoardId = 7;
let nextCommentId = 1;

// Демонстрационная учётная запись для локальной проверки интерфейса.
const demoUser = {
    user_id: 1,
    user_tag: 'demo',
    name: 'Diana_2007',
    password: 'demo',
    birth_date: '',
    avatar_url: null,
};
users.set(demoUser.user_tag, demoUser);
usersById.set(demoUser.user_id, demoUser);

/** Создаёт демонстрационный пин. */
function makeMockPin(id) {
    return {
        pin_id: id,
        creator_id: 1,
        name: `Pin ${id}`,
        description: `Описание пина ${id}`,
        tags: [],
        image_url: `https://picsum.photos/seed/${id}/400/${400 + (id % 5) * 100}`,
        created_at: new Date(Date.now() - id * 60_000).toISOString(),
    };
}

for (let id = 1; id <= 30; id += 1) {
    pins.set(id, makeMockPin(id));
}

const defaultBoards = [
    { id: 'cats', title: 'Котики', description: 'Тут лежат фотографии и картинки с самыми лучшими существами', visibility: 'public', pin_ids: [1, 2, 3, 4] },
    { id: 'cartoons', title: 'Мультики', description: 'Любимые персонажи и красивые кадры из мультфильмов', visibility: 'friends', pin_ids: [5, 6, 7, 8, 9, 10] },
    { id: 'fear', title: 'Страх', description: 'Немного мрачного вдохновения', visibility: 'private', pin_ids: [11, 12, 13, 14] },
    { id: 'phone-wallpapers', title: 'Фон на телефон', description: 'Обои и идеи для экрана телефона', visibility: 'public', pin_ids: [15, 16] },
    { id: 'me', title: 'Я', description: 'То, что мне нравится', visibility: 'friends', pin_ids: [17, 18, 19, 20] },
    { id: 'logos', title: 'Еще логотипы', description: 'Идеи для логотипов и персонажей', visibility: 'private', pin_ids: [21, 22, 23] },
];

defaultBoards.forEach((board) => {
    boards.set(String(board.id), { ...board, owner_id: 1 });
});
savedPins.set(1, new Set(Array.from({ length: 20 }, (_, index) => index + 1)));

/** Возвращает текущего пользователя по bearer-токену. */
function getRequestUser(req) {
    const authorization = req.headers.authorization || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const userId = tokens.get(token);
    return userId ? usersById.get(userId) || null : null;
}

/** Middleware для API, требующего авторизации. */
function requireAuth(req, res, next) {
    const user = getRequestUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Необходима авторизация' });
    }
    req.user = user;
    return next();
}

/** Возвращает публичные данные пользователя. */
function publicUser(user) {
    return {
        user_id: user.user_id,
        user_tag: user.user_tag,
        name: user.name,
        avatar_url: user.avatar_url || null,
    };
}

/** Возвращает данные пина без внутренних структур. */
function serializePin(pin) {
    return { ...pin };
}

/** Возвращает доску с превью для карточки. */
function serializeBoard(board) {
    const boardPins = (board.pin_ids || [])
        .map((pinId) => pins.get(Number(pinId)))
        .filter(Boolean);

    return {
        board_id: board.id,
        id: board.id,
        owner_id: board.owner_id,
        title: board.title,
        description: board.description || '',
        visibility: board.visibility,
        pins_count: boardPins.length,
        preview_images: boardPins.slice(0, 3).map((pin) => pin.image_url),
    };
}

function getPinLikeSet(pinId) {
    if (!likedPins.has(String(pinId))) likedPins.set(String(pinId), new Set());
    return likedPins.get(String(pinId));
}

function getPinComments(pinId) {
    if (!comments.has(String(pinId))) comments.set(String(pinId), []);
    return comments.get(String(pinId));
}

function getUserSavedSet(userId) {
    if (!savedPins.has(Number(userId))) savedPins.set(Number(userId), new Set());
    return savedPins.get(Number(userId));
}

// -----------------------------------------------------------------------------
// Авторизация
// -----------------------------------------------------------------------------
app.post('/api/v1/auth/register', (req, res) => {
    const { user_tag, name, password, birth_date } = req.body || {};
    if (!user_tag || !password) {
        return res.status(400).json({
            error: 'validation_error',
            fields: { user_tag: 'required', password: 'required' },
        });
    }
    if (users.has(user_tag)) {
        return res.status(409).json({ error: 'Пользователь уже существует' });
    }

    const user = {
        user_id: nextUserId++,
        user_tag,
        name: name || user_tag,
        password,
        birth_date: birth_date || '',
        avatar_url: null,
    };
    users.set(user_tag, user);
    usersById.set(user.user_id, user);
    savedPins.set(user.user_id, new Set());
    return res.status(201).json(publicUser(user));
});

app.post('/api/v1/auth/login', (req, res) => {
    const { user_tag, password } = req.body || {};
    const user = users.get(user_tag);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = `mock-${user.user_id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    tokens.set(token, user.user_id);
    return res.json({ token, user: publicUser(user) });
});

// -----------------------------------------------------------------------------
// Пины
// -----------------------------------------------------------------------------
app.post('/api/v1/pins/search', (req, res) => {
    const requestedLimit = Number(req.body?.limit ?? 30);
    const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 100)
        : 30;
    const result = Array.from(pins.values())
        .sort((a, b) => Number(b.pin_id) - Number(a.pin_id))
        .slice(0, limit)
        .map(serializePin);
    return res.json({ pins: result, next_cursor: null });
});

app.post('/api/v1/pins', requireAuth, (req, res) => {
    const { name, description = '', tags = [], image_data, board_id = null } = req.body || {};
    if (!name?.trim() || !image_data || !/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(image_data)) {
        return res.status(400).json({ error: 'Укажите название пина и изображение.' });
    }

    let board = null;
    if (board_id) {
        board = boards.get(String(board_id));
        if (!board) return res.status(404).json({ error: 'Доска не найдена' });
        if (String(board.owner_id) !== String(req.user.user_id)) {
            return res.status(403).json({ error: 'Можно добавлять пины только в свои доски' });
        }
    }

    const pin = {
        pin_id: nextPinId++,
        creator_id: req.user.user_id,
        name: name.trim(),
        description: String(description).trim(),
        tags: Array.isArray(tags) ? tags : [],
        image_url: image_data,
        created_at: new Date().toISOString(),
    };
    pins.set(pin.pin_id, pin);
    getUserSavedSet(req.user.user_id).add(pin.pin_id);
    if (board) board.pin_ids.push(pin.pin_id);

    return res.status(201).json({ pin: serializePin(pin) });
});

app.get('/api/v1/pins/:pinID', (req, res) => {
    const pin = pins.get(Number(req.params.pinID));
    if (!pin) return res.status(404).json({ error: 'Пин не найден' });
    return res.json(serializePin(pin));
});

app.get('/api/v1/pins/:pinID/interactions', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    return res.json({
        is_saved: getUserSavedSet(req.user.user_id).has(pinId),
        is_liked: getPinLikeSet(pinId).has(req.user.user_id),
        likes_count: getPinLikeSet(pinId).size,
    });
});

app.put('/api/v1/pins/:pinID/save', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    getUserSavedSet(req.user.user_id).add(pinId);
    return res.json({ is_saved: true });
});

app.delete('/api/v1/pins/:pinID/save', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    getUserSavedSet(req.user.user_id).delete(pinId);
    return res.json({ is_saved: false });
});

app.put('/api/v1/pins/:pinID/like', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    const likes = getPinLikeSet(pinId);
    likes.add(req.user.user_id);
    return res.json({ is_liked: true, likes_count: likes.size });
});

app.delete('/api/v1/pins/:pinID/like', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    const likes = getPinLikeSet(pinId);
    likes.delete(req.user.user_id);
    return res.json({ is_liked: false, likes_count: likes.size });
});

app.get('/api/v1/pins/:pinID/comments', (req, res) => {
    const pinId = Number(req.params.pinID);
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    return res.json({ comments: getPinComments(pinId) });
});

app.post('/api/v1/pins/:pinID/comments', requireAuth, (req, res) => {
    const pinId = Number(req.params.pinID);
    const text = String(req.body?.text || '').trim();
    if (!pins.has(pinId)) return res.status(404).json({ error: 'Пин не найден' });
    if (!text) return res.status(400).json({ error: 'Комментарий не может быть пустым' });

    const comment = {
        comment_id: nextCommentId++,
        author: req.user.name || req.user.user_tag,
        text,
        created_at: new Date().toISOString(),
    };
    getPinComments(pinId).push(comment);
    return res.status(201).json({ comment });
});

// -----------------------------------------------------------------------------
// Доски
// -----------------------------------------------------------------------------
app.get('/api/v1/users/:userID/boards', requireAuth, (req, res) => {
    if (String(req.user.user_id) !== String(req.params.userID)) {
        return res.status(403).json({ error: 'Нет доступа к списку досок пользователя' });
    }
    const result = Array.from(boards.values())
        .filter((board) => String(board.owner_id) === String(req.params.userID))
        .map(serializeBoard);
    return res.json({ boards: result });
});

app.get('/api/v1/users/:userID/saved-pins', requireAuth, (req, res) => {
    if (String(req.user.user_id) !== String(req.params.userID)) {
        return res.status(403).json({ error: 'Нет доступа к сохранённым пинам пользователя' });
    }
    const result = Array.from(getUserSavedSet(req.user.user_id))
        .map((pinId) => pins.get(Number(pinId)))
        .filter(Boolean)
        .map(serializePin);
    return res.json({ pins: result });
});

app.post('/api/v1/boards', requireAuth, (req, res) => {
    const { title, description = '', visibility = 'public' } = req.body || {};
    const allowedVisibility = ['public', 'friends', 'private'];
    if (!title?.trim()) return res.status(400).json({ error: 'Введите название доски' });
    if (!allowedVisibility.includes(visibility)) {
        return res.status(400).json({ error: 'Некорректный тип доступа к доске' });
    }

    const id = String(nextBoardId++);
    const board = {
        id,
        owner_id: req.user.user_id,
        title: title.trim(),
        description: String(description).trim(),
        visibility,
        pin_ids: [],
    };
    boards.set(id, board);
    return res.status(201).json({ board: serializeBoard(board) });
});

app.post('/api/v1/boards/:boardID/pins', requireAuth, (req, res) => {
    const board = boards.get(String(req.params.boardID));
    if (!board) return res.status(404).json({ error: 'Доска не найдена' });
    if (String(board.owner_id) !== String(req.user.user_id)) {
        return res.status(403).json({ error: 'Добавлять пины может только владелец доски' });
    }
    const pinIds = Array.isArray(req.body?.pin_ids) ? req.body.pin_ids.map(Number) : [];
    if (pinIds.some((id) => !Number.isInteger(id) || !pins.has(id))) {
        return res.status(400).json({ error: 'Список содержит неизвестные пины' });
    }
    const uniqueIds = new Set([...(board.pin_ids || []).map(Number), ...pinIds]);
    board.pin_ids = [...uniqueIds];
    return res.json({ board: serializeBoard(board) });
});

app.get('/api/v1/boards/:boardID', (req, res) => {
    const board = boards.get(String(req.params.boardID));
    if (!board) return res.status(404).json({ error: 'Доска не найдена' });

    const user = getRequestUser(req);
    const isOwner = user && String(board.owner_id) === String(user.user_id);
    // В mock backend список друзей пока не реализован, поэтому доски «для друзей»
    // доступны только владельцу. Это правило легко заменить проверкой friend list.
    if (board.visibility === 'private' && !isOwner) {
        return res.status(403).json({ error: 'Эта доска приватная' });
    }
    if (board.visibility === 'friends' && !isOwner) {
        return res.status(403).json({ error: 'Эта доска доступна только друзьям' });
    }

    const boardPins = (board.pin_ids || [])
        .map((pinId) => pins.get(Number(pinId)))
        .filter(Boolean)
        .map(serializePin);
    return res.json({ board: serializeBoard(board), pins: boardPins });
});

app.delete('/api/v1/boards/:boardID', requireAuth, (req, res) => {
    const board = boards.get(String(req.params.boardID));
    if (!board) return res.status(404).json({ error: 'Доска не найдена' });
    if (String(board.owner_id) !== String(req.user.user_id)) {
        return res.status(403).json({ error: 'Удалить доску может только её владелец' });
    }

    boards.delete(String(req.params.boardID));
    return res.status(204).end();
});

// -----------------------------------------------------------------------------
// SPA fallback. В dev-режиме интерфейс открывается через Vite, API — на PORT.
// -----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*any', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`[mock api] Server started on http://localhost:${PORT}`);
    console.log('[mock api] Demo account: demo / demo');
});
