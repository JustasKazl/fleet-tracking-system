# --- Build stage ---
FROM node:18 AS build

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json package-lock.json ./

# Install ALL dependencies (devDependencies needed for vite build)
RUN npm ci

# Copy all source code
COPY . .

# Build the production bundle
RUN npm run build

# --- Production stage ---
FROM caddy:2

# Copy Caddy configuration
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built static files from build stage
COPY --from=build /app/dist /srv

# Expose port 8080
EXPOSE 8080

# Start Caddy server
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
