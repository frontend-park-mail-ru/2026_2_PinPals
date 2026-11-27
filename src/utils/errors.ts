import type { ApiError, ApiResponseError } from '../types/models';

const FIELD_LABELS: Record<string, string> = {
    user_tag: 'Логин',
    name: 'Имя',
    password: 'Пароль',
    birth_date: 'Дата рождения',
    description: 'Описание',
    avatar_url: 'Аватар',
    avatar: 'Аватар',
    image: 'Изображение',
    tags: 'Теги',
    text: 'Текст',
    entry_status: 'Доступ',
};

const FIELD_CODE_MESSAGES: Record<string, Record<string, string>> = {
    user_tag: {
        already_exists: 'Этот логин уже занят. Выберите другой.',
        required: 'Укажите логин.',
        must_not_be_empty: 'Логин не может быть пустым.',
        max_length_64: 'Логин не должен превышать 64 символа.',
    },
    name: {
        required: 'Укажите имя.',
        must_not_be_empty: 'Имя не может быть пустым.',
        max_length_255: 'Имя не должно превышать 255 символов.',
    },
    password: {
        min_length_8_and_letter_required: 'Пароль должен содержать минимум 8 символов и хотя бы одну букву.',
    },
    birth_date: {
        required: 'Укажите дату рождения.',
        invalid_date: 'Указана некорректная дата рождения.',
        minimum_age_13: 'Регистрация доступна с 13 лет.',
    },
};

const COMMON_CODE_MESSAGES: Record<string, string> = {
    required: 'Поле обязательно для заполнения.',
    must_not_be_empty: 'Поле не может быть пустым.',
    already_exists: 'Такое значение уже используется.',
    unsupported_image_format: 'Поддерживаются только изображения JPEG, PNG, GIF и WebP.',
    invalid_credentials: 'Неверный логин или пароль.',
    unauthorized: 'Необходима авторизация.',
    'не авторизован': 'Необходима авторизация.',
    forbidden: 'Недостаточно прав для выполнения действия.',
    not_found: 'Запрашиваемый объект не найден.',
    payload_too_large: 'Размер файла превышает допустимый лимит (10 МБ).',
};

/** Преобразует ошибку по конкретному полю в текст для пользователя. */
export function formatFieldError(field: string, code: string): string {
    const specificMessage = FIELD_CODE_MESSAGES[field]?.[code];
    if (specificMessage) return specificMessage;

    const commonMessage = COMMON_CODE_MESSAGES[code];
    const label = FIELD_LABELS[field];
    if (commonMessage) {
        return label ? `${label}: ${commonMessage.toLowerCase()}` : commonMessage;
    }

    return label ? `${label}: некорректное значение` : 'Проверьте правильность заполнения полей.';
}

/** Преобразует код ошибки бэкенда в текст для пользователя. */
export function formatServerErrorCode(code: string): string {
    const normalized = code.trim().toLowerCase();
    return COMMON_CODE_MESSAGES[code] || COMMON_CODE_MESSAGES[normalized] || code;
}


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
