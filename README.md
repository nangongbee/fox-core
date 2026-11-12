# fox-core

[![CI](https://github.com/nangongbee/fox-core/actions/workflows/ci.yml/badge.svg)](https://github.com/nangongbee/fox-core/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@find_bumblebee/fox-core.svg)](https://www.npmjs.com/package/@find_bumblebee/fox-core)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

`@find_bumblebee/fox-core` 是 Node.js 游戏服务进程的启动核心：生命周期、插件、配置。

游戏目录约定在 [`@find_bumblebee/fox`](https://github.com/nangongbee/fox)。这个包不包含具体玩法。仓库总览和能力表见 [docs/framework.md](docs/framework.md)。

```bash
npm install @find_bumblebee/fox-core
```

需要 Node.js 20 或更高版本。

```javascript
const { Application } = require('@find_bumblebee/fox-core');

const app = new Application({
  baseDir: __dirname,
  serverType: 'room',
  serverID: '1',
  serverEnv: 'local',
});

app.start();
```

`start()` 依次发出 `app-init`、`app-inited`、`app-loaded`、`app-run`、`app-running`。`app/hook` 在 `app-init` 之后才注册，所以文件里的 `app-init` 不会执行。

插件写在 `config/plugin.default.js`，可按 `env`、`serverTypes` 和 `dependencies` 启用。结果在 `app.loader.plugins` 和 `app.loader.orderPlugins`。

## 本包可用

- `start()` / `stop()`
- 构造参数以及 `FOX_SERVER_TYPE`、`FOX_SERVER_ID` 决定的进程身份
- 插件启用、环境过滤、`serverTypes` 过滤、依赖排序
- `config.default.js` 与 `config.${serverEnv}.js` 合并

## 本包有限制

- `app/hook` 里的 `app-init` 不会执行。要在 `start()` 之前调用 `addHook('app-init', fn)`
- 存在 `config/env` 时，文件内容覆盖构造参数里的 `serverEnv`
- 应用配置里 `enable: false` 的插件，不能被后来的自定义配置重新打开
- `enable: false` 仍会先解析插件路径。没有 `path`，也找不到同名包或 `fox-<name>` 包时，启动抛出 `Can not find plugin`
- `stop()` 只切换 `running` 并发出钩子。它不负责关闭业务资源

## 本包不提供

controller、service、event、crontab、HTTP、路由、中间件、热重载、日志实现和数据库连接。这些也不在本仓库的发布范围内，除了目录约定由 `@find_bumblebee/fox` 提供。

设计参考了 [Egg.js](https://github.com/eggjs/egg/) 的加载器和插件排序。插件加载里的部分报错文案来自这条上游实现。许可证见 [LICENSE](LICENSE)，版权行为 `Copyright (c) 2017 bumblebee`。

更细的行为说明在 [docs/what_is_fox.md](docs/what_is_fox.md)。

## 开发

```bash
npm install
npm test        # eslint + mocha
npm run cov     # 覆盖率
npm run docs    # 本地预览 docs/
```
