'use strict';

const debug = require('debug')('fox-core:loader');
const fs = require('fs');
const path = require('path');
const extend = require('extend2');


module.exports = {

    /**
     * Load config/config.js
     *
     * Will merge config.default.js 和 config.${env}.js
     *
     * @method FoxLoader#loadConfig
     * @since 1.0.0
     */
    loadConfig() {
        const target = {};
        const names = [
            'config.default.js',
            `config.${this.serverEnv}.js`,
        ];

        // Load Application config first
        const appConfig = this._preloadAppConfig();

        //   plugin config.default
        //     framework config.default
        //       app config.default
        //           plugin config.{env}
        //             framework config.{env}
        //                app config.{env}


        for (const filename of names) {
            for (const unit of this.getLoadUnits()) {
                const isApp = unit.type === 'app';

                const config = this._loadConfig(unit.path, filename, isApp ? undefined : appConfig, unit.type);// 为框架或者插件的配置导出函数额外传递app的配置信息

                if (!config) {
                    continue;
                }

                debug('Loaded config %s/%s, %j', unit.path, filename, config);
                extend(true, target, config);
            }

        }

        this.config = target;
    },

    /**
     * 加载app的配置，用于加载框架或者插件时注入app的配置
     * @return {Object} app的配置
     * @private
     */
    _preloadAppConfig() {
        const names = [
            'config.default.js',
            `config.${this.serverEnv}.js`,
        ];
        const target = {};

        for (const filename of names) {
            const config = this._loadConfig(this.options.baseDir, filename, undefined, 'app');
            extend(true, target, config);
        }

        return target;
    },

    /**
     * 加载配置文件
     * @param {String} dirpath 加载单元目录
     * @param {String} filename 配置文件名，config.default.js兼容config.js
     * @param {*} extraInject 如果配置文件模块返回一个函数，那么调用并注入appInfo和该参数
     * @return {Object} 加载的配置信息
     * @private
     */
    _loadConfig(dirpath, filename, extraInject) {

        let filepath = path.join(dirpath, 'config', filename);
        // let config.js compatible
        if (filename === 'config.default.js' && !fs.existsSync(filepath)) {
            filepath = path.join(dirpath, 'config/config.js');
        }
        const config = this.loadFile(filepath, this.appInfo, this.constant, extraInject);

        if (!config) {
            return null;
        }


        return config;
    },

    /**
     * 删除 require 加载的配置文件缓存
     */
    deleteRequireConfigFile() {
        const names = [
            'config.default.js',
            `config.${this.serverEnv}.js`,
        ];

        for (const filename of names) {
            for (const unit of this.getLoadUnits()) {
                const dirpath = unit.path;

                let filepath = path.join(dirpath, 'config', filename);

                // let config.js compatible
                if (filename === 'config.default.js' && !fs.existsSync(filepath)) {
                    filepath = path.join(dirpath, 'config/config.js');
                }

                if (fs.existsSync(filepath)) {
                    try {
                        filepath = require.resolve(filepath);
                        if (filepath) {
                            delete require.cache[ filepath ];
                        }
                    } catch (err) {
                        err.message = `deleteRequireConfigFile: ${filepath}, error: ${err.message}`;

                        this.app.logger.l('config loader')
                            .warn(err);

                        return;
                    }
                }
            }

        }

    },

};
