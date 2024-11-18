'use strict';

const assert = require('assert');
const fs = require('fs');
const debug = require('debug')('core:module-loader');
const path = require('path');
const globby = require('globby');
const is = require('is-type-of');
const Case = require('case');

const utils = require('../utils');
// const MODULE_INFO = Symbol('MODULE_INFO');

const defaultsConstructorOptions = {
    units: null,
    initializer: null,
    call: true,
    inject: undefined,
    filter: null,
    caseStyle: 'camel',
    clearCache: true,
    override: false,
};

/**
 * 将文件名转换为指定 caseStyle 风格的字符串数组，根据文件路径分隔符进行切割
 *
 * @param filepath 文件名，可能包含上级目录，如 a.js、xx/a.js、xx/xx/a.js
 * @param caseStyle
 * @returns {Array} 返回的字符串数组，按照文件路径的顺序
 */
function defaultCase(filepath, caseStyle) {
    const properties = filepath.split(path.sep);
    const fileName = properties[properties.length - 1];
    const index = fileName.indexOf('.'); // 截取到第一个'.'处作为文件名
    if (index !== -1) {
        properties[properties.length - 1] = fileName.substring(0, index);
    }


    if (properties.length === 0) return [];
    return properties.map(property => {
        switch (caseStyle) {
            case 'lower':
                return Case.lower(property);
            case 'upper':
                return Case.upper(property);
            case 'camel':
                return Case.camel(property);
            case 'pascal':
                return Case.pascal(property);
            case 'kebab':
                return Case.kebab(property);
            case 'original':
                return property;
            default:
                return property;
        }
    });
}

/**
 * 解析 units 字段的 文件夹路径root、路径匹配模板glob
 *
 * 默认为 '{root: unit , glob: 默认是 .js 文件}'
 *
 * @param units
 * @returns {*} 解析后的 units 对象。格式为 { root , glob }
 */
function processGlob(units) {
    if (!Array.isArray(units)) units = [ units ];

    return units.map(unit => {
        if (is.string(unit)) {
            return {
                root: unit,
                glob: [ '**/*.js' ],
            };

        }
        let glob = unit.match || [ '**/*.js' ];

        if (!Array.isArray(glob)) glob = [ glob ];

        let ignore = unit.ignore || [];
        if (!Array.isArray(ignore)) ignore = [ ignore ];

        glob = glob.concat(ignore.filter(f => is.string(f)).map(f => `!${f}`));

        return {
            root: path.resolve(unit.root),
            glob,
        };
    });
}

/**
 * 将指定文件导出
 * 一般情况下，是 require 导出的内容
 * 并使用指定的 initializer、call 进行处理；若未指定，则不进行处理
 *
 * @param fullpath
 * @param filepath
 * @param unit
 * @param clearCache
 * @param initializer
 * @param call
 * @param inject
 * @return {*} 导出的文件内容
 */
function getExports(fullpath, filepath, unit, { clearCache, initializer, call, inject }) {
    if (clearCache) utils.clearRequireCache(fullpath);

    let exports = utils.loadFile(fullpath);

    // process exports as you like

    if (initializer) {
        exports = initializer(exports, { fullpath, root: unit.root, filepath });
    }
    if (call && is.function(exports) && !is.class(exports) && !is.generatorFunction(exports)) {
        exports = exports(inject);
    }

    return exports;
}


function parseFlags(filepath) {
    const properties = filepath.split(path.sep);
    const fileName = properties[properties.length - 1];
    const index = fileName.indexOf('.'); // 截取到第一个'.'处作为文件名
    const index2 = fileName.lastIndexOf('.'); // 截取到第一个'.'处作为文件名
    if (index === -1 || index2 === -1 || index >= index2) return [];

    return fileName.substring(index + 1, index2).split('.');
}

/**
 * 从一个或者多个文件夹中加载模块
 * 执行load后 ，loader.getModules() 为加载完毕的模块列表，会按照units的序列顺序加载
 *
 * 每一个module包含以下信息:
 * fullpath 全路径
 * filepath 相对于加载单元root的相对路径
 * exports 模块的导出
 * root 加载单元根目录
 * properties 路径key分段   /user/admin.js => ['user', 'admin'] (caseStyle = 'camel')
 * pathKey 路径key  /user/admin.js => user.admin (caseStyle = 'camel')
 * meta 元数据 原样传递的附加元数据，用于标识加载单元，见加载单元参数
 * flags 模块flag // xxx.0.base.js =>  [ '0', 'base'] config.default.js =>  [ 'default']
 * unit 加载单元
 */
class ModuleLoader {

    /**
     * @constructor
     * @param {Object} options - 选项
     * @param {Object[]|string[]|Object|string} options.units - 单个文件夹路径或多个文件夹路径数组
     * @param {string} options.units[].root - 文件夹路径
     * @param {string|string[]} options.units[].match - 路径匹配模板，支持glob，默认为全部js文件
     * @param {string|string[]} options.units[].ignore -  需要忽略的文件，支持glob
     * @param {*} options.units[].meta -  附加的元数据，自动附加到加载后每一项模块单元中，用于标识加载单元

     * @param {function} options.initializer - 提供一个函数对文件导出内容进行处理，
     * @param {boolean} options.call - 当导出内容为一个函数且不是生成器函数或者类时是否自动调用，会在initializer处理后调用
     * @param {Object} options.inject - 自动调用函数时的注入内容
     * @param {function} options.filter - 提供一个函数用于对模块导出内容进行判断并过滤，接受两个参数，第一个参数为模块的导出内容，第二个参数为文件路径，返回true或者false决定文件是否被过滤
     * @param {string|function} options.caseStyle - 定义文件名转化成模块名的方式，可以是一下字符串 'pascal' 'lower' 'camel' 'upper' 'kebab'或者传递一个函数，默认为camel。
     * @param {boolean} options.clearCache - 加载前是否先清除缓存，保证加载时最新文件
     **/
    constructor(options) {
        options = options || {};
        assert(options.units, 'options.units is required');
        this.options = Object.assign({}, defaultsConstructorOptions, options);
        this.modules = [];
        this.loaded = false;
    }

    /**
     * 加载操作
     * 扫描 units 中的每个文件夹路径下的 .js 文件（或者其他文件后缀，可在 units 中定义）
     * 将每个 .js 文件的 require 内容，存入 ModuleLoader 对象的 this.modules 中
     *
     * @return {ModuleLoader}
     */
    load() {
        if (this.loaded) return this;

        const options = this.options;
        const units = options.units = processGlob(options.units);


        const filter = is.function(options.filter) ? options.filter : null;
        const modules = this.modules = [];
        debug('Load Units:  %j', units);
        for (const unit of units) {

            const filepaths = globby.sync(unit.glob, { cwd: unit.root });

            for (const filepath of filepaths) {
                const fullpath = path.join(unit.root, filepath);
                if (!fs.statSync(fullpath).isFile()) continue;

                const exports = getExports(fullpath, filepath, unit, options);

                // ignore exports when it's null or false returned by filter function
                if (exports === null || exports === undefined || (filter && filter(exports, fullpath, filepath, unit) === false)) continue;

                // set properties of class
                const properties = is.function(options.caseStyle) ? options.caseStyle(filepath) : defaultCase(filepath, options.caseStyle);
                const pathKey = properties.join('.');

                modules.push({ fullpath, filepath, exports, root: unit.root, properties, meta: unit.meta, flags: parseFlags(filepath), unit, pathKey });
                debug('Load Module: %j export -> %j', fullpath, exports);
            }
        }
        this.loaded = true;
        return this;

    }

    /**
     * 把该 ModuleLoader 对象的 this.modules ，映射为对象树，存于 target 对象中
     *
     * 例如：
     *    /a/b/c.js   映射为   target.a.b.c = exports
     *    c.js        映射为   target.c = exports
     *
     * @param target
     * @param options
     *
     */
    toTarget(target, options) {
        options = Object.assign({
            override: true,
        }, options);
        assert(target, 'target is required');

        for (const module of this.modules) {
            debug('process module %j', module);
            // => target.a.b.c = exports
            module.properties.reduce((target, property, index) => {
                let obj;
                const properties = module.properties.slice(0, index + 1).join('.');
                if (index === module.properties.length - 1) {
                    if (property in target) {
                        if (!options.override) throw new Error(`can't overwrite property '${properties}' by ${module.fullpath}`);
                    }
                    obj = module.exports;
                } else {
                    obj = target[property] || {};
                }

                target[property] = obj;
                debug('loaded %s', properties);
                return obj;
            }, target);
        }
    }

    forEach(fn) {
        return this.modules.forEach(fn);
    }

    getModules() {
        return this.modules.slice();
    }

}


module.exports = ModuleLoader;

