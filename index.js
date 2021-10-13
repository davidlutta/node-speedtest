const {promises: dns} = require('dns');
const { exit } = require('process');
const api = require('./api.js')
require('dotenv').config()
const { InfluxDB, Point} = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL
const token = process.env.INFLUX_TOKEN
const org = process.env.INFLUX_ORG
const bucket = process.env.INFLUX_BUCKET

try {
    const influxdbClient = new InfluxDB({url: url, token: token})
    const writeApi = influxdbClient.getWriteApi(org,bucket)
    writeApi.useDefaultTags({host: 'host1'})

    writeApi.writePoint(
        new Point('download')
        .floatField('mbps', 20.7)
        );
    writeApi.close()
            .then(()=>{
                console.log("FINISHED");
            })
            .catch(err=>{
                console.error(err.code);
            });
} catch (error) {
    console.error(error);
}

const main = async() =>{
    try{
        await dns.lookup('https://fast.com')

        api().forEach(
            result =>{
                if(result.isDone){
                    console.log("Download Speed: ", result.downloadSpeed);
                    console.log("Upload Speed: ", result.uploadSpeed);
                }
            }
        )
    } catch(err){
        console.error("An Error occured\nMessage: "+err.code);
        exit();
    }
}
// main()