
import type { ApiError, ApiResponseError, BackendValidationErrorPayload } from '../types/models';
import { isApiResponseError } from '../utils/errors';

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
    let parsedPayload: unknown = null;
    if (rawText) {
        try {
            parsedPayload = JSON.parse(rawText) as unknown;
        } catch {
            if (!response.ok) {
                const error = new Error(`HTTP ${response.status}`) as ApiError;
                error.status = response.status;
                throw error;
            }
            const error = new Error(`Сервер вернул невалидный JSON: HTTP ${response.status}`);
            throw error;
        }
    }

    if (!response.ok) {
        const payload: ApiResponseError | null = isApiResponseError(parsedPayload) ? parsedPayload : null;
        const fields = payload && 'fields' in payload
            ? (payload as BackendValidationErrorPayload).fields
            : undefined;
        const fieldErrors = fields
            ? Object.entries(fields).map(([field, code]) => `${field}: ${code}`).join(', ')
            : '';
        const serverMessage = payload && 'message' in payload && payload.message
            ? payload.message
            : payload && 'error' in payload
                ? payload.error
                : undefined;
        const message = fieldErrors || serverMessage || `Ошибка запроса: HTTP ${response.status}`;
        const error = new Error(message) as ApiError;
        error.status = response.status;
        error.fields = fields;
        error.payload = payload;
        throw error;
    }

    return parsedPayload as T;
}