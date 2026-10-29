# ARCANA PROFILE — web + API (Nuxt 3 / Nitro on Node 22, talks to MariaDB directly)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# the browser calls the API on the same origin: https://<host>/api/...
ENV NUXT_PUBLIC_API_BASE=/api
RUN npx nuxt build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/.output/server ./server
COPY --from=build /app/.output/public ./public
# schema + upgrades live with the app so db:init / db:upgrade work inside the container
COPY --from=build /app/database ./database
COPY --from=build /app/scripts ./scripts
# app.key (Gemini key encryption) is mounted at runtime — never baked into the image
RUN mkdir -p /app/storage
EXPOSE 3000
# run pending schema upgrades (no-op when up to date), then start the server
CMD ["sh", "-c", "node scripts/upgrade-db.mjs && node server/index.mjs"]
