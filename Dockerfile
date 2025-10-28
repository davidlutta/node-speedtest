# Use the official Node.js LTS image
FROM node:18-slim

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create app directory
WORKDIR /usr/src/app

# Install system dependencies and Chromium for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxss1 \
    lsb-release \
    xdg-utils \
    wget \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --silent && npm cache clean --force

# Copy application code
COPY src/ ./src/

# Create non-root user for security
RUN groupadd -r speedtest && useradd -r -g speedtest -s /bin/false speedtest

# Change ownership of the app directory
RUN chown -R speedtest:speedtest /usr/src/app

# Switch to non-root user
USER speedtest

# Expose port (if needed for health checks)
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "console.log('Health check')" || exit 1

# Start the application
CMD ["npm", "start"]
