import { defineConfig } from 'vite';
import handlebarsPlugin from '@cpulvermacher/vite-plugin-handlebars';

export default defineConfig({
    plugins: [handlebarsPlugin()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                // Mock API из server.dev.js. Для настоящего backend здесь
                // можно указать адрес Go-сервера.
                target: process.env.API_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});
