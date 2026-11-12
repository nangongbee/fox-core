'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: [
            'coverage/',
            'node_modules/',
            'test/fixtures/',
            '**/*.min.js',
            '**/*.debug.js',
            'dist/',
        ],
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.mocha,
                app: 'readonly',
            },
        },
        rules: {
            // 基础规则
            'strict': [ 'error', 'global' ],
            'indent': [ 'error', 4, { 'SwitchCase': 1 } ],
            'quotes': [ 'error', 'single', { 'allowTemplateLiterals': true } ],
            'semi': [ 'error', 'always' ],
            'comma-dangle': [ 'error', 'always-multiline' ],
            'no-console': 'warn',

            // 变量声明
            'no-var': 'error',
            'prefer-const': 'error',
            'no-unused-vars': [ 'error', { 'args': 'none', 'caughtErrors': 'none' } ],

            // 空格和换行
            'array-bracket-spacing': [ 'error', 'always' ],
            'object-curly-spacing': [ 'error', 'always' ],
            'space-before-function-paren': [ 'error', {
                'anonymous': 'always',
                'named': 'never',
                'asyncArrow': 'always',
            } ],
            'keyword-spacing': [ 'error', { 'before': true, 'after': true } ],
            'space-infix-ops': 'error',
            'eol-last': [ 'error', 'always' ],
            'no-multiple-empty-lines': [ 'error', { 'max': 2, 'maxEOF': 1 } ],

            // 最佳实践
            'eqeqeq': [ 'error', 'always' ],
            'require-await': 'error',
            'no-throw-literal': 'error',
            'prefer-promise-reject-errors': 'error',

            // ES6+
            'arrow-spacing': [ 'error', { 'before': true, 'after': true } ],
            'arrow-parens': [ 'error', 'as-needed' ],
            'arrow-body-style': [ 'error', 'as-needed' ],
            'no-confusing-arrow': 'error',
            'prefer-arrow-callback': 'error',
            'prefer-template': 'error',
            'template-curly-spacing': [ 'error', 'never' ],
            'rest-spread-spacing': [ 'error', 'never' ],
        },
    },
];
