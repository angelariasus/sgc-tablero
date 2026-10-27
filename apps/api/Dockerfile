# Imagen de la API (Railway). Contexto de construcción: la raíz del repositorio.
FROM node:24-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @sgc/api build

FROM node:24-slim
WORKDIR /app
COPY --from=build /repo/apps/api/dist ./
RUN npm install --omit=dev --no-audit --no-fund
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
