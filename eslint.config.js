import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sharedRules = {
    'no-console': 'off',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single'],
};

export default [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{js,ts}', 'server.js', 'server.dev.js', 'vite.config.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        rules: {
            ...sharedRules,
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            // Старые классы будут постепенно получать явные поля; типы API при этом уже вынесены в models.ts.
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },
];
