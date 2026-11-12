# Fox core

`fox-core` 是 Node.js 游戏服务进程的启动核心。它不管具体玩法，只负责插件、配置和生命周期。

游戏目录约定在 `@find_bumblebee/fox` 里。业务仓库不在这个包中。

## 安装

```bash
npm install @find_bumblebee/fox-core
```

## 启动

```javascript
const { Application } = require('@find_bumblebee/fox-core');

const app = new Application({
  baseDir: __dirname,
  serverType: 'room',
  serverID: '1',
  serverEnv: 'local',
});

app.start().then(() => app.stop());
```

直接 `new Application` 使用核心 loader。子类若要换 loader，必须在原型上提供 `Symbol.for('FOX_LOADER')`。`@find_bumblebee/fox` 已经这样做。核心的 `_load()` 和 `_run()` 是空的。

## 生命周期

`start()` 的顺序：

1. `app-init`
2. 加载插件、常量、配置，然后注册 `app/hook` 里的函数
3. `app-inited`
4. `_load()`
5. `app-loaded`
6. `_run()`
7. `app-run`
8. `running = true`
9. `app-running`

`stop()` 的顺序是 `app-stop`、`app-clear`、`running = false`、`app-stopped`。

`app/hook` 在第 2 步才注册。因此文件里导出的 `app-init` 不会执行。要在 `start()` 之前调用 `addHook('app-init', fn)`。

## 插件

配置文件是 `config/plugin.default.js`。不存在时会读 `config/plugin.js`。

```javascript
module.exports = {
  beta: {
    enable: true,
    path: require('path').join(__dirname, '../plugins/beta'),
    dependencies: [ 'alpha' ],
    serverTypes: [ 'room' ],
  },
};
```

`env` 不匹配或 `serverTypes` 不匹配时，插件关闭。应用配置里 `enable: false` 的插件，不能被后来的自定义配置重新打开。

依赖顺序由 `sequencify` 决定。启用后的列表在 `app.loader.orderPlugins` 和 `app.loader.plugins`。

## 配置

合并 `config/config.default.js`，再用 `config/config.${serverEnv}.js` 覆盖。文件可以导出对象，也可以导出 `function(appInfo)`。

`serverEnv` 的实际顺序：

1. `config/env` 文件存在时，用文件内容，构造参数里的 `serverEnv` 不会生效。
2. 没有该文件时，用构造参数 `serverEnv`。
3. 再没有则用 `FOX_SERVER_ENV`。
4. 最后看 `NODE_ENV`：`test` 为 `unittest`，`production` 为 `prod`，其他为 `local`。

`serverType` 使用构造参数、`FOX_SERVER_TYPE`，都没有时为 `normal`。`serverID` 使用构造参数、`FOX_SERVER_ID`，都没有时为进程 pid。

## 还没有的能力

这个包不扫描 controller、service、event 或定时任务，也不提供热重载、HTTP、路由和中间件。可用、有限制和不提供的总表在 [framework.md](framework.md)。
