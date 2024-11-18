'use strict';

const assert = require('assert');
const path = require('path');
const Fox = require('../lib/fox');

describe('test/app.test.js', () => {
    let app;

    // 每个测试用例执行前都会执行
    beforeEach(() => {
        app = new Fox({
            baseDir: path.join(__dirname, 'fixtures/apps/demo'),
            serverType: 'test',
            serverID: '1',
        });
    });

    // 每个测试用例执行后都会执行
    afterEach(() => {
        if (app) {
            return app.close();
        }
    });

    it('should start app successfully', async () => {
        await app.start();
        assert(app.config);
        assert(app.plugins);
        assert(app.isStarted === true);
    });

    it('should throw error when baseDir not exists', () => {
        assert.throws(() => {
            new Fox({
                baseDir: path.join(__dirname, 'not-exists'),
            });
        }, /not-exists not exists/);
    });

    it('should load custom plugins', async () => {
        app = new Fox({
            baseDir: path.join(__dirname, 'fixtures/apps/demo'),
            plugins: {
                testPlugin: {
                    enable: true,
                    path: path.join(__dirname, 'fixtures/plugins/test-plugin'),
                },
            },
        });
        await app.start();
        assert(app.plugins.testPlugin);
    });

    it('should load config successfully', async () => {
        await app.start();
        assert(app.config.test);
        assert(app.config.env === app.serverEnv);
    });

    it('should emit lifecycle events', async () => {
        const lifecycle = [];
        app.on('configDidLoad', () => {
            lifecycle.push('configDidLoad');
        });
        app.on('beforeStart', () => {
            lifecycle.push('beforeStart');
        });
        app.on('started', () => {
            lifecycle.push('started');
        });
        
        await app.start();
        assert.deepStrictEqual(lifecycle, [
            'configDidLoad',
            'beforeStart', 
            'started',
        ]);
    });
}); 