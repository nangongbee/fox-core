'use strict';

const path = require('path');

module.exports = {
    testPlugin: {
        enable: false,
        path: path.join(__dirname, '../../../plugins/test-plugin'),
    },
};
