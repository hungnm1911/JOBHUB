FROM node:22-bookworm-slim

WORKDIR /app

# Backend depends on the local AI Kit package at ../ai-kit.
COPY ai-kit/package.json ai-kit/package-lock.json ./ai-kit/
RUN cd ai-kit && npm ci --omit=dev
COPY ai-kit/ ./ai-kit/

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/

WORKDIR /app/backend
USER node
EXPOSE 8000
CMD ["node", "index.js"]
