const api = require('./api.js');
const { logger } = require('./util/logger.js');
const { influx } = require('./util/influx.js');
const CronJob = require('cron').CronJob;
require('dotenv').config();

// Load configuration from environment variables
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';
const HOST_TAG = process.env.SPEEDTEST_HOST_TAG || require('os').hostname();

// checking if the database already exists if not we create it.
influx.getDatabaseNames()
.then(names => {
    if (!names.includes('internetspeed')) {
        logger.info("Creating the database")
        return influx.createDatabase('internetspeed');
    }
}).catch(err => logger.error(`Error fetching DBs: ${err}`));

/**
 * This method writes the points to the database.
 * @param {number} downloadSpeed download speed from test
 * @param {number} uploadSpeed the upload speed from the test
 * @param {number} ping the ping from the test
 */
function writePoints(downloadSpeed, uploadSpeed, ping) {
    logger.info(`Recording speed test results: Down=${downloadSpeed}Mbps, Up=${uploadSpeed}Mbps, Ping=${ping}ms`);
    influx.writePoints([
        {
            measurement: 'internetspeed',
            tags: { host: HOST_TAG },
            fields: {
                downloadSpeed: downloadSpeed,
                uploadSpeed: uploadSpeed,
                ping: ping
            }
        }
    ]).then(result => {
        logger.info("Successfully written to database");
    }).catch(err => {
        logger.error(`Error saving data to influxDB: ${err}`);
    });
}

// Main application function
async function main() {
    try {
        logger.info('Starting speed test...');
        const results = await api();
        results.forEach(result => {
            if (result.isDone) {
                writePoints(
                    result.downloadSpeed,
                    result.uploadSpeed,
                    result.latency
                );
            }
        });
    } catch (error) {
        logger.error(`Error during speed test: ${error.message}`);
    }
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (job) {
        job.stop();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (job) {
        job.stop();
    }
    process.exit(0);
});

let job = new CronJob(
    CRON_SCHEDULE,
    main,
    function onComplete() {
        logger.info(`Completed cron job at ${new Date().toISOString()}`);
    },
    false,
    'Africa/Nairobi'
);

logger.info(`Starting speedtest application with cron schedule: ${CRON_SCHEDULE}`);
logger.info(`Using host tag: ${HOST_TAG}`);

// Starting job
job.start();
