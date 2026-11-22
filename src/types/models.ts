
export interface User {
    user_id: number;
    name: string;
    user_tag: string;
    birth_date?: string | null;
    description?: string | null;
    avatar_url?: string | null;
    followers_count?: number;
    created_at?: string;
}

export interface Pin {
    pin_id: number | string;
    creator_id?: number | string;
    image_url: string;
    name?: string | null;
    description?: string | null;
    tags?: string[];
    created_at?: string;
}

export interface PinCursor {
    id: number;
    created_at: string;
}

export interface PinSearchResponse {
    pins: Pin[];
    next_cursor?: PinCursor | null;
}

export interface Desk {
    desk_id: number | string;
    creator_id?: number | string;
    name: string;
    description?: string | null;
    avatar_img_url?: string | null;
    entry_status: 0 | 1 | 2;
    pins?: Pin[];
    pins_count?: number;
    created_at?: string;
}

export interface Comment {
    comment_id?: number | string;
    author: string;
    text: string;
    created_at?: string;
}

export interface LikeStatistics {
    likes_count: number;
    liked_by_me?: boolean;
    is_liked?: boolean;
}

/** Ошибка, сформированная Go-бэкендом. message поддерживается dev-моком. */
export interface BackendErrorPayload {
    error: string;
    message?: string;
}

/** Ошибка валидации Go-бэкенда с привязкой ошибок к полям. */
export interface BackendValidationErrorPayload extends BackendErrorPayload {
    fields: Record<string, string>;
}

/** Ошибка, сформированная Node-прокси (production server.js). */
export interface ProxyErrorPayload {
    message: string;
}

export type ApiResponseError = BackendErrorPayload | BackendValidationErrorPayload | ProxyErrorPayload;

export interface ApiError extends Error {
    status?: number;
    fields?: Record<string, string>;
    payload?: ApiResponseError | null;
}