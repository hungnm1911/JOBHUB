FROM node:22-bookworm-slim AS manifests

WORKDIR /app
COPY ai-kit/package.json ai-kit/package-lock.json ./ai-kit/
COPY backend/package.json backend/package-lock.json ./backend/

FROM manifests AS development
RUN cd ai-kit && npm ci
COPY ai-kit/ ./ai-kit/
RUN cd backend && npm ci
COPY backend/ ./backend/
WORKDIR /app/backend
EXPOSE 8000
CMD ["sh", "-c", "if [ \"$DEV_POLLING\" = \"true\" ]; then set -- -L; fi; exec ./node_modules/.bin/nodemon \"$@\" --watch . --watch ../ai-kit/src index.js"]

FROM manifests AS production
RUN cd ai-kit && npm ci --omit=dev
COPY ai-kit/ ./ai-kit/
RUN cd backend && npm ci --omit=dev
COPY backend/ ./backend/
WORKDIR /app/backend
USER node
EXPOSE 8000
CMD ["node", "index.js"]
