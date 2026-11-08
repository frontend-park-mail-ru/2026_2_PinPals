import { defineConfig } from 'vite';
import handlebarsPlugin from '@cpulvermacher/vite-plugin-handlebars';

const apiTarget = process.env.API_TARGET || 'http://localhost:3001';

export default defineConfig({
    plugins: [handlebarsPlugin()],
    server: {
        port: 3000,
        strictPort: true,
        proxy: {
            '/api': {
                target: apiTarget,
                changeOrigin: true,
            },
            // Изображения API должны проходить через тот же backend, что и /api.
            '/images': {
                target: apiTarget,
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});
