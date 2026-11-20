# Test-only web preview, no backend or payment processing.
FROM node:22-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/brand/package.json packages/brand/package.json
RUN pnpm install --no-frozen-lockfile
COPY apps/web ./apps/web
COPY packages/core ./packages/core
COPY packages/brand ./packages/brand
RUN pnpm --filter @tazumo/web build

FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/wopee-io-demos/tazumo"
LABEL org.opencontainers.image.title="Tazumo web test preview"
LABEL org.opencontainers.image.description="Synthetic catalogue demonstration; not production commerce"
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
