const api = require('./api.js');
const { logger } = require('./util/logger.js');
const { influx } = require('./util/influx.js'); 
const CronJob = require('cron').CronJob;

//cron job schedule to run every 15 minutes.
let CRON_SCHEDULE = '*/15 * * * *';

// checking if the database already exists if not we create it.
influx.getDatabaseNames()
.then(names => {
    if (!names.includes('internetspeed')) {
        logger.info("Creating the database")
        return influx.createDatabase('internetspeed');
    }
}).catch(err => logg(`Error fetching DBs: ${err}`));

/**
 * This method writes the points to the database.
 * @param {number} downloadSpeed download speed from test
 * @param {number} uploadSpeed the upload speed from the test
 * @param {number} ping the ping from the test
 */
function writePoints(downloadSpeed, uploadSpeed, ping) {
    // console.log(`${new Date().toLocaleTimeString()}: DEBUG: Fetched Data`);
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
    ]).then(res =>{
        console.log(`${new Date().toLocaleTimeString()}: Written to DB`)
    }).catch(err => {
        logger.error(`Error saving data to influxDB: ${err}`);
    });
}

// Main application function
function main() {
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

let job = new CronJob(
    CRON_SCHEDULE,
    main,
    function onComplete() {
        logger.info(`Completed Cron Job`);
    },
    false,
    'Africa/Nairobi'
)

// Starting job
job.start();
