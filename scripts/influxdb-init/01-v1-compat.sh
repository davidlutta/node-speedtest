#!/bin/bash
set -euo pipefail

# The application talks to InfluxDB through the node `influx` v5 client, which
# only speaks the InfluxDB 1.x API. InfluxDB 2.x serves that API, but it needs
# two things that `influx setup` does not create:
#
#   1. a DBRP mapping, so a 1.x "database" name resolves to a 2.x bucket
#   2. a v1 auth user, because 2.x admin credentials are NOT accepted by the
#      1.x compatibility endpoints
#
# The influxdb image runs this once, on first start only, via run-parts over
# /docker-entrypoint-initdb.d -- after `influx setup` has completed. The
# entrypoint exports DOCKER_INFLUXDB_INIT_* (including the resolved bucket id)
# and points INFLUX_HOST at the temporary init server, so the CLI calls below
# are already addressed correctly.

V1_DATABASE="${INFLUXDB_DATABASE:-internetspeed}"
V1_USER="${INFLUXDB_USER:?INFLUXDB_USER must be set}"
V1_PASSWORD="${INFLUXDB_PASSWORD:?INFLUXDB_PASSWORD must be set (min 8 characters)}"
BUCKET_ID="${DOCKER_INFLUXDB_INIT_BUCKET_ID:?bucket id not exported by entrypoint}"
ORG="${DOCKER_INFLUXDB_INIT_ORG:?DOCKER_INFLUXDB_INIT_ORG must be set}"
TOKEN="${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN:?DOCKER_INFLUXDB_INIT_ADMIN_TOKEN must be set}"

echo "[v1-compat] mapping 1.x database '${V1_DATABASE}' -> bucket id ${BUCKET_ID}"
influx v1 dbrp create \
  --org "${ORG}" \
  --token "${TOKEN}" \
  --db "${V1_DATABASE}" \
  --rp autogen \
  --bucket-id "${BUCKET_ID}" \
  --default

echo "[v1-compat] creating v1 auth user '${V1_USER}'"
influx v1 auth create \
  --org "${ORG}" \
  --token "${TOKEN}" \
  --username "${V1_USER}" \
  --password "${V1_PASSWORD}" \
  --read-bucket "${BUCKET_ID}" \
  --write-bucket "${BUCKET_ID}"

echo "[v1-compat] done -- 1.x clients can now use db='${V1_DATABASE}' with user '${V1_USER}'"
