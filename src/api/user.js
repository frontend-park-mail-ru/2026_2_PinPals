const BASE_URL = '';
/**
 * Регистрация нового пользователя
 * Ожидает от Go: POST /api/v1/auth/register
 */
export async function signUpUser(username, nickname, password, birthdate) {
    // Приводим дату к формату RFC3339 ISO строки ("2005-03-14T00:00:00Z"), которую ждет Go time.Time
    const formattedDate = birthdate ? new Date(birthdate).toISOString() : "";

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
 */
export async function fetchPins(limit = 20, cursor = null) {
    const response = await fetch(`${BASE_URL}/api/v1/pins/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            limit: limit,
            cursor: cursor
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Не удалось загрузить ленту');
    }
    return data; // Возвращает { pins: [...], next_cursor: {...} }
}