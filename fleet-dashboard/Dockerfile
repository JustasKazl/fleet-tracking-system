# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Delete old lock file and install dependencies
RUN rm -f package-lock.json && \
    npm install --legacy-peer-deps

# Copy all source code
COPY . .

# Build the production bundle
RUN npm run build

# --- Production stage ---
FROM nginx:alpine

# Copy built files to nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration if you have one
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
