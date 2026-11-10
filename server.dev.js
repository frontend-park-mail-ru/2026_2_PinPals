import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { mkdir, writeFile, unlink } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Мок API использует отдельный порт: переменная PORT принадлежит frontend/server.js.
const PORT = Number(process.env.MOCK_API_PORT) || 3001;
function parseTokenTtlSeconds(value) {
    if (value == null || value === '') return 24 * 60 * 60;
    const raw = String(value).trim();
    if (/^\d+(?:\.\d+)?$/.test(raw)) return Math.max(60, Number(raw));
    const duration = raw.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/i);
    if (!duration) return 24 * 60 * 60;
    const units = { ms: 0.001, s: 1, m: 60, h: 3600, d: 86400 };
    return Math.max(60, Number(duration[1]) * units[duration[2].toLowerCase()]);
}
const TOKEN_TTL_SECONDS = parseTokenTtlSeconds(process.env.AUTH_TOKEN_TTL);
const TOKEN_TTL_MS = TOKEN_TTL_SECONDS * 1000;
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-only-change-this-secret-before-deploying';
const scryptAsync = promisify(crypto.scrypt);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 1024 * 1024;
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, 'uploads');const ALLOWED_ORIGINS = new Set(
    (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean),
);

await mkdir(UPLOAD_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// ВНИМАНИЕ: это локальный mock API, а не замена production Go backend/БД.
// Данные хранятся в памяти процесса; загруженные файлы сохраняются в ./uploads.
// Контракт и формат ответов повторяют API из документа «Взаимодействие с бэком».
// -----------------------------------------------------------------------------
const users = new Map();
const usersById = new Map();
const sessions = new Map(); // access_token -> user_id
const pins = new Map();
const desks = new Map();
const savedPins = new Map();
const likedPins = new Map();
const comments = new Map();

let nextUserId = 2;
let nextPinId = 31;
let nextDeskId = 7;
let nextCommentId = 1;

const demoUser = {
    user_id: 1,
    user_tag: 'demo',
    name: 'Diana_2007',
    password_hash: null,
    birth_date: '2000-01-01T00:00:00.000Z',
    description: 'Демонстрационный профиль',
    avatar_url: null,
    created_at: new Date().toISOString(),
    deleted_at: null,
};
demoUser.password_hash = await hashPassword('DemoPass123');
users.set(demoUser.user_tag, demoUser);
usersById.set(demoUser.user_id, demoUser);
savedPins.set(demoUser.user_id, new Set(Array.from({ length: 20 }, (_, index) => index + 1)));

// Изображения берутся с Unsplash CDN, а не генерируются цветными SVG-заглушками.
// Параметры URL фиксируют размер и формат, а оригинальный CDN URL сохраняется в пине.
const DEMO_PIN_IMAGES = [
    { url: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Цветочное настроение', description: 'Букет нежных цветов для вдохновения' },
    { url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Горный пейзаж', description: 'Просторный пейзаж на рассвете' },
    { url: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Океанские волны', description: 'Спокойствие и энергия моря' },
    { url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Золотой рассвет', description: 'Тёплый свет над зелёными холмами' },
    { url: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Путешествие', description: 'Идея для следующего приключения' },
    { url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Домик у озера', description: 'Уютный отдых среди гор' },
    { url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Зелёные холмы', description: 'Природная палитра и мягкие линии' },
    { url: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Лесная тропа', description: 'Прогулка среди высоких деревьев' },
    { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Озеро в горах', description: 'Отражения гор в чистой воде' },
    { url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Летний водопад', description: 'Яркая природная фотография' },
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Пляжный день', description: 'Песок, море и летнее настроение' },
    { url: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Лесной свет', description: 'Солнечные лучи сквозь листву' },
    { url: 'https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Тёплый вечер', description: 'Пастельные оттенки вечернего неба' },
    { url: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Зелёный интерьер', description: 'Комнатные растения и уютный декор' },
    { url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Городской стиль', description: 'Повседневный образ для прогулки' },
    { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Портрет', description: 'Портретная фотография для мудборда' },
    { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Минималистичный портрет', description: 'Естественный портрет при дневном свете' },
    { url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Летний образ', description: 'Светлый портрет на открытом воздухе' },
    { url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Модный образ', description: 'Современная идея для гардероба' },
    { url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Гардероб', description: 'Палитра одежды и аксессуаров' },
    { url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Уличная мода', description: 'Идея образа в городском стиле' },
    { url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Повседневный образ', description: 'Лёгкий образ на каждый день' },
    { url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Рабочее место художника', description: 'Краски и материалы для творчества' },
    { url: 'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Книжный уют', description: 'Книги и спокойная атмосфера' },
    { url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Идея для ужина', description: 'Аппетитная сервировка стола' },
    { url: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Полезный завтрак', description: 'Яркие ингредиенты для завтрака' },
    { url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Свежий салат', description: 'Вдохновение для домашней кухни' },
    { url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Кофейная пауза', description: 'Чашка кофе и уютное утро' },
    { url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Кофейня', description: 'Атмосфера любимой кофейни' },
    { url: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1000&q=85', width: 800, height: 1000, name: 'Пейзаж для вдохновения', description: 'Путешествие по красивым местам' },
    { url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1000&q=85', width: 1000, height: 700, name: 'Вечернее событие', description: 'Свет, музыка и праздничное настроение' },
];

function makeDemoPin(id) {
    const image = DEMO_PIN_IMAGES[(id - 1) % DEMO_PIN_IMAGES.length];
    return {
        pin_id: id,
        creator_id: demoUser.user_id,
        image_url: image.url,
        image_width: image.width,
        image_height: image.height,
        name: image.name,
        description: image.description,
        created_at: new Date(Date.now() - id * 60_000).toISOString(),
    };
}

for (let id = 1; id <= DEMO_PIN_IMAGES.length; id += 1) {
    pins.set(id, makeDemoPin(id));
}

const defaultDesks = [
    { name: 'Котики', description: 'Фотографии самых лучших существ', entry_status: 0, pin_ids: [1, 2, 3, 4] },
    { name: 'Мультики', description: 'Любимые персонажи и красивые кадры', entry_status: 1, pin_ids: [5, 6, 7, 8, 9, 10] },
    { name: 'Страх', description: 'Немного мрачного вдохновения', entry_status: 2, pin_ids: [11, 12, 13, 14] },
    { name: 'Фон на телефон', description: 'Обои и идеи для экрана', entry_status: 0, pin_ids: [15, 16] },
    { name: 'Я', description: 'То, что мне нравится', entry_status: 1, pin_ids: [17, 18, 19, 20] },
    { name: 'Логотипы', description: 'Идеи для логотипов', entry_status: 2, pin_ids: [21, 22, 23] },
];

defaultDesks.forEach((data) => {
    const id = defaultDesks.indexOf(data) + 1;
    desks.set(String(id), {
        desk_id: id,
        creator_id: demoUser.user_id,
        name: data.name,
        description: data.description,
        avatar_img_url: null,
        entry_status: data.entry_status,
        pin_ids: [...data.pin_ids],
        created_at: new Date().toISOString(),
    });
});

// -----------------------------------------------------------------------------
// Общие helpers: cookies, авторизация, CSRF, ответы и валидация.
// -----------------------------------------------------------------------------
async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derivedKey = await scryptAsync(password, salt, 64);
    return `scrypt$${salt.toString('base64url')}$${Buffer.from(derivedKey).toString('base64url')}`;
}

async function verifyPassword(password, encodedHash) {
    if (typeof encodedHash !== 'string') return false;
    const [algorithm, saltText, keyText] = encodedHash.split('$');
    if (algorithm !== 'scrypt' || !saltText || !keyText) return false;

    try {
        const salt = Buffer.from(saltText, 'base64url');
        const expectedKey = Buffer.from(keyText, 'base64url');
        if (salt.length < 16 || expectedKey.length !== 64) return false;
        const actualKey = Buffer.from(await scryptAsync(password, salt, expectedKey.length));
        return crypto.timingSafeEqual(actualKey, expectedKey);
    } catch {
        return false;
    }
}

function parseCookies(header = '') {
    const result = {};
    for (const chunk of header.split(';')) {
        const separator = chunk.indexOf('=');
        if (separator < 0) continue;
        const key = chunk.slice(0, separator).trim();
        const value = chunk.slice(separator + 1).trim();
        if (!key) continue;
        try {
            result[key] = decodeURIComponent(value);
        } catch {
            result[key] = value;
        }
    }
    return result;
}

function getRequestCredentials(req) {
    const authorization = req.get('Authorization') || '';
    if (authorization.startsWith('Bearer ')) {
        return { token: authorization.slice(7), method: 'bearer' };
    }
    const cookies = parseCookies(req.get('Cookie'));
    return { token: cookies.access_token || '', method: 'cookie', cookies };
}

function createAccessToken(user) {
    const issuedAt = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        sub: String(user.user_id),
        user_id: user.user_id,
        iat: issuedAt,
        exp: issuedAt + TOKEN_TTL_SECONDS,
        jti: crypto.randomUUID(),
    };
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsignedToken = `${encode(header)}.${encode(payload)}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(unsignedToken).digest('base64url');
    return `${unsignedToken}.${signature}`;
}

function verifyAccessToken(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
        const [encodedHeader, encodedPayload, suppliedSignature] = parts;
        const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
        if (header.alg !== 'HS256' || header.typ !== 'JWT') return null;

        const unsignedToken = `${encodedHeader}.${encodedPayload}`;
        const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
            .update(unsignedToken)
            .digest();
        const actualSignature = Buffer.from(suppliedSignature, 'base64url');
        if (actualSignature.length !== expectedSignature.length
            || !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

        const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
        const userId = validId(payload.user_id ?? payload.sub);
        const now = Math.floor(Date.now() / 1000);
        if (!userId || !Number.isInteger(payload.exp) || payload.exp <= now) return null;
        // In-memory session registry represents the revocation table in the dev mock.
        if (sessions.get(token) !== userId) return null;
        return { userId, payload };
    } catch {
        return null;
    }
}

function getRequestUser(req) {
    const { token } = getRequestCredentials(req);
    const verified = verifyAccessToken(token);
    const user = verified ? usersById.get(verified.userId) : null;
    return user && !user.deleted_at ? user : null;
}

function requireAuth(req, res, next) {
    const credentials = getRequestCredentials(req);
    const verified = verifyAccessToken(credentials.token);
    const user = verified ? usersById.get(verified.userId) : null;

    if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'Необходима авторизация.' });
    }

    req.user = user;
    req.authToken = credentials.token;
    req.authMethod = credentials.method;
    req.authCookies = credentials.cookies || {};
    return next();
}

function requireActiveUser(req, res, next) {
    if (req.user?.deleted_at) {
        return res.status(404).json({ error: 'not_found', message: 'Пользователь не найден.' });
    }
    return next();
}

function requireCsrf(req, res, next) {
    // Если в запросе присутствует access_token cookie, CSRF обязателен,
    // даже когда клиент дополнительно прислал Authorization: Bearer.
    // Для чистой Bearer-авторизации CSRF-cookie не требуется.
    const cookies = parseCookies(req.get('Cookie'));
    if (cookies.access_token || req.authMethod === 'cookie') {
        const cookieToken = cookies.csrf_token || req.authCookies?.csrf_token || '';
        const headerToken = req.get('X-CSRF-Token') || '';
        const cookieBuffer = Buffer.from(cookieToken);
        const headerBuffer = Buffer.from(headerToken);
        const matches = cookieBuffer.length > 0
            && cookieBuffer.length === headerBuffer.length
            && crypto.timingSafeEqual(cookieBuffer, headerBuffer);
        if (!matches) {
            return res.status(403).json({ error: 'csrf_failed', message: 'CSRF-токен отсутствует или не совпадает.' });
        }
    }
    return next();
}

function issueSession(req, res, user) {
    const accessToken = createAccessToken(user);
    const csrfToken = crypto.randomBytes(24).toString('base64url');
    sessions.set(accessToken, user.user_id);

    const secure = req.secure || req.get('X-Forwarded-Proto') === 'https';
    const cookieOptions = {
        path: '/',
        sameSite: 'lax',
        secure: Boolean(secure),
        maxAge: TOKEN_TTL_MS,
    };

    res.cookie('access_token', accessToken, { ...cookieOptions, httpOnly: true });
    res.cookie('csrf_token', csrfToken, { ...cookieOptions, httpOnly: false });
}

function clearSessionCookies(req, res) {
    const secure = req.secure || req.get('X-Forwarded-Proto') === 'https';
    const options = { path: '/', sameSite: 'lax', secure: Boolean(secure) };
    res.clearCookie('access_token', { ...options, httpOnly: true });
    res.clearCookie('csrf_token', { ...options, httpOnly: false });
}

function publicUser(user) {
    return {
        user_id: user.user_id,
        name: user.name,
        user_tag: user.user_tag,
        birth_date: user.birth_date,
        description: user.description ?? null,
        avatar_url: user.avatar_url ?? null,
        created_at: user.created_at,
    };
}

function validId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function getSet(map, key) {
    const normalized = String(key);
    if (!map.has(normalized)) map.set(normalized, new Set());
    return map.get(normalized);
}

function serializePin(pin) {
    return {
        pin_id: pin.pin_id,
        creator_id: pin.creator_id,
        image_url: pin.image_url,
        name: pin.name,
        description: pin.description,
        created_at: pin.created_at,
    };
}

function assetUrl(value) {
    if (value == null || value === '') return null;
    const url = String(value).trim();
    if (/^(?:https?:|data:|blob:)/i.test(url) || url.startsWith('/')) return url;
    return `/images/${encodeURIComponent(path.basename(url))}`;
}

function serializeDesk(desk, includePins = false) {
    const result = {
        desk_id: desk.desk_id,
        creator_id: desk.creator_id,
        name: desk.name,
        description: desk.description ?? null,
        avatar_img_url: assetUrl(desk.avatar_img_url),
        entry_status: desk.entry_status,
        created_at: desk.created_at,
        // Дополнительные поля для карточек текущего интерфейса.
        pins_count: desk.pin_ids.length,
        preview_images: desk.pin_ids
            .slice(0, 3)
            .map((pinId) => pins.get(Number(pinId)))
            .filter(Boolean)
            .map((pin) => pin.image_url),
    };

    if (includePins) {
        result.pins = desk.pin_ids
            .map((pinId) => pins.get(Number(pinId)))
            .filter(Boolean)
            .map(serializePin);
    }
    return result;
}

function validationError(res, fields) {
    return res.status(400).json({ error: 'validation_error', fields });
}

function getUserDesks(userId) {
    return Array.from(desks.values()).filter((desk) => desk.creator_id === Number(userId));
}

function isDeskOwner(desk, user) {
    return Boolean(desk && user && Number(desk.creator_id) === Number(user.user_id));
}

// -----------------------------------------------------------------------------
// CORS: для прямого подключения к dev API; при обычной разработке запросы идут
// через Vite proxy и браузер видит same-origin.
// -----------------------------------------------------------------------------
app.use((req, res, next) => {
    const origin = req.get('Origin');
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
});

app.use(express.json({ limit: '2mb', strict: true }));

// -----------------------------------------------------------------------------
// Auth — соответствует PR #61.
// -----------------------------------------------------------------------------
app.post('/api/v1/auth/register', async (req, res, next) => {
    const body = req.body || {};
    const { name, user_tag: userTag, birth_date: birthDate, password } = body;
    const fields = {};

    if (typeof name !== 'string' || !name.trim()) fields.name = 'required';
    else if (name.trim().length > 255) fields.name = 'max_length_255';

    if (typeof userTag !== 'string' || !userTag.trim()) fields.user_tag = 'required';
    else if (userTag.trim().length > 64) fields.user_tag = 'max_length_64';

    if (typeof birthDate !== 'string' || !birthDate.trim()) {
        fields.birth_date = 'required';
    } else {
        const date = new Date(birthDate);
        if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) {
            fields.birth_date = 'invalid_date';
        } else {
            const ageDate = new Date(date);
            const today = new Date();
            let age = today.getUTCFullYear() - ageDate.getUTCFullYear();
            const birthdayHasNotOccurred = today.getUTCMonth() < ageDate.getUTCMonth()
                || (today.getUTCMonth() === ageDate.getUTCMonth() && today.getUTCDate() < ageDate.getUTCDate());
            if (birthdayHasNotOccurred) age -= 1;
            if (age < 13) fields.birth_date = 'minimum_age_13';
        }
    }

    if (typeof password !== 'string' || password.length < 8 || !/\p{L}/u.test(password)) {
        fields.password = 'min_length_8_and_letter_required';
    }

    if (body.description != null && typeof body.description !== 'string') fields.description = 'must_be_string';
    if (body.avatar_url != null && typeof body.avatar_url !== 'string') fields.avatar_url = 'must_be_string';
    if (Object.keys(fields).length) return validationError(res, fields);

    const normalizedTag = userTag.trim();
    if (users.has(normalizedTag)) {
        return res.status(409).json({ error: 'conflict', fields: { user_tag: 'already_exists' } });
    }

    // Повторная проверка после асинхронного хеширования закрывает гонку
    // при одновременной регистрации одинакового user_tag.
    const passwordHash = await hashPassword(password);
    if (users.has(normalizedTag)) {
        return res.status(409).json({ error: 'conflict', fields: { user_tag: 'already_exists' } });
    }

    const user = {
        user_id: nextUserId++,
        name: name.trim(),
        user_tag: normalizedTag,
        birth_date: new Date(birthDate).toISOString(),
        password_hash: passwordHash,
        description: body.description ?? null,
        avatar_url: body.avatar_url ?? null,
        created_at: new Date().toISOString(),
        deleted_at: null,
    };
    users.set(user.user_tag, user);
    usersById.set(user.user_id, user);
    savedPins.set(user.user_id, new Set());
    return res.status(201).json(publicUser(user));
});

app.post('/api/v1/auth/login', async (req, res, next) => {
    const userTag = typeof req.body?.user_tag === 'string' ? req.body.user_tag.trim() : '';
    const password = req.body?.password;
    const user = users.get(userTag);

    if (!user || user.deleted_at || typeof password !== 'string' || !(await verifyPassword(password, user.password_hash))) {
        return res.status(401).json({ error: 'invalid_credentials', message: 'Неверный логин или пароль.' });
    }

    issueSession(req, res, user);
    return res.status(200).json({ user: publicUser(user) });
});

app.post('/api/v1/auth/logout', requireAuth, requireCsrf, (req, res) => {
    sessions.delete(req.authToken);
    clearSessionCookies(req, res);
    return res.status(204).end();
});

// -----------------------------------------------------------------------------
// Users / profile — соответствует PR #63.
// -----------------------------------------------------------------------------
app.get('/api/v1/users/me', requireAuth, requireActiveUser, (req, res) => {
    return res.status(200).json(publicUser(req.user));
});

app.patch('/api/v1/users/me', requireAuth, requireCsrf, requireActiveUser, async (req, res, next) => {
    try {
        const contentType = req.get('Content-Type') || '';
        const isMultipart = /^multipart\/form-data/i.test(contentType);

        let body = {};
        let avatarFile = null;

        if (isMultipart) {
            const { fields: multipartFields, files } = await readMultipart(req, MAX_MULTIPART_BYTES);
            avatarFile = files.avatar || null;

            // name и user_tag — только если реально переданы.
            if (Object.hasOwn(multipartFields, 'name')) body.name = multipartFields.name;
            if (Object.hasOwn(multipartFields, 'user_tag')) body.user_tag = multipartFields.user_tag;

            // description: пустая строка → очистка (null).
            if (Object.hasOwn(multipartFields, 'description')) {
                body.description = multipartFields.description === '' ? null : multipartFields.description;
            }

            // clear_avatar=true → очистить аватар (только без файла).
            if (multipartFields.clear_avatar === 'true') {
                if (avatarFile) {
                    return validationError(res, { avatar: 'cannot_combine_with_clear' });
                }
                body.avatar_url = null;
            }
        } else {
            body = req.body || {};
        }

        // ---- Валидация полей (как раньше) ----
        const allowedFields = ['name', 'user_tag', 'description', 'avatar_url'];
        const keys = Object.keys(body);
        const hasAvatar = Boolean(avatarFile);

        if (!keys.length && !hasAvatar) {
            return validationError(res, { body: 'empty_or_unknown_fields' });
        }
        if (keys.some((key) => !allowedFields.includes(key))) {
            return validationError(res, { body: 'empty_or_unknown_fields' });
        }

        const validationFields = {};
        if (Object.hasOwn(body, 'name')) {
            if (typeof body.name !== 'string' || !body.name.trim()) validationFields.name = 'must_not_be_empty';
            else if (body.name.trim().length > 255) validationFields.name = 'max_length_255';
        }
        if (Object.hasOwn(body, 'user_tag')) {
            if (typeof body.user_tag !== 'string' || !body.user_tag.trim()) {
                validationFields.user_tag = 'must_not_be_empty';
            } else if (body.user_tag.trim().length > 64) {
                validationFields.user_tag = 'max_length_64';
            } else {
                const candidate = users.get(body.user_tag.trim());
                if (candidate && candidate.user_id !== req.user.user_id) {
                    return res.status(409).json({ error: 'conflict', fields: { user_tag: 'already_exists' } });
                }
            }
        }
        for (const field of ['description', 'avatar_url']) {
            if (Object.hasOwn(body, field) && body[field] !== null && typeof body[field] !== 'string') {
                validationFields[field] = 'must_be_string_or_null';
            }
        }
        if (Object.keys(validationFields).length) return validationError(res, validationFields);

        // ---- Валидация и сохранение файла аватара ----
        let newAvatarUrl = null;
        if (hasAvatar) {
            if (!avatarFile.data.length) {
                return validationError(res, { avatar: 'required' });
            }
            if (avatarFile.data.length > MAX_IMAGE_BYTES) {
                return res.status(413).json({
                    error: 'payload_too_large',
                    message: 'Размер изображения не должен превышать 10 MiB.',
                });
            }
            const extension = detectImageExtension(avatarFile.data);
            if (!extension) {
                return validationError(res, { avatar: 'unsupported_image_format' });
            }
            const filename = `${crypto.randomUUID()}.${extension}`;
            await writeFile(path.join(UPLOAD_DIR, filename), avatarFile.data, { flag: 'wx' });
            newAvatarUrl = `/images/${filename}`;
        }

        // ---- Применяем изменения ----
        if (Object.hasOwn(body, 'name')) req.user.name = body.name.trim();
        if (Object.hasOwn(body, 'user_tag')) {
            const oldTag = req.user.user_tag;
            const newTag = body.user_tag.trim();
            users.delete(oldTag);
            users.set(newTag, req.user);
            req.user.user_tag = newTag;
        }
        if (Object.hasOwn(body, 'description')) req.user.description = body.description;

        // Аватар: файл имеет приоритет над clear_avatar и над avatar_url.
        if (newAvatarUrl) {
            req.user.avatar_url = newAvatarUrl;
        } else if (Object.hasOwn(body, 'avatar_url')) {
            req.user.avatar_url = body.avatar_url;
        }

        return res.status(200).json(publicUser(req.user));
    } catch (error) {
        return next(error);
    }
});

app.delete('/api/v1/users/me', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    users.delete(req.user.user_tag);   // Удаляем по никнейму
    usersById.delete(req.user.user_id); // Удаляем по ID
    return res.status(204).end();
});

// -----------------------------------------------------------------------------
// Avatar upload — multipart, отдельный эндпоинт (dev-only).
// -----------------------------------------------------------------------------
app.post('/api/v1/users/me/avatar', requireAuth, requireCsrf, requireActiveUser, async (req, res, next) => {
    try {
        const { files } = await readMultipart(req, MAX_MULTIPART_BYTES);
        const avatar = files.avatar;
        if (!avatar || !avatar.data.length) {
            return validationError(res, { avatar: 'required' });
        }
        if (avatar.data.length > MAX_IMAGE_BYTES) {
            return res.status(413).json({
                error: 'payload_too_large',
                message: 'Размер изображения не должен превышать 10 MiB.',
            });
        }
        const extension = detectImageExtension(avatar.data);
        if (!extension) {
            return validationError(res, { avatar: 'unsupported_image_format' });
        }
        const filename = `${crypto.randomUUID()}.${extension}`;
        await writeFile(path.join(UPLOAD_DIR, filename), avatar.data, { flag: 'wx' });
        req.user.avatar_url = `/images/${filename}`;
        return res.status(200).json(publicUser(req.user));
    } catch (error) {
        return next(error);
    }
});

// -----------------------------------------------------------------------------
// Pins — соответствие PR #62.
// -----------------------------------------------------------------------------
app.post('/api/v1/pins/search', (req, res) => {
    const requestedLimit = req.body?.limit == null ? 20 : Number(req.body.limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
        return validationError(res, { limit: 'must_be_integer_between_1_and_100' });
    }

    let result = Array.from(pins.values()).sort((a, b) => {
        const timeDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return timeDifference || b.pin_id - a.pin_id;
    });

    const cursor = req.body?.cursor;
    if (cursor != null) {
        const cursorId = validId(cursor.id);
        const cursorDate = typeof cursor.created_at === 'string' ? new Date(cursor.created_at) : null;
        if (!cursorId || !cursorDate || Number.isNaN(cursorDate.getTime())) {
            return validationError(res, { cursor: 'invalid_cursor' });
        }
        result = result.filter((pin) => {
            const pinTime = new Date(pin.created_at).getTime();
            const cursorTime = cursorDate.getTime();
            return pinTime < cursorTime || (pinTime === cursorTime && pin.pin_id < cursorId);
        });
    }

    const hasMore = result.length > requestedLimit;
    const page = result.slice(0, requestedLimit);
    const lastPin = page.at(-1);
    const nextCursor = hasMore && lastPin
        ? { created_at: lastPin.created_at, id: lastPin.pin_id }
        : null;

    return res.status(200).json({ pins: page.map(serializePin), next_cursor: nextCursor });
});

function readMultipart(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const contentType = req.get('Content-Type') || '';
        const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        if (!/^multipart\/form-data/i.test(contentType) || !boundaryMatch) {
            reject(Object.assign(new Error('Ожидался multipart/form-data.'), { status: 400 }));
            return;
        }

        const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
        if (!boundary || boundary.length > 200) {
            reject(Object.assign(new Error('Некорректный multipart boundary.'), { status: 400 }));
            return;
        }

        const chunks = [];
        let totalBytes = 0;
        let exceeded = false;
        req.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > maxBytes) {
                exceeded = true;
                chunks.length = 0;
                return;
            }
            if (!exceeded) chunks.push(chunk);
        });
        req.on('error', reject);
        req.on('end', () => {
            if (exceeded) {
                reject(Object.assign(new Error('Размер изображения или запроса превышает 10 MiB.'), { status: 413 }));
                return;
            }
            try {
                const buffer = Buffer.concat(chunks);
                const delimiter = Buffer.from(`--${boundary}`);
                const nextDelimiter = Buffer.from(`\r\n--${boundary}`);
                const fields = {};
                const files = {};
                let position = 0;

                while (position < buffer.length) {
                    const delimiterIndex = buffer.indexOf(delimiter, position);
                    if (delimiterIndex < 0) break;
                    position = delimiterIndex + delimiter.length;
                    if (buffer.subarray(position, position + 2).toString() === '--') break;
                    if (buffer.subarray(position, position + 2).toString() === '\r\n') position += 2;

                    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), position);
                    if (headerEnd < 0) break;
                    const headerText = buffer.subarray(position, headerEnd).toString('utf8');
                    const contentStart = headerEnd + 4;
                    const partEnd = buffer.indexOf(nextDelimiter, contentStart);
                    if (partEnd < 0) break;

                    const contentDisposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || '';
                    const name = contentDisposition.match(/(?:^|;)\s*name="([^"]+)"/i)?.[1];
                    const filename = contentDisposition.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
                    const mimeType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || 'application/octet-stream';
                    const data = buffer.subarray(contentStart, partEnd);

                    if (name) {
                        if (filename !== undefined) files[name] = { filename, mimeType, data };
                        else fields[name] = data.toString('utf8');
                    }
                    position = partEnd + 2;
                }
                resolve({ fields, files });
            } catch (error) {
                reject(Object.assign(error, { status: 400 }));
            }
        });
    });
}

function detectImageExtension(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
    if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'gif';
    if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
    return null;
}

app.post('/api/v1/pins', requireAuth, requireCsrf, requireActiveUser, async (req, res, next) => {
    try {
        const { fields, files } = await readMultipart(req, MAX_MULTIPART_BYTES);
        const name = typeof fields.name === 'string' ? fields.name.trim() : '';
        const description = typeof fields.description === 'string' ? fields.description.trim() : '';
        let tags = [];
        if (fields.tags != null && fields.tags !== '') {
            try {
                tags = JSON.parse(fields.tags);
            } catch {
                return validationError(res, { tags: 'invalid_json' });
            }
            if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
                return validationError(res, { tags: 'must_be_array_of_strings' });
            }
        }

        const image = files.image;
        if (!name) return validationError(res, { name: 'required' });
        if (!image || !image.data.length) return validationError(res, { image: 'required' });
        if (image.data.length > MAX_IMAGE_BYTES) {
            return res.status(413).json({ error: 'payload_too_large', message: 'Размер изображения не должен превышать 10 MiB.' });
        }

        const extension = detectImageExtension(image.data);
        if (!extension) {
            return validationError(res, { image: 'unsupported_image_format' });
        }

        const filename = `${crypto.randomUUID()}.${extension}`;
        await writeFile(path.join(UPLOAD_DIR, filename), image.data, { flag: 'wx' });

        const pin = {
            pin_id: nextPinId++,
            creator_id: req.user.user_id,
            image_url: `/images/${filename}`,
            name,
            description,
            tags,
            created_at: new Date().toISOString(),
        };
        pins.set(pin.pin_id, pin);
        getSet(savedPins, req.user.user_id).add(pin.pin_id);
        return res.status(201).json(serializePin(pin));
    } catch (error) {
        return next(error);
    }
});

app.get('/api/v1/pins/:pinID', (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id', message: 'Некорректный ID пина.' });
    const pin = pins.get(pinId);
    if (!pin) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    return res.status(200).json(serializePin(pin));
});

app.patch('/api/v1/pins/:pinID', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id', message: 'Некорректный ID пина.' });
    const pin = pins.get(pinId);
    if (!pin) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    if (Number(pin.creator_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'forbidden', message: 'Изменять пин может только его автор.' });
    }

    const body = req.body || {};
    const allowedFields = ['name', 'description'];
    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !allowedFields.includes(key))) {
        return validationError(res, { body: 'empty_or_unknown_fields' });
    }
    if (Object.hasOwn(body, 'name') && typeof body.name !== 'string') {
        return validationError(res, { name: 'must_be_string' });
    }
    if (Object.hasOwn(body, 'description') && body.description !== null && typeof body.description !== 'string') {
        return validationError(res, { description: 'must_be_string_or_null' });
    }

    if (Object.hasOwn(body, 'name')) {
        const name = body.name.trim();
        if (!name) return validationError(res, { name: 'required' });
        pin.name = name;
    }
    if (Object.hasOwn(body, 'description')) {
        pin.description = body.description === null ? '' : body.description.trim();
    }
    return res.status(200).json(serializePin(pin));
});

app.delete('/api/v1/pins/:pinID', requireAuth, requireCsrf, requireActiveUser, async (req, res, next) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id', message: 'Некорректный ID пина.' });
    const pin = pins.get(pinId);
    if (!pin) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    if (Number(pin.creator_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'forbidden', message: 'Удалять пин может только его автор.' });
    }

    pins.delete(pinId);
    for (const desk of desks.values()) desk.pin_ids = desk.pin_ids.filter((id) => Number(id) !== pinId);
    for (const userPins of savedPins.values()) userPins.delete(pinId);
    likedPins.delete(pinId);
    comments.delete(pinId);

    // Загруженный пользователем файл больше не нужен. Удаляем его только
    // внутри UPLOAD_DIR; внешние Unsplash URL и прочие пути не затрагиваем.
    const uploadedFilename = typeof pin.image_url === 'string'
        ? path.basename(pin.image_url)
        : '';
    if (/^[a-f0-9-]+\.(?:jpg|png|gif|webp)$/i.test(uploadedFilename)) {
        try {
            await unlink(path.join(UPLOAD_DIR, uploadedFilename));
        } catch (error) {
            if (error.code !== 'ENOENT') return next(error);
        }
    }
    return res.status(204).end();
});

app.get('/api/v1/pins/:pinID/likes', (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    const user = getRequestUser(req);
    const likes = getSet(likedPins, pinId);
    return res.status(200).json({
        likes_count: likes.size,
        liked_by_me: user ? likes.has(user.user_id) : false,
    });
});

app.post('/api/v1/pins/:pinID/like', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    const likes = getSet(likedPins, pinId);
    likes.add(req.user.user_id);
    return res.status(200).json({ likes_count: likes.size, liked_by_me: true });
});

app.delete('/api/v1/pins/:pinID/like', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    const likes = getSet(likedPins, pinId);
    likes.delete(req.user.user_id);
    return res.status(200).json({ likes_count: likes.size, liked_by_me: false });
});

// Не входит в спецификацию v1: dev-only API сохранений, нужен текущему экрану профиля.
app.get('/api/v1/users/:userID/saved-pins', requireAuth, requireActiveUser, (req, res) => {
    const targetUserId = validId(req.params.userID);
    if (!targetUserId) return res.status(400).json({ error: 'invalid_id' });
    if (targetUserId !== req.user.user_id) return res.status(403).json({ error: 'forbidden' });
    const userPins = Array.from(getSet(savedPins, targetUserId))
        .map((pinId) => pins.get(Number(pinId)))
        .filter(Boolean)
        .map(serializePin);
    return res.status(200).json({ pins: userPins });
});

// Не входит в спецификацию v1: dev-only endpoint комментариев для текущего UI.
app.get('/api/v1/pins/:pinID/comments', (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found' });
    return res.status(200).json({ comments: comments.get(pinId) || [] });
});

app.post('/api/v1/pins/:pinID/comments', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const pinId = validId(req.params.pinID);
    if (!pinId) return res.status(400).json({ error: 'invalid_id' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found' });
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) return validationError(res, { text: 'required' });
    const comment = {
        comment_id: nextCommentId++,
        author: req.user.name || req.user.user_tag,
        text,
        created_at: new Date().toISOString(),
    };
    const list = comments.get(pinId) || [];
    list.push(comment);
    comments.set(pinId, list);
    return res.status(201).json({ comment });
});

// -----------------------------------------------------------------------------
// Desks — соответствует PR #62.
// -----------------------------------------------------------------------------
app.get('/api/v1/users/:userID/desks', (req, res) => {
    const userId = validId(req.params.userID);
    if (!userId) return res.status(400).json({ error: 'invalid_id' });
    const result = getUserDesks(userId)
        .filter((desk) => desk.entry_status === 0)
        .slice(0, 100)
        .map((desk) => serializeDesk(desk));
    return res.status(200).json({ desks: result });
});

app.get('/api/v1/desks/me', requireAuth, requireActiveUser, (req, res) => {
    return res.status(200).json({ desks: getUserDesks(req.user.user_id).map((desk) => serializeDesk(desk)) });
});

app.post('/api/v1/desks', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const body = req.body || {};
    if (Object.hasOwn(body, 'name') && body.name !== null && typeof body.name !== 'string') {
        return validationError(res, { name: 'must_be_string_or_null' });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (body.description != null && typeof body.description !== 'string') return validationError(res, { description: 'must_be_string_or_null' });
    const entryStatus = body.entry_status == null ? 0 : Number(body.entry_status);
    if (![0, 1, 2].includes(entryStatus)) return validationError(res, { entry_status: 'must_be_0_1_or_2' });
    if (body.avatar_img_url != null && typeof body.avatar_img_url !== 'string') return validationError(res, { avatar_img_url: 'must_be_string_or_null' });

    const desk = {
        desk_id: nextDeskId++,
        creator_id: req.user.user_id,
        name: name || 'Untitled desk',
        description: body.description ?? null,
        avatar_img_url: body.avatar_img_url ?? null,
        entry_status: entryStatus,
        pin_ids: [],
        created_at: new Date().toISOString(),
    };
    desks.set(String(desk.desk_id), desk);
    return res.status(201).json(serializeDesk(desk));
});

app.get('/api/v1/desks/:deskID', (req, res) => {
    const deskId = validId(req.params.deskID);
    if (!deskId) return res.status(400).json({ error: 'invalid_id' });
    const desk = desks.get(String(deskId));
    if (!desk) return res.status(404).json({ error: 'not_found', message: 'Доска не найдена.' });

    const user = getRequestUser(req);
    if (desk.entry_status !== 0 && !isDeskOwner(desk, user)) {
        return res.status(403).json({ error: 'forbidden', message: 'Доступ к доске запрещён.' });
    }
    return res.status(200).json(serializeDesk(desk, true));
});

app.patch('/api/v1/desks/:deskID', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const deskId = validId(req.params.deskID);
    if (!deskId) return res.status(400).json({ error: 'invalid_id' });
    const desk = desks.get(String(deskId));
    if (!desk) return res.status(404).json({ error: 'not_found', message: 'Доска не найдена.' });
    if (!isDeskOwner(desk, req.user)) return res.status(403).json({ error: 'forbidden', message: 'Вы не владелец доски.' });

    const body = req.body || {};
    const fieldsAllowed = ['name', 'description', 'entry_status', 'avatar_img_url'];
    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !fieldsAllowed.includes(key))) {
        return validationError(res, { body: 'empty_or_unknown_fields' });
    }

    if (Object.hasOwn(body, 'name') && body.name !== null && typeof body.name !== 'string') {
        return validationError(res, { name: 'must_be_string_or_null' });
    }
    if (Object.hasOwn(body, 'description') && body.description !== null && typeof body.description !== 'string') {
        return validationError(res, { description: 'must_be_string_or_null' });
    }
    if (Object.hasOwn(body, 'avatar_img_url') && body.avatar_img_url !== null && typeof body.avatar_img_url !== 'string') {
        return validationError(res, { avatar_img_url: 'must_be_string_or_null' });
    }
    if (Object.hasOwn(body, 'entry_status') && ![0, 1, 2].includes(Number(body.entry_status))) {
        return validationError(res, { entry_status: 'must_be_0_1_or_2' });
    }

    if (Object.hasOwn(body, 'name')) desk.name = body.name === null || !body.name.trim() ? 'Untitled desk' : body.name.trim();
    if (Object.hasOwn(body, 'description')) desk.description = body.description;
    if (Object.hasOwn(body, 'avatar_img_url')) desk.avatar_img_url = body.avatar_img_url;
    if (Object.hasOwn(body, 'entry_status')) desk.entry_status = Number(body.entry_status);

    return res.status(200).json(serializeDesk(desk));
});

app.delete('/api/v1/desks/:deskID', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const deskId = validId(req.params.deskID);
    if (!deskId) return res.status(400).json({ error: 'invalid_id' });
    const desk = desks.get(String(deskId));
    if (!desk) return res.status(404).json({ error: 'not_found', message: 'Доска не найдена.' });
    if (!isDeskOwner(desk, req.user)) return res.status(403).json({ error: 'forbidden', message: 'Вы не владелец доски.' });
    desks.delete(String(deskId));
    return res.status(204).end();
});

app.post('/api/v1/desks/:deskID/pins/:pinID', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const deskId = validId(req.params.deskID);
    const pinId = validId(req.params.pinID);
    if (!deskId || !pinId) return res.status(400).json({ error: 'invalid_id' });
    const desk = desks.get(String(deskId));
    if (!desk) return res.status(404).json({ error: 'not_found', message: 'Доска не найдена.' });
    if (!isDeskOwner(desk, req.user)) return res.status(403).json({ error: 'forbidden', message: 'Вы не владелец доски.' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    if (!desk.pin_ids.includes(pinId)) desk.pin_ids.push(pinId);
    return res.status(204).end();
});

app.delete('/api/v1/desks/:deskID/pins/:pinID', requireAuth, requireCsrf, requireActiveUser, (req, res) => {
    const deskId = validId(req.params.deskID);
    const pinId = validId(req.params.pinID);
    if (!deskId || !pinId) return res.status(400).json({ error: 'invalid_id' });
    const desk = desks.get(String(deskId));
    if (!desk) return res.status(404).json({ error: 'not_found', message: 'Доска не найдена.' });
    if (!isDeskOwner(desk, req.user)) return res.status(403).json({ error: 'forbidden', message: 'Вы не владелец доски.' });
    if (!pins.has(pinId)) return res.status(404).json({ error: 'not_found', message: 'Пин не найден.' });
    desk.pin_ids = desk.pin_ids.filter((id) => id !== pinId);
    return res.status(204).end();
});

// -----------------------------------------------------------------------------
// Dev-only image URLs and static uploaded files.
// -----------------------------------------------------------------------------
function demoSvg(id) {
    const hue = (Number(id) * 37) % 360;
    const hue2 = (hue + 75) % 360;
    const label = `IDEA ${Number(id)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue},62%,78%)"/><stop offset="1" stop-color="hsl(${hue2},55%,45%)"/></linearGradient><filter id="s"><feGaussianBlur stdDeviation="24"/></filter></defs>
<rect width="640" height="800" fill="url(#g)"/><circle cx="480" cy="180" r="150" fill="#fff" opacity=".22" filter="url(#s)"/><circle cx="130" cy="600" r="190" fill="#fff" opacity=".2"/>
<path d="M0 610 Q160 500 300 620 T640 600 V800 H0Z" fill="#fff" opacity=".2"/><rect x="70" y="80" width="500" height="640" rx="42" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>
<text x="320" y="390" text-anchor="middle" font-family="Arial,sans-serif" font-size="56" font-weight="700" fill="#fff">${label}</text><text x="320" y="445" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#fff" opacity=".9">LOCAL DEV PREVIEW</text></svg>`;
}

app.get('/images/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const demoMatch = filename.match(/^demo-pin-(\d+)\.svg$/);
    if (demoMatch) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.type('image/svg+xml').send(demoSvg(Number(demoMatch[1])));
        return;
    }

    if (filename !== req.params.filename || !/^[a-f0-9-]+\.(?:jpg|png|gif|webp)$/i.test(filename)) {
        return res.status(404).json({ error: 'not_found', message: 'Изображение не найдено.' });
    }
    return res.sendFile(path.join(UPLOAD_DIR, filename), (error) => {
        if (error && !res.headersSent) {
            if (error.statusCode === 404) res.status(404).json({ error: 'not_found', message: 'Изображение не найдено.' });
            else next(error);
        }
    });
});

// -----------------------------------------------------------------------------
// Ошибки и запуск.
// -----------------------------------------------------------------------------
app.use('/api', (req, res) => {
    return res.status(404).json({ error: 'not_found', message: 'API endpoint не найден.' });
});

app.use((error, req, res, _next) => {
    if (res.headersSent) return;
    const status = Number(error.status || error.statusCode) || 500;
    if (status === 413) {
        return res.status(413).json({ error: 'payload_too_large', message: 'Размер запроса превышает допустимый лимит.' });
    }
    if (status === 400) {
        return res.status(400).json({ error: 'bad_request', message: error.message || 'Некорректный запрос.' });
    }
    console.error('[dev api] request failed:', error);
    return res.status(500).json({ error: 'internal_server_error', message: 'Внутренняя ошибка dev API.' });
});

app.listen(PORT, () => {
    console.log(`[dev api] Mock API: http://localhost:${PORT}`);
    console.log('[dev api] Demo account: demo / DemoPass123');
    console.log(`[dev api] Uploaded images: ${UPLOAD_DIR}`);
});
