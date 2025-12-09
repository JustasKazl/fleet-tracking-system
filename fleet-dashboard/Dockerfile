# --- Build stage ---
FROM node:18 AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the app
RUN npm run build

# --- Production stage ---
FROM caddy:2

# Copy Caddy config
COPY Caddyfile /etc/caddy/Caddyfile

# Copy built files from build stage
COPY --from=build /app/dist /srv

EXPOSE 8080
