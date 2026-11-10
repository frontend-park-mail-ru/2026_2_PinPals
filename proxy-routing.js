/**
 * Распределение запросов фронтенда по отдельным Go-сервисам.
 * Важно: этот модуль не переписывает URL — backend получает исходный путь
 * целиком, включая /api/v1 и /images.
 */

export const DEFAULT_BACKEND_TARGETS = Object.freeze({
    auth: 'http://localhost:8001',
    pin: 'http://localhost:8002',
    user: 'http://localhost:8003',
});

/**
 * Определяет backend-сервис по исходному pathname.
 *
 * @param {string} pathname URL path (query string допустим)
 * @returns {'auth'|'pin'|'user'|null}
 */
export function resolveBackendService(pathname) {
    const path = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';

    if (path === '/api/v1/auth' || path.startsWith('/api/v1/auth/')) {
        return 'auth';
    }

    // Единственный пользовательский маршрут в user_service.
    // Остальные /users/{id}/... обслуживаются pin_service (desks и др.).
    if (path === '/api/v1/users/me') {
        return 'user';
    }

    if (
        path === '/api/v1/pins' || path.startsWith('/api/v1/pins/') ||
        path === '/api/v1/desks' || path.startsWith('/api/v1/desks/') ||
        path === '/api/v1/users' || path.startsWith('/api/v1/users/') ||
        path === '/images' || path.startsWith('/images/')
    ) {
        return 'pin';
    }

    return null;
}

/**
 * Строит proxy-конфигурацию Vite. Более специфичный /users/me
 * расположен раньше общего /users, чтобы запрос профиля шёл в user_service.
 *
 * @param {{auth:string,pin:string,user:string}} targets
 * @returns {Record<string, {target:string, changeOrigin:boolean}>}
 */
export function createViteProxyConfig(targets) {
    const proxy = (target) => ({ target, changeOrigin: true });

    return {
        '/api/v1/auth': proxy(targets.auth),
        '/api/v1/users/me': proxy(targets.user),
        '/api/v1/users': proxy(targets.pin),
        '/api/v1/pins': proxy(targets.pin),
        '/api/v1/desks': proxy(targets.pin),
        '/images': proxy(targets.pin),
    };
}

/**
 * Разрешает адреса сервисов для dev-сервера.
 * API_MODE=mock направляет все запросы в локальный server.dev.js.
 * По умолчанию фронтенд подключается к реальным Go-сервисам.
 *
 * @param {Record<string,string|undefined>} env
 */
export function resolveBackendTargets(env = {}) {
    if (env.API_MODE === 'mock') {
        const mockTarget = env.API_TARGET || 'http://localhost:3001';
        return { auth: mockTarget, pin: mockTarget, user: mockTarget };
    }

    return {
        auth: env.AUTH_API_TARGET || DEFAULT_BACKEND_TARGETS.auth,
        pin: env.PIN_API_TARGET || DEFAULT_BACKEND_TARGETS.pin,
        user: env.USER_API_TARGET || DEFAULT_BACKEND_TARGETS.user,
    };
}
