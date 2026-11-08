const BASE_URL = location.origin;


/**
 * Приводит URL изображений backend к same-origin маршруту.
 * Go API часто возвращает http://localhost:8002/images/..., но во frontend
 * используется proxy /images -> API_TARGET. Пропускаем внешние URL без изменений.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function resolveImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const raw = value.trim();

    if (/^(?:data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/images/')) return raw;

    try {
        const parsed = new URL(raw, location.origin);
        if (parsed.pathname.startsWith('/images/')) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        if (parsed.origin === location.origin) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
        return raw;
    } catch {
        return raw;
    }
}

function getCsrfToken() {
    const matches = document.cookie.match(new RegExp(
        '(?:^|; )' + 'csrf_token'.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'
    ));
    return matches ? decodeURIComponent(matches[1]) : '';
}

async function apiRequest(path, options = {}) {
    const headers = {
        Accept: 'application/json',
        ...options.headers,
    };

    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (['POST', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase())) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers['X-CSRF-Token'] = csrfToken;
        }
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers,
    });

    if (response.status === 204) {
        return null;
    }

    // FIX: читаем тело как текст, чтобы не падать на пустых/HTML-ответах
    // (например, 404 от Go-роутера без JSON). Статус всегда сохраняем в error.
    const rawText = await response.text();
    let payload = null;
    if (rawText) {
        try {
            payload = JSON.parse(rawText);
        } catch {
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`);
                error.status = response.status;
                throw error;
            }
            const error = new Error(`Сервер вернул невалидный JSON: HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
    }

    if (!response.ok) {
        const fieldErrors = payload?.fields
            ? Object.entries(payload.fields).map(([field, code]) => `${field}: ${code}`).join(', ')
            : '';
        const message = fieldErrors
            || payload?.message
            || payload?.error
            || `Ошибка запроса: HTTP ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.fields = payload?.fields;
        error.payload = payload;
        throw error;
    }

    return payload;
}

// ===== Auth =====

export async function signUpUser(username, nickname, password, birthdate) {
    // Preserve the date selected in the browser; parsing it as local midnight and
    // converting it to UTC can shift the calendar day in positive time zones.
    const formattedDate = birthdate
        ? (birthdate.includes('T') ? birthdate : `${birthdate}T00:00:00.000Z`)
        : '';
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

export async function loginUser(username, password) {
    return apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ user_tag: username, password }),
    });
}

export async function logoutUser() {
    return apiRequest('/api/v1/auth/logout', {
        method: 'POST',
    });
}

// ===== Pins =====

export async function fetchPins(limit = 20, cursor = null) {
    return apiRequest('/api/v1/pins/search', {
        method: 'POST',
        body: JSON.stringify({ limit, cursor }),
    });
}

export async function fetchPinById(pinId) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}`);
}

export async function createPin({ name, description, tags = [], fileObject }) {
    if (typeof File === 'undefined' || !(fileObject instanceof File)) {
        throw new TypeError('Для создания пина необходимо выбрать файл изображения.');
    }

    const normalizedTags = tags ?? [];
    if (!Array.isArray(normalizedTags) || normalizedTags.some((tag) => typeof tag !== 'string')) {
        throw new TypeError('Теги должны быть массивом строк.');
    }

    const formData = new FormData();
    formData.append('name', name);
    if (description) formData.append('description', description);
    if (normalizedTags.length) formData.append('tags', JSON.stringify(normalizedTags));
    formData.append('image', fileObject);

    return apiRequest('/api/v1/pins', {
        method: 'POST',
        body: formData,
    });
}

// ===== Likes =====

export async function setPinLiked(pinId, liked) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/like`, {
        method: liked ? 'POST' : 'DELETE',
    });
}

export async function fetchPinLikesStatistics(pinId) {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/likes`);
}

// ===== Profile =====

export async function fetchMyProfile() {
    return apiRequest('/api/v1/users/me');
}

export async function updateMyProfile(patch) {
    return apiRequest('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function deleteMyProfile() {
    return apiRequest('/api/v1/users/me', {
        method: 'DELETE',
    });
}

// ===== Boards / Desks =====

export async function fetchMyDesks() {
    const result = await apiRequest('/api/v1/desks/me');
    return result.desks || [];
}

export async function fetchUserPublicDesks(userId) {
    const result = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/desks`);
    return result.desks || [];
}

// Сохранено имя fetchUserBoards для совместимости с импортами
export const fetchUserBoards = fetchUserPublicDesks;

export async function fetchBoardById(deskId) {
    return apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}`);
}

export async function createBoard(board) {
    return apiRequest('/api/v1/desks', {
        method: 'POST',
        body: JSON.stringify({
            name: board.title,
            description: board.description || '',
            entry_status: board.visibility === 'private' ? 2 : (['subscribers', 'friends'].includes(board.visibility) ? 1 : 0),
            ...(board.avatar_img_url !== undefined ? { avatar_img_url: board.avatar_img_url } : {}),
        }),
    });
}

export async function updateBoard(deskId, patch) {
    return apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function deleteBoard(deskId) {
    await apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}`, {
        method: 'DELETE',
    });
}

export async function addPinsToBoard(deskId, pinIds) {
    const promises = pinIds.map((pinId) =>
        apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}/pins/${encodeURIComponent(pinId)}`, {
            method: 'POST',
        })
    );
    await Promise.all(promises);
}

export async function removePinFromBoard(deskId, pinId) {
    await apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}/pins/${encodeURIComponent(pinId)}`, {
        method: 'DELETE',
    });
}

// ===== Saved pins (эндпоинт отсутствует в спецификации v1) =====
// Используется вкладкой «Пины» в профиле и модалками выбора пинов.
// TODO: согласовать с бэкендом, пока gracefully возвращаем пустой список.

export async function fetchUserSavedPins(userId) {
    try {
        const result = await apiRequest(`/api/v1/users/${encodeURIComponent(userId)}/saved-pins`);
        return result.pins || [];
    } catch (error) {
        if (error.status === 404) return [];
        throw error;
    }
}

// ===== Comments (эндпоинт отсутствует в спецификации v1) =====

export async function fetchPinComments(pinId) {
    try {
        const result = await apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/comments`);
        return result.comments || [];
    } catch (error) {
        if (error.status === 404) return [];
        throw error;
    }
}

export async function createPinComment(pinId, text) {
    const result = await apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
    return result.comment;
}