'use strict';

const {createLogger, transports, format} = require('winston');

// The container runs with a read-only root filesystem, so the error log has to
// live on a writable mount (/tmp is a tmpfs). Set LOG_FILE='' to disable it.
const LOG_FILE = process.env.LOG_FILE === undefined ? 'error.log' : process.env.LOG_FILE;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const activeTransports = [
    new transports.Console({
        level: LOG_LEVEL,
        format: format.combine(format.timestamp(), format.json())
    })
];

if (LOG_FILE) {
    activeTransports.push(new transports.File({
        filename: LOG_FILE,
        level: "error",
        format: format.combine(format.timestamp(), format.json())
    }));
}

/**
 * Winston logger instance.
 */
const logger = createLogger({
    transports: activeTransports
})

module.exports = {logger};
