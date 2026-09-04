'use strict';

const Influx = require("influx");
require('dotenv').config({quiet: true})

// influx db constants
// Against InfluxDB 2.x these credentials are the *v1-compatibility* user created
// by scripts/influxdb-init/01-v1-compat.sh, not the 2.x admin account.
const INFLUX_PORT = Number(process.env.INFLUXDB_PORT) || 8086;
const INFLUX_URL = process.env.INFLUX_URL || 'localhost'
const INFLUX_DATABASE = process.env.INFLUXDB_DATABASE || 'internetspeed'
const INFLUX_USERNAME = process.env.INFLUXDB_USER
const INFLUX_PASSWORD = process.env.INFLUXDB_PASSWORD

/**
 * InfluxDB instance.
 */
const influx = new Influx.InfluxDB({
    host: INFLUX_URL,
    port:INFLUX_PORT,
    database: INFLUX_DATABASE,
    username: INFLUX_USERNAME,
    password: INFLUX_PASSWORD,
    schema:[
        {
            measurement: "internetspeed",
            tags: [
                'host',
                'source',
                'region'
            ],
            fields:{
                "downloadSpeed": Influx.FieldType.FLOAT,
                "uploadSpeed": Influx.FieldType.FLOAT,
                "ping": Influx.FieldType.FLOAT,
                "jitter": Influx.FieldType.FLOAT,
                "packetLoss": Influx.FieldType.FLOAT
            }
        }
    ]
});

module.exports = {influx, INFLUX_DATABASE};
