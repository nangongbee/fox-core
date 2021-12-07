'use strict';
const debug = require('debug')('fox-core:loader');
const path = require('path');
const utils = require('../../utils');

module.exports = {
    getExtendFilePaths(name) {
        return this.getLoadUnits().map(unit => path.join(unit.path, 'app/extend', name));
    },

    loadApplicationExtend() {
        this.loadExtend('application', this.app);
    },

    loadContextExtend() {
        this.loadExtend('context', this.app.Context.prototype);
    },

    loadExtend(name, proto) {
        const filepaths = this.getExtendFilePaths(name);

        const mergeRecord = new Map();
        for (let filepath of filepaths) {
            filepath = utils.resolveModule(filepath);
            if (!filepath) {
                continue;
            }

            const ext = utils.loadFile(filepath);

            const properties = Object.getOwnPropertyNames(ext)
                .concat(Object.getOwnPropertySymbols(ext));

            for (const property of properties) {
                if (mergeRecord.has(property)) {
                    debug('Property: "%s" already exists in "%s"，it will be redefined by "%s"',
                        property, mergeRecord.get(property), filepath);
                }

                // Copy descriptor
                let descriptor = Object.getOwnPropertyDescriptor(ext, property);
                const originalDescriptor = Object.getOwnPropertyDescriptor(proto, property);

                if (originalDescriptor) {
                    // don't override descriptor
                    descriptor = Object.assign({}, descriptor);
                    if (!descriptor.set && originalDescriptor.set) {
                        descriptor.set = originalDescriptor.set;
                    }
                    if (!descriptor.get && originalDescriptor.get) {
                        descriptor.get = originalDescriptor.get;
                    }
                }
                Object.defineProperty(proto, property, descriptor);
                mergeRecord.set(property, filepath);
            }
            debug('merge %j to %s from %s', Object.keys(ext), name, filepath);
        }
    },
};
