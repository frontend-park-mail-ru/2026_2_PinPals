import { defineConfig } from 'vite';
import handlebarsPlugin from '@cpulvermacher/vite-plugin-handlebars';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = process.env.API_TARGET || 'http://localhost:3001';

/** Собирает все файлы из public, чтобы кэшировать локальные картинки и шрифты. */
function getPublicFiles(directory, prefix = '') {
    if (!directory || !path.resolve(directory).startsWith(path.resolve(__dirname, 'public'))) {
        return [];
    }

    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        const publicPath = path.posix.join(prefix, entry.name);

        if (entry.isDirectory()) {
            return getPublicFiles(entryPath, publicPath);
        }

        if (entry.isFile() && entry.name !== 'sw.js') {
            return [`/${publicPath.replaceAll(path.sep, '/')}`];
        }

        return [];
    });
}

/** В production добавляет Service Worker и список ресурсов сборки в precache. */
function offlineServiceWorkerPlugin() {
    return {
        name: 'pickking-offline-service-worker',
        apply: 'build',
        generateBundle(_options, bundle) {
            const builtFiles = Object.keys(bundle)
                .filter((fileName) => fileName !== 'sw.js')
                .map((fileName) => `/${fileName}`);
            const publicFiles = getPublicFiles(path.join(__dirname, 'public'));
            const precacheFiles = [...new Set(['/', '/index.html', ...builtFiles, ...publicFiles])];

            const workerTemplate = readFileSync(path.join(__dirname, 'src/sw.js'), 'utf-8');
            const cacheMarker = "'__PICKKING_CACHE_NAME__'";
            const precacheMarker = '__PICKKING_PRECACHE_URLS__';

            if (workerTemplate.split(cacheMarker).length - 1 !== 1) {
                this.error(`Service Worker: marker ${cacheMarker} должен встречаться ровно один раз.`);
            }
            if (workerTemplate.split(precacheMarker).length - 1 !== 1) {
                this.error(`Service Worker: marker ${precacheMarker} должен встречаться ровно один раз.`);
            }

            // Имена Vite-чанков уже содержат content hash. Хэш списка URL
            // меняет имя кэша при изменении набора ресурсов новой сборки.
            const cacheHash = createHash('sha256')
                .update(JSON.stringify([...precacheFiles].sort()))
                .digest('hex')
                .slice(0, 12);
            const cacheName = `pickking-app-${cacheHash}`;
            const workerSource = workerTemplate
                .replace(cacheMarker, JSON.stringify(cacheName))
                .replace(precacheMarker, JSON.stringify(precacheFiles, null, 2));

            if (workerSource.includes(cacheMarker) || workerSource.includes(precacheMarker)) {
                this.error('Service Worker: не удалось подставить все build-маркеры.');
            }

            this.emitFile({ type: 'asset', fileName: 'sw.js', source: workerSource });
        },
    };
}

/** Babel удаляет типы TypeScript и делает преобразование синтаксиса для браузеров. */
function babelTypeScriptPlugin() {
    return {
        name: 'babel-typescript',
        enforce: 'pre',
        async transform(code, id) {
            const fileName = id.split('?')[0];
            if (!fileName.endsWith('.ts') || fileName.endsWith('.d.ts')) {
                return null;
            }

            const result = await import('@babel/core').then(({ transformAsync }) => transformAsync(code, {
                filename: fileName,
                sourceMaps: true,
                babelrc: false,
                configFile: false,
                presets: [
                    ['@babel/preset-typescript', { allowDeclareFields: true }],
                    ['@babel/preset-env', { targets: 'defaults', modules: false }],
                ],
            }));

            return result ? { code: result.code, map: result.map } : null;
        },
    };
}

export default defineConfig({
    plugins: [
        babelTypeScriptPlugin(),
        handlebarsPlugin(),
        offlineServiceWorkerPlugin(),
    ],
    server: {
        port: 3000,
        strictPort: true,
        proxy: {
            '/api': {
                target: apiTarget,
                changeOrigin: true,
            },
            '/images': {
                target: apiTarget,
                changeOrigin: true,
            },
        },
    },
    css: {
        preprocessorOptions: {
            scss: {
                quietDeps: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        cssCodeSplit: false,
        target: 'es2022',
    },
});