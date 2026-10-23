FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace=backend --workspace=shared --include-workspace-root
COPY shared shared
COPY backend backend
RUN npm run build -w backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/prisma backend/prisma
COPY --from=build /app/backend/prisma.config.ts backend/prisma.config.ts
COPY --from=build /app/backend/package.json backend/package.json
WORKDIR /app/backend
EXPOSE 5000
# apply migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
