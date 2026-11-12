# Fox

Node.js 游戏进程框架，由两个包组成。当前版本是 `@find_bumblebee/fox-core@0.6.0` 和 `@find_bumblebee/fox@0.6.0`。

它做三件事：按固定顺序启动和关闭进程，按环境和服务器类型加载插件，按目录约定装上 controller、service、event 和 crontab。具体玩法、协议和业务配置留在使用它的进程里。

```
fox-core    生命周期、插件、配置
fox         controller / service / event / crontab / doAction
```

| 包 | 仓库 |
| --- | --- |
| `@find_bumblebee/fox-core` | [nangongbee/fox-core](https://github.com/nangongbee/fox-core) |
| `@find_bumblebee/fox` | [nangongbee/fox](https://github.com/nangongbee/fox) |

## 安装

```bash
npm install @find_bumblebee/fox
```

需要 Node.js 20 或更高版本。

## 本地开发

两个仓库并排 clone，再让 `fox` 使用本地的 `fox-core`：

```bash
git clone https://github.com/nangongbee/fox-core.git
git clone https://github.com/nangongbee/fox.git

cd fox-core && npm install && npm test && cd ..
cd fox && npm install && npm install --no-save ../fox-core && npm test
```

不执行第二条 `npm install` 时，`fox` 使用 npm 上发布的 `fox-core`。

## 最小进程

```javascript
const { Application } = require('@find_bumblebee/fox');

const app = new Application({
  baseDir: __dirname,
  serverType: 'room',
  serverID: '1',
  serverEnv: 'local',
});

app.start().then(() => app.doAction('user/ping', { tag: 'ok' }));
```

目录：

```text
config/config.default.js
config/config.local.js          # serverEnv 为 local 时覆盖默认配置
config/plugin.default.js        # 可选
app/controller/user.js          # 类方法 ping → user/ping
app/service/room.js
app/event/player.js             # 导出 { join(payload) {} } 即监听 join
app/crontab/heartbeat.js        # 同时导出 cron 字符串和 task 函数
app/hook/trace.js               # 导出钩子名对应的函数
package.json
```

有 crontab 文件时，启动前要自己提供带 `.l()` 的 logger，见能力表。

只使用核心、不扫描游戏目录时，改为 `require('@find_bumblebee/fox-core')`。核心的 `_load()` 和 `_run()` 是空的。

## 能力表

### 可用

| 能力 | 位置 | 测试 |
| --- | --- | --- |
| `start()` / `stop()`，`running` 标志 | fox-core | `fox-core`：should start and stop |
| 钩子 `app-inited`、`app-loaded`、`app-run`、`app-running` | `app/hook` 或 `addHook` | `fox-core`：should run file hooks after app-init |
| 插件 `enable`、`env`、`serverTypes`、`dependencies` | `config/plugin.default.js`，结果在 `app.loader.plugins`、`app.loader.orderPlugins` | `fox-core`：order dependencies、skip serverType |
| 配置合并 | `config.default.js`，再覆盖 `config.${serverEnv}.js`。对象或 `function(appInfo)` | `fox`：config.port、feature |
| 进程身份 | core：构造参数，其次 `FOX_SERVER_TYPE` / `FOX_SERVER_ID` / `FOX_SERVER_ENV` | `fox-core`：FOX_SERVER_TYPE |
| controller、service、event、crontab | `fox` 的 `app/` 目录 | `fox`：should load modules and run doAction |
| `doAction(name, extend)` | `fox` | 同上，`user/ping` |
| 数字或对象字段的 `FOX_<字段名>` | `fox` 的 loader。对象按 JSON 解析 | `fox`：numeric FOX_ config |

`serverEnv` 在没有 `config/env` 文件时：构造参数，然后 `FOX_SERVER_ENV`，然后 `NODE_ENV`（`test` → `unittest`，`production` → `prod`，其他 → `local`）。

`serverType` 都没有时为 `normal`。`serverID` 都没有时为进程 pid。

### 有限制

这些行为可以用，调用前要按这里处理。

| 限制 | 实际行为 | 测试 |
| --- | --- | --- |
| 文件钩子里的 `app-init` | `app/hook` 在 `app-init` 发出之后才注册，所以不会执行。要在 `start()` 之前 `addHook('app-init', fn)` | `fox-core` 的钩子顺序断言里没有 `file:app-init` |
| `config/env` | 文件存在时覆盖构造参数里的 `serverEnv` | `fox-core`：config/env override |
| 应用关掉的插件 | `plugin.default.js` 里 `enable: false` 的插件，不能被构造参数 `plugins` 重新打开 | `fox-core`：keep a plugin disabled |
| 关掉的插件仍要能找到路径 | 解析路径发生在 `enable` 判断之前。没有 `path`，也找不到包时抛出 `Can not find plugin` | 插件夹具为关掉的插件写了 `path` |
| `fox` 的 `serverType` / `serverID` | 这两个属性只返回构造参数。环境变量只写进 `app.loader`，启动横幅读的是这两个属性 | `fox`：serverType on the loader |
| crontab 的句柄 | 任务在 `app.loader.crontab`，没有 `app.crontab`。`stop()` 不会 `cancel()`，进程可能不退出 | `fox`：断言 `app.crontab === undefined`，测试在 `afterEach` 里自己 `cancel()` |
| crontab 的 logger | `startCrontabs()` 调用 `app.logger.l().debug()`。没有 `.l()` 时，只要目录里有合法 crontab 就会启动失败 | 测试夹具提供了 `l()` |
| `FOX_<字段名>` | 只覆盖已经存在的数字或对象。字符串保持文件里的值 | `fox`：`FOX_feature` 不改变 `feature` |
| `Service` / `Controller` / `Context` | 三个导出名是同一个 `FoxContext` 类 | `fox`：三者严格相等 |
| `Context.record(obj, level)` | 只调用 `app.record.info` 或 `app.record.error`。其他 level 不做事。核心不会创建 `app.record` | 测试在调用前挂上 `app.record` |
| 热更新 | `app/event` 加载器里有一条 TODO，没有实现 | 无 |

### 这两个目录不提供

- HTTP 服务、路由、中间件
- 热重载
- 日志库和 MySQL 连接
- `fox-init`、`create-fox`、项目模板
- 房间规则、协议、牌桌配置，以及任何业务进程

`fox-log`、`fox-mysql` 和脚手架没有放进这两个目录。日志包的 `package.json` 与许可证文件不一致。MySQL 钩子没有发布到公共 npm。脚手架的模板和说明里还留着 Egg 的包名。

## 生命周期

`start()`：

1. `app-init`
2. 加载插件、常量、配置，注册 `app/hook`
3. `app-inited`
4. `_load()`。`fox` 在这里扫描 controller、service、crontab、event
5. `app-loaded`
6. `_run()`。`fox` 在这里 `startCrontabs()`
7. `app-run`
8. `running = true`
9. `app-running`

`stop()`：`app-stop`、空的 `_stop()`、`app-clear`、空的 `_clear()`、`running = false`、`app-stopped`。

钩子函数按注册顺序执行，可以返回 Promise 或 generator。`this` 是应用实例。

更细的构造参数和读取位置见 [application.md](application.md)。core 的加载说明见 [what_is_fox.md](what_is_fox.md)。

## 和 Egg.js 的关系

加载器、插件依赖排序和目录扫描的做法参考了 [Egg.js](https://github.com/eggjs/egg/)。插件被依赖方隐式打开时，日志例句使用了 Egg 生态里的 `hsfclient`、`eagleeye`、`diamond`。

Fox 自己加上的部分是游戏进程的 `serverID`、`serverType`、`serverEnv`，按 `serverTypes` 过滤插件，这组 `app-*` 钩子，以及 controller、service、event、crontab 和 `doAction`。

## 许可证与版本

- `fox-core`：MIT，见 [LICENSE](https://github.com/nangongbee/fox-core/blob/master/LICENSE)。
- `fox`：MIT，见 [LICENSE](https://github.com/nangongbee/fox/blob/master/LICENSE)。
- npm 维护者名称是 `find_bumblebee`。
