FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
ENV NODE_ENV=production HOST=0.0.0.0
CMD ["node", "apps/control-plane/dist/index.js"]
