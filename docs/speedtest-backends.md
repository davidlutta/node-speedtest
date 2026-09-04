# Investigation: replacing fast.com with Speedtest.net or another backend

**Status:** decided and implemented — the Ookla CLI is now the active backend.
LibreSpeed remains documented as the alternative if the Ookla licence terms
become a problem.
**Date:** 2026-09-04

## Why change anything?

The current approach launches headless Chromium, loads fast.com, and polls the
DOM for `#speed-value` / `#upload-value` / `#latency-value` until they gain a
`.succeeded` class. That works, but it has four structural problems on a Pi:

1. **Chromium dominates the resource budget.** It is ~400 MB of the image and the
   reason the container needs a 768 MB limit and a 256 MB `/dev/shm`. Every other
   option below is a single static binary of ~10 MB.
2. **It breaks silently when Netflix restyles the page.** The selectors are
   undocumented internals. A class rename turns into a `TypeError` on
   `null.textContent` every 15 minutes, and the only signal is the error log.
3. **fast.com deliberately reports less.** It is tuned to measure Netflix CDN
   throughput. There is no jitter, no packet loss, no server identity, and no
   result URL.
4. **Cold start is slow.** Launching Chromium and loading the page costs several
   seconds and a CPU spike before any measurement begins — noticeable on a Pi 3.

## Short answer

**Yes, Speedtest.net is entirely feasible, and it is the option I would pick.**
Ookla ships an official static CLI with `aarch64`, `armhf` **and** `armel`
builds — so unlike the current Node/InfluxDB images, it covers 32-bit Pis too.
It emits JSON directly, so the scrape-and-poll loop disappears.

## Options compared

| | **Ookla Speedtest CLI** | **LibreSpeed CLI** | **fast.com (current)** |
|---|---|---|---|
| How | Official static binary, `--format=json` | Official static Go binary, `--json` | Headless Chromium DOM scrape |
| Chromium needed | No | No | **Yes** |
| ARM support | aarch64, armhf, armel | arm64, armv7, armv6, armv5 | via distro Chromium (arm64/armv7) |
| Latest | 1.2.0 | v1.0.14 (Aug 2026) | n/a |
| Download / Upload | Yes | Yes | Yes |
| Ping | Yes | Yes | Yes |
| **Jitter** | Yes | Yes | No |
| **Packet loss** | Yes | No | No |
| **Server name / ID** | Yes | Yes | No |
| **Shareable result URL** | Yes | No | No |
| Stability of interface | High (documented, versioned) | High | **Low (undocumented DOM)** |
| Licence friction | EULA + GDPR acceptance on first run | None (LGPL) | None |
| Self-hostable servers | No | **Yes** | No |

### 1. Ookla Speedtest CLI — recommended

The official client behind speedtest.net. Verified available today:

```
https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-aarch64.tgz   200 OK
https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-armhf.tgz     200 OK
https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-armel.tgz     200 OK
```

Invocation is a single command returning one JSON object with download, upload,
ping, jitter, packet loss, ISP, server, and a result URL:

```
speedtest --accept-license --accept-gdpr --format=json
```

Integration shape: download and unpack the binary in the Dockerfile, then replace
the body of `src/api.js` with a `child_process.execFile` call that parses stdout.
`src/index.js` and `src/util/influx.js` would be untouched apart from mapping the
extra fields. Puppeteer, `zen-observable`, `delay` and the Chromium apt packages
all get deleted.

**Caveats.**
- **Version pinning is weak.** Only 1.2.0 is currently served on that path
  (1.2.1+ return 403), and Ookla replaces builds in place, so the Dockerfile
  should checksum what it downloads.
- **Licence acceptance is mandatory** and passing `--accept-license` is you
  accepting Ookla's EULA on every run. Read it before committing to this.
- **The `speedtest-net` npm wrapper is not worth using.** It was last published
  in 2022 and downloads the Ookla binary at *runtime* — which fails outright in
  this container, since the root filesystem is read-only. Call the binary directly.

### 2. LibreSpeed CLI — best if you dislike the EULA

Official Go client for the open-source LibreSpeed project. `v1.0.14` (Aug 2026)
publishes `linux_arm64`, `linux_armv7`, `linux_armv6` and `linux_armv5` tarballs,
so it has the broadest Pi coverage of anything here, and it is the only option you
can point at **your own server** — useful for measuring your LAN or a specific
link rather than general internet throughput. No licence prompt, no telemetry.

Trade-off: the public server list is community-run and less consistent than
Ookla's, so absolute numbers are noisier over time. No packet loss metric.

### 3. fast.com without a browser — not recommended

`fast-speedtest-api` reaches Netflix's underlying HTTP API and needs no Chromium,
which would keep results comparable with your existing history. But it was last
published in **2022**, and it requires a hard-coded API token that the user must
manually extract from fast.com's network tab; Netflix rotates it. That is strictly
more fragile than the current scrape, not less.

## Outcome

Ookla was implemented. Two things only became apparent by running it:

- **`bandwidth` is bytes/sec, not bits** — the conversion to Mbps is `× 8 / 1e6`.
- **`packetLoss` is often absent.** It is server dependent, and the Nairobi
  servers used in testing did not report it, so the field is written only when
  present rather than defaulted to zero.

## Recommendation

Move to the **Ookla Speedtest CLI**, unless the EULA is a problem for you — in
which case **LibreSpeed**. Either removes Chromium from the image entirely, which
is the single biggest win available for a Raspberry Pi deployment.

Worth knowing before you decide:

- **Results are not comparable across backends.** fast.com and Ookla measure
  different things against different servers. Your existing history will show a
  discontinuity at the switchover. Consider adding a `source` tag to the InfluxDB
  points so old and new data stay distinguishable on the same Grafana panel.
- **Running both is cheap and is a reasonable middle path** — keep fast.com for
  continuity and add Ookla for the richer metrics, tagged separately.
- **Schema impact.** Jitter, packet loss and server ID have no columns today.
  Adding them means extending the schema in `src/util/influx.js`; InfluxDB itself
  needs no migration, as new fields simply start appearing.
