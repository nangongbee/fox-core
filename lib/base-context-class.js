'use strict';

class Context {
    constructor(app) {
        Object.defineProperty(this, 'app', {
            configurable: true,
            writable: false,
            enumerable: false,
            value: app,
        });
    }

    get config() {
        return this.app.config;
    }
}


module.exports = Context;
