# Internet SpeedTest

This application scrapes the download, upload speed and latency from fast.com using puppeteer and saves the data to InfluxDB for visualization with Grafana.

## Features

- **Production Ready**: Optimized Docker containers with security best practices
- **Health Checks**: Built-in health monitoring for all services
- **Resource Management**: Memory and CPU limits configured
- **Security**: Non-root user execution, read-only containers, no-new-privileges
- **Latest Dependencies**: All Node.js packages updated to latest stable versions
- **Environment Configuration**: Configurable via environment variables
- **Graceful Shutdown**: Proper signal handling for clean shutdowns

## Prerequisites

1. Docker and Docker Compose
2. Node.js 18+ (for local development)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd node-speedtest
   ```

2. Create `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

3. Configure environment variables in `.env`:
   ```env
   INFLUXDB_PORT=8086
   INFLUXDB_USER=admin
   INFLUXDB_PASSWORD=your_secure_password_here
   GRAFANA_PASSWORD=your_secure_grafana_password_here
   NODE_ENV=production
   CRON_SCHEDULE=*/15 * * * *
   SPEEDTEST_HOST_TAG=production-server
   ```

4. Start the application:
   ```bash
   docker compose up -d
   ```

## Services

- **SpeedTest App**: Runs speed tests every 15 minutes (configurable)
- **InfluxDB 2.7**: Time-series database for storing speed test results
- **Grafana 10.2**: Dashboard for visualizing speed test data

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `INFLUXDB_PORT` | InfluxDB port | `8086` |
| `INFLUXDB_USER` | InfluxDB admin username | `admin` |
| `INFLUXDB_PASSWORD` | InfluxDB admin password | Required |
| `GRAFANA_PASSWORD` | Grafana admin password | `admin123` |
| `CRON_SCHEDULE` | Cron schedule for speed tests | `*/15 * * * *` |
| `SPEEDTEST_HOST_TAG` | Host tag for InfluxDB measurements | hostname |

## Accessing Services

- **Grafana Dashboard**: http://localhost:4567 (admin/GRAFANA_PASSWORD)
- **InfluxDB**: http://localhost:8086

## Production Deployment

This setup is production-ready with:
- Security optimizations (non-root users, read-only containers)
- Health checks for all services
- Resource limits and reservations
- Proper data persistence with named volumes
- Graceful shutdown handling

## Development

For local development:
```bash
npm install
npm start
```

## Monitoring

All services include health checks:
- **SpeedTest App**: Node.js health check every 30s
- **InfluxDB**: Database ping every 30s
- **Grafana**: API health check every 30s