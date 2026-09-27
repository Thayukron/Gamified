# ARCANA PROFILE — web (Nuxt SPA built to static files, served by Nginx which also proxies /api)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# the browser calls the API on the same origin: https://<host>/api/...
ENV NUXT_PUBLIC_API_BASE=/api
RUN npx nuxt generate

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/.output/public /usr/share/nginx/html
