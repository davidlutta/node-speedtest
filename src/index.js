const api = require('./api.js');
const { logger } = require('./util/logger.js');
const { influx, INFLUX_DATABASE } = require('./util/influx.js');
const CronJob = require('cron').CronJob;
require('dotenv').config({quiet: true});

// Load configuration from environment variables
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';
const HOST_TAG = process.env.SPEEDTEST_HOST_TAG || require('os').hostname();
const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'Africa/Nairobi';
// InfluxDB 2.x forbids CREATE DATABASE over the 1.x compatibility API; the bucket
// and its DBRP mapping are provisioned by the container's init scripts instead.
// Set INFLUX_MANAGE_DB=true only when pointing at an InfluxDB 1.x server.
const INFLUX_MANAGE_DB = process.env.INFLUX_MANAGE_DB === 'true';
// Tags each point with the backend that produced it, so results from the old
// fast.com scraper stay distinguishable from Ookla ones on the same panel.
const SPEEDTEST_SOURCE = process.env.SPEEDTEST_SOURCE || 'ookla';

// checking if the database already exists if not we create it.
if (INFLUX_MANAGE_DB) {
    influx.getDatabaseNames()
    .then(names => {
        if (!names.includes(INFLUX_DATABASE)) {
            logger.info("Creating the database")
            return influx.createDatabase(INFLUX_DATABASE);
        }
    }).catch(err => logger.error(`Error fetching DBs: ${err}`));
} else {
    influx.ping(5000)
    .then(hosts => {
        const online = hosts.filter(host => host.online).length;
        logger.info(`InfluxDB reachable (${online}/${hosts.length} hosts online), using database '${INFLUX_DATABASE}'`);
    }).catch(err => logger.error(`Error reaching InfluxDB: ${err}`));
}

/**
 * This method writes the points to the database.
 * @param {object} result a completed speed test result
 */
function writePoints(result) {
    const downloadSpeed = result.downloadSpeed;
    const uploadSpeed = result.uploadSpeed;
    const ping = result.latency;

    logger.info(`[${result.region}] Down=${downloadSpeed.toFixed(2)}Mbps, Up=${uploadSpeed.toFixed(2)}Mbps, Ping=${ping}ms (${result.serverName || 'unknown server'})`);
    if (result.resultUrl) {
        logger.info(`Speedtest result: ${result.resultUrl}`);
    }

    const fields = {
        downloadSpeed: downloadSpeed,
        uploadSpeed: uploadSpeed,
        ping: ping
    };
    // Only recorded when the CLI reports them; packet loss is server dependent.
    if (typeof result.jitter === 'number') {
        fields.jitter = result.jitter;
    }
    if (typeof result.packetLoss === 'number') {
        fields.packetLoss = result.packetLoss;
    }

    influx.writePoints([
        {
            measurement: 'internetspeed',
            tags: { host: HOST_TAG, source: SPEEDTEST_SOURCE, region: result.region || 'auto' },
            fields: fields
        }
    ]).then(() => {
        logger.info(`Successfully written to database (${result.region})`);
    }).catch(err => {
        logger.error(`Error saving data to influxDB: ${err}`);
    });
}

// Guards against overlapping runs: a multi-region cycle can take several
// minutes, and cron fires on schedule regardless of whether the last run
// finished. Overlapping tests compete for the same line and skew each other.
let running = false;

// Main application function
async function main() {
    if (running) {
        logger.warn('Previous speed test still running, skipping this tick');
        return;
    }
    running = true;
    try {
        logger.info('Starting speed test...');
        const results = await api();
        results.forEach(result => {
            if (result.isDone) {
                writePoints(result);
            }
        });
    } catch (error) {
        logger.error(`Error during speed test: ${error.message}`);
    } finally {
        running = false;
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
    CRON_TIMEZONE
);

logger.info(`Starting speedtest application with cron schedule: ${CRON_SCHEDULE}`);
logger.info(`Using host tag: ${HOST_TAG} (timezone: ${CRON_TIMEZONE})`);

// Starting job
job.start();
