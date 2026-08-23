FROM node:24-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Prisma's config imports the validated app config, so generation needs safe
# build-only values. Runtime secrets are supplied by Compose or Render.
ENV DATABASE_URL=postgresql://eventify:eventify@db:5432/eventify \
    REDIS_URL=redis://redis:6379 \
    JWT_ACCESS_SECRET=build-only-secret-at-least-32-characters \
    WEB_ORIGIN=http://localhost:5173
RUN npx prisma generate && npm run build

FROM node:24-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app
RUN chown node:node /app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/src/config.ts ./src/config.ts
COPY --from=build --chown=node:node /app/src/generated ./src/generated

EXPOSE 3011
CMD ["node", "dist/server.js"]
