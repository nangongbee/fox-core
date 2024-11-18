'use strict';

module.exports = {
    extends: 'eslint:recommended',
    env: {
        node: true,
        mocha: true,
        es6: true,
    },
    parserOptions: {
        ecmaVersion: 2018,
    },
    rules: {
        // 基础规则
        'strict': ['error', 'global'],
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'no-console': 'warn',

        // 变量声明
        'no-var': 'error',
        'prefer-const': 'error',
        'no-unused-vars': ['error', { 'args': 'none' }],
        
        // 空格和换行
        'array-bracket-spacing': ['error', 'never'],
        'object-curly-spacing': ['error', 'always'],
        'space-before-function-paren': ['error', {
            'anonymous': 'always',
            'named': 'never',
            'asyncArrow': 'always',
        }],
        'keyword-spacing': ['error', { 'before': true, 'after': true }],
        'space-infix-ops': 'error',
        'eol-last': ['error', 'always'],
        'no-multiple-empty-lines': ['error', { 'max': 2, 'maxEOF': 1 }],
        
        // 最佳实践
        'eqeqeq': ['error', 'always'],
        'no-return-await': 'error',
        'require-await': 'error',
        'no-throw-literal': 'error',
        'prefer-promise-reject-errors': 'error',
        
        // Node.js 相关
        'handle-callback-err': 'error',
        'no-buffer-constructor': 'error',
        'no-path-concat': 'error',
        
        // ES6+
        'arrow-spacing': ['error', { 'before': true, 'after': true }],
        'arrow-parens': ['error', 'as-needed'],
        'arrow-body-style': ['error', 'as-needed'],
        'no-confusing-arrow': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',
        'template-curly-spacing': ['error', 'never'],
        'rest-spread-spacing': ['error', 'never'],
    },
    globals: {
        // 全局变量
        'app': true,
    },
}; 