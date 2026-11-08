import eslint from '@eslint/js';
import globals from 'globals';

export default [
    eslint.configs.recommended,
    {
        files: ['src/**/*.js', 'server.js', 'server.dev.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            }
        },
        rules: {
            'no-unused-vars': ['warn', { 'argsIgnorePattern': '^e$' }], // Предупреждать о неиспользуемых переменных
            'no-console': 'off', // Разрешить console.error/log
            'semi': ['error', 'always'], // Точки с запятой обязательны
            'quotes': ['error', 'single'] // Одинарные кавычки для строк
        }
    }
];