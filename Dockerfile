FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates postgresql-client tar && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/runtime-api/package.json apps/runtime-api/
COPY apps/control-api/package.json apps/control-api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY tsconfig.json ./
COPY db db
COPY apps apps
COPY packages packages
COPY scripts scripts
RUN npm run build && mkdir -p .local && chown -R node:node .local
ENV NODE_ENV=production
FROM build AS runtime
USER node
EXPOSE 3001
CMD ["node","apps/runtime-api/dist/index.js"]
FROM build AS control
USER node
EXPOSE 3002
CMD ["node","apps/control-api/dist/index.js"]
