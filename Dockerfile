# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/

RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY web/ ./web/

# Build in explicit order: shared must exist before server tsc runs
RUN npm run build -w @blunder-lens/shared && \
    npm run build -w @blunder-lens/server && \
    npm run build -w @blunder-lens/web

# ── Stage 2: run ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/

# Stub web workspace so npm sets up symlinks without installing
# react/react-dom/etc. — those are only needed at build time.
RUN mkdir -p web && printf '{"name":"@blunder-lens/web","version":"0.0.1","private":true}' > web/package.json

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/web/dist ./web/dist

EXPOSE 8787
ENV PORT=8787

CMD ["node", "server/dist/index.js"]
