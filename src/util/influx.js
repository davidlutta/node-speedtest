'use strict';

const Influx = require("influx");
require('dotenv').config()

// influx db constants
const INFLUX_PORT = process.env.INFLUXDB_PORT;
const INFLUX_URL = process.env.INFLUX_URL
const INFLUX_USERNAME = process.env.INFLUXDB_USER
const INFLUX_PASSWORD = process.env.INFLUXDB_PASSWORD

/**
 * InfluxDB instance.
 */
const influx = new Influx.InfluxDB({
    host: INFLUX_URL,
    port:INFLUX_PORT,
    database: "internetspeed",
    username: INFLUX_USERNAME,
    password: INFLUX_PASSWORD,
    schema:[
        {
            measurement: "internetspeed",
            tags: [
                'host'
            ],
            fields:{
                "downloadSpeed": Influx.FieldType.FLOAT,
                "uploadSpeed": Influx.FieldType.FLOAT,
                "ping": Influx.FieldType.FLOAT
            }
        }
    ]
});

module.exports = {influx};