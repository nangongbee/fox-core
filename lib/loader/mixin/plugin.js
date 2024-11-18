'use strict';

const fs = require('fs');
const path = require('path');
const debug = require('debug')('fox-core:loader');
const sequencify = require('../../utils/sequencify');
const utils = require('../../utils');

module.exports = {
    loadPlugin() {
    // loader plugins from application
        const appPlugins = this._readPluginConfigs(path.join(this.options.baseDir, 'config', 'plugin.default.js'));
        debug('Loaded app plugins: %j', Object.keys(appPlugins));

        // loader plugins from framework
        const frameworkPluginConfigPaths = this.frameworkPaths.map(frameworkPath => path.join(frameworkPath, 'config', 'plugin.default.js'));
        const frameworkPlugins = this._readPluginConfigs(frameworkPluginConfigPaths);
        debug('Loaded framework plugins: %j', Object.keys(frameworkPlugins));

        // loader plugins from process.env.FOX_PLUGINS
        let customPlugins;
        if (process.env.FOX_PLUGINS) {
            try {
                customPlugins = JSON.parse(process.env.FOX_PLUGINS);
            } catch (e) {
                debug('parse FOX_PLUGINS failed, %s', e);
            }
        }

        // loader plugins from options.plugins
        if (this.options.plugins) {
            customPlugins = Object.assign({}, customPlugins, this.options.plugins);
        }

        if (customPlugins) {
            for (const name in customPlugins) {
                this._normalizePluginConfig(customPlugins, name);
            }
            debug('Loaded custom plugins: %j', Object.keys(customPlugins));
        }

        this.allPlugins = {};
        this.appPlugins = appPlugins;
        this.customPlugins = customPlugins;
        this.frameworkPlugins = frameworkPlugins;

        this._extendPlugins(this.allPlugins, frameworkPlugins);
        this._extendPlugins(this.allPlugins, appPlugins);
        this._extendPlugins(this.allPlugins, customPlugins);
        debug('allPlugins ', this.allPlugins);
        const enabledPluginNames = []; // enabled plugins that configured explicitly
        const plugins = {};
        const env = this.serverEnv;
        const serverType = this.serverType;
        for (const name in this.allPlugins) {
            const plugin = this.allPlugins[name];

            // resolve the real plugin.path based on plugin or package
            plugin.path = this._getPluginPath(plugin, this.options.baseDir);

            // read plugin information from ${plugin.path}/package.json
            this._mergePluginConfig(plugin);

            // disable the plugin that not match the serverEnv
            if (env && plugin.env.length && plugin.env.indexOf(env) === -1) {
                debug('Disable %j, as env is %j but got %j', name, plugin.env, env);
                plugin.enable = false;
                continue;
            }

            // disable the plugin that not match the serverType
            if (env && plugin.serverTypes.length && plugin.serverTypes.indexOf(serverType) === -1) {
                debug('Disable %j, as serverTypes is %j but got %j', name, plugin.serverTypes, serverType);
                plugin.enable = false;
                continue;
            }

            // Can't enable the plugin implicitly when it's disabled by application
            if (appPlugins[name] && !appPlugins[name].enable) {
                debug('Disable %j, as disabled by app', name);
                continue;
            }

            plugins[name] = plugin;

            if (plugin.enable) {
                enabledPluginNames.push(name);
            }
        }

        // retrieve the ordered plugins
        this.orderPlugins = this._getOrderPlugins(plugins, enabledPluginNames);
        this.dirs = null;

        const enablePlugins = {};
        for (const plugin of this.orderPlugins) {
            enablePlugins[plugin.name] = plugin;
        }
        // this.options.logger.info('Loaded plugins: %j', Object.keys(enablePlugins));

        /**
     * Retrieve enabled plugins
     * @member {Object} FoxLoader#plugins
     * @since 1.0.0
     */
        this.plugins = enablePlugins;
    },

    /*
   * Read plugin.js from multiple directory
   */
    _readPluginConfigs(configPaths) {
        if (!Array.isArray(configPaths)) {
            configPaths = [ configPaths ];
        }

        // read plugin.default.js and plugins.${env}.js
        if (this.serverEnv !== 'default') {
            // note: can't use for-of
            for (let i = 0, l = configPaths.length; i < l; i++) {
                const configPath = configPaths[i];
                configPaths.push(configPath.replace(/plugin\.default\.js$/, `plugin.${this.serverEnv}.js`));
            }
        }

        const plugins = {};
        for (let configPath of configPaths) {
            debug(`try load plugin.js in '${configPath}'`);
            // let plugin.js compatible
            if (configPath.endsWith('plugin.default.js') && !fs.existsSync(configPath)) {
                configPath = configPath.replace(/plugin\.default\.js$/, 'plugin.js');
            }

            if (!fs.existsSync(configPath)) {
                continue;
            }

            const config = utils.loadFile(configPath);

            for (const name in config) {
                this._normalizePluginConfig(config, name, configPath);
            }

            this._extendPlugins(plugins, config);
        }

        return plugins;
    },


    // Read plugin information from package.json and merge
    // {
    //   foxPlugin: {
    //     "name": "",    plugin name, must be same as name in config/plugin.js
    //     "env": ""      env
    //   }
    // }
    _mergePluginConfig(plugin) {
        let pkg;
        let config;
        const pluginPackage = path.join(plugin.path, 'package.json');
        if (fs.existsSync(pluginPackage)) {
            pkg = require(pluginPackage);
            config = pkg.foxPlugin;
            if (pkg.version) {
                plugin.version = pkg.version;
            }
        }

        const logger = this.options.logger;
        if (!config) {
            logger.warn(`pkg.foxPlugin is missing in ${pluginPackage}`);
            return;
        }

        if (config.name && config.name !== plugin.name) {
            // pluginName is configured in config/plugin.js
            // pluginConfigName is pkg.foxPath.name
            logger.warn(`pluginName(${plugin.name}) is different from pluginConfigName(${config.name})`);
        }


        for (const key of [ 'dependencies', 'optionalDependencies', 'env' ]) {
            if (!plugin[key].length && Array.isArray(config[key])) {
                plugin[key] = config[key];
            }
        }
    },

    _getOrderPlugins(allPlugins, enabledPluginNames) {
    // no plugins enabled
        if (!enabledPluginNames.length) {
            return [];
        }

        const result = sequencify(allPlugins, enabledPluginNames);
        debug('Got plugins %j after sequencify', result);

        // catch error when result.sequence is empty
        if (!result.sequence.length) {
            const err = new Error(`sequencify plugins has problem, missing: [${result.missingTasks}], recursive: [${result.recursiveDependencies}]`);
            // find plugins which is required by the missing plugin
            for (const missName of result.missingTasks) {
                const requires = [];
                for (const name in allPlugins) {
                    if (allPlugins[name].dependencies.indexOf(missName) >= 0) {
                        requires.push(name);
                    }
                }
                err.message += `\n\t>> Plugin [${missName}] is disabled or missed, but is required by [${requires}]`;
            }

            err.name = 'PluginSequencifyError';
            throw err;
        }

        // log the plugins that be enabled implicitly
        const implicitEnabledPlugins = [];
        const requireMap = {};
        result.sequence.forEach(name => {
            for (const depName of allPlugins[name].dependencies) {
                if (!requireMap[depName]) {
                    requireMap[depName] = [];
                }
                requireMap[depName].push(name);
            }

            if (!allPlugins[name].enable) {
                implicitEnabledPlugins.push(name);
                allPlugins[name].enable = true;
            }
        });
        if (implicitEnabledPlugins.length) {
            // Following plugins will be enabled implicitly.
            //   - configclient required by [hsfclient]
            //   - eagleeye required by [hsfclient]
            //   - diamond required by [hsfclient]
            this.options.logger.info(`Following plugins will be enabled implicitly.\n${implicitEnabledPlugins.map(name => `  - ${name} required by [${requireMap[name]}]`).join('\n')}`);
        }

        return result.sequence.map(name => allPlugins[name]);
    },

    // Get the real plugin path
    _getPluginPath(plugin) {
        if (plugin.path) {
            return plugin.path;
        }

        const name = plugin.package || plugin.name;
        const lookupDirs = [];

        // 尝试在以下目录找到匹配的插件
        //  -> {APP_PATH}/node_modules
        //    -> {FRAMEWORK_PATH}/node_modules
        //      -> $CWD/node_modules
        lookupDirs.push(path.join(this.options.baseDir, 'node_modules'));

        // 到 框架链 中查找，优先从外往里查找
        for (let i = this.frameworkPaths.length - 1; i >= 0; i--) {
            const frameworkPath = this.frameworkPaths[i];
            lookupDirs.push(path.join(frameworkPath, 'node_modules'));
        }

        // should find the $cwd/node_modules when test the plugins under npm3
        lookupDirs.push(path.join(process.cwd(), 'node_modules'));

        for (const dir of lookupDirs) {
            let dirPath = path.join(dir, name);
            if (fs.existsSync(dirPath)) {
                return fs.realpathSync(dirPath);
            }
            dirPath = path.join(dir, `fox-${name}`);
            debug('try search plugin with prefix fox', dirPath);

            if (fs.existsSync(dirPath)) {
                return fs.realpathSync(dirPath);
            }
        }

        throw new Error(`Can not find plugin ${name} in "${lookupDirs.join(', ')}"`);
    },
    /**
   * 标准化配置信息
   * @param {Object} plugins 配置表
   * @param {String} name 需要标准版的配置项key
   * @param {String} configPath 配置来源路径
   */
    _normalizePluginConfig(plugins, name, configPath) {
        const plugin = plugins[name];

        // plugin_name: false
        if (typeof plugin === 'boolean') {
            plugins[name] = {
                name,
                enable: plugin,
                dependencies: [],
                optionalDependencies: [],
                env: [],
                serverTypes: [],
                from: configPath,
            };
            return;
        }

        if (!('enable' in plugin)) {
            plugin.enable = true;
        }
        plugin.name = name;
        plugin.dependencies = plugin.dependencies || [];
        plugin.optionalDependencies = plugin.optionalDependencies || [];
        plugin.env = plugin.env || [];
        plugin.serverTypes = plugin.serverTypes || [];
        plugin.from = configPath;
    },
    /**
   * 将plugins配置合并到target目标中
   * @param {Object} target 合并的目标
   * @param {Array} plugins  插件配置数组
   * @private
   */
    _extendPlugins(target, plugins) {
        if (!plugins) {
            return;
        }
        for (const name in plugins) {
            const plugin = plugins[name];
            let targetPlugin = target[name];
            if (!targetPlugin) {
                targetPlugin = target[name] = {};
            }
            if (targetPlugin.package && targetPlugin.package === plugin.package) { // 重复指定package 名称
                this.options.logger.warn('plugin %s has been defined that is %j, but you define again in %s',
                    name, targetPlugin, plugin.from);
            }
            if (plugin.path || plugin.package) { // 如果被上层覆盖了路径
                delete targetPlugin.path;
                delete targetPlugin.package;
            }
            for (const prop in plugin) {
                if (plugin[prop] === undefined) { // undefined忽略
                    continue;
                }
                if (targetPlugin[prop] && Array.isArray(plugin[prop]) && !plugin[prop].length) { // 空数组不覆盖
                    continue;
                }
                targetPlugin[prop] = plugin[prop];
            }
        }
    },

};

