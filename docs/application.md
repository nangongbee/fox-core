# Application

`require('@find_bumblebee/fox-core').Application`。

## 构造参数

| 字段 | 作用 |
| --- | --- |
| `baseDir` | 应用根目录，必须是已存在的目录。默认 `process.cwd()` |
| `serverType` | 进程类型。不传时用 `FOX_SERVER_TYPE`，再没有则为 `normal` |
| `serverID` | 进程编号。不传时用 `FOX_SERVER_ID`，再没有则为 pid |
| `serverEnv` | 环境名。见下方顺序 |
| `plugins` | 额外插件。应用自己的 `plugin.default.js` 里 `enable: false` 的项不能被这里重新打开 |
| `logger` | 可选。缺省时核心日志用 `console` |

`serverEnv` 的实际顺序：

1. 存在 `config/env` 时用文件内容，构造参数不生效。
2. 否则用构造参数。
3. 否则用 `FOX_SERVER_ENV`。
4. 否则按 `NODE_ENV`：`test` → `unittest`，`production` → `prod`，其他 → `local`。

## 启动和关闭

`start()` 在 `running === true` 时返回 `false`。正常走完返回 `true`，并把 `running` 设为 `true`。

顺序：`app-init` → 插件、常量、配置、`app/hook` → `app-inited` → `_load()` → `app-loaded` → `_run()` → `app-run` → `running = true` → `app-running`。

`stop()` 在未运行时返回 `false`。顺序：`app-stop` → `_stop()` → `app-clear` → `_clear()` → `running = false` → `app-stopped`。核心的 `_load`、`_run`、`_stop`、`_clear` 都是空函数。

`addHook(type, listener)` 注册的函数按注册顺序执行，支持 Promise 和 generator。`this` 指向应用。

## 读结果的位置

- 配置：`app.config`
- 常量：`app.constant`
- 已启用插件：`app.loader.plugins`
- 依赖排序后的插件：`app.loader.orderPlugins`
- 进程身份：`app.serverType`、`app.serverID`、`app.serverEnv`

核心没有 `app.plugins`。
