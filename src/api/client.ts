import type { ApiErrorPayload } from '../types/models';

const BASE_URL = location.origin;

function getCsrfToken() {
    const cookie = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('csrf_token='));
    return cookie ? decodeURIComponent(cookie.slice('csrf_token='.length)) : '';
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
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
