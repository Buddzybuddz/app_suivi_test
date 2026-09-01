const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
    { ignores: ['node_modules/**', 'generated-videos/**', 'docs/**'] },

    js.configs.recommended,
    prettier,

    // Fichiers du navigateur chargés en scope global classique (js/ + appwrite_config.js).
    // Ces fichiers se partagent un scope global implicite qu'ESLint ne peut pas modéliser :
    // no-undef / no-unused-vars / prefer-const produisent des faux positifs sur chaque
    // symbole partagé entre fichiers -> désactivés ici. Les règles de bugs réels
    // (no-dupe-keys, no-redeclare, no-unreachable, use-isnan, no-cond-assign...) restent actives.
    {
        files: ['js/**/*.js', 'appwrite_config.js'],
        ignores: ['js/**/*.test.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                lucide: 'readonly',
                Chart: 'readonly',
                html2canvas: 'readonly',
                Appwrite: 'readonly'
            }
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off',
            'prefer-const': 'off',
            'no-var': 'warn'
        }
    },

    // utils.js : vrai module CommonJS, testé isolément -> règles strictes.
    {
        files: ['utils.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.node }
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none' }]
        }
    },

    // Tests Vitest (ESM).
    {
        files: ['**/*.test.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: { ...globals.node }
        }
    },

    // Ce fichier de config + éventuels scripts Node.
    {
        files: ['eslint.config.js', '*.config.js'],
        languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } }
    }
];
