FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Build frontend + server + seed script
RUN npm run build:all
RUN npx esbuild server/seed-kenan.ts --bundle --platform=node --outfile=dist-server/seed.js --external:better-sqlite3

# Seed database
RUN node dist-server/seed.js

# Cleanup dev dependencies
RUN npm prune --production

EXPOSE 3002
ENV PORT=3002
ENV NODE_ENV=production

CMD ["node", "dist-server/index.js"]
