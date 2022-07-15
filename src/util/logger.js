'use strict';

const {createLogger, transports, format} = require('winston');

/**
 * Winston logger instance.
 */
const logger = createLogger({
    transports:[
        new transports.Console({
            level: "info",
            format: format.combine(format.timestamp(), format.json())
        }),
        new transports.File({
            filename: "error.log",
            level: "error",
            format: format.combine(format.timestamp(), format.json())
        })
    ]
})

module.exports = {logger};