'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Application } = require('..');

const demoDir = path.join(__dirname, 'fixtures/apps/demo');

describe('test/app.test.js', () => {
    let app;

    afterEach(async () => {
        if (app && app.running) {
            await app.stop();
        }
        app = null;
    });

    it('should start and stop', async () => {
        app = new Application({
            baseDir: demoDir,
            serverType: 'room',
            serverID: '1',
        });
        assert.strictEqual(await app.start(), true);
        assert.strictEqual(app.running, true);
        assert.strictEqual(app.serverType, 'room');
        assert.strictEqual(app.serverID, '1');
        assert.strictEqual(app.config.test, true);
        assert.strictEqual(await app.stop(), true);
        assert.strictEqual(app.running, false);
    });

    it('should throw when baseDir does not exist', () => {
        assert.throws(() => {
            new Application({
                baseDir: path.join(__dirname, 'not-exists'),
            });
        }, /not exists/);
    });

    it('should keep a plugin disabled by the application config', async () => {
        app = new Application({
            baseDir: demoDir,
            plugins: {
                testPlugin: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/test-plugin'),
                },
            },
        });
        await app.start();
        assert.strictEqual(app.loader.plugins.testPlugin, undefined);
    });

    it('should load an extra plugin and order dependencies', async () => {
        app = new Application({
            baseDir: demoDir,
            serverType: 'room',
            serverEnv: 'local',
            plugins: {
                beta: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/beta'),
                    dependencies: [ 'alpha' ],
                    serverTypes: [ 'room' ],
                },
                alpha: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/alpha'),
                    env: [ 'local' ],
                },
            },
        });
        await app.start();
        assert.deepStrictEqual(app.loader.orderPlugins.map(plugin => plugin.name), [ 'alpha', 'beta' ]);
    });

    it('should skip a plugin whose serverType does not match', async () => {
        app = new Application({
            baseDir: demoDir,
            serverType: 'lobby',
            serverEnv: 'local',
            plugins: {
                beta: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/beta'),
                    dependencies: [ 'alpha' ],
                    serverTypes: [ 'room' ],
                },
                alpha: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/alpha'),
                    env: [ 'local' ],
                },
            },
        });
        await app.start();
        assert.deepStrictEqual(app.loader.orderPlugins.map(plugin => plugin.name), [ 'alpha' ]);
    });

    it('should run file hooks after app-init', async () => {
        app = new Application({
            baseDir: demoDir,
            serverType: 'room',
            serverID: '1',
        });
        const order = [];
        app.order = order;
        app.addHook('app-init', function () {
            this.order.push('manual:app-init');
        });
        await app.start();
        assert.deepStrictEqual(order, [
            'manual:app-init',
            'file:app-inited',
            'file:app-loaded',
            'file:app-run',
            'file:app-running',
        ]);
    });

    it('should read FOX_SERVER_TYPE when the option is omitted', () => {
        process.env.FOX_SERVER_TYPE = 'gate';
        try {
            app = new Application({ baseDir: demoDir });
            assert.strictEqual(app.serverType, 'gate');
            assert.strictEqual(app.loader.serverType, 'gate');
        } finally {
            delete process.env.FOX_SERVER_TYPE;
        }
    });

    it('should let config/env override the serverEnv option', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fox-core-'));
        fs.mkdirSync(path.join(dir, 'config'));
        fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fox-core-env"}\n');
        fs.writeFileSync(path.join(dir, 'config/env'), 'prod\n');
        try {
            app = new Application({
                baseDir: dir,
                serverEnv: 'local',
            });
            assert.strictEqual(app.serverEnv, 'prod');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
