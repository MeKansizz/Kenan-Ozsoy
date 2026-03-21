FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Build frontend + server
RUN npm run build:all

# Seed database if not exists
RUN npm run db:seed || true

EXPOSE 3002
ENV PORT=3002
ENV NODE_ENV=production

CMD ["node", "dist-server/index.js"]
