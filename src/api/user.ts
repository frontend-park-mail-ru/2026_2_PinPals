import type { ApiErrorPayload, Comment, Desk, LikeStatistics, Pin, PinCursor, PinSearchResponse, User } from '../types/models';

const BASE_URL = location.origin;


/**
 * Приводит URL изображений backend к same-origin маршруту.
 * используется proxy /images -> pin_service. Пропускаем внешние URL без изменений.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function resolveImageUrl(value: string | null | undefined): string {
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

export const DEFAULT_AVATAR_URL = '/img/default-avatar.svg';

/** Возвращает URL аватара или лапку по умолчанию, если аватара нет. */
export function resolveAvatarUrl(value: string | null | undefined): string {
    return resolveImageUrl(value) || DEFAULT_AVATAR_URL;
}
function getCsrfToken() {
    const matches = document.cookie.match(new RegExp(
        '(?:^|; )' + 'csrf_token'.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'
    ));
    return matches ? decodeURIComponent(matches[1]) : '';
}

async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    if (options.body && !(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    if (['POST', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || '')) {
        const csrfToken = getCsrfToken();
        if (csrfToken) {
            headers.set('X-CSRF-Token', csrfToken);
        }
    }

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers,
    });

    // Единая точка истечения сессии. Ошибки логина/регистрации не должны
    // очищать существующую авторизацию из-за неверно введённых данных.
    if (response.status === 401 && !/^\/api\/v1\/auth\/(?:login|register)/.test(path)) {
        ['isAuth', 'userName', 'userId', 'userTag', 'userAvatarUrl', 'followersCount', 'userFollowersCount']
            .forEach((key) => localStorage.removeItem(key));
        window.dispatchEvent(new Event('app:auth-expired'));
    }

    if (response.status === 204) {
        return null as T;
    }

    const rawText = await response.text();
    let payload = null;
    if (rawText) {
        try {
            payload = JSON.parse(rawText);
        } catch {
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`) as Error & { status?: number };
                error.status = response.status;
                throw error;
            }
            const error = new Error(`Сервер вернул невалидный JSON: HTTP ${response.status}`) as Error & { status?: number };
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
        const error = new Error(message) as Error & {
            status?: number;
            fields?: Record<string, string>;
            payload?: ApiErrorPayload | null;
        };
        error.status = response.status;
        error.fields = payload?.fields;
        error.payload = payload as ApiErrorPayload | null;
        throw error;
    }

    return payload as T;
}

// ===== Auth =====

export async function signUpUser(username: string, nickname: string, password: string, birthdate: string): Promise<User> {

    const formattedDate = birthdate
        ? (birthdate.includes('T') ? birthdate : `${birthdate}T00:00:00.000Z`)
        : '';
    return apiRequest<User>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            user_tag: username,
            name: nickname,
            password,
            birth_date: formattedDate,
        }),
    });
}

export async function loginUser(username: string, password: string): Promise<{ user: User }> {
    return apiRequest<{ user: User }>('/api/v1/auth/login', {
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

export async function fetchPins(limit = 20, cursor: PinCursor | null = null): Promise<PinSearchResponse> {
    return apiRequest<PinSearchResponse>('/api/v1/pins/search', {
        method: 'POST',
        body: JSON.stringify({ limit, cursor }),
    });
}

export async function fetchPinById(pinId: string | number): Promise<Pin> {
    return apiRequest<Pin>(`/api/v1/pins/${encodeURIComponent(pinId)}`);
}

export async function createPin({ name, description, tags = [], fileObject }: { name: string; description?: string; tags?: string[]; fileObject: File }): Promise<Pin & { pin?: Pin }> {
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

    return apiRequest<Pin & { pin?: Pin }>('/api/v1/pins', {
        method: 'POST',
        body: formData,
    });
}

// ===== Likes =====

export async function setPinLiked(pinId: string | number, liked: boolean): Promise<LikeStatistics> {
    return apiRequest(`/api/v1/pins/${encodeURIComponent(pinId)}/like`, {
        method: liked ? 'POST' : 'DELETE',
    });
}

export async function fetchPinLikesStatistics(pinId: string | number): Promise<LikeStatistics> {
    return apiRequest<LikeStatistics>(`/api/v1/pins/${encodeURIComponent(pinId)}/likes`);
}

// ===== Profile =====

export async function fetchMyProfile(): Promise<User> {
    return apiRequest<User>('/api/v1/users/me');
}

export async function updateMyProfile(patch: Partial<Pick<User, 'name' | 'user_tag' | 'description' | 'avatar_url'>>): Promise<User> {
    return apiRequest<User>('/api/v1/users/me', {
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

export async function fetchMyDesks(): Promise<Desk[]> {
    const result = await apiRequest<{ desks?: Desk[] }>('/api/v1/desks/me');
    return result.desks || [];
}

export async function fetchUserPublicDesks(userId: string | number): Promise<Desk[]> {
    const result = await apiRequest<{ desks?: Desk[] }>(`/api/v1/users/${encodeURIComponent(userId)}/desks`);
    return result.desks || [];
}

// Сохранено имя fetchUserBoards для совместимости с импортами
export const fetchUserBoards = fetchUserPublicDesks;

export async function fetchBoardById(deskId: string | number): Promise<Desk> {
    return apiRequest<Desk>(`/api/v1/desks/${encodeURIComponent(deskId)}`);
}

export async function createBoard(board: { title: string; description?: string; visibility: string; avatar_img_url?: string }): Promise<Desk & { board_id?: number | string; id?: number | string }> {
    if (['subscribers', 'friends'].includes(board.visibility)) {
        throw new Error('Доступ для подписчиков пока не поддерживается текущим backend. Выберите публичную или приватную доску.');
    }

    return apiRequest<Desk & { board_id?: number | string; id?: number | string }>('/api/v1/desks', {
        method: 'POST',
        body: JSON.stringify({
            name: board.title,
            description: board.description || '',
            entry_status: board.visibility === 'private' ? 2 : 0,
            ...(board.avatar_img_url !== undefined ? { avatar_img_url: board.avatar_img_url } : {}),
        }),
    });
}

export async function updateBoard(deskId: string | number, patch: Partial<Pick<Desk, 'name' | 'description' | 'entry_status' | 'avatar_img_url'>>) {
    return apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
    });
}

export async function deleteBoard(deskId: string | number): Promise<void> {
    await apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}`, {
        method: 'DELETE',
    });
}

export async function addPinsToBoard(deskId: string | number, pinIds: Array<string | number>, concurrency = 4): Promise<void> {
    const safeConcurrency = Math.max(1, Math.min(8, Math.floor(concurrency) || 1));
    let nextIndex = 0;

    let hasFailed = false;
    let firstError: unknown;
    const workers = Array.from({ length: Math.min(safeConcurrency, pinIds.length) }, async () => {
        while (nextIndex < pinIds.length && !hasFailed) {
            const pinId = pinIds[nextIndex++];
            try {
                await apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}/pins/${encodeURIComponent(pinId)}`, {
                    method: 'POST',
                });
            } catch (error) {
                if (!hasFailed) firstError = error;
                hasFailed = true;
            }
        }
    });

    await Promise.all(workers);
    if (hasFailed) throw firstError;
}

export async function removePinFromBoard(deskId: string | number, pinId: string | number): Promise<void> {
    await apiRequest(`/api/v1/desks/${encodeURIComponent(deskId)}/pins/${encodeURIComponent(pinId)}`, {
        method: 'DELETE',
    });
}

function featureUnavailableError(feature: string, endpoint: string, cause: unknown): Error & { status?: number; cause?: unknown } {
    const error = new Error(`${feature} пока не поддерживаются текущим backend (HTTP 404: ${endpoint}).`) as Error & { status?: number; cause?: unknown };
    error.status = 404;
    error.cause = cause;
    return error;
}

export async function fetchUserSavedPins(userId: string | number): Promise<Pin[]> {
    const endpoint = `/api/v1/users/${encodeURIComponent(userId)}/saved-pins`;
    try {
        const result = await apiRequest<{ pins?: Pin[] }>(endpoint);
        return result.pins || [];
    } catch (error) {
        // Не превращаем отсутствующий backend endpoint в пустой список:
        // иначе пользователь ошибочно решит, что сохранённых пинов нет.
        if (error?.status === 404) {
            throw featureUnavailableError('Сохранённые пины', endpoint, error);
        }
        throw error;
    }
}

// ===== Comments (маршруты пока отсутствуют в Go backend) =====

export async function fetchPinComments(pinId: string | number): Promise<Comment[]> {
    const endpoint = `/api/v1/pins/${encodeURIComponent(pinId)}/comments`;
    try {
        const result = await apiRequest<{ comments?: Comment[] }>(endpoint);
        return result.comments || [];
    } catch (error) {
        if (error?.status === 404) {
            throw featureUnavailableError('Комментарии', endpoint, error);
        }
        throw error;
    }
}

export async function createPinComment(pinId: string | number, text: string): Promise<Comment> {
    const endpoint = `/api/v1/pins/${encodeURIComponent(pinId)}/comments`;
    try {
        const result = await apiRequest<{ comment: Comment }>(endpoint, {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
        return result.comment;
    } catch (error) {
        if (error?.status === 404) {
            throw featureUnavailableError('Комментарии', endpoint, error);
        }
        throw error;
    }
}
