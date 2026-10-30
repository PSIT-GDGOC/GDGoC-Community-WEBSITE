# ==========================================
# Production Runtime Container
# ==========================================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install wget for container health checks
RUN apk add --no-cache wget

# Copy package manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy server code
COPY . .

# Switch to standard unprivileged node user
USER node

# Expose backend API port
EXPOSE 5000

# Container liveness probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Start production server
CMD ["node", "index.js"]
