# Internet SpeedTest 

This application scrapes the download, upload speed and latency from fast.com using puppeteer and then visuzalizes the data using Grafana.

### prerequisites
1. Docker

### Installation
1. clone the repo.
2. Create `.env` file and add the following variables:
 - INFLUXDB_PORT
 - INFLUXDB_USER
 - INFLUXDB_PASSWORD
3. Run `docker compose up` to build and run the containers.