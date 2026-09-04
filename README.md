# Internet SpeedTest

Runs the official [Ookla Speedtest CLI](https://www.speedtest.net/apps/cli) on a
schedule, against one or more servers around the world, and stores download
speed, upload speed, latency and jitter in InfluxDB for visualisation with
Grafana.

Testing several regions separates *your line* from *international transit*: if
Nairobi is fast but Frankfurt is slow, the problem is upstream of you, not your
ISP's last mile.

Designed to run continuously on a Raspberry Pi via Docker Compose.

## Requirements

| | |
|---|---|
| Hardware | Raspberry Pi 3 / 4 / 5 / Zero 2 W (see [Architecture](#architecture)) |
| OS | **Raspberry Pi OS 64-bit strongly recommended** |
| Software | Docker Engine + Compose v2 |
| Node.js | 22.12+ (only for running outside Docker) |

## Architecture

Check your Pi with `uname -m`:

| `uname -m` | Arch | Supported? |
|---|---|---|
| `aarch64` | arm64 | **Yes — full stack.** Node 24 LTS, InfluxDB 2.9, Grafana 13. |
| `armv7l` | armv7 (32-bit) | **Partially.** See below. |

### Running on 32-bit Raspberry Pi OS (armv7)

Node 24 and InfluxDB 2.x **no longer publish 32-bit ARM images**. If you are on a
32-bit OS:

1. Build the app against the last Node line with armv7 images:
   ```bash
   echo "NODE_IMAGE=node:22-bookworm-slim" >> .env
   ```
2. **InfluxDB cannot run locally** — there is no armv7 image for 2.x. Remove the
   `influxdb` service from `docker-compose.yml` and point the app at an InfluxDB
   running elsewhere by setting `INFLUX_URL` / `INFLUXDB_PORT` in `.env`.

Reimaging to 64-bit Raspberry Pi OS avoids both problems and is the recommended path.

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd node-speedtest
   ```

2. Create your `.env`:
   ```bash
   cp .env.example .env
   ```

3. Fill in the secrets. The InfluxDB password must be **at least 8 characters**,
   and the admin token should be random:
   ```bash
   openssl rand -hex 32   # use this for INFLUXDB_ADMIN_TOKEN
   ```

4. Build and start:
   ```bash
   docker compose up -d --build
   ```

5. Watch the first run:
   ```bash
   docker compose logs -f speedtest
   ```

## Services

| Service | Image | Purpose |
|---|---|---|
| `speedtest` | built locally | Runs an Ookla speed test on a cron schedule |
| `influxdb` | `influxdb:2.9.1-alpine` | Time-series storage |
| `grafana` | `grafana/grafana:13.2.1` | Dashboards |

- **Grafana**: http://\<pi-address\>:4567 — log in as `admin` with `GRAFANA_PASSWORD`
- **InfluxDB**: http://\<pi-address\>:8086

### Dashboards

The InfluxDB datasource **and** a pre-built dashboard are provisioned
automatically from `grafana/` -- there is nothing to configure by hand. Log in
and the *Internet Speed* dashboard is already the home page.

It shows, per region: latest download / upload / latency / jitter tiles, a time
series for each of those four metrics, and a table of recent runs. The **Host**
and **Region** dropdowns at the top filter every panel.

> Data written before regions were introduced has an empty `region` tag and will
> appear as an unlabelled series. Use the Region dropdown to exclude it.

The datasource must use **InfluxQL**, not Flux, because the app writes through
InfluxDB's 1.x compatibility API. The provisioning file already does this.

To edit the dashboard, change it in the UI and it will persist; to make a change
permanent, export the JSON over `grafana/dashboards/speedtest.json`.

## How the InfluxDB connection works

The application uses the `influx` npm client, which speaks the **InfluxDB 1.x
API**. InfluxDB 2.x still serves that API, but it needs two things that the
default setup does not create:

1. a **DBRP mapping**, so the 1.x database name `internetspeed` resolves to the
   2.x bucket of the same name;
2. a **v1 auth user**, because 2.x admin credentials are rejected by the 1.x
   compatibility endpoints.

Both are provisioned on first start by `scripts/influxdb-init/01-v1-compat.sh`,
which the InfluxDB container runs from `/docker-entrypoint-initdb.d`.

> Because InfluxDB 2.x forbids `CREATE DATABASE` over the compatibility API, the
> app only attempts to create the database when `INFLUX_MANAGE_DB=true`. Leave it
> `false` for InfluxDB 2.x; set it `true` only against a legacy 1.x server.

If you ever need to recreate the mapping by hand:

```bash
docker compose exec influxdb influx v1 dbrp list
docker compose exec influxdb influx v1 auth list
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INFLUXDB_USER` | InfluxDB admin **and** v1-compat username | `admin` |
| `INFLUXDB_PASSWORD` | Password (min 8 chars) | Required |
| `INFLUXDB_ADMIN_TOKEN` | InfluxDB 2.x admin API token | Required |
| `INFLUXDB_ORG` | InfluxDB organisation | `speedtest` |
| `INFLUXDB_DATABASE` | Bucket / 1.x database name | `internetspeed` |
| `INFLUXDB_RETENTION` | How long to keep data | `52w` |
| `INFLUXDB_PORT` | InfluxDB port | `8086` |
| `INFLUX_URL` | InfluxDB host | `influxdb` |
| `INFLUX_MANAGE_DB` | Let the app `CREATE DATABASE` (1.x only) | `false` |
| `GRAFANA_PASSWORD` | Grafana admin password | `admin123` |
| `CRON_SCHEDULE` | Cron schedule for speed tests | `0 */4 * * *` |
| `CRON_TIMEZONE` | Timezone the schedule is evaluated in | `Africa/Nairobi` |
| `SPEEDTEST_HOST_TAG` | Host tag on InfluxDB points | hostname |
| `SPEEDTEST_TIMEOUT_MS` | Abort a test that overruns this | `120000` |
| `SPEEDTEST_SERVERS` | `label:id` pairs, comma separated; each tested per tick | 5 regions |
| `SPEEDTEST_SERVER_ID` | Single-server fallback when the above is blank | auto |
| `SPEEDTEST_SOURCE` | Value of the `source` tag on each point | `ookla` |
| `SPEEDTEST_BIN` | Path to the Speedtest CLI | `speedtest` |
| `LOG_FILE` | Error-log path; empty disables the file | `/tmp/error.log` |
| `LOG_LEVEL` | Console log level | `info` |
| `NODE_IMAGE` | Base image for the build | `node:24-trixie-slim` |

## Raspberry Pi notes

- **Use 64-bit Raspberry Pi OS.** See [Architecture](#architecture).
- **Memory.** The app container is limited to 256 MB and idles far below that, so
  even a 1 GB Pi 3 or Zero 2 W is comfortable.
- **Run from an SSD if you can.** SD cards wear out under a database writing every
  15 minutes. If you must use an SD card, consider a longer `CRON_SCHEDULE`.
- **The Ookla CLI is a 2.5 MB static binary**, downloaded and checksum-verified at
  build time for the target architecture. No browser is involved.
- **Interval.** See [Data usage](#data-usage) before shortening `CRON_SCHEDULE`
  -- with five regions the defaults already move ~4 GB/day.

## Development

```bash
npm install
# Requires the Ookla CLI on your PATH: https://www.speedtest.net/apps/cli
# Override the location with SPEEDTEST_BIN if it is not called `speedtest`.
npm start
```

Debugging inside Docker (exposes the Node inspector on 9229):

```bash
docker compose -f docker-compose.yml -f docker-compose.debug.yml up
```

## Monitoring

All three services define health checks. The `speedtest` container has no HTTP
server, so its check verifies the scheduler process is alive:

```bash
docker compose ps          # health status of each service
docker compose logs -f     # structured JSON logs
```

## Licensing note

The application passes `--accept-license --accept-gdpr` on every run, which
accepts Ookla's [EULA](https://www.speedtest.net/about/eula),
[Terms](https://www.speedtest.net/about/terms) and
[Privacy Policy](https://www.speedtest.net/about/privacy) unattended. Ookla
licenses the CLI for **personal, non-commercial use**. Review those terms before
deploying this anywhere commercial.

Each run also uploads a result to Ookla and produces a public result URL, which
is written to the logs.

## Choosing servers

`SPEEDTEST_SERVERS` is a comma separated list of `label:id` pairs. Every server
is tested once per cron tick, in sequence, and tagged with its label. A server
that fails is logged and skipped, so one unreachable region does not cost you
the others.

The default set, all verified reachable from Nairobi:

| Label | ID | Server | Typical latency |
|---|---|---|---|
| `Nairobi` | 14389 | Jamii Telecommunications | ~3 ms |
| `Johannesburg` | 23339 | inq. | ~57 ms |
| `Frankfurt` | 31448 | Deutsche Telekom | ~170 ms |
| `Dubai` | 17336 | e& UAE | ~200 ms |
| `Ashburn` | 14229 | Frontier (US East) | ~255 ms |

To find others:

```bash
# nearest servers
docker compose exec speedtest speedtest --servers

# anywhere in the world, by city
curl -s "https://www.speedtest.net/api/js/servers?engine=js&search=Singapore&limit=5"
```

Leave `SPEEDTEST_SERVERS` blank to fall back to `SPEEDTEST_SERVER_ID`, or leave
both blank to let the CLI auto-select the nearest server each run.

## Data usage

**This matters.** Each speed test moves roughly **130 MB**. With five servers
that is about **655 MB per cycle**:

| `CRON_SCHEDULE` | Cycles/day | Per day | Per month |
|---|---|---|---|
| `0 */4 * * *` (default) | 6 | ~3.9 GB | ~118 GB |
| `0 * * * *` (hourly) | 24 | ~16 GB | ~470 GB |
| `*/15 * * * *` | 96 | ~63 GB | **~1.9 TB** |

The default is every 4 hours for this reason. On a metered or capped connection,
reduce the server list or widen the schedule before anything else.

A full five-region cycle takes roughly 3-4 minutes. If the schedule fires again
before the previous cycle finishes, the new tick is skipped and logged rather
than run concurrently -- overlapping tests compete for the same line and would
skew each other's numbers.

## Alternative backends

See **[docs/speedtest-backends.md](docs/speedtest-backends.md)** for how Ookla was
chosen, and for LibreSpeed as an alternative if the Ookla licence terms are a
problem for your use.
