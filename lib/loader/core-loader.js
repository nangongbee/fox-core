'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const is = require('is-type-of');
const debug = require('debug')('fox-core:loader:core');
const homedir = require('node-homedir');

const utils = require('../utils');

const FRAMEWORK_PATH = Symbol.for('FOX_FRAMEWORK_PATH');

/**
 * 提供环境探测，以及基础的加载功能
 */
class CoreLoader {

    /**
     * @constructor
     * @param {Application} app - app
     * @param {Object} options - options
     * @param {string} options.baseDir - 应用程序基目录
     * @param {*} options.logger - 加载器使用的logger
     * @param {Array} options.plugins - 指定额外加载的插件配置
     * @param {CoreApplication} options.app - 加载器依附的应用程序实例
     * @param {string} options.serverType - 指定服务器类型
     * @param {string} options.serverID - 指定服务器编号
     * @param {string} options.serverEnv - 指定服务器运行环境名
     * @since 1.0.0
     */
    constructor(app, options) {
        this.options = options || {};
        assert(fs.existsSync(this.options.baseDir), `${this.options.baseDir} not exists`);
        assert(app, 'options.app is required');
        // assert(this.options.logger, 'options.logger is required');

        debug('CoreLoader options %j', options);

        this.coreVersion = require(path.join(__dirname, '../../package.json')).version;
        this.app = app;
        this.logger = options.logger || console;


        /**
         * @member {Object} CoreLoader#pkg
         * @since 1.0.0
         */
        this.pkg = this.getPackageInfo();


        /**
         * 获取框架链目录列表
         * 沿着Application的原型链查找框架，并获取框架路径参数，方便扩展框架
         * @member {Array} CoreLoader#frameworkPaths
         * @since 1.0.0
         */
        this.frameworkPaths = this.getFrameworkPaths();
        debug('Loaded frameworkPaths %j', this.frameworkPaths);

        /**
         * 用于获取应用运行环境环境
         * @member {String} CoreLoader#serverEnv
         * @since 1.0.0
         */
        this.serverEnv = this.getServerEnv();
        debug('Loaded serverEnv %j', this.serverEnv);

        /**
         * 应用的名称
         * @member {String} CoreLoader#appName
         * @since 1.0.0
         */
        this.appName = this.getAppName();

        /**
         * 服务器类型
         * @member {String} CoreLoader#serverType
         * @since 1.0.0
         */
        this.serverType = this.getServerType();

        /**
         * 服务器名称
         * @member {String} CoreLoader#serverID
         * @since 1.0.0
         */
        this.serverID = this.getServerID();


        /**
         *
         * @member {String} CoreLoader#homeDir
         * @since 1.0.0
         */
        this.homeDir = this.getHomedir();

        /**
         * 应用信息
         * @member {String} CoreLoader#appInfo
         * @since 1.0.0
         */
        this.appInfo = this.getAppInfo();


    }

    getPackageInfo() {
        try {
            return require(path.join(this.options.baseDir, 'package.json'));
        } catch (e) {
            this.logger.warn(e.stack);
            return {};
        }
    }
    /**
     * 探测环境，返回应用程序包名
     * @return {String} 程序包名
     * @private
     * @since 1.0.0
     */
    getAppName() {
        return (this.pkg ? this.pkg.name : '') || 'Unknown App';
    }

    /**
     * 探测服务器类型，依次使用 [启动选项中的serverType, 环境变量FOX_SERVER_TYPE], 均不存在为空字符串
     * @return {String} 服务器类型
     * @private
     * @since 1.0.0
     */
    getServerType() {
        return this.options.serverType || process.env.FOX_SERVER_TYPE || 'normal';
    }

    /**
     * 返回服务器编号，依次使用 [启动选项中的serverID, 环境变量FOX_SERVER_ID],均不存在使用process.pid作为服务器编号
     * @return {String} 用户服务器编号
     * @private
     * @since 1.0.0
     */
    getServerID() {
        return this.options.serverID || process.env.FOX_SERVER_ID || process.pid;
    }

    /**
     * 返回home目录，依次使用 [环境变量FOX_HOME, 模块homedir的探测结果, '/home/admin']
     * @return {String} home目录
     * @private
     * @since 1.0.0
     */
    getHomedir() {
        return process.env.FOX_HOME || homedir() || '/home/admin';
    }

    /**
     * 返回运行环境, 依次使用[启动选项中的serverEnv, 文件config/env的值， 环境变量FOX_SERVER_ENV， 参考环境变量NODE_ENV，test时为unittest，production时为prod，其他值为local]
     * @return {String} env 运行环境名称
     * @private
     * @since 1.0.0
     */
    getServerEnv() {
        let serverEnv = this.options.serverEnv;

        const envPath = path.join(this.options.baseDir, 'config/env');
        if (fs.existsSync(envPath)) {
            serverEnv = fs.readFileSync(envPath, 'utf8').trim();
        }

        if (!serverEnv) {
            serverEnv = process.env.FOX_SERVER_ENV;
        }

        if (!serverEnv) {
            if (process.env.NODE_ENV === 'test') {
                serverEnv = 'unittest';
            } else if (process.env.NODE_ENV === 'production') {
                serverEnv = 'prod';
            } else {
                serverEnv = 'local';
            }
        }

        return serverEnv;
    }


    loadFile(filepath) {
        if (!fs.existsSync(filepath)) {
            return null;
        }
        let inject = Array.prototype.slice.call(arguments, 1);
        const ret = utils.loadFile(filepath);
        // function(arg1, args, ...) {}
        if (inject.length === 0) inject = [ this.app ];

        return is.function(ret) ? ret.apply(null, inject) : ret;
    }

    getAppInfo() {
        const serverEnv = this.serverEnv;
        const homeDir = this.homeDir;
        const baseDir = this.options.baseDir;
        const appName = this.appName;
        const serverID = this.serverID;
        const serverType = this.serverType;

        return {
            appName,
            baseDir,
            serverID,
            serverType,
            serverEnv,
            homeDir,
        };
    }

    /**
     * 获取所有加载单元
     * 分为以下几种类型的加载单元(app, framework, plugin).
     *
     * The order of the loadUnits:
     *
     * 1. plugin
     * 2. framework
     * 3. app
     *
     * @return {Array} loadUnits
     * @since 1.0.0
     */
    getLoadUnits() {
        const dirs = [];

        if (this.orderPlugins) {
            for (const plugin of this.orderPlugins) {
                dirs.push({
                    path: plugin.path,
                    type: 'plugin',
                    name: plugin.name,
                });
            }
        }

        // framework
        for (const frameworkPath of this.getFrameworkPaths()) {
            dirs.push({
                path: frameworkPath,
                type: 'framework',
                name: 'framework',
            });
        }

        // application
        dirs.push({
            path: this.options.baseDir,
            type: 'app',
            name: 'app',
        });

        return dirs;
    }

    /**
     * 通过对Application的原型链的查找，获得继承后的框架路径列表
     * @return {Array} framework directories
     * @private
     * @since 1.0.0
     */
    getFrameworkPaths() {
        // avoid require recursively
        const BaseApplicationPrototype = require('../application').prototype;
        const frameworkPaths = [];

        let proto = this.app;

        // Loop for the prototype chain
        while (proto) {
            proto = Object.getPrototypeOf(proto);
            // stop the loop if
            // - object extends Object
            // - object extends BaseApplication
            if (proto === Object.prototype || proto === BaseApplicationPrototype) {
                break;
            }

            assert(Object.prototype.hasOwnProperty.call(proto, FRAMEWORK_PATH), 'Symbol.for(\'FOX_FRAMEWORK_PATH\') is required on Application');
            const frameworkPath = proto[FRAMEWORK_PATH];
            assert(frameworkPath && typeof frameworkPath === 'string', `Symbol.for('FOX_FRAMEWORK_PATH') '${frameworkPath}' should be string`);
            const realpath = fs.realpathSync(frameworkPath);
    
            if (frameworkPath.indexOf(realpath) === -1) {
                frameworkPath.unshift(realpath);
            }
            frameworkPaths.push(frameworkPath);
        }

        return frameworkPaths;
    }

}


/**
 * Mixin methods to CoreLoader
 * // ES6 Multiple Inheritance
 * https://medium.com/@leocavalcante/es6-multiple-inheritance-73a3c66d2b6b
 */
const loaders = [
    require('./mixin/plugin'),
    require('./mixin/config'),
    require('./mixin/extend'),
    require('./mixin/hook'),
    require('./mixin/constant'),
];

for (const loader of loaders) {
    Object.assign(CoreLoader.prototype, loader);
}

module.exports = CoreLoader;
