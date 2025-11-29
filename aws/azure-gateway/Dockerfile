# Azure Realtime Gateway Container

# Build stage
FROM node:20-alpine AS build
WORKDIR /app
# Install deps
COPY package.json ./
RUN npm install
# Copy sources
COPY tsconfig.json ./
COPY server.ts ./
COPY agent-bot.ts ./
# Compile TypeScript
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Install only prod deps
COPY package.json ./
RUN npm install --omit=dev
# Copy compiled JS
COPY --from=build /app/dist ./dist
# Port and start
EXPOSE 8080
CMD ["node", "dist/server.js"]
