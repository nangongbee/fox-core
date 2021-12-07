'use strict';
const debug = require('debug')('fox-core:loader');
const path = require('path');
const extend = require('extend2');


module.exports = {
    loadConstant() {
        const target = {};
        for (const unit of this.getLoadUnits()) {

            const constant = this.loadFile(path.join(unit.path, 'config/constant.js'), this.appInfo);

            if (!constant) {
                continue;
            }

            debug('Loaded constant %s/config/constant.js, %j', unit.path, constant);
            extend(true, target, constant);
        }
        this.constant = target;

    },
};
