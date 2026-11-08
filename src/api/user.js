const BASE_URL = location.origin;

/**
 * Общая функция для запросов к API.
 * Токен используется только для авторизации, а данные приложения хранятся на сервере.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
async function apiRequest(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (response.status === 204) {
        return null;
    }

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error(`Сервер вернул невалидный JSON: HTTP ${response.status}`);
    }

    if (!response.ok) {
        if (payload?.error === 'validation_error' && payload.fields) {
            const fieldsMessage = Object.entries(payload.fields)
                .map(([field, code]) => `${field}: ${code}`)
                .join(', ');
            throw new Error(fieldsMessage || 'Ошибка проверки данных');
        }
        throw new Error(payload?.error || `Ошибка запроса: HTTP ${response.status}`);
    }

    return payload;
}

/**
 * Регистрация нового пользователя.
 *
 * @param {string} username
 * @param {string} nickname
 * @param {string} password
 * @param {string} birthdate
 * @returns {Promise<Object>}
 */
export async function signUpUser(username, nickname, password, birthdate) {
    const formattedDate = birthdate ? new Date(birthdate).toISOString() : '';
    return apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            user_tag: username,
            name: nickname,
            password,
            birth_date: formattedDate,
        }),
    });
}

/**
 * Авторизация пользователя.
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<Object>}
 */
export async function loginUser(username, password) {
    return apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ user_tag: username, password }),
    });
}

/**
 * Получает список пинов с пагинацией.
 *
 * @param {number} [limit=30]
 * @param {Object|null} [cursor=null]
 * @returns {Promise<Object>}
 */
export async function fetchPins(limit = 30, cursor = null) {
    const result = await apiRequest('/api/v1/pins/search', {
        method: 'POST',
        body: JSON.stringify({ limit, ...(cursor ? { cursor } : {}) }),
    });

    if (!result || !Array.isArray(result.pins)) {
        throw new Error('Некорректный формат ответа /api/v1/pins/search');
    }
    return result;
}

/**
 * Получает один пин по ID.
 *
 * @param {number|string} pinId
 * @returns {Promise<Object>}
 */
export async function fetchPinById(pinId) {
    const normalizedId = Number(pinId);
    if (!Number.isInteger(normalizedId) || normalizedId < 1) {
        throw new Error('Некорректный ID пина');
    }

    return apiRequest(`/api/v1/pins/${encodeURIComponent(normalizedId)}`);
}

/**
 * Получает сохранённые пины пользователя с сервера.
 *
 * @param {number|string} userId
 * @returns {Promise<Object[]>}
 */
export async function fetchUserSavedPins(userId) {
    const result = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/saved-pins`);
    return result.pins || [];
}

/**
 * Получает список досок пользователя с сервера.
 *
 * @param {number|string} userId
 * @returns {Promise<Object[]>}
 */
export async function fetchUserBoards(userId) {
    const result = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/boards`);
    return result.boards || [];
}

/**
 * Получает доску и все её пины.
 *
 * @param {string|number} boardId
 * @returns {Promise<{board: Object, pins: Object[]}>}
 */
export async function fetchBoardById(boardId) {
    return apiRequest(`/api/v1/boards/${encodeURIComponent(boardId)}`);
}

/**
 * Создаёт доску на сервере.
 *
 * @param {{title: string, description?: string, visibility?: string}} board
 * @returns {Promise<Object>}
 */
export async function createBoard(board) {
    const result = await apiRequest('/api/v1/boards', {
        method: 'POST',
        body: JSON.stringify(board),
    });
    return result.board;
}

/** Добавляет сохранённые пины в доску через API.
 * @param {string|number} boardId
 * @param {(string|number)[]} pinIds
 * @returns {Promise<Object>}
 */
export async function addPinsToBoard(boardId, pinIds) {
    return apiRequest(`/api/v1/boards/${encodeURIComponent(boardId)}/pins`, {
        method: 'POST',
        body: JSON.stringify({ pin_ids: pinIds }),
    });
}

/**
 * Удаляет доску на сервере. Проверка владельца выполняется сервером.
 *
 * @param {string|number} boardId
 * @returns {Promise<void>}
 */
export async function deleteBoard(boardId) {
    await apiRequest(`/api/v1/boards/${encodeURIComponent(boardId)}`, {
        method: 'DELETE',
    });
}

/**
 * Создаёт пин на сервере и, при передаче board_id, добавляет его в доску.
 * image_data — сжатое изображение в формате Data URL для mock API.
 * Реальный backend может заменить это поле на multipart-загрузку файла.
 *
 * @param {{name: string, description?: string, tags?: string[], image_data: string, board_id?: string|null}} pin
 * @returns {Promise<Object>}
 */
export async function createPin(pin) {
    const result = await apiRequest('/api/v1/pins', {
        method: 'POST',
        body: JSON.stringify(pin),
    });
    return result.pin;
}

/**
 * Загружает состояние лайка и сохранения пина для текущего пользователя.
 *
 * @param {number|string} pinId
 * @returns {Promise<Object>}
 */
export async function fetchPinInteractions(pinId) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/interactions`);
}

/**
 * Устанавливает состояние лайка пина.
 *
 * @param {number|string} pinId
 * @param {boolean} liked
 * @returns {Promise<Object>}
 */
export async function setPinLiked(pinId, liked) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/like`, {
        method: liked ? 'PUT' : 'DELETE',
    });
}

/**
 * Устанавливает состояние сохранения пина.
 *
 * @param {number|string} pinId
 * @param {boolean} saved
 * @returns {Promise<Object>}
 */
export async function setPinSaved(pinId, saved) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/save`, {
        method: saved ? 'PUT' : 'DELETE',
    });
}

/**
 * Получает комментарии к пину.
 *
 * @param {number|string} pinId
 * @returns {Promise<Object[]>}
 */
export async function fetchPinComments(pinId) {
    const result = await apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/comments`);
    return result.comments || [];
}

/**
 * Добавляет комментарий к пину.
 *
 * @param {number|string} pinId
 * @param {string} text
 * @returns {Promise<Object>}
 */
export async function createPinComment(pinId, text) {
    const result = await apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
    return result.comment;
}
