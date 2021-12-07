'use strict';

const path = require('path');
const fs = require('fs');

module.exports = {

    /**
     * 加载文件到内存中
     * 若不是 js module 文件，则返回 文件内容的 buffer
     * 若是 js module 文件，则返回 require(filepath) 的结果
     *
     * @param filepath
     * @returns {*}
     */
    loadFile(filepath) {
        try {
            // if not js module, just return content buffer
            const extname = path.extname(filepath);
            if (![ '.js', '.node', '.json', '' ].includes(extname)) {
                return fs.readFileSync(filepath);
            }
            // require js module
            const obj = require(filepath);
            if (!obj) return obj;
            // it's es module
            if (obj.__esModule) return 'default' in obj ? obj.default : obj;
            return obj;
        } catch (err) {
            err.message = `load file: ${filepath}, error: ${err.message}`;
            throw err;
        }
    },

    /**
     * 清除 filepath 在 require 中的缓存
     *
     * @param filepath
     */
    clearRequireCache(filepath) {
        try {
            filepath = require.resolve(filepath);
            if (filepath) {
                delete require.cache[filepath];
            }
        } catch (err) {
            err.message = `clear require cache: ${filepath}, error: ${err.message}`;
            throw err;
        }
    },

    getAllProperties(object) {
        let names = Object.getOwnPropertyNames(object);
        let proto = Object.getPrototypeOf(object);
        let count = 0;
        const MAX_DEPTH = 32;
        while (proto && count < MAX_DEPTH) {
            names = names.concat(Object.getOwnPropertyNames(proto));
            proto = Object.getPrototypeOf(proto);
            count++;
        }
        return Array.from(new Set(names));
    },

    resolveModule(filepath) {
        try {
            return require.resolve(filepath);
        } catch (e) {
            return undefined;
        }
    },

};
