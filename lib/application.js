'use strict';

const assert = require('assert');
const fs = require('fs');
const is = require('is-type-of');
const co = require('co');
const EventEmitter = require('events').EventEmitter;

const FOX_LOADER = Symbol.for('FOX_LOADER');
const Context = require('./base-context-class');
/**
 * 框架核心Application类
 */
class CoreApplication extends EventEmitter {
    /**
     * @constructor
     * @param {Object} options 程序运行配置
     * @param {string} options.baseDir 工程所在目录, 默认使用process.cwd()
     * @param {Array} options.plugins - 指定额外加载的插件配置
     * @param {string} options.serverType - 指定服务器类型
     * @param {string} options.serverID - 指定服务器编号
     * @param {string} options.serverEnv - 指定服务器运行环境名称
     */
    constructor(options) {
        options = options || {};
        options.baseDir = options.baseDir || process.cwd();

        assert(is.string(options.baseDir), 'options.baseDir required, and must be a string');
        assert(fs.existsSync(options.baseDir), `Directory '${options.baseDir}' not exists`);
        assert(fs.statSync(options.baseDir).isDirectory(), `'${options.baseDir}' is not a directory`);

        super();


        /**
         * Application的初始化选项
         * @member {Object} CoreApplication#_options
         */
        this._options = options;
        this._hooks = Object.create(null);
        this.corelogger = options.logger || console;
        this.Context = Context;


        const Loader = this[FOX_LOADER];
        assert(Loader, 'Symbol.for(\'FOX_LOADER\') is required');
        /**
         * 核心加载器
         * @member {Loader} CoreApplication#loader
         */
        this.loader = new Loader(this, options);


        this.running = false;

    }


    get [FOX_LOADER]() {
        return require('./loader/core-loader');
    }


    /**
     * 框架基目录
     * @member {String} CoreApplication#baseDir
     * @see {@link AppInfo#baseDir}
     * @since 1.0.0
     */
    get baseDir() {
        return this._options.baseDir;
    }

    /**
     * 应用程序名称
     * @member {String} CoreApplication#name
     * @see {@link AppInfo#name}
     * @since 1.0.0
     */
    get name() {
        return this.loader ? this.loader.pkg.name || '' : '';
    }

    /**
     * 配置表
     * @member {Object} CoreApplication#config
     * @since 1.0.0
     */
    get config() {
        return this.loader ? this.loader.config || {} : {};
    }

    /**
     * 常量表
     * @member {Object} CoreApplication#contant
     * @since 1.0.0
     */
    get constant() {
        return this.loader ? this.loader.constant || {} : {};
    }

    /**
     * 服务器编号
     * @member {string} CoreApplication#serverID
     */
    get serverID() {
        return this.loader ? this.loader.serverID || process.pid : process.pid;
    }
    /**
     * 服务器类型
     * @member {string} CoreApplication#serverType
     */
    get serverType() {
        return this.loader ? this.loader.serverType || 'default' : 'default';
    }

    get serverEnv() {
        return this.loader ? this.loader.serverEnv || 'default' : 'default';
    }

    _preLoad() {
        this.loader.loadPlugin();
        this.loader.loadConstant();
        this.loader.loadConfig();
        this.loader.loadHook();
    }

    _load() {}

    _run() {}

    _stop() {}

    _clear() {}

    async start() {
        if (this.running) return false;
        await this.emitHook('app-init');
        await this._preLoad();
        await this.emitHook('app-inited');
        await this._load();
        await this.emitHook('app-loaded');
        await this._run();
        await this.emitHook('app-run');

        this.running = true;
        await this.emitHook('app-running');

        return true;
    }

    async stop() {
        if (!this.running) return false;

        await this.emitHook('app-stop');
        await this._stop();
        await this.emitHook('app-clear');
        await this._clear();

        this.running = false;
        await this.emitHook('app-stopped');

        return true;
    }

    addHook(type, listener) {
        if (typeof listener !== 'function') {
            throw new Error('listener is not a function');
        }

        let hooks = this._hooks;
        if (hooks === undefined) {
            hooks = this._hooks = Object.create(null);
        }
        const existing = hooks[type];

        if (existing === undefined) {
            // Optimize the case of one listener. Don't need the extra array object.
            hooks[type] = listener;
        } else if (typeof existing === 'function') {
            hooks[type] = [ existing, listener ];
        } else {
            existing.push(listener);
        }


        return this;
    }

    removeHook(type, listener) {
        if (typeof listener !== 'function') {
            throw new Error('listener is not a function');
        }

        const hooks = this._hooks;

        if (hooks === undefined) return this;


        const list = hooks[type];
        if (list === undefined) { return this; }

        if (list === listener) {
            delete hooks[type];
        } else if (typeof list !== 'function') {
            let position = -1;

            for (let i = list.length - 1; i >= 0; i--) {
                if (list[i] === listener) {
                    position = i;
                    break;
                }
            }

            if (position < 0) { return this; }

            if (position === 0) {
                list.shift();
            } else {
                list.splice(position, 1);
            }

            if (list.length === 1) {
                hooks[type] = list[0];
            }
        }
        return this;
    }

    removeAllHooks(type) {
        const hooks = this._hooks;
        if (hooks === undefined) {
            return this;
        }


        if (arguments.length === 0) {
            this._hooks = Object.create(null);
            return this;
        }

        if (hooks[type]) {
            delete hooks[type];
        }


        return this;
    }


    emitHook(type) {

        const args = Array.prototype.slice.call(arguments, 1);


        const hooks = this._hooks;

        if (!hooks) return Promise.resolve([]);

        // Throw for unhandled errors
        if (type === 'error' && (!hooks || !hooks.error)) {
            const err = args[0];
            if (err instanceof Error) {
                throw err;
            } else {
                const e = new Error(`Uncaught, unspecified 'error' event. (${err})`);
                e.context = err;
                throw e;
            }
        }

        return new Promise((resolve, reject) => {
            // Throw for unhandled errors
            if (type === 'error' && (!hooks || !hooks.error)) {
                const err = args[0];
                if (err instanceof Error) {
                    reject(err);
                } else {
                    const e = new Error(`Uncaught, unspecified 'error' event. (${err})`);
                    e.context = err;
                    reject(e);
                }
            }

            let callbacks = hooks[type];

            if (!callbacks) {
                return resolve([]);
            }


            // helper function to reuse as much code as possible
            const run = cb => {
                let ret;
                try {
                    switch (args.length) {
                        // fast cases
                        case 0:
                            ret = cb.call(this);
                            break;
                        case 1:
                            ret = cb.call(this, args[0]);
                            break;
                        case 2:
                            ret = cb.call(this, args[0], args[1]);
                            break;
                        case 3:
                            ret = cb.call(this, args[0], args[1], args[2]);
                            break;
                        // slower
                        default:
                            ret = cb.apply(this, args);
                    }
                } catch (e) {
                    return Promise.reject(e);
                }
                if (is.promise(ret)) return ret;

                return Promise.resolve(ret);
            };

            if (is.function(callbacks)) {
                if (is.generatorFunction(callbacks)) callbacks = co.wrap(callbacks);// 特殊处理生成器函数
                run(callbacks).then(ret => resolve([ ret ]), reject);
            } else if (is.array(callbacks)) {

                callbacks = callbacks.filter(fn => is.function(fn)).map(fn => (is.generatorFunction(fn) ? co.wrap(fn) : fn)); // 特殊处理生成器函数

                callbacks.reduce((prev, next) => {
                    return prev.then(res => {
                        return run(next).then(result => Promise.resolve(res.concat([ result ]))); // 处理返回值为数组情况
                    });
                }, Promise.resolve([])).then(resolve, reject);

            } else {
                return resolve([]);
            }
        });
    }
}


module.exports = CoreApplication;

