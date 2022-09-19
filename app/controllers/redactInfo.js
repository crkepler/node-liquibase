const traverse = require('traverse');
const {klona} = require('klona/full');

/**
 * This only works on object {key: value}, not strings in general
 * @type {RegExp[]}
 */

const sensitiveKeys = [
    /cookie/i,
    /passw(or)?d/i,
    /referencepassw(or)?d/i, //added, since it's a Liquibase parameter
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
    traverse(obj).forEach(function redactor(value) {
        if (isSensitiveKey(this.key)) {
            this.update("[REDACTED]");
            /**
             * This else if section deals with Liquibase logging the command line full syntax,
             * including passwords. The 'message' and 'stack' properties have escaped quotes,
             * so it's a slightly different regex match.
             * Note: we can't redact (stop) Liquibase's output to the console, but we can redact
             * everything going to our log files (e.g. activity.log and error.log).
             */
        } else if (this.key === 'cmd' || this.key === 'message' || this.key === 'stack') {
            let redactedText1 = value.replace(/--password="(.*?)"/gim, '--password=[REDACTED]');
            let redactedText2 = redactedText1.replace(/--referencePassword="(.*?)"/gim, '--referencePassword=[REDACTED]');
            //With escaped quotes:
            let redactedText3 = redactedText2.replace(/--password=\\"(.*?)\\"/gim, '--password=[REDACTED]');
            let redactedText4 = redactedText3.replace(/--referencePassword=\\"(.*?)\\"/gim, '--referencePassword=[REDACTED]');
            this.update(redactedText4);
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