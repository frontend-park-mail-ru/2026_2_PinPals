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

export interface ApiErrorPayload {
    message?: string;
    error?: string;
    fields?: Record<string, string>;
    [key: string]: unknown;
}

export interface ApiError extends Error {
    status?: number;
    fields?: Record<string, string>;
    payload?: ApiErrorPayload | null;
}
