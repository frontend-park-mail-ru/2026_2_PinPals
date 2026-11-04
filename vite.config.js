import { defineConfig } from 'vite';
import handlebarsPlugin from '@cpulvermacher/vite-plugin-handlebars';

export default defineConfig({
    plugins: [handlebarsPlugin()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://161.104.105.76:8000',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
    },
});