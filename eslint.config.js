const eslint = require('@eslint/js');
const globals = require('globals');

module.exports = [
    eslint.configs.recommended,
    {
        files: ['src/**/*.js', 'server.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                Handlebars: 'readonly'
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
