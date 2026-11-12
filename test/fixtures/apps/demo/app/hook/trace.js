'use strict';

module.exports = {
    'app-init'() {
        if (Array.isArray(this.order)) this.order.push('file:app-init');
    },
    'app-inited'() {
        if (Array.isArray(this.order)) this.order.push('file:app-inited');
    },
    'app-loaded'() {
        if (Array.isArray(this.order)) this.order.push('file:app-loaded');
    },
    'app-run'() {
        if (Array.isArray(this.order)) this.order.push('file:app-run');
    },
    'app-running'() {
        if (Array.isArray(this.order)) this.order.push('file:app-running');
    },
};
