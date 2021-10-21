const api = require('./api.js')
require('dotenv').config()
const Influx = require("influx");

const INFLUX_URL = process.env.INFLUX_URL
const INFLUX_USERNAME = process.env.INFLUXDB_USER
const INFLUX_PASSWORD = process.env.INFLUXDB_PASSWORD

const influx = new Influx.InfluxDB({
    url: INFLUX_URL,
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

function writePoints(downloadSpeed, uploadSpeed, ping) {
    influx.writePoints([
        {
            measurement: 'internetspeed',
            tags: { host: "DavidEzekiel"},
            fields: {
                downloadSpeed: downloadSpeed,
                uploadSpeed: uploadSpeed,
                ping: ping
            }
        }
    ]).catch(err => {
        console.error(`Error saving data to influxDB: ${err}`);
    })   
}

const main = () =>{
    api().forEach(
        result =>{
            if(result.isDone){
                writePoints(downloadSpeed=result.downloadSpeed,
                    uploadSpeed=result.uploadSpeed,
                    ping=result.latency);
            }
        }
    );
}
main()