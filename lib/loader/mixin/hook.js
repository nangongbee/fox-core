'use strict';
const ModuleLoader = require('../module-loader');
const is = require('is-type-of');
const path = require('path');
module.exports = {
    loadHook() {
        const units = this.getLoadUnits().map(unit => {
            return {
                root: path.join(unit.path, 'app/hook'),
                meta: {
                    type: unit.type,
                    name: unit.name,
                },
            };
        });

        const loader = this.hookLoader = new ModuleLoader({
            units,
        });

        loader.load().forEach(module => {
            if (!is.object(module.exports)) return;
            Object.keys(module.exports).forEach(key => {
                const fn = module.exports[key];
                if (is.function(fn)) {
                    this.app.addHook(key, fn);
                }
            });
        });

    },
};
