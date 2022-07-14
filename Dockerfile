FROM node:14-slim
ENV NODE_ENV=production
WORKDIR /usr/speedtest

# Installs Chromium to run puppeteer
RUN apt-get update && apt-get install -yq chromium

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]

RUN npm install --production --silent && mv node_modules ../
COPY . .

# Creating our admin user
RUN  useradd -m admin && echo "admin:admin" |  chpasswd &&  usermod -aG root admin
RUN chown -R admin /usr/speedtest

# Starting application
CMD ["npm", "start"]
