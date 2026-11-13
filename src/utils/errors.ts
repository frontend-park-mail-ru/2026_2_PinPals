import type { ApiError, ApiResponseError } from '../types/models';

/** Проверяет, что неизвестная ошибка содержит поля, добавляемые apiRequest. */
export function isApiError(error: unknown): error is ApiError {
    return error instanceof Error
        && ('status' in error || 'fields' in error || 'payload' in error);
}

/** Возвращает безопасное текстовое описание ошибки любого происхождения. */
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    return 'Произошла непредвиденная ошибка.';
}

/** Проверяет JSON-ответ ошибки Go-бэкенда или Node-прокси. */
export function isApiResponseError(value: unknown): value is ApiResponseError {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;

    const payload = value as Record<string, unknown>;
    const hasBackendError = typeof payload.error === 'string';
    const hasProxyMessage = typeof payload.message === 'string';
    if (!hasBackendError && !hasProxyMessage) return false;

    if ('fields' in payload) {
        if (typeof payload.fields !== 'object' || payload.fields === null || Array.isArray(payload.fields)) {
            return false;
        }
        return Object.values(payload.fields).every((field) => typeof field === 'string');
    }

    return true;
}
