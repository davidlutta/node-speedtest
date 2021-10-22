# Internet SpeedTest 

This application scrapes the download, upload speed and latency from fast.com using puppeteer and then visuzalizes the data using Grafana.

### prerequisites
1. influxdb version 1.8 not version 2. (You can also use docker for this)
3. chromium driver 

### Installation
1. clone the repo
2. Run `npm install` to install the packages
3. Create `.env` file and add: 
    - url to influxdb (On most computers is `http://localhost:8086`) as INFLUXDB_URL
    - influxdb username as INFLUXDB_USER
    - influxdb password as INFLUXDB_PASSWORD
4. Run `npm start` to start the script
5. You can then visualize the data using grafana.