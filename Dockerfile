# Multi-stage Dockerfile for production
FROM node:24-alpine AS builder

WORKDIR /app

# Install build deps
COPY package.json package-lock.json* ./
# Use `npm ci` when a lockfile exists, otherwise fall back to `npm install`.
# Skip running lifecycle scripts now (e.g. postinstall) so build runs after source is copied.
RUN sh -c 'if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi'

# Copy source and build both client and server
COPY . .
# Now run lifecycle scripts (postinstall/build) with source present
RUN npm run build && npm run build:server

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built output from builder
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/dist-server /app/dist-server

# Install only production deps
COPY package.json package-lock.json* ./
# In the runtime image prefer `npm ci` when lockfile present, otherwise install.
# Skip lifecycle scripts here to avoid running build steps (we already copied built artifacts).
RUN sh -c 'if [ -f package-lock.json ]; then npm ci --only=production --ignore-scripts; else npm install --production --ignore-scripts; fi'

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "dist-server/server.js"]
