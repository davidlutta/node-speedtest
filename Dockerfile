# Base image is overridable so the same Dockerfile builds for both Pi families:
#   arm64 / amd64 (Raspberry Pi OS 64-bit)  -> node:24-trixie-slim   (Active LTS)
#   armv7         (Raspberry Pi OS 32-bit)  -> node:22-bookworm-slim (last line with armv7 images)
# Override with:  docker build --build-arg NODE_IMAGE=node:22-bookworm-slim .
ARG NODE_IMAGE=node:24-trixie-slim

# ---------------------------------------------------------------------------
# Stage 1: fetch the Ookla Speedtest CLI
#
# Ookla replaces builds in place and only serves 1.2.0 on this path, so the
# tarball is checksum-verified. curl stays in this stage and never reaches the
# runtime image.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS speedtest-cli

ARG SPEEDTEST_VERSION=1.2.0
# Populated automatically by BuildKit (amd64 | arm64 | arm).
ARG TARGETARCH

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) OOKLA_ARCH=x86_64;  SHA256=5690596c54ff9bed63fa3732f818a05dbc2db19ad36ed68f21ca5f64d5cfeeb7 ;; \
      arm64) OOKLA_ARCH=aarch64; SHA256=3953d231da3783e2bf8904b6dd72767c5c6e533e163d3742fd0437affa431bd3 ;; \
      arm)   OOKLA_ARCH=armhf;   SHA256=e45fcdebbd8a185553535533dd032d6b10bc8c64eee4139b1147b9c09835d08d ;; \
      *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/speedtest.tgz \
      "https://install.speedtest.net/app/cli/ookla-speedtest-${SPEEDTEST_VERSION}-linux-${OOKLA_ARCH}.tgz"; \
    echo "${SHA256}  /tmp/speedtest.tgz" | sha256sum -c -; \
    tar -xzf /tmp/speedtest.tgz -C /usr/local/bin speedtest; \
    rm /tmp/speedtest.tgz; \
    chmod +x /usr/local/bin/speedtest; \
    /usr/local/bin/speedtest --version

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE}

LABEL org.opencontainers.image.title="node-speedtest" \
      org.opencontainers.image.description="Runs Ookla Speedtest CLI on a schedule and stores results in InfluxDB" \
      org.opencontainers.image.source="https://github.com/davidlutta/node-speedtest" \
      org.opencontainers.image.licenses="ISC"

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# ca-certificates for TLS to the Ookla servers, procps for the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    procps \
    && rm -rf /var/lib/apt/lists/*

COPY --from=speedtest-cli /usr/local/bin/speedtest /usr/local/bin/speedtest

# The CLI writes its settings under $HOME. The root filesystem is read-only, so
# point HOME at the tmpfs -- otherwise every run logs a "Failed to save
# settings" error (non-fatal, but it drowns the logs).
ENV HOME=/tmp

# Copy package files
COPY package*.json ./

# Install only production dependencies (--only=production is deprecated)
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy application code
COPY src/ ./src/

# Create non-root user for security
RUN groupadd -r speedtest && useradd -r -g speedtest -s /bin/false speedtest

# Change ownership of the app directory
RUN chown -R speedtest:speedtest /usr/src/app

# Switch to non-root user
USER speedtest

# Verify the scheduler process is actually alive. There is no HTTP server to
# probe -- this is a cron-driven batch job.
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "src/index.js" > /dev/null || exit 1

# Start the application
CMD ["npm", "start"]
