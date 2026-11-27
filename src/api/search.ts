import { apiRequest } from './client';
import { resolveAvatarUrl } from './user';
import type { Desk, Pin, User } from '../types/models';

export type SearchType = 'pins' | 'desks' | 'users';

export async function search(type: SearchType, query: string, offset: number, limit: number, signal: AbortSignal) {
    const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(limit) });
    const url = `/api/v1/${type}/search?${params}`;
    if (type === 'users') {
        const { users } = await apiRequest<{ users: User[] }>(url, { signal });
        return { users: users.map(user => ({
            href: `/profile/${user.user_id}`, title: user.name, detail: '@' + user.user_tag,
            image: resolveAvatarUrl(user.avatar_url),
        })) };
    }
    if (type === 'desks') {
        return apiRequest<{ desks: Desk[] }>(url, { signal });
    }
    return apiRequest<{ pins: Pin[] }>(url, { signal });
}
