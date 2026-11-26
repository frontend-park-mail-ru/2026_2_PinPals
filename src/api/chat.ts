import { apiRequest } from './client';
import { isApiError } from '../utils/errors';
import type { Chat, ChatMessage, User } from '../types/models';

export const CHAT_PAGE_SIZE = 50;

/** Возвращает список диалогов текущего пользователя. */
export function fetchChats(signal?: AbortSignal): Promise<Chat[]> {
    return apiRequest('/api/v1/chats', { signal });
}

/** Создаёт или возвращает существующий диалог с пользователем. */
export function createChat(userId: number, signal?: AbortSignal): Promise<Chat> {
    return apiRequest('/api/v1/chats', {
        method: 'POST', body: JSON.stringify({ user_id: userId }), signal,
    });
}

/**
 * Загружает страницу истории сообщений.
 * @param beforeId Граница старых сообщений; 0 запрашивает последние сообщения.
 */
export function fetchChatMessages(chatId: number, signal?: AbortSignal, beforeId = 0): Promise<ChatMessage[]> {
    const query = new URLSearchParams({ limit: String(CHAT_PAGE_SIZE) });
    if (beforeId) query.set('before_id', String(beforeId));
    return apiRequest(`/api/v1/chats/${chatId}/messages?${query}`, { signal });
}

/** Отправляет сообщение; relatedTo указывает исходное сообщение для ответа. */
export function sendChatMessage(chatId: number, body: string, relatedTo: number | null, signal?: AbortSignal): Promise<ChatMessage> {
    return apiRequest(`/api/v1/chats/${chatId}/messages`, {
        method: 'POST', body: JSON.stringify({ body, ...(relatedTo === null ? {} : { related_to: relatedTo }) }), signal,
    });
}

/** Открывает соединение для получения новых сообщений диалога. */
export function openChatSocket(chatId: number): WebSocket {
    const url = new URL(`/api/v1/chats/${chatId}/ws`, location.origin);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(url);
}

// Контракты будущих маршрутов. В mock доступны уже сейчас.
/** Ищет собеседников по имени или логину. */
export async function searchChatUsers(query: string, signal?: AbortSignal): Promise<User[]> {
    try {
        return await apiRequest(`/api/v1/chats/users?q=${encodeURIComponent(query)}`, { signal });
    } catch (error: unknown) {
        if (isApiError(error) && (error.status === 404 || error.status === 405)) {
            throw new Error('Поиск пользователей пока недоступен. Откройте профиль собеседника и нажмите «Написать».', { cause: error });
        }
        throw error;
    }
}

/** Удаляет сообщение для обоих участников диалога. */
export async function deleteChatMessage(chatId: number, messageId: number, signal?: AbortSignal): Promise<void> {
    try {
        await apiRequest(`/api/v1/chats/${chatId}/messages/${messageId}`, { method: 'DELETE', signal });
    } catch (error: unknown) {
        if (isApiError(error) && (error.status === 404 || error.status === 405)) {
            throw new Error('Не удалось удалить сообщение: оно недоступно или сервер пока не поддерживает удаление.', { cause: error });
        }
        throw error;
    }
}
