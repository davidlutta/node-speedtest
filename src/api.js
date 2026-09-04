'use strict';

const {execFile} = require('child_process');
const {promisify} = require('util');

const execFileAsync = promisify(execFile);

const SPEEDTEST_BIN = process.env.SPEEDTEST_BIN || 'speedtest';
const TEST_TIMEOUT_MS = Number(process.env.SPEEDTEST_TIMEOUT_MS) || 120000;

// The Ookla CLI reports bandwidth in BYTES per second, not bits.
const BYTES_PER_SEC_TO_MBPS = 8 / 1e6;

function buildArgs() {
	// --accept-license / --accept-gdpr are required for unattended runs; without
	// them the CLI blocks waiting for input on first use.
	const args = ['--accept-license', '--accept-gdpr', '--format=json'];

	// Optional: pin to one server so results are comparable over time.
	// Discover ids with: docker compose exec speedtest speedtest --servers
	if (process.env.SPEEDTEST_SERVER_ID) {
		args.push('--server-id', process.env.SPEEDTEST_SERVER_ID);
	}

	return args;
}

/**
 * Runs the Ookla Speedtest CLI once.
 *
 * Resolves to an array holding a single result so callers can iterate the
 * results exactly as before.
 *
 * @returns {Promise<Array<object>>} the parsed speed test result
 */
module.exports = async () => {
	const {stdout} = await execFileAsync(SPEEDTEST_BIN, buildArgs(), {
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

	return [{
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
	}];
};
