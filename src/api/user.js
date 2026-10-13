const BASE_URL = 'http://localhost:8000';
/**
 * Регистрация нового пользователя
 * Ожидает от Go: POST /api/v1/auth/register
 *
 * @async
 * @param {string} username - Логин (тег).
 * @param {string} nickname - Имя пользователя.
 * @param {string} password - Пароль.
 * @param {string} birthdate - Дата рождения.
 * @returns {Promise<Object>} Данные созданного профиля.
 */
export async function signUpUser(username, nickname, password, birthdate) {
    // Приводим дату к формату RFC3339 ISO строки ("2005-03-14T00:00:00Z"), которую ждет Go time.Time
    const formattedDate = birthdate ? new Date(birthdate).toISOString() : '';

    const response = await fetch(`${BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_tag: username,
            name: nickname,
            password: password,
            birth_date: formattedDate
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Ошибка регистрации');
    }
    return data; // Возвращает созданную структуру User (без токена)
}

/**
 * Авторизация пользователя
 * Ожидает от Go: POST /api/v1/auth/login
 *
 * @async
 * @param {string} username - Логин.
 * @param {string} password - Пароль.
 * @returns {Promise<Object>} Токен и данные пользователя.
 */
export async function loginUser(username, password) {
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_tag: username,
            password: password
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Неверный логин или пароль');
    }
    return data; // Возвращает { token: "...", user: { user_id, name, user_tag ... } }
}

/**
 * Получение списка пинов с пагинацией
 * Ожидает от Go: POST /api/v1/v1/pins/search
 *
 * @async
 * @param {number} [limit=20] - Лимит пинов.
 * @param {Object|null} [cursor=null] - Курсор пагинации.
 * @returns {Promise<Object>} Объект с массивом пинов.
 */
export async function fetchPins(limit = 30, cursor = null) {
    const response = await fetch(
        `${BASE_URL}/api/v1/pins/search`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                limit,
                ...(cursor ? { cursor } : {}),
            }),
        },
    );

    let payload = null;

    try {
        payload = await response.json();
    } catch {
        throw new Error(`Сервер вернул невалидный JSON: HTTP ${response.status}`);
    }

    if (!response.ok) {
        throw new Error(
            payload?.error || `HTTP ${response.status}`,
        );
    }

    if (!payload || !Array.isArray(payload.pins)) {
        throw new Error('Некорректный формат ответа /api/v1/pins/search');
    }

    return payload;
}
