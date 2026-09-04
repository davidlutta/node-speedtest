'use strict';

const {execFile} = require('child_process');
const {promisify} = require('util');
const {logger} = require('./util/logger.js');

const execFileAsync = promisify(execFile);

const SPEEDTEST_BIN = process.env.SPEEDTEST_BIN || 'speedtest';
const TEST_TIMEOUT_MS = Number(process.env.SPEEDTEST_TIMEOUT_MS) || 120000;

// The Ookla CLI reports bandwidth in BYTES per second, not bits.
const BYTES_PER_SEC_TO_MBPS = 8 / 1e6;

/**
 * Works out which servers to test against.
 *
 * SPEEDTEST_SERVERS holds a comma separated list of `label:id` pairs, e.g.
 *   Nairobi:14389,Frankfurt:31448
 * Falling back to the single SPEEDTEST_SERVER_ID, and finally to letting the
 * CLI pick the nearest server itself.
 *
 * @returns {Array<{region: string, serverId: (string|null)}>}
 */
function resolveTargets() {
	const spec = (process.env.SPEEDTEST_SERVERS || '').trim();

	if (spec) {
		return spec.split(',').map(entry => entry.trim()).filter(Boolean).map(entry => {
			// Split on the last colon so labels may contain one.
			const separator = entry.lastIndexOf(':');
			if (separator === -1) {
				return {region: entry, serverId: entry};
			}
			return {
				region: entry.slice(0, separator).trim(),
				serverId: entry.slice(separator + 1).trim()
			};
		});
	}

	if (process.env.SPEEDTEST_SERVER_ID) {
		return [{
			region: process.env.SPEEDTEST_SERVER_REGION || 'pinned',
			serverId: process.env.SPEEDTEST_SERVER_ID
		}];
	}

	return [{region: 'auto', serverId: null}];
}

/**
 * Runs the Ookla Speedtest CLI once against a single server.
 *
 * @param {{region: string, serverId: (string|null)}} target the server to test
 * @returns {Promise<object>} the parsed speed test result
 */
async function runOnce(target) {
	// --accept-license / --accept-gdpr are required for unattended runs; without
	// them the CLI blocks waiting for input on first use.
	const args = ['--accept-license', '--accept-gdpr', '--format=json'];
	if (target.serverId) {
		args.push('--server-id', target.serverId);
	}

	const {stdout} = await execFileAsync(SPEEDTEST_BIN, args, {
		timeout: TEST_TIMEOUT_MS,
		maxBuffer: 1024 * 1024
	});

	// The CLI emits one JSON object per line (progress logs, warnings, then the
	// final result). Only the entry of type "result" carries the measurements.
	const payload = stdout
		.split('\n')
		.map(line => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		})
		.filter(Boolean)
		.find(entry => entry.type === 'result');

	if (!payload) {
		throw new Error('Speedtest CLI returned no result object');
	}

	const server = payload.server || {};

	return {
		region: target.region,
		downloadSpeed: payload.download.bandwidth * BYTES_PER_SEC_TO_MBPS,
		uploadSpeed: payload.upload.bandwidth * BYTES_PER_SEC_TO_MBPS,
		latency: payload.ping.latency,
		jitter: payload.ping.jitter,
		// Only reported when the selected server supports the measurement.
		packetLoss: typeof payload.packetLoss === 'number' ? payload.packetLoss : null,
		serverName: [server.name, server.location].filter(Boolean).join(', '),
		isp: payload.isp,
		resultUrl: payload.result && payload.result.url,
		isDone: true
	};
}

/**
 * Runs a speed test against every configured server, in sequence so the tests
 * do not compete for the same connection.
 *
 * A server that fails is logged and skipped rather than aborting the run, so
 * one unreachable region cannot cost you the other measurements.
 *
 * @returns {Promise<Array<object>>} one result per server that succeeded
 */
module.exports = async () => {
	const targets = resolveTargets();
	const results = [];

	for (const target of targets) {
		try {
			// eslint-disable-next-line no-await-in-loop
			results.push(await runOnce(target));
		} catch (error) {
			logger.error(`Speed test against '${target.region}' failed: ${error.message}`);
		}
	}

	if (results.length === 0) {
		throw new Error('All speed tests failed');
	}

	return results;
};
