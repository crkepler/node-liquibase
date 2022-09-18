const traverse = require('traverse');
const {klona} = require('klona/full');

/**
 * This only works on object {key: value}, not strings in general
 * @type {RegExp[]}
 */

const sensitiveKeys = [
    /cookie/i,
    /passw(or)?d/i,
    /^pw$/,
    /^pass$/i,
    /secret/i,
    /token/i,
    /api[-._]?key/i,
];

function isSensitiveKey(keyStr) {
    if (keyStr) {
        return sensitiveKeys.some(regex => regex.test(keyStr));
    }
}

function redactObject(obj) {
    traverse(obj).forEach(function redactor() {
        if (isSensitiveKey(this.key)) {
            this.update("[REDACTED]");
        }
    });
}

function redact(obj) {
    const copy = klona(obj); // Making a deep copy to prevent side effects
    redactObject(copy);

    const splat = copy[Symbol.for("splat")];
    redactObject(splat); // Specifically redact splat Symbol

    return copy;
}

module.exports = redact;