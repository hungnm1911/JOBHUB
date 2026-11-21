FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
RUN corepack enable
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./

FROM dependencies AS development
EXPOSE 5173
CMD ["yarn", "dev", "--host", "0.0.0.0", "--strictPort"]

FROM dependencies AS build
ARG VITE_API_BASE_URL
ARG VITE_SOCKET_URL
RUN test -n "$VITE_API_BASE_URL" && test -n "$VITE_SOCKET_URL" \
    && VITE_APP_ENV=production VITE_API_BASE_URL="$VITE_API_BASE_URL" \
       VITE_SOCKET_URL="$VITE_SOCKET_URL" yarn build

FROM nginx:stable-alpine AS production
COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
